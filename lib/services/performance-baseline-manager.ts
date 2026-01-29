/**
 * Performance Baseline Manager
 * 
 * Manages performance baselines for critical queries and detects regressions.
 * 
 * Features:
 * - Establish performance baselines for critical queries
 * - Compare current performance against baselines
 * - Detect performance regressions (>20% degradation)
 * - Store and retrieve baseline data
 * 
 * @module lib/services/performance-baseline-manager
 */

import { Pool } from 'pg';
import {
    PerformanceBaseline,
    PerformanceComparison,
} from '@/lib/types/database-optimization';
import {
    PERFORMANCE_REGRESSION_THRESHOLD,
    PERFORMANCE_BASELINE_SAMPLE_SIZE,
} from '@/lib/database/optimization-constants';
import { logger } from '@/lib/logger';
import { PerformanceTester } from './performance-tester';

export interface BaselineConfig {
    queryFingerprint: string;
    queryName: string;
    sql: string;
    params?: any[];
    isCritical: boolean;
}

export class PerformanceBaselineManager {
    private pool: Pool;
    private tester: PerformanceTester;

    constructor(pool: Pool) {
        this.pool = pool;
        this.tester = new PerformanceTester(pool);
    }

    /**
     * Establish a performance baseline for a query
     */
    async establishBaseline(config: BaselineConfig): Promise<PerformanceBaseline> {
        logger.info('Establishing performance baseline', {
            queryFingerprint: config.queryFingerprint,
            queryName: config.queryName,
        });

        // Measure query performance
        const metrics = await this.tester.measureQueryResponseTime(
            config.sql,
            config.params,
            PERFORMANCE_BASELINE_SAMPLE_SIZE
        );

        const baseline: PerformanceBaseline = {
            queryFingerprint: config.queryFingerprint,
            p50: metrics.p50,
            p95: metrics.p95,
            p99: metrics.p99,
            establishedAt: new Date(),
        };

        // Store baseline in database
        await this.storeBaseline(config, baseline);

        logger.info('Performance baseline established', {
            queryFingerprint: config.queryFingerprint,
            p50: baseline.p50,
            p95: baseline.p95,
            p99: baseline.p99,
        });

        return baseline;
    }

    /**
     * Store baseline in database
     */
    private async storeBaseline(
        config: BaselineConfig,
        baseline: PerformanceBaseline
    ): Promise<void> {
        const query = `
      INSERT INTO performance_baselines (
        query_fingerprint,
        query_name,
        query_text,
        p50_ms,
        p95_ms,
        p99_ms,
        is_critical,
        established_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      ON CONFLICT (query_fingerprint) 
      DO UPDATE SET
        query_name = EXCLUDED.query_name,
        query_text = EXCLUDED.query_text,
        p50_ms = EXCLUDED.p50_ms,
        p95_ms = EXCLUDED.p95_ms,
        p99_ms = EXCLUDED.p99_ms,
        is_critical = EXCLUDED.is_critical,
        established_at = EXCLUDED.established_at,
        updated_at = NOW()
    `;

        await this.pool.query(query, [
            config.queryFingerprint,
            config.queryName,
            config.sql,
            baseline.p50,
            baseline.p95,
            baseline.p99,
            config.isCritical,
            baseline.establishedAt,
        ]);
    }

    /**
     * Get baseline for a query
     */
    async getBaseline(queryFingerprint: string): Promise<PerformanceBaseline | null> {
        const query = `
      SELECT 
        query_fingerprint,
        p50_ms as p50,
        p95_ms as p95,
        p99_ms as p99,
        established_at
      FROM performance_baselines
      WHERE query_fingerprint = $1
    `;

        const result = await this.pool.query(query, [queryFingerprint]);

        if (result.rows.length === 0) {
            return null;
        }

        return {
            queryFingerprint: result.rows[0].query_fingerprint,
            p50: parseFloat(result.rows[0].p50),
            p95: parseFloat(result.rows[0].p95),
            p99: parseFloat(result.rows[0].p99),
            establishedAt: result.rows[0].established_at,
        };
    }

    /**
     * Compare current performance against baseline
     */
    async compareAgainstBaseline(
        queryFingerprint: string,
        sql: string,
        params: any[] = []
    ): Promise<PerformanceComparison | null> {
        // Get baseline
        const baseline = await this.getBaseline(queryFingerprint);

        if (!baseline) {
            logger.warn('No baseline found for query', { queryFingerprint });
            return null;
        }

        // Measure current performance
        const currentMetrics = await this.tester.measureQueryResponseTime(
            sql,
            params,
            Math.min(100, PERFORMANCE_BASELINE_SAMPLE_SIZE) // Use fewer samples for comparison
        );

        // Calculate degradation
        const degradationPercent =
            ((currentMetrics.p95 - baseline.p95) / baseline.p95) * 100;

        const isRegression = degradationPercent > (PERFORMANCE_REGRESSION_THRESHOLD * 100);

        const comparison: PerformanceComparison = {
            queryFingerprint,
            baselineP95: baseline.p95,
            currentP95: currentMetrics.p95,
            degradationPercent,
            isRegression,
        };

        // Log regression if detected
        if (isRegression) {
            logger.warn('Performance regression detected', {
                queryFingerprint,
                baselineP95: baseline.p95,
                currentP95: currentMetrics.p95,
                degradationPercent: degradationPercent.toFixed(2),
            });

            // Store regression record
            await this.recordRegression(comparison);
        }

        return comparison;
    }

