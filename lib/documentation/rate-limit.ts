import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { NextRequest, NextResponse } from "next/server";

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

const redis =
    process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
        ? new Redis({
            url: process.env.UPSTASH_REDIS_REST_URL,
            token: process.env.UPSTASH_REDIS_REST_TOKEN,
        })
        : undefined;

/**
 * Rate limiters for documentation endpoints
 */
export const documentationRateLimiters = {
    // Tenant documentation: 100 requests/minute per IP
    tenantDocs: new Ratelimit({
        redis: redis as any,
        limiter: Ratelimit.slidingWindow(100, "1 m"),
        analytics: true,
        prefix: "@upstash/ratelimit/docs/tenant",
    }),

    // Admin documentation: 1000 requests/hour per token (authenticated users)
    adminDocs: new Ratelimit({
        redis: redis as any,
        limiter: Ratelimit.slidingWindow(1000, "1 h"),
        analytics: true,
        prefix: "@upstash/ratelimit/docs/admin",
    }),

    // Search: 100 requests/minute per IP
    search: new Ratelimit({
        redis: redis as any,
        limiter: Ratelimit.slidingWindow(100, "1 m"),
        analytics: true,
        prefix: "@upstash/ratelimit/docs/search",
    }),

    // Feedback: 10 submissions/hour per user
    feedback: new Ratelimit({
        redis: redis as any,
        limiter: Ratelimit.slidingWindow(10, "1 h"),
        analytics: true,
        prefix: "@upstash/ratelimit/docs/feedback",
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
    limiter: Ratelimit,
    identifier: string
): Promise<{
    success: boolean;
    limit: number;
    remaining: number;
    reset: number;
}> {
    // If Redis is not configured, skip rate limiting (development mode)
    if (!redis) {
        return {
            success: true,
            limit: 1000,
            remaining: 999,
            reset: Date.now(),
        };
    }

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
