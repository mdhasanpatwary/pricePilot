/**
 * Scraper Adapter
 * 
 * Adapts the new ScrapeOrchestrator to work with the existing ScraperService interface.
 * This allows gradual migration from the old scraping system to the new bot protection system.
 * 
 * Requirements: 1.7, 8.1
 */

import { logger } from '@/lib/logger';
import { prisma } from '@/lib/prisma';
import { ScrapeOrchestrator, ScrapeRequest, ScrapeResult } from './scrape-orchestrator';

/**
 * ScraperAdapter class
 * 
 * Provides a bridge between the old ScraperService and the new ScrapeOrchestrator.
 * Handles conversion of data formats and database updates.
 */
export class ScraperAdapter {
    private orchestrator: ScrapeOrchestrator;

    constructor() {
        this.orchestrator = new ScrapeOrchestrator();
    }

    /**
     * Scrape a competitor product using the new orchestrator
     * 
     * This method replaces direct scraping calls in the existing system.
     * It uses the ScrapeOrchestrator to handle bot protection and returns
     * results in a format compatible with the existing system.
     * 
     * Requirements: 1.7, 8.1
     * 
     * @param competitorProductId - ID of the competitor product
     * @param url - URL to scrape
     * @param tenantId - Tenant ID
     * @returns Scraped product data or null
     */
    async scrapeCompetitorProduct(
        competitorProductId: string,
        url: string,
        tenantId: string
    ): Promise<ScrapedProductData | null> {
        try {
            logger.info('[ScraperAdapter] Starting scrape', {
                competitorProductId,
                url,
                tenantId,
            });

            // Get competitor website ID
            const product = await prisma.product.findUnique({
                where: { id: competitorProductId },
                select: {
                    siteId: true,
                    title: true,
                },
            });

            if (!product) {
                logger.error('[ScraperAdapter] Competitor product not found', {
                    competitorProductId,
                });
                return null;
            }

            // Build scrape request
            const request: ScrapeRequest = {
                competitorProductId,
                competitorWebsiteId: product.siteId,
                url,
                tenantId,
                priority: 'normal',
            };

            // Execute scrape using orchestrator
            const result: ScrapeResult = await this.orchestrator.executeScrape(request);

            // Update database with results
            await this.updateDatabaseWithResults(competitorProductId, result);

            // Convert to legacy format
            if (result.success && result.price) {
                return {
                    title: product.title,
                    price: result.price,
                    currency: result.currency || 'USD',
                    url,
                    inStock: true,
                    protectionDetected: result.protectionDetected,
                    protectionType: result.protectionType,
                };
            }

            // Scrape failed
            logger.warn('[ScraperAdapter] Scrape failed', {
                competitorProductId,
                protectionDetected: result.protectionDetected,
                protectionType: result.protectionType,
                errorMessage: result.errorMessage,
            });

            return null;
        } catch (error) {
            logger.error('[ScraperAdapter] Scrape error', {
                competitorProductId,
                url,
                error: error instanceof Error ? error.message : String(error),
            });
            return null;
        }
    }

    /**
     * Batch scrape multiple competitor products
     * 
     * @param products - Array of products to scrape
     * @param tenantId - Tenant ID
     * @returns Array of scraped product data
     */
    async scrapeMultipleProducts(
        products: Array<{ id: string; url: string }>,
        tenantId: string
    ): Promise<Array<ScrapedProductData | null>> {
        const results: Array<ScrapedProductData | null> = [];

        for (const product of products) {
            const result = await this.scrapeCompetitorProduct(
                product.id,
                product.url,
                tenantId
            );
            results.push(result);
        }

        return results;
    }

    /**
     * Update database with scrape results
     * 
     * Updates the competitor product record with the scrape results,
     * including price and timestamps.
     * 
     * Requirements: 1.7, 8.1
     * 
     * @param competitorProductId - ID of the competitor product
     * @param result - Scrape result from orchestrator
     */
    private async updateDatabaseWithResults(
        competitorProductId: string,
        result: ScrapeResult
    ): Promise<void> {
        try {
            const updateData: any = {
                lastCrawledAt: result.timestamp,
                updatedAt: new Date(),
            };

            // Update price if successful
            if (result.success && result.price) {
                updateData.currentPrice = result.price;
                updateData.currency = result.currency || 'USD';

                // Create price history entry
                await prisma.priceHistory.create({
                    data: {
                        productId: competitorProductId,
                        price: result.price,
                        recordedAt: result.timestamp,
                    },
                });

                logger.info('[ScraperAdapter] Price updated successfully', {
                    competitorProductId,
                    price: result.price,
                    currency: result.currency,
                });
            }

            // Update the product
            await prisma.product.update({
                where: { id: competitorProductId },
                data: updateData,
            });

            logger.debug('[ScraperAdapter] Database updated', {
                competitorProductId,
                success: result.success,
                protectionDetected: result.protectionDetected,
                protectionType: result.protectionType,
            });
        } catch (error) {
            logger.error('[ScraperAdapter] Failed to update database', {
                competitorProductId,
                error: error instanceof Error ? error.message : String(error),
            });
            // Don't throw - scraping succeeded even if DB update failed
        }
    }

    /**
     * Cleanup resources
     */
    async cleanup(): Promise<void> {
        await this.orchestrator.cleanup();
    }
}

/**
 * Scraped product data interface (legacy format)
 */
export interface ScrapedProductData {
    title: string;
    price: number;
    currency: string;
    url: string;
    inStock: boolean;
    sku?: string;
    brand?: string;
    model?: string;
    imageUrl?: string;
    protectionDetected?: boolean;
    protectionType?: string;
}

/**
 * Singleton instance for easy access
 */
let scraperAdapterInstance: ScraperAdapter | null = null;

/**
 * Get the singleton scraper adapter instance
 */
export function getScraperAdapter(): ScraperAdapter {
    if (!scraperAdapterInstance) {
        scraperAdapterInstance = new ScraperAdapter();
    }
    return scraperAdapterInstance;
}
