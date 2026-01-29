/**
 * Run Archival Script
 * 
 * Executes scheduled archival of price history and audit logs.
 * Should be run during maintenance windows (2-4 AM UTC).
 * 
 * Usage:
 *   npm run archival
 *   or
 *   node scripts/run-archival.js
 * 
 * Cron schedule (daily at 3 AM UTC):
 *   0 3 * * * cd /path/to/app && npm run archival
 */

import { PrismaClient } from '@prisma/client';
import { ArchiveManager } from '@/lib/services/archive-manager';
import { logger } from '@/lib/logger';

const prisma = new PrismaClient();
const archiveManager = new ArchiveManager(prisma);

async function main() {
    try {
        logger.info('Starting scheduled archival');

        // Check if we're in maintenance window
        if (!archiveManager.isMaintenanceWindow()) {
            const currentHour = new Date().getUTCHours();
            logger.warn('Archival attempted outside maintenance window', {
                currentHour,
                maintenanceWindow: '2-4 AM UTC',
            });
            console.error('ERROR: Archival can only run during maintenance window (2-4 AM UTC)');
            console.error(`Current UTC hour: ${currentHour}`);
            process.exit(1);
        }

        // Run archival
        const results = await archiveManager.runScheduledArchival();

        // Log results
        logger.info('Scheduled archival completed successfully', {
            priceHistory: results.priceHistory,
            auditLogs: results.auditLogs,
        });

        console.log('✓ Archival completed successfully');
        console.log('\nPrice History:');
        console.log(`  - Records archived: ${results.priceHistory.recordsArchived}`);
        console.log(`  - Records deleted: ${results.priceHistory.recordsDeleted}`);
        console.log(`  - Duration: ${results.priceHistory.durationMs}ms`);
        console.log(`  - Space freed: ${(results.priceHistory.spaceFreedBytes / 1024 / 1024).toFixed(2)} MB`);

        console.log('\nAudit Logs:');
        console.log(`  - Records archived: ${results.auditLogs.recordsArchived}`);
        console.log(`  - Records deleted: ${results.auditLogs.recordsDeleted}`);
        console.log(`  - Duration: ${results.auditLogs.durationMs}ms`);
        console.log(`  - Space freed: ${(results.auditLogs.spaceFreedBytes / 1024 / 1024).toFixed(2)} MB`);

        // Get updated stats
        const stats = await archiveManager.getArchiveStats();
        console.log('\nArchive Statistics:');
        console.log(`  - Price history records: ${stats.priceHistoryArchived}`);
        console.log(`  - Audit log records: ${stats.auditLogsArchived}`);
        console.log(`  - Total archive size: ${(stats.totalArchiveSizeBytes / 1024 / 1024).toFixed(2)} MB`);
        console.log(`  - Oldest archived record: ${stats.oldestArchivedRecord?.toISOString() || 'N/A'}`);

        await prisma.$disconnect();
        process.exit(0);
    } catch (error) {
        logger.error('Scheduled archival failed', { error });
        console.error('✗ Archival failed:', error);
        await prisma.$disconnect();
        process.exit(1);
    }
}

main();
