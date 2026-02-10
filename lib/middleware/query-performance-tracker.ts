/**
 * Query Performance Tracker
 * 
 * Measures average execution time for each Prisma query using Prisma Client Extensions.
 * Identifies slowest queries and provides detailed performance metrics.
 * 
 * This replaces the deprecated $use middleware API with the modern extension approach.
 */

import { Prisma, PrismaClient } from '@prisma/client';

export interface QueryMetrics {
    model: string;
    operation: string;
    count: number;
    totalTime: number;
    avgTime: number;
    minTime: number;
    maxTime: number;
    lastExecuted: Date;
}

export interface QueryPerformanceReport {
    totalQueries: number;
    totalTime: number;
    avgQueryTime: number;
    slowestQueries: QueryMetrics[];
    queryBreakdown: Map<string, QueryMetrics>;
}

class QueryPerformanceTracker {
    private metrics: Map<string, QueryMetrics> = new Map();
    private enabled: boolean = true;

    /**
     * Generate a unique key for each query type
     */
    private getQueryKey(model: string, operation: string): string {
        return `${model}.${operation}`;
    }

    /**
     * Record query execution time
     */
    recordQuery(model: string, operation: string, executionTime: number): void {
        if (!this.enabled) return;

        const key = this.getQueryKey(model, operation);
        const existing = this.metrics.get(key);

        if (existing) {
            existing.count++;
            existing.totalTime += executionTime;
            existing.avgTime = existing.totalTime / existing.count;
            existing.minTime = Math.min(existing.minTime, executionTime);
            existing.maxTime = Math.max(existing.maxTime, executionTime);
            existing.lastExecuted = new Date();
        } else {
            this.metrics.set(key, {
                model,
                operation,
                count: 1,
                totalTime: executionTime,
                avgTime: executionTime,
                minTime: executionTime,
                maxTime: executionTime,
                lastExecuted: new Date(),
            });
        }
    }

    /**
     * Get performance report
     */
    getReport(): QueryPerformanceReport {
        const allMetrics = Array.from(this.metrics.values());
        const totalQueries = allMetrics.reduce((sum, m) => sum + m.count, 0);
        const totalTime = allMetrics.reduce((sum, m) => sum + m.totalTime, 0);

        // Sort by average time descending
        const slowestQueries = [...allMetrics]
            .sort((a, b) => b.avgTime - a.avgTime)
            .slice(0, 20);

        return {
            totalQueries,
            totalTime,
            avgQueryTime: totalQueries > 0 ? totalTime / totalQueries : 0,
            slowestQueries,
            queryBreakdown: this.metrics,
        };
    }

    /**
     * Get metrics for a specific query
     */
    getQueryMetrics(model: string, operation: string): QueryMetrics | undefined {
        return this.metrics.get(this.getQueryKey(model, operation));
    }

    /**
     * Reset all metrics
     */
    reset(): void {
        this.metrics.clear();
    }

    /**
     * Enable/disable tracking
     */
    setEnabled(enabled: boolean): void {
        this.enabled = enabled;
    }

    /**
     * Print formatted report to console
     */
    printReport(): void {
        const report = this.getReport();

        console.log('\n' + '='.repeat(80));
        console.log('PRISMA QUERY PERFORMANCE REPORT');
        console.log('='.repeat(80));
        console.log(`Total Queries: ${report.totalQueries}`);
        console.log(`Total Time: ${report.totalTime.toFixed(2)}ms`);
        console.log(`Average Query Time: ${report.avgQueryTime.toFixed(2)}ms`);
        console.log('='.repeat(80));
        console.log('\nTOP 20 SLOWEST QUERIES (by average execution time):');
        console.log('-'.repeat(80));
        console.log(
            'Rank'.padEnd(6) +
            'Model.Operation'.padEnd(35) +
            'Count'.padEnd(8) +
            'Avg(ms)'.padEnd(10) +
            'Min(ms)'.padEnd(10) +
            'Max(ms)'.padEnd(10)
        );
        console.log('-'.repeat(80));

        report.slowestQueries.forEach((query, index) => {
            console.log(
                `${(index + 1).toString().padEnd(6)}` +
                `${query.model}.${query.operation}`.padEnd(35) +
                `${query.count.toString().padEnd(8)}` +
                `${query.avgTime.toFixed(2).padEnd(10)}` +
                `${query.minTime.toFixed(2).padEnd(10)}` +
                `${query.maxTime.toFixed(2).padEnd(10)}`
            );
        });

        console.log('='.repeat(80) + '\n');
    }

    /**
     * Export report as JSON
     */
    exportReport(): string {
        const report = this.getReport();
        return JSON.stringify(
            {
                ...report,
                queryBreakdown: Array.from(report.queryBreakdown.entries()).map(([key, metrics]) => ({
                    key,
                    ...metrics,
                })),
            },
            null,
            2
        );
    }
}

// Singleton instance
const tracker = new QueryPerformanceTracker();

/**
 * Create Prisma Client Extension for query performance tracking
 */
export function createPerformanceExtension() {
    return Prisma.defineExtension({
        name: 'queryPerformanceTracker',
        query: {
            $allModels: {
                async $allOperations({ model, operation, args, query }) {
                    const startTime = performance.now();

                    try {
                        const result = await query(args);
                        const executionTime = performance.now() - startTime;

                        tracker.recordQuery(model, operation, executionTime);

                        // Log slow queries in real-time (>1000ms)
                        if (executionTime > 1000) {
                            console.warn(
                                `⚠️  SLOW QUERY: ${model}.${operation} took ${executionTime.toFixed(2)}ms`
                            );
                        }

                        return result;
                    } catch (error) {
                        const executionTime = performance.now() - startTime;
                        tracker.recordQuery(model, operation, executionTime);
                        throw error;
                    }
                },
            },
        },
    });
}

/**
 * Create an instrumented Prisma client with performance tracking
 */
export function createInstrumentedPrismaClient(baseClient: PrismaClient) {
    return baseClient.$extends(createPerformanceExtension());
}

/**
 * Get the global performance tracker instance
 */
export function getPerformanceTracker(): QueryPerformanceTracker {
    return tracker;
}

/**
 * Export metrics for external monitoring systems
 */
export function getMetricsForMonitoring() {
    const report = tracker.getReport();

    return {
        prisma_queries_total: report.totalQueries,
        prisma_queries_duration_ms_total: report.totalTime,
        prisma_queries_duration_ms_avg: report.avgQueryTime,
        prisma_queries_by_operation: Array.from(report.queryBreakdown.values()).map(m => ({
            model: m.model,
            operation: m.operation,
            count: m.count,
            avg_duration_ms: m.avgTime,
            max_duration_ms: m.maxTime,
        })),
    };
}
