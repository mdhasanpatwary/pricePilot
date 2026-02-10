/**
 * Rollback History API Endpoint
 * 
 * GET /api/v1/price-update/rollback/history
 * 
 * Retrieves rollback history for the authenticated tenant
 */

import { NextRequest, NextResponse } from "next/server";
import { RollbackService } from "@/lib/services/rollback";
import { logger } from "@/lib/logger";
import { getCachedSession } from "@/lib/auth/cached-session";
import { withRequestContextAndRateLimit } from "@/lib/middleware/with-request-context";

/**
 * GET /api/v1/price-update/rollback/history
 * 
 * Retrieves rollback history for the authenticated tenant
 */
async function handleGET(req: NextRequest) {
    const session = await getCachedSession();

    if (!session) {
        return NextResponse.json(
            {
                success: false,
                error: {
                    code: "UNAUTHORIZED",
                    message: "Authentication required",
                },
                meta: {
                    timestamp: new Date().toISOString(),
                },
            },
            { status: 401 }
        );
    }

    try {
        const { searchParams } = new URL(req.url);
        const limit = parseInt(searchParams.get("limit") || "50");

        const history = await RollbackService.getRollbackHistory(
            session.user.tenantId,
            limit
        );

        return NextResponse.json({
            success: true,
            data: {
                history,
                count: history.length,
            },
            meta: {
                timestamp: new Date().toISOString(),
            },
        });
    } catch (error) {
        logger.error("[RollbackAPI] Failed to get rollback history", {
            error,
            tenantId: session.user.tenantId,
        });

        return NextResponse.json(
            {
                success: false,
                error: {
                    code: "ROLLBACK_HISTORY_ERROR",
                    message: "Failed to retrieve rollback history",
                },
                meta: {
                    timestamp: new Date().toISOString(),
                },
            },
            { status: 500 }
        );
    }
}

/**
 * Export rate-limited handler
 */
export async function GET(req: NextRequest) {
    return withRequestContextAndRateLimit(req, "read", handleGET);
}
