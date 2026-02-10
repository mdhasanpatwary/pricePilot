import { NextRequest, NextResponse } from "next/server";
import { cacheAlertingService } from "@/lib/services/cache-alerting";
import { logger } from "@/lib/logger";
import { getCachedSession } from "@/lib/auth/cached-session";

/**
 * GET /api/v1/admin/cache/alerts/active
 * Get active (unresolved) cache alerts
 */
export async function GET(_request: NextRequest) {
    try {
        // Check authentication
        const session = await getCachedSession();
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

        // Get active alerts
        const alerts = cacheAlertingService.getActiveAlerts();

        return NextResponse.json({
            success: true,
            data: {
                alerts,
                count: alerts.length,
            },
        });
    } catch (error) {
        logger.error("[API] Error getting active cache alerts", { error });
        return NextResponse.json(
            {
                success: false,
                error: "Failed to get active cache alerts",
                details: error instanceof Error ? error.message : "Unknown error",
            },
            { status: 500 }
        );
    }
}
