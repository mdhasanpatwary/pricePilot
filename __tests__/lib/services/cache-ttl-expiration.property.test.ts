/**
 * Property-Based Tests for TTL Expiration Correctness
 * 
 * Feature: performance-caching
 * Property 13: TTL Expiration Correctness
 * 
 * Tests that cached items expire correctly after their TTL duration.
 * 
 * Validates: Requirements 6.1, 6.2, 6.3, 6.4, 6.5
 */

import fc from 'fast-check';
import { CacheLayer } from '@/lib/services/cache-layer';
import { Redis } from 'ioredis';

// Mock Redis
jest.mock('ioredis');

// Mock cache invalidation pub/sub
jest.mock('@/lib/services/cache-invalidation-pubsub', () => ({
    cacheInvalidationPubSub: {
        initialize: jest.fn().mockResolvedValue(undefined),
        onInvalidation: jest.fn(),
        publishInvalidation: jest.fn().mockResolvedValue(undefined),
        cleanup: jest.fn().mockResolvedValue(undefined),
    },
}));

jest.mock('@/lib/queue/connection', () => ({
    getRedisConnection: jest.fn(() => {
        const mockRedis = {
            status: 'ready',
            connect: jest.fn().mockResolvedValue(undefined),
            get: jest.fn(),
            set: jest.fn(),
            setex: jest.fn(),
            del: jest.fn(),
            keys: jest.fn().mockResolvedValue([]),
            exists: jest.fn().mockResolvedValue(0),
            hmset: jest.fn(),
            hgetall: jest.fn().mockResolvedValue({ hits: '0', misses: '0' }),
            hincrby: jest.fn(),
            info: jest.fn().mockResolvedValue('used_memory:1024\nevicted_keys:0'),
            dbsize: jest.fn().mockResolvedValue(0),
            quit: jest.fn().mockResolvedValue('OK'),
            duplicate: jest.fn(function () { return this; }),
            subscribe: jest.fn().mockResolvedValue(undefined),
            on: jest.fn(),
            publish: jest.fn().mockResolvedValue(1),
        };
        return mockRedis;
    }),
}));

