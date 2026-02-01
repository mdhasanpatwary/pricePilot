import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { withRateLimit } from "@/lib/middleware/ratelimit";

/**
 * PATCH /api/v1/auto-approval-rules/:id/toggle
 * Toggle enabled status of auto-approval rule
 * 
 * Requirements: 1.4, 1.5
 */
async function handlePATCH(
    _req: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.tenantId) {
            return NextResponse.json(
                {
                    success: false,
                    error: {
                        code: "UNAUTHORIZED",
                        message: "Authentication required",
                    },
                },
                { status: 401 }
            );
        }

        // Verify rule exists and belongs to tenant
        const existingRule = await prisma.autoApprovalRule.findFirst({
            where: {
                id: params.id,
                tenantId: session.user.tenantId,
            },
        });

        if (!existingRule) {
            return NextResponse.json(
                {
                    success: false,
                    error: {
                        code: "NOT_FOUND",
                        message: "Auto-approval rule not found",
                    },
                },
                { status: 404 }
            );
        }

        // Toggle enabled status
        const updatedRule = await prisma.autoApprovalRule.update({
            where: {
                id: params.id,
            },
            data: {
                enabled: !existingRule.enabled,
            },
        });

        return NextResponse.json({
            success: true,
            data: {
                rule: updatedRule,
                message: `Rule ${updatedRule.enabled ? "enabled" : "disabled"} successfully`,
            },
            meta: {
                requestId: crypto.randomUUID(),
                timestamp: new Date().toISOString(),
            },
        });
    } catch (error) {
        console.error("[API] Error toggling auto-approval rule:", error);
        return NextResponse.json(
            {
                success: false,
                error: {
                    code: "INTERNAL_ERROR",
                    message: "Failed to toggle auto-approval rule",
                },
            },
            { status: 500 }
        );
    }
}

export async function PATCH(
    req: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    const params = await context.params;
    return withRateLimit(req, "write", () => handlePATCH(req, { params }));
}
