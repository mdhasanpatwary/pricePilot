/**
 * Documentation Monitoring API
 * 
 * Provides access to documentation system logs and error metrics.
 * Admin-only endpoint for monitoring system health.
 */

import { NextRequest, NextResponse } from 'next/server';
import { documentationMonitor, LogCategory, LogLevel } from '@/lib/documentation/monitoring';
import { getCachedSession } from "@/lib/auth/cached-session";
import { withRequestContextAndRateLimit } from "@/lib/middleware/with-request-context";

async function handleGET(request: NextRequest) {
    try {
        // Check authentication
        const session = await getCachedSession();
        if (!session?.user) {
            return NextResponse.json(
                { error: 'Unauthorized' },
                { status: 401 }
            );
        }

        // Check admin role
        const user = session.user as any;
        if (user.role !== 'ADMIN' && !user.isSuperAdmin) {
            return NextResponse.json(
                { error: 'Forbidden - Admin access required' },
                { status: 403 }
            );
        }

        // Parse query parameters
        const searchParams = request.nextUrl.searchParams;
        const action = searchParams.get('action') || 'logs';
        const category = searchParams.get('category') as LogCategory | undefined;
        const level = searchParams.get('level') as LogLevel | undefined;
        const limit = parseInt(searchParams.get('limit') || '100');
        const timeWindowHours = parseInt(searchParams.get('timeWindow') || '24');

        switch (action) {
            case 'logs':
                // Get recent logs
                const logs = await documentationMonitor.getRecentLogs(limit, category, level);
                return NextResponse.json({
                    success: true,
                    data: {
                        logs,
                        count: logs.length,
                        filters: { category, level, limit },
                    },
                });

            case 'errors':
                // Get error metrics
                const errorMetrics = await documentationMonitor.getAllErrorMetrics(timeWindowHours);
                return NextResponse.json({
                    success: true,
                    data: {
                        metrics: errorMetrics,
                        timeWindowHours,
                    },
                });

            case 'error-by-category':
                // Get error metrics for specific category
                if (!category) {
                    return NextResponse.json(
                        { error: 'Category parameter required' },
                        { status: 400 }
                    );
                }
                const categoryMetrics = await documentationMonitor.getErrorMetrics(
                    category,
                    timeWindowHours
                );
                return NextResponse.json({
                    success: true,
                    data: {
                        category,
                        metrics: categoryMetrics,
                        timeWindowHours,
                    },
                });

            case 'clear-old':
                // Clear old logs (admin only)
                const daysToKeep = parseInt(searchParams.get('daysToKeep') || '90');
                const deletedCount = await documentationMonitor.clearOldLogs(daysToKeep);
                return NextResponse.json({
                    success: true,
                    data: {
                        deletedCount,
                        daysToKeep,
                    },
                });

            default:
                return NextResponse.json(
                    { error: 'Invalid action parameter' },
                    { status: 400 }
                );
        }
    } catch (error) {
        console.error('Monitoring API error:', error);
        return NextResponse.json(
            {
                success: false,
                error: 'Internal server error',
                message: error instanceof Error ? error.message : 'Unknown error',
            },
            { status: 500 }
        );
    }
}

export async function GET(request: NextRequest) {
    return withRequestContextAndRateLimit(request, 'read', handleGET);
}
