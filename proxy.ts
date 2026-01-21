import { withAuth } from "next-auth/middleware";
import { NextRequest, NextResponse } from "next/server";
import { verifyCsrf } from "./lib/security";

/**
 * Combined Proxy for Authentication and Security (CSRF)
 * Next.js 16 convention rename from middleware to proxy
 */
export default withAuth(
  function proxy(req: NextRequest) {
    const { pathname } = req.nextUrl;

    // 1. CSRF Protection for state-changing API requests
    if (pathname.startsWith("/api/v1/")) {
      // Skip CSRF for Next-Auth internal routes
      if (pathname.includes("/api/auth")) {
        return NextResponse.next();
      }

      if (!verifyCsrf(req)) {
        return NextResponse.json(
          { error: "CSRF validation failed or missing origin header" },
          { status: 403 },
        );
      }
    }

    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ token, req }) => {
        const { pathname } = req.nextUrl;

        // Require authentication for all dashboard routes
        if (pathname.startsWith("/dashboard")) {
          return !!token;
        }

        // Require authentication for all admin routes
        if (pathname.startsWith("/admin")) {
          // If it's a super admin route, check the flag
          if (token?.isSuperAdmin) {
            return true;
          }
          return false;
        }

        // Allow other routes (public APIs, login, etc.)
        return true;
      },
    },
    pages: {
      signIn: "/auth/login",
    },
  },
);

export const config = {
  matcher: ["/dashboard/:path*", "/admin/:path*", "/api/v1/:path*"],
};
