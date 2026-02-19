import { prisma } from "@/lib/prisma";
import { logger } from "../logger";
import { RetryQueueService, RetryQueueItem } from "./retry-queue";
import { ScrapingEngineService } from "./scraping-engine-service";

/**
 * Retry Queue Processor
 *
 * Background worker that processes the retry queue, executing failed scraping
 * requests with fresh contexts and updating product data on success.
 *
 * Implements Requirements 8.2, 8.3, 8.4
 */

export class RetryQueueProcessor {
    private static instance: RetryQueueProcessor;
    private retryQueueService: RetryQueueService;
    private isRunning: boolean = false;
    private intervalId: NodeJS.Timeout | null = null;
    private processingInterval: number = 60000; // 1 minute

    private constructor() {
        this.retryQueueService = RetryQueueService.getInstance();
    }

    /**
     * Get singleton instance
     */
    static getInstance(): RetryQueueProcessor {
        if (!RetryQueueProcessor.instance) {
            RetryQueueProcessor.instance = new RetryQueueProcessor();
        }
        return RetryQueueProcessor.instance;
    }

    /**
     * Start the retry queue processor
     *
     * @param intervalMs Processing interval in milliseconds (default: 60000 = 1 minute)
     */
    async start(intervalMs: number = 60000): Promise<void> {
        if (this.isRunning) {
            logger.warn('[RetryQueueProcessor] Already running');
            return;
        }

        this.processingInterval = intervalMs;
        this.isRunning = true;

        logger.info(`[RetryQueueProcessor] Starting with interval ${intervalMs}ms`);

        // Process immediately on start
        await this.processQueue();

        // Set up interval for continuous processing
        this.intervalId = setInterval(async () => {
            await this.processQueue();
        }, this.processingInterval);

        logger.info('[RetryQueueProcessor] Started successfully');
    }

    /**
     * Stop the retry queue processor
     */
    async stop(): Promise<void> {
        if (!this.isRunning) {
            logger.warn('[RetryQueueProcessor] Not running');
            return;
        }

        logger.info('[RetryQueueProcessor] Stopping...');

        this.isRunning = false;

        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }

