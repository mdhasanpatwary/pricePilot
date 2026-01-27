import { prisma } from "@/lib/prisma";
import { logger } from "../logger";

/**
 * Retry Queue Service
 * 
 * Manages failed scraping requests that need to be retried with exponential backoff.
 * Implements Requirements 8.1, 8.2, 8.5
 */

export interface RetryQueueItem {
    id: string;
    tenantId: string;
    siteId: string;
    productId: string;
    url: string;
    retryCount: number;
    maxRetries: number;
    nextRetryAt: Date;
    lastAttemptAt: Date | null;
    lastError: string | null;
    status: 'PENDING' | 'IN_PROGRESS' | 'SUCCESS' | 'FAILED';
    createdAt: Date;
    updatedAt: Date;
}

export interface AddToRetryQueueOptions {
    tenantId: string;
    siteId: string;
    productId: string;
    url: string;
    error: string;
    maxRetries?: number;
}

export class RetryQueueService {
    private static instance: RetryQueueService;

    // Exponential backoff delays: 5min, 15min, 1h, 6h
    private readonly RETRY_DELAYS = [
        5 * 60 * 1000,      // 5 minutes
        15 * 60 * 1000,     // 15 minutes
        60 * 60 * 1000,     // 1 hour
        6 * 60 * 60 * 1000, // 6 hours
    ];

    private constructor() { }

    /**
     * Get singleton instance
     */
    static getInstance(): RetryQueueService {
        if (!RetryQueueService.instance) {
            RetryQueueService.instance = new RetryQueueService();
        }
        return RetryQueueService.instance;
    }

    /**
     * Add a failed request to the retry queue
     * Implements Requirements 8.1, 8.5
     */
    async addToRetryQueue(options: AddToRetryQueueOptions): Promise<RetryQueueItem> {
        const {
            tenantId,
            siteId,
            productId,
            url,
            error,
            maxRetries = 4,
        } = options;

        // Check if item already exists in queue
        const existing = await prisma.retryQueue.findFirst({
            where: {
                tenantId,
                siteId,
                productId,
                status: {
                    in: ['PENDING', 'IN_PROGRESS'],
                },
            },
        });

        if (existing) {
            // Update existing item
            const retryCount = existing.retryCount + 1;
            const nextRetryAt = this.calculateNextRetryTime(retryCount);

            logger.info(`[RetryQueue] Updating existing retry queue item for product ${productId}, attempt ${retryCount}`);

            const updated = await prisma.retryQueue.update({
                where: { id: existing.id },
                data: {
                    retryCount,
                    nextRetryAt,
                    lastError: error,
                    status: retryCount >= maxRetries ? 'FAILED' : 'PENDING',
                    updatedAt: new Date(),
                },
            });

            return updated as RetryQueueItem;
        }

        // Create new retry queue item
        const nextRetryAt = this.calculateNextRetryTime(0);

        logger.info(`[RetryQueue] Adding new item to retry queue for product ${productId}`);

        const item = await prisma.retryQueue.create({
            data: {
                tenantId,
                siteId,
                productId,
                url,
                retryCount: 0,
                maxRetries,
                nextRetryAt,
                lastError: error,
                status: 'PENDING',
            },
        });

        return item as RetryQueueItem;
    }

    /**
     * Calculate next retry time with exponential backoff
     * Implements Requirement 8.2
     * 
     * Delays: 5min, 15min, 1h, 6h
     */
    private calculateNextRetryTime(retryCount: number): Date {
        const delayIndex = Math.min(retryCount, this.RETRY_DELAYS.length - 1);
        const delay = this.RETRY_DELAYS[delayIndex];

        const nextRetryAt = new Date(Date.now() + delay);

        logger.info(`[RetryQueue] Calculated next retry time for attempt ${retryCount + 1}: ${nextRetryAt.toISOString()} (delay: ${delay}ms)`);

        return nextRetryAt;
    }

