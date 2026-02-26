import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ApprovalStatus } from "@prisma/client";
import { z } from "zod";
import { paginateCursor, getCursorPaginationParams } from "@/lib/utils/pagination";
import { getCachedSession } from "@/lib/auth/cached-session";
import { withRequestContextAndRateLimit } from "@/lib/middleware/with-request-context";
import { enqueueWithBackpressure } from "@/lib/queue/backpressure";
import { QUEUE_NAMES } from "@/lib/queue/types";
import { getSyncDeltaQueue } from "@/lib/queue/client";

/**
 * GET /api/v1/price-approvals
 * Get all pending price changes for the tenant
 */
async function handleGET(req: NextRequest) {
    try {
        const session = await getCachedSession();
        if (!session?.user?.tenantId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { searchParams } = new URL(req.url);
        const rawStatus = (searchParams.get("status") || "PENDING").toUpperCase();
        const allowedStatuses: ApprovalStatus[] = ["PENDING", "APPROVED", "REJECTED"];

        if (!allowedStatuses.includes(rawStatus as ApprovalStatus)) {
            return NextResponse.json(
                {
                    error: "Invalid status value",
                    details: `Allowed values: ${allowedStatuses.join(", ")}`,
                },
                { status: 400 }
            );
        }

        const status = rawStatus as ApprovalStatus;

        // Get cursor pagination parameters
        const paginationParams = getCursorPaginationParams(searchParams);

        // Use cursor pagination helper (constant-time, no OFFSET scan)
        const paginatedResult = await paginateCursor(
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
                Product: {
                    select: {
                        id: true,
                        title: true,
                        sku: true,
                        imageUrl: true,
                        Site: {
                            select: {
                                baseUrl: true,
                                type: true,
                            },
                        },
                    },
                },
            }
        );

        const serializedChanges = paginatedResult.data.map((change: any) => {
            const product = change.Product
                ? {
                    id: change.Product.id,
                    title: change.Product.title,
                    sku: change.Product.sku,
                    imageUrl: change.Product.imageUrl,
                    site: change.Product.Site
                        ? {
                            baseUrl: change.Product.Site.baseUrl,
                            type: change.Product.Site.type,
                        }
                        : null,
                }
                : null;

            return {
                id: change.id,
                currentPrice: change.currentPrice,
                recommendedPrice: change.recommendedPrice,
                reason: change.reason,
                appliedRule: change.appliedRule,
                status: change.status,
                createdAt: change.createdAt,
                reviewedAt: change.reviewedAt,
                reviewedBy: change.reviewedBy,
                expiresAt: change.expiresAt,
                autoApprovedAt: change.autoApprovedAt,
                autoApprovedBy: change.autoApprovedBy,
                product,
            };
        });

        return NextResponse.json({
            changes: serializedChanges,
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
    return withRequestContextAndRateLimit(req, 'read', () => handleGET(req));
}

/**
 * POST /api/v1/price-approvals
 * Approve or reject pending price changes
 */
const actionSchema = z.object({
    action: z.enum(["approve", "reject"]),
    changeIds: z.array(z.string()).min(1).max(1000, "Maximum of 1000 changes per request"),
});

async function handlePOST(req: NextRequest) {
    try {
        const session = await getCachedSession();
        if (!session?.user?.tenantId || !session?.user?.email) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await req.json();
        const { action, changeIds } = actionSchema.parse(body);

        // Check if user has permission to approve (either directly or via delegation)
        const { ApprovalDelegationService } = await import("@/lib/services/approval-delegation");
        const canApprove = await ApprovalDelegationService.canApprove(
            session.user.id,
            session.user.tenantId
        );

        if (!canApprove) {
            return NextResponse.json(
                { error: "You do not have permission to approve price changes" },
                { status: 403 }
            );
        }

        // Check if user is acting via delegation
        const activeDelegations = await ApprovalDelegationService.getActiveDelegationsForUser(
            session.user.id,
            session.user.tenantId
        );
        const isDelegated = activeDelegations.length > 0;
        const delegationInfo = isDelegated ? activeDelegations[0] : null;

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

        let result;
        if (action === "approve") {
            result = await RulesEngine.applyApprovedChanges(
                changeIds,
                session.user.email
            );

            // Log delegation usage in audit logs
            if (isDelegated && delegationInfo) {
                await prisma.tenantAuditLog.create({
                    data: {
                        tenantId: session.user.tenantId,
                        userId: session.user.id,
                        userEmail: session.user.email,
                        action: "APPROVE_PRICE_VIA_DELEGATION",
                        entityId: changeIds.join(","),
                        details: JSON.stringify({
                            changeCount: changeIds.length,
                            delegatedFrom: delegationInfo.fromUser.email,
                            delegatedFromName: delegationInfo.fromUser.name,
                            delegationId: delegationInfo.id,
                            delegationStartDate: delegationInfo.startDate,
                            delegationEndDate: delegationInfo.endDate,
                        }),
                    },
                });
            }

            // Push approved changes to stores in parallel (was sequential - O(n*syncTime) → O(syncTime))
            const userSites = await prisma.site.findMany({
                where: { tenantId: session.user.tenantId, type: "USER" },
                select: { id: true, platform: true },
            });

            // Trigger store sync in background for each site
            // Requirement 2.10.4: Offload to background queue to avoid timeouts
            for (const site of userSites) {
                if (site.platform === "OPENCART" || site.platform === "LARAVEL") {
                    await enqueueWithBackpressure(
                        getSyncDeltaQueue(),
                        QUEUE_NAMES.SYNC_DELTA,
                        {
                            type: "STORE_SYNC",
                            siteId: site.id,
                            tenantId: session.user.tenantId,
                        },
                        {
                            jobId: `store-sync-${site.id}-${Date.now()}`,
                            priority: 5, // Higher priority for user-initiated approvals
                        },
                        { producer: "api.price-approvals.post", strategy: "delay" }
                    ).catch(err =>
                        console.error(`[API] Failed to enqueue store sync for site ${site.id}:`, err)
                    );
                }
            }

            return NextResponse.json({
                success: true,
                message: `${result.updated} price changes approved and applied${isDelegated ? " (via delegation)" : ""}`,
                updated: result.updated,
                failed: result.failed,
                delegated: isDelegated,
            });
        } else {
            result = await RulesEngine.rejectPendingChanges(
                changeIds,
                session.user.email
            );

            // Log delegation usage in audit logs
            if (isDelegated && delegationInfo) {
                await prisma.tenantAuditLog.create({
                    data: {
                        tenantId: session.user.tenantId,
                        userId: session.user.id,
                        userEmail: session.user.email,
                        action: "REJECT_PRICE_VIA_DELEGATION",
                        entityId: changeIds.join(","),
                        details: JSON.stringify({
                            changeCount: changeIds.length,
                            delegatedFrom: delegationInfo.fromUser.email,
                            delegatedFromName: delegationInfo.fromUser.name,
                            delegationId: delegationInfo.id,
                            delegationStartDate: delegationInfo.startDate,
                            delegationEndDate: delegationInfo.endDate,
                        }),
                    },
                });
            }

            return NextResponse.json({
                success: true,
                message: `${result.rejected} price changes rejected${isDelegated ? " (via delegation)" : ""}`,
                rejected: result.rejected,
                failed: result.failed,
                delegated: isDelegated,
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
    return withRequestContextAndRateLimit(req, 'write', () => handlePOST(req));
}
