/**
 * Cron Job: Cleanup Old Sync Logs
 * 
 * Runs daily at 1:30 AM UTC
 * Deletes sync logs based on retention policy:
 * - Successful syncs: >30 days
 * - Failed syncs: >90 days
 */

import { NextRequest, NextResponse } from 'next/server';
import { DataCleanupService } from '@/lib/services/data-cleanup';
import { logger } from '@/lib/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
    try {
        // Verify cron secret for security
        const authHeader = req.headers.get('authorization');
        const cronSecret = process.env.CRON_SECRET;

        if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
            logger.warn('Unauthorized cron job attempt', {
                job: 'cleanup-sync-logs',
                ip: req.headers.get('x-forwarded-for') || 'unknown',
            });
            return NextResponse.json(
                { error: 'Unauthorized' },
                { status: 401 }
            );
        }

        logger.info('Starting sync log cleanup cron job');

        const result = await DataCleanupService.cleanupOldSyncLogs();

        if (result.error) {
            logger.error('Sync log cleanup cron job failed', {
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

        logger.info('Sync log cleanup cron job completed', {
            deleted: result.deleted,
        });

        return NextResponse.json({
            success: true,
            deleted: result.deleted,
            timestamp: new Date().toISOString(),
        });
    } catch (error) {
        logger.error('Sync log cleanup cron job error', { error });
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
            },
            { status: 500 }
        );
    }
}
