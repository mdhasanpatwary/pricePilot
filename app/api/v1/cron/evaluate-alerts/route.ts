/**
 * Alert Evaluation Cron Job
 * 
 * Scheduled task that evaluates all enabled alert rules and triggers notifications
 * for alerts that meet their conditions. Implements distributed locking to prevent
 * duplicate evaluations in multi-instance deployments.
 * 
 * Features:
 * - Evaluates all enabled alert rules
 * - Checks deduplication before sending notifications
 * - Triggers notifications for alerts that meet conditions
 * - Logs evaluation results
 * - Distributed locking for multi-instance safety
 * 
 * Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7
 * 
 * @module app/api/v1/cron/evaluate-alerts
 */

import { NextRequest, NextResponse } from "next/server";
import { Redis } from '@upstash/redis';
import { alertRulesEvaluator } from '@/lib/services/monitoring/alert-rules-evaluator';
import { alertDeduplicationManager } from '@/lib/services/monitoring/alert-deduplication';
import { notificationRouter } from '@/lib/services/monitoring/notification-router';
import { logger } from '@/lib/logger';

export const maxDuration = 300; // 5 minutes max duration for Vercel functions
export const dynamic = 'force-dynamic';

// Distributed lock configuration
const LOCK_KEY = 'cron:evaluate-alerts:lock';
const LOCK_TTL = 60; // 1 minute lock TTL

/**
 * GET handler for alert evaluation cron job
 * 
 * This endpoint should be called by a cron scheduler (e.g., Vercel Cron, external cron service)
 * at regular intervals (recommended: every 1 minute for critical rules, every 5 minutes for warnings)
 * 
 * Note: Cron jobs don't need rate limiting as they're authenticated via CRON_SECRET
 * and called by Vercel's cron scheduler, not by users
 */
export async function GET(req: NextRequest) {
    // Verify cron secret for security
    const authHeader = req.headers.get("authorization");
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return NextResponse.json(
            { success: false, error: "Unauthorized" },
            { status: 401 }
        );
    }

    const startTime = Date.now();

    logger.info('[Cron] Starting alert evaluation');

    try {
        // Initialize Redis for distributed locking
        const redis = process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
            ? new Redis({
                url: process.env.UPSTASH_REDIS_REST_URL,
                token: process.env.UPSTASH_REDIS_REST_TOKEN,
            })
            : null;

        // Acquire distributed lock to prevent duplicate evaluations
        const lockAcquired = await acquireDistributedLock(redis);

        if (!lockAcquired) {
            logger.info('[Cron] Another instance is already evaluating alerts, skipping');
            return NextResponse.json({
                success: true,
                message: 'Alert evaluation already in progress by another instance',
                skipped: true,
            });
        }

        try {
            // Step 1: Evaluate all enabled alert rules
            logger.info('[Cron] Evaluating alert rules');
            const triggeredAlerts = await alertRulesEvaluator.evaluateRules();

            logger.info(`[Cron] Evaluation complete: ${triggeredAlerts.length} alerts triggered`);

            // Step 2: Check for recently resolved alerts and send resolution notifications
            logger.info('[Cron] Checking for resolved alerts');
            const resolvedAlerts = await alertRulesEvaluator.getRecentlyResolvedAlerts(5); // Last 5 minutes

            logger.info(`[Cron] Found ${resolvedAlerts.length} recently resolved alerts`);

            // Step 3: Process each triggered alert
            let sentCount = 0;
            let suppressedCount = 0;
            let failedCount = 0;
            let resolvedCount = 0;

            // Process triggered alerts
            for (const alert of triggeredAlerts) {
                try {
                    // Check if alert should be sent (deduplication + maintenance window)
                    const shouldSend = await alertDeduplicationManager.shouldSendAlert(alert);

                    if (!shouldSend) {
                        logger.info('[Cron] Alert suppressed by deduplication or maintenance window', {
                            ruleId: alert.ruleId,
                            ruleName: alert.ruleName,
                        });
                        suppressedCount++;
                        continue;
                    }

                    // Get notification channels from the alert rule
                    const channels = await getAlertNotificationChannels(alert.ruleId);

                    if (channels.length === 0) {
                        logger.warn('[Cron] No notification channels configured for alert', {
                            ruleId: alert.ruleId,
                            ruleName: alert.ruleName,
                        });
                        failedCount++;
                        continue;
                    }

                    // Send notifications
                    logger.info('[Cron] Sending notifications for alert', {
                        ruleId: alert.ruleId,
                        ruleName: alert.ruleName,
                        channelCount: channels.length,
                    });

                    const results = await notificationRouter.sendNotification(alert, channels);

                    // Check if at least one notification was successful
                    const anySuccess = results.some(r => r.success);

                    if (anySuccess) {
                        // Record that alert was sent
                        await alertDeduplicationManager.recordAlertSent(alert);
                        sentCount++;

                        logger.info('[Cron] Alert notifications sent successfully', {
                            ruleId: alert.ruleId,
                            ruleName: alert.ruleName,
                            successCount: results.filter(r => r.success).length,
                            totalChannels: results.length,
                        });
                    } else {
                        logger.error('[Cron] All notification channels failed for alert', {
                            ruleId: alert.ruleId,
                            ruleName: alert.ruleName,
                        });
                        failedCount++;
                    }
                } catch (error) {
                    logger.error('[Cron] Failed to process alert', {
                        error: error instanceof Error ? error.message : String(error),
                        ruleId: alert.ruleId,
                        ruleName: alert.ruleName,
                    });
                    failedCount++;
                }
            }

            // Process resolved alerts
            for (const resolvedAlert of resolvedAlerts) {
                try {
                    // Get notification channels from the alert rule
                    const channels = await getAlertNotificationChannels(resolvedAlert.ruleId);

                    if (channels.length === 0) {
                        logger.warn('[Cron] No notification channels configured for resolved alert', {
                            ruleId: resolvedAlert.ruleId,
                            ruleName: resolvedAlert.ruleName,
                        });
                        continue;
                    }

                    // Send resolution notifications
                    logger.info('[Cron] Sending resolution notifications', {
                        ruleId: resolvedAlert.ruleId,
                        ruleName: resolvedAlert.ruleName,
                        channelCount: channels.length,
                    });

                    const results = await notificationRouter.sendNotification(resolvedAlert, channels);

                    // Check if at least one notification was successful
                    const anySuccess = results.some(r => r.success);

                    if (anySuccess) {
                        resolvedCount++;

                        logger.info('[Cron] Resolution notifications sent successfully', {
                            ruleId: resolvedAlert.ruleId,
                            ruleName: resolvedAlert.ruleName,
                            successCount: results.filter(r => r.success).length,
                            totalChannels: results.length,
                        });
                    } else {
                        logger.error('[Cron] All notification channels failed for resolution', {
                            ruleId: resolvedAlert.ruleId,
                            ruleName: resolvedAlert.ruleName,
                        });
                    }
                } catch (error) {
                    logger.error('[Cron] Failed to process resolved alert', {
                        error: error instanceof Error ? error.message : String(error),
                        ruleId: resolvedAlert.ruleId,
                        ruleName: resolvedAlert.ruleName,
                    });
                }
            }

            const duration = Date.now() - startTime;

            logger.info('[Cron] Alert evaluation complete', {
                duration: `${duration}ms`,
                triggered: triggeredAlerts.length,
                sent: sentCount,
                suppressed: suppressedCount,
                failed: failedCount,
                resolved: resolvedCount,
            });

            return NextResponse.json({
                success: true,
                message: 'Alert evaluation complete',
                stats: {
                    duration,
                    triggered: triggeredAlerts.length,
                    sent: sentCount,
                    suppressed: suppressedCount,
                    failed: failedCount,
                    resolved: resolvedCount,
                },
            });
        } finally {
            // Release distributed lock
            await releaseDistributedLock(redis);
        }
    } catch (error) {
        const duration = Date.now() - startTime;

        logger.error('[Cron] Alert evaluation failed', {
            error: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined,
            duration: `${duration}ms`,
        });

        return NextResponse.json(
            {
                success: false,
                error: 'Alert evaluation failed',
                message: error instanceof Error ? error.message : String(error),
            },
            { status: 500 }
        );
    }
}

