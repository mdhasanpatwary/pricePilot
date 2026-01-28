import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { metricsAggregator } from '@/lib/services/metrics-aggregator';
import { prisma } from '@/lib/prisma';
import { withRateLimit } from '@/lib/middleware/ratelimit';

/**
 * GET /api/v1/admin/analytics/proxies
 * Get proxy analytics including health, performance, and failure patterns
 *
 * Query Parameters:
 * - timeRange: Time range for analytics (1h, 24h, 7d) - default: 24h
 * - limit: Number of top failing proxies to return - default: 10
 * - proxyUrl: Filter by specific proxy URL (optional)
 *
 * Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 13.3
 */
async function handleGET(request: NextRequest) {
    try {
        // Authentication check
        const session = await getServerSession(authOptions);
        if (!session?.user) {
            return NextResponse.json(
                { error: 'Unauthorized' },
                { status: 401 }
            );
        }

        // Check if user is super admin or regular admin
        const user = session.user as any;
        const isAdmin = user.role === 'ADMIN' || user.isSuperAdmin === true;

        if (!isAdmin) {
            return NextResponse.json(
                { error: 'Unauthorized - Admin access required' },
                { status: 401 }
            );
        }

        // Parse query parameters
        const searchParams = request.nextUrl.searchParams;
        const timeRange = (searchParams.get('timeRange') || '24h') as '1h' | '24h' | '7d';
        const limit = parseInt(searchParams.get('limit') || '10', 10);
        const proxyUrl = searchParams.get('proxyUrl') || undefined;

        // Validate time range
        if (!['1h', '24h', '7d'].includes(timeRange)) {
            return NextResponse.json(
                { error: 'Invalid time range. Must be 1h, 24h, or 7d' },
                { status: 400 }
            );
        }

        // Calculate start time based on range
        const now = new Date();
        const startTime = new Date(now);
        if (timeRange === '1h') {
            startTime.setHours(now.getHours() - 1);
        } else if (timeRange === '24h') {
            startTime.setHours(now.getHours() - 24);
        } else {
            startTime.setDate(now.getDate() - 7);
        }

        // Get top failing proxies
        const topFailures = await metricsAggregator.getTopFailures('proxies', limit, timeRange);

        // Get all proxy health status
        const proxyHealthData = await prisma.proxyHealth.findMany({
            select: {
                proxyUrl: true,
                isHealthy: true,
                lastChecked: true,
                successCount: true,
                failureCount: true,
                avgResponseTime: true,
            },
        });

        // Calculate success rate and sort
        const proxyHealth = proxyHealthData
            .map(p => ({
                ...p,
                successRate: (p.successCount + p.failureCount) > 0
                    ? p.successCount / (p.successCount + p.failureCount)
                    : 0,
            }))
            .sort((a, b) => b.successRate - a.successRate);

        // Get proxy-specific analytics if proxyUrl is provided
        let proxyAnalytics = null;
        if (proxyUrl) {
            const metrics = await prisma.proxyMetrics.findMany({
                where: {
                    proxy: proxyUrl,
                    timestamp: { gte: startTime },
                },
                select: {
                    totalRequests: true,
                    successfulRequests: true,
                    failedRequests: true,
                    avgResponseTime: true,
                    timestamp: true,
                },
                orderBy: {
                    timestamp: 'asc',
                },
            });

            const totalRequests = metrics.reduce((sum, m) => sum + m.totalRequests, 0);
            const successfulRequests = metrics.reduce((sum, m) => sum + m.successfulRequests, 0);
            const failedRequests = metrics.reduce((sum, m) => sum + m.failedRequests, 0);

            // Calculate weighted average response time
            let totalWeightedResponseTime = 0;
            let totalWeight = 0;
            for (const metric of metrics) {
                totalWeightedResponseTime += metric.avgResponseTime * metric.totalRequests;
                totalWeight += metric.totalRequests;
            }
            const avgResponseTime = totalWeight > 0 ? totalWeightedResponseTime / totalWeight : 0;

            // Get current health status
            const healthData = await prisma.proxyHealth.findUnique({
                where: { proxyUrl },
                select: {
                    isHealthy: true,
                    lastChecked: true,
                    successCount: true,
                    failureCount: true,
                },
            });

            const health = healthData ? {
                ...healthData,
                successRate: (healthData.successCount + healthData.failureCount) > 0
                    ? healthData.successCount / (healthData.successCount + healthData.failureCount)
                    : 0,
            } : null;

            proxyAnalytics = {
                proxyUrl,
                totalRequests,
                successfulRequests,
                failedRequests,
                successRate: totalRequests > 0 ? successfulRequests / totalRequests : 0,
                failureRate: totalRequests > 0 ? failedRequests / totalRequests : 0,
                avgResponseTime,
                health,
                timeSeries: metrics.map(m => ({
                    timestamp: m.timestamp,
                    successRate: m.totalRequests > 0 ? m.successfulRequests / m.totalRequests : 0,
                    responseTime: m.avgResponseTime,
                })),
            };
        }

        // Get time-series data for proxy response times
        const timeSeriesData = await metricsAggregator.getTimeSeriesData('response_time', timeRange);

        return NextResponse.json({
            success: true,
            data: {
                topFailures,
                proxyHealth,
                proxyAnalytics,
                timeSeries: timeSeriesData,
                timeRange,
            },
        });
    } catch (error) {
        console.error('[Proxy Analytics API] Error:', error);
        return NextResponse.json(
            {
                success: false,
                error: 'Failed to fetch proxy analytics',
                details: error instanceof Error ? error.message : 'Unknown error',
            },
            { status: 500 }
        );
    }
}


export async function GET(req: NextRequest) {
    return withRateLimit(req, 'read', handleGET);
}
