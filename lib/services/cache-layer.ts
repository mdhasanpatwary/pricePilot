import { Redis } from "ioredis";
import { getRedisConnection } from "@/lib/queue/connection";
import { logger } from "@/lib/logger";

/**
 * Cache Layer Component for Database Optimization
 * 
 * Implements multi-layer caching strategy to reduce database load.
 * 
 * Features:
 * - Tenant-isolated cache keys
 * - TTL-based expiration
 * - Pattern-based invalidation
 * - Cache warming for frequently accessed data
 * - Hit rate monitoring and alerting
 * - Redis pub/sub for distributed invalidation
 * 
 * Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6
 */

export interface CacheStats {
    hitRate: number;
    missRate: number;
    totalKeys: number;
    memoryUsedBytes: number;
    evictions: number;
}

export interface CacheKey {
    // Generate cache key for product comparison
    productComparison(tenantId: string, filters: any): string;

    // Generate cache key for competitor products
    competitorProducts(competitorId: string): string;

    // Generate cache key for price history
    priceHistory(productId: string, range: { start: Date; end: Date }): string;
}

export class CacheLayer {
    private redis: Redis;
    private static instance: CacheLayer;
    private hitCount: number = 0;
    private missCount: number = 0;
    private readonly HIT_RATE_THRESHOLD = 0.6; // 60%
    private readonly CACHE_PREFIX = "cache:";
    private readonly STATS_KEY = "cache:stats";

    private constructor() {
        this.redis = getRedisConnection();
        this.initializeStats();
    }

    static getInstance(): CacheLayer {
        if (!CacheLayer.instance) {
            CacheLayer.instance = new CacheLayer();
        }
        return CacheLayer.instance;
    }

    /**
     * Initialize cache statistics tracking
     */
    private async initializeStats(): Promise<void> {
        try {
            const exists = await this.redis.exists(this.STATS_KEY);
            if (!exists) {
                await this.redis.hmset(this.STATS_KEY, {
                    hits: "0",
                    misses: "0",
                    lastChecked: new Date().toISOString(),
                });
            }
        } catch (error) {
            logger.error("[CacheLayer] Error initializing stats", { error });
        }
    }

    /**
     * Get cached value
     * Requirement 4.1: Tenant-specific cache keys
     */
    async get<T>(key: string): Promise<T | null> {
        try {
            const fullKey = this.buildKey(key);
            const data = await this.redis.get(fullKey);

            if (data === null) {
                this.missCount++;
                await this.incrementStat("misses");
                return null;
            }

            this.hitCount++;
            await this.incrementStat("hits");

            return JSON.parse(data) as T;
        } catch (error) {
            logger.error("[CacheLayer] Get error", { key, error });
            this.missCount++;
            return null;
        }
    }

