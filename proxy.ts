import { withAuth } from "next-auth/middleware";
import { NextRequest, NextResponse } from "next/server";
import { verifyCsrf } from "./lib/security";

/**
 * Combined Proxy for Authentication and Security (CSRF + CSP)
 * Next.js 16 convention rename from middleware to proxy
 */

const authMiddleware = withAuth(
  function middleware(req: NextRequest) {
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
          return !!token?.isSuperAdmin;
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

export default async function proxy(req: NextRequest, event: any) {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const isDev = process.env.NODE_ENV === "development";

  // Highly restricted CSP
  // - Removes 'unsafe-eval' in production
  // - Uses 'nonce' for inline scripts
  // - Uses 'strict-dynamic' for modern script loading
  // - Restricts frame-ancestors to 'none' (prevents clickjacking)
  const cspHeader = `
    default-src 'self';
    script-src 'self' 'nonce-${nonce}' 'strict-dynamic' ${isDev ? "'unsafe-eval'" : ""};
    style-src 'self' 'unsafe-inline';
    img-src 'self' blob: data: https:;
    font-src 'self' data:;
    object-src 'none';
    base-uri 'self';
    form-action 'self';
    frame-ancestors 'none';
    connect-src 'self' https:;
    upgrade-insecure-requests;
  `
    .replace(/\s{2,}/g, " ")
    .trim();

  // Run the authentication and CSRF logic
  // We use the authMiddleware but we need to accommodate its internal response handling
  const response = await (authMiddleware as any)(req, event);

  // If authMiddleware returned a response (redirect or JSON error), use it.
  // Otherwise, continue with next().
  const res = response || NextResponse.next();

  // Inject Security Headers
  res.headers.set("Content-Security-Policy", cspHeader);
  res.headers.set("x-nonce", nonce);
  res.headers.set("X-Frame-Options", "DENY");
  res.headers.set("X-Content-Type-Options", "nosniff");
  res.headers.set("Referrer-Policy", "origin-when-cross-origin");

  return res;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public (public files)
     */
    "/((?!_next/static|_next/image|favicon.ico|public).*)",
  ],
};
