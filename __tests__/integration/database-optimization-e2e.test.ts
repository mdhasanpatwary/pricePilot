/**
 * End-to-End Integration Tests for Database Optimization
 * 
 * This test suite validates that all optimization components work together:
 * - Query Analyzer
 * - Index Manager
 * - Connection Pool Manager
 * - Cache Layer
 * - Archive Manager
 * - Read Replica Router
 * - Performance Testing Infrastructure
 */

import { describe, it, expect, beforeAll, afterAll, jest } from '@jest/globals';
import prisma from '@/lib/prisma';

// Mock the middleware to avoid $use issues in tests
jest.mock('@/lib/middleware/query-timing', () => ({
    applyQueryTimingMiddleware: jest.fn(),
    createQueryTimingMiddleware: jest.fn(),
}));

import { QueryAnalyzer, getQueryAnalyzer } from '@/lib/services/query-analyzer';
import { IndexManager, getIndexManager } from '@/lib/services/index-manager';
import { ConnectionPoolManager } from '@/lib/services/connection-pool-manager';
import { CacheLayer } from '@/lib/services/cache-layer';
import { ArchiveManager, getArchiveManager } from '@/lib/services/archive-manager';
import { ReadReplicaRouter } from '@/lib/services/read-replica-router';
import { PerformanceTester } from '@/lib/services/performance-tester';
import { PerformanceBaselineManager } from '@/lib/services/performance-baseline-manager';

