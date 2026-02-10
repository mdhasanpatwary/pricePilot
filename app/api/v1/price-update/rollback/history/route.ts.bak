/**
 * Rollback History API Endpoint
 * 
 * GET /api/v1/price-update/rollback/history
 * 
 * Retrieves rollback history for the authenticated tenant
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { withRateLimit } from "@/lib/middleware/ratelimit";
import { RollbackService } from "@/lib/services/rollback";
import { logger } from "@/lib/logger";

/**
 * GET /api/v1/price-update/rollback/history
 * 
 * Retrieves rollback history for the authenticated tenant
 */
async function handleGET(req: NextRequest) {
    const session = await getServerSession(authOptions);

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
    return withRateLimit(req, "read", handleGET);
}
