import { withRequestContextOnly } from '@/lib/middleware/with-request-context';
/**
 * Cron Job: Cleanup Old Bulk Operation Snapshots
 * 
 * Runs weekly on Sundays at 4:00 AM UTC
 * Deletes bulk snapshots based on retention policy:
 * - Normal snapshots: >90 days
 * - Rolled back snapshots: >180 days
 */

import { NextRequest, NextResponse } from 'next/server';
import { DataCleanupService } from '@/lib/services/data-cleanup';
import { logger } from '@/lib/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function handleGET(req: NextRequest) {
    try {
        // Verify cron secret for security
        const authHeader = req.headers.get('authorization');
        const cronSecret = process.env.CRON_SECRET;

        if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
            logger.warn('Unauthorized cron job attempt', {
                job: 'cleanup-bulk-snapshots',
                ip: req.headers.get('x-forwarded-for') || 'unknown',
            });
            return NextResponse.json(
                { error: 'Unauthorized' },
                { status: 401 }
            );
        }

        logger.info('Starting bulk snapshot cleanup cron job');

        const result = await DataCleanupService.cleanupOldBulkSnapshots();

        if (result.error) {
            logger.error('Bulk snapshot cleanup cron job failed', {
                error: result.error,
            });
            return NextResponse.json(
                {
                    success: false,
                    error: result.error,
                    deleted: result.deleted,
                },
                { status: 500 }
            );
        }

        logger.info('Bulk snapshot cleanup cron job completed', {
            deleted: result.deleted,
        });

        return NextResponse.json({
            success: true,
            deleted: result.deleted,
            timestamp: new Date().toISOString(),
        });
    } catch (error) {
        logger.error('Bulk snapshot cleanup cron job error', { error });
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
            },
            { status: 500 }
        );
    }
}

export async function GET(req: NextRequest) {
    return withRequestContextOnly(req, handleGET);
}
