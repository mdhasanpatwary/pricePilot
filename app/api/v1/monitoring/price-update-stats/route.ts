import { NextRequest, NextResponse } from "next/server";
import { priceUpdateMonitor } from "@/lib/services/price-update-monitor";
import { logger } from "@/lib/logger";
import { getCachedSession } from "@/lib/auth/cached-session";
import { withRequestContextAndRateLimit } from "@/lib/middleware/with-request-context";

async function handleGET(req: NextRequest) {

/**
 * Get Price Update Statistics
 *
 * Returns detailed statistics about price update success rates,
 * failure patterns, and performance metrics.
 *
 * **Query Parameters:**
 * - timeWindow: Time window in seconds (default: 86400 = 24 hours)
 *
 * **Response:**
 * ```json
 * {
 *   "success": true,
 *   "data": {
 *     "totalAttempts": 1000,
 *     "successfulUpdates": 995,
 *     "failedUpdates": 5,
 *     "successRate": 99.5,
 *     "averageDuration": 250,
 *     "failuresByReason": {
 *       "Network timeout": 3,
 *       "Invalid token": 2
 *     },
 *     "failuresBySite": {
 *       "https://store1.com": 3,
 *       "https://store2.com": 2
 *     }
 *   }
 * }
 * ```
 *
 * @route GET /api/v1/monitoring/price-update-stats
 */
    try {
        const session = await getCachedSession();

        if (!session?.user) {
            return NextResponse.json(
                { success: false, error: "Unauthorized" },
                { status: 401 }
            );
        }

        const { searchParams } = new URL(req.url);
        const timeWindow = parseInt(searchParams.get("timeWindow") || "86400", 10);

        // Get tenant ID from session
        const tenantId = session.user.tenantId;

        if (!tenantId) {
            return NextResponse.json(
                { success: false, error: "Tenant ID not found" },
                { status: 400 }
            );
        }

        // Get statistics
        const stats = await priceUpdateMonitor.getStats(tenantId, timeWindow);

        logger.info("Price update stats retrieved", {
            tenantId,
            timeWindow,
            successRate: stats.successRate,
        });

        return NextResponse.json({
            success: true,
            data: stats,
        });
    } catch (error) {
        logger.error("Failed to get price update stats", {
            error: error instanceof Error ? error.message : String(error),
        });

        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : "Unknown error",
            },
            { status: 500 }
        );
    }
}

export async function GET(req: NextRequest) {
    return withRequestContextAndRateLimit(req, "read", handleGET);
}
