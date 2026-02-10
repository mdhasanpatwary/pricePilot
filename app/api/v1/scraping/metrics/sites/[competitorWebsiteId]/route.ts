/**
 * GET /api/v1/scraping/metrics/sites/:competitorWebsiteId
 * 
 * Returns detailed metrics for a specific competitor site including
 * success rate, attempt counts, response times, protection type breakdown,
 * strategy breakdown, and recent attempt history.
 * 
 * Requirements: 9.1, 9.2, 9.3, 9.6
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { metricsCollector, TimeWindow } from '@/lib/services/bot-protection/metrics-collector';
import { getCachedSession } from "@/lib/auth/cached-session";

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ competitorWebsiteId: string }> }
) {
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
                        message: 'Tenant context required',
                    },
                },
                { status: 403 }
            );
        }

        const { competitorWebsiteId } = await params;

        // Verify the competitor website belongs to this tenant
        const site = await prisma.site.findFirst({
            where: {
                id: competitorWebsiteId,
                tenantId,
                type: 'COMPETITOR',
            },
            select: {
                id: true,
                baseUrl: true,
            },
        });

        if (!site) {
            return NextResponse.json(
                {
                    success: false,
                    error: {
                        code: 'NOT_FOUND',
                        message: 'Competitor website not found',
                    },
                },
                { status: 404 }
            );
        }

        // Parse query parameters
        const searchParams = request.nextUrl.searchParams;
        const timeWindowParam = searchParams.get('timeWindow') || 'last_24_hours';

        // Validate time window
        const validTimeWindows = Object.values(TimeWindow);
        if (!validTimeWindows.includes(timeWindowParam as TimeWindow)) {
            return NextResponse.json(
                {
                    success: false,
                    error: {
                        code: 'INVALID_TIME_WINDOW',
                        message: `Invalid time window. Must be one of: ${validTimeWindows.join(', ')}`,
                    },
                },
                { status: 400 }
            );
        }

        const timeWindow = timeWindowParam as TimeWindow;

        // Calculate start date for time window
        const startDate = getStartDateForWindow(timeWindow);

        // Get all attempts for this site in the time window
        const attempts = await prisma.scrapeAttempt.findMany({
            where: {
                competitorWebsiteId,
                createdAt: {
                    gte: startDate,
                },
            },
            select: {
                success: true,
                protectionType: true,
                strategy: true,
                responseTimeMs: true,
                createdAt: true,
            },
            orderBy: {
                createdAt: 'desc',
            },
        });

        const totalAttempts = attempts.length;
        const successfulAttempts = attempts.filter((a) => a.success).length;
        const failedAttempts = totalAttempts - successfulAttempts;
        const successRate = totalAttempts > 0 ? (successfulAttempts / totalAttempts) * 100 : 0;

        // Calculate average response time
        const totalResponseTime = attempts.reduce((sum, a) => sum + (a.responseTimeMs || 0), 0);
        const averageResponseTime = totalAttempts > 0 ? totalResponseTime / totalAttempts : 0;

        // Build protection type breakdown
        const protectionTypeBreakdown: Record<string, number> = {};
        attempts.forEach((attempt) => {
            if (attempt.protectionType) {
                protectionTypeBreakdown[attempt.protectionType] =
                    (protectionTypeBreakdown[attempt.protectionType] || 0) + 1;
            }
        });

        // Build strategy breakdown
        const strategyBreakdown: Record<string, number> = {};
        attempts.forEach((attempt) => {
            strategyBreakdown[attempt.strategy] = (strategyBreakdown[attempt.strategy] || 0) + 1;
        });

        // Find last success and failure
        const lastSuccess = attempts.find((a) => a.success)?.createdAt;
        const lastFailure = attempts.find((a) => !a.success)?.createdAt;

        // Determine current status
        let currentStatus: 'healthy' | 'degraded' | 'blocked';
        if (successRate >= 80) {
            currentStatus = 'healthy';
        } else if (successRate >= 50) {
            currentStatus = 'degraded';
        } else {
            currentStatus = 'blocked';
        }

        // Get success rates for different time windows for trend analysis
        const hourlySuccessRate = await metricsCollector.getSuccessRate(
            competitorWebsiteId,
            TimeWindow.LAST_HOUR
        );
        const dailySuccessRate = await metricsCollector.getSuccessRate(
            competitorWebsiteId,
            TimeWindow.LAST_24_HOURS
        );
        const weeklySuccessRate = await metricsCollector.getSuccessRate(
            competitorWebsiteId,
            TimeWindow.LAST_7_DAYS
        );

        return NextResponse.json(
            {
                success: true,
                data: {
                    competitorWebsiteId: site.id,
                    siteName: site.baseUrl,
                    timeWindow,
                    metrics: {
                        totalAttempts,
                        successfulAttempts,
                        failedAttempts,
                        successRate,
                        averageResponseTime,
                        currentStatus,
                        lastSuccess,
                        lastFailure,
                    },
                    breakdowns: {
                        protectionTypes: protectionTypeBreakdown,
                        strategies: strategyBreakdown,
                    },
                    trends: {
                        hourly: hourlySuccessRate,
                        daily: dailySuccessRate,
                        weekly: weeklySuccessRate,
                    },
                },
                meta: {
                    requestId: crypto.randomUUID(),
                    timestamp: new Date().toISOString(),
                },
            },
            { status: 200 }
        );
    } catch (error) {
        console.error('Failed to get site metrics:', error);
        return NextResponse.json(
            {
                success: false,
                error: {
                    code: 'INTERNAL_ERROR',
                    message: 'Failed to retrieve site metrics',
                    details: error instanceof Error ? error.message : 'Unknown error',
                },
            },
            { status: 500 }
        );
    }
}

/**
 * Helper function to get start date for a time window
 */
function getStartDateForWindow(timeWindow: TimeWindow): Date {
    const now = new Date();
    switch (timeWindow) {
        case TimeWindow.LAST_HOUR:
            return new Date(now.getTime() - 60 * 60 * 1000);
        case TimeWindow.LAST_24_HOURS:
            return new Date(now.getTime() - 24 * 60 * 60 * 1000);
        case TimeWindow.LAST_7_DAYS:
            return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        case TimeWindow.LAST_30_DAYS:
            return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        default:
            return new Date(now.getTime() - 24 * 60 * 60 * 1000);
    }
}
