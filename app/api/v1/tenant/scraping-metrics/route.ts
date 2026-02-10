import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withRequestContextAndRateLimit } from "@/lib/middleware/with-request-context";
import { getCachedSession } from "@/lib/auth/cached-session";

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
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const tenantId = session.user.tenantId;
        if (!tenantId) {
            return NextResponse.json({ error: "Tenant ID not found" }, { status: 400 });
        }

        // Parse query parameters
        const searchParams = request.nextUrl.searchParams;
        const timeRange = searchParams.get('timeRange') || '24h';

        // Validate time range
        if (!['24h', '7d', '30d'].includes(timeRange)) {
            return NextResponse.json(
                { error: "Invalid time range. Must be '24h', '7d', or '30d'" },
                { status: 400 }
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
            });
        }

        const siteUrls = tenantSites.map(site => site.baseUrl);

        // Fetch scraping metrics only for tenant's sites
        const scrapingMetrics = await prisma.scrapingMetrics.findMany({
            where: {
                site: {
                    in: siteUrls
                },
                timestamp: {
                    gte: startTime
                }
            },
            orderBy: {
                timestamp: 'desc'
            }
        });

        // Fetch challenge attempts for tenant's sites
        const challengeAttempts = await prisma.challengeAttempt.findMany({
            where: {
                site: {
                    in: siteUrls
                },
                timestamp: {
                    gte: startTime
                }
            }
        });

        // Group metrics by site
        const siteMetricsMap = new Map<string, {
            totalRequests: number;
            successfulRequests: number;
            blockedRequests: number;
            totalResponseTime: number;
            responseCount: number;
            lastTimestamp: Date | null;
        }>();

        // Initialize map with all tenant sites
        for (const site of tenantSites) {
            siteMetricsMap.set(site.baseUrl, {
                totalRequests: 0,
                successfulRequests: 0,
                blockedRequests: 0,
                totalResponseTime: 0,
                responseCount: 0,
                lastTimestamp: site.lastSyncAt
            });
        }

        // Aggregate metrics
        for (const metric of scrapingMetrics) {
            const siteStats = siteMetricsMap.get(metric.site);
            if (siteStats) {
                siteStats.totalRequests += metric.totalRequests;
                siteStats.successfulRequests += metric.successfulRequests;
                siteStats.blockedRequests += metric.blockedRequests;
                siteStats.totalResponseTime += metric.avgResponseTime * metric.totalRequests;
                siteStats.responseCount += metric.totalRequests;

                // Track the most recent timestamp
                if (!siteStats.lastTimestamp || metric.timestamp > siteStats.lastTimestamp) {
                    siteStats.lastTimestamp = metric.timestamp;
                }
            }
        }

        // Group challenge attempts by site
        const siteChallengesMap = new Map<string, {
            detected: number;
            solved: number;
        }>();

        for (const site of siteUrls) {
            siteChallengesMap.set(site, {
                detected: 0,
                solved: 0
            });
        }

        for (const attempt of challengeAttempts) {
            const challenges = siteChallengesMap.get(attempt.site);
            if (challenges) {
                challenges.detected++;
                if (attempt.solved) {
                    challenges.solved++;
                }
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

            const challenges = siteChallengesMap.get(site) || { detected: 0, solved: 0 };

            return {
                domain: site,
                successRate: Math.round(successRate * 10) / 10,
                blockRate: Math.round(blockRate * 10) / 10,
                lastSync: stats.lastTimestamp,
                status,
                challenges
            };
        });

        // Calculate overall metrics
        const totalRequests = Array.from(siteMetricsMap.values())
            .reduce((sum, stats) => sum + stats.totalRequests, 0);

        const totalSuccessful = Array.from(siteMetricsMap.values())
            .reduce((sum, stats) => sum + stats.successfulRequests, 0);

        const totalBlocked = Array.from(siteMetricsMap.values())
            .reduce((sum, stats) => sum + stats.blockedRequests, 0);

        const totalResponseTime = Array.from(siteMetricsMap.values())
            .reduce((sum, stats) => sum + stats.totalResponseTime, 0);

        const totalResponseCount = Array.from(siteMetricsMap.values())
            .reduce((sum, stats) => sum + stats.responseCount, 0);

        const overallSuccessRate = totalRequests > 0
            ? (totalSuccessful / totalRequests) * 100
            : 0;

        const overallBlockRate = totalRequests > 0
            ? (totalBlocked / totalRequests) * 100
            : 0;

        const avgResponseTime = totalResponseCount > 0
            ? totalResponseTime / totalResponseCount
            : 0;

        const metrics: TenantMetrics = {
            overallSuccessRate: Math.round(overallSuccessRate * 10) / 10,
            overallBlockRate: Math.round(overallBlockRate * 10) / 10,
            totalRequests,
            avgResponseTime: Math.round(avgResponseTime),
            sites: siteMetrics
        };

        return NextResponse.json({
            success: true,
            data: {
                ...metrics,
                timeRange
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
            { status: 500 }
        );
    }
}

export async function GET(req: NextRequest) {
    return withRequestContextAndRateLimit(req, 'read', () => handleGET(req));
}
