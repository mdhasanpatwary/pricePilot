/**
 * Scraping Alerts API - List and filter alerts
 *
 * GET /api/v1/scraping/alerts
 *
 * Query parameters:
 * - severity: Filter by severity (info, warning, critical)
 * - competitorWebsiteId: Filter by competitor site
 * - acknowledged: Filter by acknowledged status (true, false)
 * - sort: Sort order (timestamp, -timestamp)
 * - page: Page number (default: 1)
 * - limit: Items per page (default: 20, max: 100)
 *
 * Requirements: 12.1
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { getCachedSession } from "@/lib/auth/cached-session";
import { withCache } from "@/lib/middleware/api-cache";
import { withRequestContextOnly } from "@/lib/middleware/with-request-context";

/**
 * Query parameters schema for alert filtering
 */
const alertQuerySchema = z.object({
    severity: z.enum(['info', 'warning', 'critical']).optional(),
    competitorWebsiteId: z.string().uuid().optional(),
    acknowledged: z.enum(['true', 'false']).optional(),
    sort: z.enum(['timestamp', '-timestamp']).optional().default('-timestamp'),
    page: z.coerce.number().int().min(1).optional().default(1),
    limit: z.coerce.number().int().min(1).max(100).optional().default(20),
    includeMeta: z.enum(['true', 'false']).optional().default('false'),
});

/**
 * GET /api/v1/scraping/alerts
 *
 * List alerts with filtering and pagination
 *
 * Requirements: 12.1
 */
async function handleGET(request: NextRequest) {
    try {
        // Authenticate user
        const session = await getCachedSession();
        if (!session?.user?.id) {
            return NextResponse.json(
                {
                    success: false,
                    error: {
                        code: 'UNAUTHORIZED',
                        message: 'Authentication required',
                    },
                },
                { status: 401 }
            );
        }

        const tenantId = session.user.tenantId;

        if (!tenantId) {
            return NextResponse.json(
                {
                    success: false,
                    error: {
                        code: 'FORBIDDEN',
                        message: 'User not associated with a tenant',
                    },
                },
                { status: 403 }
            );
        }

        // Parse and validate query parameters
        const searchParams = Object.fromEntries(request.nextUrl.searchParams);
        const validationResult = alertQuerySchema.safeParse(searchParams);

        if (!validationResult.success) {
            return NextResponse.json(
                {
                    success: false,
                    error: {
                        code: 'VALIDATION_ERROR',
                        message: 'Invalid query parameters',
                        details: validationResult.error.format(),
                    },
                },
                { status: 400 }
            );
        }

        const { severity, competitorWebsiteId, acknowledged, sort, page, limit, includeMeta } = validationResult.data;

        // Build where clause
        const where: any = {
            tenantId,
        };

        if (severity) {
            where.severity = severity;
        }

        if (competitorWebsiteId) {
            where.competitorWebsiteId = competitorWebsiteId;
        }

        if (acknowledged !== undefined) {
            where.acknowledged = acknowledged === 'true';
        }

        // Calculate pagination
        const skip = (page - 1) * limit;

        // Determine sort order
        const orderBy = sort === 'timestamp'
            ? { createdAt: 'asc' as const }
            : { createdAt: 'desc' as const };

        // Query alerts with pagination
        const alerts = await prisma.scrapingAlert.findMany({
            where,
            orderBy,
            skip,
            take: limit,
        });

        // Avoid relation include when competitorWebsiteId is null for all rows.
        // This prevents unnecessary `IN (NULL)` site lookups.
        const competitorSiteIds = Array.from(
            new Set(
                alerts
                    .map((alert) => alert.competitorWebsiteId)
                    .filter((id): id is string => Boolean(id))
            )
        );

        const siteNameById = new Map<string, string>();
        if (competitorSiteIds.length > 0) {
            const sites = await prisma.site.findMany({
                where: {
                    id: {
                        in: competitorSiteIds,
                    },
                },
                select: {
                    id: true,
                    baseUrl: true,
                },
            });

            sites.forEach((site) => {
                siteNameById.set(site.id, site.baseUrl);
            });
        }

        // Format response
        const formattedAlerts = alerts.map((alert) => ({
            id: alert.id,
            tenantId: alert.tenantId,
            severity: alert.severity,
            type: alert.type,
            title: alert.title,
            message: alert.message,
            competitorWebsiteId: alert.competitorWebsiteId,
            competitorSiteName: alert.competitorWebsiteId
                ? siteNameById.get(alert.competitorWebsiteId)
                : undefined,
            metadata: alert.metadata,
            timestamp: alert.createdAt,
            acknowledged: alert.acknowledged,
            acknowledgedAt: alert.acknowledgedAt,
            acknowledgedBy: alert.acknowledgedBy,
        }));

        const responseData: any = {
            alerts: formattedAlerts,
        };

        if (includeMeta === 'true') {
            const totalCount = await prisma.scrapingAlert.count({ where });
            const totalPages = Math.ceil(totalCount / limit);
            const hasNextPage = page < totalPages;
            const hasPreviousPage = page > 1;

            responseData.pagination = {
                page,
                limit,
                totalCount,
                totalPages,
                hasNextPage,
                hasPreviousPage,
            };
        }

        return NextResponse.json({
            success: true,
            data: responseData,
            meta: {
                requestId: crypto.randomUUID(),
                timestamp: new Date().toISOString(),
            },
        });
    } catch (error) {
        console.error('Failed to fetch alerts:', error);
        return NextResponse.json(
            {
                success: false,
                error: {
                    code: 'INTERNAL_ERROR',
                    message: 'Failed to fetch alerts',
                    details: error instanceof Error ? error.message : 'Unknown error',
                },
            },
            { status: 500 }
        );
    }
}

export async function GET(request: NextRequest) {
    return withRequestContextOnly(
        request,
        withCache(handleGET, {
            ttl: 75,
            keyPrefix: "api:scraping-alerts",
            tenantIsolated: true,
            varyBy: ["severity", "competitorWebsiteId", "acknowledged", "sort", "page", "limit", "includeMeta"],
        })
    );
}
