import { NextRequest, NextResponse } from "next/server";
import { getRedisConnection } from "@/lib/queue/connection";
import type { RateLimiterLike } from "@/lib/redis/sliding-window-ratelimit";
import { createSlidingWindowRateLimiter } from "@/lib/redis/sliding-window-ratelimit";

/**
 * Rate limiting for documentation endpoints
 * 
 * This module provides specialized rate limiting for the dual documentation system:
 * - Tenant docs: 100 requests/minute per IP
 * - Admin docs: 1000 requests/hour per token
 * - Search: 100 requests/minute per IP
 * - Feedback: 10 submissions/hour per user
 * 
 * @module lib/documentation/rate-limit
 */

const redis = getRedisConnection();

/**
 * Rate limiters for documentation endpoints
 */
export const documentationRateLimiters = {
    // Tenant documentation: 100 requests/minute per IP
    tenantDocs: createSlidingWindowRateLimiter({
        redis: redis as any,
        prefix: "ratelimit:docs:tenant",
        limit: 100,
        windowMs: 60 * 1000,
    }),

    // Admin documentation: 1000 requests/hour per token (authenticated users)
    adminDocs: createSlidingWindowRateLimiter({
        redis: redis as any,
        prefix: "ratelimit:docs:admin",
        limit: 1000,
        windowMs: 60 * 60 * 1000,
    }),

    // Search: 100 requests/minute per IP
    search: createSlidingWindowRateLimiter({
        redis: redis as any,
        prefix: "ratelimit:docs:search",
        limit: 100,
        windowMs: 60 * 1000,
    }),

    // Feedback: 10 submissions/hour per user
    feedback: createSlidingWindowRateLimiter({
        redis: redis as any,
        prefix: "ratelimit:docs:feedback",
        limit: 10,
        windowMs: 60 * 60 * 1000,
    }),
} as const;

/**
 * Get rate limit identifier for documentation requests
 */
export function getDocumentationRateLimitIdentifier(
    request: NextRequest,
    userId?: string | null,
    useUserId: boolean = false
): string {
    // Use user ID for authenticated endpoints (admin docs, feedback)
    if (useUserId && userId) {
        return `user:${userId}`;
    }

    // Use IP address for public endpoints (tenant docs, search)
    const forwarded = request.headers.get("x-forwarded-for");
    const ip = forwarded
        ? forwarded.split(",")[0]
        : request.headers.get("x-real-ip") || "unknown";

    return `ip:${ip}`;
}

/**
 * Check rate limit and return response if exceeded
 */
export async function checkDocumentationRateLimit(
    limiter: RateLimiterLike,
    identifier: string
): Promise<{
    success: boolean;
    limit: number;
    remaining: number;
    reset: number;
}> {
    const result = await limiter.limit(identifier);

    return {
        success: result.success,
        limit: result.limit,
        remaining: result.remaining,
        reset: result.reset,
    };
}

/**
 * Create rate limit error response
 */
export function createDocumentationRateLimitResponse(
    limit: number,
    remaining: number,
    reset: number
): NextResponse {
    return new NextResponse(
        JSON.stringify({
            success: false,
            error: {
                code: "RATE_LIMIT_EXCEEDED",
                message: "Rate limit exceeded. Please try again later.",
                details: {
                    retryAfter: Math.ceil((reset - Date.now()) / 1000),
                },
            },
            meta: {
                requestId: crypto.randomUUID(),
                timestamp: new Date().toISOString(),
            },
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

/**
 * Add rate limit headers to successful response
 */
export function addRateLimitHeaders(
    response: NextResponse,
    limit: number,
    remaining: number,
    reset: number
): NextResponse {
    response.headers.set("X-RateLimit-Limit", limit.toString());
    response.headers.set("X-RateLimit-Remaining", remaining.toString());
    response.headers.set("X-RateLimit-Reset", reset.toString());
    return response;
}

/**
 * Middleware helper for tenant documentation endpoints
 */
export async function rateLimitTenantDocs(request: NextRequest) {
    const identifier = getDocumentationRateLimitIdentifier(request, null, false);
    const result = await checkDocumentationRateLimit(
        documentationRateLimiters.tenantDocs,
        identifier
    );

    if (!result.success) {
        return createDocumentationRateLimitResponse(
            result.limit,
            result.remaining,
            result.reset
        );
    }

    return { result, identifier };
}

/**
 * Middleware helper for admin documentation endpoints
 */
export async function rateLimitAdminDocs(request: NextRequest, userId: string) {
    const identifier = getDocumentationRateLimitIdentifier(request, userId, true);
    const result = await checkDocumentationRateLimit(
        documentationRateLimiters.adminDocs,
        identifier
    );

    if (!result.success) {
        return createDocumentationRateLimitResponse(
            result.limit,
            result.remaining,
            result.reset
        );
    }

    return { result, identifier };
}

/**
 * Middleware helper for search endpoints
 */
export async function rateLimitSearch(request: NextRequest) {
    const identifier = getDocumentationRateLimitIdentifier(request, null, false);
    const result = await checkDocumentationRateLimit(
        documentationRateLimiters.search,
        identifier
    );

    if (!result.success) {
        return createDocumentationRateLimitResponse(
            result.limit,
            result.remaining,
            result.reset
        );
    }

    return { result, identifier };
}

/**
 * Middleware helper for feedback endpoints
 */
export async function rateLimitFeedback(request: NextRequest, userId?: string) {
    const identifier = getDocumentationRateLimitIdentifier(request, userId, true);
    const result = await checkDocumentationRateLimit(
        documentationRateLimiters.feedback,
        identifier
    );

    if (!result.success) {
        return createDocumentationRateLimitResponse(
            result.limit,
            result.remaining,
            result.reset
        );
    }

    return { result, identifier };
}
