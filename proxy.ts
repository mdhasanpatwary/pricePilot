import { withAuth } from "next-auth/middleware";
import { NextRequest, NextResponse } from "next/server";
import { verifyCsrf } from "./lib/security";
import { getToken } from "next-auth/jwt";

/**
 * Combined Proxy for Authentication, Security (CSRF + CSP), and Request Monitoring
 * Next.js 16 convention rename from middleware to proxy
 *
 * Features:
 * - Authentication and authorization
 * - CSRF protection
 * - Content Security Policy (CSP)
 * - Response time tracking
 * - Error rate tracking
 * - Tenant context extraction
 * - Security event monitoring
 */

// Import metrics collector and security monitoring dynamically to avoid initialization issues
let metricsCollector: any = null;
let securityMonitoring: any = null;

async function getMetricsCollector() {
  if (!metricsCollector) {
    const mod = await import("@/lib/services/monitoring/metrics-collector");
    metricsCollector = mod.metricsCollector;
  }
  return metricsCollector;
}

async function getSecurityMonitoring() {
  if (!securityMonitoring) {
    const mod = await import("@/lib/services/monitoring/security-monitoring");
    securityMonitoring = mod.securityMonitoringService;
  }
  return securityMonitoring;
}

/**
 * Extract IP address from request
 */
function extractIpAddress(req: NextRequest): string {
  const forwarded = req.headers.get("x-forwarded-for");
  const ip = forwarded
    ? forwarded.split(",")[0]
    : req.headers.get("x-real-ip") || "unknown";
  return ip;
}

/**
 * Extract tenant ID from authenticated request
 */
async function extractTenantId(req: NextRequest): Promise<string | undefined> {
  try {
    const token = await getToken({
      req: req as any,
      secret: process.env.NEXTAUTH_SECRET,
    });

    return token?.tenantId as string | undefined;
  } catch (error) {
    // Silently fail - tenant context is optional
    return undefined;
  }
}

/**
 * Extract user ID from authenticated request
 */
async function extractUserId(req: NextRequest): Promise<string | undefined> {
  try {
    const token = await getToken({
      req: req as any,
      secret: process.env.NEXTAUTH_SECRET,
    });

    return token?.id as string | undefined;
  } catch (error) {
    // Silently fail - user context is optional
    return undefined;
  }
}

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

  // Start timing for API routes
  const startTime = req.nextUrl.pathname.startsWith("/api/") ? performance.now() : 0;

  // Extract context for monitoring (non-blocking)
  const tenantIdPromise = req.nextUrl.pathname.startsWith("/api/") ? extractTenantId(req) : Promise.resolve(undefined);
  const userIdPromise = req.nextUrl.pathname.startsWith("/api/") ? extractUserId(req) : Promise.resolve(undefined);
  const ipAddress = extractIpAddress(req);
  const userAgent = req.headers.get("user-agent") || undefined;
  const endpoint = req.nextUrl.pathname;
  const method = req.method;

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

  // Record metrics asynchronously for API routes (fire-and-forget)
  // This ensures minimal overhead on request processing
  if (startTime > 0) {
    Promise.resolve().then(async () => {
      try {
        const endTime = performance.now();
        const duration = endTime - startTime;

        const collector = await getMetricsCollector();
        const security = await getSecurityMonitoring();
        const tenantId = await tenantIdPromise;
        const userId = await userIdPromise;

        // Record response time
        await collector.recordResponseTime(endpoint, duration, tenantId);

        // Record error if response indicates failure
        if (res.status >= 400) {
          const errorType = res.status >= 500 ? "server_error" : "client_error";
          await collector.recordError(endpoint, errorType, tenantId);

          // Track unauthorized access attempts (401, 403)
          if (res.status === 401 || res.status === 403) {
            await security.recordUnauthorizedAccess({
              ipAddress,
              userAgent,
              endpoint,
              userId,
              tenantId,
              method,
              statusCode: res.status,
            });
          }
        }
      } catch (error) {
        // Silently fail - monitoring should never break the application
        console.error("[Proxy] Failed to record metrics:", error);
      }
    });
  }

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
