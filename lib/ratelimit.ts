import { NextResponse } from "next/server";
import { securityMonitoringService } from "@/lib/services/monitoring/security-monitoring";
import { getRedisConnection } from "@/lib/queue/connection";
import type { RateLimiterLike } from "@/lib/redis/sliding-window-ratelimit";
import { createSlidingWindowRateLimiter } from "@/lib/redis/sliding-window-ratelimit";

/**
 * Rate limiting configuration for API routes
 * 
 * This module provides distributed rate limiting using Redis with a sliding window algorithm.
 * If Redis is unavailable, it fails open (does not block requests).
 * 
 * @module lib/ratelimit
 * @see {@link https://docs.upstash.com/redis/features/ratelimiting|Upstash Rate Limiting}
 */

/**
 * Redis client for distributed rate limiting.
 */
let ratelimitDisabledUntilMs = 0;

const redis = getRedisConnection();

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
  auth: createSlidingWindowRateLimiter({
    redis: redis as any,
    prefix: "ratelimit:auth",
    limit: 5,
    windowMs: 15 * 60 * 1000,
  }),

  // Moderate rate limit for general API endpoints
  api: createSlidingWindowRateLimiter({
    redis: redis as any,
    prefix: "ratelimit:api",
    limit: 100,
    windowMs: 60 * 1000,
  }),

  // Higher rate limit for read-only operations
  read: createSlidingWindowRateLimiter({
    redis: redis as any,
    prefix: "ratelimit:read",
    limit: 200,
    windowMs: 60 * 1000,
  }),

  // Lower rate limit for write operations (POST, PUT, DELETE)
  write: createSlidingWindowRateLimiter({
    redis: redis as any,
    prefix: "ratelimit:write",
    limit: 30,
    windowMs: 60 * 1000,
  }),

  // Very strict rate limit for sync operations (resource-intensive)
  sync: createSlidingWindowRateLimiter({
    redis: redis as any,
    prefix: "ratelimit:sync",
    limit: 5,
    windowMs: 5 * 60 * 1000,
  }),

  // Strict rate limit for import/export operations
  importExport: createSlidingWindowRateLimiter({
    redis: redis as any,
    prefix: "ratelimit:import-export",
    limit: 10,
    windowMs: 60 * 1000,
  }),
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
  limiter: RateLimiterLike,
  identifier: string,
): Promise<{
  success: boolean;
  limit: number;
  remaining: number;
  reset: number;
}> {
  // If temporarily disabled, skip rate limiting (fail open).
  if (ratelimitDisabledUntilMs > Date.now()) {
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
  } catch (_err) {
    // Redis error: disable briefly to avoid spamming logs during outages.
    ratelimitDisabledUntilMs = Date.now() + 30 * 1000;
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
