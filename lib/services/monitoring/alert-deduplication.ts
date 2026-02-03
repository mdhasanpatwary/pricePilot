/**
 * Alert Deduplication Manager Service
 * 
 * Prevents duplicate alerts and manages alert lifecycle using Redis for state tracking.
 * Implements 15-minute deduplication windows and maintenance window checking.
 * 
 * Features:
 * - Alert fingerprint generation (ruleId + tenantId + metricType)
 * - Redis-based deduplication with 15-minute TTL
 * - Alert state tracking (triggered, sent, resolved)
 * - Maintenance window checking
 * - Alert grouping for related alerts
 * 
 * Requirements: 8.1, 8.2, 8.3, 8.4, 7.4
 * 
 * @module lib/services/monitoring/alert-deduplication
 */

import { Redis } from '@upstash/redis';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import type { TriggeredAlert } from './alert-rules-evaluator';

/**
 * Alert state enumeration
 */
export enum AlertState {
    TRIGGERED = 'triggered',
    SENT = 'sent',
    RESOLVED = 'resolved',
}

/**
 * Alert state record stored in Redis
 */
export interface AlertStateRecord {
    ruleId: string;
    fingerprint: string;
    state: AlertState;
    triggeredAt: number;
    sentAt?: number;
    resolvedAt?: number;
    metricValue: number;
    notificationsSent: string[];
}

/**
 * Alert Deduplication Manager Interface
 */
export interface IAlertDeduplicationManager {
    shouldSendAlert(alert: TriggeredAlert): Promise<boolean>;
    recordAlertSent(alert: TriggeredAlert): Promise<void>;
    recordAlertResolved(ruleId: string, tenantId?: string | null): Promise<void>;
    isInMaintenanceWindow(): Promise<boolean>;
}

/**
 * Alert Deduplication Manager Implementation
 */
export class AlertDeduplicationManager implements IAlertDeduplicationManager {
    private redis: Redis | null;
    private readonly DEDUPLICATION_TTL = 15 * 60; // 15 minutes in seconds
    private readonly KEY_PREFIX = 'alert:state';

    constructor(redis?: Redis | null) {
        // Allow Redis injection for testing, otherwise initialize from environment
        if (redis !== undefined) {
            this.redis = redis;
        } else {
            // Initialize Redis client if configured
            this.redis =
                process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
                    ? new Redis({
                        url: process.env.UPSTASH_REDIS_REST_URL,
                        token: process.env.UPSTASH_REDIS_REST_TOKEN,
                    })
                    : null;
        }
    }

    /**
     * Check if an alert should be sent based on deduplication rules
     * 
     * Requirements:
     * - 8.1: Only one notification per 15-minute window for same alert
     * - 7.4: Suppress alerts during maintenance windows
     * 
     * @param alert - The triggered alert to check
     * @returns True if alert should be sent, false if it should be suppressed
     */
    async shouldSendAlert(alert: TriggeredAlert): Promise<boolean> {
        try {
            // Check if we're in a maintenance window (Requirement 7.4)
            const inMaintenanceWindow = await this.isInMaintenanceWindow();
            if (inMaintenanceWindow) {
                logger.info('Alert suppressed due to maintenance window', {
                    ruleId: alert.ruleId,
                    ruleName: alert.ruleName,
                });
                return false;
            }

            // If Redis is not available, allow the alert (fail open)
            if (!this.redis) {
                logger.warn('Redis unavailable, allowing alert without deduplication', {
                    ruleId: alert.ruleId,
                });
                return true;
            }

            // Generate fingerprint for this alert (Requirement 8.1)
            const fingerprint = this.generateFingerprint(alert);
            const key = this.buildKey(alert.ruleId, fingerprint);

            // Check if alert was recently sent
            const existingState = await this.getAlertState(key);

            if (existingState) {
                // Alert exists and was sent within the deduplication window
                if (existingState.state === AlertState.SENT) {
                    logger.info('Alert suppressed due to deduplication', {
                        ruleId: alert.ruleId,
                        ruleName: alert.ruleName,
                        fingerprint,
                        lastSentAt: existingState.sentAt,
                    });
                    return false;
                }

                // Alert was triggered but not yet sent - allow it
                if (existingState.state === AlertState.TRIGGERED) {
                    return true;
                }

                // Alert was resolved - allow new trigger
                if (existingState.state === AlertState.RESOLVED) {
                    return true;
                }
            }

            // No existing state or state expired - allow the alert
            return true;
        } catch (error) {
            // On error, fail open (allow alert to be sent)
            logger.error('Error checking alert deduplication, allowing alert', {
                error: error instanceof Error ? error.message : String(error),
                ruleId: alert.ruleId,
            });
            return true;
        }
    }

    /**
     * Record that an alert has been sent
     * 
     * Requirement 8.1: Track alert state to prevent duplicates
     * 
     * @param alert - The alert that was sent
     */
    async recordAlertSent(alert: TriggeredAlert): Promise<void> {
        try {
            if (!this.redis) {
                logger.warn('Redis unavailable, cannot record alert sent state');
                return;
            }

            const fingerprint = this.generateFingerprint(alert);
            const key = this.buildKey(alert.ruleId, fingerprint);

            const stateRecord: AlertStateRecord = {
                ruleId: alert.ruleId,
                fingerprint,
                state: AlertState.SENT,
                triggeredAt: alert.triggeredAt.getTime(),
                sentAt: Date.now(),
                metricValue: alert.metricValue,
                notificationsSent: [], // Will be populated by notification router
            };

            // Store state with TTL
            await this.redis.setex(
                key,
                this.DEDUPLICATION_TTL,
                JSON.stringify(stateRecord)
            );

            logger.info('Recorded alert sent state', {
                ruleId: alert.ruleId,
                fingerprint,
                ttl: this.DEDUPLICATION_TTL,
            });
        } catch (error) {
            logger.error('Failed to record alert sent state', {
                error: error instanceof Error ? error.message : String(error),
                ruleId: alert.ruleId,
            });
        }
    }

