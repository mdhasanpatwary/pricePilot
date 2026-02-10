/**
 * Query Performance Metrics API
 * 
 * Provides real-time query performance metrics for monitoring and debugging.
 * 
 * GET /api/v1/debug/query-performance
 * GET /api/v1/debug/query-performance?format=json
 * GET /api/v1/debug/query-performance?reset=true
 */

import { NextRequest, NextResponse } from 'next/server';
import { getPerformanceTracker } from '@/lib/middleware/query-performance-tracker';

export async function GET(req: NextRequest) {
    try {
        const searchParams = req.nextUrl.searchParams;
        const format = searchParams.get('format') || 'json';
        const reset = searchParams.get('reset') === 'true';

        const tracker = getPerformanceTracker();

        // Reset metrics if requested
        if (reset) {
            tracker.reset();
            return NextResponse.json({
                success: true,
                message: 'Query performance metrics have been reset',
            });
        }

        // Get performance report
        const report = tracker.getReport();

        // Convert Map to array for JSON serialization
        const queryBreakdown = Array.from(report.queryBreakdown.entries()).map(
            ([key, metrics]) => ({
                key,
                ...metrics,
            })
        );

        const response = {
            success: true,
            data: {
                summary: {
                    totalQueries: report.totalQueries,
                    totalTime: Math.round(report.totalTime * 100) / 100,
                    avgQueryTime: Math.round(report.avgQueryTime * 100) / 100,
                },
                slowestQueries: report.slowestQueries.map((q) => ({
                    model: q.model,
                    operation: q.operation,
                    count: q.count,
                    avgTime: Math.round(q.avgTime * 100) / 100,
                    minTime: Math.round(q.minTime * 100) / 100,
                    maxTime: Math.round(q.maxTime * 100) / 100,
                    totalTime: Math.round(q.totalTime * 100) / 100,
                    lastExecuted: q.lastExecuted,
                })),
                allQueries: queryBreakdown.map((q) => ({
                    model: q.model,
                    operation: q.operation,
                    count: q.count,
                    avgTime: Math.round(q.avgTime * 100) / 100,
                    minTime: Math.round(q.minTime * 100) / 100,
                    maxTime: Math.round(q.maxTime * 100) / 100,
                    totalTime: Math.round(q.totalTime * 100) / 100,
                    lastExecuted: q.lastExecuted,
                })),
            },
            meta: {
                timestamp: new Date().toISOString(),
                format,
            },
        };

        // Return formatted response
        if (format === 'text') {
            // Generate text report
            let textReport = '='.repeat(80) + '\n';
            textReport += 'PRISMA QUERY PERFORMANCE REPORT\n';
            textReport += '='.repeat(80) + '\n';
            textReport += `Total Queries: ${report.totalQueries}\n`;
            textReport += `Total Time: ${report.totalTime.toFixed(2)}ms\n`;
            textReport += `Average Query Time: ${report.avgQueryTime.toFixed(2)}ms\n`;
            textReport += '='.repeat(80) + '\n\n';
            textReport += 'TOP 20 SLOWEST QUERIES:\n';
            textReport += '-'.repeat(80) + '\n';

            report.slowestQueries.forEach((query, index) => {
                textReport += `${index + 1}. ${query.model}.${query.operation}\n`;
                textReport += `   Count: ${query.count}, Avg: ${query.avgTime.toFixed(2)}ms, `;
                textReport += `Min: ${query.minTime.toFixed(2)}ms, Max: ${query.maxTime.toFixed(2)}ms\n`;
            });

            textReport += '='.repeat(80) + '\n';

            return new NextResponse(textReport, {
                headers: {
                    'Content-Type': 'text/plain',
                },
            });
        }

        return NextResponse.json(response);
    } catch (error) {
        console.error('Error fetching query performance metrics:', error);
        return NextResponse.json(
            {
                success: false,
                error: {
                    code: 'INTERNAL_ERROR',
                    message: 'Failed to fetch query performance metrics',
                    details: error instanceof Error ? error.message : 'Unknown error',
                },
            },
            { status: 500 }
        );
    }
}
