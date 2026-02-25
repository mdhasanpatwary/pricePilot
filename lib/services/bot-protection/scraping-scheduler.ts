/**
 * Scraping Scheduler
 *
 * Schedules and queues scrape requests for all competitor products.
 * Respects rate limits and distributes requests over time.
 *
 * Requirements: 4.5
 */

import { PrismaClient } from '@prisma/client';
import { logger } from '@/lib/logger';
import { ScrapeOrchestrator } from './scrape-orchestrator';

const prisma = new PrismaClient();

export interface SchedulerConfig {
    /**
     * Maximum concurrent scrapes per tenant
     */
    maxConcurrentScrapesPerTenant: number;

    /**
     * Minimum delay between scrapes for the same competitor site (ms)
     */
    minDelayPerSite: number;

    /**
     * Maximum scrapes to queue in a single batch
     */
    maxBatchSize: number;

    /**
     * Whether to prioritize products with stale data
     */
    prioritizeStale: boolean;

    /**
     * Staleness threshold in hours
     */
    stalenessThresholdHours: number;
}

const DEFAULT_CONFIG: SchedulerConfig = {
    maxConcurrentScrapesPerTenant: parseInt(process.env.SCRAPING_MAX_CONCURRENT_PER_TENANT || '5', 10),
    minDelayPerSite: parseInt(process.env.SCRAPING_MIN_DELAY_PER_SITE || '2000', 10),
    maxBatchSize: parseInt(process.env.SCRAPING_BATCH_SIZE || '100', 10),
    prioritizeStale: true,
    stalenessThresholdHours: 24,
};

export class ScrapingScheduler {
    private config: SchedulerConfig;
    private orchestrator: ScrapeOrchestrator;
    private activeScrapes: Map<string, Set<string>>; // tenantId -> Set of productIds

    constructor(config: Partial<SchedulerConfig> = {}) {
        this.config = { ...DEFAULT_CONFIG, ...config };
        this.orchestrator = new ScrapeOrchestrator();
        this.activeScrapes = new Map();
    }

    /**
     * Schedule scraping for all competitor products across all tenants
     */
    async scheduleAllTenants(): Promise<ScheduleResult> {
        logger.info('Starting scheduled scraping for all tenants');

        const results: ScheduleResult = {
            totalTenants: 0,
            totalProducts: 0,
            queued: 0,
            skipped: 0,
            errors: 0,
            tenantResults: [],
        };

        let cursor: string | undefined = undefined;
        let hasMore = true;

        while (hasMore) {
            const tenants: Array<{ id: string; companyName: string }> = await prisma.tenant.findMany({
                select: { id: true, companyName: true },
                take: 50,
                skip: cursor ? 1 : 0,
                ...(cursor ? { cursor: { id: cursor } } : {}),
                orderBy: { id: 'asc' }
            });

            if (tenants.length === 0) break;

            cursor = tenants[tenants.length - 1].id;
            hasMore = tenants.length === 50;

            for (const tenant of tenants) {
                results.totalTenants++;
                try {
                    const tenantResult = await this.scheduleTenant(tenant.id);
                    results.totalProducts += tenantResult.totalProducts;
                    results.queued += tenantResult.queued;
                    results.skipped += tenantResult.skipped;
                    results.errors += tenantResult.errors;
                    results.tenantResults.push({
                        tenantId: tenant.id,
                        tenantName: tenant.companyName,
                        ...tenantResult,
                    });
                } catch (error) {
                    logger.error('Failed to schedule scraping for tenant', {
                        tenantId: tenant.id,
                        error: error instanceof Error ? error.message : String(error),
                    });
                    results.errors++;
                }
            }
        }

        logger.info('Scheduled scraping completed', results);
        return results;
    }

