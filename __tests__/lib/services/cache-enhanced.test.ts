/**
 * Unit tests for CacheEnhancedService
 * 
 * Tests cache operations for:
 * - Products
 * - Comparisons
 * - Matches
 * - Competitor products
 * - Price history
 * - Analytics
 * - Bulk operations
 * 
 * Requirements: 1.1, 1.2, 1.3, 1.4, 5.1, 5.2, 5.3
 */

import { CacheEnhancedService, ComparisonFilters } from '@/lib/services/cache-enhanced';
import { CacheLayer } from '@/lib/services/cache-layer';

// Mock CacheLayer
jest.mock('@/lib/services/cache-layer');

describe('CacheEnhancedService', () => {
    let cacheService: CacheEnhancedService;
    let mockCacheLayer: jest.Mocked<CacheLayer>;

    beforeEach(() => {
        // Create mock CacheLayer
        mockCacheLayer = {
            get: jest.fn(),
            set: jest.fn(),
            invalidate: jest.fn(),
            warmCache: jest.fn(),
            getCacheStats: jest.fn(),
        } as any;

        // Create service with mock
        cacheService = new CacheEnhancedService(mockCacheLayer);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('Product Caching', () => {
        const tenantId = 'tenant-123';
        const productId = 'product-456';
        const productData = { id: productId, name: 'Test Product', price: 99.99 };

        it('should cache a product', async () => {
            await cacheService.cacheProduct(tenantId, productId, productData);

            expect(mockCacheLayer.set).toHaveBeenCalledWith(
                expect.stringContaining(`${tenantId}:products:get:`),
                productData,
                300 // Default TTL
            );
        });

        it('should cache a product with custom TTL', async () => {
            await cacheService.cacheProduct(tenantId, productId, productData, 600);

            expect(mockCacheLayer.set).toHaveBeenCalledWith(
                expect.stringContaining(`${tenantId}:products:get:`),
                productData,
                600
            );
        });

        it('should get cached product', async () => {
            mockCacheLayer.get.mockResolvedValue(productData);

            const result = await cacheService.getCachedProduct(tenantId, productId);

            expect(result).toEqual(productData);
            expect(mockCacheLayer.get).toHaveBeenCalledWith(
                expect.stringContaining(`${tenantId}:products:get:`)
            );
        });

        it('should return null when product not in cache', async () => {
            mockCacheLayer.get.mockResolvedValue(null);

            const result = await cacheService.getCachedProduct(tenantId, productId);

            expect(result).toBeNull();
        });

        it('should invalidate product cache', async () => {
            await cacheService.invalidateProduct(tenantId, productId);

            expect(mockCacheLayer.invalidate).toHaveBeenCalledWith(
                expect.stringContaining(`${tenantId}:products:get:`)
            );
        });
    });

    describe('Comparison Caching', () => {
        const tenantId = 'tenant-123';
        const filters: ComparisonFilters = { status: 'active', page: 1, limit: 20 };
        const comparisonData = { products: [], total: 0 };

        it('should cache comparison data', async () => {
            await cacheService.cacheComparison(tenantId, filters, comparisonData);

            expect(mockCacheLayer.set).toHaveBeenCalledWith(
                expect.stringContaining(`${tenantId}:comparison:report:`),
                comparisonData,
                300
            );
        });

        it('should get cached comparison data', async () => {
            mockCacheLayer.get.mockResolvedValue(comparisonData);

            const result = await cacheService.getCachedComparison(tenantId, filters);

            expect(result).toEqual(comparisonData);
        });

        it('should invalidate all comparisons for tenant', async () => {
            await cacheService.invalidateComparisons(tenantId);

            expect(mockCacheLayer.invalidate).toHaveBeenCalledWith(
                `${tenantId}:comparison:*`
            );
        });
    });

    describe('Matching Caching', () => {
        const tenantId = 'tenant-123';
        const productId = 'product-456';
        const matches = [{ id: 'match-1', confidence: 0.95 }];

        it('should cache matches', async () => {
            await cacheService.cacheMatches(tenantId, productId, matches);

            expect(mockCacheLayer.set).toHaveBeenCalledWith(
                expect.stringContaining(`${tenantId}:matching:findMatches:`),
                matches,
                900
            );
        });

        it('should get cached matches', async () => {
            mockCacheLayer.get.mockResolvedValue(matches);

            const result = await cacheService.getCachedMatches(tenantId, productId);

            expect(result).toEqual(matches);
        });

        it('should invalidate specific product matches', async () => {
            await cacheService.invalidateMatches(tenantId, productId);

            expect(mockCacheLayer.invalidate).toHaveBeenCalledWith(
                expect.stringContaining(`${tenantId}:matching:`)
            );
        });

        it('should invalidate all matches for tenant', async () => {
            await cacheService.invalidateMatches(tenantId);

            expect(mockCacheLayer.invalidate).toHaveBeenCalledWith(
                `${tenantId}:matching:*`
            );
        });
    });

    describe('Competitor Product Caching', () => {
        const tenantId = 'tenant-123';
        const competitorId = 'competitor-789';
        const products = [{ id: 'comp-prod-1', price: 89.99 }];

        it('should cache competitor products', async () => {
            await cacheService.cacheCompetitorProducts(tenantId, competitorId, products);

            expect(mockCacheLayer.set).toHaveBeenCalledWith(
                expect.stringContaining(`${tenantId}:competitor:products:`),
                products,
                1800
            );
        });

        it('should get cached competitor products', async () => {
            mockCacheLayer.get.mockResolvedValue(products);

            const result = await cacheService.getCachedCompetitorProducts(tenantId, competitorId);

            expect(result).toEqual(products);
        });

        it('should invalidate competitor products', async () => {
            await cacheService.invalidateCompetitorProducts(tenantId, competitorId);

            expect(mockCacheLayer.invalidate).toHaveBeenCalledWith(
                expect.stringContaining(`${tenantId}:competitor:products:`)
            );
        });
    });

    describe('Price History Caching', () => {
        const tenantId = 'tenant-123';
        const productId = 'product-456';
        const history = [{ date: '2024-01-01', price: 99.99 }];

        it('should cache price history', async () => {
            await cacheService.cachePriceHistory(tenantId, productId, history);

            expect(mockCacheLayer.set).toHaveBeenCalledWith(
                expect.stringContaining(`${tenantId}:priceHistory:get:`),
                history,
                3600
            );
        });

        it('should get cached price history', async () => {
            mockCacheLayer.get.mockResolvedValue(history);

            const result = await cacheService.getCachedPriceHistory(tenantId, productId);

            expect(result).toEqual(history);
        });

        it('should invalidate price history', async () => {
            await cacheService.invalidatePriceHistory(tenantId, productId);

            expect(mockCacheLayer.invalidate).toHaveBeenCalledWith(
                expect.stringContaining(`${tenantId}:priceHistory:get:`)
            );
        });
    });

    describe('Analytics Caching', () => {
        const tenantId = 'tenant-123';
        const type = 'dashboard';
        const analyticsData = { totalProducts: 100, avgPrice: 150 };

        it('should cache analytics', async () => {
            await cacheService.cacheAnalytics(tenantId, type, analyticsData);

            expect(mockCacheLayer.set).toHaveBeenCalledWith(
                expect.stringContaining(`${tenantId}:analytics:${type}:`),
                analyticsData,
                600
            );
        });

        it('should get cached analytics', async () => {
            mockCacheLayer.get.mockResolvedValue(analyticsData);

            const result = await cacheService.getCachedAnalytics(tenantId, type);

            expect(result).toEqual(analyticsData);
        });

        it('should invalidate analytics', async () => {
            await cacheService.invalidateAnalytics(tenantId);

            expect(mockCacheLayer.invalidate).toHaveBeenCalledWith(
                `${tenantId}:analytics:*`
            );
        });
    });

    describe('Bulk Operations', () => {
        const tenantId = 'tenant-123';

        it('should invalidate all caches for tenant', async () => {
            await cacheService.invalidateAll(tenantId);

            expect(mockCacheLayer.invalidate).toHaveBeenCalledWith(
                `${tenantId}:*`
            );
        });

        it('should warm cache for tenant', async () => {
            await cacheService.warmCache(tenantId, ['products', 'comparisons']);

            expect(mockCacheLayer.warmCache).toHaveBeenCalledWith(tenantId);
        });
    });

    describe('Statistics', () => {
        const tenantId = 'tenant-123';

        it('should get cache statistics', async () => {
            mockCacheLayer.getCacheStats.mockResolvedValue({
                hitRate: 0.75,
                missRate: 0.25,
                totalKeys: 100,
                memoryUsedBytes: 1024000,
                evictions: 5,
            });

            const stats = await cacheService.getStats(tenantId);

            expect(stats).toEqual({
                hits: 75,
                misses: 25,
                hitRate: 0.75,
                avgResponseTime: 0,
                memoryUsage: 1024000,
            });
        });

        it('should return zero stats on error', async () => {
            mockCacheLayer.getCacheStats.mockRejectedValue(new Error('Redis error'));

            const stats = await cacheService.getStats(tenantId);

            expect(stats).toEqual({
                hits: 0,
                misses: 0,
                hitRate: 0,
                avgResponseTime: 0,
                memoryUsage: 0,
            });
        });
    });

    describe('Tenant Isolation', () => {
        it('should generate different cache keys for different tenants', async () => {
            const tenant1 = 'tenant-1';
            const tenant2 = 'tenant-2';
            const productId = 'product-123';
            const productData = { id: productId, name: 'Test' };

            await cacheService.cacheProduct(tenant1, productId, productData);
            await cacheService.cacheProduct(tenant2, productId, productData);

            const calls = mockCacheLayer.set.mock.calls;
            expect(calls[0][0]).toContain(tenant1);
            expect(calls[1][0]).toContain(tenant2);
            expect(calls[0][0]).not.toEqual(calls[1][0]);
        });
    });

    describe('Error Handling', () => {
        const tenantId = 'tenant-123';
        const productId = 'product-456';

        it('should handle cache set errors gracefully', async () => {
            mockCacheLayer.set.mockRejectedValue(new Error('Redis error'));

            await expect(
                cacheService.cacheProduct(tenantId, productId, {})
            ).resolves.not.toThrow();
        });

        it('should handle cache get errors gracefully', async () => {
            mockCacheLayer.get.mockRejectedValue(new Error('Redis error'));

            const result = await cacheService.getCachedProduct(tenantId, productId);

            expect(result).toBeNull();
        });

        it('should handle invalidation errors gracefully', async () => {
            mockCacheLayer.invalidate.mockRejectedValue(new Error('Redis error'));

            await expect(
                cacheService.invalidateProduct(tenantId, productId)
            ).resolves.not.toThrow();
        });
    });
});
