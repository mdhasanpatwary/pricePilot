#!/usr/bin/env ts-node
/**
 * Refresh Materialized Views Script
 *
 * Refreshes all materialized views used for analytics and reporting.
 * Should be run every 15 minutes via cron job.
 *
 * Requirements: 5.6
 *
 * Usage:
 *   ts-node scripts/refresh-materialized-views.ts
 */

import { PrismaClient } from '@prisma/client';
import { MaterializedViewManager } from '@/lib/services/materialized-view-manager';

async function main() {
    const prisma = new PrismaClient();
    const viewManager = new MaterializedViewManager(prisma);

    try {
        console.log('Refreshing materialized views...');
        const startTime = Date.now();

        await viewManager.refreshDailyPriceComparisonView();

        const duration = Date.now() - startTime;
        console.log(`✓ Materialized views refreshed in ${duration}ms`);

        // Get view statistics
        const stats = await viewManager.getViewStats('daily_price_comparison_summary');

        console.log('\nView Statistics:');
        console.log('─'.repeat(80));

        if (stats) {
            console.log(`${stats.name}:`);
            console.log(`  Rows: ${stats.rowCount}`);
            console.log(`  Size: ${(stats.sizeBytes / 1024 / 1024).toFixed(2)} MB`);
            console.log(`  Last Refresh: ${stats.lastRefreshed.toISOString()}`); // corrected property name
            console.log('');
        }

    } catch (error) {
        console.error('Error refreshing materialized views:', error);
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
}

main();
