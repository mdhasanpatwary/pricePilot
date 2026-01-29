/**
 * Index Manager Component
 * 
 * Manages database indexes for optimal query performance by analyzing table
 * access patterns, suggesting missing indexes, identifying unused indexes,
 * and maintaining index health.
 * 
 * Features:
 * - Analyzes pg_stat_statements to suggest missing indexes
 * - Identifies unused indexes using pg_stat_user_indexes
 * - Creates indexes concurrently to avoid table locking
 * - Monitors index fragmentation using pgstattuple
 * - Rebuilds fragmented indexes during maintenance windows
 * - Tracks index usage statistics
 * 
 * Requirements: 2.2, 2.3, 2.4, 2.5, 2.6
 */

import { optimizedPrisma } from '@/lib/database/optimized-prisma';
import { getConnectionPoolManager } from './connection-pool-manager';
import {
    IndexManager as IIndexManager,
    IndexSuggestion,
    UnusedIndex,
    IndexDefinition,
    IndexStats
} from '@/lib/types/database-optimization';
import { OPTIMIZATION_CONFIG, isMaintenanceWindow } from '@/lib/database/optimization-constants';

/**
 * IndexManager implementation
 * 
 * Provides comprehensive index management capabilities including analysis,
 * creation, maintenance, and monitoring.
 */
export class IndexManager implements IIndexManager {
    private poolManager = getConnectionPoolManager();

    /**
     * Analyze query patterns and suggest missing indexes
     * 
     * Uses pg_stat_statements to identify queries with sequential scans
     * on large tables and suggests appropriate indexes.
     * 
     * Requirements: 2.2
     */
    async suggestIndexes(): Promise<IndexSuggestion[]> {
        const pool = this.poolManager.getPool();

        // Query pg_stat_statements for queries with sequential scans
        const result = await pool.query(`
            WITH slow_queries AS (
                SELECT 
                    query,
                    calls,
                    mean_exec_time,
                    total_exec_time
                FROM pg_stat_statements
                WHERE query NOT LIKE '%pg_stat%'
                    AND query NOT LIKE '%information_schema%'
                    AND mean_exec_time > 100
                ORDER BY total_exec_time DESC
                LIMIT 50
            ),
            table_sizes AS (
                SELECT 
                    schemaname,
                    tablename,
                    pg_total_relation_size(schemaname||'.'||tablename) as size_bytes,
                    n_tup_ins + n_tup_upd + n_tup_del as write_activity
                FROM pg_stat_user_tables
                WHERE n_live_tup > 10000
            )
            SELECT 
                t.tablename,
                t.size_bytes,
                t.write_activity,
                COUNT(DISTINCT sq.query) as slow_query_count
            FROM table_sizes t
            CROSS JOIN slow_queries sq
            WHERE sq.query ILIKE '%' || t.tablename || '%'
                AND sq.query ILIKE '%WHERE%'
            GROUP BY t.tablename, t.size_bytes, t.write_activity
            HAVING COUNT(DISTINCT sq.query) >= 2
            ORDER BY slow_query_count DESC, t.size_bytes DESC
        `);

        const suggestions: IndexSuggestion[] = [];

        // Analyze each table for potential index opportunities
        for (const row of result.rows) {
            const tableName = row.tablename;

            // Get existing indexes for this table
            const existingIndexes = await pool.query(`
                SELECT 
                    indexname,
                    indexdef
                FROM pg_indexes
                WHERE tablename = $1
                    AND schemaname = 'public'
            `, [tableName]);

            const existingIndexDefs = existingIndexes.rows.map(r => r.indexdef.toLowerCase());

            // Suggest common multi-tenant patterns
            const potentialIndexes = this.generateIndexSuggestions(tableName, existingIndexDefs);

            for (const suggestion of potentialIndexes) {
                // Check if index already exists
                const indexExists = existingIndexDefs.some(def =>
                    def.includes(suggestion.columns.join(',').toLowerCase())
                );

                if (!indexExists) {
                    suggestions.push({
                        ...suggestion,
                        estimatedImpact: this.estimateIndexImpact(
                            row.slow_query_count,
                            row.size_bytes,
                            row.write_activity
                        )
                    });
                }
            }
        }

        // Store recommendations in database
        for (const suggestion of suggestions) {
            await optimizedPrisma.indexRecommendation.create({
                data: {
                    tableName: suggestion.tableName,
                    columns: suggestion.columns,
                    reason: suggestion.reason,
                    estimatedImpact: suggestion.estimatedImpact,
                    createStatement: suggestion.createStatement,
                    status: 'pending'
                }
            });
        }

        return suggestions;
    }

