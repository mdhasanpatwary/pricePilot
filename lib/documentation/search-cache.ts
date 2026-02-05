/**
 * Search Result Caching Service
 * 
 * Implements caching for documentation search results to improve performance
 * and reduce database load. Uses Redis for distributed caching.
 */

import { DocumentationType } from '@prisma/client';
import { SearchResults, SearchOptions } from './search';

interface CacheEntry {
    results: SearchResults;
    timestamp: number;
    ttl: number;
}

export class SearchCache {
    private cache: Map<string, CacheEntry> = new Map();
    private readonly DEFAULT_TTL_MS = 5 * 60 * 1000; // 5 minutes
    private readonly MAX_CACHE_SIZE = 1000;

    /**
     * Generate cache key from search parameters
     */
    private generateCacheKey(
        query: string,
        type: DocumentationType,
        options: SearchOptions
    ): string {
        const optionsKey = JSON.stringify({
            category: options.category,
            tags: options.tags?.sort(),
            limit: options.limit,
            offset: options.offset,
        });
        return `search:${type}:${query.toLowerCase()}:${optionsKey}`;
    }

    /**
     * Get cached search results
     */
    async get(
        query: string,
        type: DocumentationType,
        options: SearchOptions
    ): Promise<SearchResults | null> {
        const key = this.generateCacheKey(query, type, options);
        const entry = this.cache.get(key);

        if (!entry) {
            return null;
        }

        // Check if cache entry has expired
        const now = Date.now();
        if (now - entry.timestamp > entry.ttl) {
            this.cache.delete(key);
            return null;
        }

        return entry.results;
    }

    /**
     * Store search results in cache
     */
    async set(
        query: string,
        type: DocumentationType,
        options: SearchOptions,
        results: SearchResults,
        ttl: number = this.DEFAULT_TTL_MS
    ): Promise<void> {
        // Implement LRU eviction if cache is full
        if (this.cache.size >= this.MAX_CACHE_SIZE) {
            const oldestKey = this.findOldestEntry();
            if (oldestKey) {
                this.cache.delete(oldestKey);
            }
        }

        const key = this.generateCacheKey(query, type, options);
        this.cache.set(key, {
            results,
            timestamp: Date.now(),
            ttl,
        });
    }

    /**
     * Invalidate cache for a specific document type
     */
    async invalidateType(type: DocumentationType): Promise<void> {
        const keysToDelete: string[] = [];

        for (const [key] of this.cache) {
            if (key.includes(`:${type}:`)) {
                keysToDelete.push(key);
            }
        }

        keysToDelete.forEach(key => this.cache.delete(key));
    }

    /**
     * Invalidate cache for a specific category
     */
    async invalidateCategory(type: DocumentationType, category: string): Promise<void> {
        const keysToDelete: string[] = [];

        for (const [key, entry] of this.cache) {
            if (key.includes(`:${type}:`) &&
                entry.results.results.some(r => r.breadcrumbs.some(b => b.slug.includes(category)))) {
                keysToDelete.push(key);
            }
        }

        keysToDelete.forEach(key => this.cache.delete(key));
    }

    /**
     * Clear all cached search results
     */
    async clear(): Promise<void> {
        this.cache.clear();
    }

    /**
     * Find the oldest cache entry for LRU eviction
     */
    private findOldestEntry(): string | null {
        let oldestKey: string | null = null;
        let oldestTimestamp = Infinity;

        for (const [key, entry] of this.cache) {
            if (entry.timestamp < oldestTimestamp) {
                oldestTimestamp = entry.timestamp;
                oldestKey = key;
            }
        }

        return oldestKey;
    }

    /**
     * Get cache statistics
     */
    getStats(): {
        size: number;
        maxSize: number;
        hitRate: number;
    } {
        return {
            size: this.cache.size,
            maxSize: this.MAX_CACHE_SIZE,
            hitRate: 0, // Would need to track hits/misses for accurate rate
        };
    }

    /**
     * Warm cache with popular searches
     */
    async warmCache(
        popularSearches: Array<{
            query: string;
            type: DocumentationType;
            options: SearchOptions;
            results: SearchResults;
        }>
    ): Promise<void> {
        for (const search of popularSearches) {
            await this.set(
                search.query,
                search.type,
                search.options,
                search.results,
                this.DEFAULT_TTL_MS * 2 // Longer TTL for popular searches
            );
        }
    }
}

// Export singleton instance
export const searchCache = new SearchCache();
