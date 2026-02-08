import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { withRateLimit } from "@/lib/middleware/ratelimit";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";

/**
 * GET /api/v1/admin/rate-limits/metrics
 * 
 * Returns aggregated rate limit metrics with filtering support.
 * This endpoint provides comprehensive metrics for the admin dashboard,
 * allowing filtering by tenant, limiter type, and time range.
 * 
 * Requirements: 3.4, 6.1, 6.2, 6.3, 6.4
 * 
 * Authentication: Super admin only
 * Rate Limiting: Read limiter
 * 
 * Query Parameters:
 * - tenantId (optional): Filter by specific tenant
 * - limiterType (optional): Filter by limiter type (auth, api, read, write, sync, importExport)
 * - startDate (optional): Start of time range (ISO8601)
 * - endDate (optional): End of time range (ISO8601)
 * 
 * Response:
 * {
 *   "success": true,
 *   "data": {
 *     "metrics": [
 *       {
 *         "tenantId": "string",
 *         "tenantName": "string",
 *         "limiterType": "string",
 *         "totalHits": number,
 *         "totalViolations": number,
 *         "violationRate": number,
 *         "uniqueIdentifiers": number,
 *         "topEndpoints": [
 *           {
 *             "endpoint": "string",
 *             "hitCount": number,
 *             "violationCount": number
 *           }
 *         ]
 *       }
 *     ],
 *     "summary": {
 *       "totalHits": number,
 *       "totalViolations": number,
 *       "overallViolationRate": number,
 *       "tenantsAffected": number,
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
        const session = await getServerSession(authOptions);

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
        const limiterType = searchParams.get("limiterType");
        const startDateParam = searchParams.get("startDate");
        const endDateParam = searchParams.get("endDate");

        // Validate and parse dates
        const endDate = endDateParam ? new Date(endDateParam) : new Date();
        const startDate = startDateParam
            ? new Date(startDateParam)
            : new Date(endDate.getTime() - 7 * 24 * 60 * 60 * 1000); // Default: last 7 days

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
            timestamp: {
                gte: startDate,
                lte: endDate,
            },
        };

        if (tenantId) {
            where.tenantId = tenantId;
        }

        if (limiterType) {
            where.limiterType = limiterType;
        }

        // Fetch metrics from database
        const rawMetrics = await prisma.rateLimitMetric.findMany({
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
        });

        // Aggregate metrics by tenant and limiter type
        const aggregatedMap = new Map<string, any>();

        for (const metric of rawMetrics) {
            const key = `${metric.tenantId}:${metric.limiterType}`;

            if (!aggregatedMap.has(key)) {
                aggregatedMap.set(key, {
                    tenantId: metric.tenantId,
                    tenantName: metric.Tenant.companyName,
                    limiterType: metric.limiterType,
                    totalHits: 0,
                    totalViolations: 0,
                    uniqueIdentifiers: new Set<string>(),
                    endpointStats: new Map<string, { hitCount: number; violationCount: number }>(),
                });
            }

            const agg = aggregatedMap.get(key);
            agg.totalHits += metric.hitCount;
            agg.totalViolations += metric.violationCount;
            agg.uniqueIdentifiers.add(metric.identifier);

            // Track endpoint stats
            const endpointKey = metric.endpoint;
            const endpointStat = agg.endpointStats.get(endpointKey) || { hitCount: 0, violationCount: 0 };
            endpointStat.hitCount += metric.hitCount;
            endpointStat.violationCount += metric.violationCount;
            agg.endpointStats.set(endpointKey, endpointStat);
        }

        // Format aggregated metrics
        const metrics = Array.from(aggregatedMap.values()).map((agg) => {
            const totalRequests = agg.totalHits + agg.totalViolations;
            const violationRate = totalRequests > 0
                ? (agg.totalViolations / totalRequests) * 100
                : 0;

            // Get top 5 endpoints
            const topEndpoints = Array.from(agg.endpointStats.entries())
                .map((entry) => {
                    const [endpoint, stats] = entry as [string, { hitCount: number; violationCount: number }];
                    return {
                        endpoint,
                        hitCount: stats.hitCount,
                        violationCount: stats.violationCount,
                    };
                })
                .sort((a, b) =>
                    (b.hitCount + b.violationCount) - (a.hitCount + a.violationCount)
                )
                .slice(0, 5);

            return {
                tenantId: agg.tenantId,
                tenantName: agg.tenantName,
                limiterType: agg.limiterType,
                totalHits: agg.totalHits,
                totalViolations: agg.totalViolations,
                violationRate: parseFloat(violationRate.toFixed(2)),
                uniqueIdentifiers: agg.uniqueIdentifiers.size,
                topEndpoints,
            };
        });

        // Calculate summary statistics
        const totalHits = metrics.reduce((sum, m) => sum + m.totalHits, 0);
        const totalViolations = metrics.reduce((sum, m) => sum + m.totalViolations, 0);
        const totalRequests = totalHits + totalViolations;
        const overallViolationRate = totalRequests > 0
            ? (totalViolations / totalRequests) * 100
            : 0;
        const tenantsAffected = new Set(metrics.map(m => m.tenantId)).size;

        const summary = {
            totalHits,
            totalViolations,
            overallViolationRate: parseFloat(overallViolationRate.toFixed(2)),
            tenantsAffected,
            periodStart: startDate.toISOString(),
            periodEnd: endDate.toISOString(),
        };

        logger.info("[RateLimitMetricsAPI] Retrieved aggregated metrics", {
            adminUserId: session.user.id,
            filters: { tenantId, limiterType, startDate, endDate },
            resultCount: metrics.length,
        });

        return NextResponse.json({
            success: true,
            data: {
                metrics,
                summary,
            },
            meta: {
                requestId: crypto.randomUUID(),
                timestamp: new Date().toISOString(),
            },
        });
    } catch (error) {
        logger.error("[RateLimitMetricsAPI] Failed to get metrics:", { error });

        return NextResponse.json(
            {
                success: false,
                error: {
                    code: "INTERNAL_ERROR",
                    message: "Failed to retrieve rate limit metrics",
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
    return withRateLimit(req, "read", handleGET);
}
