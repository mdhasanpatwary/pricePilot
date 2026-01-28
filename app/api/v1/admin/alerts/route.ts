import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { alertRepository } from "@/lib/services/alert-repository";
import { withRateLimit } from "@/lib/middleware/ratelimit";

/**
 * GET /api/v1/admin/alerts
 * Get system alerts with optional filtering
 * 
 * Query params:
 * - acknowledged: boolean (optional) - filter by acknowledgment status
 * - severity: string (optional) - filter by severity (critical, warning, info)
 * - limit: number (optional) - limit number of results (default: 50)
 * 
 * Requirements: 11.2
 */
async function handleGET(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const user = session.user as any;
        const isAdmin = user.role === "ADMIN" || user.isSuperAdmin === true;

        if (!isAdmin) {
            return NextResponse.json(
                { error: "Unauthorized - Admin access required" },
                { status: 401 }
            );
        }

        const searchParams = request.nextUrl.searchParams;
        const acknowledgedParam = searchParams.get("acknowledged");
        const severity = searchParams.get("severity") as any;
        const limit = parseInt(searchParams.get("limit") || "50");

        let alerts;

        if (acknowledgedParam === "false") {
            // Get unacknowledged alerts
            alerts = await alertRepository.getUnacknowledgedAlerts(severity);
        } else {
            // Get recent alerts
            const acknowledged = acknowledgedParam === "true" ? true : undefined;
            alerts = await alertRepository.getRecentAlerts(limit, acknowledged);
        }

        return NextResponse.json({
            success: true,
            data: alerts,
        });
    } catch (error) {
        console.error("[Alerts API] Error:", error);
        return NextResponse.json(
            {
                success: false,
                error: "Failed to fetch alerts",
                details: error instanceof Error ? error.message : "Unknown error",
            },
            { status: 500 }
        );
    }
}

export async function GET(req: NextRequest) {
    return withRateLimit(req, 'read', handleGET);
}
