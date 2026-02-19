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
import { detectPriceAnomaly } from '../price-anomaly';
import { RetryQueueService } from '@/lib/services/retry-queue';
import { ScrapeExecutionStatus } from '@prisma/client';
import { extractSlugFromUrl, normalizeCanonicalUrl, normalizeSku } from '@/lib/services/product-dedup';
import { detectCurrency, SupportedCurrency } from '@/lib/services/currency-parser';
import { exchangeRateService } from '@/lib/services/exchange-rate';

/**
 * ScraperAdapter class
 * 
 * Provides a bridge between the old ScraperService and the new ScrapeOrchestrator.
 * Handles conversion of data formats and database updates.
 */
export class ScraperAdapter {
    private orchestrator: ScrapeOrchestrator;
    private retryQueue: RetryQueueService;

    constructor() {
        this.orchestrator = new ScrapeOrchestrator();
        this.retryQueue = RetryQueueService.getInstance();
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
            await this.updateDatabaseWithResults(competitorProductId, result, url, tenantId, product.siteId);

            // Convert to legacy format
            if (result.success && result.price) {
                const supportedCurrency = this.toSupportedCurrency(result.currency) || 'USD';
                return {
                    title: product.title,
                    price: result.price,
                    currency: supportedCurrency,
                    url,
                    inStock: result.inStock !== false,
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
     * Scrape a URL through bot orchestrator without an existing competitor product.
     *
     * This path avoids creating probe Product rows and runs in anonymous mode
     * (tenant + site + url only).
     */
    async scrapeUrlWithProbe(
        url: string,
        tenantId: string,
        competitorWebsiteId: string,
        probeTitle?: string
    ): Promise<ScrapedProductData | null> {
        try {
            const result = await this.orchestrator.executeScrape({
                competitorWebsiteId,
                url,
                tenantId,
                priority: 'normal',
            });

            if (!result.success || !result.price) {
                return null;
            }

            const currency = this.toSupportedCurrency(result.currency) || 'USD';
            return {
                title: probeTitle?.trim() || 'Discovered Product',
                price: result.price,
                currency,
                url,
                inStock: result.inStock !== false,
                protectionDetected: result.protectionDetected,
                protectionType: result.protectionType,
            };
        } catch (error) {
            logger.error('[ScraperAdapter] Probe scrape failed', {
                url,
                tenantId,
                competitorWebsiteId,
                error: error instanceof Error ? error.message : String(error),
            });
            return null;
        }
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
        result: ScrapeResult,
        sourceUrl: string,
        tenantId: string,
        siteId: string
    ): Promise<void> {
        try {
            const existing = await prisma.product.findUnique({
                where: { id: competitorProductId },
                select: {
                    currentPrice: true,
                    inStock: true,
                    currency: true,
                    priceAnomalyActive: true,
                    title: true,
                    sku: true,
                },
            });

            const updateData: any = {
                lastCrawledAt: result.timestamp,
                updatedAt: new Date(),
                canonicalUrl: normalizeCanonicalUrl(sourceUrl),
                normalizedSlug: extractSlugFromUrl(sourceUrl) || null,
            };

            const normalizedSku = normalizeSku(existing?.sku || undefined);
            if (normalizedSku) {
                updateData.sku = normalizedSku;
            }

            // Update price if successful
            if (result.success && result.price) {
                const parsedCurrency = this.toSupportedCurrency(result.currency)
                    || this.toSupportedCurrency(existing?.currency)
                    || detectCurrency(existing?.title || '')
                    || null;
                if (!parsedCurrency) {
                    logger.warn('[ScraperAdapter] Price present but currency missing, refusing unsafe save', {
                        competitorProductId,
                        sourceUrl,
                    });
                    return;
                }

                const tenant = await prisma.tenant.findUnique({
                    where: { id: tenantId },
                    select: { currency: true },
                });
                const baseCurrency = ((tenant?.currency || 'USD').toUpperCase() as SupportedCurrency);
                const normalized = await exchangeRateService.normalizeToBase({
                    amount: result.price,
                    fromCurrency: parsedCurrency,
                    baseCurrency,
                });

                const oldPrice = existing?.currentPrice ? parseFloat(existing.currentPrice.toString()) : null;
                const anomaly = detectPriceAnomaly({
                    newPrice: result.price,
                    oldPrice,
                    inStock: result.inStock !== false,
                    explicitOos: Boolean(result.explicitOutOfStock),
                    currency: parsedCurrency || existing?.currency || null,
                });

                if (anomaly.flagged) {
                    updateData.priceAnomalyActive = true;
                    updateData.priceAnomalyDetectedAt = new Date();
                    updateData.priceAnomalyData = anomaly;

                    logger.warn('[ScraperAdapter] Price anomaly detected, skipping price save', {
                        competitorProductId,
                        oldPrice,
                        newPrice: result.price,
                        reasons: anomaly.reasons,
                    });

                    await prisma.product.update({
                        where: { id: competitorProductId },
                        data: updateData,
                    });

                    await prisma.scrapePriceAnomaly.create({
                        data: {
                            tenantId,
                            competitorProductId,
                            competitorWebsiteId: siteId,
                            detectedPrice: result.price,
                            currency: parsedCurrency,
                            reasons: anomaly.reasons as any,
                            details: anomaly.details as any,
                        },
                    });

                    const latestAttempt = await prisma.scrapeAttempt.findFirst({
                        where: {
                            tenantId,
                            competitorProductId,
                        },
                        orderBy: { createdAt: 'desc' },
                        select: { id: true },
                    });
                    if (latestAttempt) {
                        await prisma.scrapeAttempt.update({
                            where: { id: latestAttempt.id },
                            data: { scrapeStatus: ScrapeExecutionStatus.ANOMALY },
                        });
                    }

                    await this.scheduleRetryIfAllowed({
                        tenantId,
                        siteId,
                        productId: competitorProductId,
                        url: sourceUrl,
                        error: 'ANOMALY detected - pending verification re-scrape required',
                    });
                    return;
                }

                updateData.currentPrice = result.price;
                updateData.currency = parsedCurrency;
                updateData.originalPrice = result.price;
                updateData.originalCurrency = parsedCurrency;
                updateData.normalizedPrice = normalized.normalizedAmount;
                updateData.exchangeRateUsed = normalized.exchangeRateUsed;
                updateData.exchangeRateTimestamp = normalized.exchangeRateTimestamp;
                updateData.priceAnomalyActive = false;
                updateData.priceAnomalyDetectedAt = null;
                updateData.priceAnomalyData = null;
                updateData.geoVariantDetected = Boolean(result.geoVariantDetected);
                updateData.geoVariantDetectedAt = result.geoVariantDetected ? new Date() : null;

                // Create price history entry
                await prisma.priceHistory.create({
                    data: {
                        productId: competitorProductId,
                        price: result.price,
                        originalPrice: result.price,
                        originalCurrency: parsedCurrency,
                        normalizedPrice: normalized.normalizedAmount,
                        exchangeRateUsed: normalized.exchangeRateUsed,
                        exchangeRateTimestamp: normalized.exchangeRateTimestamp,
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

            if (result.scrapeStatus === ScrapeExecutionStatus.PARTIAL) {
                await this.scheduleRetryIfAllowed({
                    tenantId,
                    siteId,
                    productId: competitorProductId,
                    url: sourceUrl,
                    error: 'PARTIAL scrape: product found but price missing',
                });
            }

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

    private async scheduleRetryIfAllowed(options: {
        tenantId: string;
        siteId: string;
        productId: string;
        url: string;
        error: string;
    }): Promise<void> {
        const manualReview = await this.isDomainUnderManualReview(options.siteId, options.url);
        if (manualReview) {
            logger.warn('[ScraperAdapter] Retry skipped: domain requires manual review', {
                siteId: options.siteId,
                productId: options.productId,
            });
            return;
        }

        await this.retryQueue.addToRetryQueue({
            tenantId: options.tenantId,
            siteId: options.siteId,
            productId: options.productId,
            url: options.url,
            error: options.error,
            maxRetries: 4,
        });
    }

    private async isDomainUnderManualReview(siteId: string, url: string): Promise<boolean> {
        try {
            const site = await prisma.site.findUnique({
                where: { id: siteId },
                select: { baseUrl: true },
            });
            const domain = site?.baseUrl ? new URL(site.baseUrl).hostname : new URL(url).hostname;
            const profile = await prisma.domainProfile.findUnique({
                where: { domain },
                select: { needsManualReview: true },
            });
            return Boolean(profile?.needsManualReview);
        } catch {
            return false;
        }
    }

    private toSupportedCurrency(input?: string | null): SupportedCurrency | null {
        if (!input) return null;
        const upper = input.toUpperCase();
        if (upper === 'BDT' || upper === 'INR' || upper === 'USD' || upper === 'EUR') {
            return upper as SupportedCurrency;
        }
        return detectCurrency(input) || null;
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
    specifications?: Record<string, string>;
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