    /**
     * Record a performance regression
     */
    private async recordRegression(comparison: PerformanceComparison): Promise<void> {
        const query = `
      INSERT INTO performance_regressions (
        query_fingerprint,
        baseline_p95_ms,
        current_p95_ms,
        degradation_percent,
        detected_at
      ) VALUES ($1, $2, $3, $4, NOW())
    `;

        await this.pool.query(query, [
            comparison.queryFingerprint,
            comparison.baselineP95,
            comparison.currentP95,
            comparison.degradationPercent,
        ]);
    }

    /**
     * Get all baselines
     */
    async getAllBaselines(): Promise<Array<PerformanceBaseline & { queryName: string; isCritical: boolean }>> {
        const query = `
      SELECT 
        query_fingerprint,
        query_name,
        p50_ms as p50,
        p95_ms as p95,
        p99_ms as p99,
        is_critical,
        established_at
      FROM performance_baselines
      ORDER BY is_critical DESC, p95_ms DESC
    `;

        const result = await this.pool.query(query);

        return result.rows.map(row => ({
            queryFingerprint: row.query_fingerprint,
            queryName: row.query_name,
            p50: parseFloat(row.p50),
            p95: parseFloat(row.p95),
            p99: parseFloat(row.p99),
            isCritical: row.is_critical,
            establishedAt: row.established_at,
        }));
    }

    /**
     * Get recent regressions
     */
    async getRecentRegressions(limit: number = 10): Promise<Array<PerformanceComparison & { detectedAt: Date }>> {
        const query = `
      SELECT 
        pr.query_fingerprint,
        pr.baseline_p95_ms as baseline_p95,
        pr.current_p95_ms as current_p95,
        pr.degradation_percent,
        pr.detected_at,
        pb.query_name
      FROM performance_regressions pr
      LEFT JOIN performance_baselines pb ON pr.query_fingerprint = pb.query_fingerprint
      ORDER BY pr.detected_at DESC
      LIMIT $1
    `;

        const result = await this.pool.query(query, [limit]);

        return result.rows.map(row => ({
            queryFingerprint: row.query_fingerprint,
            baselineP95: parseFloat(row.baseline_p95),
            currentP95: parseFloat(row.current_p95),
            degradationPercent: parseFloat(row.degradation_percent),
            isRegression: true,
            detectedAt: row.detected_at,
        }));
    }

    /**
     * Delete baseline
     */
    async deleteBaseline(queryFingerprint: string): Promise<void> {
        const query = `DELETE FROM performance_baselines WHERE query_fingerprint = $1`;
        await this.pool.query(query, [queryFingerprint]);

        logger.info('Performance baseline deleted', { queryFingerprint });
    }

    /**
     * Establish baselines for critical queries
     */
    async establishCriticalBaselines(): Promise<PerformanceBaseline[]> {
        const criticalQueries: BaselineConfig[] = [
            {
                queryFingerprint: 'user_products_active_list',
                queryName: 'Active User Products List',
                sql: `SELECT * FROM user_products WHERE tenant_id = $1 AND status = 'active' LIMIT 20`,
                params: ['test-tenant'],
                isCritical: true,
            },
            {
                queryFingerprint: 'competitor_products_recent',
                queryName: 'Recent Competitor Products',
                sql: `SELECT * FROM competitor_products WHERE tenant_id = $1 ORDER BY last_scraped_at DESC LIMIT 10`,
                params: ['test-tenant'],
                isCritical: true,
            },
            {
                queryFingerprint: 'product_matches_active',
                queryName: 'Active Product Matches',
                sql: `SELECT * FROM product_matches WHERE status = 'active' LIMIT 50`,
                isCritical: true,
            },
            {
                queryFingerprint: 'price_history_recent',
                queryName: 'Recent Price History',
                sql: `SELECT * FROM price_history WHERE tenant_id = $1 AND recorded_at > NOW() - INTERVAL '7 days' LIMIT 100`,
                params: ['test-tenant'],
                isCritical: true,
            },
            {
                queryFingerprint: 'audit_logs_daily',
                queryName: 'Daily Audit Logs',
                sql: `SELECT COUNT(*) FROM audit_logs WHERE tenant_id = $1 AND created_at > NOW() - INTERVAL '1 day'`,
                params: ['test-tenant'],
                isCritical: true,
            },
        ];

        const baselines: PerformanceBaseline[] = [];

        for (const config of criticalQueries) {
            try {
                const baseline = await this.establishBaseline(config);
                baselines.push(baseline);
            } catch (error) {
                logger.error('Failed to establish baseline', {
                    queryFingerprint: config.queryFingerprint,
                    error,
                });
            }
        }

        return baselines;
    }
}

export default PerformanceBaselineManager;