    /**
     * Get next batch of pending retries that are ready to be processed
     * Implements Requirement 8.2
     * 
     * @param batchSize Maximum number of items to return
     * @returns Array of retry queue items ready for processing
     */
    async getNextRetryBatch(batchSize: number = 10): Promise<RetryQueueItem[]> {
        const now = new Date();

        const items = await prisma.retryQueue.findMany({
            where: {
                status: 'PENDING',
                nextRetryAt: {
                    lte: now,
                },
            },
            orderBy: {
                nextRetryAt: 'asc',
            },
            take: batchSize,
        });

        logger.info(`[RetryQueue] Retrieved ${items.length} items ready for retry`);

        return items as RetryQueueItem[];
    }

    /**
     * Update retry status to IN_PROGRESS
     * 
     * @param id Retry queue item ID
     */
    async markInProgress(id: string): Promise<void> {
        await prisma.retryQueue.update({
            where: { id },
            data: {
                status: 'IN_PROGRESS',
                lastAttemptAt: new Date(),
                updatedAt: new Date(),
            },
        });

        logger.info(`[RetryQueue] Marked item ${id} as IN_PROGRESS`);
    }

    /**
     * Update retry status to SUCCESS
     * Implements Requirement 8.3
     * 
     * @param id Retry queue item ID
     */
    async markSuccess(id: string): Promise<void> {
        await prisma.retryQueue.update({
            where: { id },
            data: {
                status: 'SUCCESS',
                updatedAt: new Date(),
            },
        });

        logger.info(`[RetryQueue] Marked item ${id} as SUCCESS`);
    }

    /**
     * Update retry status to FAILED (permanently)
     * Implements Requirement 8.4
     * 
     * @param id Retry queue item ID
     * @param error Error message
     */
    async markFailed(id: string, error: string): Promise<void> {
        await prisma.retryQueue.update({
            where: { id },
            data: {
                status: 'FAILED',
                lastError: error,
                updatedAt: new Date(),
            },
        });

        logger.warn(`[RetryQueue] Marked item ${id} as permanently FAILED: ${error}`);
    }

    /**
     * Increment retry count and schedule next retry
     * 
     * @param id Retry queue item ID
     * @param error Error message from failed attempt
     */
    async incrementRetryCount(id: string, error: string): Promise<void> {
        const item = await prisma.retryQueue.findUnique({
            where: { id },
        });

        if (!item) {
            logger.error(`[RetryQueue] Item ${id} not found`);
            return;
        }

        const newRetryCount = item.retryCount + 1;
        const nextRetryAt = this.calculateNextRetryTime(newRetryCount);

        // Mark as FAILED if max retries exceeded
        const status = newRetryCount >= item.maxRetries ? 'FAILED' : 'PENDING';

        await prisma.retryQueue.update({
            where: { id },
            data: {
                retryCount: newRetryCount,
                nextRetryAt,
                lastError: error,
                status,
                updatedAt: new Date(),
            },
        });

        if (status === 'FAILED') {
            logger.warn(`[RetryQueue] Item ${id} exceeded max retries (${item.maxRetries}), marked as FAILED`);
        } else {
            logger.info(`[RetryQueue] Item ${id} retry count incremented to ${newRetryCount}, next retry at ${nextRetryAt.toISOString()}`);
        }
    }

    /**
     * Get retry queue statistics
     */
    async getStats(): Promise<{
        pending: number;
        inProgress: number;
        success: number;
        failed: number;
        total: number;
    }> {
        const [pending, inProgress, success, failed, total] = await Promise.all([
            prisma.retryQueue.count({ where: { status: 'PENDING' } }),
            prisma.retryQueue.count({ where: { status: 'IN_PROGRESS' } }),
            prisma.retryQueue.count({ where: { status: 'SUCCESS' } }),
            prisma.retryQueue.count({ where: { status: 'FAILED' } }),
            prisma.retryQueue.count(),
        ]);

        return {
            pending,
            inProgress,
            success,
            failed,
            total,
        };
    }

    /**
     * Clean up old completed items (SUCCESS/FAILED older than 7 days)
     */
    async cleanupOldItems(): Promise<number> {
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

        const result = await prisma.retryQueue.deleteMany({
            where: {
                status: {
                    in: ['SUCCESS', 'FAILED'],
                },
                updatedAt: {
                    lt: sevenDaysAgo,
                },
            },
        });

        logger.info(`[RetryQueue] Cleaned up ${result.count} old retry queue items`);

        return result.count;
    }
}
