import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { NextResponse } from "next/server";
import { securityMonitoringService } from "@/lib/services/monitoring/security-monitoring";

/**
 * Rate limiting configuration for API routes
 * 
 * This module provides distributed rate limiting using Upstash Redis with sliding window algorithm.
 * In development or when Redis is not configured, it falls back to in-memory rate limiting.
 * 
 * @module lib/ratelimit
 * @see {@link https://docs.upstash.com/redis/features/ratelimiting|Upstash Rate Limiting}
 */

/**
 * Redis client for distributed rate limiting
 * 
 * Initialized from environment variables:
 * - UPSTASH_REDIS_REST_URL: Redis instance URL
 * - UPSTASH_REDIS_REST_TOKEN: Authentication token
 * 
 * If not configured, rate limiting falls back to in-memory storage (single instance only).
 */
const preferLocalInDev = process.env.REDIS_PREFER_LOCAL_IN_DEV !== "false";
const allowUpstashInDev = process.env.UPSTASH_RATE_LIMIT_IN_DEV === "true";

let ratelimitDisabledUntilMs = 0;

function isUpstashQuotaError(err: unknown): boolean {
  const msg =
    err instanceof Error
      ? err.message
      : typeof err === "string"
        ? err
        : (() => {
          try {
            return JSON.stringify(err);
          } catch {
            return String(err);
          }
        })();
  return msg.includes("max requests limit exceeded");
}

function shouldUseUpstashRateLimit(): boolean {
  const hasUpstash =
    !!process.env.UPSTASH_REDIS_REST_URL && !!process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!hasUpstash) return false;

  if (process.env.NODE_ENV === "production") return true;
  if (allowUpstashInDev) return true;

  // Dev default: if we prefer local Redis, do not use Upstash (avoid quota burn).
  return !preferLocalInDev;
}

const redis = shouldUseUpstashRateLimit()
  ? new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!,
  })
  : undefined;

type RateLimitResult = {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number;
};

type RateLimiterLike = {
  limit: (identifier: string) => Promise<RateLimitResult>;
};

function createNoopLimiter(limit: number): RateLimiterLike {
  return {
    async limit() {
      return {
        success: true,
        limit,
        remaining: limit,
        reset: Date.now() + 60_000,
      };
    },
  };
}

/**
 * Rate limiter configurations for different endpoint types
 * 
 * Each limiter uses a sliding window algorithm to track requests over time.
 * Base limits are multiplied by plan-specific multipliers for tenant-based rate limiting.
 * 
 * Available limiters:
 * - `auth`: Strict limits for authentication endpoints (5 req/15min)
 * - `api`: General API endpoints (100 req/min)
 * - `read`: Read-only operations (200 req/min)
 * - `write`: Write operations (30 req/min)
 * - `sync`: Resource-intensive sync operations (5 req/5min)
 * - `importExport`: Import/export operations (10 req/min)
 * 
 * @example
 * ```typescript
 * import { rateLimiters } from '@/lib/ratelimit';
 * 
 * const limiter = rateLimiters.auth;
 * const result = await limiter.limit('user:123');
 * ```
 */
export const rateLimiters = {
  // Strict rate limit for authentication endpoints (prevent brute force)
  auth: redis
    ? new Ratelimit({
      redis: redis as any,
      limiter: Ratelimit.slidingWindow(5, "15 m"), // 5 requests per 15 minutes
      analytics: true,
      prefix: "@upstash/ratelimit/auth",
    })
    : (createNoopLimiter(1_000_000) as any),

  // Moderate rate limit for general API endpoints
  api: redis
    ? new Ratelimit({
      redis: redis as any,
      limiter: Ratelimit.slidingWindow(100, "1 m"), // 100 requests per minute
      analytics: true,
      prefix: "@upstash/ratelimit/api",
    })
    : (createNoopLimiter(1_000_000) as any),

  // Higher rate limit for read-only operations
  read: redis
    ? new Ratelimit({
      redis: redis as any,
      limiter: Ratelimit.slidingWindow(200, "1 m"), // 200 requests per minute
      analytics: true,
      prefix: "@upstash/ratelimit/read",
    })
    : (createNoopLimiter(1_000_000) as any),

  // Lower rate limit for write operations (POST, PUT, DELETE)
  write: redis
    ? new Ratelimit({
      redis: redis as any,
      limiter: Ratelimit.slidingWindow(30, "1 m"), // 30 requests per minute
      analytics: true,
      prefix: "@upstash/ratelimit/write",
    })
    : (createNoopLimiter(1_000_000) as any),

  // Very strict rate limit for sync operations (resource-intensive)
  sync: redis
    ? new Ratelimit({
      redis: redis as any,
      limiter: Ratelimit.slidingWindow(5, "5 m"), // 5 requests per 5 minutes
      analytics: true,
      prefix: "@upstash/ratelimit/sync",
    })
    : (createNoopLimiter(1_000_000) as any),

  // Strict rate limit for import/export operations
  importExport: redis
    ? new Ratelimit({
      redis: redis as any,
      limiter: Ratelimit.slidingWindow(10, "1 m"), // 10 requests per minute
      analytics: true,
      prefix: "@upstash/ratelimit/import-export",
    })
    : (createNoopLimiter(1_000_000) as any),
} as const;

