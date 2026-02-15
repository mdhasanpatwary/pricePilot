/**
 * Performance Optimization Verification Script
 * 
 * Verifies that all performance optimizations are correctly implemented.
 */

import { prisma } from '../lib/prisma';
import { scrapeLogger } from '../lib/services/scrape-logger';

async function verifyOptimizations() {
    console.log('🔍 Verifying Performance Optimizations...\n');

    const results = {
        passed: 0,
        failed: 0,
        warnings: 0,
    };

    // 1. Verify scrape logger is working
    console.log('1. Testing Scrape Logger...');
    try {
        const stats = scrapeLogger.getStats();
        console.log(`   ✅ Scrape logger initialized (buffer: ${stats.bufferSize})`);
        results.passed++;
    } catch (error) {
        console.log(`   ❌ Scrape logger error: ${error}`);
        results.failed++;
    }

    // 2. Verify rate limit metrics table exists
    console.log('\n2. Checking Rate Limit Metrics...');
    try {
        const count = await prisma.rateLimitMetric.count();
        console.log(`   ✅ RateLimitMetric table accessible (${count} records)`);
        results.passed++;
    } catch (error) {
        console.log(`   ❌ RateLimitMetric table error: ${error}`);
        results.failed++;
    }

    // 3. Verify SyncLog table exists
    console.log('\n3. Checking SyncLog Table...');
    try {
        const count = await prisma.syncLog.count();
        console.log(`   ✅ SyncLog table accessible (${count} records)`);
        results.passed++;
    } catch (error) {
        console.log(`   ❌ SyncLog table error: ${error}`);
        results.failed++;
    }

    // 4. Check for getCachedTenant usage
    console.log('\n4. Verifying Cached Tenant Usage...');
    const fs = require('fs');
    const path = require('path');

    const apiDir = path.join(process.cwd(), 'app/api/v1');
    let directTenantQueries = 0;

    function scanDirectory(dir: string) {
        const files = fs.readdirSync(dir);

        for (const file of files) {
            const filePath = path.join(dir, file);
            const stat = fs.statSync(filePath);

            if (stat.isDirectory()) {
                scanDirectory(filePath);
            } else if (file.endsWith('.ts')) {
                const content = fs.readFileSync(filePath, 'utf-8');
                if (content.includes('prisma.tenant.findUnique') && !filePath.includes('admin')) {
                    directTenantQueries++;
                    console.log(`   ⚠️  Direct tenant query found: ${filePath}`);
                }
            }
        }
    }

    try {
        scanDirectory(apiDir);
        if (directTenantQueries === 0) {
            console.log('   ✅ No direct tenant queries found (all using cache)');
            results.passed++;
        } else {
            console.log(`   ⚠️  Found ${directTenantQueries} direct tenant queries`);
            results.warnings++;
        }
    } catch (error) {
        console.log(`   ❌ Error scanning files: ${error}`);
        results.failed++;
    }

    // 5. Verify navigation strategy changes
    console.log('\n5. Checking Navigation Strategy...');
    try {
        const scraperPath = path.join(process.cwd(), 'lib/services/scraper.ts');
        const scraperContent = fs.readFileSync(scraperPath, 'utf-8');

        const networkIdleCount = (scraperContent.match(/waitUntil.*networkidle/g) || []).length;
        const domContentLoadedCount = (scraperContent.match(/waitUntil.*domcontentloaded/g) || []).length;

        if (networkIdleCount === 0 && domContentLoadedCount > 0) {
            console.log(`   ✅ Navigation strategy optimized (${domContentLoadedCount} instances)`);
            results.passed++;
        } else {
            console.log(`   ⚠️  Found ${networkIdleCount} networkidle instances`);
            results.warnings++;
        }
    } catch (error) {
        console.log(`   ❌ Error checking scraper: ${error}`);
        results.failed++;
    }

    // Summary
    console.log('\n' + '='.repeat(50));
    console.log('📊 Verification Summary:');
    console.log(`   ✅ Passed: ${results.passed}`);
    console.log(`   ⚠️  Warnings: ${results.warnings}`);
    console.log(`   ❌ Failed: ${results.failed}`);
    console.log('='.repeat(50));

    if (results.failed === 0) {
        console.log('\n🎉 All critical optimizations verified!');
        return 0;
    } else {
        console.log('\n⚠️  Some optimizations need attention.');
        return 1;
    }
}

// Run verification
verifyOptimizations()
    .then((exitCode) => {
        process.exit(exitCode);
    })
    .catch((error) => {
        console.error('❌ Verification failed:', error);
        process.exit(1);
    });
