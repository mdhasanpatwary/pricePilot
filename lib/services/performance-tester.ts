/**
 * Performance Testing Service
 * 
 * Provides comprehensive performance testing capabilities including:
 * - Multi-tenant workload simulation
 * - Query response time measurement (p50, p95, p99)
 * - Concurrent connection testing
 * - Performance baseline establishment
 * - Regression detection
 * 
 * @module lib/services/performance-tester
 */

import { Pool } from 'pg';
import {
    PerformanceBaseline,
    PerformanceComparison,
    WorkloadSimulation,
    QueryMetrics,
} from '@/lib/types/database-optimization';
import {
    PERFORMANCE_TEST_CONCURRENT_CONNECTIONS,
    PERFORMANCE_REGRESSION_THRESHOLD,
    PERFORMANCE_BASELINE_SAMPLE_SIZE,
} from '@/lib/database/optimization-constants';
import { logger } from '@/lib/logger';

export interface PerformanceTestResult {
    testName: string;
    durationMs: number;
    queriesExecuted: number;
    successCount: number;
    failureCount: number;
    metrics: {
        p50: number;
        p95: number;
        p99: number;
        min: number;
        max: number;
        avg: number;
    };
    concurrentConnections: number;
    timestamp: Date;
}

export interface WorkloadConfig {
    name: string;
    queries: Array<{
        sql: string;
        params?: any[];
        weight?: number; // Relative frequency (default: 1)
    }>;
    concurrentConnections?: number;
    durationSeconds?: number;
    tenantIds?: string[];
}

export class PerformanceTester {
    private pool: Pool;

    constructor(pool: Pool) {
        this.pool = pool;
    }

    /**
     * Run a performance test with the given workload configuration
     */
    async runPerformanceTest(config: WorkloadConfig): Promise<PerformanceTestResult> {
        const startTime = Date.now();
        const concurrentConnections = config.concurrentConnections || PERFORMANCE_TEST_CONCURRENT_CONNECTIONS;
        const durationSeconds = config.durationSeconds || 60;
        const executionTimes: number[] = [];
        let successCount = 0;
        let failureCount = 0;

        logger.info(`Starting performance test: ${config.name}`, {
            concurrentConnections,
            durationSeconds,
            queryCount: config.queries.length,
        });

        // Create worker promises for concurrent execution
        const workers = Array.from({ length: concurrentConnections }, (_, i) =>
            this.runWorker(
                i,
                config.queries,
                durationSeconds,
                config.tenantIds || [],
                executionTimes
            )
        );

        // Wait for all workers to complete
        const results = await Promise.allSettled(workers);

        // Count successes and failures
        results.forEach((result) => {
            if (result.status === 'fulfilled') {
                successCount += result.value.successCount;
                failureCount += result.value.failureCount;
            } else {
                failureCount++;
                logger.error('Worker failed', { error: result.reason });
            }
        });

        const endTime = Date.now();
        const metrics = this.calculatePercentiles(executionTimes);

        const testResult: PerformanceTestResult = {
            testName: config.name,
            durationMs: endTime - startTime,
            queriesExecuted: executionTimes.length,
            successCount,
            failureCount,
            metrics,
            concurrentConnections,
            timestamp: new Date(),
        };

        logger.info(`Performance test completed: ${config.name}`, testResult);

        return testResult;
    }

    /**
     * Worker function that executes queries for a specified duration
     */
    private async runWorker(
        workerId: number,
        queries: WorkloadConfig['queries'],
        durationSeconds: number,
        tenantIds: string[],
        executionTimes: number[]
    ): Promise<{ successCount: number; failureCount: number }> {
        const endTime = Date.now() + durationSeconds * 1000;
        let successCount = 0;
        let failureCount = 0;

        // Calculate total weight for weighted random selection
        const totalWeight = queries.reduce((sum, q) => sum + (q.weight || 1), 0);

        while (Date.now() < endTime) {
            try {
                // Select a query based on weights
                const query = this.selectWeightedQuery(queries, totalWeight);

                // Replace tenant placeholder if needed
                let sql = query.sql;
                let params = query.params || [];

                if (tenantIds.length > 0 && sql.includes('$tenantId')) {
                    const randomTenantId = tenantIds[Math.floor(Math.random() * tenantIds.length)];
                    sql = sql.replace('$tenantId', `'${randomTenantId}'`);
                }

                // Execute query and measure time
                const queryStart = Date.now();
                await this.pool.query(sql, params);
                const queryEnd = Date.now();

                const executionTime = queryEnd - queryStart;
                executionTimes.push(executionTime);
                successCount++;
            } catch (error) {
                failureCount++;
                logger.error(`Worker ${workerId} query failed`, { error });
            }
        }

        return { successCount, failureCount };
    }

