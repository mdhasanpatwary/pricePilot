/**
 * Request-scoped token cache for performance optimization
 * Caches decrypted tokens in memory for the duration of a request
 * 
 * Requirements: 7.1, 7.2
 */

/**
 * Cache entry with expiration
 */
interface CacheEntry {
    decryptedToken: string;
    expiresAt: number;
}

/**
 * Request-scoped token cache
 * Stores decrypted tokens temporarily to avoid repeated decryption operations
 */
export class TokenCache {
    private cache: Map<string, CacheEntry> = new Map();
    private readonly defaultTTL: number = 60000; // 60 seconds default TTL

    /**
     * Get a cached decrypted token
     * @param websiteId - Website ID
     * @returns Decrypted token if cached and not expired, null otherwise
     */
    get(websiteId: string): string | null {
        const entry = this.cache.get(websiteId);

        if (!entry) {
            return null;
        }

        // Check if entry has expired
        if (Date.now() > entry.expiresAt) {
            this.cache.delete(websiteId);
            return null;
        }

        return entry.decryptedToken;
    }

    /**
     * Set a decrypted token in cache
     * @param websiteId - Website ID
     * @param decryptedToken - Decrypted token to cache
     * @param ttl - Time to live in milliseconds (default: 60 seconds)
     */
    set(websiteId: string, decryptedToken: string, ttl?: number): void {
        const expiresAt = Date.now() + (ttl || this.defaultTTL);

        this.cache.set(websiteId, {
            decryptedToken,
            expiresAt,
        });
    }

    /**
     * Clear a specific cache entry
     * @param websiteId - Website ID
     */
    delete(websiteId: string): void {
        this.cache.delete(websiteId);
    }

    /**
     * Clear all cache entries
     * Should be called at the end of a request
     */
    clear(): void {
        this.cache.clear();
    }

    /**
     * Get cache size (for monitoring)
     * @returns Number of cached entries
     */
    size(): number {
        return this.cache.size;
    }

    /**
     * Remove expired entries
     * Called periodically to prevent memory leaks
     */
    cleanup(): void {
        const now = Date.now();

        for (const [key, entry] of this.cache.entries()) {
            if (now > entry.expiresAt) {
                this.cache.delete(key);
            }
        }
    }
}

/**
 * Global token cache instance
 * Note: In production, this should be request-scoped using AsyncLocalStorage
 * or passed through the request context
 */
export const tokenCache = new TokenCache();

/**
 * Cleanup interval for expired cache entries
 * Runs every 30 seconds
 */
setInterval(() => {
    tokenCache.cleanup();
}, 30000);
