/**
 * Slow Queries API Endpoint
 *
 * GET /api/v1/admin/performance/slow-queries
 *
 * Returns the top slowest queries with execution statistics and optimization
 * recommendations.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getQueryAnalyzer } from '@/lib/services/query-analyzer';
import { getOptimizedPrisma } from '@/lib/database/optimized-prisma';
import { withRequestContextAndRateLimit } from '@/lib/middleware/with-request-context';

async function handleGET(request: NextRequest) {

    try {
        const searchParams = request.nextUrl.searchParams;
        const limit = parseInt(searchParams.get('limit') || '20', 10);
        const days = parseInt(searchParams.get('days') || '7', 10);

        const prisma = getOptimizedPrisma();
        const analyzer = getQueryAnalyzer(prisma);

        // Get time range
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);

        const timeRange = { start: startDate, end: endDate };

        // Get top slow queries
        const slowQueries = await analyzer.getTopSlowQueries(limit, timeRange);

        // Get performance trends
        const trends = await analyzer.getPerformanceTrends(timeRange);

        // Calculate summary statistics
        const totalSlowQueries = slowQueries.reduce((sum, q) => sum + q.executionCount, 0);
        const avgExecutionTime = slowQueries.length > 0
            ? slowQueries.reduce((sum, q) => sum + q.avgExecutionTime, 0) / slowQueries.length
            : 0;
        const maxExecutionTime = slowQueries.length > 0
            ? Math.max(...slowQueries.map(q => q.maxExecutionTime))
            : 0;

        // Determine health status
        let healthStatus: 'healthy' | 'warning' | 'critical' = 'healthy';
        if (maxExecutionTime > 10000) {
            healthStatus = 'critical';
        } else if (maxExecutionTime > 5000) {
            healthStatus = 'warning';
        }

        return NextResponse.json({
            success: true,
            data: {
                healthStatus,
                queries: slowQueries.map(query => ({
                    query: query.query,
                    avgExecutionTime: query.avgExecutionTime,
                    maxExecutionTime: query.maxExecutionTime,
                    executionCount: query.executionCount,
                    lastExecuted: query.lastExecuted.toISOString(),
                    performanceRating: query.avgExecutionTime < 2000 ? 'acceptable' :
                        query.avgExecutionTime < 5000 ? 'warning' : 'critical',
                })),
                summary: {
                    totalSlowQueries,
                    avgExecutionTime: Math.round(avgExecutionTime),
                    maxExecutionTime,
                    timeRange: {
                        start: startDate.toISOString(),
                        end: endDate.toISOString(),
                        days,
                    },
                },
                trends: trends.map(trend => ({
                    date: trend.date.toISOString().split('T')[0],
                    avgExecutionTime: trend.avgExecutionTime,
                    queryCount: trend.executionCount,
                })),
            },
            meta: {
                timestamp: new Date().toISOString(),
            },
        });
    } catch (error) {
        console.error('Error fetching slow queries:', error);

        return NextResponse.json(
            {
                success: false,
                error: {
                    code: 'SLOW_QUERIES_ERROR',
                    message: 'Failed to fetch slow queries',
                    details: error instanceof Error ? error.message : 'Unknown error',
                },
            },
            { status: 500 }
        );
    }
}

export async function GET(req: NextRequest) {
    return withRequestContextAndRateLimit(req, "read", handleGET);
}
