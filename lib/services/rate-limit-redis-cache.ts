/**
 * Redis Cache Layer for Rate Limit Configuration
 *
 * Provides distributed caching for rate limit bypass and custom multiplier
 * configuration data. This reduces database load and improves performance
 * across multiple application instances.
 *
 * Features:
 * - Distributed caching using Upstash Redis
 * - Automatic cache invalidation on configuration changes
 * - Graceful fallback to database queries when Redis is unavailable
 * - Request-scoped caching integration
 * - Cache performance metrics tracking
 *
 * Requirements: All requirements from redis-rate-limit-caching spec
 */

import { Redis } from "ioredis";
import { getRedisConnection } from "@/lib/queue/connection";
import { logger } from "@/lib/logger";

const RATE_LIMIT_CACHE_DEBUG = process.env.RATE_LIMIT_CACHE_DEBUG === "true";

/**
 * Cache key prefixes for different data types
 */
const CACHE_KEY_PREFIX = {
    BYPASS: "ratelimit:bypass:",
    MULTIPLIER: "ratelimit:multiplier:",
} as const;

/**
 * TTL values in seconds
 */
const CACHE_TTL = {
    BYPASS: 5 * 60, // 5 minutes
    MULTIPLIER: 10 * 60, // 10 minutes
} as const;

/**
 * Cached bypass data structure
 */
interface CachedBypassData {
    isActive: boolean;
    expiresAt?: string; // ISO string
}

/**
 * Cached multiplier data structure
 */
interface CachedMultiplierData {
    multiplier: number | null;
}

/**
 * Cache metrics for monitoring
 */
interface CacheMetrics {
    bypassHits: number;
    bypassMisses: number;
    multiplierHits: number;
    multiplierMisses: number;
}

/**
 * Redis cache manager for rate limit configuration
 */
export class RateLimitRedisCache {
    private redis: Redis;
    private static instance: RateLimitRedisCache;
    private metrics: CacheMetrics = {
        bypassHits: 0,
        bypassMisses: 0,
        multiplierHits: 0,
        multiplierMisses: 0,
    };

    private constructor() {
        this.redis = getRedisConnection();
    }

    private debug(message: string, context?: Record<string, unknown>): void {
        if (!RATE_LIMIT_CACHE_DEBUG) return;
        logger.debug(message, context);
    }

    /**
     * Get singleton instance
     */
    static getInstance(): RateLimitRedisCache {
        if (!RateLimitRedisCache.instance) {
            RateLimitRedisCache.instance = new RateLimitRedisCache();
        }
        return RateLimitRedisCache.instance;
    }

    /**
     * Generate cache key for bypass data
     */
    private getBypassKey(tenantId: string): string {
        return `${CACHE_KEY_PREFIX.BYPASS}${tenantId}`;
    }

    /**
     * Generate cache key for multiplier data
     */
    private getMultiplierKey(tenantId: string): string {
        return `${CACHE_KEY_PREFIX.MULTIPLIER}${tenantId}`;
    }

    /**
     * Get bypass status from cache
     *
     * @param tenantId - The tenant to check
     * @returns Cached bypass data, or null if not in cache
     */
    async getBypass(tenantId: string): Promise<boolean | null> {
        try {
            const key = this.getBypassKey(tenantId);
            const cached = await this.redis.get(key);

            if (!cached) {
                this.metrics.bypassMisses++;
                return null;
            }

            const data: CachedBypassData = JSON.parse(cached);

            // Verify bypass hasn't expired
            if (data.expiresAt) {
                const expiresAt = new Date(data.expiresAt);
                if (expiresAt <= new Date()) {
                    // Bypass has expired, invalidate cache
                    await this.invalidateBypass(tenantId);
                    this.metrics.bypassMisses++;
                    return null;
                }
            }

            this.metrics.bypassHits++;
            this.debug("[RateLimitRedisCache] Bypass cache hit", { tenantId });
            return data.isActive;
        } catch (error) {
            logger.error("[RateLimitRedisCache] Error getting bypass from cache", {
                error,
                tenantId,
            });
            // Return null to trigger database fallback
            return null;
        }
    }

    /**
     * Set bypass status in cache
     *
     * @param tenantId - The tenant to cache
     * @param isActive - Whether bypass is active
     * @param expiresAt - Optional expiration timestamp
     */
    async setBypass(
        tenantId: string,
        isActive: boolean,
        expiresAt?: Date
    ): Promise<void> {
        try {
            const key = this.getBypassKey(tenantId);
            const data: CachedBypassData = {
                isActive,
                expiresAt: expiresAt?.toISOString(),
            };

            await this.redis.setex(key, CACHE_TTL.BYPASS, JSON.stringify(data));

            this.debug("[RateLimitRedisCache] Bypass cached", {
                tenantId,
                isActive,
                expiresAt,
            });
        } catch (error) {
            logger.error("[RateLimitRedisCache] Error setting bypass in cache", {
                error,
                tenantId,
            });
            // Don't throw - caching is optional
        }
    }

