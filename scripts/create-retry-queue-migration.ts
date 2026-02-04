#!/usr/bin/env tsx

/**
 * Create Price Update Retry Queue Migration
 * 
 * This script creates the database migration for the PriceUpdateRetryQueue table.
 * Run this script to apply the schema changes needed for automatic retry functionality.
 * 
 * Usage:
 *   npx tsx scripts/create-retry-queue-migration.ts
 */

import { execSync } from 'child_process';

console.log('Creating Prisma migration for PriceUpdateRetryQueue...');

try {
    // Create migration
    execSync('npx prisma migrate dev --name add_price_update_retry_queue', {
        stdio: 'inherit',
    });

    console.log('\n✅ Migration created successfully!');
    console.log('\nThe PriceUpdateRetryQueue table has been added to the database.');
    console.log('This table will store failed price updates for automatic retry.');
} catch (error) {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
}