    /**
     * Record that an alert condition has been resolved
     * 
     * Requirement 8.2: Send resolution notification when condition clears
     * 
     * @param ruleId - The rule ID that was resolved
     * @param tenantId - Optional tenant ID for tenant-specific rules
     */
    async recordAlertResolved(
        ruleId: string,
        tenantId?: string | null
    ): Promise<void> {
        try {
            if (!this.redis) {
                logger.warn('Redis unavailable, cannot record alert resolved state');
                return;
            }

            // Generate fingerprint for resolution
            const fingerprint = this.generateFingerprintFromIds(ruleId, tenantId);
            const key = this.buildKey(ruleId, fingerprint);

            // Get existing state
            const existingState = await this.getAlertState(key);

            if (existingState && existingState.state === AlertState.SENT) {
                // Update state to resolved
                const stateRecord: AlertStateRecord = {
                    ...existingState,
                    state: AlertState.RESOLVED,
                    resolvedAt: Date.now(),
                };

                // Store resolved state with shorter TTL (1 hour)
                await this.redis.setex(
                    key,
                    60 * 60, // 1 hour
                    JSON.stringify(stateRecord)
                );

                logger.info('Recorded alert resolved state', {
                    ruleId,
                    fingerprint,
                });
            }
        } catch (error) {
            logger.error('Failed to record alert resolved state', {
                error: error instanceof Error ? error.message : String(error),
                ruleId,
            });
        }
    }

    /**
     * Check if system is currently in a maintenance window
     * 
     * Requirement 7.4: Suppress alerts during maintenance windows
     * 
     * @returns True if in maintenance window, false otherwise
     */
    async isInMaintenanceWindow(): Promise<boolean> {
        try {
            const now = new Date();

            // Query for active maintenance windows that overlap with current time
            const activeWindow = await prisma.monitoringMaintenanceWindow.findFirst({
                where: {
                    isActive: true,
                    startTime: {
                        lte: now,
                    },
                    endTime: {
                        gte: now,
                    },
                },
            });

            if (activeWindow) {
                logger.info('System is in maintenance window', {
                    windowId: activeWindow.id,
                    windowName: activeWindow.name,
                    startTime: activeWindow.startTime,
                    endTime: activeWindow.endTime,
                });
                return true;
            }

            return false;
        } catch (error) {
            // On error, fail open (don't suppress alerts)
            logger.error('Error checking maintenance window, allowing alerts', {
                error: error instanceof Error ? error.message : String(error),
            });
            return false;
        }
    }

    /**
     * Generate alert fingerprint for deduplication
     * 
     * Requirement 8.1: Generate fingerprint from ruleId + tenantId + metricType
     * 
     * @param alert - The triggered alert
     * @returns Fingerprint string
     */
    private generateFingerprint(alert: TriggeredAlert): string {
        const parts = [
            alert.ruleId,
            alert.tenantId || 'system',
            alert.context.metricType || 'unknown',
        ];

        return parts.join(':');
    }

    /**
     * Generate fingerprint from IDs only (for resolution)
     * 
     * @param ruleId - Rule ID
     * @param tenantId - Optional tenant ID
     * @returns Fingerprint string
     */
    private generateFingerprintFromIds(
        ruleId: string,
        tenantId?: string | null
    ): string {
        const parts = [
            ruleId,
            tenantId || 'system',
            'unknown', // Metric type not available for resolution
        ];

        return parts.join(':');
    }

    /**
     * Build Redis key for alert state
     * 
     * @param ruleId - Rule ID
     * @param fingerprint - Alert fingerprint
     * @returns Redis key string
     */
    private buildKey(ruleId: string, fingerprint: string): string {
        return `${this.KEY_PREFIX}:${ruleId}:${fingerprint}`;
    }

    /**
     * Get alert state from Redis
     * 
     * @param key - Redis key
     * @returns Alert state record or null if not found
     */
    private async getAlertState(key: string): Promise<AlertStateRecord | null> {
        try {
            if (!this.redis) {
                return null;
            }

            const data = await this.redis.get(key);

            if (!data) {
                return null;
            }

            return JSON.parse(data as string) as AlertStateRecord;
        } catch (error) {
            logger.error('Failed to get alert state from Redis', {
                error: error instanceof Error ? error.message : String(error),
                key,
            });
            return null;
        }
    }

    /**
     * Group related alerts for combined notification
     * 
     * Requirement 8.3: Group related alerts into single notification
     * 
     * @param alerts - Array of triggered alerts
     * @returns Grouped alerts by tenant and component
     */
    groupRelatedAlerts(alerts: TriggeredAlert[]): Map<string, TriggeredAlert[]> {
        const groups = new Map<string, TriggeredAlert[]>();

        for (const alert of alerts) {
            // Group by tenant and component (from context)
            const groupKey = this.generateGroupKey(alert);

            if (!groups.has(groupKey)) {
                groups.set(groupKey, []);
            }

            groups.get(groupKey)!.push(alert);
        }

        return groups;
    }

    /**
     * Generate group key for alert grouping
     * 
     * @param alert - Triggered alert
     * @returns Group key string
     */
    private generateGroupKey(alert: TriggeredAlert): string {
        const tenantId = alert.tenantId || 'system';
        const component = alert.context.metricType || 'unknown';

        return `${tenantId}:${component}`;
    }
}

/**
 * Export singleton instance
 */
export const alertDeduplicationManager = new AlertDeduplicationManager();
