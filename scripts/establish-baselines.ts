#!/usr/bin/env ts-node

/**
 * Establish Performance Baselines
 *
 * Establishes performance baselines for critical queries.
 * Run this script after optimizations or during low-traffic periods.
 *
 * Usage:
 *   npm run baseline:establish
 *   npm run baseline:establish -- --query=user_products_active
 */

import { getConnectionPoolManager } from '@/lib/services/connection-pool-manager';
import { PerformanceBaselineManager } from '@/lib/services/performance-baseline-manager';


interface BaselineOptions {
    query?: string;
}

async function parseArgs(): Promise<BaselineOptions> {
    const args = process.argv.slice(2);
    const options: BaselineOptions = {};

    for (const arg of args) {
        if (arg.startsWith('--query=')) {
            options.query = arg.split('=')[1];
        }
    }

    return options;
}

async function establishAllBaselines(): Promise<void> {
    const pool = getConnectionPoolManager().getPool();
    const manager = new PerformanceBaselineManager(pool);

    console.log('🎯 Establishing baselines for all critical queries...');
    console.log('This may take several minutes...\n');

    try {
        const baselines = await manager.establishCriticalBaselines();

        console.log(`✅ Successfully established ${baselines.length} baselines:\n`);

        for (const baseline of baselines) {
            console.log(`   ${baseline.queryFingerprint}:`);
            console.log(`      p50: ${baseline.p50.toFixed(2)}ms`);
            console.log(`      p95: ${baseline.p95.toFixed(2)}ms`);
            console.log(`      p99: ${baseline.p99.toFixed(2)}ms`);
            console.log(`      Established: ${baseline.establishedAt.toISOString()}\n`);
        }

        console.log('✅ All baselines established successfully');
    } catch (error) {
        console.error('❌ Failed to establish baselines:', error);
        process.exit(1);
    }
}

async function establishSingleBaseline(queryFingerprint: string): Promise<void> {
    const pool = getConnectionPoolManager().getPool();
    const manager = new PerformanceBaselineManager(pool);

    console.log(`🎯 Establishing baseline for: ${queryFingerprint}...`);

    // Get existing baseline to retrieve query details
    const existing = await manager.getBaseline(queryFingerprint);

    if (!existing) {
        console.error(`❌ No baseline configuration found for: ${queryFingerprint}`);
        console.log('\nAvailable baselines:');
        const all = await manager.getAllBaselines();
        for (const b of all) {
            console.log(`   - ${b.queryFingerprint}`);
        }
        process.exit(1);
    }

    try {
        // Re-establish the baseline
        const baselines = await manager.establishCriticalBaselines();
        const baseline = baselines.find(b => b.queryFingerprint === queryFingerprint);

        if (!baseline) {
            console.error(`❌ Failed to establish baseline for: ${queryFingerprint}`);
            process.exit(1);
        }

        console.log(`\n✅ Baseline established:`);
        console.log(`   p50: ${baseline.p50.toFixed(2)}ms`);
        console.log(`   p95: ${baseline.p95.toFixed(2)}ms`);
        console.log(`   p99: ${baseline.p99.toFixed(2)}ms`);
        console.log(`   Established: ${baseline.establishedAt.toISOString()}`);
    } catch (error) {
        console.error('❌ Failed to establish baseline:', error);
        process.exit(1);
    }
}

async function listBaselines(): Promise<void> {
    const pool = getConnectionPoolManager().getPool();
    const manager = new PerformanceBaselineManager(pool);

    console.log('📊 Current Performance Baselines:\n');

    try {
        const baselines = await manager.getAllBaselines();

        if (baselines.length === 0) {
            console.log('No baselines found. Run with no arguments to establish baselines.');
            return;
        }

        for (const baseline of baselines) {
            const critical = baseline.isCritical ? '🔴 CRITICAL' : '⚪ Normal';
            console.log(`${critical} ${baseline.queryName}`);
            console.log(`   Fingerprint: ${baseline.queryFingerprint}`);
            console.log(`   p50: ${baseline.p50.toFixed(2)}ms`);
            console.log(`   p95: ${baseline.p95.toFixed(2)}ms`);
            console.log(`   p99: ${baseline.p99.toFixed(2)}ms`);
            console.log(`   Established: ${baseline.establishedAt.toISOString()}\n`);
        }
    } catch (error) {
        console.error('❌ Failed to list baselines:', error);
        process.exit(1);
    }
}

async function main(): Promise<void> {
    const options = await parseArgs();

    console.log('🚀 Performance Baseline Manager');
    console.log('='.repeat(50) + '\n');

    if (options.query) {
        await establishSingleBaseline(options.query);
    } else {
        // Check if baselines exist
        const pool = getConnectionPoolManager().getPool();
        const manager = new PerformanceBaselineManager(pool);
        const existing = await manager.getAllBaselines();

        if (existing.length > 0) {
            console.log('⚠️  Baselines already exist. This will update them.\n');
            await listBaselines();
            console.log('\nProceed with re-establishing baselines? (Ctrl+C to cancel)');
            await new Promise(resolve => setTimeout(resolve, 3000));
        }

        await establishAllBaselines();
    }

    process.exit(0);
}

// Run the script
main().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
});
