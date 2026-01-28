import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { withRateLimit } from "@/lib/middleware/ratelimit";

/**
 * GET /api/v1/price-approvals/count
 * Get count of pending price changes for the tenant
 */
async function handleGET() {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.tenantId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const count = await prisma.pendingPriceChange.count({
            where: {
                tenantId: session.user.tenantId,
                status: "PENDING",
            },
        });

        return NextResponse.json({ count });
    } catch (error) {
        console.error("[API] Error fetching pending count:", error);
        return NextResponse.json(
            { error: "Failed to fetch pending count" },
            { status: 500 }
        );
    }
}

export async function GET(req: NextRequest) {
    return withRateLimit(req, 'read', handleGET);
}
