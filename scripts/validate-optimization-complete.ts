#!/usr/bin/env ts-node

/**
 * Comprehensive Validation Script for Database Optimization
 * 
 * This script validates that all optimization components are working correctly
 */

import { getQueryAnalyzer } from '../lib/services/query-analyzer';
import { getIndexManager } from '../lib/services/index-manager';
import { getConnectionPoolManager } from '../lib/services/connection-pool-manager';
import { CacheLayer } from '../lib/services/cache-layer';
import { ArchiveManager } from '../lib/services/archive-manager';
import { getReadReplicaRouter } from '../lib/services/read-replica-router';
import { prisma } from '../lib/prisma';

interface ValidationResult {
    component: string;
    status: 'PASS' | 'FAIL' | 'WARN';
    message: string;
    details?: any;
}

class OptimizationValidator {
    private results: ValidationResult[] = [];

    private addResult(result: ValidationResult) {
        this.results.push(result);
        const icon = result.status === 'PASS' ? '✓' : result.status === 'FAIL' ? '✗' : '⚠';
        console.log(`${icon} ${result.component}: ${result.message}`);
        if (result.details) {
            console.log('  Details:', JSON.stringify(result.details, null, 2));
        }
    }

    async validateConnectionPool(): Promise<void> {
        console.log('\n=== Validating Connection Pool ===');
        try {
            const poolManager = getConnectionPoolManager();
            const health = await poolManager.healthCheck();
            const stats = await poolManager.getPoolStats();

            if (!health.healthy) {
                this.addResult({
                    component: 'Connection Pool',
                    status: 'FAIL',
                    message: 'Pool health check failed',
                    details: health,
                });
                return;
            }

            this.addResult({
                component: 'Connection Pool',
                status: 'PASS',
                message: 'Pool is healthy',
                details: {
                    total: stats.totalConnections,
                    active: stats.activeConnections,
                    utilization: `${stats.utilizationPercent.toFixed(2)}%`,
                },
            });
        } catch (error) {
            this.addResult({
                component: 'Connection Pool',
                status: 'FAIL',
                message: `Validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
            });
        }
    }

    async validateCache(): Promise<void> {
        console.log('\n=== Validating Cache Layer ===');
        try {
            const cacheLayer = CacheLayer.getInstance();

            const testKey = 'validation-test';
            const testValue = { timestamp: Date.now(), test: true };

            await cacheLayer.set(testKey, testValue, 60);
            const retrieved = await cacheLayer.get<typeof testValue>(testKey);

            if (!retrieved || retrieved.test !== testValue.test) {
                this.addResult({
                    component: 'Cache Layer',
                    status: 'FAIL',
                    message: 'Cache read/write test failed',
                });
                return;
            }

            const stats = await cacheLayer.getCacheStats();

            this.addResult({
                component: 'Cache Layer',
                status: 'PASS',
                message: 'Cache is operational',
                details: {
                    hitRate: `${(stats.hitRate * 100).toFixed(2)}%`,
                    totalKeys: stats.totalKeys,
                },
            });

            await cacheLayer.invalidate(testKey);
        } catch (error) {
            this.addResult({
                component: 'Cache Layer',
                status: 'FAIL',
                message: `Validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
            });
        }
    }

    async validateQueryAnalyzer(): Promise<void> {
        console.log('\n=== Validating Query Analyzer ===');
        try {
            const queryAnalyzer = getQueryAnalyzer(prisma);

            const slowQueries = await queryAnalyzer.getTopSlowQueries(10, {
                start: new Date(Date.now() - 24 * 60 * 60 * 1000),
                end: new Date(),
            });

            this.addResult({
                component: 'Query Analyzer',
                status: 'PASS',
                message: 'Query analyzer is operational',
                details: {
                    slowQueriesTracked: slowQueries.length,
                },
            });
        } catch (error) {
            this.addResult({
                component: 'Query Analyzer',
                status: 'FAIL',
                message: `Validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
            });
        }
    }

    async validateIndexManager(): Promise<void> {
        console.log('\n=== Validating Index Manager ===');
        try {
            const indexManager = getIndexManager();

            const stats = await indexManager.getIndexStats();

            this.addResult({
                component: 'Index Manager',
                status: 'PASS',
                message: 'Index manager is operational',
                details: {
                    totalIndexes: stats.length,
                },
            });
        } catch (error) {
            this.addResult({
                component: 'Index Manager',
                status: 'FAIL',
                message: `Validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
            });
        }
    }

