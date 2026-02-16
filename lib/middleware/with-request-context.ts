/**
 * Request Context Middleware Wrapper
 *
 * Combines request-scoped caching with rate limiting for API routes.
 * This is the recommended way to wrap API handlers.
 *
 * Usage:
 * ```typescript
 * export async function GET(req: NextRequest) {
 *   return withRequestContextAndRateLimit(req, "read", handleGET);
 * }
 * ```
 */

import { NextRequest, NextResponse } from "next/server";
import { withRequestContext } from "@/lib/cache/request-cache";
import { withRateLimit } from "./ratelimit";
import { rateLimiters } from "@/lib/ratelimit";

/**
 * Wrap handler with request context and rate limiting
 *
 * This function:
 * 1. Creates a request-scoped cache
 * 2. Applies rate limiting (which uses the cache)
 * 3. Executes the handler
 * 4. Automatically cleans up cache after request
 *
 * @param req - Next.js request object
 * @param limiterType - Type of rate limiter to apply
 * @param handler - Handler function to execute
 * @returns Response from handler
 *
 * @example
 * ```typescript
 * async function handleGET(req: NextRequest) {
 *   const session = await getCachedSession(); // Uses cache
 *   // ... handler logic
 * }
 *
 * export async function GET(req: NextRequest) {
 *   return withRequestContextAndRateLimit(req, "read", handleGET);
 * }
 * ```
 */
import { metricsCollector } from "@/lib/services/monitoring/metrics-collector";
import { getCachedSession } from "@/lib/auth/cached-session";

export async function withRequestContextAndRateLimit(
    req: NextRequest,
    limiterType: keyof typeof rateLimiters,
    handler: (req: NextRequest) => Promise<NextResponse>
): Promise<NextResponse> {
    const startTime = Date.now();
    let response: NextResponse | undefined;
    let errorType: string | null = null;

    try {
        response = await withRequestContext(() => {
            return withRateLimit(req, limiterType, async (r) => {
                const res = await handler(r);
                return res;
            });
        });

        if (response && !response.ok) {
            errorType = `HTTP_${response.status}`;
        }

        return response;
    } catch (err) {
        errorType = 'UnhandledException';
        throw err;
    } finally {
        const duration = Date.now() - startTime;
        const url = new URL(req.url); // Use existing URL from request

        // Normalize path: specific heuristic for CUIDs/UUIDs to group endpoints
        // 1. /api/v1/competitors/clt... -> /api/v1/competitors/:id
        // 2. /api/v1/competitors/clt.../products -> /api/v1/competitors/:id/products
        let endpoint = url.pathname;
        endpoint = endpoint.replace(/\/([a-zA-Z0-9_-]{20,})(?=\/|$)/g, '/:id');

        // Use an IIFE for fire-and-forget metric recording
        (async () => {
            try {
                // We need tenantId. Session might be cached.
                // If this is an unauthenticated endpoint or auth failed earlier, it might be null.
                const session = await getCachedSession().catch(() => null);
                const tenantId = session?.user?.tenantId;

                await metricsCollector.recordResponseTime(endpoint, duration, tenantId);

                if (errorType) {
                    await metricsCollector.recordError(endpoint, errorType, tenantId);
                }
            } catch (e) {
                // Silently fail metric collection to not affect request
                console.error('[Metrics] Failed to record metrics', e);
            }
        })();
    }
}

/**
 * Wrap handler with only request context (no rate limiting)
 *
 * Useful for endpoints that don't need rate limiting (e.g., health checks)
 * or have custom rate limiting logic.
 *
 * @param req - Next.js request object
 * @param handler - Handler function to execute
 * @returns Response from handler
 *
 * @example
 * ```typescript
 * export async function GET(req: NextRequest) {
 *   return withRequestContextOnly(req, handleGET);
 * }
 * ```
 */
export async function withRequestContextOnly(
    req: NextRequest,
    handler: (req: NextRequest) => Promise<NextResponse>
): Promise<NextResponse> {
    return withRequestContext(() => handler(req));
}
