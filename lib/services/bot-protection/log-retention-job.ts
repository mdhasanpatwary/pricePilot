/**
 * Log Retention Cleanup Job
 * 
 * Scheduled job to clean up old logs and screenshots based on retention policies.
 * 
 * Retention Policy:
 * - Successful attempts: 7 days
 * - Failed attempts: 30 days
 * - Detection logs: 90 days (cascade delete with scrape attempts)
 * - Screenshots: 7 days
 * - Response samples: 30 days (stored with scrape attempts)
 * 
 * Requirements: 8.6
 */

import { LoggingService } from './logging-service';
import { ScreenshotStorage } from './screenshot-storage';
import { prisma } from '@/lib/prisma';

/**
 * Retention policy configuration
 */
export interface RetentionPolicyConfig {
    successfulAttemptsRetentionDays: number;
    failedAttemptsRetentionDays: number;
    detectionLogsRetentionDays: number;
    screenshotsRetentionDays: number;
}

/**
 * Cleanup job result
 */
export interface CleanupResult {
    scrapeAttemptsDeleted: number;
    detectionsDeleted: number;
    screenshotsDeleted: number;
    errors: string[];
    executedAt: Date;
    durationMs: number;
}

/**
 * Log Retention Cleanup Job
 * 
 * Executes retention policy cleanup for logs and screenshots.
 * Should be run as a scheduled cron job (e.g., daily at 2 AM).
 */
export class LogRetentionJob {
    private loggingService: LoggingService;
    private screenshotStorage: ScreenshotStorage;
    private config: RetentionPolicyConfig;

    constructor(config?: Partial<RetentionPolicyConfig>) {
        this.loggingService = new LoggingService();
        this.screenshotStorage = new ScreenshotStorage();

        this.config = {
            successfulAttemptsRetentionDays: config?.successfulAttemptsRetentionDays || 7,
            failedAttemptsRetentionDays: config?.failedAttemptsRetentionDays || 30,
            detectionLogsRetentionDays: config?.detectionLogsRetentionDays || 90,
            screenshotsRetentionDays: config?.screenshotsRetentionDays || 7,
        };
    }

    /**
     * Execute cleanup job
     * 
     * Deletes old logs and screenshots based on retention policy.
     * 
     * @returns Cleanup result with counts and errors
     */
    async execute(): Promise<CleanupResult> {
        const startTime = Date.now();
        const errors: string[] = [];

        let scrapeAttemptsDeleted = 0;
        let detectionsDeleted = 0;
        let screenshotsDeleted = 0;

        try {
            // Step 1: Get screenshot URLs to delete before deleting scrape attempts
            const screenshotUrls = await this.getOldScreenshotUrls();

            // Step 2: Delete old scrape attempts and detection logs
            const logCleanupResult = await this.loggingService.cleanupOldLogs();
            scrapeAttemptsDeleted = logCleanupResult.scrapeAttempts;
            detectionsDeleted = logCleanupResult.detections;

            // Step 3: Delete screenshot files
            for (const url of screenshotUrls) {
                try {
                    await this.screenshotStorage.deleteScreenshot(url);
                    screenshotsDeleted++;
                } catch (error) {
                    errors.push(`Failed to delete screenshot ${url}: ${error}`);
                }
            }

            // Step 4: Clean up orphaned screenshots (files without database records)
            try {
                const orphanedCount = await this.screenshotStorage.deleteOldScreenshots(
                    this.config.screenshotsRetentionDays
                );
                screenshotsDeleted += orphanedCount;
            } catch (error) {
                errors.push(`Failed to clean up orphaned screenshots: ${error}`);
            }

        } catch (error) {
            errors.push(`Cleanup job failed: ${error}`);
        }

        const durationMs = Date.now() - startTime;

        return {
            scrapeAttemptsDeleted,
            detectionsDeleted,
            screenshotsDeleted,
            errors,
            executedAt: new Date(),
            durationMs,
        };
    }

    /**
     * Get screenshot URLs from old scrape attempts
     * 
     * Retrieves screenshot URLs before deleting the scrape attempts
     * so we can clean up the actual files.
     * 
     * @returns Array of screenshot URLs
     */
    private async getOldScreenshotUrls(): Promise<string[]> {
        const cutoffDate = new Date(
            Date.now() - this.config.screenshotsRetentionDays * 24 * 60 * 60 * 1000
        );

        const oldAttempts = await prisma.scrapeAttempt.findMany({
            where: {
                createdAt: {
                    lt: cutoffDate,
                },
                screenshotUrl: {
                    not: null,
                },
            },
            select: {
                screenshotUrl: true,
            },
        });

        return oldAttempts
            .map((attempt) => attempt.screenshotUrl)
            .filter((url): url is string => url !== null);
    }

    /**
     * Get cleanup statistics
     * 
     * Returns counts of logs that would be deleted without actually deleting them.
     * Useful for monitoring and alerting.
     * 
     * @returns Statistics about logs eligible for cleanup
     */
    async getCleanupStatistics(): Promise<{
        successfulAttemptsToDelete: number;
        failedAttemptsToDelete: number;
        screenshotsToDelete: number;
    }> {
        const now = new Date();

        const successfulCutoff = new Date(
            now.getTime() - this.config.successfulAttemptsRetentionDays * 24 * 60 * 60 * 1000
        );
        const failedCutoff = new Date(
            now.getTime() - this.config.failedAttemptsRetentionDays * 24 * 60 * 60 * 1000
        );
        const screenshotCutoff = new Date(
            now.getTime() - this.config.screenshotsRetentionDays * 24 * 60 * 60 * 1000
        );

        const [successfulCount, failedCount, screenshotCount] = await Promise.all([
            prisma.scrapeAttempt.count({
                where: {
                    success: true,
                    createdAt: {
                        lt: successfulCutoff,
                    },
                },
            }),
            prisma.scrapeAttempt.count({
                where: {
                    success: false,
                    createdAt: {
                        lt: failedCutoff,
                    },
                },
            }),
            prisma.scrapeAttempt.count({
                where: {
                    createdAt: {
                        lt: screenshotCutoff,
                    },
                    screenshotUrl: {
                        not: null,
                    },
                },
            }),
        ]);

        return {
            successfulAttemptsToDelete: successfulCount,
            failedAttemptsToDelete: failedCount,
            screenshotsToDelete: screenshotCount,
        };
    }
}

/**
 * Run cleanup job (for cron execution)
 * 
 * Example cron schedule: 0 2 * * * (daily at 2 AM)
 */
export async function runLogRetentionCleanup(): Promise<CleanupResult> {
    const job = new LogRetentionJob();
    const result = await job.execute();

    // Log result
    console.log('Log retention cleanup completed:', {
        scrapeAttemptsDeleted: result.scrapeAttemptsDeleted,
        detectionsDeleted: result.detectionsDeleted,
        screenshotsDeleted: result.screenshotsDeleted,
        durationMs: result.durationMs,
        errors: result.errors.length,
    });

    if (result.errors.length > 0) {
        console.error('Cleanup errors:', result.errors);
    }

    return result;
}
