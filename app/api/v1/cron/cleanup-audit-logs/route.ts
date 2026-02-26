import { withRequestContextOnly } from '@/lib/middleware/with-request-context';
/**
 * Cron Job: Cleanup Old Audit Logs
 * 
 * Runs monthly on the 1st at 3:00 AM UTC
 * Deletes audit logs older than 2 years (non-critical)
 * Critical security events are kept for 5 years
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
                job: 'cleanup-audit-logs',
                ip: req.headers.get('x-forwarded-for') || 'unknown',
            });
            return NextResponse.json(
                { error: 'Unauthorized' },
                { status: 401 }
            );
        }

        logger.info('Starting audit log cleanup cron job');

        // Clean up standard audit logs (>2 years)
        const standardResult = await DataCleanupService.cleanupOldAuditLogs();

        // Clean up critical audit logs (>5 years)
        const criticalResult = await DataCleanupService.cleanupOldCriticalAuditLogs();

        const totalDeleted = standardResult.deleted + criticalResult.deleted;
        const errors = [];

        if (standardResult.error) {
            errors.push(`Standard logs: ${standardResult.error}`);
        }
        if (criticalResult.error) {
            errors.push(`Critical logs: ${criticalResult.error}`);
        }

        if (errors.length > 0) {
            logger.error('Audit log cleanup cron job completed with errors', {
                errors,
                standardDeleted: standardResult.deleted,
                criticalDeleted: criticalResult.deleted,
            });
            return NextResponse.json(
                {
                    success: false,
                    errors,
                    standardDeleted: standardResult.deleted,
                    criticalDeleted: criticalResult.deleted,
                    totalDeleted,
                },
                { status: 500 }
            );
        }

        logger.info('Audit log cleanup cron job completed', {
            standardDeleted: standardResult.deleted,
            criticalDeleted: criticalResult.deleted,
            totalDeleted,
        });

        return NextResponse.json({
            success: true,
            standardDeleted: standardResult.deleted,
            criticalDeleted: criticalResult.deleted,
            totalDeleted,
            timestamp: new Date().toISOString(),
        });
    } catch (error) {
        logger.error('Audit log cleanup cron job error', { error });
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