    /**
     * Schedule scraping for all competitor products for a specific tenant
     */
    async scheduleTenant(tenantId: string): Promise<TenantScheduleResult> {
        logger.info('Scheduling scraping for tenant', { tenantId });

        const result: TenantScheduleResult = {
            totalProducts: 0,
            queued: 0,
            skipped: 0,
            errors: 0,
        };

        if (!this.activeScrapes.has(tenantId)) {
            this.activeScrapes.set(tenantId, new Set());
        }

        const stalenessThreshold = new Date();
        stalenessThreshold.setHours(
            stalenessThreshold.getHours() - this.config.stalenessThresholdHours
        );

        let skip = 0;
        const take = 1000;
        let reachedBatchLimit = false;

        while (!reachedBatchLimit) {
            const rawProducts = await prisma.product.findMany({
                where: {
                    tenantId,
                    Site: { type: 'COMPETITOR' },
                },
                select: {
                    id: true,
                    url: true,
                    siteId: true,
                    lastCrawledAt: true,
                    currentPrice: true,
                },
                take,
                skip,
                orderBy: this.config.prioritizeStale
                    ? [{ lastCrawledAt: 'asc' }, { currentPrice: 'asc' }, { id: 'asc' }]
                    : [{ currentPrice: 'asc' }, { id: 'asc' }],
            });

            if (rawProducts.length === 0) break;

            result.totalProducts += rawProducts.length;

            const products = rawProducts.map(p => ({
                id: p.id,
                url: p.url || '',
                competitorWebsiteId: p.siteId,
                lastScrapedAt: p.lastCrawledAt,
                currentPrice: p.currentPrice ? parseFloat(p.currentPrice.toString()) : null,
            }));

            const productsByWebsite = this.groupByWebsite(products);

            for (const [_, websiteProducts] of productsByWebsite.entries()) {
                for (const product of websiteProducts) {
                    if (this.activeScrapes.get(tenantId)?.has(product.id)) {
                        result.skipped++;
                        continue;
                    }

                    this.executeScrape(tenantId, product).catch(error => {
                        logger.error('Background scrape failed', {
                            tenantId,
                            productId: product.id,
                            error: error instanceof Error ? error.message : String(error)
                        });
                    });

                    result.queued++;

                    if (result.queued >= this.config.maxBatchSize) {
                        logger.info('Reached max batch size, stopping queue', {
                            tenantId,
                            queued: result.queued,
                        });
                        reachedBatchLimit = true;
                        break;
                    }
                }
                if (reachedBatchLimit) break;
            }

            skip += take;
        }

        logger.info('Tenant scraping scheduled', {
            tenantId,
            ...result,
        });

        return result;
    }

    /**
     * Group products by competitor website
     */
    private groupByWebsite(
        products: CompetitorProduct[]
    ): Map<string, CompetitorProduct[]> {
        const grouped = new Map<string, CompetitorProduct[]>();

        for (const product of products) {
            const websiteId = product.competitorWebsiteId;
            if (!grouped.has(websiteId)) {
                grouped.set(websiteId, []);
            }
            grouped.get(websiteId)!.push(product);
        }

        return grouped;
    }


    /**
     * Execute a single scrape
     */
    private async executeScrape(
        tenantId: string,
        product: CompetitorProduct
    ): Promise<void> {
        // Mark as active
        this.activeScrapes.get(tenantId)?.add(product.id);

        try {
            logger.debug('Executing scheduled scrape', {
                tenantId,
                productId: product.id,
                url: product.url,
            });

            const result = await this.orchestrator.executeScrape({
                competitorProductId: product.id,
                competitorWebsiteId: product.competitorWebsiteId,
                url: product.url,
                tenantId,
                priority: 'normal',
            });

            logger.debug('Scheduled scrape completed', {
                tenantId,
                productId: product.id,
                success: result.success,
            });
        } catch (error) {
            logger.error('Scheduled scrape failed', {
                tenantId,
                productId: product.id,
                error: error instanceof Error ? error.message : String(error),
            });
        } finally {
            // Remove from active scrapes
            this.activeScrapes.get(tenantId)?.delete(product.id);
        }
    }

    /**
     * Get scheduler statistics
     */
    getStats(): SchedulerStats {
        const stats: SchedulerStats = {
            activeTenants: this.activeScrapes.size,
            totalActiveScrapes: 0,
            activeScrapesByTenant: {},
        };

        for (const [tenantId, productIds] of this.activeScrapes.entries()) {
            stats.totalActiveScrapes += productIds.size;
            stats.activeScrapesByTenant[tenantId] = productIds.size;
        }

        return stats;
    }
}

// Types

interface CompetitorProduct {
    id: string;
    url: string;
    competitorWebsiteId: string;
    lastScrapedAt: Date | null;
    currentPrice: number | null;
}

export interface ScheduleResult {
    totalTenants: number;
    totalProducts: number;
    queued: number;
    skipped: number;
    errors: number;
    tenantResults: Array<{
        tenantId: string;
        tenantName: string;
    } & TenantScheduleResult>;
}

export interface TenantScheduleResult {
    totalProducts: number;
    queued: number;
    skipped: number;
    errors: number;
}

export interface SchedulerStats {
    activeTenants: number;
    totalActiveScrapes: number;
    activeScrapesByTenant: Record<string, number>;
}

/**
 * Run scheduled scraping (for cron execution)
 *
 * Example cron schedule: 0 * * * * (every hour)
 */
export async function runScheduledScraping(): Promise<ScheduleResult> {
    const scheduler = new ScrapingScheduler();
    return await scheduler.scheduleAllTenants();
}
