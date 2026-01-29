/**
 * Setup Materialized Views
 * 
 * Initializes materialized views and sets up refresh schedules.
 * Run this script after database migrations to create the views.
 * 
 * Usage:
 *   npx tsx scripts/setup-materialized-views.ts
 */

import { getMaterializedViewManager } from '@/lib/services/materialized-view-manager';

async function setupMaterializedViews() {
    console.log('[Setup] Initializing materialized views...');

    try {
        const viewManager = getMaterializedViewManager();

        // Initialize views and start refresh schedules
        await viewManager.initialize();

        console.log('[Setup] ✓ Materialized views initialized successfully');
        console.log('[Setup] ✓ Refresh schedule started (every 15 minutes)');

        // Get view statistics
        const stats = await viewManager.getViewStats('daily_price_comparison_summary');
        if (stats) {
            console.log('\n[Stats] View Statistics:');
            console.log(`  - Name: ${stats.name}`);
            console.log(`  - Row Count: ${stats.rowCount.toLocaleString()}`);
            console.log(`  - Size: ${(stats.sizeBytes / 1024 / 1024).toFixed(2)} MB`);
            console.log(`  - Last Refreshed: ${stats.lastRefreshed.toISOString()}`);
            console.log(`  - Next Refresh: ${stats.nextRefresh.toISOString()}`);
        }

        console.log('\n[Setup] Setup complete!');
        console.log('[Setup] The materialized view will refresh automatically every 15 minutes.');
        console.log('[Setup] You can query it using the MaterializedViewManager API.');

    } catch (error) {
        console.error('[Setup] Error setting up materialized views:', error);
        process.exit(1);
    }
}

// Run setup
setupMaterializedViews()
    .then(() => {
        console.log('\n[Setup] Exiting...');
        process.exit(0);
    })
    .catch((error) => {
        console.error('[Setup] Fatal error:', error);
        process.exit(1);
    });
