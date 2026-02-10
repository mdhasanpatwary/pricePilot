import { NextRequest, NextResponse } from 'next/server';
import { metricsAggregator } from '@/lib/services/metrics-aggregator';
import { prisma } from '@/lib/prisma';
import { getCachedSession } from "@/lib/auth/cached-session";
import { withRequestContextAndRateLimit } from "@/lib/middleware/with-request-context";

/**
 * GET /api/v1/admin/analytics/sites
 * Get site analytics including success rates, failure patterns, and performance metrics
 *
 * Query Parameters:
 * - timeRange: Time range for analytics (1h, 24h, 7d) - default: 24h
 * - limit: Number of top failing sites to return - default: 10
 * - siteUrl: Filter by specific site URL (optional)
 *
 * Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 13.1, 13.2
 */
async function handleGET(request: NextRequest) {
    try {
        // Authentication check
        const session = await getCachedSession();
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
        const siteUrl = searchParams.get('siteUrl') || undefined;

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

        // Get top failing sites
        const topFailures = await metricsAggregator.getTopFailures('sites', limit, timeRange);

        // Get site-specific analytics if siteUrl is provided
        let siteAnalytics = null;
        if (siteUrl) {
            const sessions = await prisma.scrapingSession.findMany({
                where: {
                    siteUrl,
                    startTime: { gte: startTime },
                },
                select: {
                    status: true,
                    startTime: true,
                    endTime: true,
                    challengeType: true,
                    errors: true,
                },
            });

            const totalSessions = sessions.length;
            const successfulSessions = sessions.filter(s => s.status === 'completed').length;
            const failedSessions = sessions.filter(s => s.status === 'failed').length;
            const challengedSessions = sessions.filter(s => s.challengeType !== null).length;

            // Calculate average session duration
            const sessionsWithDuration = sessions.filter(s => s.endTime);
            let avgDuration = 0;
            if (sessionsWithDuration.length > 0) {
                const totalDuration = sessionsWithDuration.reduce((sum, s) => {
                    if (s.endTime) {
                        return sum + (s.endTime.getTime() - s.startTime.getTime());
                    }
                    return sum;
                }, 0);
                avgDuration = totalDuration / sessionsWithDuration.length;
            }

            siteAnalytics = {
                siteUrl,
                totalSessions,
                successfulSessions,
                failedSessions,
                successRate: totalSessions > 0 ? successfulSessions / totalSessions : 0,
                failureRate: totalSessions > 0 ? failedSessions / totalSessions : 0,
                challengeRate: totalSessions > 0 ? challengedSessions / totalSessions : 0,
                avgDuration,
            };
        }

        // Get time-series data for site requests
        const timeSeriesData = await metricsAggregator.getTimeSeriesData('requests', timeRange);

        return NextResponse.json({
            success: true,
            data: {
                topFailures,
                siteAnalytics,
                timeSeries: timeSeriesData,
                timeRange,
            },
        });
    } catch (error) {
        console.error('[Site Analytics API] Error:', error);
        return NextResponse.json(
            {
                success: false,
                error: 'Failed to fetch site analytics',
                details: error instanceof Error ? error.message : 'Unknown error',
            },
            { status: 500 }
        );
    }
}


export async function GET(req: NextRequest) {
    return withRequestContextAndRateLimit(req, 'read', handleGET);
}
