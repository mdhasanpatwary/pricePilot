/**
 * Run Database Maintenance Check Script
 * 
 * Runs database maintenance checks including:
 * - Table bloat detection
 * - VACUUM scheduling
 * - Growth monitoring
 * 
 * Should be run daily via cron job (recommended: 3 AM UTC).
 * 
 * Usage:
 *   ts-node scripts/run-maintenance-check.ts
 *   node scripts/run-maintenance-check.js
 */

import { Pool } from 'pg';
import { MaintenanceScheduler } from '@/lib/services/maintenance-scheduler';
import { logger } from '@/lib/logger';
import { isMaintenanceWindow } from '@/lib/database/optimization-constants';

async function main() {
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
    });

    try {
        logger.info('Starting database maintenance check');

        const scheduler = new MaintenanceScheduler(pool);

        // Run maintenance check
        const results = await scheduler.runMaintenanceCheck();

        logger.info('Maintenance check completed', {
            tablesWithBloat: results.bloatInfo.filter(i => i.shouldVacuum).length,
            scheduledOperations: results.schedules.length,
            growthAlerts: results.growthAlerts.length,
        });

        // Execute scheduled VACUUM operations if in maintenance window
        if (isMaintenanceWindow() && results.schedules.length > 0) {
            logger.info('Executing scheduled VACUUM operations', {
                count: results.schedules.length,
            });

            for (const schedule of results.schedules) {
                try {
                    await scheduler.executeVacuum(schedule);
                } catch (error) {
                    logger.error('VACUUM operation failed', {
                        table: schedule.tableName,
                        operation: schedule.operation,
                        error: error instanceof Error ? error.message : 'Unknown error',
                    });
                    // Continue with other operations
                }
            }

            logger.info('VACUUM operations completed');
        } else if (results.schedules.length > 0) {
            logger.info('VACUUM operations scheduled for next maintenance window', {
                count: results.schedules.length,
                nextWindow: '2-4 AM UTC',
            });
        }

        // Log summary
        if (results.bloatInfo.length > 0) {
            const criticalBloat = results.bloatInfo.filter(
                i => i.bloatPercent >= 0.3
            );
            const warningBloat = results.bloatInfo.filter(
                i => i.bloatPercent >= 0.2 && i.bloatPercent < 0.3
            );

            logger.info('Bloat summary', {
                critical: criticalBloat.length,
                warning: warningBloat.length,
                total: results.bloatInfo.length,
            });
        }

        if (results.growthAlerts.length > 0) {
            logger.warn('Growth alerts summary', {
                count: results.growthAlerts.length,
                tables: results.growthAlerts.map(a => ({
                    name: a.tableName,
                    growth: `${(a.growthPercent * 100).toFixed(2)}%`,
                })),
            });
        }

        logger.info('Maintenance check script completed successfully');
    } catch (error) {
        logger.error('Maintenance check script failed', {
            error: error instanceof Error ? error.message : 'Unknown error',
            stack: error instanceof Error ? error.stack : undefined,
        });
        process.exit(1);
    } finally {
        await pool.end();
    }
}

main();