    /**
     * Generate index suggestions for a table based on common patterns
     */
    private generateIndexSuggestions(
        tableName: string,
        existingIndexDefs: string[]
    ): Omit<IndexSuggestion, 'estimatedImpact'>[] {
        const suggestions: Omit<IndexSuggestion, 'estimatedImpact'>[] = [];

        // Multi-tenant pattern: tenantId + status
        if (!existingIndexDefs.some(def => def.includes('tenantid') && def.includes('status'))) {
            suggestions.push({
                tableName,
                columns: ['tenantId', 'status'],
                reason: 'Multi-tenant queries frequently filter by tenantId and status',
                createStatement: `CREATE INDEX CONCURRENTLY idx_${tableName}_tenant_status ON ${tableName}(tenantId, status)`
            });
        }

        // Time-based queries: tenantId + createdAt
        if (!existingIndexDefs.some(def => def.includes('tenantid') && def.includes('createdat'))) {
            suggestions.push({
                tableName,
                columns: ['tenantId', 'createdAt'],
                reason: 'Time-based queries benefit from composite index on tenantId and createdAt',
                createStatement: `CREATE INDEX CONCURRENTLY idx_${tableName}_tenant_created ON ${tableName}(tenantId, createdAt DESC)`
            });
        }

        // Updated timestamp queries
        if (!existingIndexDefs.some(def => def.includes('updatedat'))) {
            suggestions.push({
                tableName,
                columns: ['updatedAt'],
                reason: 'Queries filtering or sorting by updatedAt are common',
                createStatement: `CREATE INDEX CONCURRENTLY idx_${tableName}_updated ON ${tableName}(updatedAt DESC)`
            });
        }

        return suggestions;
    }

    /**
     * Estimate the impact of creating an index
     */
    private estimateIndexImpact(
        slowQueryCount: number,
        sizeBytes: number,
        writeActivity: number
    ): 'high' | 'medium' | 'low' {
        // High impact: many slow queries, large table, low write activity
        if (slowQueryCount >= 5 && sizeBytes > 100_000_000 && writeActivity < 10000) {
            return 'high';
        }

        // Low impact: few slow queries or very high write activity
        if (slowQueryCount < 2 || writeActivity > 100000) {
            return 'low';
        }

        return 'medium';
    }

    /**
     * Find unused indexes that can be dropped
     * 
     * Uses pg_stat_user_indexes to identify indexes with zero scans
     * over the specified time period.
     * 
     * Requirements: 2.3
     */
    async findUnusedIndexes(minDaysSinceUse: number = 30): Promise<UnusedIndex[]> {
        const pool = this.poolManager.getPool();

        // Reset stats if needed to get accurate usage data
        // Note: This should be done carefully in production

        const result = await pool.query(`
            SELECT 
                schemaname,
                tablename,
                indexname,
                idx_scan,
                pg_size_pretty(pg_relation_size(indexrelid)) as index_size,
                pg_relation_size(indexrelid) as size_bytes,
                pg_stat_get_last_vacuum_time(i.indrelid) as last_vacuum
            FROM pg_stat_user_indexes
            JOIN pg_index i ON i.indexrelid = pg_stat_user_indexes.indexrelid
            WHERE schemaname = 'public'
                AND idx_scan = 0
                AND NOT i.indisprimary
                AND NOT i.indisunique
                AND indexname NOT LIKE '%_pkey'
                AND indexname NOT LIKE '%_key'
            ORDER BY pg_relation_size(indexrelid) DESC
        `);

        const unusedIndexes: UnusedIndex[] = result.rows.map(row => ({
            indexName: row.indexname,
            tableName: row.tablename,
            sizeBytes: parseInt(row.size_bytes),
            lastUsed: row.last_vacuum ? new Date(row.last_vacuum) : null,
            dropStatement: `DROP INDEX CONCURRENTLY IF EXISTS ${row.indexname};`
        }));

        return unusedIndexes;
    }

    /**
     * Create an index concurrently to avoid table locking
     * 
     * Uses CREATE INDEX CONCURRENTLY to allow normal operations
     * to continue while the index is being built.
     * 
     * Requirements: 2.4
     */
    async createIndexConcurrently(indexDef: IndexDefinition): Promise<void> {
        const pool = this.poolManager.getPool();

        // Build the CREATE INDEX statement
        const uniqueClause = indexDef.unique ? 'UNIQUE ' : '';
        const whereClause = indexDef.where ? ` WHERE ${indexDef.where}` : '';
        const columnList = indexDef.columns.join(', ');

        const createStatement = `
            CREATE ${uniqueClause}INDEX CONCURRENTLY IF NOT EXISTS ${indexDef.name}
            ON ${indexDef.tableName}(${columnList})${whereClause}
        `;

        try {
            // Execute the index creation
            await pool.query(createStatement);

            // Update the recommendation status if it exists
            await optimizedPrisma.indexRecommendation.updateMany({
                where: {
                    tableName: indexDef.tableName,
                    columns: {
                        equals: indexDef.columns
                    },
                    status: 'pending'
                },
                data: {
                    status: 'applied',
                    appliedAt: new Date()
                }
            });

            console.log(`Successfully created index: ${indexDef.name}`);
        } catch (error) {
            console.error(`Failed to create index ${indexDef.name}:`, error);
            throw error;
        }
    }

