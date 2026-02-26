/**
 * Performance Baseline Comparison API
 *
 * Compare current performance against established baselines.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getConnectionPoolManager } from '@/lib/services/connection-pool-manager';
import { PerformanceBaselineManager } from '@/lib/services/performance-baseline-manager';
import { logger } from '@/lib/logger';
import { withRequestContextAndRateLimit } from '@/lib/middleware/with-request-context';

async function handlePOST(request: NextRequest) {

/**
 * POST /api/v1/admin/performance/baselines/compare
 * Compare current performance against baseline
 */
    try {
        const body = await request.json();
        const { queryFingerprint, sql, params } = body;

        if (!queryFingerprint || !sql) {
            return NextResponse.json(
                {
                    success: false,
                    error: {
                        code: 'INVALID_INPUT',
                        message: 'Missing required fields: queryFingerprint, sql',
                    },
                },
                { status: 400 }
            );
        }

        const poolManager = getConnectionPoolManager();
        const pool = poolManager.getPool();
        const manager = new PerformanceBaselineManager(pool);

        const comparison = await manager.compareAgainstBaseline(
            queryFingerprint,
            sql,
            params || []
        );

        if (!comparison) {
            return NextResponse.json(
                {
                    success: false,
                    error: {
                        code: 'BASELINE_NOT_FOUND',
                        message: `No baseline found for query: ${queryFingerprint}`,
                    },
                },
                { status: 404 }
            );
        }

        return NextResponse.json({
            success: true,
            data: {
                comparison,
                status: comparison.isRegression ? 'regression' : 'ok',
            },
        });
    } catch (error) {
        logger.error('Failed to compare against baseline', { error });
        return NextResponse.json(
            {
                success: false,
                error: {
                    code: 'COMPARISON_ERROR',
                    message: 'Failed to compare performance against baseline',
                },
            },
            { status: 500 }
        );
    }
}

export async function POST(req: NextRequest) {
    return withRequestContextAndRateLimit(req, "write", handlePOST);
}
