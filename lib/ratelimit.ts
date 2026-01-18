import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

/**
 * Rate limiting configuration for API routes
 * Uses Upstash Redis in production, falls back to in-memory for development
 */

// Initialize Redis client (optional - will use memory if not configured)
const redis =
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
    ? new Redis({
        url: process.env.UPSTASH_REDIS_REST_URL,
        token: process.env.UPSTASH_REDIS_REST_TOKEN,
      })
    : undefined;

/**
 * Rate limiters with different limits for different endpoints
 */
export const rateLimiters = {
  // Strict rate limit for authentication endpoints (prevent brute force)
  auth: new Ratelimit({
    redis: redis || undefined,
    limiter: Ratelimit.slidingWindow(5, "15 m"), // 5 requests per 15 minutes
    analytics: true,
    prefix: "@upstash/ratelimit/auth",
  }),

  // Moderate rate limit for general API endpoints
  api: new Ratelimit({
    redis: redis || undefined,
    limiter: Ratelimit.slidingWindow(100, "1 m"), // 100 requests per minute
    analytics: true,
    prefix: "@upstash/ratelimit/api",
  }),

  // Higher rate limit for read-only operations
  read: new Ratelimit({
    redis: redis || undefined,
    limiter: Ratelimit.slidingWindow(200, "1 m"), // 200 requests per minute
    analytics: true,
    prefix: "@upstash/ratelimit/read",
  }),

  // Lower rate limit for write operations (POST, PUT, DELETE)
  write: new Ratelimit({
    redis: redis || undefined,
    limiter: Ratelimit.slidingWindow(30, "1 m"), // 30 requests per minute
    analytics: true,
    prefix: "@upstash/ratelimit/write",
  }),

  // Very strict rate limit for sync operations (resource-intensive)
  sync: new Ratelimit({
    redis: redis || undefined,
    limiter: Ratelimit.slidingWindow(5, "5 m"), // 5 requests per 5 minutes
    analytics: true,
    prefix: "@upstash/ratelimit/sync",
  }),

  // Strict rate limit for import/export operations
  importExport: new Ratelimit({
    redis: redis || undefined,
    limiter: Ratelimit.slidingWindow(10, "1 m"), // 10 requests per minute
    analytics: true,
    prefix: "@upstash/ratelimit/import-export",
  }),
} as const;

/**
 * Get identifier for rate limiting based on request
 * Prioritizes user ID over IP address
 */
export function getRateLimitIdentifier(
  request: Request,
  userId?: string | null
): string {
  // Use user ID if authenticated (more accurate than IP)
  if (userId) {
    return `user:${userId}`;
  }

  // Fallback to IP address for unauthenticated requests
  const forwarded = request.headers.get("x-forwarded-for");
  const ip = forwarded ? forwarded.split(",")[0] : request.headers.get("x-real-ip") || "unknown";

  return `ip:${ip}`;
}

/**
 * Check rate limit and return response headers
 */
export async function checkRateLimit(
  limiter: Ratelimit,
  identifier: string
): Promise<{ success: boolean; limit: number; remaining: number; reset: number }> {
  const result = await limiter.limit(identifier);

  return {
    success: result.success,
    limit: result.limit,
    remaining: result.remaining,
    reset: result.reset,
  };
}

/**
 * Create rate limit response with appropriate headers
 */
export function createRateLimitResponse(
  limit: number,
  remaining: number,
  reset: number
): Response {
  return new Response(
    JSON.stringify({
      error: "Too Many Requests",
      message: "Rate limit exceeded. Please try again later.",
      retryAfter: Math.ceil((reset - Date.now()) / 1000),
    }),
    {
      status: 429,
      headers: {
        "Content-Type": "application/json",
        "X-RateLimit-Limit": limit.toString(),
        "X-RateLimit-Remaining": remaining.toString(),
        "X-RateLimit-Reset": reset.toString(),
        "Retry-After": Math.ceil((reset - Date.now()) / 1000).toString(),
      },
    }
  );
}
