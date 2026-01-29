/**
 * Performance Baseline Comparison API
 * 
 * Compare current performance against established baselines.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getOptimizedPrisma } from '@/lib/database/optimized-prisma';
import { PerformanceBaselineManager } from '@/lib/services/performance-baseline-manager';
import { logger } from '@/lib/logger';

/**
 * POST /api/v1/admin/performance/baselines/compare
 * Compare current performance against baseline
 */
export async function POST(request: NextRequest) {
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

        const { pool } = getOptimizedPrisma();
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
