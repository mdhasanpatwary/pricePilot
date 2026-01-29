/**
 * Concurrent Load Testing for Database Optimization
 * 
 * Tests system behavior under high concurrent load (100+ connections)
 */

import { describe, it, expect, beforeAll, afterAll, jest } from '@jest/globals';
import prisma from '@/lib/prisma';

// Mock the middleware to avoid $use issues in tests
jest.mock('@/lib/middleware/query-timing', () => ({
    applyQueryTimingMiddleware: jest.fn(),
    createQueryTimingMiddleware: jest.fn(),
}));

import { ConnectionPoolManager } from '@/lib/services/connection-pool-manager';
import { CacheLayer } from '@/lib/services/cache-layer';
import { ReadReplicaRouter } from '@/lib/services/read-replica-router';

describe('Concurrent Load Testing', () => {
    let poolManager: ConnectionPoolManager;
    let cacheLayer: CacheLayer;
    let replicaRouter: ReadReplicaRouter;

    beforeAll(async () => {
        poolManager = ConnectionPoolManager.getInstance();
        cacheLayer = CacheLayer.getInstance();
        replicaRouter = ReadReplicaRouter.getInstance();
    });

    afterAll(async () => {
        await prisma.$disconnect();
    });

    describe('100+ Concurrent Connections', () => {
        it('should handle 100 concurrent read queries', async () => {
            const concurrentQueries = 100;
            const queries = Array.from({ length: concurrentQueries }, (_, i) =>
                prisma.$queryRaw`SELECT ${i} as query_id, NOW() as timestamp`
            );

            const startTime = Date.now();
            const results = await Promise.all(queries);
            const duration = Date.now() - startTime;

            expect(results).toHaveLength(concurrentQueries);

            console.log('100 Concurrent Queries Performance:', {
                totalQueries: concurrentQueries,
                duration: `${duration}ms`,
                avgPerQuery: `${(duration / concurrentQueries).toFixed(2)}ms`,
                queriesPerSecond: Math.round((concurrentQueries / duration) * 1000),
            });

            // Should complete within reasonable time (10 seconds)
            expect(duration).toBeLessThan(10000);
        }, 30000); // 30 second timeout

        it('should handle 150 concurrent queries with mixed operations', async () => {
            const readQueries = 100;
            const cacheQueries = 50;

            const queries = [
                // Read queries
                ...Array.from({ length: readQueries }, (_, i) =>
                    prisma.$queryRaw`SELECT COUNT(*) as count FROM user_products WHERE id > ${i}`
                ),
                // Cache operations
                ...Array.from({ length: cacheQueries }, async (_, i) => {
                    const key = `load-test-${i}`;
                    await cacheLayer.set(key, { value: i }, 60);
                    return cacheLayer.get(key);
                }),
            ];

            const startTime = Date.now();
            await Promise.all(queries);
            const duration = Date.now() - startTime;

            console.log('150 Mixed Operations Performance:', {
                totalOperations: readQueries + cacheQueries,
                duration: `${duration}ms`,
                avgPerOperation: `${(duration / (readQueries + cacheQueries)).toFixed(2)}ms`,
            });

            expect(duration).toBeLessThan(15000);
        }, 30000);

        it('should maintain pool health under load', async () => {
            const concurrentQueries = 120;

            // Start queries
            const queryPromise = Promise.all(
                Array.from({ length: concurrentQueries }, () =>
                    prisma.$queryRaw`SELECT pg_sleep(0.1)`
                )
            );

            // Check pool stats during load
            await new Promise(resolve => setTimeout(resolve, 50));
            const statsUnderLoad = await poolManager.getPoolStats();

            await queryPromise;

            // Check pool stats after load
            const statsAfterLoad = await poolManager.getPoolStats();

            console.log('Pool Stats Under Load:', {
                duringLoad: {
                    total: statsUnderLoad.totalConnections,
                    active: statsUnderLoad.activeConnections,
                    utilization: `${statsUnderLoad.utilizationPercent.toFixed(2)}%`,
                },
                afterLoad: {
                    total: statsAfterLoad.totalConnections,
                    active: statsAfterLoad.activeConnections,
                    utilization: `${statsAfterLoad.utilizationPercent.toFixed(2)}%`,
                },
            });

            // Pool should stay within bounds
            expect(statsUnderLoad.totalConnections).toBeLessThanOrEqual(50);
            expect(statsAfterLoad.totalConnections).toBeGreaterThanOrEqual(10);
        }, 30000);
    });

    describe('Cache Performance Under Load', () => {
        it('should maintain cache hit rate under concurrent access', async () => {
            const iterations = 100;
            const uniqueKeys = 20;

            // Pre-populate cache
            for (let i = 0; i < uniqueKeys; i++) {
                await cacheLayer.set(`load-test-key-${i}`, { value: i }, 300);
            }

            // Concurrent cache access
            const cacheOperations = Array.from({ length: iterations }, (_, i) =>
                cacheLayer.get(`load-test-key-${i % uniqueKeys}`)
            );

            const startTime = Date.now();
            await Promise.all(cacheOperations);
            const duration = Date.now() - startTime;

            const stats = await cacheLayer.getCacheStats();

            console.log('Cache Performance Under Load:', {
                operations: iterations,
                duration: `${duration}ms`,
                hitRate: `${(stats.hitRate * 100).toFixed(2)}%`,
                avgPerOp: `${(duration / iterations).toFixed(2)}ms`,
            });

            // Cache should be fast
            expect(duration / iterations).toBeLessThan(10); // Less than 10ms per operation
        });
    });

    describe('Query Routing Under Load', () => {
        it('should route queries efficiently under concurrent load', async () => {
            const readQueries = 100;

            const queries = Array.from({ length: readQueries }, (_, i) =>
                prisma.$queryRaw`SELECT ${i} as id, 'test' as data`
            );

            const startTime = Date.now();
            await Promise.all(queries);
            const duration = Date.now() - startTime;

            const routingStats = await replicaRouter.getRoutingStats();

            console.log('Query Routing Performance:', {
                totalQueries: readQueries,
                duration: `${duration}ms`,
                primaryQueries: routingStats.primaryQueries,
                replicaQueries: routingStats.replicaQueries,
                failovers: routingStats.failoverCount,
            });

            expect(duration).toBeLessThan(10000);
        }, 30000);
    });

    describe('Stress Testing', () => {
        it('should handle burst traffic patterns', async () => {
            const bursts = 5;
            const queriesPerBurst = 30;

            const results = [];

            for (let burst = 0; burst < bursts; burst++) {
                const burstQueries = Array.from({ length: queriesPerBurst }, (_, i) =>
                    prisma.$queryRaw`SELECT ${burst * queriesPerBurst + i} as query_id`
                );

                const startTime = Date.now();
                await Promise.all(burstQueries);
                const duration = Date.now() - startTime;

                results.push({ burst: burst + 1, duration });

                // Small delay between bursts
                await new Promise(resolve => setTimeout(resolve, 100));
            }

            console.log('Burst Traffic Results:', results.map(r => ({
                burst: r.burst,
                duration: `${r.duration}ms`,
            })));

            // All bursts should complete reasonably
            results.forEach(r => {
                expect(r.duration).toBeLessThan(5000);
            });
        }, 30000);

        it('should recover gracefully from high load', async () => {
            // Create high load
            const highLoadQueries = 80;
            const queries = Array.from({ length: highLoadQueries }, () =>
                prisma.$queryRaw`SELECT pg_sleep(0.05)`
            );

            await Promise.all(queries);

            // Check recovery
            await new Promise(resolve => setTimeout(resolve, 1000));

            const health = await poolManager.healthCheck();
            const poolStats = await poolManager.getPoolStats();

            console.log('Recovery After High Load:', {
                healthy: health.healthy,
                activeConnections: poolStats.activeConnections,
                utilization: `${poolStats.utilizationPercent.toFixed(2)}%`,
            });

            expect(health.healthy).toBe(true);
            expect(poolStats.utilizationPercent).toBeLessThan(80);
        }, 30000);
    });

    describe('Performance Benchmarks', () => {
        it('should meet performance targets', async () => {
            const benchmarks = {
                simpleQuery: 0,
                complexQuery: 0,
                cacheRead: 0,
                cacheWrite: 0,
            };

            // Simple query benchmark
            let start = Date.now();
            await prisma.$queryRaw`SELECT 1`;
            benchmarks.simpleQuery = Date.now() - start;

            // Complex query benchmark
            start = Date.now();
            await prisma.$queryRaw`
        SELECT COUNT(*) 
        FROM user_products 
        WHERE status = 'active'
      `;
            benchmarks.complexQuery = Date.now() - start;

            // Cache read benchmark
            await cacheLayer.set('benchmark-key', { test: 'data' }, 60);
            start = Date.now();
            await cacheLayer.get('benchmark-key');
            benchmarks.cacheRead = Date.now() - start;

            // Cache write benchmark
            start = Date.now();
            await cacheLayer.set('benchmark-key-2', { test: 'data' }, 60);
            benchmarks.cacheWrite = Date.now() - start;

            console.log('Performance Benchmarks:', {
                simpleQuery: `${benchmarks.simpleQuery}ms`,
                complexQuery: `${benchmarks.complexQuery}ms`,
                cacheRead: `${benchmarks.cacheRead}ms`,
                cacheWrite: `${benchmarks.cacheWrite}ms`,
            });

            // Performance targets
            expect(benchmarks.simpleQuery).toBeLessThan(100);
            expect(benchmarks.complexQuery).toBeLessThan(1000);
            expect(benchmarks.cacheRead).toBeLessThan(50);
            expect(benchmarks.cacheWrite).toBeLessThan(50);
        });
    });
});
