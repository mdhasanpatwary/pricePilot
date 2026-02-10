/**
 * Request-Scoped Cache using AsyncLocalStorage
 * 
 * Provides a request-scoped cache that persists throughout the entire request lifecycle.
 * Automatically clears after request completes, ensuring no data leakage between requests.
 * 
 * Usage:
 * ```typescript
 * import { withRequestContext, getRequestCache, setRequestCache } from '@/lib/cache/request-cache';
 * 
 * export async function GET(req: NextRequest) {
 *   return withRequestContext(() => handler(req));
 * }
 * 
 * async function handler(req: NextRequest) {
 *   const cached = getRequestCache('session');
 *   if (!cached) {
 *     const session = await getServerSession();
 *     setRequestCache('session', session);
 *   }
 * }
 * ```
 */

import { AsyncLocalStorage } from 'async_hooks';

/**
 * Request cache structure
 * Stores any serializable data with string keys
 */
export interface RequestCache {
    [key: string]: any;
}

/**
 * Cache metrics for monitoring
 */
export interface CacheMetrics {
    hits: number;
    misses: number;
    sets: number;
    keys: Set<string>;
}

/**
 * AsyncLocalStorage instance for request-scoped cache
 * Each request gets its own isolated cache instance
 */
const requestCacheStorage = new AsyncLocalStorage<{
    cache: RequestCache;
    metrics: CacheMetrics;
}>();

/**
 * Wrap a handler function with request context
 * 
 * Creates a new request-scoped cache that persists throughout the handler execution.
 * Automatically clears after handler completes.
 * 
 * @param handler - Async function to execute with request context
 * @returns Promise resolving to handler result
 * 
 * @example
 * ```typescript
 * export async function GET(req: NextRequest) {
 *   return withRequestContext(() => {
 *     return withRateLimit(req, "read", handleGET);
 *   });
 * }
 * ```
 */
export function withRequestContext<T>(
    handler: () => Promise<T>
): Promise<T> {
    const context = {
        cache: {} as RequestCache,
        metrics: {
            hits: 0,
            misses: 0,
            sets: 0,
            keys: new Set<string>(),
        },
    };

    return requestCacheStorage.run(context, handler);
}

/**
 * Get value from request cache
 * 
 * Returns undefined if:
 * - No request context exists (not wrapped with withRequestContext)
 * - Key doesn't exist in cache
 * 
 * @param key - Cache key
 * @returns Cached value or undefined
 * 
 * @example
 * ```typescript
 * const session = getRequestCache('session');
 * if (!session) {
 *   // Cache miss - fetch from database
 * }
 * ```
 */
export function getRequestCache<T = any>(key: string): T | undefined {
    const store = requestCacheStorage.getStore();

    if (!store) {
        return undefined;
    }

    const value = store.cache[key];

    // Track metrics
    if (value !== undefined) {
        store.metrics.hits++;
    } else {
        store.metrics.misses++;
    }

    return value;
}

/**
 * Set value in request cache
 * 
 * No-op if no request context exists.
 * 
 * @param key - Cache key
 * @param value - Value to cache
 * 
 * @example
 * ```typescript
 * const session = await getServerSession();
 * setRequestCache('session', session);
 * ```
 */
export function setRequestCache(key: string, value: any): void {
    const store = requestCacheStorage.getStore();

    if (!store) {
        return;
    }

    store.cache[key] = value;
    store.metrics.sets++;
    store.metrics.keys.add(key);
}

/**
 * Check if key exists in cache
 * 
 * @param key - Cache key
 * @returns True if key exists, false otherwise
 */
export function hasRequestCache(key: string): boolean {
    const store = requestCacheStorage.getStore();
    return store ? key in store.cache : false;
}

/**
 * Get or set cache value
 * 
 * If key exists, returns cached value.
 * If key doesn't exist, executes factory function and caches result.
 * 
 * @param key - Cache key
 * @param factory - Function to generate value if not cached
 * @returns Cached or newly generated value
 * 
 * @example
 * ```typescript
 * const session = await getOrSetRequestCache('session', async () => {
 *   return await getServerSession(authOptions);
 * });
 * ```
 */
export async function getOrSetRequestCache<T>(
    key: string,
    factory: () => Promise<T>
): Promise<T> {
    const cached = getRequestCache<T>(key);

    if (cached !== undefined) {
        return cached;
    }

    const value = await factory();
    setRequestCache(key, value);

    return value;
}

/**
 * Get cache metrics for current request
 * 
 * Useful for debugging and monitoring cache effectiveness.
 * 
 * @returns Cache metrics or null if no context
 * 
 * @example
 * ```typescript
 * const metrics = getRequestCacheMetrics();
 * console.log(`Cache hit rate: ${metrics.hits / (metrics.hits + metrics.misses)}`);
 * ```
 */
export function getRequestCacheMetrics(): CacheMetrics | null {
    const store = requestCacheStorage.getStore();
    return store ? { ...store.metrics, keys: new Set(store.metrics.keys) } : null;
}

/**
 * Clear all cache entries for current request
 * 
 * Rarely needed as cache automatically clears after request completes.
 * Useful for testing or manual cache invalidation.
 */
export function clearRequestCache(): void {
    const store = requestCacheStorage.getStore();

    if (!store) {
        return;
    }

    store.cache = {};
    store.metrics.keys.clear();
}

/**
 * Get cache size (number of keys)
 * 
 * @returns Number of cached keys or 0 if no context
 */
export function getRequestCacheSize(): number {
    const store = requestCacheStorage.getStore();
    return store ? store.metrics.keys.size : 0;
}

/**
 * Check if request context exists
 * 
 * @returns True if within request context, false otherwise
 */
export function hasRequestContext(): boolean {
    return requestCacheStorage.getStore() !== undefined;
}
