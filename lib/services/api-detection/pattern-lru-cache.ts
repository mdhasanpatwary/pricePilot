/**
 * LRU Cache for API Patterns
 * 
 * In-memory Least Recently Used (LRU) cache for frequently accessed API patterns.
 * Provides fast access to cached patterns while syncing with database cache.
 */

import type { APIPattern } from '@/lib/types/api-detection';

/**
 * Cache entry with metadata
 */
interface CacheEntry {
    pattern: APIPattern;
    accessCount: number;
    lastAccessedAt: number;
}

/**
 * LRU Cache configuration
 */
export interface LRUCacheConfig {
    /** Maximum number of entries to cache */
    maxSize: number;
    /** Time-to-live in milliseconds (0 = no expiration) */
    ttl: number;
}

/**
 * Default LRU cache configuration
 */
const DEFAULT_CONFIG: LRUCacheConfig = {
    maxSize: 100,
    ttl: 3600000, // 1 hour
};

/**
 * PatternLRUCache class
 * 
 * Implements an LRU cache for API patterns with automatic eviction
 * of least recently used entries when capacity is reached.
 */
export class PatternLRUCache {
    private cache: Map<string, CacheEntry>;
    private config: LRUCacheConfig;
    private accessOrder: string[]; // Track access order for LRU

    constructor(config?: Partial<LRUCacheConfig>) {
        this.config = {
            ...DEFAULT_CONFIG,
            ...config,
        };
        this.cache = new Map();
        this.accessOrder = [];
    }

    /**
     * Get pattern from cache
     * 
     * @param competitorWebsiteId - Competitor website ID
     * @returns Cached pattern or null if not found/expired
     */
    get(competitorWebsiteId: string): APIPattern | null {
        const entry = this.cache.get(competitorWebsiteId);

        if (!entry) {
            return null;
        }

        // Check if entry has expired
        if (this.config.ttl > 0) {
            const age = Date.now() - entry.lastAccessedAt;
            if (age > this.config.ttl) {
                // Entry expired, remove it
                this.delete(competitorWebsiteId);
                return null;
            }
        }

        // Update access metadata
        entry.accessCount++;
        entry.lastAccessedAt = Date.now();

        // Update access order (move to end = most recently used)
        this.updateAccessOrder(competitorWebsiteId);

        return entry.pattern;
    }

    /**
     * Set pattern in cache
     * 
     * @param competitorWebsiteId - Competitor website ID
     * @param pattern - API pattern to cache
     */
    set(competitorWebsiteId: string, pattern: APIPattern): void {
        // Check if we need to evict entries
        if (this.cache.size >= this.config.maxSize && !this.cache.has(competitorWebsiteId)) {
            this.evictLRU();
        }

        // Create or update cache entry
        const entry: CacheEntry = {
            pattern,
            accessCount: 1,
            lastAccessedAt: Date.now(),
        };

        this.cache.set(competitorWebsiteId, entry);

        // Update access order
        this.updateAccessOrder(competitorWebsiteId);
    }

    /**
     * Delete pattern from cache
     * 
     * @param competitorWebsiteId - Competitor website ID
     * @returns True if entry was deleted
     */
    delete(competitorWebsiteId: string): boolean {
        const deleted = this.cache.delete(competitorWebsiteId);

        if (deleted) {
            // Remove from access order
            const index = this.accessOrder.indexOf(competitorWebsiteId);
            if (index !== -1) {
                this.accessOrder.splice(index, 1);
            }
        }

        return deleted;
    }

    /**
     * Check if pattern exists in cache
     * 
     * @param competitorWebsiteId - Competitor website ID
     * @returns True if pattern is cached
     */
    has(competitorWebsiteId: string): boolean {
        const entry = this.cache.get(competitorWebsiteId);

        if (!entry) {
            return false;
        }

        // Check if expired
        if (this.config.ttl > 0) {
            const age = Date.now() - entry.lastAccessedAt;
            if (age > this.config.ttl) {
                this.delete(competitorWebsiteId);
                return false;
            }
        }

        return true;
    }

