import { NextResponse } from "next/server";
import { SystemHealthService } from "@/lib/services/system-health";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

/**
 * GET /api/v1/admin/system-health
 * Get comprehensive system health status
 */
export async function GET() {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user || (session.user as any).role !== "SUPER_ADMIN") {
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