    /**
     * Select a query based on weighted random selection
     */
    private selectWeightedQuery(
        queries: WorkloadConfig['queries'],
        totalWeight: number
    ): WorkloadConfig['queries'][0] {
        let random = Math.random() * totalWeight;

        for (const query of queries) {
            const weight = query.weight || 1;
            if (random < weight) {
                return query;
            }
            random -= weight;
        }

        return queries[queries.length - 1];
    }

    /**
     * Calculate percentiles from execution times
     */
    private calculatePercentiles(times: number[]): PerformanceTestResult['metrics'] {
        if (times.length === 0) {
            return { p50: 0, p95: 0, p99: 0, min: 0, max: 0, avg: 0 };
        }

        const sorted = [...times].sort((a, b) => a - b);
        const len = sorted.length;

        return {
            p50: this.percentile(sorted, 0.5),
            p95: this.percentile(sorted, 0.95),
            p99: this.percentile(sorted, 0.99),
            min: sorted[0],
            max: sorted[len - 1],
            avg: times.reduce((sum, t) => sum + t, 0) / len,
        };
    }

    /**
     * Calculate a specific percentile from sorted array
     */
    private percentile(sortedArray: number[], percentile: number): number {
        const index = Math.ceil(sortedArray.length * percentile) - 1;
        return sortedArray[Math.max(0, index)];
    }

    /**
     * Measure query response time for a specific query
     */
    async measureQueryResponseTime(
        sql: string,
        params: any[] = [],
        iterations: number = PERFORMANCE_BASELINE_SAMPLE_SIZE
    ): Promise<{ p50: number; p95: number; p99: number }> {
        const executionTimes: number[] = [];

        logger.info('Measuring query response time', { iterations });

        for (let i = 0; i < iterations; i++) {
            const start = Date.now();
            try {
                await this.pool.query(sql, params);
                const end = Date.now();
                executionTimes.push(end - start);
            } catch (error) {
                logger.error('Query execution failed during measurement', { error });
            }
        }

        const metrics = this.calculatePercentiles(executionTimes);

        return {
            p50: metrics.p50,
            p95: metrics.p95,
            p99: metrics.p99,
        };
    }

    /**
     * Test concurrent connections
     */
    async testConcurrentConnections(
        connectionCount: number = PERFORMANCE_TEST_CONCURRENT_CONNECTIONS
    ): Promise<{
        successful: number;
        failed: number;
        avgConnectionTime: number;
        maxConnectionTime: number;
    }> {
        logger.info('Testing concurrent connections', { connectionCount });

        const connectionTimes: number[] = [];
        let successful = 0;
        let failed = 0;

        const connectionPromises = Array.from({ length: connectionCount }, async () => {
            const start = Date.now();
            try {
                const client = await this.pool.connect();
                await client.query('SELECT 1');
                client.release();
                const end = Date.now();
                connectionTimes.push(end - start);
                successful++;
            } catch (error) {
                failed++;
                logger.error('Connection test failed', { error });
            }
        });

        await Promise.allSettled(connectionPromises);

        const avgConnectionTime = connectionTimes.length > 0
            ? connectionTimes.reduce((sum, t) => sum + t, 0) / connectionTimes.length
            : 0;

        const maxConnectionTime = connectionTimes.length > 0
            ? Math.max(...connectionTimes)
            : 0;

        return {
            successful,
            failed,
            avgConnectionTime,
            maxConnectionTime,
        };
    }

    /**
     * Simulate multi-tenant workload
     */
    async simulateMultiTenantWorkload(
        simulation: WorkloadSimulation
    ): Promise<PerformanceTestResult> {
        // Generate tenant IDs
        const tenantIds = Array.from(
            { length: simulation.tenantCount },
            (_, i) => `tenant-${i + 1}`
        );

        // Create typical multi-tenant queries
        const queries = [
            {
                sql: `SELECT * FROM user_products WHERE tenant_id = $tenantId AND status = 'active' LIMIT 20`,
                weight: 5, // Most common query
            },
            {
                sql: `SELECT * FROM competitor_products WHERE tenant_id = $tenantId ORDER BY last_scraped_at DESC LIMIT 10`,
                weight: 3,
            },
            {
                sql: `SELECT * FROM product_matches WHERE user_product_id IN (SELECT id FROM user_products WHERE tenant_id = $tenantId LIMIT 5)`,
                weight: 2,
            },
            {
                sql: `SELECT * FROM price_history WHERE tenant_id = $tenantId AND recorded_at > NOW() - INTERVAL '7 days' LIMIT 100`,
                weight: 2,
            },
            {
                sql: `SELECT COUNT(*) FROM audit_logs WHERE tenant_id = $tenantId AND created_at > NOW() - INTERVAL '1 day'`,
                weight: 1,
            },
        ];

        const config: WorkloadConfig = {
            name: 'Multi-Tenant Workload Simulation',
            queries,
            concurrentConnections: simulation.concurrentConnections,
            durationSeconds: simulation.durationSeconds,
            tenantIds,
        };

        return this.runPerformanceTest(config);
    }
}

export default PerformanceTester;
