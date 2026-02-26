/**
 * Performance Regressions API
 *
 * Endpoints for viewing and managing performance regressions.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getConnectionPoolManager } from '@/lib/services/connection-pool-manager';
import { PerformanceBaselineManager } from '@/lib/services/performance-baseline-manager';
import { logger } from '@/lib/logger';
import { withRequestContextAndRateLimit } from '@/lib/middleware/with-request-context';

async function handleGET(request: NextRequest) {

/**
 * GET /api/v1/admin/performance/regressions
 * Get recent performance regressions
 */
    try {
        const { searchParams } = new URL(request.url);
        const limit = parseInt(searchParams.get('limit') || '10', 10);

        const poolManager = getConnectionPoolManager();
        const pool = poolManager.getPool();
        const manager = new PerformanceBaselineManager(pool);

        const regressions = await manager.getRecentRegressions(limit);

        return NextResponse.json({
            success: true,
            data: {
                regressions,
                count: regressions.length,
            },
        });
    } catch (error) {
        logger.error('Failed to get performance regressions', { error });
        return NextResponse.json(
            {
                success: false,
                error: {
                    code: 'REGRESSION_FETCH_ERROR',
                    message: 'Failed to retrieve performance regressions',
                },
            },
            { status: 500 }
        );
    }
}

export async function GET(req: NextRequest) {
    return withRequestContextAndRateLimit(req, "read", handleGET);
}
