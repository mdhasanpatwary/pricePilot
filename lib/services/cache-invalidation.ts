import { CacheEnhancedService } from "./cache-enhanced";
import { logger } from "@/lib/logger";

/**
 * Cache Invalidation Service
 * 
 * Centralized cache invalidation logic triggered by data changes.
 * Ensures cache consistency when underlying data is modified.
 * 
 * Features:
 * - Automatic invalidation on data changes
 * - Pattern-based invalidation for bulk operations
 * - Error handling with graceful degradation
 * - Comprehensive logging for debugging
 * 
 * Requirements: 2.1, 2.2, 2.3, 2.4, 2.6
 */

export class CacheInvalidationService {
    private cacheService: CacheEnhancedService;

    constructor(cacheService?: CacheEnhancedService) {
        this.cacheService = cacheService || new CacheEnhancedService();
    }

    /**
     * Invalidate caches after price update
     * 
     * When prices are updated, we need to invalidate:
     * - Comparison caches (price differences changed)
     * - Product caches (product data changed)
     * - Price history caches (new price recorded)
     * - Analytics caches (metrics affected)
     * 
     * Requirement 2.1: Price update invalidation
     * Requirement 2.6: Error handling for invalidation failures
     * 
     * @param tenantId - Tenant ID
     * @param productIds - Array of product IDs that were updated
     */
    async onPriceUpdate(tenantId: string, productIds: string[]): Promise<void> {
        try {
            logger.info('[CacheInvalidation] Price update invalidation started', {
                tenantId,
                productCount: productIds.length,
            });

            // Invalidate all affected caches in parallel
            const invalidationPromises = [
                // Invalidate comparison caches (all comparisons may be affected)
                this.cacheService.invalidateComparisons(tenantId),

                // Invalidate analytics (price changes affect metrics)
                this.cacheService.invalidateAnalytics(tenantId),

                // Invalidate each product's cache
                ...productIds.map(productId =>
                    this.cacheService.invalidateProduct(tenantId, productId)
                ),

                // Invalidate price history for each product
                ...productIds.map(productId =>
                    this.cacheService.invalidatePriceHistory(tenantId, productId)
                ),
            ];

            await Promise.allSettled(invalidationPromises);

            logger.info('[CacheInvalidation] Price update invalidation completed', {
                tenantId,
                productCount: productIds.length,
            });
        } catch (error) {
            // Log error but don't throw - invalidation failures shouldn't block operations
            logger.error('[CacheInvalidation] Price update invalidation failed', {
                tenantId,
                productIds,
                error: error instanceof Error ? error.message : String(error),
            });
        }
    }

    /**
     * Invalidate caches after product sync
     * 
     * When products are synced from user's website, we need to invalidate:
     * - Comparison caches (product data may have changed)
     * - Matching caches (new products may match differently)
     * - Analytics caches (product counts/metrics affected)
     * 
     * Requirement 2.2: Product sync invalidation
     * Requirement 2.6: Error handling for invalidation failures
     * 
     * @param tenantId - Tenant ID
     */
    async onProductSync(tenantId: string): Promise<void> {
        try {
            logger.info('[CacheInvalidation] Product sync invalidation started', {
                tenantId,
            });

            // Invalidate all product-related caches in parallel
            await Promise.allSettled([
                this.cacheService.invalidateComparisons(tenantId),
                this.cacheService.invalidateMatches(tenantId),
                this.cacheService.invalidateAnalytics(tenantId),
                // Also invalidate the generic API cache for products list
                this.cacheService.invalidateApiCache(tenantId, 'api:products'),
            ]);

            logger.info('[CacheInvalidation] Product sync invalidation completed', {
                tenantId,
            });
        } catch (error) {
            logger.error('[CacheInvalidation] Product sync invalidation failed', {
                tenantId,
                error: error instanceof Error ? error.message : String(error),
            });
        }
    }

    /**
     * Invalidate caches after match update
     * 
     * When product matches are created or updated, we need to invalidate:
     * - Matching caches (match data changed)
     * - Comparison caches (matched products affect comparisons)
     * - Product caches (product match status changed)
     * 
     * Requirement 2.3: Match update invalidation
     * Requirement 2.6: Error handling for invalidation failures
     * 
     * @param tenantId - Tenant ID
     * @param productId - Product ID that was matched
     */
    async onMatchUpdate(tenantId: string, productId: string): Promise<void> {
        try {
            logger.info('[CacheInvalidation] Match update invalidation started', {
                tenantId,
                productId,
            });

            // Invalidate matching and comparison caches in parallel
            await Promise.allSettled([
                this.cacheService.invalidateMatches(tenantId, productId),
                this.cacheService.invalidateComparisons(tenantId),
                this.cacheService.invalidateProduct(tenantId, productId),
                // Products list includes competitor pricing via matches; invalidate list cache too.
                this.cacheService.invalidateApiCache(tenantId, 'api:products'),
            ]);

            logger.info('[CacheInvalidation] Match update invalidation completed', {
                tenantId,
                productId,
            });
        } catch (error) {
            logger.error('[CacheInvalidation] Match update invalidation failed', {
                tenantId,
                productId,
                error: error instanceof Error ? error.message : String(error),
            });
        }
    }

