import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

interface ProxyData {
    url: string;
    type: 'residential' | 'datacenter' | 'unknown';
    isHealthy: boolean;
    successCount: number;
    failureCount: number;
    successRate: number;
    avgResponseTime: number;
    lastChecked: string;
}

interface ProxyStats {
    totalProxies: number;
    healthyProxies: number;
    unhealthyProxies: number;
    avgSuccessRate: number;
    avgResponseTime: number;
}

/**
 * GET /api/v1/admin/proxy-health
 * Get proxy health data with optional time range filtering
 * 
 * Query Parameters:
 * - timeRange: '24h' | '7d' | '30d' (optional, default: '24h')
 * 
 * Requirements: 8.1, 1.1, 1.2, 1.3, 1.5, 1.7
 */
export async function GET(request: NextRequest) {
    try {
        // Authentication check
        const session = await getServerSession(authOptions);
        if (!session?.user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // Check if user is super admin or regular admin
        const user = session.user as any;
        const isAdmin = user.role === "ADMIN" || user.isSuperAdmin === true;
        
        if (!isAdmin) {
            return NextResponse.json({ error: "Unauthorized - Admin access required" }, { status: 401 });
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

        // Fetch proxy health data from database
        const proxyHealthRecords = await prisma.proxyHealth.findMany({
            orderBy: {
                lastChecked: 'desc'
            }
        });

        // Fetch proxy metrics for the time range
        const proxyMetrics = await prisma.proxyMetrics.findMany({
            where: {
                timestamp: {
                    gte: startTime
                }
            },
            orderBy: {
                timestamp: 'desc'
            }
        });

        // Aggregate metrics by proxy
        const metricsMap = new Map<string, {
            totalRequests: number;
            successfulRequests: number;
            failedRequests: number;
            totalResponseTime: number;
            responseCount: number;
        }>();

        for (const metric of proxyMetrics) {
            const existing = metricsMap.get(metric.proxy) || {
                totalRequests: 0,
                successfulRequests: 0,
                failedRequests: 0,
                totalResponseTime: 0,
                responseCount: 0
            };

            existing.totalRequests += metric.totalRequests;
            existing.successfulRequests += metric.successfulRequests;
            existing.failedRequests += metric.failedRequests;
            existing.totalResponseTime += metric.avgResponseTime * metric.totalRequests;
            existing.responseCount += metric.totalRequests;

            metricsMap.set(metric.proxy, existing);
        }

        // Format proxy data
        const proxies: ProxyData[] = proxyHealthRecords.map((health: any) => {
            const metrics = metricsMap.get(health.proxyUrl);

            const successCount = metrics?.successfulRequests || health.successCount;
            const failureCount = metrics?.failedRequests || health.failureCount;
            const totalRequests = successCount + failureCount;
            const successRate = totalRequests > 0 ? (successCount / totalRequests) * 100 : 0;
            const avgResponseTime = metrics?.responseCount
                ? metrics.totalResponseTime / metrics.responseCount
                : health.avgResponseTime;

            return {
                url: health.proxyUrl,
                type: health.proxyType as 'residential' | 'datacenter' | 'unknown',
                isHealthy: health.isHealthy,
                successCount,
                failureCount,
                successRate: Math.round(successRate * 10) / 10, // Round to 1 decimal
                avgResponseTime: Math.round(avgResponseTime),
                lastChecked: health.lastChecked.toISOString()
            };
        });

        // Calculate aggregate statistics
        const totalProxies = proxies.length;
        const healthyProxies = proxies.filter((p: ProxyData) => p.isHealthy).length;
        const unhealthyProxies = totalProxies - healthyProxies;

        const totalSuccessRate = proxies.length > 0
            ? proxies.reduce((sum: number, p: ProxyData) => sum + p.successRate, 0) / proxies.length
            : 0;

        const totalAvgResponseTime = proxies.length > 0
            ? proxies.reduce((sum: number, p: ProxyData) => sum + p.avgResponseTime, 0) / proxies.length
            : 0;

        const stats: ProxyStats = {
            totalProxies,
            healthyProxies,
            unhealthyProxies,
            avgSuccessRate: Math.round(totalSuccessRate * 10) / 10,
            avgResponseTime: Math.round(totalAvgResponseTime)
        };

        return NextResponse.json({
            success: true,
            data: {
                stats,
                proxies,
                timeRange
            }
        });

    } catch (error) {
        console.error("[ProxyHealth API] Error:", error);
        return NextResponse.json(
            {
                success: false,
                error: "Failed to fetch proxy health data",
                details: error instanceof Error ? error.message : "Unknown error"
            },
            { status: 500 }
        );
    }
}
