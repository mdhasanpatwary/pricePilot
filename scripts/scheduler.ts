#!/usr/bin/env ts-node
/**
 * Database Optimization Job Scheduler
 *
 * Manages all scheduled maintenance, archival, and optimization jobs.
 * Uses node-cron for scheduling.
 *
 * Requirements: 6.4, 8.1, 8.2
 *
 * Usage:
 *   ts-node scripts/scheduler.ts
 *
 * Or run as a background service:
 *   pm2 start scripts/scheduler.ts --name "db-scheduler"
 */

import cron from 'node-cron';
import { PrismaClient } from '@prisma/client';
import { getQueryAnalyzer } from '@/lib/services/query-analyzer';
import { ArchiveManager } from '@/lib/services/archive-manager';
import { MaterializedViewManager } from '@/lib/services/materialized-view-manager';
import { MaintenanceScheduler } from '@/lib/services/maintenance-scheduler';

import { cacheWarmingService } from '@/lib/services/cache-warming';
import { cacheMonitoringService } from '@/lib/services/cache-monitoring';
import { cacheAlertingService } from '@/lib/services/cache-alerting';
import { getConnectionPoolManager } from '@/lib/services/connection-pool-manager';

// Bot Protection Jobs
import { runScheduledScraping } from '@/lib/services/bot-protection/scraping-scheduler';
import { runHourlyAggregation } from '@/lib/services/bot-protection/metric-aggregation-job';
import { runLogRetentionCleanup } from '@/lib/services/bot-protection/log-retention-job';
import { runAlertMonitoring } from '@/lib/services/bot-protection/alert-monitoring-job';
import { runCookieCleanup } from '@/lib/services/bot-protection/cookie-cleanup-job';

const prisma = new PrismaClient();
const pool = getConnectionPoolManager().getPool();

// Job execution tracking
const jobStats = {
    lastRun: {} as Record<string, Date>,
    successCount: {} as Record<string, number>,
    failureCount: {} as Record<string, number>,
};

/**
 * Execute a job with error handling and logging
 */
async function executeJob(
    jobName: string,
    jobFn: () => Promise<void>
): Promise<void> {
    console.log(`[${new Date().toISOString()}] Starting job: ${jobName}`);
    const startTime = Date.now();

    try {
        await jobFn();
        const duration = Date.now() - startTime;

        jobStats.lastRun[jobName] = new Date();
        jobStats.successCount[jobName] = (jobStats.successCount[jobName] || 0) + 1;

        console.log(`[${new Date().toISOString()}] ✓ Job completed: ${jobName} (${duration}ms)`);
    } catch (error) {
        const duration = Date.now() - startTime;

        jobStats.failureCount[jobName] = (jobStats.failureCount[jobName] || 0) + 1;

        console.error(`[${new Date().toISOString()}] ✗ Job failed: ${jobName} (${duration}ms)`, error);

        // Log error to console (database logging disabled due to schema mismatch)
        console.error('Job error detail:', {
            jobName,
            error: error instanceof Error ? error.message : String(error),
            duration,
        });
    }
}

/**
 * Daily ANALYZE job - Updates query planner statistics
 * Runs at 3 AM UTC
 */
cron.schedule('0 3 * * *', async () => {
    await executeJob('daily-analyze', async () => {
        const maintenance = new MaintenanceScheduler(pool);
        await maintenance.runAnalyze();
    });
}, {
    timezone: 'UTC'
});

/**
 * Weekly VACUUM job - Reclaims storage and prevents bloat
 * Runs on Sunday at 2 AM UTC
 */
cron.schedule('0 2 * * 0', async () => {
    await executeJob('weekly-vacuum', async () => {
        const maintenance = new MaintenanceScheduler(pool);
        await maintenance.runVacuum();
    });
}, {
    timezone: 'UTC'
});

/**
 * Daily archival job - Moves old data to archive tables
 * Runs at 2:30 AM UTC
 */
cron.schedule('30 2 * * *', async () => {
    await executeJob('daily-archival', async () => {
        const archiveManager = new ArchiveManager(prisma);

        // Archive price history (90+ days)
        await archiveManager.archivePriceHistory(90);

        // Archive audit logs (365+ days)
        await archiveManager.archiveAuditLogs(365);
    });
}, {
    timezone: 'UTC'
});

/**
 * Materialized view refresh - Updates aggregated data
 * Runs every 15 minutes
 */
cron.schedule('*/15 * * * *', async () => {
    await executeJob('refresh-materialized-views', async () => {
        const viewManager = new MaterializedViewManager(prisma);
        await viewManager.refreshDailyPriceComparisonView();
    });
}, {
    timezone: 'UTC'
});

/**
 * Query metrics aggregation - Aggregates slow query data
 * Runs daily at 3:30 AM UTC
 */
cron.schedule('30 3 * * *', async () => {
    await executeJob('aggregate-query-metrics', async () => {
        const queryAnalyzer = getQueryAnalyzer(prisma);

        // Aggregate yesterday's metrics
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        yesterday.setUTCHours(0, 0, 0, 0);

        await queryAnalyzer.aggregateDailyMetrics(yesterday);
    });
}, {
    timezone: 'UTC'
});

/**
 * Cache warming - Pre-loads frequently accessed data
 * Runs daily at 2 AM UTC (off-peak hours)
 * Requirement 3.3: Daily warming of top 100 products per tenant
 */
