/**
 * Performance Baselines API
 * 
 * Endpoints for managing performance baselines and detecting regressions.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getConnectionPoolManager } from '@/lib/services/connection-pool-manager';
import { PerformanceBaselineManager } from '@/lib/services/performance-baseline-manager';
import { logger } from '@/lib/logger';

/**
 * GET /api/v1/admin/performance/baselines
 * Get all performance baselines
 */
export async function GET(_request: NextRequest) {
    try {
        const poolManager = getConnectionPoolManager();
        const pool = poolManager.getPool();
        const manager = new PerformanceBaselineManager(pool);

        const baselines = await manager.getAllBaselines();

        return NextResponse.json({
            success: true,
            data: {
                baselines,
                count: baselines.length,
            },
        });
    } catch (error) {
        logger.error('Failed to get performance baselines', { error });
        return NextResponse.json(
            {
                success: false,
                error: {
                    code: 'BASELINE_FETCH_ERROR',
                    message: 'Failed to retrieve performance baselines',
                },
            },
            { status: 500 }
        );
    }
}

/**
 * POST /api/v1/admin/performance/baselines
 * Establish new baseline or update existing
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { queryFingerprint, queryName, sql, params, isCritical } = body;

        if (!queryFingerprint || !queryName || !sql) {
            return NextResponse.json(
                {
                    success: false,
                    error: {
                        code: 'INVALID_INPUT',
                        message: 'Missing required fields: queryFingerprint, queryName, sql',
                    },
                },
                { status: 400 }
            );
        }

        const poolManager = getConnectionPoolManager();
        const pool = poolManager.getPool();
        const manager = new PerformanceBaselineManager(pool);

        const baseline = await manager.establishBaseline({
            queryFingerprint,
            queryName,
            sql,
            params: params || [],
            isCritical: isCritical || false,
        });

        return NextResponse.json({
            success: true,
            data: { baseline },
        });
    } catch (error) {
        logger.error('Failed to establish baseline', { error });
        return NextResponse.json(
            {
                success: false,
                error: {
                    code: 'BASELINE_ESTABLISH_ERROR',
                    message: 'Failed to establish performance baseline',
                },
            },
            { status: 500 }
        );
    }
}

/**
 * DELETE /api/v1/admin/performance/baselines
 * Delete a baseline
 */
export async function DELETE(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const queryFingerprint = searchParams.get('queryFingerprint');

        if (!queryFingerprint) {
            return NextResponse.json(
                {
                    success: false,
                    error: {
                        code: 'INVALID_INPUT',
                        message: 'Missing required parameter: queryFingerprint',
                    },
                },
                { status: 400 }
            );
        }

        const poolManager = getConnectionPoolManager();
        const pool = poolManager.getPool();
        const manager = new PerformanceBaselineManager(pool);

        await manager.deleteBaseline(queryFingerprint);

        return NextResponse.json({
            success: true,
            data: {
                message: 'Baseline deleted successfully',
            },
        });
    } catch (error) {
        logger.error('Failed to delete baseline', { error });
        return NextResponse.json(
            {
                success: false,
                error: {
                    code: 'BASELINE_DELETE_ERROR',
                    message: 'Failed to delete performance baseline',
                },
            },
            { status: 500 }
        );
    }
}
