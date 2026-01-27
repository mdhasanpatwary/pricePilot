/**
 * Caching utilities for optimizing metrics calculations
 * Provides in-memory caching with TTL support
 */

export interface CacheEntry<T> {
    data: T;
    timestamp: number;
    ttl: number;
}

export interface CacheOptions {
    ttl?: number; // Time to live in milliseconds (default: 5 minutes)
    maxSize?: number; // Maximum cache size (default: 100)
}

/**
 * Simple in-memory cache with TTL support
 */
export class Cache<T = any> {
    private cache: Map<string, CacheEntry<T>>;
    private ttl: number;
    private maxSize: number;

    constructor(options: CacheOptions = {}) {
        this.cache = new Map();
        this.ttl = options.ttl || 5 * 60 * 1000; // 5 minutes default
        this.maxSize = options.maxSize || 100;
    }

    /**
     * Get value from cache
     * @param key - Cache key
     * @returns Cached value or null if not found or expired
     */
    get(key: string): T | null {
        const entry = this.cache.get(key);
        if (!entry) return null;

        const now = Date.now();
        const age = now - entry.timestamp;

        // Check if expired
        if (age > entry.ttl) {
            this.cache.delete(key);
            return null;
        }

        return entry.data;
    }

    /**
     * Set value in cache
     * @param key - Cache key
     * @param data - Data to cache
     * @param ttl - Optional custom TTL for this entry
     */
    set(key: string, data: T, ttl?: number): void {
        // Enforce max size by removing oldest entry
        if (this.cache.size >= this.maxSize) {
            const firstKey = this.cache.keys().next().value;
            if (firstKey) {
                this.cache.delete(firstKey);
            }
        }

        this.cache.set(key, {
            data,
            timestamp: Date.now(),
            ttl: ttl || this.ttl,
        });
    }

    /**
     * Check if key exists and is not expired
     * @param key - Cache key
     * @returns True if key exists and is valid
     */
    has(key: string): boolean {
        return this.get(key) !== null;
    }

    /**
     * Delete specific key from cache
     * @param key - Cache key
     */
    delete(key: string): void {
        this.cache.delete(key);
    }

    /**
     * Clear all cache entries
     */
    clear(): void {
        this.cache.clear();
    }

    /**
     * Get cache size
     * @returns Number of entries in cache
     */
    size(): number {
        return this.cache.size;
    }

    /**
     * Get or set value with a factory function
     * @param key - Cache key
     * @param factory - Function to generate value if not cached
     * @param ttl - Optional custom TTL
     * @returns Cached or newly generated value
     */
    async getOrSet(
        key: string,
        factory: () => Promise<T> | T,
        ttl?: number
    ): Promise<T> {
        const cached = this.get(key);
        if (cached !== null) {
            return cached;
        }

        const value = await factory();
        this.set(key, value, ttl);
        return value;
    }

    /**
     * Remove expired entries
     */
    cleanup(): void {
        const now = Date.now();
        for (const [key, entry] of this.cache.entries()) {
            const age = now - entry.timestamp;
            if (age > entry.ttl) {
                this.cache.delete(key);
            }
        }
    }
}

/**
 * Global cache instance for metrics
 */
export const metricsCache = new Cache({
    ttl: 30 * 1000, // 30 seconds for metrics
    maxSize: 50,
});

/**
 * Global cache instance for session data
 */
export const sessionCache = new Cache({
    ttl: 5 * 1000, // 5 seconds for real-time data
    maxSize: 100,
});

/**
 * Global cache instance for analytics
 */
export const analyticsCache = new Cache({
    ttl: 60 * 1000, // 1 minute for analytics
    maxSize: 50,
});

/**
 * Cleanup expired entries periodically
 */
if (typeof window !== "undefined") {
    setInterval(() => {
        metricsCache.cleanup();
        sessionCache.cleanup();
        analyticsCache.cleanup();
    }, 60 * 1000); // Cleanup every minute
}