cron.schedule('0 2 * * *', async () => {
    await executeJob('warm-cache', async () => {
        // Use CacheWarmingService for comprehensive cache warming
        await cacheWarmingService.scheduledWarming();
    });
}, {
    timezone: 'UTC'
});

/**
 * Statistics collection - Tracks database growth and health
 * Runs daily at 4 AM UTC
 */
cron.schedule('0 4 * * *', async () => {
    await executeJob('collect-statistics', async () => {
        const maintenance = new MaintenanceScheduler(pool);
        await maintenance.collectStatistics();
    });
}, {
    timezone: 'UTC'
});

/**
 * Cache statistics logging - Logs cache performance metrics
 * Runs every 5 minutes
 * Requirement 4.6: Periodic cache statistics logging
 */
cron.schedule('*/5 * * * *', async () => {
    await executeJob('log-cache-stats', async () => {
        await cacheMonitoringService.logStats();
    });
}, {
    timezone: 'UTC'
});

/**
 * Cache health alerting - Checks cache health and sends alerts
 * Runs every 5 minutes
 * Requirements: 4.5, 10.4, 10.6
 */
cron.schedule('*/5 * * * *', async () => {
    await executeJob('check-cache-alerts', async () => {
        await cacheAlertingService.checkAndAlert();
    });
}, {
    timezone: 'UTC'
});

/**
 * Health check endpoint - Returns scheduler status
 */
function getSchedulerStatus() {
    return {
        status: 'running',
        uptime: process.uptime(),
        jobs: Object.keys(jobStats.lastRun).map(jobName => ({
            name: jobName,
            lastRun: jobStats.lastRun[jobName],
            successCount: jobStats.successCount[jobName] || 0,
            failureCount: jobStats.failureCount[jobName] || 0,
        })),
    };
}

/**
 * Bot Protection: Scheduled scraping - Scrapes all competitor products
 * Runs every hour
 * Requirements: 4.5
 */
cron.schedule('0 * * * *', async () => {
    await executeJob('scheduled-scraping', async () => {
        await runScheduledScraping();
    });
}, {
    timezone: 'UTC'
});

/**
 * Bot Protection: Metric aggregation - Aggregates scrape attempts into hourly metrics
 * Runs every hour at 5 minutes past
 * Requirements: 9.2
 */
cron.schedule('5 * * * *', async () => {
    await executeJob('metric-aggregation', async () => {
        await runHourlyAggregation();
    });
}, {
    timezone: 'UTC'
});

/**
 * Bot Protection: Log retention cleanup - Cleans up old logs and screenshots
 * Runs daily at 3 AM UTC
 * Requirements: 8.6
 */
cron.schedule('0 3 * * *', async () => {
    await executeJob('log-retention-cleanup', async () => {
        await runLogRetentionCleanup();
    });
}, {
    timezone: 'UTC'
});

/**
 * Bot Protection: Alert monitoring - Checks success rates and triggers alerts
 * Runs every 5 minutes
 * Requirements: 9.4, 12.1, 12.7
 */
cron.schedule('*/5 * * * *', async () => {
    await executeJob('alert-monitoring', async () => {
        await runAlertMonitoring();
    });
}, {
    timezone: 'UTC'
});

/**
 * Bot Protection: Cookie cleanup - Removes expired cookies and stale sessions
 * Runs every 6 hours
 * Requirements: 5.4
 */
cron.schedule('0 */6 * * *', async () => {
    await executeJob('cookie-cleanup', async () => {
        await runCookieCleanup();
    });
}, {
    timezone: 'UTC'
});

// Graceful shutdown
process.on('SIGTERM', async () => {
    console.log('[Scheduler] Received SIGTERM, shutting down gracefully...');
    await prisma.$disconnect();
    process.exit(0);
});

process.on('SIGINT', async () => {
    console.log('[Scheduler] Received SIGINT, shutting down gracefully...');
    await prisma.$disconnect();
    process.exit(0);
});

// Log startup
console.log('='.repeat(80));
console.log('Database Optimization Job Scheduler');
console.log('='.repeat(80));
console.log();
console.log('Scheduled Jobs:');
console.log('  - Daily ANALYZE: 3:00 AM UTC');
console.log('  - Weekly VACUUM: Sunday 2:00 AM UTC');
console.log('  - Daily Archival: 2:30 AM UTC');
console.log('  - Materialized Views: Every 15 minutes');
console.log('  - Query Metrics: 3:30 AM UTC');
console.log('  - Cache Warming: 2:00 AM UTC');
console.log('  - Statistics Collection: 4:00 AM UTC');
console.log('  - Cache Statistics Logging: Every 5 minutes');
console.log('  - Cache Health Alerting: Every 5 minutes');
console.log('  - Scheduled Scraping: Every hour');
console.log('  - Metric Aggregation: Every hour at :05');
console.log('  - Log Retention Cleanup: Daily at 3:00 AM UTC');
console.log('  - Alert Monitoring: Every 5 minutes');
console.log('  - Cookie Cleanup: Every 6 hours');
console.log();
console.log('Scheduler is running. Press Ctrl+C to stop.');
console.log('='.repeat(80));

// Keep the process alive
setInterval(() => {
    // Heartbeat log every hour
    const status = getSchedulerStatus();
    console.log(`[${new Date().toISOString()}] Scheduler heartbeat - Uptime: ${Math.floor(status.uptime / 60)} minutes`);
}, 3600000); // 1 hour
