import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withRequestContextAndRateLimit } from "@/lib/middleware/with-request-context";
import { getCachedSession } from "@/lib/auth/cached-session";

export const dynamic = "force-dynamic";

interface TenantSiteMetrics {
    domain: string;
    successRate: number;
    blockRate: number;
    lastSync: Date | null;
    status: 'healthy' | 'degraded' | 'critical';
    challenges: {
        detected: number;
        solved: number;
    };
}

interface TenantMetrics {
    overallSuccessRate: number;
    overallBlockRate: number;
    totalRequests: number;
    avgResponseTime: number;
    sites: TenantSiteMetrics[];
}

type TimeRange = "24h" | "7d" | "30d";

/**
 * GET /api/v1/tenant/scraping-metrics
 * Get scraping metrics for tenant's sites only
 * 
 * Query Parameters:
 * - timeRange: '24h' | '7d' | '30d' (optional, default: '24h')
 * 
 * Requirements: 8.4, 4.1, 4.2, 4.3, 4.5, 4.7
 */
async function handleGET(request: NextRequest) {
    try {
        // Authenticate and get tenant ID
        const session = await getCachedSession();
        if (!session?.user) {
            return NextResponse.json(
                { error: "Unauthorized" },
                {
                    status: 401,
                    headers: {
                        "Cache-Control": "no-store, max-age=0",
                    },
                },
            );
        }

        const tenantId = session.user.tenantId;
        if (!tenantId) {
            return NextResponse.json(
                { error: "Tenant ID not found" },
                {
                    status: 400,
                    headers: {
                        "Cache-Control": "no-store, max-age=0",
                    },
                },
            );
        }

        // Parse query parameters
        const searchParams = request.nextUrl.searchParams;
        const timeRange = (searchParams.get("timeRange") || "24h") as TimeRange;

        // Validate time range
        if (!['24h', '7d', '30d'].includes(timeRange)) {
            return NextResponse.json(
                { error: "Invalid time range. Must be '24h', '7d', or '30d'" },
                {
                    status: 400,
                    headers: {
                        "Cache-Control": "no-store, max-age=0",
                    },
                },
            );
        }

        // Calculate start time based on time range
        const now = new Date();
        const startTime = new Date(now);

        switch (timeRange) {
            case '24h':
                startTime.setHours(now.getHours() - 24);
                break;
            case '7d':
                startTime.setDate(now.getDate() - 7);
                break;
            case '30d':
                startTime.setDate(now.getDate() - 30);
                break;
        }

        // Fetch tenant's sites
        const tenantSites = await prisma.site.findMany({
            where: {
                tenantId: tenantId
            },
            select: {
                id: true,
                baseUrl: true,
                lastSyncAt: true
            }
        });

        if (tenantSites.length === 0) {
            // Return empty metrics if tenant has no sites
            return NextResponse.json({
                success: true,
                data: {
                    overallSuccessRate: 0,
                    overallBlockRate: 0,
                    totalRequests: 0,
                    avgResponseTime: 0,
                    sites: [],
                    timeRange
                }
            }, {
                headers: {
                    "Cache-Control": "no-store, max-age=0",
                }
            });
        }

        const siteIds = tenantSites.map((s) => s.id);
        const siteIdToBaseUrl = new Map<string, string>(
            tenantSites.map((s) => [s.id, s.baseUrl]),
        );
        const baseUrlToLastSyncAt = new Map<string, Date | null>(
            tenantSites.map((s) => [s.baseUrl, s.lastSyncAt]),
        );

        // NOTE:
        // The legacy ScrapingMetrics/ChallengeAttempt tables are not tenant-scoped and historically
        // stored "site" as a hostname while Site.baseUrl is a full URL (scheme + host, sometimes slash).
        // ScrapeAttempt is tenant-scoped and reliably recorded by the worker, so we aggregate from it.
        const attemptsWhere = {
            tenantId,
            competitorWebsiteId: { in: siteIds },
            createdAt: { gte: startTime },
        } as const;

        const siteMetricsMap = new Map<string, {
            totalRequests: number;
            successfulRequests: number;
            blockedRequests: number;
            lastTimestamp: Date | null;
            avgResponseTimeMs: number;
            challengesDetected: number;
            challengesSolved: number;
        }>();

        // Initialize map with all tenant sites
        for (const site of tenantSites) {
            siteMetricsMap.set(site.baseUrl, {
                totalRequests: 0,
                successfulRequests: 0,
                blockedRequests: 0,
                lastTimestamp: site.lastSyncAt,
                avgResponseTimeMs: 0,
                challengesDetected: 0,
                challengesSolved: 0,
            });
        }

        const [countGroups, timingGroups, overallAgg] = await Promise.all([
            prisma.scrapeAttempt.groupBy({
                by: ["competitorWebsiteId", "success", "protectionDetected"],
                where: attemptsWhere,
                _count: { _all: true },
            }),
            prisma.scrapeAttempt.groupBy({
                by: ["competitorWebsiteId"],
                where: attemptsWhere,
                _avg: { responseTimeMs: true },
                _max: { createdAt: true },
            }),
            prisma.scrapeAttempt.aggregate({
                where: attemptsWhere,
                _avg: { responseTimeMs: true },
            }),
        ]);

        // Apply counts (success/block/challenge) per site
        for (const g of countGroups) {
            const baseUrl = siteIdToBaseUrl.get(g.competitorWebsiteId);
            if (!baseUrl) continue;

            const stats = siteMetricsMap.get(baseUrl);
            if (!stats) continue;

            const c = g._count._all;
            stats.totalRequests += c;
            if (g.success) stats.successfulRequests += c;

            // "Blocked" is best approximated as protectionDetected=true.
            if (g.protectionDetected) {
                stats.blockedRequests += c;
                stats.challengesDetected += c;
                if (g.success) {
                    // Approximation: protection detected + success => challenge likely passed.
                    stats.challengesSolved += c;
                }
            }
        }

        // Apply timing + most recent activity timestamp
        for (const t of timingGroups) {
            const baseUrl = siteIdToBaseUrl.get(t.competitorWebsiteId);
            if (!baseUrl) continue;

            const stats = siteMetricsMap.get(baseUrl);
            if (!stats) continue;

            stats.avgResponseTimeMs = Math.round(t._avg.responseTimeMs ?? 0);

            const existingLast = stats.lastTimestamp ?? baseUrlToLastSyncAt.get(baseUrl) ?? null;
            const attemptLast = t._max.createdAt ?? null;
            if (!existingLast) {
                stats.lastTimestamp = attemptLast;
            } else if (attemptLast && attemptLast > existingLast) {
                stats.lastTimestamp = attemptLast;
            }
        }

        // Calculate per-site metrics with status
        const siteMetrics: TenantSiteMetrics[] = Array.from(siteMetricsMap.entries()).map(([site, stats]) => {
            const successRate = stats.totalRequests > 0
                ? (stats.successfulRequests / stats.totalRequests) * 100
                : 0;

            const blockRate = stats.totalRequests > 0
                ? (stats.blockedRequests / stats.totalRequests) * 100
                : 0;

            // Determine status based on success rate and block rate
            let status: 'healthy' | 'degraded' | 'critical';
            if (blockRate > 50 || successRate < 50) {
                status = 'critical';
            } else if (blockRate > 20 || successRate < 80) {
                status = 'degraded';
            } else {
                status = 'healthy';
            }

            return {
                domain: site,
                successRate: Math.round(successRate * 10) / 10,
                blockRate: Math.round(blockRate * 10) / 10,
                lastSync: stats.lastTimestamp,
                status,
                challenges: {
                    detected: stats.challengesDetected,
                    solved: stats.challengesSolved,
                },
            };
        });

        // Calculate overall metrics
        const totalRequests = Array.from(siteMetricsMap.values())
            .reduce((sum, stats) => sum + stats.totalRequests, 0);

        const totalSuccessful = Array.from(siteMetricsMap.values())
            .reduce((sum, stats) => sum + stats.successfulRequests, 0);

        const totalBlocked = Array.from(siteMetricsMap.values())
            .reduce((sum, stats) => sum + stats.blockedRequests, 0);

        const overallSuccessRate = totalRequests > 0
            ? (totalSuccessful / totalRequests) * 100
            : 0;

        const overallBlockRate = totalRequests > 0
            ? (totalBlocked / totalRequests) * 100
            : 0;

        const avgResponseTime = Math.round(overallAgg._avg.responseTimeMs ?? 0);

        const metrics: TenantMetrics = {
            overallSuccessRate: Math.round(overallSuccessRate * 10) / 10,
            overallBlockRate: Math.round(overallBlockRate * 10) / 10,
            totalRequests,
            avgResponseTime,
            sites: siteMetrics
        };

        return NextResponse.json({
            success: true,
            data: {
                ...metrics,
                timeRange
            }
        }, {
            headers: {
                "Cache-Control": "no-store, max-age=0",
            }
        });

    } catch (error) {
        console.error("[TenantScrapingMetrics API] Error:", error);
        return NextResponse.json(
            {
                success: false,
                error: "Failed to fetch tenant scraping metrics",
                details: error instanceof Error ? error.message : "Unknown error"
            },
            {
                status: 500,
                headers: {
                    "Cache-Control": "no-store, max-age=0",
                },
            },
        );
    }
}

export async function GET(req: NextRequest) {
    return withRequestContextAndRateLimit(req, 'read', () => handleGET(req));
}
