import { NextRequest, NextResponse } from "next/server";
import { rateLimiters, getRateLimitIdentifier, checkRateLimit, createRateLimitResponse } from "@/lib/ratelimit";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

/**
 * Rate limit middleware wrapper for Next.js API routes
 * Usage: export async function POST(req: NextRequest) { return withRateLimit(req, 'auth', handler); }
 */
export async function withRateLimit(
  req: NextRequest,
  limiterType: keyof typeof rateLimiters,
  handler: (req: NextRequest) => Promise<NextResponse>
): Promise<NextResponse> {
  try {
    // Get user session if available
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id || null;

    // Get identifier for rate limiting
    const identifier = getRateLimitIdentifier(req, userId);

    // Get the appropriate rate limiter
    const limiter = rateLimiters[limiterType];

    // Check rate limit
    const { success, limit, remaining, reset } = await checkRateLimit(limiter, identifier);

    if (!success) {
      return createRateLimitResponse(limit, remaining, reset);
    }

    // Execute handler
    const response = await handler(req);

    // Add rate limit headers to successful responses
    response.headers.set("X-RateLimit-Limit", limit.toString());
    response.headers.set("X-RateLimit-Remaining", remaining.toString());
    response.headers.set("X-RateLimit-Reset", reset.toString());

    return response;
  } catch (error) {
    // If rate limiting fails, log but don't block the request (fail open)
    console.error("[RateLimit] Error checking rate limit:", error);
    return handler(req);
  }
}

/**
 * Determine rate limiter type based on HTTP method and path
 */
export function getRateLimiterType(method: string, pathname: string): keyof typeof rateLimiters {
  // Auth endpoints - strict rate limiting
  if (pathname.includes("/auth/") || pathname.includes("/register")) {
    return "auth";
  }

  // Sync operations - very strict
  if (pathname.includes("/sync") || pathname.includes("/competitors/sync")) {
    return "sync";
  }

  // Import/Export - moderate
  if (pathname.includes("/import") || pathname.includes("/export")) {
    return "importExport";
  }

  // Write operations (POST, PUT, DELETE)
  if (["POST", "PUT", "DELETE", "PATCH"].includes(method)) {
    return "write";
  }

  // Read operations (GET)
  if (method === "GET") {
    return "read";
  }

  // Default to general API rate limit
  return "api";
}
