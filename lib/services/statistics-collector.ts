/**
 * Database Statistics Collector
 * 
 * Collects and stores database statistics for historical tracking and capacity planning.
 * 
 * Features:
 * - Daily statistics collection for all tables
 * - Index statistics tracking
 * - 90+ day retention policy
 * - Automatic cleanup of old data
 * 
 * Requirements: 8.5
 */

import { Pool } from 'pg';
import { logger } from '@/lib/logger';
import { STATISTICS_HISTORY_RETENTION_DAYS } from '@/lib/database/optimization-constants';

export interface TableStatistics {
    tableName: string;
    sizeBytes: number;
    rowCount: number;
    indexSizeBytes: number;
    bloatPercent: number | null;
    lastVacuum: Date | null;
    lastAnalyze: Date | null;
    collectedAt: Date;
}

export interface IndexStatistics {
    indexName: string;
    tableName: string;
    sizeBytes: number;
    scans: number;
    tuplesRead: number;
    tuplesFetched: number;
    collectedAt: Date;
}

export class StatisticsCollector {
    private pool: Pool;

    constructor(pool: Pool) {
        this.pool = pool;
    }

    /**
     * Collect statistics for all tables
     * Requirements: 8.5
     */
    async collectTableStatistics(): Promise<TableStatistics[]> {
        const client = await this.pool.connect();

        try {
            logger.info('Starting table statistics collection');

            const result = await client.query(`
                SELECT 
                    schemaname || '.' || tablename as table_name,
                    pg_total_relation_size(schemaname || '.' || tablename) as size_bytes,
                    pg_relation_size(schemaname || '.' || tablename) as table_size_bytes,
                    pg_indexes_size(schemaname || '.' || tablename) as index_size_bytes,
                    n_live_tup as row_count,
                    last_vacuum,
                    last_autovacuum,
                    last_analyze,
                    last_autoanalyze
                FROM pg_stat_user_tables
                JOIN pg_tables ON pg_stat_user_tables.tablename = pg_tables.tablename
                    AND pg_stat_user_tables.schemaname = pg_tables.schemaname
                WHERE pg_tables.schemaname NOT IN ('pg_catalog', 'information_schema')
                ORDER BY size_bytes DESC
            `);

            const statistics: TableStatistics[] = [];
            const collectedAt = new Date();

            for (const row of result.rows) {
                const stat: TableStatistics = {
                    tableName: row.table_name,
                    sizeBytes: parseInt(row.size_bytes) || 0,
                    rowCount: parseInt(row.row_count) || 0,
                    indexSizeBytes: parseInt(row.index_size_bytes) || 0,
                    bloatPercent: null, // Will be calculated separately if needed
                    lastVacuum: row.last_vacuum || row.last_autovacuum || null,
                    lastAnalyze: row.last_analyze || row.last_autoanalyze || null,
                    collectedAt,
                };

                statistics.push(stat);

                // Store in history table
                await client.query(
                    `INSERT INTO database_statistics_history 
                    (table_name, size_bytes, row_count, index_size_bytes, bloat_percent, last_vacuum, last_analyze, collected_at)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
                    [
                        stat.tableName,
                        stat.sizeBytes,
                        stat.rowCount,
                        stat.indexSizeBytes,
                        stat.bloatPercent,
                        stat.lastVacuum,
                        stat.lastAnalyze,
                        stat.collectedAt,
                    ]
                );
            }

            logger.info('Table statistics collection completed', {
                tablesCollected: statistics.length,
                totalSize: statistics.reduce((sum, s) => sum + s.sizeBytes, 0),
            });

            return statistics;
        } catch (error) {
            logger.error('Failed to collect table statistics', {
                error: error instanceof Error ? error.message : 'Unknown error',
            });
            throw error;
        } finally {
            client.release();
        }
    }

    /**
     * Collect statistics for all indexes
     * Requirements: 8.5
     */
    async collectIndexStatistics(): Promise<IndexStatistics[]> {
        const client = await this.pool.connect();

        try {
            logger.info('Starting index statistics collection');

            const result = await client.query(`
                SELECT 
                    schemaname || '.' || indexrelname as index_name,
                    schemaname || '.' || tablename as table_name,
                    pg_relation_size(indexrelid) as size_bytes,
                    idx_scan as scans,
                    idx_tup_read as tuples_read,
                    idx_tup_fetch as tuples_fetched
                FROM pg_stat_user_indexes
                WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
                ORDER BY size_bytes DESC
            `);

            const statistics: IndexStatistics[] = [];
            const collectedAt = new Date();

            for (const row of result.rows) {
                const stat: IndexStatistics = {
                    indexName: row.index_name,
                    tableName: row.table_name,
                    sizeBytes: parseInt(row.size_bytes) || 0,
                    scans: parseInt(row.scans) || 0,
                    tuplesRead: parseInt(row.tuples_read) || 0,
                    tuplesFetched: parseInt(row.tuples_fetched) || 0,
                    collectedAt,
                };

                statistics.push(stat);

                // Store in history table
                await client.query(
                    `INSERT INTO index_statistics_history 
                    (index_name, table_name, size_bytes, scans, tuples_read, tuples_fetched, collected_at)
                    VALUES ($1, $2, $3, $4, $5, $6, $7)`,
                    [
                        stat.indexName,
                        stat.tableName,
                        stat.sizeBytes,
                        stat.scans,
                        stat.tuplesRead,
                        stat.tuplesFetched,
                        stat.collectedAt,
                    ]
                );
            }

            logger.info('Index statistics collection completed', {
                indexesCollected: statistics.length,
                totalSize: statistics.reduce((sum, s) => sum + s.sizeBytes, 0),
            });

            return statistics;
        } catch (error) {
            logger.error('Failed to collect index statistics', {
                error: error instanceof Error ? error.message : 'Unknown error',
            });
            throw error;
        } finally {
            client.release();
        }
    }

    /**
     * Collect all statistics (tables and indexes)
     */
    async collectAllStatistics(): Promise<{
        tables: TableStatistics[];
        indexes: IndexStatistics[];
    }> {
        const tables = await this.collectTableStatistics();
        const indexes = await this.collectIndexStatistics();

        return { tables, indexes };
    }

    /**
     * Clean up old statistics (older than retention period)
     * Requirements: 8.5
     */
    async cleanupOldStatistics(): Promise<{ tablesDeleted: number; indexesDeleted: number }> {
        const client = await this.pool.connect();

        try {
            logger.info('Starting statistics cleanup', {
                retentionDays: STATISTICS_HISTORY_RETENTION_DAYS,
            });

            // Delete old table statistics
            const tablesResult = await client.query(
                `DELETE FROM database_statistics_history 
                WHERE collected_at < NOW() - INTERVAL '${STATISTICS_HISTORY_RETENTION_DAYS} days'
                RETURNING id`
            );

            // Delete old index statistics
            const indexesResult = await client.query(
                `DELETE FROM index_statistics_history 
                WHERE collected_at < NOW() - INTERVAL '${STATISTICS_HISTORY_RETENTION_DAYS} days'
                RETURNING id`
            );

            const tablesDeleted = tablesResult.rowCount || 0;
            const indexesDeleted = indexesResult.rowCount || 0;

            logger.info('Statistics cleanup completed', {
                tablesDeleted,
                indexesDeleted,
            });

            return { tablesDeleted, indexesDeleted };
        } catch (error) {
            logger.error('Failed to cleanup old statistics', {
                error: error instanceof Error ? error.message : 'Unknown error',
            });
            throw error;
        } finally {
            client.release();
        }
    }

    /**
     * Get historical statistics for a specific table
     */
    async getTableHistory(
        tableName: string,
        days: number = 30
    ): Promise<TableStatistics[]> {
        const client = await this.pool.connect();

        try {
            const result = await client.query(
                `SELECT 
                    table_name,
                    size_bytes,
                    row_count,
                    index_size_bytes,
                    bloat_percent,
                    last_vacuum,
                    last_analyze,
                    collected_at
                FROM database_statistics_history
                WHERE table_name = $1
                    AND collected_at >= NOW() - INTERVAL '${days} days'
                ORDER BY collected_at DESC`,
                [tableName]
            );

            return result.rows.map(row => ({
                tableName: row.table_name,
                sizeBytes: parseInt(row.size_bytes),
                rowCount: parseInt(row.row_count),
                indexSizeBytes: parseInt(row.index_size_bytes),
                bloatPercent: row.bloat_percent ? parseFloat(row.bloat_percent) : null,
                lastVacuum: row.last_vacuum,
                lastAnalyze: row.last_analyze,
                collectedAt: row.collected_at,
            }));
        } finally {
            client.release();
        }
    }

    /**
     * Get historical statistics for a specific index
     */
    async getIndexHistory(
        indexName: string,
        days: number = 30
    ): Promise<IndexStatistics[]> {
        const client = await this.pool.connect();

        try {
            const result = await client.query(
                `SELECT 
                    index_name,
                    table_name,
                    size_bytes,
                    scans,
                    tuples_read,
                    tuples_fetched,
                    collected_at
                FROM index_statistics_history
                WHERE index_name = $1
                    AND collected_at >= NOW() - INTERVAL '${days} days'
                ORDER BY collected_at DESC`,
                [indexName]
            );

            return result.rows.map(row => ({
                indexName: row.index_name,
                tableName: row.table_name,
                sizeBytes: parseInt(row.size_bytes),
                scans: parseInt(row.scans),
                tuplesRead: parseInt(row.tuples_read),
                tuplesFetched: parseInt(row.tuples_fetched),
                collectedAt: row.collected_at,
            }));
        } finally {
            client.release();
        }
    }

    /**
     * Get growth trends for all tables
     */
    async getGrowthTrends(days: number = 30): Promise<
        Array<{
            tableName: string;
            startSize: number;
            endSize: number;
            growthBytes: number;
            growthPercent: number;
        }>
    > {
        const client = await this.pool.connect();

        try {
            const result = await client.query(`
                WITH start_stats AS (
                    SELECT DISTINCT ON (table_name)
                        table_name,
                        size_bytes as start_size,
                        collected_at as start_date
                    FROM database_statistics_history
                    WHERE collected_at >= NOW() - INTERVAL '${days} days'
                    ORDER BY table_name, collected_at ASC
                ),
                end_stats AS (
                    SELECT DISTINCT ON (table_name)
                        table_name,
                        size_bytes as end_size,
                        collected_at as end_date
                    FROM database_statistics_history
                    WHERE collected_at >= NOW() - INTERVAL '${days} days'
                    ORDER BY table_name, collected_at DESC
                )
                SELECT 
                    s.table_name,
                    s.start_size,
                    e.end_size,
                    (e.end_size - s.start_size) as growth_bytes,
                    CASE 
                        WHEN s.start_size > 0 THEN 
                            ((e.end_size - s.start_size)::numeric / s.start_size::numeric)
                        ELSE 0
                    END as growth_percent
                FROM start_stats s
                JOIN end_stats e ON s.table_name = e.table_name
                WHERE s.start_size > 0
                ORDER BY growth_percent DESC
            `);

            return result.rows.map(row => ({
                tableName: row.table_name,
                startSize: parseInt(row.start_size),
                endSize: parseInt(row.end_size),
                growthBytes: parseInt(row.growth_bytes),
                growthPercent: parseFloat(row.growth_percent),
            }));
        } finally {
            client.release();
        }
    }
}