    /**
     * Invalidate bypass cache for a tenant
     *
     * @param tenantId - The tenant to invalidate
     */
    async invalidateBypass(tenantId: string): Promise<void> {
        try {
            const key = this.getBypassKey(tenantId);
            await this.redis.del(key);

            logger.info("[RateLimitRedisCache] Bypass cache invalidated", {
                tenantId,
            });
        } catch (error) {
            logger.error("[RateLimitRedisCache] Error invalidating bypass cache", {
                error,
                tenantId,
            });
            // Don't throw - cache invalidation failure is not critical
        }
    }

    /**
     * Get custom multiplier from cache
     *
     * @param tenantId - The tenant to check
     * @returns Cached multiplier value, or undefined if not in cache
     */
    async getMultiplier(tenantId: string): Promise<number | null | undefined> {
        try {
            const key = this.getMultiplierKey(tenantId);
            const cached = await this.redis.get(key);

            if (cached === null) {
                this.metrics.multiplierMisses++;
                return undefined; // Not in cache
            }

            const data: CachedMultiplierData = JSON.parse(cached);

            this.metrics.multiplierHits++;
            this.debug("[RateLimitRedisCache] Multiplier cache hit", { tenantId });
            return data.multiplier;
        } catch (error) {
            logger.error("[RateLimitRedisCache] Error getting multiplier from cache", {
                error,
                tenantId,
            });
            // Return undefined to trigger database fallback
            return undefined;
        }
    }

    /**
     * Set custom multiplier in cache
     *
     * @param tenantId - The tenant to cache
     * @param multiplier - The multiplier value (or null if not set)
     */
    async setMultiplier(
        tenantId: string,
        multiplier: number | null
    ): Promise<void> {
        try {
            const key = this.getMultiplierKey(tenantId);
            const data: CachedMultiplierData = { multiplier };

            await this.redis.setex(
                key,
                CACHE_TTL.MULTIPLIER,
                JSON.stringify(data)
            );

            this.debug("[RateLimitRedisCache] Multiplier cached", {
                tenantId,
                multiplier,
            });
        } catch (error) {
            logger.error("[RateLimitRedisCache] Error setting multiplier in cache", {
                error,
                tenantId,
            });
            // Don't throw - caching is optional
        }
    }

    /**
     * Invalidate multiplier cache for a tenant
     *
     * @param tenantId - The tenant to invalidate
     */
    async invalidateMultiplier(tenantId: string): Promise<void> {
        try {
            const key = this.getMultiplierKey(tenantId);
            await this.redis.del(key);

            logger.info("[RateLimitRedisCache] Multiplier cache invalidated", {
                tenantId,
            });
        } catch (error) {
            logger.error(
                "[RateLimitRedisCache] Error invalidating multiplier cache",
                {
                    error,
                    tenantId,
                }
            );
            // Don't throw - cache invalidation failure is not critical
        }
    }

    /**
     * Get current cache metrics
     *
     * @returns Cache hit/miss statistics
     */
    getMetrics(): CacheMetrics & {
        bypassHitRate: number;
        multiplierHitRate: number;
    } {
        const bypassTotal = this.metrics.bypassHits + this.metrics.bypassMisses;
        const multiplierTotal =
            this.metrics.multiplierHits + this.metrics.multiplierMisses;

        return {
            ...this.metrics,
            bypassHitRate: bypassTotal > 0 ? (this.metrics.bypassHits / bypassTotal) * 100 : 0,
            multiplierHitRate:
                multiplierTotal > 0
                    ? (this.metrics.multiplierHits / multiplierTotal) * 100
                    : 0,
        };
    }

    /**
     * Reset cache metrics
     */
    resetMetrics(): void {
        this.metrics = {
            bypassHits: 0,
            bypassMisses: 0,
            multiplierHits: 0,
            multiplierMisses: 0,
        };
    }

    /**
     * Log current cache metrics
     */
    logMetrics(): void {
        const metrics = this.getMetrics();
        logger.info("[RateLimitRedisCache] Cache metrics", metrics);
    }
}

/**
 * Get singleton instance of Redis cache
 */
export const getRateLimitRedisCache = () => RateLimitRedisCache.getInstance();
