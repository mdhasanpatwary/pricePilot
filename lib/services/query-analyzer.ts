/**
 * Query Analyzer Service
 * 
 * Monitors query performance, identifies slow queries, and generates
 * optimization recommendations.
 * 
 * Requirements: 1.1, 1.2, 1.3, 1.4, 1.5
 */

import { PrismaClient } from '@prisma/client';
import {
    QueryAnalyzer,
    SlowQueryData,
    SlowQuery,
    QueryPlan,
    Recommendation,
    PerformanceTrend,
    TimeRange,
} from '@/lib/types/database-optimization';
import {
    SLOW_QUERY_THRESHOLD_MS,
    TOP_SLOW_QUERIES_LIMIT,
    generateQueryFingerprint,
} from '@/lib/database/optimization-constants';

export class QueryAnalyzerImpl implements QueryAnalyzer {
    private prisma: PrismaClient;

    constructor(prisma: PrismaClient) {
        this.prisma = prisma;
    }

    /**
     * Log a slow query with execution details
     * Requirements: 1.1, 1.2
     */
    async logSlowQuery(data: SlowQueryData): Promise<void> {
        // Only log queries that exceed the threshold
        if (data.executionTime < SLOW_QUERY_THRESHOLD_MS) {
            return;
        }

        const fingerprint = generateQueryFingerprint(data.query);

        await this.prisma.slowQuery.create({
            data: {
                queryFingerprint: fingerprint,
                queryText: data.query,
                executionTimeMs: data.executionTime,
                affectedRows: data.affectedRows,
                tenantId: data.tenantId,
                executionPlan: data.executionPlan,
                params: data.params,
                createdAt: data.timestamp,
            },
        });
    }

    /**
     * Get top slow queries for dashboard display
     * Requirements: 1.3
     */
    async getTopSlowQueries(limit: number = TOP_SLOW_QUERIES_LIMIT, timeRange: TimeRange): Promise<SlowQuery[]> {
        const results = await this.prisma.$queryRaw<any[]>`
            SELECT 
                query_fingerprint as query,
                AVG(execution_time_ms)::numeric as avg_execution_time,
                MAX(execution_time_ms) as max_execution_time,
                COUNT(*) as execution_count,
                MAX(created_at) as last_executed
            FROM "SlowQuery"
            WHERE created_at >= ${timeRange.start} AND created_at <= ${timeRange.end}
            GROUP BY query_fingerprint
            ORDER BY avg_execution_time DESC
            LIMIT ${limit}
        `;

        return results.map(row => ({
            query: row.query,
            avgExecutionTime: parseFloat(row.avg_execution_time),
            maxExecutionTime: row.max_execution_time,
            executionCount: parseInt(row.execution_count),
            lastExecuted: new Date(row.last_executed),
        }));
    }

    /**
     * Analyze query execution plan
     * Requirements: 1.3
     */
    async analyzeQueryPlan(query: string, params: any[]): Promise<QueryPlan> {
        try {
            // Build parameterized query for EXPLAIN ANALYZE
            let explainQuery = `EXPLAIN (ANALYZE, FORMAT JSON) ${query}`;

            // Execute EXPLAIN ANALYZE
            const result = await this.prisma.$queryRawUnsafe<any[]>(explainQuery, ...params);

            const plan = result[0]['QUERY PLAN'][0];
            const executionPlan = plan.Plan;

            // Extract key metrics
            const estimatedCost = executionPlan['Total Cost'] || 0;
            const actualCost = executionPlan['Actual Total Time'] || 0;

            // Find indexes used
            const indexesUsed = this.extractIndexesFromPlan(JSON.stringify(executionPlan));

            // Check for sequential scans
            const sequentialScans = JSON.stringify(executionPlan).includes('Seq Scan');

            return {
                planText: JSON.stringify(plan, null, 2),
                estimatedCost,
                actualCost,
                indexesUsed,
                sequentialScans,
            };
        } catch (error) {
            // If EXPLAIN fails, return minimal plan info
            console.error('Failed to analyze query plan:', error);
            return {
                planText: 'Failed to generate execution plan',
                estimatedCost: 0,
                actualCost: 0,
                indexesUsed: [],
                sequentialScans: false,
            };
        }
    }

