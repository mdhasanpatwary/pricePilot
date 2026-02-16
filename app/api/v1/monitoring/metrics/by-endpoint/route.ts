/**
 * Monitoring Endpoint Metrics API Endpoint
 *
 * GET /api/v1/monitoring/metrics/by-endpoint
 *
 * Returns metric breakdown by API endpoint.
 *
 * Query Parameters:
 * - metricType: Type of metric (response_time, error)
 * - startTime: Start of time range (ISO 8601 timestamp)
 * - endTime: End of time range (ISO 8601 timestamp)
 * - tenantId: Optional tenant ID for filtering (super admin only)
 *
 * Authentication: Required (Admin role only)
 */

import { NextRequest, NextResponse } from 'next/server';
import { monitoringDashboardService } from '@/lib/services/monitoring/dashboard';
import { logger } from '@/lib/logger';
import { z } from 'zod';
import { getCachedSession } from "@/lib/auth/cached-session";
import { withRequestContextAndRateLimit } from "@/lib/middleware/with-request-context";

/**
 * Query parameter validation schema
 */
const metricsQuerySchema = z.object({
    metricType: z.enum([
        'error',
        'response_time',
    ]),
    startTime: z.string().datetime(),
    endTime: z.string().datetime(),
    tenantId: z.string().min(1).optional(),
});

/**
 * GET handler for endpoint metrics
 */
async function handleGET(req: NextRequest) {
    try {
        const session = await getCachedSession();

        if (!session?.user) {
            return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED' } }, { status: 401 });
        }

        const isAdmin = session.user.role === 'ADMIN' || session.user.isSuperAdmin === true;
        if (!isAdmin) {
            return NextResponse.json({ success: false, error: { code: 'FORBIDDEN' } }, { status: 403 });
        }

        const searchParams = req.nextUrl.searchParams;
        const result = metricsQuerySchema.safeParse({
            metricType: searchParams.get('metricType'),
            startTime: searchParams.get('startTime'),
            endTime: searchParams.get('endTime'),
            tenantId: searchParams.get('tenantId') || undefined,
        });

        if (!result.success) {
            return NextResponse.json({ success: false, error: { code: 'VALIDATION_ERROR', details: result.error } }, { status: 422 });
        }

        const { metricType, startTime, endTime, tenantId } = result.data;

        if (tenantId && !session.user.isSuperAdmin) {
            return NextResponse.json({ success: false, error: { code: 'FORBIDDEN' } }, { status: 403 });
        }

        const start = new Date(startTime);
        const end = new Date(endTime);

        const metrics = await monitoringDashboardService.getEndpointMetrics(
            metricType,
            { start, end, granularity: '5m' }, // Granularity ignored for aggregation
            tenantId
        );

        return NextResponse.json({
            success: true,
            data: metrics,
            meta: { timestamp: new Date().toISOString() }
        });
    } catch (error) {
        logger.error('Failed to get endpoint metrics', { error: String(error) });
        return NextResponse.json({ success: false, error: { code: 'INTERNAL_ERROR' } }, { status: 500 });
    }
}

export async function GET(req: NextRequest) {
    return withRequestContextAndRateLimit(req, 'read', () => handleGET(req));
}
