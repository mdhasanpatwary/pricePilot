import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { getCachedSession } from "@/lib/auth/cached-session";
import { withRequestContextAndRateLimit } from "@/lib/middleware/with-request-context";

/**
 * GET /api/v1/admin/rate-limits/violations
 * 
 * Returns recent rate limit violations with detailed information.
 * This endpoint provides violation details for the admin dashboard,
 * allowing filtering by tenant, endpoint, and time range.
 * 
 * Requirements: 6.2, 6.4
 * 
 * Authentication: Super admin only
 * Rate Limiting: Read limiter
 * 
 * Query Parameters:
 * - tenantId (optional): Filter by specific tenant
 * - endpoint (optional): Filter by specific endpoint path
 * - limiterType (optional): Filter by limiter type (auth, api, read, write, sync, importExport)
 * - startDate (optional): Start of time range (ISO8601)
 * - endDate (optional): End of time range (ISO8601)
 * - limit (optional): Maximum number of violations to return (default: 100, max: 500)
 * 
 * Response:
 * {
 *   "success": true,
 *   "data": {
 *     "violations": [
 *       {
 *         "id": "string",
 *         "tenantId": "string",
 *         "tenantName": "string",
 *         "limiterType": "string",
 *         "endpoint": "string",
 *         "identifier": "string",
 *         "violationCount": number,
 *         "timestamp": "ISO8601"
 *       }
 *     ],
 *     "summary": {
 *       "totalViolations": number,
 *       "uniqueTenants": number,
 *       "uniqueEndpoints": number,
 *       "periodStart": "ISO8601",
 *       "periodEnd": "ISO8601"
 *     }
 *   },
 *   "meta": {
 *     "requestId": "string",
 *     "timestamp": "ISO8601"
 *   }
 * }
 */
async function handleGET(req: NextRequest) {
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

        // Parse query parameters
        const { searchParams } = new URL(req.url);
        const tenantId = searchParams.get("tenantId");
        const endpoint = searchParams.get("endpoint");
        const limiterType = searchParams.get("limiterType");
        const startDateParam = searchParams.get("startDate");
        const endDateParam = searchParams.get("endDate");
        const limitParam = searchParams.get("limit");

        // Validate and parse limit
        const limit = limitParam ? parseInt(limitParam, 10) : 100;
        if (isNaN(limit) || limit < 1 || limit > 500) {
            return NextResponse.json(
                {
                    success: false,
                    error: {
                        code: "INVALID_LIMIT",
                        message: "Limit must be between 1 and 500",
                    },
                    meta: {
                        requestId: crypto.randomUUID(),
                        timestamp: new Date().toISOString(),
                    },
                },
                { status: 400 }
            );
        }

        // Validate and parse dates
        const endDate = endDateParam ? new Date(endDateParam) : new Date();
        const startDate = startDateParam
            ? new Date(startDateParam)
            : new Date(endDate.getTime() - 24 * 60 * 60 * 1000); // Default: last 24 hours

        if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
            return NextResponse.json(
                {
                    success: false,
                    error: {
                        code: "INVALID_DATE",
                        message: "Invalid date format. Use ISO8601 format.",
                    },
                    meta: {
                        requestId: crypto.randomUUID(),
                        timestamp: new Date().toISOString(),
                    },
                },
                { status: 400 }
            );
        }

        if (startDate > endDate) {
            return NextResponse.json(
                {
                    success: false,
                    error: {
                        code: "INVALID_DATE_RANGE",
                        message: "Start date must be before end date",
                    },
                    meta: {
                        requestId: crypto.randomUUID(),
                        timestamp: new Date().toISOString(),
                    },
                },
                { status: 400 }
            );
        }

        // Build where clause for filtering
        const where: any = {
            violationCount: {
                gt: 0, // Only return records with violations
            },
            timestamp: {
                gte: startDate,
                lte: endDate,
            },
        };

        if (tenantId) {
            where.tenantId = tenantId;
        }

        if (endpoint) {
            where.endpoint = endpoint;
        }

        if (limiterType) {
            where.limiterType = limiterType;
        }

        // Fetch violations from database
        const rawViolations = await prisma.rateLimitMetric.findMany({
            where,
            include: {
                Tenant: {
                    select: {
                        companyName: true,
                    },
                },
            },
            orderBy: {
                timestamp: "desc",
            },
            take: limit,
        });

        // Format violations
        const violations = rawViolations.map((violation: any) => ({
            id: violation.id,
            tenantId: violation.tenantId,
            tenantName: violation.Tenant.companyName,
            limiterType: violation.limiterType,
            endpoint: violation.endpoint,
            identifier: violation.identifier,
            violationCount: violation.violationCount,
            timestamp: violation.timestamp.toISOString(),
        }));

        // Calculate summary statistics
        const totalViolations = violations.reduce((sum: number, v: any) => sum + v.violationCount, 0);
        const uniqueTenants = new Set(violations.map((v: any) => v.tenantId)).size;
        const uniqueEndpoints = new Set(violations.map((v: any) => v.endpoint)).size;

        const summary = {
            totalViolations,
            uniqueTenants,
            uniqueEndpoints,
            periodStart: startDate.toISOString(),
            periodEnd: endDate.toISOString(),
        };

        logger.info("[RateLimitViolationsAPI] Retrieved violations", {
            adminUserId: session.user.id,
            filters: { tenantId, endpoint, limiterType, startDate, endDate },
            resultCount: violations.length,
        });

        return NextResponse.json({
            success: true,
            data: {
                violations,
                summary,
            },
            meta: {
                requestId: crypto.randomUUID(),
                timestamp: new Date().toISOString(),
            },
        });
    } catch (error) {
        logger.error("[RateLimitViolationsAPI] Failed to get violations:", { error });

        return NextResponse.json(
            {
                success: false,
                error: {
                    code: "INTERNAL_ERROR",
                    message: "Failed to retrieve rate limit violations",
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

export async function GET(req: NextRequest) {
    return withRequestContextAndRateLimit(req, "read", handleGET);
}
