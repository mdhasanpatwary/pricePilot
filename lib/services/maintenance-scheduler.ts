/**
 * Database Maintenance Scheduler
 * 
 * Implements automated database maintenance including:
 * - Table bloat detection using pgstattuple
 * - VACUUM scheduling for high bloat tables
 * - Table/index size monitoring with growth alerts
 * 
 * Requirements: 8.3, 8.4
 */

import { Pool } from 'pg';
import { logger } from '@/lib/logger';
import {
    TABLE_BLOAT_WARNING_THRESHOLD,
    TABLE_BLOAT_CRITICAL_THRESHOLD,
    TABLE_GROWTH_ALERT_THRESHOLD,
    VACUUM_SCHEDULE_DAY,
    isMaintenanceWindow,
    formatBytes,
} from '@/lib/database/optimization-constants';
import type {
    TableBloatInfo,
    GrowthAlert,
    MaintenanceSchedule,
} from '@/lib/types/database-optimization';

export class MaintenanceScheduler {
    private pool: Pool;

    constructor(pool: Pool) {
        this.pool = pool;
    }

    /**
     * Detect table bloat using pgstattuple extension
     * Requirements: 8.3
     */
    async detectTableBloat(): Promise<TableBloatInfo[]> {
        const client = await this.pool.connect();

        try {
            // Get list of tables to check (excluding system tables)
            const tablesResult = await client.query(`
                SELECT 
                    schemaname,
                    tablename
                FROM pg_tables
                WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
                ORDER BY tablename
            `);

            const bloatInfo: TableBloatInfo[] = [];

            for (const row of tablesResult.rows) {
                const { schemaname, tablename } = row;
                const fullTableName = `${schemaname}.${tablename}`;

                try {
                    // Use pgstattuple to get bloat information
                    const bloatResult = await client.query(
                        `SELECT * FROM pgstattuple($1)`,
                        [fullTableName]
                    );

                    if (bloatResult.rows.length > 0) {
                        const stats = bloatResult.rows[0];
                        const tableLen = parseInt(stats.table_len);
                        const deadTupleLen = parseInt(stats.dead_tuple_len);
                        const bloatBytes = deadTupleLen;
                        const bloatPercent = tableLen > 0 ? deadTupleLen / tableLen : 0;

                        const shouldVacuum = bloatPercent >= TABLE_BLOAT_WARNING_THRESHOLD;

                        bloatInfo.push({
                            tableName: fullTableName,
                            bloatPercent,
                            bloatBytes,
                            shouldVacuum,
                        });

                        // Log warning for high bloat
                        if (bloatPercent >= TABLE_BLOAT_CRITICAL_THRESHOLD) {
                            logger.warn('Critical table bloat detected', {
                                table: fullTableName,
                                bloatPercent: (bloatPercent * 100).toFixed(2) + '%',
                                bloatSize: formatBytes(bloatBytes),
                            });
                        } else if (shouldVacuum) {
                            logger.info('Table bloat detected', {
                                table: fullTableName,
                                bloatPercent: (bloatPercent * 100).toFixed(2) + '%',
                                bloatSize: formatBytes(bloatBytes),
                            });
                        }
                    }
                } catch (error) {
                    // Skip tables that can't be analyzed (e.g., too large, locked)
                    logger.debug('Could not analyze table bloat', {
                        table: fullTableName,
                        error: error instanceof Error ? error.message : 'Unknown error',
                    });
                }
            }

            return bloatInfo;
        } finally {
            client.release();
        }
    }

    /**
     * Schedule VACUUM operations for high bloat tables
     * Requirements: 8.3
     */
    async scheduleVacuum(bloatInfo: TableBloatInfo[]): Promise<MaintenanceSchedule[]> {
        const schedules: MaintenanceSchedule[] = [];

        for (const info of bloatInfo) {
            if (!info.shouldVacuum) continue;

            const operation = info.bloatPercent >= TABLE_BLOAT_CRITICAL_THRESHOLD
                ? 'VACUUM_FULL'
                : 'VACUUM';

            // Calculate next maintenance window
            const now = new Date();
            const nextWindow = new Date(now);

            // If not in maintenance window, schedule for next window
            if (!isMaintenanceWindow()) {
                // Set to next 2 AM UTC
                nextWindow.setUTCHours(2, 0, 0, 0);
                if (nextWindow <= now) {
                    nextWindow.setUTCDate(nextWindow.getUTCDate() + 1);
                }
            }

            // Estimate duration based on table size
            const estimatedDuration = this.estimateVacuumDuration(
                info.bloatBytes,
                operation === 'VACUUM_FULL'
            );

            schedules.push({
                operation,
                tableName: info.tableName,
                scheduledTime: nextWindow,
                estimatedDuration,
            });

            logger.info('Scheduled VACUUM operation', {
                operation,
                table: info.tableName,
                scheduledTime: nextWindow.toISOString(),
                estimatedDuration: `${estimatedDuration}ms`,
            });
        }

        return schedules;
    }