    /**
     * Set cached value with TTL
     * Requirement 4.1: Tenant-specific cache keys
     * Requirement 4.6: Redis for distributed caching
     */
    async set<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
        try {
            const fullKey = this.buildKey(key);
            const serialized = JSON.stringify(value);

            if (ttlSeconds > 0) {
                await this.redis.setex(fullKey, ttlSeconds, serialized);
            } else {
                await this.redis.set(fullKey, serialized);
            }

            logger.debug("[CacheLayer] Set cache", { key, ttl: ttlSeconds });
        } catch (error) {
            logger.error("[CacheLayer] Set error", { key, error });
        }
    }

    /**
     * Invalidate cache entries by pattern
     * Requirement 4.2: Cache invalidation on updates
     * Requirement 4.3: Distributed invalidation
     */
    async invalidate(pattern: string): Promise<number> {
        try {
            const fullPattern = this.buildKey(pattern);
            const keys = await this.redis.keys(fullPattern);

            if (keys.length === 0) {
                return 0;
            }

            // Delete all matching keys
            await this.redis.del(...keys);

            // Publish invalidation event for distributed systems
            await this.publishInvalidation(pattern);

            logger.info("[CacheLayer] Invalidated cache entries", {
                pattern,
                count: keys.length
            });

            return keys.length;
        } catch (error) {
            logger.error("[CacheLayer] Invalidate error", { pattern, error });
            return 0;
        }
    }

    /**
     * Warm cache with frequently accessed data
     * Requirement 4.4: Cache warming
     */
    async warmCache(tenantId: string): Promise<void> {
        try {
            logger.info("[CacheLayer] Starting cache warming", { tenantId });

            // Import prisma here to avoid circular dependencies
            const { prisma } = await import("@/lib/prisma");

            // Warm product comparison data (5-minute TTL)
            const products = await prisma.userProduct.findMany({
                where: {
                    tenantId,
                    status: "active",
                },
                take: 100, // Top 100 products
                orderBy: {
                    lastSyncAt: "desc",
                },
                include: {
                    productMatches: {
                        where: { status: "active" },
                        include: {
                            competitorProduct: true,
                        },
                    },
                },
            });

            for (const product of products) {
                const cacheKey = this.keys.productComparison(tenantId, {
                    productId: product.id
                });
                await this.set(cacheKey, product, 300); // 5 minutes
            }

            // Warm competitor product data (15-minute TTL)
            const competitors = await prisma.competitorProduct.findMany({
                where: {
                    tenantId,
                },
                take: 200, // Top 200 competitor products
                orderBy: {
                    lastScrapedAt: "desc",
                },
            });

            for (const competitor of competitors) {
                const cacheKey = this.keys.competitorProducts(competitor.id);
                await this.set(cacheKey, competitor, 900); // 15 minutes
            }

            logger.info("[CacheLayer] Cache warming completed", {
                tenantId,
                productsWarmed: products.length,
                competitorsWarmed: competitors.length,
            });
        } catch (error) {
            logger.error("[CacheLayer] Cache warming error", { tenantId, error });
        }
    }

    /**
     * Get cache statistics
     * Requirement 4.5: Cache hit rate monitoring
     */
    async getCacheStats(): Promise<CacheStats> {
        try {
            const stats = await this.redis.hgetall(this.STATS_KEY);
            const hits = parseInt(stats.hits || "0");
            const misses = parseInt(stats.misses || "0");
            const total = hits + misses;

            const hitRate = total > 0 ? hits / total : 0;
            const missRate = total > 0 ? misses / total : 0;

            // Get Redis memory info
            const info = await this.redis.info("memory");
            const memoryMatch = info.match(/used_memory:(\d+)/);
            const memoryUsedBytes = memoryMatch ? parseInt(memoryMatch[1]) : 0;

            // Get eviction stats
            const evictionsMatch = info.match(/evicted_keys:(\d+)/);
            const evictions = evictionsMatch ? parseInt(evictionsMatch[1]) : 0;

            // Get total keys count
            const dbSize = await this.redis.dbsize();

            // Log warning if hit rate is below threshold
            if (hitRate < this.HIT_RATE_THRESHOLD && total > 100) {
                logger.warn("[CacheLayer] Cache hit rate below threshold", {
                    hitRate: (hitRate * 100).toFixed(2) + "%",
                    threshold: (this.HIT_RATE_THRESHOLD * 100) + "%",
                    hits,
                    misses,
                });
            }

            return {
                hitRate,
                missRate,
                totalKeys: dbSize,
                memoryUsedBytes,
                evictions,
            };
        } catch (error) {
            logger.error("[CacheLayer] Get stats error", { error });
            return {
                hitRate: 0,
                missRate: 0,
                totalKeys: 0,
                memoryUsedBytes: 0,
                evictions: 0,
            };
        }
    }

    /**
     * Cache key generators with tenant isolation
     * Requirement 4.1: Tenant-specific cache keys
     */
    readonly keys: CacheKey = {
        productComparison: (tenantId: string, filters: any): string => {
            const filterStr = JSON.stringify(filters);
            return `tenant:${tenantId}:product-comparison:${filterStr}`;
        },

        competitorProducts: (competitorId: string): string => {
            return `competitor:${competitorId}:products`;
        },

        priceHistory: (productId: string, range: { start: Date; end: Date }): string => {
            const startStr = range.start.toISOString();
            const endStr = range.end.toISOString();
            return `product:${productId}:price-history:${startStr}:${endStr}`;
        },
    };

    /**
     * Build full cache key with prefix
     */
    private buildKey(key: string): string {
        return `${this.CACHE_PREFIX}${key}`;
    }

    /**
     * Increment cache statistics
     */
    private async incrementStat(stat: "hits" | "misses"): Promise<void> {
        try {
            await this.redis.hincrby(this.STATS_KEY, stat, 1);
        } catch (error) {
            // Silently fail to avoid impacting cache operations
        }
    }

    /**
     * Publish cache invalidation event for distributed systems
     * Requirement 4.3: Distributed invalidation via pub/sub
     */
    private async publishInvalidation(pattern: string): Promise<void> {
        try {
            await this.redis.publish("cache:invalidate", pattern);
        } catch (error) {
            logger.error("[CacheLayer] Publish invalidation error", { pattern, error });
        }
    }

    /**
     * Subscribe to cache invalidation events
     * Requirement 4.3: Distributed invalidation via pub/sub
     */
    async subscribeToInvalidations(
        callback: (pattern: string) => void
    ): Promise<void> {
        try {
            // Create a separate Redis connection for subscriptions
            const subscriber = getRedisConnection().duplicate();

            subscriber.subscribe("cache:invalidate", (err) => {
                if (err) {
                    logger.error("[CacheLayer] Subscribe error", { error: err });
                } else {
                    logger.info("[CacheLayer] Subscribed to cache invalidations");
                }
            });

            subscriber.on("message", (channel, message) => {
                if (channel === "cache:invalidate") {
                    logger.debug("[CacheLayer] Received invalidation", { pattern: message });
                    callback(message);
                }
            });
        } catch (error) {
            logger.error("[CacheLayer] Subscribe setup error", { error });
        }
    }

    /**
     * Clear all cache entries (for testing/maintenance)
     */
    async clearAll(): Promise<void> {
        try {
            const keys = await this.redis.keys(`${this.CACHE_PREFIX}*`);

            if (keys.length > 0) {
                await this.redis.del(...keys);
            }

            // Reset stats
            await this.redis.hmset(this.STATS_KEY, {
                hits: "0",
                misses: "0",
                lastChecked: new Date().toISOString(),
            });

            this.hitCount = 0;
            this.missCount = 0;

            logger.info("[CacheLayer] Cleared all cache entries", { count: keys.length });
        } catch (error) {
            logger.error("[CacheLayer] Clear all error", { error });
        }
    }
}

// Export singleton instance
export const cacheLayer = CacheLayer.getInstance();