    /**
     * Invalidate caches after competitor scrape
     * 
     * When competitor products are scraped, we need to invalidate:
     * - Competitor product caches (new data available)
     * - Comparison caches (competitor prices may have changed)
     * 
     * Requirement 2.4: Competitor scrape invalidation
     * Requirement 2.6: Error handling for invalidation failures
     * 
     * @param tenantId - Tenant ID
     * @param competitorId - Competitor website ID that was scraped
     */
    async onCompetitorScrape(tenantId: string, competitorId: string): Promise<void> {
        try {
            logger.info('[CacheInvalidation] Competitor scrape invalidation started', {
                tenantId,
                competitorId,
            });

            // Invalidate competitor product and comparison caches in parallel
            await Promise.allSettled([
                this.cacheService.invalidateCompetitorProducts(tenantId, competitorId),
                this.cacheService.invalidateComparisons(tenantId),
                // Products list surfaces competitor prices; invalidate so UI reflects new scrape results.
                this.cacheService.invalidateApiCache(tenantId, 'api:products'),
            ]);

            logger.info('[CacheInvalidation] Competitor scrape invalidation completed', {
                tenantId,
                competitorId,
            });
        } catch (error) {
            logger.error('[CacheInvalidation] Competitor scrape invalidation failed', {
                tenantId,
                competitorId,
                error: error instanceof Error ? error.message : String(error),
            });
        }
    }

    /**
     * Invalidate all caches for a tenant
     * 
     * Nuclear option - invalidates everything.
     * Use sparingly, typically for major data changes or migrations.
     * 
     * Requirement 2.5: Pattern-based invalidation
     * Requirement 2.6: Error handling for invalidation failures
     * 
     * @param tenantId - Tenant ID
     */
    async invalidateAll(tenantId: string): Promise<void> {
        try {
            logger.info('[CacheInvalidation] Full invalidation started', {
                tenantId,
            });

            await this.cacheService.invalidateAll(tenantId);

            logger.info('[CacheInvalidation] Full invalidation completed', {
                tenantId,
            });
        } catch (error) {
            logger.error('[CacheInvalidation] Full invalidation failed', {
                tenantId,
                error: error instanceof Error ? error.message : String(error),
            });
        }
    }

    /**
     * Batch invalidation for multiple product updates
     * 
     * Optimized version of onPriceUpdate for bulk operations.
     * Groups invalidations to reduce Redis calls.
     * 
     * @param tenantId - Tenant ID
     * @param productIds - Array of product IDs
     */
    async onBulkPriceUpdate(tenantId: string, productIds: string[]): Promise<void> {
        // For bulk updates, we can use the same logic as single updates
        // The Promise.allSettled already handles parallel execution efficiently
        await this.onPriceUpdate(tenantId, productIds);
    }

    /**
     * Invalidate caches for multiple matches
     * 
     * Optimized for bulk match operations.
     * 
     * @param tenantId - Tenant ID
     * @param productIds - Array of product IDs that were matched
     */
    async onBulkMatchUpdate(tenantId: string, productIds: string[]): Promise<void> {
        try {
            logger.info('[CacheInvalidation] Bulk match update invalidation started', {
                tenantId,
                productCount: productIds.length,
            });

            // For bulk operations, invalidate all matches at once
            await Promise.allSettled([
                this.cacheService.invalidateMatches(tenantId),
                this.cacheService.invalidateComparisons(tenantId),
                ...productIds.map(productId =>
                    this.cacheService.invalidateProduct(tenantId, productId)
                ),
            ]);

            logger.info('[CacheInvalidation] Bulk match update invalidation completed', {
                tenantId,
                productCount: productIds.length,
            });
        } catch (error) {
            logger.error('[CacheInvalidation] Bulk match update invalidation failed', {
                tenantId,
                productIds,
                error: error instanceof Error ? error.message : String(error),
            });
        }
    }
}

// Export singleton instance
export const cacheInvalidationService = new CacheInvalidationService();
