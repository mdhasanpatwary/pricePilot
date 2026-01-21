import { NextRequest, NextResponse } from "next/server";
import { verifyCsrf } from "./lib/security";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Only apply CSRF protection to API routes
  if (pathname.startsWith("/api/")) {
    // Skip protection for public webhooks if they existed or auth endpoints
    // For now, next-auth handles its own CSRF, and we want to protect our v1 routes.

    // We exclude next-auth endpoints as it has built-in CSRF handling
    if (pathname.includes("/api/auth")) {
      return NextResponse.next();
    }

    if (!verifyCsrf(request)) {
      return NextResponse.json(
        { error: "CSRF token mismatch or missing origin header" },
        { status: 403 },
      );
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    "/api/:path*",
  ],
};
