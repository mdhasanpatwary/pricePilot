import { CacheLayer } from "./cache-layer";
import { logger } from "@/lib/logger";
import crypto from "crypto";

/**
 * Enhanced Cache Service with Application-Specific Methods
 *
 * Extends CacheLayer with domain-specific caching operations for:
 * - Products
 * - Comparisons
 * - Matches
 * - Competitor products
 * - Price history
 * - Analytics
 *
 * Features:
 * - Tenant isolation
 * - Configurable TTLs
 * - Graceful degradation
 * - Statistics tracking
 *
 * Requirements: 1.1, 1.2, 1.3, 1.4, 5.1, 5.2, 5.3
 */

export interface ComparisonFilters {
    status?: string;
    page?: number;
    limit?: number;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
    [key: string]: any;
}

export interface CacheStats {
    hits: number;
    misses: number;
    hitRate: number;
    avgResponseTime: number;
    memoryUsage: number;
}

export class CacheEnhancedService {
    private cacheLayer: CacheLayer;
    private responseTimes: number[] = [];
    private readonly MAX_RESPONSE_TIME_SAMPLES = 1000; // Keep last 1000 samples

    // Default TTLs (in seconds)
    // Requirement 2.9.4: Cache expensive operations with appropriate TTLs
    private readonly DEFAULT_TTLS = {
        products: 300,           // 5 minutes - dashboard product lists
        comparisons: 300,        // 5 minutes
        matches: 900,            // 15 minutes
        competitorProducts: 3600, // 1 hour - competitor products in matching
        priceHistory: 3600,      // 1 hour
        analytics: 600,          // 10 minutes
        scrapingResults: 86400,  // 24 hours - scraping results
    };

    constructor(cacheLayer?: CacheLayer) {
        this.cacheLayer = cacheLayer || CacheLayer.getInstance();
    }

    /**
     * Track response time for cache operations
     */
    private trackResponseTime(startTime: number): void {
        const responseTime = Date.now() - startTime;
        this.responseTimes.push(responseTime);

        // Keep only the last MAX_RESPONSE_TIME_SAMPLES samples
        if (this.responseTimes.length > this.MAX_RESPONSE_TIME_SAMPLES) {
            this.responseTimes.shift();
        }
    }

    /**
     * Calculate average response time from tracked samples
     */
    private calculateAvgResponseTime(): number {
        if (this.responseTimes.length === 0) {
            return 0;
        }

        const sum = this.responseTimes.reduce((acc, time) => acc + time, 0);
        return sum / this.responseTimes.length;
    }

    /**
     * Build cache key with tenant isolation
     * Requirement 5.1: Tenant-specific cache keys
     */
    private buildCacheKey(tenantId: string, service: string, operation: string, params: Record<string, any>): string {
        const paramsHash = this.hashObject(params);
        return `${tenantId}:${service}:${operation}:${paramsHash}`;
    }

    /**
     * Hash object for cache key generation
     */
    private hashObject(obj: Record<string, any>): string {
        const sorted = JSON.stringify(obj, Object.keys(obj).sort());
        return crypto.createHash('md5').update(sorted).digest('hex');
    }

    // ==================== Product Caching ====================

    /**
     * Cache a product
     * Requirement 1.1: Cache infrastructure integration
     */
    async cacheProduct(tenantId: string, productId: string, data: any, ttl?: number): Promise<void> {
        try {
            const key = this.buildCacheKey(tenantId, 'products', 'get', { productId });
            await this.cacheLayer.set(key, data, ttl || this.DEFAULT_TTLS.products);
        } catch (error) {
            logger.error('[CacheEnhanced] Error caching product', { tenantId, productId, error });
        }
    }

    /**
     * Get cached product
     * Requirement 5.2: Tenant data access isolation
     */
    async getCachedProduct(tenantId: string, productId: string): Promise<any | null> {
        const startTime = Date.now();
        try {
            const key = this.buildCacheKey(tenantId, 'products', 'get', { productId });
            const result = await this.cacheLayer.get(key);
            this.trackResponseTime(startTime);
            return result;
        } catch (error) {
            logger.error('[CacheEnhanced] Error getting cached product', { tenantId, productId, error });
            this.trackResponseTime(startTime);
            return null;
        }
    }

    /**
     * Invalidate product cache
     * Requirement 5.3: Tenant-scoped cache operations
     */
    async invalidateProduct(tenantId: string, productId: string): Promise<void> {
        try {
            const pattern = `${tenantId}:products:get:*${productId}*`;
            await this.cacheLayer.invalidate(pattern);
        } catch (error) {
            logger.error('[CacheEnhanced] Error invalidating product', { tenantId, productId, error });
        }
    }

    // ==================== Comparison Caching ====================

    /**
     * Cache comparison data
     * Requirement 1.2: Cache infrastructure integration
     */
    async cacheComparison(tenantId: string, filters: ComparisonFilters, data: any, ttl?: number): Promise<void> {
        try {
            const key = this.buildCacheKey(tenantId, 'comparison', 'report', filters);
            await this.cacheLayer.set(key, data, ttl || this.DEFAULT_TTLS.comparisons);
        } catch (error) {
            logger.error('[CacheEnhanced] Error caching comparison', { tenantId, filters, error });
        }
    }

