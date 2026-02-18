import type { Redis } from "ioredis";
import { getRedisConnection } from "@/lib/redis";
import { logger } from "@/lib/logger";
import { getCacheInvalidationPubSub, InvalidationEvent } from "./cache-invalidation-pubsub";

const IS_NEXT_BUILD_PHASE = process.env.NEXT_PHASE === "phase-production-build";

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
 * Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 7.2
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
    private static lastRedisUnavailableLogAt = 0;
    private static lastRedisUnavailableConsoleAt = 0;
    private redis: Redis;
    private static instance: CacheLayer;
    private hitCount: number = 0;
    private missCount: number = 0;
    private readonly HIT_RATE_THRESHOLD = 0.6; // 60%
    private readonly CACHE_PREFIX = "cache:";
    private readonly STATS_KEY = "cache:stats";
    private isRedisAvailable: boolean = false;
    private connectionCheckTimeout: NodeJS.Timeout | null = null;
    private connectionPromise: Promise<void> | null = null;
    private pubSubInitialized: boolean = false;
    private pubSubInitPromise: Promise<void> | null = null;
    private unregisterInvalidationHandler?: () => void;

    // Circuit Breaker State
    private failureCount: number = 0;
    private lastFailureTime: number = 0;
    private circuitState: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';
    private readonly FAILURE_THRESHOLD = 5;
    private readonly CIRCUIT_RESET_TIMEOUT = 30000; // 30s
    private healthCheckInterval: NodeJS.Timeout | null = null;

    private static getGlobalState() {
        const globalState = globalThis as typeof globalThis & {
            __ppCacheLayer?: CacheLayer;
        };
        return globalState;
    }

    private constructor() {
        this.redis = getRedisConnection();
        // In test mode and Next.js build phase, avoid eager Redis connect/log noise.
        if (process.env.NODE_ENV !== "test" && !IS_NEXT_BUILD_PHASE) {
            this.checkRedisConnection();
            this.initializePubSub();
            this.startHealthCheck();
        }
    }

    /**
     * Initialize pub/sub for distributed cache invalidation
     * Requirement 7.2: Distributed cache invalidation propagation
     */
    private async initializePubSub(): Promise<void> {
        if (this.pubSubInitialized) {
            return;
        }

        if (this.pubSubInitPromise) {
            await this.pubSubInitPromise;
            return;
        }

        this.pubSubInitPromise = (async () => {
        try {
            const pubSub = getCacheInvalidationPubSub();
            // Initialize pub/sub service
            await pubSub.initialize();

            // Register callback to handle invalidation events from other instances
            this.unregisterInvalidationHandler = pubSub.onInvalidation(async (event: InvalidationEvent) => {
                await this.handleRemoteInvalidation(event);
            });

            logger.info("[CacheLayer] Pub/sub initialized for distributed invalidation");
            this.pubSubInitialized = true;
        } catch (error) {
            logger.error("[CacheLayer] Failed to initialize pub/sub", { error });
            // Don't throw - application should continue without distributed invalidation
        } finally {
            this.pubSubInitPromise = null;
        }
        })();

        await this.pubSubInitPromise;
    }

    /**
     * Handle invalidation event from another instance
     * Requirement 7.2: Distributed cache invalidation propagation
     */
    private async handleRemoteInvalidation(event: InvalidationEvent): Promise<void> {
        try {
            const fullPattern = this.buildKey(event.pattern);
            const keys = await this.redis.keys(fullPattern);

            if (keys.length > 0) {
                await this.redis.del(...keys);
                logger.info("[CacheLayer] Handled remote invalidation", {
                    pattern: event.pattern,
                    keysInvalidated: keys.length,
                    fromInstance: event.instanceId
                });
            }
        } catch (error) {
            logger.error("[CacheLayer] Error handling remote invalidation", {
                pattern: event.pattern,
                error
            });
        }
    }

    /**
     * Check if Redis is available with timeout
     */
    private async checkRedisConnection(): Promise<void> {
        // Return existing connection promise if already connecting
        if (this.connectionPromise) {
            return this.connectionPromise;
        }

        this.connectionPromise = (async () => {
            try {
                // With ioredis + lazyConnect, calling `connect()` while already connecting/connected
                // throws: "Redis is already connecting/connected". That is not an outage.
                // Short-circuit based on status to avoid false "cache disabled" logs.
                if (this.redis.status === "ready") {
                    this.isRedisAvailable = true;
                    this.recordSuccess();
                    return;
                }

                // Set a timeout for connection check
                const timeoutPromise = new Promise<void>((_, reject) => {
                    this.connectionCheckTimeout = setTimeout(() => {
                        reject(new Error('Redis connection check timeout'));
                    }, 3000); // 3 second timeout
                });

                const waitForReady = () =>
                    new Promise<void>((resolve, reject) => {
                        const onReady = () => {
                            cleanup();
                            resolve();
                        };
                        const onError = (err: unknown) => {
                            cleanup();
                            reject(err);
                        };
                        const cleanup = () => {
                            this.redis.off("ready", onReady);
                            this.redis.off("error", onError as any);
                        };
                        this.redis.on("ready", onReady);
                        this.redis.on("error", onError as any);
                    });

                const connectPromise =
                    this.redis.status === "connecting" || this.redis.status === "reconnecting"
                        ? waitForReady()
                        : this.redis.connect();

                await Promise.race([connectPromise as any, timeoutPromise]);

                this.isRedisAvailable = true;
                this.recordSuccess();
                logger.info("[CacheLayer] Redis connection established");
                this.initializeStats();

                if (this.connectionCheckTimeout) {
                    clearTimeout(this.connectionCheckTimeout);
                    this.connectionCheckTimeout = null;
                }
            } catch (error) {
                this.isRedisAvailable = false;
                this.logRedisUnavailable(error);

                if (this.connectionCheckTimeout) {
                    clearTimeout(this.connectionCheckTimeout);
                    this.connectionCheckTimeout = null;
                }
            } finally {
                this.connectionPromise = null;
            }
        })();

        return this.connectionPromise;
    }

    private logRedisUnavailable(error: unknown): void {
        const now = Date.now();
        const throttleMs = Number.parseInt(process.env.CACHE_REDIS_WARN_THROTTLE_MS || "60000", 10);
        const effectiveThrottleMs = Number.isFinite(throttleMs) ? Math.max(1000, throttleMs) : 60000;

        if (now - CacheLayer.lastRedisUnavailableLogAt >= effectiveThrottleMs) {
            CacheLayer.lastRedisUnavailableLogAt = now;
            logger.warn("[CacheLayer] Redis unavailable, cache disabled", {
                message: error instanceof Error ? error.message : String(error),
            });
        }

        if (
            process.env.NODE_ENV !== "test" &&
            now - CacheLayer.lastRedisUnavailableConsoleAt >= effectiveThrottleMs
        ) {
            CacheLayer.lastRedisUnavailableConsoleAt = now;
            console.warn("⚠️  Cache disabled: Redis connection failed. Application will continue without caching.");
        }
    }

    /**
     * Start periodic health check to recover from open circuit
     */
    private startHealthCheck(): void {
        if (this.healthCheckInterval) return;

        // Check every 30 seconds
        this.healthCheckInterval = setInterval(async () => {
            if (this.circuitState === 'OPEN') {
                try {
                    // Start a race with timeout, just like standard connection check
                    await Promise.race([
                        this.redis.ping(),
                        new Promise((_, reject) => setTimeout(() => reject(new Error('Ping timeout')), 2000))
                    ]);

                    this.recordSuccess();
                    logger.info("[CacheLayer] Health check passed, circuit closed");
                } catch (error) {
                    // Still failing, stay open
                    // Use debug level to reduce noise
                    logger.debug("[CacheLayer] Health check failed, circuit remains open", { error });
                }
            } else if (this.redis.status !== 'ready' && this.redis.status !== 'connecting' && this.redis.status !== 'reconnecting') {
                // If Redis gave up (status='end'), try to reconnect manually
                if (this.redis.status === 'end') {
                    logger.info("[CacheLayer] Redis disconnected (end state), attempting manual reconnect");
                    this.redis.connect().catch(() => {}); // Catch to avoid unhandled promise rejection (handled by error event)
                }
            }
        }, 30000);
    }

    private recordFailure(error: any): void {
        this.lastFailureTime = Date.now();
        this.failureCount++;

        if (this.failureCount >= this.FAILURE_THRESHOLD && this.circuitState === 'CLOSED') {
            this.circuitState = 'OPEN';
            this.isRedisAvailable = false;
            logger.warn("[CacheLayer] Circuit Breaker: OPEN due to repeated failures", {
                failures: this.failureCount,
                lastError: error.message
            });
        }
    }

    private recordSuccess(): void {
        if (this.circuitState !== 'CLOSED') {
            this.circuitState = 'CLOSED';
            this.failureCount = 0;
            this.isRedisAvailable = true;
            logger.info("[CacheLayer] Circuit Breaker: CLOSED (Recovered)");
        } else {
             // Routine success, keep failure count clean
             this.failureCount = 0;
        }
    }

    /**
     * Check if cache is available
     * Now respects Circuit Breaker state
     */
    private isCacheAvailable(): boolean {
        if (this.circuitState === 'OPEN') {
             // Occasionally allow a probe through (Half-Open) outside of interval check
             const now = Date.now();
             if (now - this.lastFailureTime > this.CIRCUIT_RESET_TIMEOUT) {
                 this.circuitState = 'HALF_OPEN';
                 return true;
             }
             return false;
        }

        // Also check raw Redis status as safety net
        return this.isRedisAvailable && this.redis.status === 'ready';
    }

    static getInstance(): CacheLayer {
        const globalState = CacheLayer.getGlobalState();
        if (globalState.__ppCacheLayer) {
            return globalState.__ppCacheLayer;
        }

        if (!CacheLayer.instance) {
            CacheLayer.instance = new CacheLayer();
            logger.info("[CacheLayer] Singleton instance created", { pid: process.pid });
        }

        globalState.__ppCacheLayer = CacheLayer.instance;
        return CacheLayer.instance;
    }

    /**
     * Cleanup resources - for test teardown
     */
    async cleanup(): Promise<void> {
        if (this.connectionCheckTimeout) {
            clearTimeout(this.connectionCheckTimeout);
            this.connectionCheckTimeout = null;
        }

        if (this.healthCheckInterval) {
            clearInterval(this.healthCheckInterval);
            this.healthCheckInterval = null;
        }

        // Cleanup pub/sub
        if (process.env.NODE_ENV !== "test") {
            await getCacheInvalidationPubSub().cleanup();
        }

        if (this.redis && this.redis.status !== 'end') {
            try {
                await this.redis.quit();
            } catch (error) {
                // Ignore errors during cleanup
            }
        }

        this.isRedisAvailable = false;
        this.connectionPromise = null;
        this.pubSubInitialized = false;
        this.pubSubInitPromise = null;
        this.unregisterInvalidationHandler?.();
        this.unregisterInvalidationHandler = undefined;
    }

    /**
     * Reset singleton instance - for testing only
     */
    static resetInstance(): void {
        const globalState = CacheLayer.getGlobalState();
        const instance = globalState.__ppCacheLayer ?? CacheLayer.instance;
        if (instance) {
            instance.cleanup();
        }
        globalState.__ppCacheLayer = undefined;
        CacheLayer.instance = null as any;
    }

    /**
     * Initialize cache statistics tracking
     */
    private async initializeStats(): Promise<void> {
        if (!this.isCacheAvailable()) {
            return;
        }

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
        if (!this.isCacheAvailable()) {
            this.missCount++;
            return null;
        }

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

            this.recordSuccess();
            return JSON.parse(data) as T;
        } catch (error) {
            this.recordFailure(error);
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
        if (!this.isCacheAvailable()) {
            return;
        }

        try {
            const fullKey = this.buildKey(key);
            const serialized = JSON.stringify(value);

            if (ttlSeconds > 0) {
                await this.redis.setex(fullKey, ttlSeconds, serialized);
            } else {
                await this.redis.set(fullKey, serialized);
            }

            this.recordSuccess();
            logger.debug("[CacheLayer] Set cache", { key, ttl: ttlSeconds });
        } catch (error) {
            this.recordFailure(error);
            logger.error("[CacheLayer] Set error", { key, error });
        }
    }

    /**
     * Invalidate cache entries by pattern
     * Requirement 4.2: Cache invalidation on updates
     * Requirement 4.3: Distributed invalidation
     * Requirement 7.2: Distributed cache invalidation propagation
     */
    async invalidate(pattern: string): Promise<number> {
        if (!this.isCacheAvailable()) {
            return 0;
        }

        try {
            const fullPattern = this.buildKey(pattern);
            const keys = await this.redis.keys(fullPattern);

            if (keys.length === 0) {
                return 0;
            }

            // Delete all matching keys locally
            await this.redis.del(...keys);

            // Publish invalidation event to other instances
            // Extract tenantId from pattern if present
            const tenantIdMatch = pattern.match(/^([^:]+):/);
            const tenantId = tenantIdMatch ? tenantIdMatch[1] : undefined;

            await getCacheInvalidationPubSub().publishInvalidation(pattern, tenantId);

            logger.info("[CacheLayer] Invalidated cache entries", {
                pattern,
                count: keys.length,
                distributed: true
            });

            this.recordSuccess();
            return keys.length;
        } catch (error) {
            this.recordFailure(error);
            logger.error("[CacheLayer] Invalidate error", { pattern, error });
            return 0;
        }
    }

    /**
     * Delete a specific cache key
     */
    async del(key: string): Promise<void> {
        if (!this.isCacheAvailable()) {
            return;
        }

        try {
            const fullKey = this.buildKey(key);
            await this.redis.del(fullKey);
            this.recordSuccess();
            logger.debug("[CacheLayer] Deleted cache key", { key });
        } catch (error) {
            this.recordFailure(error);
            logger.error("[CacheLayer] Delete error", { key, error });
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
            const products = await prisma.product.findMany({
                where: {
                    tenantId,
                },
                take: 100, // Top 100 products
                orderBy: {
                    updatedAt: "desc",
                },
            });

            for (const product of products) {
                const cacheKey = this.keys.productComparison(tenantId, {
                    productId: product.id
                });
                await this.set(cacheKey, product, 300); // 5 minutes
            }

            // Note: Competitor product warming disabled - model structure needs update
            // const competitors = await prisma.competitorProduct.findMany({...});

            logger.info("[CacheLayer] Cache warming completed", {
                tenantId,
                productsWarmed: products.length,
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

export function getCacheLayer(): CacheLayer {
    return CacheLayer.getInstance();
}

// Lazy proxy avoids import-time side effects in build/dev workers.
export const cacheLayer = new Proxy({} as CacheLayer, {
    get(_target, property) {
        const instance = CacheLayer.getInstance();
        const value = (instance as any)[property];
        return typeof value === "function" ? value.bind(instance) : value;
    },
});