describe('Property 13: TTL Expiration Correctness', () => {
    let cacheLayer: CacheLayer;
    let mockRedis: any;

    beforeEach(async () => {
        // Reset singleton
        (CacheLayer as any).instance = null;

        // Get mock Redis instance
        const { getRedisConnection } = require('@/lib/queue/connection');
        mockRedis = getRedisConnection();

        // Create cache layer instance
        cacheLayer = CacheLayer.getInstance();

        // Force Redis to be available by setting internal state
        (cacheLayer as any).isRedisAvailable = true;
        (cacheLayer as any).redis = mockRedis;
    });

    afterEach(async () => {
        await cacheLayer.cleanup();
        jest.clearAllMocks();
    });

    /**
     * Property: For any cached item with a specified TTL, after the TTL duration has elapsed,
     * cache lookups for that item must return null (cache miss), and the item must not be
     * served from cache.
     * 
     * This property tests that:
     * 1. Items are stored with correct TTL
     * 2. Items expire after TTL duration
     * 3. Expired items return null on lookup
     */
    it('should expire cached items after TTL duration', async () => {
        // Feature: performance-caching, Property 13: TTL Expiration Correctness

        await fc.assert(
            fc.asyncProperty(
                fc.string({ minLength: 1, maxLength: 50 }), // cache key
                fc.jsonValue(), // cache value
                fc.integer({ min: 1, max: 10 }), // TTL in seconds
                async (key, value, ttl) => {
                    // Setup: Mock Redis to simulate TTL expiration
                    let storedValue: any = null;
                    let expirationTime: number | null = null;

                    mockRedis.setex.mockImplementation((k: string, t: number, v: string) => {
                        storedValue = v;
                        expirationTime = Date.now() + (t * 1000);
                        return Promise.resolve('OK');
                    });

                    mockRedis.get.mockImplementation((k: string) => {
                        if (storedValue === null) {
                            return Promise.resolve(null);
                        }

                        // Simulate TTL expiration
                        if (expirationTime && Date.now() >= expirationTime) {
                            storedValue = null;
                            return Promise.resolve(null);
                        }

                        return Promise.resolve(storedValue);
                    });

                    // Action: Set cache with TTL
                    await cacheLayer.set(key, value, ttl);

                    // Verify: setex was called with correct TTL
                    expect(mockRedis.setex).toHaveBeenCalledWith(
                        expect.stringContaining(key),
                        ttl,
                        JSON.stringify(value)
                    );

                    // Verify: Item is available before expiration
                    const beforeExpiration = await cacheLayer.get(key);
                    expect(beforeExpiration).toEqual(value);

                    // Simulate time passing beyond TTL
                    if (expirationTime) {
                        // Fast-forward time by mocking Date.now()
                        const originalDateNow = Date.now;
                        Date.now = jest.fn(() => expirationTime! + 1000);

                        // Verify: Item is null after expiration
                        const afterExpiration = await cacheLayer.get(key);
                        expect(afterExpiration).toBeNull();

                        // Restore Date.now
                        Date.now = originalDateNow;
                    }
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * Property: Different cache types should have different TTLs as specified in requirements
     * 
     * Requirements:
     * - Product comparison queries: 5 minutes (300s)
     * - Product matching results: 15 minutes (900s)
     * - Competitor products: 30 minutes (1800s)
     * - Price history: 1 hour (3600s)
     * - Analytics summaries: 10 minutes (600s)
     */
    it('should use correct TTL for different cache types', async () => {
        // Feature: performance-caching, Property 13: TTL Expiration Correctness

        const cacheTypes = [
            { type: 'comparison', expectedTTL: 300 },
            { type: 'matching', expectedTTL: 900 },
            { type: 'competitor', expectedTTL: 1800 },
            { type: 'priceHistory', expectedTTL: 3600 },
            { type: 'analytics', expectedTTL: 600 },
        ];

        await fc.assert(
            fc.asyncProperty(
                fc.constantFrom(...cacheTypes),
                fc.string({ minLength: 1, maxLength: 50 }),
                fc.jsonValue(),
                async (cacheType, key, value) => {
                    // Reset mock
                    mockRedis.setex.mockClear();

                    // Action: Set cache with type-specific TTL
                    const fullKey = `${cacheType.type}:${key}`;
                    await cacheLayer.set(fullKey, value, cacheType.expectedTTL);

                    // Verify: Correct TTL was used
                    expect(mockRedis.setex).toHaveBeenCalledWith(
                        expect.stringContaining(fullKey),
                        cacheType.expectedTTL,
                        JSON.stringify(value)
                    );
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * Property: Zero or negative TTL should not set expiration
     */
    it('should handle zero or negative TTL correctly', async () => {
        // Feature: performance-caching, Property 13: TTL Expiration Correctness

        await fc.assert(
            fc.asyncProperty(
                fc.string({ minLength: 1, maxLength: 50 }),
                fc.jsonValue(),
                fc.integer({ min: -10, max: 0 }),
                async (key, value, ttl) => {
                    // Reset mocks
                    mockRedis.set.mockClear();
                    mockRedis.setex.mockClear();

                    // Action: Set cache with zero/negative TTL
                    await cacheLayer.set(key, value, ttl);

                    // Verify: set (not setex) was called for non-positive TTL
                    if (ttl <= 0) {
                        expect(mockRedis.set).toHaveBeenCalled();
                        expect(mockRedis.setex).not.toHaveBeenCalled();
                    }
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * Property: Multiple items with different TTLs should expire independently
     */
    it('should expire items independently based on their TTL', async () => {
        // Feature: performance-caching, Property 13: TTL Expiration Correctness

        await fc.assert(
            fc.asyncProperty(
                fc.array(
                    fc.record({
                        key: fc.string({ minLength: 1, maxLength: 20 }),
                        value: fc.jsonValue(),
                        ttl: fc.integer({ min: 1, max: 10 }),
                    }),
                    { minLength: 2, maxLength: 5 }
                ),
                async (items) => {
                    // Ensure unique keys
                    const uniqueItems = items.filter((item, index, self) =>
                        index === self.findIndex((t) => t.key === item.key)
                    );

                    if (uniqueItems.length < 2) {
                        return; // Skip if not enough unique items
                    }

                    // Setup: Track expiration times
                    const expirationTimes = new Map<string, number>();
                    const storedValues = new Map<string, string>();

                    mockRedis.setex.mockImplementation((k: string, t: number, v: string) => {
                        storedValues.set(k, v);
                        expirationTimes.set(k, Date.now() + (t * 1000));
                        return Promise.resolve('OK');
                    });

                    mockRedis.get.mockImplementation((k: string) => {
                        const value = storedValues.get(k);
                        if (!value) {
                            return Promise.resolve(null);
                        }

                        const expTime = expirationTimes.get(k);
                        if (expTime && Date.now() >= expTime) {
                            storedValues.delete(k);
                            return Promise.resolve(null);
                        }

                        return Promise.resolve(value);
                    });

                    // Action: Set all items with different TTLs
                    for (const item of uniqueItems) {
                        await cacheLayer.set(item.key, item.value, item.ttl);
                    }

                    // Verify: All items stored with correct TTLs
                    expect(mockRedis.setex).toHaveBeenCalledTimes(uniqueItems.length);

                    // Find item with shortest TTL
                    const shortestTTLItem = uniqueItems.reduce((min, item) =>
                        item.ttl < min.ttl ? item : min
                    );

                    // Simulate time passing beyond shortest TTL
                    const originalDateNow = Date.now;
                    const shortestExpTime = expirationTimes.get(
                        expect.stringContaining(shortestTTLItem.key)
                    );

                    if (shortestExpTime) {
                        Date.now = jest.fn(() => shortestExpTime + 1000);

                        // Verify: Item with shortest TTL is expired
                        const expiredItem = await cacheLayer.get(shortestTTLItem.key);
                        expect(expiredItem).toBeNull();

                        // Verify: Items with longer TTL are still available
                        for (const item of uniqueItems) {
                            if (item.key !== shortestTTLItem.key && item.ttl > shortestTTLItem.ttl) {
                                const stillCached = await cacheLayer.get(item.key);
                                // Should still be cached if TTL is longer
                                expect(stillCached).toBeDefined();
                            }
                        }

                        Date.now = originalDateNow;
                    }
                }
            ),
            { numRuns: 50 } // Fewer runs due to complexity
        );
    });
});
