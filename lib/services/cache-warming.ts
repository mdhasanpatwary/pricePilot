import { PrismaClient } from "@prisma/client";
import { CacheEnhancedService } from "./cache-enhanced";
import { ComparisonService } from "./comparison";
import { logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";

/**
 * Cache Warming Service
 *
 * Proactively loads frequently accessed data into cache to improve
 * user experience and reduce database load.
 *
 * Features:
 * - Warm active products on tenant login
 * - Warm dashboard analytics data
 * - Warm recent comparisons
 * - Scheduled warming for off-peak hours
 * - Error handling to prevent blocking user requests
 *
 * Requirements: 3.1, 3.2, 3.3, 3.5
 */

export class CacheWarmingService {
    private cacheService: CacheEnhancedService;
    private comparisonService: ComparisonService;
    private db: PrismaClient;

    constructor(
        cacheService?: CacheEnhancedService,
        comparisonService?: ComparisonService,
        db?: PrismaClient
    ) {
        this.cacheService = cacheService || new CacheEnhancedService();
        this.comparisonService = comparisonService || new ComparisonService();
        this.db = db || prisma;
    }

    /**
     * Warm cache for a tenant with active products and analytics
     * Requirement 3.3: Warm top 100 products per tenant
     */
    async warmTenantCache(tenantId: string): Promise<void> {
        try {
            logger.info('[CacheWarming] Starting tenant cache warming', { tenantId });

            // Warm active products (top 100 most recently synced)
            await this.warmActiveProducts(tenantId, 100);

            // Warm recent comparisons
            await this.warmRecentComparisons(tenantId);

            // Warm analytics
            await this.warmAnalytics(tenantId);

            logger.info('[CacheWarming] Tenant cache warming completed', { tenantId });
        } catch (error) {
            // Requirement 3.5: Error handling to prevent blocking
            logger.error('[CacheWarming] Tenant cache warming failed', {
                tenantId,
                error: error instanceof Error ? error.message : String(error)
            });
            // Don't throw - warming failures should not block operations
        }
    }

    /**
     * Warm essential data when user logs in
     * Requirement 3.1: Warm cache on tenant login
     */
    async warmOnLogin(tenantId: string): Promise<void> {
        try {
            logger.info('[CacheWarming] Starting login cache warming', { tenantId });

            // Fire and forget - don't block login
            Promise.all([
                this.warmDashboardData(tenantId),
                this.warmRecentProducts(tenantId, 20)
            ]).catch(error => {
                // Requirement 3.5: Error handling to prevent blocking
                logger.error('[CacheWarming] Login cache warming failed', {
                    tenantId,
                    error: error instanceof Error ? error.message : String(error)
                });
            });

            logger.debug('[CacheWarming] Login cache warming initiated (async)', { tenantId });
        } catch (error) {
            // Requirement 3.5: Error handling to prevent blocking
            logger.error('[CacheWarming] Failed to initiate login cache warming', {
                tenantId,
                error: error instanceof Error ? error.message : String(error)
            });
            // Don't throw - warming failures should not block login
        }
    }

    /**
     * Warm dashboard analytics data
     * Requirement 3.1: Warm essential data on login
     */
    async warmDashboardData(tenantId: string): Promise<void> {
        try {
            logger.debug('[CacheWarming] Warming dashboard data', { tenantId });

            // Compute dashboard analytics
            const analytics = await this.computeDashboardAnalytics(tenantId);

            // Cache analytics with 10-minute TTL
            await this.cacheService.cacheAnalytics(tenantId, 'dashboard', analytics, 600);

            logger.debug('[CacheWarming] Dashboard data warmed', { tenantId });
        } catch (error) {
            // Requirement 3.5: Error handling to prevent blocking
            logger.error('[CacheWarming] Dashboard warming failed', {
                tenantId,
                error: error instanceof Error ? error.message : String(error)
            });
            // Don't throw - warming failures should not block operations
        }
    }

    /**
     * Scheduled cache warming for off-peak hours
     * Requirement 3.3: Daily warming of top products
     */
    async scheduledWarming(): Promise<void> {
        try {
            logger.info('[CacheWarming] Starting scheduled cache warming');

            // Get all active tenants
            const tenants = await this.getActiveTenants();

            logger.info('[CacheWarming] Found active tenants', { count: tenants.length });

            // Warm cache for each tenant
            for (const tenant of tenants) {
                try {
                    await this.warmTenantCache(tenant.id);
                } catch (error) {
                    // Requirement 3.5: Error handling to prevent blocking
                    logger.error('[CacheWarming] Scheduled warming failed for tenant', {
                        tenantId: tenant.id,
                        error: error instanceof Error ? error.message : String(error)
                    });
                    // Continue with next tenant
                }
            }

            logger.info('[CacheWarming] Scheduled cache warming completed');
        } catch (error) {
            logger.error('[CacheWarming] Scheduled warming failed', {
                error: error instanceof Error ? error.message : String(error)
            });
            // Don't throw - warming failures should not block operations
        }
    }

    /**
     * Warm active products for a tenant
     * Private helper method
     */
    private async warmActiveProducts(tenantId: string, limit: number = 100): Promise<void> {
        try {
            logger.debug('[CacheWarming] Warming active products', { tenantId, limit });

            // Get active user products (most recently synced)
            const activeProducts = await this.db.product.findMany({
                where: {
                    tenantId,
                    Site: { type: 'USER' },
                    inStock: true
                },
                take: limit,
                orderBy: { updatedAt: 'desc' },
                include: {
                    Site: true,
                    matchesAsUser: {
                        include: {
                            competitorProduct: {
                                include: {
                                    Site: true
                                }
                            }
                        }
                    }
                }
            });

            logger.debug('[CacheWarming] Found active products', {
                tenantId,
                count: activeProducts.length
            });

            // Cache each product
            for (const product of activeProducts) {
                try {
                    await this.cacheService.cacheProduct(tenantId, product.id, product);
                } catch (error) {
                    logger.warn('[CacheWarming] Failed to cache product', {
                        tenantId,
                        productId: product.id,
                        error: error instanceof Error ? error.message : String(error)
                    });
                    // Continue with next product
                }
            }

            logger.debug('[CacheWarming] Active products warmed', { tenantId });
        } catch (error) {
            logger.error('[CacheWarming] Failed to warm active products', {
                tenantId,
                error: error instanceof Error ? error.message : String(error)
            });
            throw error;
        }
    }

    /**
     * Warm recent products for a tenant
     * Private helper method
     */
    private async warmRecentProducts(tenantId: string, limit: number = 20): Promise<void> {
        try {
            logger.debug('[CacheWarming] Warming recent products', { tenantId, limit });

            // Get recently updated products
            const recentProducts = await this.db.product.findMany({
                where: {
                    tenantId,
                    Site: { type: 'USER' }
                },
                take: limit,
                orderBy: { updatedAt: 'desc' },
                include: {
                    Site: true,
                    matchesAsUser: {
                        include: {
                            competitorProduct: {
                                include: {
                                    Site: true
                                }
                            }
                        }
                    }
                }
            });

            logger.debug('[CacheWarming] Found recent products', {
                tenantId,
                count: recentProducts.length
            });

            // Cache each product
            for (const product of recentProducts) {
                try {
                    await this.cacheService.cacheProduct(tenantId, product.id, product);
                } catch (error) {
                    logger.warn('[CacheWarming] Failed to cache recent product', {
                        tenantId,
                        productId: product.id,
                        error: error instanceof Error ? error.message : String(error)
                    });
                    // Continue with next product
                }
            }

            logger.debug('[CacheWarming] Recent products warmed', { tenantId });
        } catch (error) {
            logger.error('[CacheWarming] Failed to warm recent products', {
                tenantId,
                error: error instanceof Error ? error.message : String(error)
            });
            throw error;
        }
    }

    /**
     * Warm recent comparison queries
     * Requirement 3.2: Warm related competitor products on comparison request
     * Private helper method
     */
    private async warmRecentComparisons(tenantId: string): Promise<void> {
        try {
            logger.debug('[CacheWarming] Warming recent comparisons', { tenantId });

            // Get comparison report with default filters
            const report = await this.comparisonService.getComparisonReport(tenantId, {
                page: 1,
                limit: 20,
                sortBy: 'updatedAt',
                sortOrder: 'desc'
            });

            logger.debug('[CacheWarming] Recent comparisons warmed', {
                tenantId,
                productsCount: report.products.length
            });

            // Warm competitor products from the comparison
            await this.warmCompetitorProductsFromComparison(tenantId, report.products);
        } catch (error) {
            logger.error('[CacheWarming] Failed to warm recent comparisons', {
                tenantId,
                error: error instanceof Error ? error.message : String(error)
            });
            throw error;
        }
    }

    /**
     * Warm competitor products from comparison results
     * Requirement 3.2: Warm related competitor products
     * Private helper method
     */
    private async warmCompetitorProductsFromComparison(
        tenantId: string,
        products: any[]
    ): Promise<void> {
        try {
            logger.debug('[CacheWarming] Warming competitor products from comparison', {
                tenantId,
                productsCount: products.length
            });

            // Extract unique competitor site IDs
            const competitorSiteIds = new Set<string>();
            for (const product of products) {
                for (const match of product.allMatches || []) {
                    if (match.id) {
                        competitorSiteIds.add(match.id);
                    }
                }
            }

            logger.debug('[CacheWarming] Found competitor sites', {
                tenantId,
                count: competitorSiteIds.size
            });

            // Warm competitor products for each site
            for (const siteId of competitorSiteIds) {
                try {
                    const competitorProducts = await this.db.product.findMany({
                        where: {
                            tenantId,
                            siteId: siteId,
                            Site: { type: 'COMPETITOR' }
                        },
                        take: 50,
                        orderBy: { updatedAt: 'desc' }
                    });

                    await this.cacheService.cacheCompetitorProducts(
                        tenantId,
                        siteId,
                        competitorProducts
                    );
                } catch (error) {
                    logger.warn('[CacheWarming] Failed to cache competitor products', {
                        tenantId,
                        siteId,
                        error: error instanceof Error ? error.message : String(error)
                    });
                    // Continue with next site
                }
            }

            logger.debug('[CacheWarming] Competitor products warmed', { tenantId });
        } catch (error) {
            logger.error('[CacheWarming] Failed to warm competitor products', {
                tenantId,
                error: error instanceof Error ? error.message : String(error)
            });
            throw error;
        }
    }

    /**
     * Warm analytics data for a tenant
     * Private helper method
     */
    private async warmAnalytics(tenantId: string): Promise<void> {
        try {
            logger.debug('[CacheWarming] Warming analytics', { tenantId });

            // Compute and cache various analytics types
            const analyticsTypes = ['dashboard', 'pricing', 'competition'];

            for (const type of analyticsTypes) {
                try {
                    const analytics = await this.computeAnalytics(tenantId, type);
                    await this.cacheService.cacheAnalytics(tenantId, type, analytics, 600);
                } catch (error) {
                    logger.warn('[CacheWarming] Failed to cache analytics', {
                        tenantId,
                        type,
                        error: error instanceof Error ? error.message : String(error)
                    });
                    // Continue with next analytics type
                }
            }

            logger.debug('[CacheWarming] Analytics warmed', { tenantId });
        } catch (error) {
            logger.error('[CacheWarming] Failed to warm analytics', {
                tenantId,
                error: error instanceof Error ? error.message : String(error)
            });
            throw error;
        }
    }

    /**
     * Compute dashboard analytics
     * Private helper method
     */
    private async computeDashboardAnalytics(tenantId: string): Promise<any> {
        try {
            // Get product counts
            const totalProducts = await this.db.product.count({
                where: {
                    tenantId,
                    Site: { type: 'USER' }
                }
            });

            const activeProducts = await this.db.product.count({
                where: {
                    tenantId,
                    Site: { type: 'USER' },
                    inStock: true
                }
            });

            // Get match statistics
            const totalMatches = await this.db.productMatch.count({
                where: {
                    userProduct: { tenantId }
                }
            });

            // Get competitor count
            const competitorCount = await this.db.site.count({
                where: {
                    tenantId,
                    type: 'COMPETITOR'
                }
            });

            return {
                totalProducts,
                activeProducts,
                totalMatches,
                competitorCount,
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            logger.error('[CacheWarming] Failed to compute dashboard analytics', {
                tenantId,
                error: error instanceof Error ? error.message : String(error)
            });
            throw error;
        }
    }

    /**
     * Compute analytics by type
     * Private helper method
     */
    private async computeAnalytics(tenantId: string, type: string): Promise<any> {
        try {
            switch (type) {
                case 'dashboard':
                    return await this.computeDashboardAnalytics(tenantId);

                case 'pricing':
                    return await this.computePricingAnalytics(tenantId);

                case 'competition':
                    return await this.computeCompetitionAnalytics(tenantId);

                default:
                    logger.warn('[CacheWarming] Unknown analytics type', { tenantId, type });
                    return {};
            }
        } catch (error) {
            logger.error('[CacheWarming] Failed to compute analytics', {
                tenantId,
                type,
                error: error instanceof Error ? error.message : String(error)
            });
            throw error;
        }
    }

    /**
     * Compute pricing analytics
     * Private helper method
     */
    private async computePricingAnalytics(tenantId: string): Promise<any> {
        try {
            // Get average prices
            const avgUserPrice = await this.db.product.aggregate({
                where: {
                    tenantId,
                    Site: { type: 'USER' },
                    inStock: true
                },
                _avg: {
                    currentPrice: true
                }
            });

            const avgCompetitorPrice = await this.db.product.aggregate({
                where: {
                    tenantId,
                    Site: { type: 'COMPETITOR' },
                    inStock: true
                },
                _avg: {
                    currentPrice: true
                }
            });

            return {
                avgUserPrice: avgUserPrice?._avg?.currentPrice ? Number(avgUserPrice._avg.currentPrice) : 0,
                avgCompetitorPrice: avgCompetitorPrice?._avg?.currentPrice ? Number(avgCompetitorPrice._avg.currentPrice) : 0,
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            logger.error('[CacheWarming] Failed to compute pricing analytics', {
                tenantId,
                error: error instanceof Error ? error.message : String(error)
            });
            throw error;
        }
    }

    /**
     * Compute competition analytics
     * Private helper method
     */
    private async computeCompetitionAnalytics(tenantId: string): Promise<any> {
        try {
            // Get match type distribution
            const matchTypes = await this.db.productMatch.groupBy({
                by: ['matchType'],
                where: {
                    userProduct: { tenantId }
                },
                _count: true
            });

            return {
                matchTypes: matchTypes.map(m => ({
                    type: m.matchType,
                    count: m._count
                })),
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            logger.error('[CacheWarming] Failed to compute competition analytics', {
                tenantId,
                error: error instanceof Error ? error.message : String(error)
            });
            throw error;
        }
    }

    /**
     * Get active tenants for scheduled warming
     * Private helper method
     */
    private async getActiveTenants(): Promise<Array<{ id: string }>> {
        try {
            // Get tenants with recent activity (products updated in last 7 days)
            const activeTenants = await this.db.tenant.findMany({
                where: {
                    Product: {
                        some: {
                            updatedAt: {
                                gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
                            }
                        }
                    }
                },
                select: {
                    id: true
                }
            });

            return activeTenants;
        } catch (error) {
            logger.error('[CacheWarming] Failed to get active tenants', {
                error: error instanceof Error ? error.message : String(error)
            });
            throw error;
        }
    }
}

// Export singleton instance
export const cacheWarmingService = new CacheWarmingService();
