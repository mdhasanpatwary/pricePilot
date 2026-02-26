/**
 * Rate Limit Cache Metrics API
 *
 * Provides cache performance metrics for monitoring and debugging.
 * Requires super admin authentication.
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getCacheMetrics } from "@/lib/services/rate-limit-admin";
import { logger } from "@/lib/logger";
import { withRequestContextAndRateLimit } from '@/lib/middleware/with-request-context';

/**
 * GET /api/admin/rate-limit/cache-metrics
 *
 * Get Redis cache performance metrics for rate limit configuration
 *
 * @returns Cache hit/miss statistics and hit rates
 */
async function handleGET(_req: NextRequest) {
    try {
                const session = await getServerSession(authOptions);

        // Ensure user is authenticated
        if (!session?.user) {
            return NextResponse.json(
                {
                    success: false,
                    error: { code: "UNAUTHORIZED", message: "Authentication required" },
                },
                { status: 401 }
            );
        }

        // Check if user is super admin
        if (!session.user.isSuperAdmin) {
            return NextResponse.json(
                {
                    success: false,
                    error: {
                        code: "FORBIDDEN",
                        message: "Super admin access required",
                    },
                },
                { status: 403 }
            );
        }

        // Get cache metrics
        const metrics = getCacheMetrics();

        logger.info("[RateLimitCacheMetrics] Cache metrics retrieved", {
            userId: session.user.id,
            metrics,
        });

        return NextResponse.json({
            success: true,
            data: {
                bypass: {
                    hits: metrics.bypassHits,
                    misses: metrics.bypassMisses,
                    total: metrics.bypassHits + metrics.bypassMisses,
                    hitRate: metrics.bypassHitRate,
                },
                multiplier: {
                    hits: metrics.multiplierHits,
                    misses: metrics.multiplierMisses,
                    total: metrics.multiplierHits + metrics.multiplierMisses,
                    hitRate: metrics.multiplierHitRate,
                },
                overall: {
                    totalHits: metrics.bypassHits + metrics.multiplierHits,
                    totalMisses: metrics.bypassMisses + metrics.multiplierMisses,
                    totalRequests:
                        metrics.bypassHits +
                        metrics.bypassMisses +
                        metrics.multiplierHits +
                        metrics.multiplierMisses,
                },
            },
        });
    } catch (error) {
        logger.error("[RateLimitCacheMetrics] Failed to get cache metrics", {
            error,
        });

        return NextResponse.json(
            {
                success: false,
                error: {
                    code: "INTERNAL_ERROR",
                    message: "Failed to retrieve cache metrics",
                },
            },
            { status: 500 }
        );
    }
}

export async function GET(req: NextRequest) {
    return withRequestContextAndRateLimit(req, "read", handleGET);
}
