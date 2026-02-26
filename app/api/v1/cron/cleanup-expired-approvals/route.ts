import { withRequestContextOnly } from '@/lib/middleware/with-request-context';
import { NextRequest, NextResponse } from "next/server";
import { RulesEngine } from "@/lib/services/rules-engine";

/**
 * GET /api/v1/cron/cleanup-expired-approvals
 * Clean up expired pending price changes
 * This should be called by a cron job (e.g., daily)
 */
async function handleGET(req: NextRequest) {
    try {
        // Verify cron secret for security
        const authHeader = req.headers.get("authorization");
        if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const count = await RulesEngine.cleanupExpiredChanges();

        return NextResponse.json({
            success: true,
            message: `Cleaned up ${count} expired price changes`,
            count,
        });
    } catch (error) {
        console.error("[CRON] Error cleaning up expired approvals:", error);
        return NextResponse.json(
            { error: "Failed to cleanup expired approvals" },
            { status: 500 }
        );
    }
}

export async function GET(req: NextRequest) {
    return withRequestContextOnly(req, handleGET);
}
