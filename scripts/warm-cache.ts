#!/usr/bin/env ts-node
/**
 * Cache Warming Script
 * 
 * Warms the cache with frequently accessed data during off-peak hours.
 * Should be run via cron job between 2-4 AM UTC.
 * 
 * Requirements: 4.4
 * 
 * Usage:
 *   ts-node scripts/warm-cache.ts [tenantId]
 * 
 * If no tenant ID is provided, warms cache for all active tenants.
 */

import { PrismaClient } from '@prisma/client';
import { CacheLayer } from '@/lib/services/cache-layer';

async function warmTenantCache(prisma: PrismaClient, cache: CacheLayer, tenantId: string) {
    console.log(`Warming cache for tenant: ${tenantId}`);

    try {
        // 1. Warm product comparison cache (most frequently accessed)
        const products = await prisma.product.findMany({
            where: {
                tenantId,
                site: { type: 'USER' },
            },
            include: {
                site: true,
                matchesAsUser: {
                    include: {
                        competitorProduct: {
                            include: {
                                site: true,
                            },
                        },
                    },
                },
            },
            take: 100, // Warm top 100 products
            orderBy: {
                updatedAt: 'desc',
            },
        });

        // Cache the full product list
        const cacheKey = `products:${tenantId}:all:all:all:all:all:all:all`;
        await cache.set(cacheKey, { products, stats: {}, currency: 'USD' }, 300);

        console.log(`  ✓ Cached ${products.length} products`);

        // 2. Warm competitor products cache
        const competitorSites = await prisma.site.findMany({
            where: {
                tenantId,
                type: 'COMPETITOR',
            },
            take: 10, // Top 10 competitor sites
        });

        for (const site of competitorSites) {
            const competitorProducts = await prisma.product.findMany({
                where: {
                    siteId: site.id,
                },
                take: 50,
                orderBy: {
                    updatedAt: 'desc',
                },
            });

            const compCacheKey = `competitors:${tenantId}:${site.id}`;
            await cache.set(compCacheKey, competitorProducts, 900);
        }

        console.log(`  ✓ Cached ${competitorSites.length} competitor sites`);

        // 3. Warm analytics summary cache
        const matches = await prisma.productMatch.findMany({
            where: {
                userProduct: {
                    tenantId,
                },
            },
            include: {
                userProduct: true,
                competitorProduct: true,
            },
            take: 100,
        });

        const analyticsCacheKey = `analytics:summary:${tenantId}`;
        await cache.set(analyticsCacheKey, { matches }, 300);

        console.log(`  ✓ Cached ${matches.length} product matches`);

        // 4. Warm frequently accessed categories
        const categories = await prisma.product.groupBy({
            by: ['category'],
            where: {
                tenantId,
                site: { type: 'USER' },
                category: { not: null },
            },
            _count: true,
            orderBy: {
                _count: {
                    category: 'desc',
                },
            },
            take: 10,
        });

        for (const cat of categories) {
            if (cat.category) {
                const categoryProducts = await prisma.product.findMany({
                    where: {
                        tenantId,
                        category: cat.category,
                        site: { type: 'USER' },
                    },
                    include: {
                        matchesAsUser: {
                            include: {
                                competitorProduct: true,
                            },
                        },
                    },
                    take: 50,
                });

                const catCacheKey = `products:${tenantId}::all:${cat.category}:all:all:all:all`;
                await cache.set(catCacheKey, { products: categoryProducts }, 300);
            }
        }

        console.log(`  ✓ Cached ${categories.length} categories`);

    } catch (error) {
        console.error(`  ✗ Error warming cache for tenant ${tenantId}:`, error);
    }
}

async function main() {
    const prisma = new PrismaClient();
    const cache = CacheLayer.getInstance();

    try {
        console.log('Starting cache warming...');
        const startTime = Date.now();

        // Get target tenant(s)
        let tenantIds: string[];

        if (process.argv[2]) {
            // Specific tenant provided
            tenantIds = [process.argv[2]];
        } else {
            // Get all active tenants
            const tenants = await prisma.tenant.findMany({
                where: {
                    status: 'ACTIVE',
                },
                select: {
                    id: true,
                },
            });
            tenantIds = tenants.map(t => t.id);
        }

        console.log(`Warming cache for ${tenantIds.length} tenant(s)...`);

        // Warm cache for each tenant
        for (const tenantId of tenantIds) {
            await warmTenantCache(prisma, cache, tenantId);
        }

        const duration = Date.now() - startTime;
        console.log(`\n✓ Cache warming completed in ${duration}ms`);

        // Get cache stats
        const stats = await cache.getCacheStats();
        console.log('\nCache Statistics:');
        console.log(`  Total Keys: ${stats.totalKeys}`);
        console.log(`  Memory Used: ${(stats.memoryUsedBytes / 1024 / 1024).toFixed(2)} MB`);
        console.log(`  Hit Rate: ${(stats.hitRate * 100).toFixed(2)}%`);

    } catch (error) {
        console.error('Error warming cache:', error);
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
}

main();
