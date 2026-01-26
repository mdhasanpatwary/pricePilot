import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

interface ScrapingMetrics {
    site: string;
    tenant: string;
    totalRequests: number;
    successfulRequests: number;
    blockedRequests: number;
    successRate: number;
    blockRate: number;
    avgResponseTime: number;
    lastScrapeAt: Date | null;
}

interface MetricsSummary {
    totalRequests: number;
    avgSuccessRate: number;
    avgBlockRate: number;
    activeSites: number;
}

/**
 * GET /api/v1/admin/scraping-metrics
 * Get scraping metrics with optional time range filtering
 * 
 * Query Parameters:
 * - timeRange: '24h' | '7d' | '30d' (optional, default: '24h')
 * 
 * Requirements: 8.3, 3.1, 3.2, 3.3, 3.5
 */
export async function GET(request: NextRequest) {
    try {
        // Authentication check
        const session = await getServerSession(authOptions);
        if (!session?.user || (session.user as any).role !== "SUPER_ADMIN") {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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

        // Fetch scraping metrics from database for the time range
        const scrapingMetrics = await prisma.scrapingMetrics.findMany({
            where: {
                timestamp: {
                    gte: startTime
                }
            },
            orderBy: {
                timestamp: 'desc'
            }
        });

        // Group by site and calculate aggregates
        const siteMetricsMap = new Map<string, {
            totalRequests: number;
            successfulRequests: number;
            blockedRequests: number;
            totalResponseTime: number;
            responseCount: number;
            lastTimestamp: Date;
        }>();

        for (const metric of scrapingMetrics) {
            if (!siteMetricsMap.has(metric.site)) {
                siteMetricsMap.set(metric.site, {
                    totalRequests: 0,
                    successfulRequests: 0,
                    blockedRequests: 0,
                    totalResponseTime: 0,
                    responseCount: 0,
                    lastTimestamp: metric.timestamp
                });
            }

            const siteStats = siteMetricsMap.get(metric.site)!;
            siteStats.totalRequests += metric.totalRequests;
            siteStats.successfulRequests += metric.successfulRequests;
            siteStats.blockedRequests += metric.blockedRequests;
            siteStats.totalResponseTime += metric.avgResponseTime * metric.totalRequests;
            siteStats.responseCount += metric.totalRequests;

            // Track the most recent timestamp
            if (metric.timestamp > siteStats.lastTimestamp) {
                siteStats.lastTimestamp = metric.timestamp;
            }
        }

        // Fetch site information to get tenant associations
        const sites = await prisma.site.findMany({
            select: {
                baseUrl: true,
                tenant: {
                    select: {
                        companyName: true
                    }
                }
            }
        });

        // Create a map of site URL to tenant name
        const siteToTenantMap = new Map<string, string>();
        for (const site of sites) {
            siteToTenantMap.set(site.baseUrl, site.tenant.companyName);
        }

        // Format site metrics
        const siteMetrics: ScrapingMetrics[] = Array.from(siteMetricsMap.entries()).map(([site, stats]) => {
            const successRate = stats.totalRequests > 0
                ? (stats.successfulRequests / stats.totalRequests) * 100
                : 0;

            const blockRate = stats.totalRequests > 0
                ? (stats.blockedRequests / stats.totalRequests) * 100
                : 0;

            const avgResponseTime = stats.responseCount > 0
                ? stats.totalResponseTime / stats.responseCount
                : 0;

            return {
                site,
                tenant: siteToTenantMap.get(site) || 'Unknown',
                totalRequests: stats.totalRequests,
                successfulRequests: stats.successfulRequests,
                blockedRequests: stats.blockedRequests,
                successRate: Math.round(successRate * 10) / 10, // Round to 1 decimal
                blockRate: Math.round(blockRate * 10) / 10, // Round to 1 decimal
                avgResponseTime: Math.round(avgResponseTime),
                lastScrapeAt: stats.lastTimestamp
            };
        });

        // Sort sites by total requests (descending)
        siteMetrics.sort((a, b) => b.totalRequests - a.totalRequests);

        // Calculate aggregate statistics
        const totalRequests = siteMetrics.reduce((sum, s) => sum + s.totalRequests, 0);

        const avgSuccessRate = siteMetrics.length > 0
            ? siteMetrics.reduce((sum, s) => sum + s.successRate, 0) / siteMetrics.length
            : 0;

        const avgBlockRate = siteMetrics.length > 0
            ? siteMetrics.reduce((sum, s) => sum + s.blockRate, 0) / siteMetrics.length
            : 0;

        const activeSites = siteMetrics.length;

        const summary: MetricsSummary = {
            totalRequests,
            avgSuccessRate: Math.round(avgSuccessRate * 10) / 10,
            avgBlockRate: Math.round(avgBlockRate * 10) / 10,
            activeSites
        };

        return NextResponse.json({
            success: true,
            data: {
                summary,
                sites: siteMetrics,
                timeRange
            }
        });

    } catch (error) {
        console.error("[ScrapingMetrics API] Error:", error);
        return NextResponse.json(
            {
                success: false,
                error: "Failed to fetch scraping metrics",
                details: error instanceof Error ? error.message : "Unknown error"
            },
            { status: 500 }
        );
    }
}