    /**
     * Generate optimization recommendations
     * Requirements: 1.4
     */
    async generateRecommendations(query: string): Promise<Recommendation[]> {
        const recommendations: Recommendation[] = [];
        const normalizedQuery = query.toLowerCase();

        // Check for missing indexes (sequential scans)
        if (normalizedQuery.includes('where') && !normalizedQuery.includes('index')) {
            recommendations.push({
                type: 'index',
                description: 'Query contains WHERE clause that may benefit from an index',
                estimatedImprovement: '50-90% faster execution',
                implementation: 'Analyze query plan and create index on filtered columns',
            });
        }

        // Check for SELECT *
        if (normalizedQuery.includes('select *')) {
            recommendations.push({
                type: 'rewrite',
                description: 'Query uses SELECT * which fetches unnecessary columns',
                estimatedImprovement: '20-40% faster execution and reduced memory usage',
                implementation: 'Specify only required columns in SELECT clause',
            });
        }

        // Check for missing LIMIT on large tables
        if (normalizedQuery.includes('from') && !normalizedQuery.includes('limit')) {
            recommendations.push({
                type: 'rewrite',
                description: 'Query without LIMIT may return excessive rows',
                estimatedImprovement: '30-60% faster execution',
                implementation: 'Add LIMIT clause or implement cursor-based pagination',
            });
        }

        // Check for subqueries that could be JOINs
        if (normalizedQuery.includes('select') && normalizedQuery.split('select').length > 2) {
            recommendations.push({
                type: 'rewrite',
                description: 'Query contains subqueries that may be optimized as JOINs',
                estimatedImprovement: '40-70% faster execution',
                implementation: 'Rewrite subqueries as JOIN operations',
            });
        }

        // Check for frequently accessed data that could be cached
        if (normalizedQuery.includes('select') && !normalizedQuery.includes('for update')) {
            recommendations.push({
                type: 'cache',
                description: 'Query results could be cached to reduce database load',
                estimatedImprovement: '80-95% faster response time',
                implementation: 'Implement Redis caching with appropriate TTL',
            });
        }

        return recommendations;
    }

    /**
     * Get performance trends over time
     * Requirements: 1.5
     */
    async getPerformanceTrends(timeRange: TimeRange): Promise<PerformanceTrend[]> {
        const results = await this.prisma.queryPerformanceMetric.findMany({
            where: {
                date: {
                    gte: timeRange.start,
                    lte: timeRange.end,
                },
            },
            orderBy: {
                date: 'asc',
            },
            select: {
                date: true,
                avgExecutionTimeMs: true,
                executionCount: true,
                p95ExecutionTimeMs: true,
            },
        });

        return results.map(row => ({
            date: new Date(row.date),
            avgExecutionTime: parseFloat(row.avgExecutionTimeMs.toString()),
            executionCount: row.executionCount,
            p95ExecutionTime: row.p95ExecutionTimeMs,
        }));
    }

    /**
     * Extract index names from execution plan
     */
    private extractIndexesFromPlan(planJson: string): string[] {
        const indexes: string[] = [];
        const indexRegex = /"Index Name":\s*"([^"]+)"/g;
        let match;

        while ((match = indexRegex.exec(planJson)) !== null) {
            indexes.push(match[1]);
        }

        return [...new Set(indexes)]; // Remove duplicates
    }

    /**
     * Aggregate daily query metrics
     * Requirements: 1.5
     */
    async aggregateDailyMetrics(date: Date): Promise<void> {
        const startOfDay = new Date(date);
        startOfDay.setUTCHours(0, 0, 0, 0);

        const endOfDay = new Date(date);
        endOfDay.setUTCHours(23, 59, 59, 999);

        // Aggregate metrics for each query fingerprint
        await this.prisma.$executeRaw`
            INSERT INTO "QueryPerformanceMetric" (
                id,
                query_fingerprint,
                date,
                execution_count,
                avg_execution_time_ms,
                max_execution_time_ms,
                min_execution_time_ms,
                p95_execution_time_ms,
                total_rows_affected,
                created_at
            )
            SELECT 
                gen_random_uuid() as id,
                query_fingerprint,
                ${date}::date as date,
                COUNT(*) as execution_count,
                AVG(execution_time_ms)::numeric(10, 2) as avg_execution_time_ms,
                MAX(execution_time_ms) as max_execution_time_ms,
                MIN(execution_time_ms) as min_execution_time_ms,
                PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY execution_time_ms) as p95_execution_time_ms,
                SUM(affected_rows) as total_rows_affected,
                NOW() as created_at
            FROM "SlowQuery"
            WHERE created_at >= ${startOfDay} AND created_at < ${endOfDay}
            GROUP BY query_fingerprint
            ON CONFLICT (query_fingerprint, date) 
            DO UPDATE SET
                execution_count = EXCLUDED.execution_count,
                avg_execution_time_ms = EXCLUDED.avg_execution_time_ms,
                max_execution_time_ms = EXCLUDED.max_execution_time_ms,
                min_execution_time_ms = EXCLUDED.min_execution_time_ms,
                p95_execution_time_ms = EXCLUDED.p95_execution_time_ms,
                total_rows_affected = EXCLUDED.total_rows_affected
        `;
    }
}

// Singleton instance
let queryAnalyzerInstance: QueryAnalyzerImpl | null = null;

/**
 * Get or create QueryAnalyzer instance
 */
export function getQueryAnalyzer(prisma: PrismaClient): QueryAnalyzerImpl {
    if (!queryAnalyzerInstance) {
        queryAnalyzerInstance = new QueryAnalyzerImpl(prisma);
    }
    return queryAnalyzerInstance;
}

/**
 * Reset QueryAnalyzer instance (for testing)
 */
export function resetQueryAnalyzer(): void {
    queryAnalyzerInstance = null;
}
