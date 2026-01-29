/**
 * Collect Database Statistics Script
 * 
 * Collects and stores database statistics for historical tracking.
 * Should be run daily via cron job (recommended: 3 AM UTC).
 * 
 * Usage:
 *   ts-node scripts/collect-statistics.ts
 *   node scripts/collect-statistics.js
 */

import { Pool } from 'pg';
import { StatisticsCollector } from '@/lib/services/statistics-collector';
import { logger } from '@/lib/logger';

async function main() {
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
    });

    try {
        logger.info('Starting database statistics collection');

        const collector = new StatisticsCollector(pool);

        // Collect all statistics
        const stats = await collector.collectAllStatistics();

        logger.info('Statistics collection completed', {
            tables: stats.tables.length,
            indexes: stats.indexes.length,
            totalTableSize: stats.tables.reduce((sum, t) => sum + t.sizeBytes, 0),
            totalIndexSize: stats.indexes.reduce((sum, i) => sum + i.sizeBytes, 0),
        });

        // Cleanup old statistics
        const cleanup = await collector.cleanupOldStatistics();

        logger.info('Statistics cleanup completed', {
            tablesDeleted: cleanup.tablesDeleted,
            indexesDeleted: cleanup.indexesDeleted,
        });

        // Show growth trends
        const trends = await collector.getGrowthTrends(7);
        const fastGrowing = trends.filter(t => t.growthPercent > 0.1); // > 10% growth

        if (fastGrowing.length > 0) {
            logger.warn('Fast-growing tables detected', {
                count: fastGrowing.length,
                tables: fastGrowing.map(t => ({
                    name: t.tableName,
                    growth: `${(t.growthPercent * 100).toFixed(2)}%`,
                })),
            });
        }

        logger.info('Statistics collection script completed successfully');
    } catch (error) {
        logger.error('Statistics collection script failed', {
            error: error instanceof Error ? error.message : 'Unknown error',
            stack: error instanceof Error ? error.stack : undefined,
        });
        process.exit(1);
    } finally {
        await pool.end();
    }
}

main();