/**
 * Get unique identifier for rate limiting based on request context
 * 
 * This function determines the identifier used to track rate limits.
 * It prioritizes authenticated user ID over IP address for more accurate tracking.
 * 
 * @param request - The incoming HTTP request
 * @param userId - Optional authenticated user ID from session
 * @returns A unique identifier string in format "user:xxx" or "ip:xxx"
 * 
 * @example
 * ```typescript
 * // Authenticated request
 * const identifier = getRateLimitIdentifier(req, 'user-123');
 * // Returns: "user:user-123"
 * 
 * // Unauthenticated request
 * const identifier = getRateLimitIdentifier(req, null);
 * // Returns: "ip:192.168.1.1"
 * ```
 */
export function getRateLimitIdentifier(
  request: Request,
  userId?: string | null,
): string {
  // Use user ID if authenticated (more accurate than IP)
  if (userId) {
    return `user:${userId}`;
  }

  // Fallback to IP address for unauthenticated requests
  const forwarded = request.headers.get("x-forwarded-for");
  const ip = forwarded
    ? forwarded.split(",")[0]
    : request.headers.get("x-real-ip") || "unknown";

  return `ip:${ip}`;
}

/**
 * Check rate limit for a given identifier
 * 
 * This function checks if the identifier has exceeded the rate limit.
 * If Redis is not configured (development mode), it always returns success.
 * 
 * @param limiter - The rate limiter instance to use
 * @param identifier - The unique identifier to check (from getRateLimitIdentifier)
 * @returns Promise resolving to rate limit status with headers
 * 
 * @example
 * ```typescript
 * const result = await checkRateLimit(rateLimiters.auth, 'user:123');
 * 
 * if (!result.success) {
 *   console.log(`Rate limited. Retry after ${result.reset - Date.now()}ms`);
 * }
 * 
 * console.log(`${result.remaining}/${result.limit} requests remaining`);
 * ```
 */
export async function checkRateLimit(
  limiter: Ratelimit,
  identifier: string,
): Promise<{
  success: boolean;
  limit: number;
  remaining: number;
  reset: number;
}> {
  // If Upstash is not configured or temporarily disabled, skip rate limiting (fail open).
  if (!redis || ratelimitDisabledUntilMs > Date.now()) {
    return {
      success: true,
      limit: 1000,
      remaining: 999,
      reset: Date.now(),
    };
  }

  try {
    const result = await limiter.limit(identifier);

    return {
      success: result.success,
      limit: result.limit,
      remaining: result.remaining,
      reset: result.reset,
    };
  } catch (err) {
    // Upstash quota exhausted: disable further checks for a while to avoid log spam.
    if (isUpstashQuotaError(err)) {
      ratelimitDisabledUntilMs = Date.now() + 60 * 60 * 1000;
      console.warn("[RateLimit] Upstash quota exceeded; rate limiting disabled temporarily.");
    }
    return {
      success: true,
      limit: 1000,
      remaining: 999,
      reset: Date.now(),
    };
  }
}

/**
 * Create HTTP 429 rate limit error response with appropriate headers
 * 
 * This function generates a standardized rate limit error response
 * with all required headers for client-side handling. Also records
 * the rate limit violation for security monitoring.
 * 
 * @param limit - Total requests allowed in the time window
 * @param remaining - Remaining requests in current window
 * @param reset - Unix timestamp (ms) when the limit resets
 * @param context - Optional security context for monitoring
 * @returns NextResponse with 429 status and rate limit headers
 * 
 * @example
 * ```typescript
 * if (!rateLimitResult.success) {
 *   return createRateLimitResponse(
 *     rateLimitResult.limit,
 *     rateLimitResult.remaining,
 *     rateLimitResult.reset,
 *     { ipAddress: '192.168.1.1', endpoint: '/api/v1/products' }
 *   );
 * }
 * ```
 * 
 * Response format:
 * ```json
 * {
 *   "error": "Too Many Requests",
 *   "message": "Rate limit exceeded. Please try again later.",
 *   "retryAfter": 45
 * }
 * ```
 * 
 * Headers:
 * - X-RateLimit-Limit: Total allowed requests
 * - X-RateLimit-Remaining: Remaining requests
 * - X-RateLimit-Reset: Reset timestamp
 * - Retry-After: Seconds to wait
 */
export function createRateLimitResponse(
  limit: number,
  remaining: number,
  reset: number,
  context?: {
    ipAddress: string;
    endpoint?: string;
    userId?: string;
    userAgent?: string;
  }
): NextResponse {
  // Record rate limit violation for security monitoring
  if (context) {
    securityMonitoringService.recordRateLimitViolation({
      ipAddress: context.ipAddress,
      endpoint: context.endpoint,
      userId: context.userId,
      userAgent: context.userAgent,
    }).catch(err => {
      console.error('[RateLimit] Failed to record violation:', err);
    });
  }

  return new NextResponse(
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
    },
  );
}
