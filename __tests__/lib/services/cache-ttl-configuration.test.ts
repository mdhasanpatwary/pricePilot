/**
 * Unit Tests for TTL Configuration
 * 
 * Tests that different cache types use correct TTL values as specified in requirements.
 * 
 * Requirements:
 * - 6.1: Product comparison queries expire after 5 minutes (300s)
 * - 6.2: Product matching results expire after 15 minutes (900s)
 * - 6.3: Competitor products expire after 30 minutes (1800s)
 * - 6.4: Price history expires after 1 hour (3600s)
 * - 6.5: Analytics expire after 10 minutes (600s)
 */

import { CacheEnhancedService } from '@/lib/services/cache-enhanced';
import { CacheLayer } from '@/lib/services/cache-layer';

// Mock CacheLayer
jest.mock('@/lib/services/cache-layer');

// Mock cache invalidation pub/sub
jest.mock('@/lib/services/cache-invalidation-pubsub', () => ({
    cacheInvalidationPubSub: {
        initialize: jest.fn().mockResolvedValue(undefined),
        onInvalidation: jest.fn(),
        publishInvalidation: jest.fn().mockResolvedValue(undefined),
        cleanup: jest.fn().mockResolvedValue(undefined),
    },
}));

describe('TTL Configuration Tests', () => {
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

    describe('Requirement 6.1: Product comparison queries expire after 5 minutes', () => {
        it('should cache comparison data with 300 second TTL', async () => {
            const tenantId = 'tenant-123';
            const filters = { status: 'active', page: 1, limit: 20 };
            const comparisonData = { products: [], total: 0 };

            await cacheService.cacheComparison(tenantId, filters, comparisonData);

            expect(mockCacheLayer.set).toHaveBeenCalledWith(
                expect.any(String),
                comparisonData,
                300 // 5 minutes
            );
        });

        it('should allow custom TTL for comparison data', async () => {
            const tenantId = 'tenant-123';
            const filters = { status: 'active' };
            const comparisonData = { products: [] };
            const customTTL = 600; // 10 minutes

            await cacheService.cacheComparison(tenantId, filters, comparisonData, customTTL);

            expect(mockCacheLayer.set).toHaveBeenCalledWith(
                expect.any(String),
                comparisonData,
                customTTL
            );
        });
    });

    describe('Requirement 6.2: Product matching results expire after 15 minutes', () => {
        it('should cache matching results with 900 second TTL', async () => {
            const tenantId = 'tenant-123';
            const productId = 'product-456';
            const matches = [{ id: 'match-1', confidence: 0.95 }];

            await cacheService.cacheMatches(tenantId, productId, matches);

            expect(mockCacheLayer.set).toHaveBeenCalledWith(
                expect.any(String),
                matches,
                900 // 15 minutes
            );
        });

        it('should allow custom TTL for matching results', async () => {
            const tenantId = 'tenant-123';
            const productId = 'product-456';
            const matches = [{ id: 'match-1' }];
            const customTTL = 1800; // 30 minutes

            await cacheService.cacheMatches(tenantId, productId, matches, customTTL);

            expect(mockCacheLayer.set).toHaveBeenCalledWith(
                expect.any(String),
                matches,
                customTTL
            );
        });
    });

    describe('Requirement 6.3: Competitor products expire after 30 minutes', () => {
        it('should cache competitor products with 1800 second TTL', async () => {
            const tenantId = 'tenant-123';
            const competitorId = 'competitor-789';
            const products = [{ id: 'comp-prod-1', price: 89.99 }];

            await cacheService.cacheCompetitorProducts(tenantId, competitorId, products);

            expect(mockCacheLayer.set).toHaveBeenCalledWith(
                expect.any(String),
                products,
                1800 // 30 minutes
            );
        });

        it('should allow custom TTL for competitor products', async () => {
            const tenantId = 'tenant-123';
            const competitorId = 'competitor-789';
            const products = [{ id: 'comp-prod-1' }];
            const customTTL = 3600; // 1 hour

            await cacheService.cacheCompetitorProducts(tenantId, competitorId, products, customTTL);

            expect(mockCacheLayer.set).toHaveBeenCalledWith(
                expect.any(String),
                products,
                customTTL
            );
        });
    });

    describe('Requirement 6.4: Price history expires after 1 hour', () => {
        it('should cache price history with 3600 second TTL', async () => {
            const tenantId = 'tenant-123';
            const productId = 'product-456';
            const history = [{ date: '2024-01-01', price: 99.99 }];

            await cacheService.cachePriceHistory(tenantId, productId, history);

            expect(mockCacheLayer.set).toHaveBeenCalledWith(
                expect.any(String),
                history,
                3600 // 1 hour
            );
        });

        it('should allow custom TTL for price history', async () => {
            const tenantId = 'tenant-123';
            const productId = 'product-456';
            const history = [{ date: '2024-01-01', price: 99.99 }];
            const customTTL = 7200; // 2 hours

            await cacheService.cachePriceHistory(tenantId, productId, history, customTTL);

            expect(mockCacheLayer.set).toHaveBeenCalledWith(
                expect.any(String),
                history,
                customTTL
            );
        });
    });

    describe('Requirement 6.5: Analytics expire after 10 minutes', () => {
        it('should cache analytics with 600 second TTL', async () => {
            const tenantId = 'tenant-123';
            const type = 'dashboard';
            const analyticsData = { totalProducts: 100, avgPrice: 150 };

            await cacheService.cacheAnalytics(tenantId, type, analyticsData);

            expect(mockCacheLayer.set).toHaveBeenCalledWith(
                expect.any(String),
                analyticsData,
                600 // 10 minutes
            );
        });

        it('should allow custom TTL for analytics', async () => {
            const tenantId = 'tenant-123';
            const type = 'dashboard';
            const analyticsData = { totalProducts: 100 };
            const customTTL = 1200; // 20 minutes

            await cacheService.cacheAnalytics(tenantId, type, analyticsData, customTTL);

            expect(mockCacheLayer.set).toHaveBeenCalledWith(
                expect.any(String),
                analyticsData,
                customTTL
            );
        });
    });

    describe('Product caching TTL', () => {
        it('should cache products with 300 second TTL (default)', async () => {
            const tenantId = 'tenant-123';
            const productId = 'product-456';
            const productData = { id: productId, name: 'Test Product', price: 99.99 };

            await cacheService.cacheProduct(tenantId, productId, productData);

            expect(mockCacheLayer.set).toHaveBeenCalledWith(
                expect.any(String),
                productData,
                300 // 5 minutes (default for products)
            );
        });

        it('should allow custom TTL for products', async () => {
            const tenantId = 'tenant-123';
            const productId = 'product-456';
            const productData = { id: productId, name: 'Test Product' };
            const customTTL = 600; // 10 minutes

            await cacheService.cacheProduct(tenantId, productId, productData, customTTL);

            expect(mockCacheLayer.set).toHaveBeenCalledWith(
                expect.any(String),
                productData,
                customTTL
            );
        });
    });

    describe('TTL Configuration Summary', () => {
        it('should use correct default TTLs for all cache types', async () => {
            const tenantId = 'tenant-123';

            // Test all cache types with default TTLs
            await cacheService.cacheProduct(tenantId, 'prod-1', {});
            await cacheService.cacheComparison(tenantId, {}, {});
            await cacheService.cacheMatches(tenantId, 'prod-1', []);
            await cacheService.cacheCompetitorProducts(tenantId, 'comp-1', []);
            await cacheService.cachePriceHistory(tenantId, 'prod-1', []);
            await cacheService.cacheAnalytics(tenantId, 'dashboard', {});

            const calls = mockCacheLayer.set.mock.calls;

            // Verify TTLs
            expect(calls[0][2]).toBe(300);  // Product: 5 minutes
            expect(calls[1][2]).toBe(300);  // Comparison: 5 minutes
            expect(calls[2][2]).toBe(900);  // Matches: 15 minutes
            expect(calls[3][2]).toBe(1800); // Competitor products: 30 minutes
            expect(calls[4][2]).toBe(3600); // Price history: 1 hour
            expect(calls[5][2]).toBe(600);  // Analytics: 10 minutes
        });
    });
});
