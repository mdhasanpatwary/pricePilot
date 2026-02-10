import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
    CreateAutoApprovalRuleSchema,
    type CreateAutoApprovalRuleInput,
} from "@/lib/validation/auto-approval-rules";
import { AutoApprovalService } from "@/lib/services/auto-approval";
import { ValidationError } from "@/lib/utils/error-handler";
import { getCachedSession } from "@/lib/auth/cached-session";
import { withRequestContextAndRateLimit } from "@/lib/middleware/with-request-context";

/**
 * GET /api/v1/auto-approval-rules
 * List all auto-approval rules for authenticated tenant
 * 
 * Requirements: 1.1, 1.6
 */
async function handleGET(_req: NextRequest) {
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

        // Fetch all rules for tenant, ordered by priority
        const rules = await prisma.autoApprovalRule.findMany({
            where: {
                tenantId: session.user.tenantId,
            },
            orderBy: {
                priority: "asc",
            },
        });

        return NextResponse.json({
            success: true,
            data: {
                rules,
            },
            meta: {
                requestId: crypto.randomUUID(),
                timestamp: new Date().toISOString(),
                count: rules.length,
            },
        });
    } catch (error) {
        console.error("[API] Error fetching auto-approval rules:", error);
        return NextResponse.json(
            {
                success: false,
                error: {
                    code: "INTERNAL_ERROR",
                    message: "Failed to fetch auto-approval rules",
                },
            },
            { status: 500 }
        );
    }
}

export async function GET(req: NextRequest) {
    return withRequestContextAndRateLimit(req, "read", () => handleGET(req));
}

/**
 * POST /api/v1/auto-approval-rules
 * Create new auto-approval rule with validation
 * 
 * Requirements: 1.1, 1.6
 */
async function handlePOST(req: NextRequest) {
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

        const body = await req.json();

        // Validate request body using Zod schema
        let validatedData: CreateAutoApprovalRuleInput;
        try {
            validatedData = CreateAutoApprovalRuleSchema.parse(body);
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

        // Validate rule conditions using service
        try {
            AutoApprovalService.validateRuleConditions(validatedData.conditions);
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

        // Create rule with tenant isolation
        const rule = await prisma.autoApprovalRule.create({
            data: {
                tenantId: session.user.tenantId,
                name: validatedData.name,
                description: validatedData.description || null,
                enabled: validatedData.enabled,
                priority: validatedData.priority,
                conditions: validatedData.conditions as any,
            },
        });

        return NextResponse.json(
            {
                success: true,
                data: {
                    rule,
                },
                meta: {
                    requestId: crypto.randomUUID(),
                    timestamp: new Date().toISOString(),
                },
            },
            { status: 201 }
        );
    } catch (error) {
        console.error("[API] Error creating auto-approval rule:", error);
        return NextResponse.json(
            {
                success: false,
                error: {
                    code: "INTERNAL_ERROR",
                    message: "Failed to create auto-approval rule",
                },
            },
            { status: 500 }
        );
    }
}

export async function POST(req: NextRequest) {
    return withRequestContextAndRateLimit(req, "write", () => handlePOST(req));
}
