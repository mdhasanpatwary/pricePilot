import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { withRateLimit } from "@/lib/middleware/ratelimit";
import { paginate, getPaginationParams } from "@/lib/utils/pagination";

/**
 * GET /api/v1/price-approvals
 * Get all pending price changes for the tenant
 */
async function handleGET(req: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.tenantId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { searchParams } = new URL(req.url);
        const status = searchParams.get("status") || "PENDING";

        // Get pagination parameters
        const paginationParams = getPaginationParams(searchParams);

        // Use pagination helper
        const paginatedResult = await paginate(
            prisma.pendingPriceChange,
            {
                tenantId: session.user.tenantId,
                status: status as any,
            },
            {
                ...paginationParams,
                sortBy: paginationParams.sortBy || 'createdAt',
                sortOrder: paginationParams.sortOrder || 'desc'
            },
            {
                product: {
                    select: {
                        id: true,
                        title: true,
                        sku: true,
                        imageUrl: true,
                        site: {
                            select: {
                                baseUrl: true,
                                type: true,
                            },
                        },
                    },
                },
            }
        );

        return NextResponse.json({
            changes: paginatedResult.data,
            pagination: paginatedResult.pagination,
        });
    } catch (error) {
        console.error("[API] Error fetching pending price changes:", error);
        return NextResponse.json(
            { error: "Failed to fetch pending price changes" },
            { status: 500 }
        );
    }
}

export async function GET(req: NextRequest) {
    return withRateLimit(req, 'read', () => handleGET(req));
}

/**
 * POST /api/v1/price-approvals
 * Approve or reject pending price changes
 */
const actionSchema = z.object({
    action: z.enum(["approve", "reject"]),
    changeIds: z.array(z.string()).min(1),
});

async function handlePOST(req: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.tenantId || !session?.user?.email) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await req.json();
        const { action, changeIds } = actionSchema.parse(body);

        // Verify all changes belong to this tenant
        const changes = await prisma.pendingPriceChange.findMany({
            where: {
                id: { in: changeIds },
                tenantId: session.user.tenantId,
                status: "PENDING",
            },
        });

        if (changes.length !== changeIds.length) {
            return NextResponse.json(
                { error: "Some changes not found or already processed" },
                { status: 400 }
            );
        }

        const { RulesEngine } = await import("@/lib/services/rules-engine");
        const { SyncService } = await import("@/lib/services/sync");

        let result;
        if (action === "approve") {
            result = await RulesEngine.applyApprovedChanges(
                changeIds,
                session.user.email
            );

            // Push approved changes to stores
            const userSites = await prisma.site.findMany({
                where: { tenantId: session.user.tenantId, type: "USER" },
            });

            for (const site of userSites) {
                if (site.platform === "OPENCART" || site.platform === "LARAVEL") {
                    await SyncService.syncProductsToStore(site.id);
                }
            }

            return NextResponse.json({
                success: true,
                message: `${result.updated} price changes approved and applied`,
                updated: result.updated,
                failed: result.failed,
            });
        } else {
            result = await RulesEngine.rejectPendingChanges(
                changeIds,
                session.user.email
            );

            return NextResponse.json({
                success: true,
                message: `${result.rejected} price changes rejected`,
                rejected: result.rejected,
                failed: result.failed,
            });
        }
    } catch (error) {
        console.error("[API] Error processing price approvals:", error);
        return NextResponse.json(
            { error: "Failed to process price approvals" },
            { status: 500 }
        );
    }
}

export async function POST(req: NextRequest) {
    return withRateLimit(req, 'write', () => handlePOST(req));
}
