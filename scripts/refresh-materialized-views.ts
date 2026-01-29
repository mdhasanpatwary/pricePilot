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
    const viewManager = MaterializedViewManager.getInstance(prisma);

    try {
        console.log('Refreshing materialized views...');
        const startTime = Date.now();

        await viewManager.refreshAllViews();

        const duration = Date.now() - startTime;
        console.log(`✓ All materialized views refreshed in ${duration}ms`);

        // Get view statistics
        const stats = await viewManager.getViewStats();

        console.log('\nView Statistics:');
        console.log('─'.repeat(80));
        stats.forEach(stat => {
            console.log(`${stat.viewName}:`);
            console.log(`  Rows: ${stat.rowCount}`);
            console.log(`  Size: ${(stat.sizeBytes / 1024 / 1024).toFixed(2)} MB`);
            console.log(`  Last Refresh: ${stat.lastRefresh.toISOString()}`);
            console.log('');
        });

    } catch (error) {
        console.error('Error refreshing materialized views:', error);
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
}

main();