    /**
     * Clear all entries from cache
     */
    clear(): void {
        this.cache.clear();
        this.accessOrder = [];
    }

    /**
     * Get cache size
     * 
     * @returns Number of entries in cache
     */
    size(): number {
        return this.cache.size;
    }

    /**
     * Get cache statistics
     * 
     * @returns Cache statistics
     */
    getStats(): {
        size: number;
        maxSize: number;
        hitRate: number;
        entries: Array<{
            competitorWebsiteId: string;
            accessCount: number;
            lastAccessedAt: number;
            age: number;
        }>;
    } {
        const entries = Array.from(this.cache.entries()).map(([id, entry]) => ({
            competitorWebsiteId: id,
            accessCount: entry.accessCount,
            lastAccessedAt: entry.lastAccessedAt,
            age: Date.now() - entry.lastAccessedAt,
        }));

        // Calculate hit rate (entries with access count > 1)
        const hits = entries.filter((e) => e.accessCount > 1).length;
        const hitRate = this.cache.size > 0 ? hits / this.cache.size : 0;

        return {
            size: this.cache.size,
            maxSize: this.config.maxSize,
            hitRate,
            entries: entries.sort((a, b) => b.accessCount - a.accessCount),
        };
    }

    /**
     * Get most frequently accessed patterns
     * 
     * @param limit - Maximum number of patterns to return
     * @returns Array of most accessed patterns
     */
    getMostAccessed(limit: number = 10): Array<{
        competitorWebsiteId: string;
        pattern: APIPattern;
        accessCount: number;
    }> {
        const entries = Array.from(this.cache.entries())
            .map(([id, entry]) => ({
                competitorWebsiteId: id,
                pattern: entry.pattern,
                accessCount: entry.accessCount,
            }))
            .sort((a, b) => b.accessCount - a.accessCount)
            .slice(0, limit);

        return entries;
    }

    /**
     * Update access order for LRU tracking
     * 
     * @param competitorWebsiteId - Competitor website ID
     */
    private updateAccessOrder(competitorWebsiteId: string): void {
        // Remove from current position
        const index = this.accessOrder.indexOf(competitorWebsiteId);
        if (index !== -1) {
            this.accessOrder.splice(index, 1);
        }

        // Add to end (most recently used)
        this.accessOrder.push(competitorWebsiteId);
    }

    /**
     * Evict least recently used entry
     */
    private evictLRU(): void {
        if (this.accessOrder.length === 0) {
            return;
        }

        // Get least recently used entry (first in access order)
        const lruId = this.accessOrder[0];

        // Delete from cache
        this.delete(lruId);
    }

    /**
     * Remove expired entries
     * 
     * @returns Number of entries removed
     */
    removeExpired(): number {
        if (this.config.ttl === 0) {
            return 0;
        }

        let removed = 0;
        const now = Date.now();

        for (const [id, entry] of this.cache.entries()) {
            const age = now - entry.lastAccessedAt;
            if (age > this.config.ttl) {
                this.delete(id);
                removed++;
            }
        }

        return removed;
    }

    /**
     * Update cache configuration
     * 
     * @param config - New configuration (partial)
     */
    updateConfig(config: Partial<LRUCacheConfig>): void {
        this.config = {
            ...this.config,
            ...config,
        };

        // If max size decreased, evict entries
        while (this.cache.size > this.config.maxSize) {
            this.evictLRU();
        }
    }
}

/**
 * Global pattern LRU cache instance
 */
let globalCache: PatternLRUCache | null = null;

/**
 * Get or create global pattern LRU cache
 * 
 * @param config - Optional configuration for new cache
 * @returns Global cache instance
 */
export function getGlobalPatternCache(
    config?: Partial<LRUCacheConfig>
): PatternLRUCache {
    if (!globalCache) {
        globalCache = new PatternLRUCache(config);
    }
    return globalCache;
}

/**
 * Destroy global pattern cache
 */
export function destroyGlobalPatternCache(): void {
    if (globalCache) {
        globalCache.clear();
        globalCache = null;
    }
}
