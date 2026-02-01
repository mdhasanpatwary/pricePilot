/**
 * API Cache Middleware
 * 
 * Provides caching for API endpoints with automatic cache key generation
 * and invalidation support.
 * 
 * Requirements: 4.1, 4.2, 4.3
 */

import { NextRequest, NextResponse } from 'next/server';
import { CacheLayer } from '@/lib/services/cache-layer';

export interface CacheOptions {
    ttl: number; // Time to live in seconds
    keyPrefix: string; // Cache key prefix
    varyBy?: string[]; // Query params to include in cache key
    tenantIsolated?: boolean; // Whether to include tenant ID in key
}

/**
 * Generate cache key from request
 */
function generateCacheKey(
    req: NextRequest,
    options: CacheOptions,
    tenantId?: string
): string {
    const url = new URL(req.url);
    const pathname = url.pathname;

    // Build key parts
    const parts: string[] = [options.keyPrefix, pathname];

    // Add tenant ID if tenant-isolated
    if (options.tenantIsolated && tenantId) {
        parts.push(tenantId);
    }

    // Add query parameters if specified
    if (options.varyBy && options.varyBy.length > 0) {
        const queryParts: string[] = [];
        options.varyBy.forEach(param => {
            const value = url.searchParams.get(param);
            if (value) {
                queryParts.push(`${param}=${value}`);
            }
        });
        if (queryParts.length > 0) {
            parts.push(queryParts.join('&'));
        }
    }

    return parts.join(':');
}

/**
 * Wrap API handler with caching
 */
export function withCache(
    handler: (req: NextRequest) => Promise<NextResponse>,
    options: CacheOptions
) {
    return async (req: NextRequest): Promise<NextResponse> => {
        const cache = CacheLayer.getInstance();

        // Only cache GET requests
        if (req.method !== 'GET') {
            return handler(req);
        }

        try {
            // Extract tenant ID from request (you may need to adjust this based on your auth)
            let tenantId: string | undefined;

            // Try to get tenant ID from headers or session
            // This is a placeholder - adjust based on your auth implementation
            const authHeader = req.headers.get('authorization');
            if (authHeader) {
                // Extract tenant ID from token or session
                // For now, we'll skip tenant extraction and rely on the handler
            }

            // Generate cache key
            const cacheKey = generateCacheKey(req, options, tenantId);

            // Try to get from cache
            const cached = await cache.get<any>(cacheKey);
            if (cached) {
                // Return cached response
                return NextResponse.json(cached, {
                    headers: {
                        'X-Cache-Status': 'HIT',
                        'X-Cache-Key': cacheKey,
                    },
                });
            }

            // Cache miss - execute handler
            const response = await handler(req);

            // Only cache successful responses
            if (response.ok) {
                const data = await response.json();

                // Store in cache
                await cache.set(cacheKey, data, options.ttl);

                // Return response with cache miss header
                return NextResponse.json(data, {
                    headers: {
                        'X-Cache-Status': 'MISS',
                        'X-Cache-Key': cacheKey,
                    },
                });
            }

            return response;
        } catch (error) {
            // On error, fall back to handler without caching
            console.error('Cache middleware error:', error);
            return handler(req);
        }
    };
}

/**
 * Invalidate cache for a specific pattern
 */
export async function invalidateCache(pattern: string): Promise<void> {
    const cache = CacheLayer.getInstance();
    await cache.invalidate(pattern);
}

/**
 * Predefined cache configurations
 */
export const CacheConfigs = {
    // Product comparison - 5 minute TTL
    productComparison: {
        ttl: 300, // 5 minutes
        keyPrefix: 'api:products',
        varyBy: ['q', 'brand', 'category', 'stock', 'ram', 'storage', 'processor'],
        tenantIsolated: true,
    } as CacheOptions,

    // Competitor products - 15 minute TTL
    competitorProducts: {
        ttl: 900, // 15 minutes
        keyPrefix: 'api:competitors',
        varyBy: ['siteId', 'category'],
        tenantIsolated: true,
    } as CacheOptions,

    // Analytics summary - 5 minute TTL
    analyticsSummary: {
        ttl: 300, // 5 minutes
        keyPrefix: 'api:analytics:summary',
        varyBy: [],
        tenantIsolated: true,
    } as CacheOptions,

    // Price history - 10 minute TTL
    priceHistory: {
        ttl: 600, // 10 minutes
        keyPrefix: 'api:price-history',
        varyBy: ['productId', 'start', 'end'],
        tenantIsolated: true,
    } as CacheOptions,
};
