/**
 * Test Data Cleanup Service
 * 
 * This script tests the data cleanup functionality by running all cleanup jobs
 * and reporting the results.
 * 
 * Usage: npx tsx scripts/test-data-cleanup.ts
 */

import { DataCleanupService } from '@/lib/services/data-cleanup';

async function main() {
    console.log('='.repeat(80));
    console.log('DATA CLEANUP TEST');
    console.log('='.repeat(80));
    console.log();

    console.log('Running all cleanup jobs...');
    console.log();

    const startTime = Date.now();

    const results = await DataCleanupService.runAllCleanupJobs();

    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);

    console.log('='.repeat(80));
    console.log('CLEANUP RESULTS');
    console.log('='.repeat(80));
    console.log();

    console.log('Records Deleted:');
    console.log(`  Price History:       ${results.priceHistory.toLocaleString()}`);
    console.log(`  Audit Logs:          ${results.auditLogs.toLocaleString()}`);
    console.log(`  Notifications:       ${results.notifications.toLocaleString()}`);
    console.log(`  Sync Logs:           ${results.syncLogs.toLocaleString()}`);
    console.log(`  Price Update Logs:   ${results.priceUpdateLogs.toLocaleString()}`);
    console.log(`  Scraping Metrics:    ${results.scrapingMetrics.toLocaleString()}`);
    console.log(`  Bulk Snapshots:      ${results.bulkSnapshots.toLocaleString()}`);
    console.log(`  Expired Sessions:    ${results.sessions.toLocaleString()}`);
    console.log();

    const totalDeleted =
        results.priceHistory +
        results.auditLogs +
        results.notifications +
        results.syncLogs +
        results.priceUpdateLogs +
        results.scrapingMetrics +
        results.bulkSnapshots +
        results.sessions;

    console.log(`Total Records Deleted: ${totalDeleted.toLocaleString()}`);
    console.log(`Execution Time: ${duration}s`);
    console.log();

    if (results.errors.length > 0) {
        console.log('='.repeat(80));
        console.log('ERRORS');
        console.log('='.repeat(80));
        console.log();
        results.errors.forEach((error, index) => {
            console.log(`${index + 1}. ${error}`);
        });
        console.log();
    }

    console.log('='.repeat(80));
    console.log('RETENTION POLICIES');
    console.log('='.repeat(80));
    console.log();
    console.log('Data Type                 | Retention Period');
    console.log('-'.repeat(80));
    console.log('Price History             | 90 days (hot data)');
    console.log('Audit Logs (Standard)     | 2 years');
    console.log('Audit Logs (Critical)     | 5 years');
    console.log('Notifications (Read)      | 90 days');
    console.log('Notifications (Unread)    | 180 days');
    console.log('Notifications (Critical)  | 365 days');
    console.log('Sync Logs (Success)       | 30 days');
    console.log('Sync Logs (Error)         | 90 days');
    console.log('Price Update Logs (OK)    | 180 days');
    console.log('Price Update Logs (Fail)  | 365 days');
    console.log('Scraping Metrics          | 7 days');
    console.log('Bulk Snapshots            | 90 days');
    console.log('Bulk Snapshots (Rolled)   | 180 days');
    console.log('Expired Sessions          | 7 days past expiration');
    console.log();

    console.log('='.repeat(80));
    console.log('CRON SCHEDULE');
    console.log('='.repeat(80));
    console.log();
    console.log('Job                       | Schedule');
    console.log('-'.repeat(80));
    console.log('Notifications             | Daily at 1:00 AM UTC');
    console.log('Sync Logs                 | Daily at 1:30 AM UTC');
    console.log('Price History             | Daily at 2:00 AM UTC');
    console.log('Sessions                  | Daily at 2:00 AM UTC');
    console.log('Price Update Logs         | Daily at 2:30 AM UTC');
    console.log('Audit Logs                | Monthly on 1st at 3:00 AM UTC');
    console.log('Scraping Metrics          | Daily at 4:00 AM UTC');
    console.log('Bulk Snapshots            | Weekly on Sundays at 4:00 AM UTC');
    console.log();

    console.log('='.repeat(80));
    console.log('TEST COMPLETE');
    console.log('='.repeat(80));
    console.log();

    if (results.errors.length > 0) {
        console.log('⚠️  Some cleanup jobs encountered errors. Check logs for details.');
        process.exit(1);
    } else {
        console.log('✅ All cleanup jobs completed successfully!');
        process.exit(0);
    }
}

main().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
});