    /**
     * Execute scheduled VACUUM operations
     */
    async executeVacuum(schedule: MaintenanceSchedule): Promise<void> {
        const client = await this.pool.connect();

        try {
            const startTime = Date.now();

            logger.info('Starting VACUUM operation', {
                operation: schedule.operation,
                table: schedule.tableName,
            });

            if (schedule.operation === 'VACUUM_FULL') {
                await client.query(`VACUUM FULL ${schedule.tableName}`);
            } else {
                await client.query(`VACUUM ${schedule.tableName}`);
            }

            const duration = Date.now() - startTime;

            logger.info('VACUUM operation completed', {
                operation: schedule.operation,
                table: schedule.tableName,
                duration: `${duration}ms`,
            });
        } catch (error) {
            logger.error('VACUUM operation failed', {
                operation: schedule.operation,
                table: schedule.tableName,
                error: error instanceof Error ? error.message : 'Unknown error',
            });
            throw error;
        } finally {
            client.release();
        }
    }

    /**
     * Monitor table and index sizes with growth alerts
     * Requirements: 8.4
     */
    async monitorGrowth(): Promise<GrowthAlert[]> {
        const client = await this.pool.connect();

        try {
            // Get current table sizes
            const currentSizes = await client.query(`
                SELECT 
                    schemaname || '.' || tablename as table_name,
                    pg_total_relation_size(schemaname || '.' || tablename) as size_bytes
                FROM pg_tables
                WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
                ORDER BY size_bytes DESC
            `);

            // Get historical sizes from 7 days ago
            const historicalSizes = await client.query(`
                SELECT 
                    table_name,
                    size_bytes
                FROM database_statistics_history
                WHERE 
                    collected_at >= NOW() - INTERVAL '7 days'
                    AND collected_at <= NOW() - INTERVAL '6 days'
                ORDER BY collected_at DESC
                LIMIT 1000
            `);

            const historicalMap = new Map<string, number>();
            for (const row of historicalSizes.rows) {
                historicalMap.set(row.table_name, parseInt(row.size_bytes));
            }

            const alerts: GrowthAlert[] = [];

            for (const row of currentSizes.rows) {
                const tableName = row.table_name;
                const currentSize = parseInt(row.size_bytes);
                const historicalSize = historicalMap.get(tableName);

                if (historicalSize && historicalSize > 0) {
                    const growthPercent = (currentSize - historicalSize) / historicalSize;

                    if (growthPercent >= TABLE_GROWTH_ALERT_THRESHOLD) {
                        const projectedSize = currentSize * (1 + growthPercent);

                        alerts.push({
                            tableName,
                            currentSizeBytes: currentSize,
                            growthPercent,
                            projectedSizeBytes: projectedSize,
                            alertThreshold: TABLE_GROWTH_ALERT_THRESHOLD,
                        });

                        logger.warn('High table growth detected', {
                            table: tableName,
                            currentSize: formatBytes(currentSize),
                            growthPercent: (growthPercent * 100).toFixed(2) + '%',
                            projectedSize: formatBytes(projectedSize),
                        });
                    }
                }
            }

            return alerts;
        } finally {
            client.release();
        }
    }

    /**
     * Get index sizes for monitoring
     */
    async getIndexSizes(): Promise<Array<{ indexName: string; sizeBytes: number }>> {
        const client = await this.pool.connect();

        try {
            const result = await client.query(`
                SELECT 
                    schemaname || '.' || indexname as index_name,
                    pg_relation_size(schemaname || '.' || indexname) as size_bytes
                FROM pg_indexes
                WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
                ORDER BY size_bytes DESC
            `);

            return result.rows.map(row => ({
                indexName: row.index_name,
                sizeBytes: parseInt(row.size_bytes),
            }));
        } finally {
            client.release();
        }
    }

    /**
     * Estimate VACUUM duration based on table size
     */
    private estimateVacuumDuration(bloatBytes: number, isFull: boolean): number {
        // Rough estimate: 1MB per second for VACUUM, 500KB per second for VACUUM FULL
        const bytesPerSecond = isFull ? 500 * 1024 : 1024 * 1024;
        const seconds = Math.ceil(bloatBytes / bytesPerSecond);
        return seconds * 1000; // Convert to milliseconds
    }

    /**
     * Run full maintenance check
     */
    async runMaintenanceCheck(): Promise<{
        bloatInfo: TableBloatInfo[];
        schedules: MaintenanceSchedule[];
        growthAlerts: GrowthAlert[];
    }> {
        logger.info('Starting maintenance check');

        const bloatInfo = await this.detectTableBloat();
        const schedules = await this.scheduleVacuum(bloatInfo);
        const growthAlerts = await this.monitorGrowth();

        logger.info('Maintenance check completed', {
            tablesWithBloat: bloatInfo.filter(i => i.shouldVacuum).length,
            scheduledOperations: schedules.length,
            growthAlerts: growthAlerts.length,
        });

        return {
            bloatInfo,
            schedules,
            growthAlerts,
        };
    }
}
