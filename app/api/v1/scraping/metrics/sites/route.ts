/**
 * GET /api/v1/scraping/metrics/sites
 * 
 * Returns metrics for all competitor sites for the authenticated tenant.
 * Provides per-site success rates, attempt counts, response times, and status.
 * 
 * Requirements: 9.1, 9.2, 9.3, 9.6
 */

import { NextRequest, NextResponse } from 'next/server';
import { metricsCollector, TimeWindow } from '@/lib/services/bot-protection/metrics-collector';
import { getCachedSession } from "@/lib/auth/cached-session";

export async function GET(request: NextRequest) {
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

        // Get metrics summary which includes site metrics
        const summary = await metricsCollector.getMetricsSummary(tenantId, timeWindow);

        return NextResponse.json(
            {
                success: true,
                data: {
                    sites: summary.siteMetrics,
                    timeWindow,
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