    /**
     * Get cached comparison data
     */
    async getCachedComparison(tenantId: string, filters: ComparisonFilters): Promise<any | null> {
        const startTime = Date.now();
        try {
            const key = this.buildCacheKey(tenantId, 'comparison', 'report', filters);
            const result = await this.cacheLayer.get(key);
            this.trackResponseTime(startTime);
            return result;
        } catch (error) {
            logger.error('[CacheEnhanced] Error getting cached comparison', { tenantId, filters, error });
            this.trackResponseTime(startTime);
            return null;
        }
    }

    /**
     * Invalidate all comparison caches for a tenant
     */
    async invalidateComparisons(tenantId: string): Promise<void> {
        try {
            const pattern = `${tenantId}:comparison:*`;
            await this.cacheLayer.invalidate(pattern);
        } catch (error) {
            logger.error('[CacheEnhanced] Error invalidating comparisons', { tenantId, error });
        }
    }

    // ==================== Matching Caching ====================

    /**
     * Cache product matches
     * Requirement 1.1: Cache infrastructure integration
     */
    async cacheMatches(tenantId: string, productId: string, matches: any, ttl?: number): Promise<void> {
        try {
            const key = this.buildCacheKey(tenantId, 'matching', 'findMatches', { productId });
            await this.cacheLayer.set(key, matches, ttl || this.DEFAULT_TTLS.matches);
        } catch (error) {
            logger.error('[CacheEnhanced] Error caching matches', { tenantId, productId, error });
        }
    }

    /**
     * Get cached product matches
     */
    async getCachedMatches(tenantId: string, productId: string): Promise<any | null> {
        const startTime = Date.now();
        try {
            const key = this.buildCacheKey(tenantId, 'matching', 'findMatches', { productId });
            const result = await this.cacheLayer.get(key);
            this.trackResponseTime(startTime);
            return result;
        } catch (error) {
            logger.error('[CacheEnhanced] Error getting cached matches', { tenantId, productId, error });
            this.trackResponseTime(startTime);
            return null;
        }
    }

    /**
     * Invalidate matching caches
     * If productId is provided, invalidate only that product's matches
     * Otherwise, invalidate all matches for the tenant
     */
    async invalidateMatches(tenantId: string, productId?: string): Promise<void> {
        try {
            const pattern = productId
                ? `${tenantId}:matching:*${productId}*`
                : `${tenantId}:matching:*`;
            await this.cacheLayer.invalidate(pattern);
        } catch (error) {
            logger.error('[CacheEnhanced] Error invalidating matches', { tenantId, productId, error });
        }
    }

    // ==================== Competitor Product Caching ====================

    /**
     * Cache competitor products
     * Requirement 1.4: Cache infrastructure integration
     */
    async cacheCompetitorProducts(tenantId: string, competitorId: string, products: any[], ttl?: number): Promise<void> {
        try {
            const key = this.buildCacheKey(tenantId, 'competitor', 'products', { competitorId });
            await this.cacheLayer.set(key, products, ttl || this.DEFAULT_TTLS.competitorProducts);
        } catch (error) {
            logger.error('[CacheEnhanced] Error caching competitor products', { tenantId, competitorId, error });
        }
    }

    /**
     * Get cached competitor products
     */
    async getCachedCompetitorProducts(tenantId: string, competitorId: string): Promise<any[] | null> {
        const startTime = Date.now();
        try {
            const key = this.buildCacheKey(tenantId, 'competitor', 'products', { competitorId });
            const result = await this.cacheLayer.get<any[]>(key);
            this.trackResponseTime(startTime);
            return result;
        } catch (error) {
            logger.error('[CacheEnhanced] Error getting cached competitor products', { tenantId, competitorId, error });
            this.trackResponseTime(startTime);
            return null;
        }
    }

    /**
     * Invalidate competitor product caches
     */
    async invalidateCompetitorProducts(tenantId: string, competitorId: string): Promise<void> {
        try {
            const pattern = `${tenantId}:competitor:products:*${competitorId}*`;
            await this.cacheLayer.invalidate(pattern);
        } catch (error) {
            logger.error('[CacheEnhanced] Error invalidating competitor products', { tenantId, competitorId, error });
        }
    }

    // ==================== Price History Caching ====================

    /**
     * Cache price history
     * Requirement 1.3: Cache infrastructure integration
     */
    async cachePriceHistory(tenantId: string, productId: string, history: any[], ttl?: number): Promise<void> {
        try {
            const key = this.buildCacheKey(tenantId, 'priceHistory', 'get', { productId });
            await this.cacheLayer.set(key, history, ttl || this.DEFAULT_TTLS.priceHistory);
        } catch (error) {
            logger.error('[CacheEnhanced] Error caching price history', { tenantId, productId, error });
        }
    }

