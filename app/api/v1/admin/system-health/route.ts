import { NextRequest, NextResponse } from "next/server";
import { SystemHealthService } from "@/lib/services/system-health";
import { verifyAdminAuth } from "@/lib/auth/admin";

/**
 * GET /api/v1/admin/system-health
 * Get comprehensive system health status
 */
export async function GET(request: NextRequest) {
    try {
        const adminUser = await verifyAdminAuth(request);
        if (!adminUser) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const health = await SystemHealthService.checkSystemHealth();

        return NextResponse.json({
            success: true,
            data: health,
        });
    } catch (error) {
        console.error("[SystemHealth API] Error:", error);
        return NextResponse.json(
            {
                success: false,
                error: "Failed to check system health",
                details: error instanceof Error ? error.message : "Unknown error"
            },
            { status: 500 }
        );
    }
}