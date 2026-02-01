import { CacheLayer } from "@/lib/services/cache-layer";
import { getRedisConnection } from "@/lib/queue/connection";

// Mock Redis connection
jest.mock("@/lib/queue/connection");
jest.mock("@/lib/logger");

describe("CacheLayer", () => {
    let cacheLayer: CacheLayer;
    let mockRedis: any;

    beforeEach(() => {
        // Create mock Redis instance
        mockRedis = {
            get: jest.fn(),
            set: jest.fn(),
            setex: jest.fn(),
            del: jest.fn(),
            keys: jest.fn(),
            exists: jest.fn(),
            hmset: jest.fn(),
            hgetall: jest.fn(),
            hincrby: jest.fn(),
            publish: jest.fn(),
            subscribe: jest.fn(),
            on: jest.fn(),
            duplicate: jest.fn(),
            info: jest.fn(),
            dbsize: jest.fn(),
            connect: jest.fn().mockResolvedValue(undefined),
            quit: jest.fn().mockResolvedValue(undefined),
            status: 'ready', // Mock Redis as ready
        };

        // Mock duplicate to return another mock Redis instance
        mockRedis.duplicate.mockReturnValue({
            subscribe: jest.fn(),
            on: jest.fn(),
        });

        (getRedisConnection as jest.Mock).mockReturnValue(mockRedis);

        // Reset singleton instance
        CacheLayer.resetInstance();
        cacheLayer = CacheLayer.getInstance();

        // Manually set Redis as available for tests
        (cacheLayer as any).isRedisAvailable = true;
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe("Singleton Pattern", () => {
        it("should return the same instance", () => {
            const instance1 = CacheLayer.getInstance();
            const instance2 = CacheLayer.getInstance();
            expect(instance1).toBe(instance2);
        });
    });

    describe("get() - Requirement 4.1", () => {
        it("should retrieve cached value and increment hit count", async () => {
            const testData = { id: 1, name: "Test Product" };
            mockRedis.get.mockResolvedValue(JSON.stringify(testData));
            mockRedis.hincrby.mockResolvedValue(1);

            const result = await cacheLayer.get("test-key");

            expect(result).toEqual(testData);
            expect(mockRedis.get).toHaveBeenCalledWith("cache:test-key");
            expect(mockRedis.hincrby).toHaveBeenCalledWith("cache:stats", "hits", 1);
        });

        it("should return null for cache miss and increment miss count", async () => {
            mockRedis.get.mockResolvedValue(null);
            mockRedis.hincrby.mockResolvedValue(1);

            const result = await cacheLayer.get("missing-key");

            expect(result).toBeNull();
            expect(mockRedis.hincrby).toHaveBeenCalledWith("cache:stats", "misses", 1);
        });

        it("should handle errors gracefully", async () => {
            mockRedis.get.mockRejectedValue(new Error("Redis error"));
            mockRedis.hincrby.mockResolvedValue(1);

            const result = await cacheLayer.get("error-key");

            expect(result).toBeNull();
        });
    });

    describe("set() - Requirements 4.1, 4.6", () => {
        it("should cache value with TTL", async () => {
            const testData = { id: 1, name: "Test Product" };
            mockRedis.setex.mockResolvedValue("OK");

            await cacheLayer.set("test-key", testData, 300);

            expect(mockRedis.setex).toHaveBeenCalledWith(
                "cache:test-key",
                300,
                JSON.stringify(testData)
            );
        });

        it("should cache value without TTL when ttl is 0", async () => {
            const testData = { id: 1, name: "Test Product" };
            mockRedis.set.mockResolvedValue("OK");

            await cacheLayer.set("test-key", testData, 0);

            expect(mockRedis.set).toHaveBeenCalledWith(
                "cache:test-key",
                JSON.stringify(testData)
            );
        });

        it("should handle errors gracefully", async () => {
            mockRedis.setex.mockRejectedValue(new Error("Redis error"));

            await expect(
                cacheLayer.set("error-key", { data: "test" }, 60)
            ).resolves.not.toThrow();
        });
    });

    describe("invalidate() - Requirements 4.2, 4.3", () => {
        it("should invalidate cache entries by pattern", async () => {
            mockRedis.keys.mockResolvedValue([
                "cache:tenant:123:product:1",
                "cache:tenant:123:product:2",
            ]);
            mockRedis.del.mockResolvedValue(2);
            mockRedis.publish.mockResolvedValue(1);

            const count = await cacheLayer.invalidate("tenant:123:product:*");

            expect(count).toBe(2);
            expect(mockRedis.keys).toHaveBeenCalledWith("cache:tenant:123:product:*");
            expect(mockRedis.del).toHaveBeenCalledWith(
                "cache:tenant:123:product:1",
                "cache:tenant:123:product:2"
            );
            expect(mockRedis.publish).toHaveBeenCalledWith(
                "cache:invalidate",
                "tenant:123:product:*"
            );
        });

        it("should return 0 when no keys match pattern", async () => {
            mockRedis.keys.mockResolvedValue([]);

            const count = await cacheLayer.invalidate("nonexistent:*");

            expect(count).toBe(0);
            expect(mockRedis.del).not.toHaveBeenCalled();
        });

        it("should handle errors gracefully", async () => {
            mockRedis.keys.mockRejectedValue(new Error("Redis error"));

            const count = await cacheLayer.invalidate("error:*");

            expect(count).toBe(0);
        });
    });

    describe("getCacheStats() - Requirement 4.5", () => {
        it("should return cache statistics with hit rate", async () => {
            mockRedis.hgetall.mockResolvedValue({
                hits: "600",
                misses: "400",
            });
            mockRedis.info.mockResolvedValue(
                "used_memory:1048576\nevicted_keys:10"
            );
            mockRedis.dbsize.mockResolvedValue(150);

            const stats = await cacheLayer.getCacheStats();

            expect(stats.hitRate).toBe(0.6); // 600 / 1000
            expect(stats.missRate).toBe(0.4); // 400 / 1000
            expect(stats.totalKeys).toBe(150);
            expect(stats.memoryUsedBytes).toBe(1048576);
            expect(stats.evictions).toBe(10);
        });

        it("should handle zero hits and misses", async () => {
            mockRedis.hgetall.mockResolvedValue({
                hits: "0",
                misses: "0",
            });
            mockRedis.info.mockResolvedValue("used_memory:0\nevicted_keys:0");
            mockRedis.dbsize.mockResolvedValue(0);

            const stats = await cacheLayer.getCacheStats();

            expect(stats.hitRate).toBe(0);
            expect(stats.missRate).toBe(0);
        });

        it("should handle errors gracefully", async () => {
            mockRedis.hgetall.mockRejectedValue(new Error("Redis error"));

            const stats = await cacheLayer.getCacheStats();

            expect(stats.hitRate).toBe(0);
            expect(stats.totalKeys).toBe(0);
        });
    });

    describe("Cache Key Generators - Requirement 4.1", () => {
        it("should generate tenant-specific product comparison key", () => {
            const key = cacheLayer.keys.productComparison("tenant-123", {
                status: "active",
                minPrice: 100,
            });

            expect(key).toContain("tenant:tenant-123");
            expect(key).toContain("product-comparison");
            expect(key).toContain("status");
        });

        it("should generate competitor products key", () => {
            const key = cacheLayer.keys.competitorProducts("competitor-456");

            expect(key).toBe("competitor:competitor-456:products");
        });

        it("should generate price history key with date range", () => {
            const start = new Date("2024-01-01");
            const end = new Date("2024-01-31");
            const key = cacheLayer.keys.priceHistory("product-789", { start, end });

            expect(key).toContain("product:product-789:price-history");
            expect(key).toContain("2024-01-01");
            expect(key).toContain("2024-01-31");
        });
    });

    describe("warmCache() - Requirement 4.4", () => {
        it("should warm cache with frequently accessed data", async () => {
            // Mock prisma import
            const mockPrisma = {
                userProduct: {
                    findMany: jest.fn().mockResolvedValue([
                        {
                            id: "1",
                            name: "Product 1",
                            productMatches: [],
                        },
                    ]),
                },
                competitorProduct: {
                    findMany: jest.fn().mockResolvedValue([
                        {
                            id: "comp-1",
                            name: "Competitor Product 1",
                        },
                    ]),
                },
            };

            jest.doMock("@/lib/prisma", () => ({
                prisma: mockPrisma,
            }));

            mockRedis.setex.mockResolvedValue("OK");

            await cacheLayer.warmCache("tenant-123");

            // Verify cache warming was attempted
            expect(mockRedis.setex).toHaveBeenCalled();
        });

        it("should handle errors during cache warming", async () => {
            const mockPrisma = {
                userProduct: {
                    findMany: jest.fn().mockRejectedValue(new Error("DB error")),
                },
            };

            jest.doMock("@/lib/prisma", () => ({
                prisma: mockPrisma,
            }));

            await expect(
                cacheLayer.warmCache("tenant-123")
            ).resolves.not.toThrow();
        });
    });

    describe("subscribeToInvalidations() - Requirement 4.3", () => {
        it("should subscribe to cache invalidation events", async () => {
            const mockSubscriber = {
                subscribe: jest.fn((channel, callback) => callback(null)),
                on: jest.fn(),
            };
            mockRedis.duplicate.mockReturnValue(mockSubscriber);

            const callback = jest.fn();
            await cacheLayer.subscribeToInvalidations(callback);

            expect(mockSubscriber.subscribe).toHaveBeenCalledWith(
                "cache:invalidate",
                expect.any(Function)
            );
        });

        it("should handle subscription errors", async () => {
            const mockSubscriber = {
                subscribe: jest.fn((channel, callback) =>
                    callback(new Error("Subscribe error"))
                ),
                on: jest.fn(),
            };
            mockRedis.duplicate.mockReturnValue(mockSubscriber);

            const callback = jest.fn();
            await expect(
                cacheLayer.subscribeToInvalidations(callback)
            ).resolves.not.toThrow();
        });
    });

    describe("clearAll()", () => {
        it("should clear all cache entries and reset stats", async () => {
            mockRedis.keys.mockResolvedValue([
                "cache:key1",
                "cache:key2",
                "cache:key3",
            ]);
            mockRedis.del.mockResolvedValue(3);
            mockRedis.hmset.mockResolvedValue("OK");

            await cacheLayer.clearAll();

            expect(mockRedis.keys).toHaveBeenCalledWith("cache:*");
            expect(mockRedis.del).toHaveBeenCalledWith(
                "cache:key1",
                "cache:key2",
                "cache:key3"
            );
            expect(mockRedis.hmset).toHaveBeenCalledWith(
                "cache:stats",
                expect.objectContaining({
                    hits: "0",
                    misses: "0",
                })
            );
        });

        it("should handle empty cache", async () => {
            mockRedis.keys.mockResolvedValue([]);
            mockRedis.hmset.mockResolvedValue("OK");

            await cacheLayer.clearAll();

            expect(mockRedis.del).not.toHaveBeenCalled();
        });
    });

    describe("Integration Scenarios", () => {
        it("should handle complete cache lifecycle", async () => {
            // Set cache
            mockRedis.setex.mockResolvedValue("OK");
            await cacheLayer.set("test-key", { data: "value" }, 60);

            // Get cache (hit)
            mockRedis.get.mockResolvedValue(JSON.stringify({ data: "value" }));
            mockRedis.hincrby.mockResolvedValue(1);
            const result = await cacheLayer.get("test-key");
            expect(result).toEqual({ data: "value" });

            // Invalidate cache
            mockRedis.keys.mockResolvedValue(["cache:test-key"]);
            mockRedis.del.mockResolvedValue(1);
            mockRedis.publish.mockResolvedValue(1);
            const count = await cacheLayer.invalidate("test-*");
            expect(count).toBe(1);

            // Get cache (miss)
            mockRedis.get.mockResolvedValue(null);
            const missResult = await cacheLayer.get("test-key");
            expect(missResult).toBeNull();
        });
    });
});