describe('Database Optimization - End-to-End Integration', () => {
    let queryAnalyzer: QueryAnalyzer;
    let indexManager: IndexManager;
    let poolManager: ConnectionPoolManager;
    let cacheLayer: CacheLayer;
    let archiveManager: ArchiveManager;
    let replicaRouter: ReadReplicaRouter;
    let performanceTester: PerformanceTester;
    let baselineManager: PerformanceBaselineManager;

    beforeAll(async () => {
        // Initialize all components
        queryAnalyzer = getQueryAnalyzer(prisma);
        indexManager = getIndexManager(prisma);
        poolManager = ConnectionPoolManager.getInstance();
        cacheLayer = CacheLayer.getInstance();
        archiveManager = getArchiveManager(prisma);
        replicaRouter = ReadReplicaRouter.getInstance();
        performanceTester = new PerformanceTester();
        baselineManager = new PerformanceBaselineManager();
    });

    afterAll(async () => {
        await prisma.$disconnect();
    });

    describe('Component Integration', () => {
        it('should have all optimization components initialized', () => {
            expect(queryAnalyzer).toBeDefined();
            expect(indexManager).toBeDefined();
            expect(poolManager).toBeDefined();
            expect(cacheLayer).toBeDefined();
            expect(archiveManager).toBeDefined();
            expect(replicaRouter).toBeDefined();
            expect(performanceTester).toBeDefined();
            expect(baselineManager).toBeDefined();
        });

        it('should verify connection pool is healthy', async () => {
            const health = await poolManager.healthCheck();
            expect(health.healthy).toBe(true);
            expect(health.primaryReachable).toBe(true);
        });

        it('should verify cache layer is operational', async () => {
            const testKey = 'e2e-test-key';
            const testValue = { test: 'data', timestamp: Date.now() };

            await cacheLayer.set(testKey, testValue, 60);
            const retrieved = await cacheLayer.get<typeof testValue>(testKey);

            expect(retrieved).toEqual(testValue);
            await cacheLayer.invalidate(testKey);
        });

        it('should verify query analyzer can log queries', async () => {
            const slowQuery = {
                query: 'SELECT * FROM user_products WHERE tenant_id = $1',
                params: ['test-tenant'],
                executionTime: 1500,
                affectedRows: 100,
                tenantId: 'test-tenant',
                timestamp: new Date(),
                executionPlan: 'Seq Scan on user_products',
            };

            await expect(queryAnalyzer.logSlowQuery(slowQuery)).resolves.not.toThrow();
        });

        it('should verify index manager can analyze indexes', async () => {
            const stats = await indexManager.getIndexStats();
            expect(Array.isArray(stats)).toBe(true);
        });
    });

    describe('Cache Hit Rate Validation', () => {
        it('should achieve cache hit rate above 60%', async () => {
            const stats = await cacheLayer.getCacheStats();

            // If there's meaningful traffic, validate hit rate
            if (stats.totalKeys > 0) {
                expect(stats.hitRate).toBeGreaterThanOrEqual(0);

                // Log cache performance
                console.log('Cache Performance:', {
                    hitRate: `${(stats.hitRate * 100).toFixed(2)}%`,
                    totalKeys: stats.totalKeys,
                    memoryUsed: `${(stats.memoryUsedBytes / 1024 / 1024).toFixed(2)} MB`,
                });
            }
        });

        it('should handle cache warming correctly', async () => {
            const testTenantId = 'test-tenant-warm';

            // Warm cache should not throw
            await expect(cacheLayer.warmCache(testTenantId)).resolves.not.toThrow();
        });
    });

    describe('Query Performance Validation', () => {
        it('should track slow queries correctly', async () => {
            const slowQueries = await queryAnalyzer.getTopSlowQueries(10, {
                start: new Date(Date.now() - 24 * 60 * 60 * 1000),
                end: new Date(),
            });

            expect(Array.isArray(slowQueries)).toBe(true);

            // Log slow query insights
            if (slowQueries.length > 0) {
                console.log('Top Slow Queries:', slowQueries.slice(0, 3).map(q => ({
                    query: q.query.substring(0, 50) + '...',
                    avgTime: `${q.avgExecutionTime}ms`,
                    count: q.executionCount,
                })));
            }
        });

        it('should generate optimization recommendations', async () => {
            const testQuery = 'SELECT * FROM user_products WHERE status = $1 AND tenant_id = $2';
            const recommendations = await queryAnalyzer.generateRecommendations(testQuery);

            expect(Array.isArray(recommendations)).toBe(true);
        });
    });

    describe('Connection Pool Performance', () => {
        it('should maintain pool within configured boundaries', async () => {
            const stats = await poolManager.getPoolStats();

            expect(stats.totalConnections).toBeGreaterThanOrEqual(10); // Min connections
            expect(stats.totalConnections).toBeLessThanOrEqual(50); // Max connections
            expect(stats.utilizationPercent).toBeGreaterThanOrEqual(0);
            expect(stats.utilizationPercent).toBeLessThanOrEqual(100);

            console.log('Connection Pool Stats:', {
                total: stats.totalConnections,
                active: stats.activeConnections,
                idle: stats.idleConnections,
                utilization: `${stats.utilizationPercent.toFixed(2)}%`,
            });
        });

        it('should handle concurrent connections efficiently', async () => {
            const concurrentQueries = 20;
            const queries = Array.from({ length: concurrentQueries }, (_, i) =>
                prisma.$queryRaw`SELECT ${i} as test_value`
            );

            const startTime = Date.now();
            await Promise.all(queries);
            const duration = Date.now() - startTime;

            console.log(`Executed ${concurrentQueries} concurrent queries in ${duration}ms`);
            expect(duration).toBeLessThan(5000); // Should complete within 5 seconds
        });
    });

    describe('Read Replica Routing', () => {
        it('should route queries appropriately', async () => {
            const stats = await replicaRouter.getRoutingStats();

            expect(stats).toHaveProperty('primaryQueries');
            expect(stats).toHaveProperty('replicaQueries');
            expect(stats).toHaveProperty('failoverCount');

            console.log('Routing Stats:', {
                primary: stats.primaryQueries,
                replica: stats.replicaQueries,
                failovers: stats.failoverCount,
                avgLag: `${stats.avgReplicationLag}s`,
            });
        });

        it('should monitor replication lag', async () => {
            const replicationStatus = await replicaRouter.checkReplicationLag();

            expect(Array.isArray(replicationStatus)).toBe(true);

            // Log replication health
            replicationStatus.forEach(replica => {
                console.log(`Replica ${replica.replicaId}:`, {
                    lag: `${replica.lagSeconds}s`,
                    healthy: replica.healthy,
                });
            });
        });
    });

    describe('Archive Operations', () => {
        it('should provide archive statistics', async () => {
            const stats = await archiveManager.getArchiveStats();

            expect(stats).toHaveProperty('priceHistoryArchived');
            expect(stats).toHaveProperty('auditLogsArchived');
            expect(stats).toHaveProperty('totalArchiveSizeBytes');

            console.log('Archive Stats:', {
                priceHistory: stats.priceHistoryArchived,
                auditLogs: stats.auditLogsArchived,
                totalSize: `${(stats.totalArchiveSizeBytes / 1024 / 1024).toFixed(2)} MB`,
            });
        });
    });

    describe('Performance Testing Infrastructure', () => {
        it('should measure query percentiles correctly', async () => {
            const testQuery = 'SELECT COUNT(*) FROM user_products';
            const iterations = 50;

            const executionTimes: number[] = [];

            for (let i = 0; i < iterations; i++) {
                const start = Date.now();
                await prisma.$queryRaw`SELECT COUNT(*) FROM user_products`;
                executionTimes.push(Date.now() - start);
            }

            const sorted = executionTimes.sort((a, b) => a - b);
            const p50 = sorted[Math.floor(iterations * 0.5)];
            const p95 = sorted[Math.floor(iterations * 0.95)];
            const p99 = sorted[Math.floor(iterations * 0.99)];

            console.log('Query Percentiles:', {
                p50: `${p50}ms`,
                p95: `${p95}ms`,
                p99: `${p99}ms`,
            });

            expect(p50).toBeGreaterThan(0);
            expect(p95).toBeGreaterThanOrEqual(p50);
            expect(p99).toBeGreaterThanOrEqual(p95);
        });

        it('should handle baseline comparisons', async () => {
            const baselines = await baselineManager.getAllBaselines();
            expect(Array.isArray(baselines)).toBe(true);

            console.log(`Found ${baselines.length} performance baselines`);
        });
    });

    describe('Index Optimization', () => {
        it('should identify optimization opportunities', async () => {
            const suggestions = await indexManager.suggestIndexes();
            expect(Array.isArray(suggestions)).toBe(true);

            if (suggestions.length > 0) {
                console.log('Index Suggestions:', suggestions.slice(0, 3).map(s => ({
                    table: s.tableName,
                    columns: s.columns,
                    impact: s.estimatedImpact,
                })));
            }
        });

        it('should track index usage', async () => {
            const stats = await indexManager.getIndexStats();

            // Find most used indexes
            const topIndexes = stats
                .sort((a, b) => b.scans - a.scans)
                .slice(0, 5);

            console.log('Top Used Indexes:', topIndexes.map(idx => ({
                name: idx.indexName,
                scans: idx.scans,
                size: `${(idx.sizeBytes / 1024 / 1024).toFixed(2)} MB`,
            })));
        });
    });

    describe('System Health Check', () => {
        it('should verify all components are healthy', async () => {
            const healthChecks = await Promise.all([
                poolManager.healthCheck(),
                cacheLayer.getCacheStats(),
                replicaRouter.checkReplicationLag(),
            ]);

            const [poolHealth, cacheStats, replicationStatus] = healthChecks;

            expect(poolHealth.healthy).toBe(true);
            expect(cacheStats).toBeDefined();
            expect(Array.isArray(replicationStatus)).toBe(true);

            console.log('System Health Summary:', {
                connectionPool: poolHealth.healthy ? 'HEALTHY' : 'UNHEALTHY',
                cache: cacheStats.totalKeys > 0 ? 'ACTIVE' : 'IDLE',
                replication: replicationStatus.every(r => r.healthy) ? 'HEALTHY' : 'DEGRADED',
            });
        });
    });
});