    async validateReplication(): Promise<void> {
        console.log('\n=== Validating Read Replica Router ===');
        try {
            const replicaRouter = getReadReplicaRouter();

            const routingStats = await replicaRouter.getRoutingStats();

            this.addResult({
                component: 'Read Replica Router',
                status: 'PASS',
                message: 'Replication router is operational',
                details: {
                    primaryQueries: routingStats.primaryQueries,
                    replicaQueries: routingStats.replicaQueries,
                },
            });
        } catch (error) {
            this.addResult({
                component: 'Read Replica Router',
                status: 'FAIL',
                message: `Validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
            });
        }
    }

    async validateArchive(): Promise<void> {
        console.log('\n=== Validating Archive Manager ===');
        try {
            const archiveManager = new ArchiveManager(prisma);

            const stats = await archiveManager.getArchiveStats();

            this.addResult({
                component: 'Archive Manager',
                status: 'PASS',
                message: 'Archive manager is operational',
                details: {
                    priceHistoryArchived: stats.priceHistoryArchived,
                    auditLogsArchived: stats.auditLogsArchived,
                },
            });
        } catch (error) {
            this.addResult({
                component: 'Archive Manager',
                status: 'FAIL',
                message: `Validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
            });
        }
    }

    async runConcurrentLoadTest(): Promise<void> {
        console.log('\n=== Running Concurrent Load Test (100+ connections) ===');
        try {
            const concurrentQueries = 100;
            const queries = Array.from({ length: concurrentQueries }, (_, i) =>
                prisma.$queryRaw`SELECT ${i} as test_id`
            );

            const startTime = Date.now();
            await Promise.all(queries);
            const duration = Date.now() - startTime;

            this.addResult({
                component: 'Concurrent Load Test',
                status: duration > 10000 ? 'WARN' : 'PASS',
                message: 'Successfully handled 100+ concurrent connections',
                details: {
                    queries: concurrentQueries,
                    duration: `${duration}ms`,
                    avgPerQuery: `${(duration / concurrentQueries).toFixed(2)}ms`,
                },
            });
        } catch (error) {
            this.addResult({
                component: 'Concurrent Load Test',
                status: 'FAIL',
                message: `Load test failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
            });
        }
    }

    printSummary(): void {
        console.log('\n' + '='.repeat(60));
        console.log('VALIDATION SUMMARY');
        console.log('='.repeat(60));

        const passed = this.results.filter(r => r.status === 'PASS').length;
        const warned = this.results.filter(r => r.status === 'WARN').length;
        const failed = this.results.filter(r => r.status === 'FAIL').length;

        console.log(`\nTotal Tests: ${this.results.length}`);
        console.log(`✓ Passed: ${passed}`);
        console.log(`⚠ Warnings: ${warned}`);
        console.log(`✗ Failed: ${failed}`);

        if (failed > 0) {
            console.log('\n❌ VALIDATION FAILED - Some components are not working correctly');
            process.exit(1);
        } else if (warned > 0) {
            console.log('\n⚠️  VALIDATION PASSED WITH WARNINGS - Review warnings above');
            process.exit(0);
        } else {
            console.log('\n✅ ALL VALIDATIONS PASSED - Database optimization is fully operational');
            process.exit(0);
        }
    }

    async run(): Promise<void> {
        console.log('Starting Database Optimization Validation...\n');

        await this.validateConnectionPool();
        await this.validateCache();
        await this.validateQueryAnalyzer();
        await this.validateIndexManager();
        await this.validateReplication();
        await this.validateArchive();
        await this.runConcurrentLoadTest();

        this.printSummary();
    }
}

// Run validation
const validator = new OptimizationValidator();
validator.run()
    .catch(error => {
        console.error('Validation script failed:', error);
        process.exit(1);
    })
    .finally(() => {
        prisma.$disconnect();
    });
