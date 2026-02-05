/**
 * Log Cleanup Job
 * 
 * Periodically cleans up old scraping logs and screenshots based on retention policies.
 * 
 * Requirements: 8.6
 */

import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';

export interface RetentionPolicy {
    /**
     * Retention period for successful scrape attempts (days)
     */
    successfulAttemptsRetentionDays: number;

    /**
     * Retention period for failed scrape attempts (days)
     */
    failedAttemptsRetentionDays: number;

    /**
     * Retention period for detection logs (days)
     */
    detectionLogsRetentionDays: number;

    /**
     * Retention period for screenshots (days)
     */
    screenshotsRetentionDays: number;

    /**
     * Retention period for response samples (days)
     */
    responseSamplesRetentionDays: number;
}

const DEFAULT_RETENTION_POLICY: RetentionPolicy = {
    successfulAttemptsRetentionDays: 7,
    failedAttemptsRetentionDays: 30,
    detectionLogsRetentionDays: 90,
    screenshotsRetentionDays: 7,
    responseSamplesRetentionDays: 30,
};

export class LogCleanupJob {
    private policy: RetentionPolicy;

    constructor(policy: Partial<RetentionPolicy> = {}) {
        this.policy = { ...DEFAULT_RETENTION_POLICY, ...policy };
    }

    /**
     * Run the cleanup job
     * 
     * Deletes old logs and screenshots based on retention policies.
     * 
     * Requirements: 8.6
     */
    async run(): Promise<CleanupResult> {
        logger.info('[LogCleanupJob] Starting log cleanup');

        const result: CleanupResult = {
            successfulAttemptsDeleted: 0,
            failedAttemptsDeleted: 0,
            detectionLogsDeleted: 0,
            screenshotsDeleted: 0,
            responseSamplesCleared: 0,
            errors: [],
        };

        try {
            // Clean up successful scrape attempts
            result.successfulAttemptsDeleted = await this.cleanupSuccessfulAttempts();

            // Clean up failed scrape attempts
            result.failedAttemptsDeleted = await this.cleanupFailedAttempts();

            // Clean up detection logs
            result.detectionLogsDeleted = await this.cleanupDetectionLogs();

            // Clean up screenshots
            result.screenshotsDeleted = await this.cleanupScreenshots();

            // Clear old response samples
            result.responseSamplesCleared = await this.clearResponseSamples();

            logger.info('[LogCleanupJob] Cleanup completed', result);
        } catch (error) {
            logger.error('[LogCleanupJob] Cleanup failed', {
                error: error instanceof Error ? error.message : String(error),
            });
            result.errors.push(error instanceof Error ? error.message : String(error));
        }

        return result;
    }

    /**
     * Clean up successful scrape attempts older than retention period
     */
    private async cleanupSuccessfulAttempts(): Promise<number> {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - this.policy.successfulAttemptsRetentionDays);

        try {
            const result = await prisma.scrapeAttempt.deleteMany({
                where: {
                    success: true,
                    createdAt: {
                        lt: cutoffDate,
                    },
                },
            });

            logger.info('[LogCleanupJob] Cleaned up successful attempts', {
                count: result.count,
                cutoffDate,
            });

            return result.count;
        } catch (error) {
            logger.error('[LogCleanupJob] Failed to clean up successful attempts', {
                error: error instanceof Error ? error.message : String(error),
            });
            return 0;
        }
    }

    /**
     * Clean up failed scrape attempts older than retention period
     */
    private async cleanupFailedAttempts(): Promise<number> {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - this.policy.failedAttemptsRetentionDays);

        try {
            const result = await prisma.scrapeAttempt.deleteMany({
                where: {
                    success: false,
                    createdAt: {
                        lt: cutoffDate,
                    },
                },
            });

            logger.info('[LogCleanupJob] Cleaned up failed attempts', {
                count: result.count,
                cutoffDate,
            });

            return result.count;
        } catch (error) {
            logger.error('[LogCleanupJob] Failed to clean up failed attempts', {
                error: error instanceof Error ? error.message : String(error),
            });
            return 0;
        }
    }

    /**
     * Clean up detection logs older than retention period
     */
    private async cleanupDetectionLogs(): Promise<number> {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - this.policy.detectionLogsRetentionDays);

        try {
            const result = await prisma.protectionDetection.deleteMany({
                where: {
                    createdAt: {
                        lt: cutoffDate,
                    },
                },
            });

            logger.info('[LogCleanupJob] Cleaned up detection logs', {
                count: result.count,
                cutoffDate,
            });

            return result.count;
        } catch (error) {
            logger.error('[LogCleanupJob] Failed to clean up detection logs', {
                error: error instanceof Error ? error.message : String(error),
            });
            return 0;
        }
    }

    /**
     * Clean up screenshots older than retention period
     * 
     * Note: This only removes screenshot URLs from the database.
     * Actual file deletion from S3/storage should be handled separately.
     */
    private async cleanupScreenshots(): Promise<number> {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - this.policy.screenshotsRetentionDays);

        try {
            const result = await prisma.scrapeAttempt.updateMany({
                where: {
                    screenshotUrl: {
                        not: null,
                    },
                    createdAt: {
                        lt: cutoffDate,
                    },
                },
                data: {
                    screenshotUrl: null,
                },
            });

            logger.info('[LogCleanupJob] Cleaned up screenshots', {
                count: result.count,
                cutoffDate,
            });

            return result.count;
        } catch (error) {
            logger.error('[LogCleanupJob] Failed to clean up screenshots', {
                error: error instanceof Error ? error.message : String(error),
            });
            return 0;
        }
    }

    /**
     * Clear response samples older than retention period
     */
    private async clearResponseSamples(): Promise<number> {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - this.policy.responseSamplesRetentionDays);

        try {
            const result = await prisma.scrapeAttempt.updateMany({
                where: {
                    responseSample: {
                        not: null,
                    },
                    createdAt: {
                        lt: cutoffDate,
                    },
                },
                data: {
                    responseSample: null,
                },
            });

            logger.info('[LogCleanupJob] Cleared response samples', {
                count: result.count,
                cutoffDate,
            });

            return result.count;
        } catch (error) {
            logger.error('[LogCleanupJob] Failed to clear response samples', {
                error: error instanceof Error ? error.message : String(error),
            });
            return 0;
        }
    }

    /**
     * Get current retention policy
     */
    getPolicy(): RetentionPolicy {
        return { ...this.policy };
    }

    /**
     * Update retention policy
     */
    updatePolicy(policy: Partial<RetentionPolicy>): void {
        this.policy = { ...this.policy, ...policy };
        logger.info('[LogCleanupJob] Retention policy updated', this.policy);
    }
}

export interface CleanupResult {
    successfulAttemptsDeleted: number;
    failedAttemptsDeleted: number;
    detectionLogsDeleted: number;
    screenshotsDeleted: number;
    responseSamplesCleared: number;
    errors: string[];
}

/**
 * Run log cleanup job (for cron execution)
 * 
 * Example cron schedule: 0 2 * * * (daily at 2 AM)
 */
export async function runLogCleanup(
    policy?: Partial<RetentionPolicy>
): Promise<CleanupResult> {
    const job = new LogCleanupJob(policy);
    return await job.run();
}