    /**
     * Get cached price history
     */
    async getCachedPriceHistory(tenantId: string, productId: string): Promise<any[] | null> {
        const startTime = Date.now();
        try {
            const key = this.buildCacheKey(tenantId, 'priceHistory', 'get', { productId });
            const result = await this.cacheLayer.get<any[]>(key);
            this.trackResponseTime(startTime);
            return result;
        } catch (error) {
            logger.error('[CacheEnhanced] Error getting cached price history', { tenantId, productId, error });
            this.trackResponseTime(startTime);
            return null;
        }
    }

    /**
     * Invalidate price history cache
     */
    async invalidatePriceHistory(tenantId: string, productId: string): Promise<void> {
        try {
            const pattern = `${tenantId}:priceHistory:get:*${productId}*`;
            await this.cacheLayer.invalidate(pattern);
        } catch (error) {
            logger.error('[CacheEnhanced] Error invalidating price history', { tenantId, productId, error });
        }
    }

    // ==================== Analytics Caching ====================

    /**
     * Cache analytics data
     */
    async cacheAnalytics(tenantId: string, type: string, data: any, ttl?: number): Promise<void> {
        try {
            const key = this.buildCacheKey(tenantId, 'analytics', type, {});
            await this.cacheLayer.set(key, data, ttl || this.DEFAULT_TTLS.analytics);
        } catch (error) {
            logger.error('[CacheEnhanced] Error caching analytics', { tenantId, type, error });
        }
    }

    /**
     * Get cached analytics data
     */
    async getCachedAnalytics(tenantId: string, type: string): Promise<any | null> {
        const startTime = Date.now();
        try {
            const key = this.buildCacheKey(tenantId, 'analytics', type, {});
            const result = await this.cacheLayer.get(key);
            this.trackResponseTime(startTime);
            return result;
        } catch (error) {
            logger.error('[CacheEnhanced] Error getting cached analytics', { tenantId, type, error });
            this.trackResponseTime(startTime);
            return null;
        }
    }

    /**
     * Invalidate analytics caches
     */
    async invalidateAnalytics(tenantId: string): Promise<void> {
        try {
            const pattern = `${tenantId}:analytics:*`;
            await this.cacheLayer.invalidate(pattern);
        } catch (error) {
            logger.error('[CacheEnhanced] Error invalidating analytics', { tenantId, error });
        }
    }

    // ==================== Bulk Operations ====================

    /**
     * Invalidate all caches for a tenant
     * Requirement 5.3: Tenant-scoped cache operations
     */
    async invalidateAll(tenantId: string): Promise<void> {
        try {
            const pattern = `${tenantId}:*`;
            await this.cacheLayer.invalidate(pattern);

            // Also invalidate common API prefixes that are tenant-isolated
            await this.cacheLayer.invalidate(`api:products:*:${tenantId}:*`);
            await this.cacheLayer.invalidate(`api:competitors:*:${tenantId}:*`);
            await this.cacheLayer.invalidate(`api:analytics:summary:*:${tenantId}:*`);

            logger.info('[CacheEnhanced] Invalidated all caches for tenant', { tenantId });
        } catch (error) {
            logger.error('[CacheEnhanced] Error invalidating all caches', { tenantId, error });
        }
    }

    /**
     * Invalidate generic API cache with prefix and tenant isolation
     */
    async invalidateApiCache(tenantId: string, prefix: string): Promise<void> {
        try {
            // Pattern matches: prefix + any path + tenantId + any vary params
            const pattern = `${prefix}:*:${tenantId}:*`;
            await this.cacheLayer.invalidate(pattern);
        } catch (error) {
            logger.error('[CacheEnhanced] Error invalidating API cache', { tenantId, prefix, error });
        }
    }

    /**
     * Warm cache for a tenant
     * Requirement 5.5: Cache warming
     */
    async warmCache(tenantId: string, types: string[]): Promise<void> {
        try {
            // Delegate to CacheLayer's warmCache method
            await this.cacheLayer.warmCache(tenantId);
            logger.info('[CacheEnhanced] Cache warming completed', { tenantId, types });
        } catch (error) {
            logger.error('[CacheEnhanced] Error warming cache', { tenantId, types, error });
        }
    }

    // ==================== Statistics ====================

    /**
     * Get cache statistics for a tenant
     * Requirement 4.1: Cache hit rate tracking
     */
    async getStats(tenantId: string): Promise<CacheStats> {
        try {
            const stats = await this.cacheLayer.getCacheStats();

            return {
                hits: stats.hitRate * 100, // Convert to percentage
                misses: stats.missRate * 100,
                hitRate: stats.hitRate,
                avgResponseTime: this.calculateAvgResponseTime(),
                memoryUsage: stats.memoryUsedBytes,
            };
        } catch (error) {
            logger.error('[CacheEnhanced] Error getting stats', { tenantId, error });
            return {
                hits: 0,
                misses: 0,
                hitRate: 0,
                avgResponseTime: 0,
                memoryUsage: 0,
            };
        }
    }
}

// Export singleton instance
export const cacheEnhancedService = new CacheEnhancedService();
