import { NextRequest, NextResponse } from 'next/server';
import { withRequestContext } from '@/lib/cache/request-cache';
import { logger } from '@/lib/logger';
import { DistributedLockService, type CronJobType } from '@/lib/queue/distributed-lock';

/**
 * Middleware for Cron Jobs (v1: Basic auth only)
 *
 * 1. Establishes request context (caching)
 * 2. Verifies CRON_SECRET
 *
 * For distributed lock support, use withCronLock() instead.
 */
export async function withCronAuth(
    req: NextRequest,
    handler: (req: NextRequest) => Promise<NextResponse>
): Promise<NextResponse> {
    return withRequestContext(async () => {
        const authHeader = req.headers.get('authorization');
        const expectedAuth = `Bearer ${process.env.CRON_SECRET}`;

        if (!process.env.CRON_SECRET || authHeader !== expectedAuth) {
            logger.warn('Unauthorized cron attempt', {
                path: req.nextUrl.pathname,
                authHeader: authHeader ? 'present' : 'missing',
                secretConfigured: !!process.env.CRON_SECRET
            });

            return NextResponse.json(
                {
                    success: false,
                    error: {
                        code: 'UNAUTHORIZED',
                        message: 'Invalid cron secret',
                    },
                },
                { status: 401 }
            );
        }

        return handler(req);
    });
}

/**
 * Execute a cron job with distributed lock protection (Phase 3).
 *   - Verifies CRON_SECRET
 *   - Acquires distributed lock based on job type
 *   - Implements fail-closed/fail-soft based on criticality
 *
 * @param req Next.js request object
 * @param jobType CRITICAL = abort on lock failure, ANALYTICS/CLEANUP = skip
 * @param lockKey unique identifier for this cron job
 * @param handler job function that receives request and lock handle
 * @param ttlMs optional lock TTL (default 30 min)
 */
export async function withCronLock<T>(
    req: NextRequest,
    jobType: CronJobType,
    lockKey: string,
    handler: (req: NextRequest) => Promise<T>,
    ttlMs: number = 30 * 60 * 1000,
): Promise<NextResponse> {
    return withRequestContext(async () => {
        const authHeader = req.headers.get('authorization');
        const expectedAuth = `Bearer ${process.env.CRON_SECRET}`;

        if (!process.env.CRON_SECRET || authHeader !== expectedAuth) {
            logger.warn('[CronLock] Unauthorized cron attempt', {
                path: req.nextUrl.pathname,
                authHeader: authHeader ? 'present' : 'missing',
            });
            return NextResponse.json(
                {
                    success: false,
                    error: { code: 'UNAUTHORIZED', message: 'Invalid cron secret' },
                },
                { status: 401 }
            );
        }

        // attempt to acquire distributed lock
        try {
            const result = await DistributedLockService.executeWithLock(
                jobType,
                lockKey,
                async (_handle) => {
                    return handler(req);
                },
                { ttlMs },
            );

            // if result is null, job was skipped (ANALYTICS/CLEANUP couldn't acquire lock)
            if (result === null) {
                logger.info('[CronLock] Job skipped (lock unavailable)', { jobType, lockKey });
                return NextResponse.json(
                    {
                        success: false,
                        skipped: true,
                        message: `${jobType} cron job skipped due to lock unavailability`,
                    },
                    { status: 202 }
                );
            }

            // job completed successfully
            return result as NextResponse;
        } catch (lockError) {
            // lock error (typically CRITICAL job failing due to lock)
            logger.error('[CronLock] Distributed lock error', {
                jobType,
                lockKey,
                error: lockError instanceof Error ? lockError.message : String(lockError),
            });
            return NextResponse.json(
                {
                    success: false,
                    error: {
                        code: 'LOCK_ERROR',
                        message: `Cannot execute ${jobType} cron job: ${lockError instanceof Error ? lockError.message : String(lockError)}`,
                    },
                },
                { status: 503 }
            );
        }
    });
}
