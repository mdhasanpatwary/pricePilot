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
export async function withRequestContextAndRateLimit(
    req: NextRequest,
    limiterType: keyof typeof rateLimiters,
    handler: (req: NextRequest) => Promise<NextResponse>
): Promise<NextResponse> {
    return withRequestContext(() => {
        return withRateLimit(req, limiterType, handler);
    });
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