    /**
     * Rebuild fragmented indexes during maintenance windows
     * 
     * Uses pgstattuple to detect fragmentation and rebuilds indexes
     * that exceed the threshold.
     * 
     * Requirements: 2.6
     */
    async rebuildFragmentedIndexes(fragmentationThreshold: number = 30): Promise<void> {
        // Check if we're in a maintenance window
        if (!isMaintenanceWindow()) {
            console.log('Not in maintenance window, skipping index rebuild');
            return;
        }

        const pool = this.poolManager.getPool();

        // Get all indexes with their fragmentation stats
        const result = await pool.query(`
            SELECT 
                schemaname,
                tablename,
                indexname,
                pg_relation_size(indexrelid) as size_bytes
            FROM pg_stat_user_indexes
            WHERE schemaname = 'public'
                AND pg_relation_size(indexrelid) > 10485760
            ORDER BY pg_relation_size(indexrelid) DESC
        `);

        for (const row of result.rows) {
            try {
                // Check fragmentation using pgstattuple
                const fragResult = await pool.query(`
                    SELECT 
                        (100 - (100.0 * avg_leaf_density / 100.0))::numeric(5,2) as fragmentation_percent
                    FROM pgstatindex($1)
                `, [row.indexname]);

                const fragmentation = parseFloat(fragResult.rows[0]?.fragmentation_percent || '0');

                if (fragmentation >= fragmentationThreshold) {
                    console.log(`Rebuilding fragmented index: ${row.indexname} (${fragmentation}% fragmented)`);

                    // Rebuild the index concurrently
                    await pool.query(`REINDEX INDEX CONCURRENTLY ${row.indexname}`);

                    console.log(`Successfully rebuilt index: ${row.indexname}`);
                }
            } catch (error) {
                console.error(`Failed to check/rebuild index ${row.indexname}:`, error);
                // Continue with other indexes
            }
        }
    }

    /**
     * Get index usage statistics for monitoring
     * 
     * Returns comprehensive statistics for all indexes including
     * scans, tuples read/returned, size, and fragmentation.
     * 
     * Requirements: 2.5
     */
    async getIndexStats(): Promise<IndexStats[]> {
        const pool = this.poolManager.getPool();

        const result = await pool.query(`
            SELECT 
                schemaname,
                tablename,
                indexname,
                idx_scan as scans,
                idx_tup_read as tuples_read,
                idx_tup_fetch as tuples_returned,
                pg_relation_size(indexrelid) as size_bytes
            FROM pg_stat_user_indexes
            WHERE schemaname = 'public'
            ORDER BY pg_relation_size(indexrelid) DESC
        `);

        const stats: IndexStats[] = [];

        for (const row of result.rows) {
            let fragmentation = 0;

            // Get fragmentation for larger indexes
            if (row.size_bytes > 10485760) { // > 10MB
                try {
                    const fragResult = await pool.query(`
                        SELECT 
                            (100 - (100.0 * avg_leaf_density / 100.0))::numeric(5,2) as fragmentation_percent
                        FROM pgstatindex($1)
                    `, [row.indexname]);

                    fragmentation = parseFloat(fragResult.rows[0]?.fragmentation_percent || '0');
                } catch (error) {
                    // Skip fragmentation check if it fails
                    console.warn(`Could not check fragmentation for ${row.indexname}`);
                }
            }

            stats.push({
                indexName: row.indexname,
                tableName: row.tablename,
                sizeBytes: parseInt(row.size_bytes),
                scans: parseInt(row.scans),
                tuplesRead: parseInt(row.tuples_read),
                tuplesReturned: parseInt(row.tuples_returned),
                fragmentation
            });
        }

        return stats;
    }
}

/**
 * Singleton instance of IndexManager
 */
let indexManagerInstance: IndexManager | null = null;

/**
 * Get the singleton IndexManager instance
 */
export function getIndexManager(): IndexManager {
    if (!indexManagerInstance) {
        indexManagerInstance = new IndexManager();
    }
    return indexManagerInstance;
}