/**
 * Acquire distributed lock to prevent duplicate evaluations
 * 
 * Uses Redis SET NX (set if not exists) with TTL for distributed locking.
 * This ensures only one instance evaluates alerts at a time.
 * 
 * @param redis - Redis client instance
 * @returns True if lock acquired, false otherwise
 */
async function acquireDistributedLock(redis: Redis | null): Promise<boolean> {
    try {
        if (!redis) {
            // If Redis is unavailable, allow evaluation (fail open)
            logger.warn('[Cron] Redis unavailable, proceeding without distributed lock');
            return true;
        }

        // Try to acquire lock using SET NX with TTL
        const lockValue = `${Date.now()}-${Math.random()}`;
        const result = await redis.set(LOCK_KEY, lockValue, {
            nx: true, // Only set if key doesn't exist
            ex: LOCK_TTL, // Expire after TTL seconds
        });

        if (result === 'OK') {
            logger.info('[Cron] Distributed lock acquired', {
                lockKey: LOCK_KEY,
                ttl: LOCK_TTL,
            });
            return true;
        }

        logger.info('[Cron] Failed to acquire distributed lock (already held by another instance)');
        return false;
    } catch (error) {
        // On error, fail open (allow evaluation)
        logger.error('[Cron] Error acquiring distributed lock, proceeding anyway', {
            error: error instanceof Error ? error.message : String(error),
        });
        return true;
    }
}

/**
 * Release distributed lock
 * 
 * @param redis - Redis client instance
 */
async function releaseDistributedLock(redis: Redis | null): Promise<void> {
    try {
        if (!redis) {
            return;
        }

        await redis.del(LOCK_KEY);

        logger.info('[Cron] Distributed lock released', {
            lockKey: LOCK_KEY,
        });
    } catch (error) {
        logger.error('[Cron] Error releasing distributed lock', {
            error: error instanceof Error ? error.message : String(error),
        });
    }
}

/**
 * Get notification channels for an alert rule
 * 
 * @param ruleId - Alert rule ID
 * @returns Array of channel IDs
 */
async function getAlertNotificationChannels(ruleId: string): Promise<string[]> {
    try {
        const { prisma } = await import('@/lib/prisma');

        const rule = await prisma.monitoringAlertRule.findUnique({
            where: { id: ruleId },
            select: { notificationChannels: true },
        });

        if (!rule) {
            logger.warn('[Cron] Alert rule not found', { ruleId });
            return [];
        }

        return rule.notificationChannels;
    } catch (error) {
        logger.error('[Cron] Failed to get notification channels', {
            error: error instanceof Error ? error.message : String(error),
            ruleId,
        });
        return [];
    }
}
