import { NextRequest, NextResponse } from "next/server";
import { getTenantStatus } from "@/lib/services/rate-limit-admin";
import { logger } from "@/lib/logger";
import { getCachedSession } from "@/lib/auth/cached-session";
import { withRequestContextAndRateLimit } from "@/lib/middleware/with-request-context";

/**
 * GET /api/v1/admin/rate-limits/[tenantId]
 * 
 * Returns detailed rate limit status for a specific tenant.
 * This endpoint provides comprehensive information including:
 * - Current rate limit configuration
 * - Metrics for last 24 hours and 7 days
 * - Recent violation details
 * - Bypass and custom multiplier status
 * 
 * Requirements: 4.2
 * 
 * Authentication: Super admin only
 * Rate Limiting: Read limiter
 * 
 * Response:
 * {
 *   "success": true,
 *   "data": {
 *     "tenantId": "string",
 *     "companyName": "string",
 *     "planType": "BASIC" | "PREMIUM" | "PRO",
 *     "effectiveMultiplier": number,
 *     "bypassActive": boolean,
 *     "bypassExpiresAt": "ISO8601" (optional),
 *     "bypassReason": "string" (optional),
 *     "customMultiplier": number (optional),
 *     "customMultiplierReason": "string" (optional),
 *     "recentViolations": number,
 *     "currentUsage": {
 *       "auth": { "limit": number, "window": "string" },
 *       ...
 *     },
 *     "metrics": {
 *       "last24Hours": {
 *         "totalHits": number,
 *         "totalViolations": number,
 *         "violationRate": number
 *       },
 *       "last7Days": {
 *         "totalHits": number,
 *         "totalViolations": number,
 *         "violationRate": number
 *       }
 *     },
 *     "recentViolationDetails": [
 *       {
 *         "timestamp": "ISO8601",
 *         "limiterType": "string",
 *         "endpoint": "string",
 *         "identifier": "string",
 *         "violationCount": number
 *       }
 *     ]
 *   },
 *   "meta": {
 *     "requestId": "string",
 *     "timestamp": "ISO8601"
 *   }
 * }
 */
async function handleGET(
    _req: NextRequest,
    { params }: { params: { tenantId: string } }
) {
    try {
        // Check authentication and authorization
        const session = await getCachedSession();

        if (!session || !session.user) {
            return NextResponse.json(
                {
                    success: false,
                    error: {
                        code: "UNAUTHORIZED",
                        message: "Authentication required",
                    },
                    meta: {
                        requestId: crypto.randomUUID(),
                        timestamp: new Date().toISOString(),
                    },
                },
                { status: 401 }
            );
        }

        if (!session.user.isSuperAdmin) {
            return NextResponse.json(
                {
                    success: false,
                    error: {
                        code: "FORBIDDEN",
                        message: "Super admin access required",
                    },
                    meta: {
                        requestId: crypto.randomUUID(),
                        timestamp: new Date().toISOString(),
                    },
                },
                { status: 403 }
            );
        }

        const { tenantId } = params;

        // Validate tenantId
        if (!tenantId || typeof tenantId !== "string") {
            return NextResponse.json(
                {
                    success: false,
                    error: {
                        code: "INVALID_TENANT_ID",
                        message: "Valid tenant ID is required",
                    },
                    meta: {
                        requestId: crypto.randomUUID(),
                        timestamp: new Date().toISOString(),
                    },
                },
                { status: 400 }
            );
        }

        // Get detailed tenant status
        const status = await getTenantStatus(tenantId);

        logger.info("[RateLimitAPI] Retrieved tenant status", {
            adminUserId: session.user.id,
            tenantId,
        });

        return NextResponse.json({
            success: true,
            data: status,
            meta: {
                requestId: crypto.randomUUID(),
                timestamp: new Date().toISOString(),
            },
        });
    } catch (error) {
        logger.error("[RateLimitAPI] Failed to get tenant status:", { error });

        // Check if it's a "not found" error
        if (error instanceof Error && error.message.includes("not found")) {
            return NextResponse.json(
                {
                    success: false,
                    error: {
                        code: "TENANT_NOT_FOUND",
                        message: error.message,
                    },
                    meta: {
                        requestId: crypto.randomUUID(),
                        timestamp: new Date().toISOString(),
                    },
                },
                { status: 404 }
            );
        }

        return NextResponse.json(
            {
                success: false,
                error: {
                    code: "INTERNAL_ERROR",
                    message: "Failed to retrieve tenant status",
                    details: error instanceof Error ? error.message : "Unknown error",
                },
                meta: {
                    requestId: crypto.randomUUID(),
                    timestamp: new Date().toISOString(),
                },
            },
            { status: 500 }
        );
    }
}

export async function GET(req: NextRequest, context: { params: Promise<{ tenantId: string }> }) {
    const params = await context.params;
    return withRequestContextAndRateLimit(req, "read", (r) => handleGET(r, { params }));
}
