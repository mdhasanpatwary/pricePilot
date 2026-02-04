/**
 * Cron Job: Cleanup Old Notifications
 * 
 * Runs daily at 1:00 AM UTC
 * Deletes notifications based on retention policy:
 * - Read notifications: >90 days
 * - Unread notifications: >180 days
 * - Critical notifications: >365 days
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
                job: 'cleanup-notifications',
                ip: req.headers.get('x-forwarded-for') || 'unknown',
            });
            return NextResponse.json(
                { error: 'Unauthorized' },
                { status: 401 }
            );
        }

        logger.info('Starting notification cleanup cron job');

        const result = await DataCleanupService.cleanupOldNotifications();

        if (result.error) {
            logger.error('Notification cleanup cron job failed', {
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

        logger.info('Notification cleanup cron job completed', {
            deleted: result.deleted,
        });

        return NextResponse.json({
            success: true,
            deleted: result.deleted,
            timestamp: new Date().toISOString(),
        });
    } catch (error) {
        logger.error('Notification cleanup cron job error', { error });
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
            },
            { status: 500 }
        );
    }
}
