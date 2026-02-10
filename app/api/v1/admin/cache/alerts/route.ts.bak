import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { cacheAlertingService } from "@/lib/services/cache-alerting";
import { logger } from "@/lib/logger";

/**
 * GET /api/v1/admin/cache/alerts
 * Get cache alert history
 * 
 * Query Parameters:
 * - limit: Number of alerts to return (default: 100)
 * - active: Filter for active alerts only (default: false)
 */
export async function GET(request: NextRequest) {
    try {
        // Check authentication
        const session = await getServerSession(authOptions);
        if (!session?.user) {
            return NextResponse.json(
                { success: false, error: "Unauthorized" },
                { status: 401 }
            );
        }

        // Check admin role
        if (session.user.role !== "ADMIN" && session.user.role !== "SUPER_ADMIN") {
            return NextResponse.json(
                { success: false, error: "Forbidden - Admin access required" },
                { status: 403 }
            );
        }

        // Get query parameters
        const searchParams = request.nextUrl.searchParams;
        const limit = parseInt(searchParams.get("limit") || "100");
        const activeOnly = searchParams.get("active") === "true";

        // Get alerts
        const alerts = activeOnly
            ? cacheAlertingService.getActiveAlerts()
            : cacheAlertingService.getAlertHistory(limit);

        return NextResponse.json({
            success: true,
            data: {
                alerts,
                total: alerts.length,
                activeOnly,
            },
        });
    } catch (error) {
        logger.error("[API] Error getting cache alerts", { error });
        return NextResponse.json(
            {
                success: false,
                error: "Failed to get cache alerts",
                details: error instanceof Error ? error.message : "Unknown error",
            },
            { status: 500 }
        );
    }
}

/**
 * DELETE /api/v1/admin/cache/alerts
 * Clear cache alert history
 */
export async function DELETE(_request: NextRequest) {
    try {
        // Check authentication
        const session = await getServerSession(authOptions);
        if (!session?.user) {
            return NextResponse.json(
                { success: false, error: "Unauthorized" },
                { status: 401 }
            );
        }

        // Check admin role
        if (session.user.role !== "ADMIN" && session.user.role !== "SUPER_ADMIN") {
            return NextResponse.json(
                { success: false, error: "Forbidden - Admin access required" },
                { status: 403 }
            );
        }

        // Clear alert history
        cacheAlertingService.clearHistory();

        logger.info("[API] Cache alert history cleared", {
            userId: session.user.id,
            userEmail: session.user.email,
        });

        return NextResponse.json({
            success: true,
            message: "Alert history cleared",
        });
    } catch (error) {
        logger.error("[API] Error clearing cache alerts", { error });
        return NextResponse.json(
            {
                success: false,
                error: "Failed to clear cache alerts",
                details: error instanceof Error ? error.message : "Unknown error",
            },
            { status: 500 }
        );
    }
}