        logger.info('[RetryQueueProcessor] Stopped successfully');
    }

    /**
     * Process the retry queue
     * Fetches pending retries and executes them with fresh contexts
     * Implements Requirements 8.2, 8.3, 8.4
     */
    private async processQueue(): Promise<void> {
        if (!this.isRunning) {
            return;
        }

        try {
            // Atomically claim next batch of retries (multi-worker safe)
            const batchSize = 10;
            const items = await this.retryQueueService.claimNextRetryBatch(batchSize);

            if (items.length === 0) {
                logger.info('[RetryQueueProcessor] No items ready for retry');
                return;
            }

            logger.info(`[RetryQueueProcessor] Processing ${items.length} retry items`);

            // Process each item
            for (const item of items) {
                await this.processRetryItem(item);
            }

            logger.info(`[RetryQueueProcessor] Completed processing ${items.length} items`);
        } catch (error) {
            logger.error('[RetryQueueProcessor] Error processing queue:', { error });
        }
    }

    /**
     * Process a single retry item
     * Implements Requirements 8.2, 8.3, 8.4
     *
     * @param item Retry queue item to process
     */
    private async processRetryItem(item: RetryQueueItem): Promise<void> {
        try {
            logger.info(`[RetryQueueProcessor] Processing retry item ${item.id} for product ${item.productId} (attempt ${item.retryCount + 1}/${item.maxRetries})`);

            const site = await prisma.site.findUnique({
                where: { id: item.siteId },
                select: { isAdvancedProtected: true },
            });

            // Execute retry with fresh context
            const scrapedData = await ScrapingEngineService.scrapeByUrl(item.url, {
                context: "retry",
                isAdvancedProtected: Boolean(site?.isAdvancedProtected),
                competitorProductId: item.productId,
                tenantId: item.tenantId,
                siteId: item.siteId,
            });

            if (scrapedData && scrapedData.price > 0) {
                // Success! Update product data
                await this.updateProductData(item.tenantId, item.productId, scrapedData);
                await this.retryQueueService.markSuccess(item.id);

                logger.info(`[RetryQueueProcessor] ✅ Successfully retried product ${item.productId}`);
            } else {
                // Failed to extract data
                const error = 'Failed to extract product data';

                // Check if we should retry again
                if (item.retryCount + 1 >= item.maxRetries) {
                    // Max retries exceeded, mark as permanently failed
                    await this.retryQueueService.markFailed(item.id, error);
                    logger.warn(`[RetryQueueProcessor] ❌ Product ${item.productId} permanently failed after ${item.maxRetries} attempts`);
                } else {
                    // Increment retry count and schedule next retry
                    await this.retryQueueService.incrementRetryCount(item.id, error);
                    logger.info(`[RetryQueueProcessor] ⏳ Product ${item.productId} will be retried again`);
                }
            }
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);

            logger.error(`[RetryQueueProcessor] Error processing retry item ${item.id}:`, { error });

            // Check if we should retry again
            if (item.retryCount + 1 >= item.maxRetries) {
                // Max retries exceeded, mark as permanently failed
                await this.retryQueueService.markFailed(item.id, errorMessage);
                logger.warn(`[RetryQueueProcessor] ❌ Product ${item.productId} permanently failed after ${item.maxRetries} attempts`);
            } else {
                // Increment retry count and schedule next retry
                await this.retryQueueService.incrementRetryCount(item.id, errorMessage);
                logger.info(`[RetryQueueProcessor] ⏳ Product ${item.productId} will be retried again`);
            }
        }
    }

    /**
     * Update product data in database
     * Implements Requirement 8.3
     *
     * @param productId Product ID to update
     * @param scrapedData Scraped product data
     */
    private async updateProductData(
        tenantId: string,
        productId: string,
        scrapedData: {
            title: string;
            price: number;
            currency: string;
            sku?: string;
            brand?: string;
            model?: string;
            inStock: boolean;
            imageUrl?: string;
            specifications?: Record<string, string>;
        }
    ): Promise<void> {
        try {
            // Update product with new data
            await prisma.product.update({
                where: { id: productId },
                data: {
                    title: scrapedData.title,
                    currentPrice: scrapedData.price,
                    currency: scrapedData.currency,
                    sku: scrapedData.sku,
                    brand: scrapedData.brand,
                    model: scrapedData.model,
                    inStock: scrapedData.inStock,
                    imageUrl: scrapedData.imageUrl,
                    specifications: scrapedData.specifications as any,
                    lastCrawledAt: new Date(),
                    updatedAt: new Date(),
                },
            });

            // Invalidate cache for updated product
            // Requirement 2.9.4: Cache invalidation on data updates
            try {
                const { cacheEnhancedService } = await import("./cache-enhanced");
                await cacheEnhancedService.invalidateProduct(tenantId, productId);
                await cacheEnhancedService.invalidateComparisons(tenantId);
            } catch (cacheError) {
                logger.warn('[RetryQueueProcessor] Failed to invalidate cache after product update', {
                    productId,
                    error: cacheError
                });
            }

            // Create price history entry
            await prisma.priceHistory.create({
                data: {
                    productId,
                    price: scrapedData.price,
                    recordedAt: new Date(),
                },
            });

            logger.info(`[RetryQueueProcessor] Updated product ${productId} with new data`);
        } catch (error) {
            logger.error(`[RetryQueueProcessor] Failed to update product ${productId}:`, { error });
            throw error;
        }
    }

    /**
     * Get processor status
     */
    getStatus(): {
        isRunning: boolean;
        processingInterval: number;
    } {
        return {
            isRunning: this.isRunning,
            processingInterval: this.processingInterval,
        };
    }

    /**
     * Process queue immediately (manual trigger)
     */
    async processNow(): Promise<void> {
        logger.info('[RetryQueueProcessor] Manual processing triggered');
        await this.processQueue();
    }
}
