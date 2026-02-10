import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
    UpdateAutoApprovalRuleSchema,
    type UpdateAutoApprovalRuleInput,
} from "@/lib/validation/auto-approval-rules";
import { AutoApprovalService } from "@/lib/services/auto-approval";
import { ValidationError } from "@/lib/utils/error-handler";
import { getCachedSession } from "@/lib/auth/cached-session";
import { withRequestContextAndRateLimit } from "@/lib/middleware/with-request-context";

/**
 * GET /api/v1/auto-approval-rules/:id
 * Get single auto-approval rule by ID
 * 
 * Requirements: 1.2, 1.6
 */
async function handleGET(
    _req: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const session = await getCachedSession();
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

        // Fetch rule with tenant isolation
        const rule = await prisma.autoApprovalRule.findFirst({
            where: {
                id: params.id,
                tenantId: session.user.tenantId,
            },
        });

        // Return 404 if rule not found or belongs to different tenant
        if (!rule) {
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

        return NextResponse.json({
            success: true,
            data: {
                rule,
            },
            meta: {
                requestId: crypto.randomUUID(),
                timestamp: new Date().toISOString(),
            },
        });
    } catch (error) {
        console.error("[API] Error fetching auto-approval rule:", error);
        return NextResponse.json(
            {
                success: false,
                error: {
                    code: "INTERNAL_ERROR",
                    message: "Failed to fetch auto-approval rule",
                },
            },
            { status: 500 }
        );
    }
}

export async function GET(
    req: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    const params = await context.params;
    return withRequestContextAndRateLimit(req, "read", () => handleGET(req, { params }));
}

/**
 * PUT /api/v1/auto-approval-rules/:id
 * Update auto-approval rule with validation
 * 
 * Requirements: 1.2, 1.6
 */
async function handlePUT(
    req: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const session = await getCachedSession();
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

        const body = await req.json();

        // Validate request body using Zod schema
        let validatedData: UpdateAutoApprovalRuleInput;
        try {
            validatedData = UpdateAutoApprovalRuleSchema.parse(body);
        } catch (error: any) {
            // Format Zod validation errors
            const fieldErrors: Record<string, string[]> = {};
            if (error.errors) {
                error.errors.forEach((err: any) => {
                    const path = err.path.join(".");
                    if (!fieldErrors[path]) {
                        fieldErrors[path] = [];
                    }
                    fieldErrors[path].push(err.message);
                });
            }

            return NextResponse.json(
                {
                    success: false,
                    error: {
                        code: "VALIDATION_ERROR",
                        message: "Validation failed",
                        details: {
                            fields: fieldErrors,
                        },
                    },
                },
                { status: 422 }
            );
        }

        // Validate rule conditions if provided
        if (validatedData.conditions) {
            try {
                AutoApprovalService.validateRuleConditions(
                    validatedData.conditions
                );
            } catch (error) {
                if (error instanceof ValidationError) {
                    return NextResponse.json(
                        {
                            success: false,
                            error: {
                                code: "VALIDATION_ERROR",
                                message: error.message,
                                details: {
                                    fields: error.fields,
                                },
                            },
                        },
                        { status: 422 }
                    );
                }
                throw error;
            }
        }

        // Update rule
        const updatedRule = await prisma.autoApprovalRule.update({
            where: {
                id: params.id,
            },
            data: {
                ...(validatedData.name && { name: validatedData.name }),
                ...(validatedData.description !== undefined && {
                    description: validatedData.description,
                }),
                ...(validatedData.enabled !== undefined && {
                    enabled: validatedData.enabled,
                }),
                ...(validatedData.priority && { priority: validatedData.priority }),
                ...(validatedData.conditions && {
                    conditions: validatedData.conditions as any,
                }),
            },
        });

        return NextResponse.json({
            success: true,
            data: {
                rule: updatedRule,
            },
            meta: {
                requestId: crypto.randomUUID(),
                timestamp: new Date().toISOString(),
            },
        });
    } catch (error) {
        console.error("[API] Error updating auto-approval rule:", error);
        return NextResponse.json(
            {
                success: false,
                error: {
                    code: "INTERNAL_ERROR",
                    message: "Failed to update auto-approval rule",
                },
            },
            { status: 500 }
        );
    }
}

export async function PUT(
    req: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    const params = await context.params;
    return withRequestContextAndRateLimit(req, "write", () => handlePUT(req, { params }));
}

/**
 * DELETE /api/v1/auto-approval-rules/:id
 * Delete auto-approval rule
 * 
 * Requirements: 1.3, 1.6
 */
async function handleDELETE(
    _req: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const session = await getCachedSession();
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

        // Delete rule
        await prisma.autoApprovalRule.delete({
            where: {
                id: params.id,
            },
        });

        return NextResponse.json({
            success: true,
            data: {
                message: "Auto-approval rule deleted successfully",
            },
            meta: {
                requestId: crypto.randomUUID(),
                timestamp: new Date().toISOString(),
            },
        });
    } catch (error) {
        console.error("[API] Error deleting auto-approval rule:", error);
        return NextResponse.json(
            {
                success: false,
                error: {
                    code: "INTERNAL_ERROR",
                    message: "Failed to delete auto-approval rule",
                },
            },
            { status: 500 }
        );
    }
}

export async function DELETE(
    req: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    const params = await context.params;
    return withRequestContextAndRateLimit(req, "write", () => handleDELETE(req, { params }));
}
