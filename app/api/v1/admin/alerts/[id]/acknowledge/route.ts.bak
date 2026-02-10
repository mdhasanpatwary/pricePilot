import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { alertRepository } from "@/lib/services/alert-repository";
import { withRateLimit } from "@/lib/middleware/ratelimit";

/**
 * POST /api/v1/admin/alerts/[id]/acknowledge
 * Acknowledge a system alert
 * 
 * Requirements: 11.2
 */
async function handlePOST(
    _request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
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

        const { id: alertId } = await params;
        const acknowledgedBy = user.email || user.id;

        const alert = await alertRepository.acknowledgeAlert(alertId, acknowledgedBy);

        return NextResponse.json({
            success: true,
            data: alert,
        });
    } catch (error) {
        console.error("[Acknowledge Alert API] Error:", error);
        return NextResponse.json(
            {
                success: false,
                error: "Failed to acknowledge alert",
                details: error instanceof Error ? error.message : "Unknown error",
            },
            { status: 500 }
        );
    }
}

export async function POST(
    req: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    return withRateLimit(req, 'write', (r) => handlePOST(r, context));
}
