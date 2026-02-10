#!/usr/bin/env tsx
/**
 * Query Performance Measurement Tool
 *
 * Measures average execution time for each Prisma query in typical application flows.
 * Identifies the slowest queries and provides optimization recommendations.
 *
 * Usage:
 *   npm run measure-queries
 *   tsx scripts/measure-query-performance.ts
 */

import 'dotenv/config';
import { instrumentedPrisma } from '@/lib/instrumented-prisma';
import { getPerformanceTracker } from '@/lib/middleware/query-performance-tracker';

async function simulateTypicalWorkflow() {
    console.log('🚀 Starting query performance measurement...\n');
    console.log('Simulating typical application workflows...\n');

    // ============================================================================
    // WARMUP: Connection & Cold Start
    // ============================================================================
    console.log('🔥 Warming up database connection...');
    try {
        await instrumentedPrisma.tenant.count();
        console.log('   ✓ Connection established\n');
    } catch (e) {
        console.error('   ❌ Connection failed:', e);
        process.exit(1);
    }

    // Get a test tenant (findFirst is faster than findMany with take: 1)
    const tenant = await instrumentedPrisma.tenant.findFirst({
        orderBy: { createdAt: 'desc' }
    });

    if (!tenant) {
        console.error('❌ No tenant found. Please seed the database first.');
        process.exit(1);
    }
    const tenantId = tenant.id;
    console.log(`✅ Using tenant: ${tenant.companyName} (${tenantId})\n`);

    // ============================================================================
    // WORKFLOW 1: Dashboard Load
    // ============================================================================
    console.log('📊 Simulating Dashboard Load...');

    // Get user sites
    const userSites = await instrumentedPrisma.site.findMany({
        where: { tenantId, type: 'USER' },
    });

    // Get competitor sites
    const competitorSites = await instrumentedPrisma.site.findMany({
        where: { tenantId, type: 'COMPETITOR' },
    });

    // Get product counts
    const totalProducts = await instrumentedPrisma.product.count({
        where: { tenantId },
    });

    const userProducts = await instrumentedPrisma.product.count({
        where: { tenantId, siteId: { in: userSites.map(s => s.id) } },
    });

    const competitorProducts = await instrumentedPrisma.product.count({
        where: { tenantId, siteId: { in: competitorSites.map(s => s.id) } },
    });

    // Get match counts
    const totalMatches = await instrumentedPrisma.productMatch.count({
        where: { userProduct: { tenantId } },
    });

    console.log(`   ✓ Loaded ${userSites.length} user sites, ${competitorSites.length} competitors`);
    console.log(`   ✓ Loaded ${totalProducts} products (${userProducts} user, ${competitorProducts} competitor)`);
    console.log(`   ✓ Loaded ${totalMatches} matches\n`);

    // ============================================================================
    // WORKFLOW 2: Product Comparison Table
    // ============================================================================
    console.log('📋 Simulating Product Comparison Table Load...');

    // Get user products with matches (typical comparison view)
    const productsWithMatches = await instrumentedPrisma.product.findMany({
        where: {
            tenantId,
            siteId: { in: userSites.map(s => s.id) },
        },
        include: {
            Site: {
                select: {
                    id: true,
                    baseUrl: true,
                },
            },
            matchesAsUser: {
                include: {
                    competitorProduct: {
                        include: {
                            Site: {
                                select: {
                                    id: true,
                                    baseUrl: true,
                                },
                            },
                        },
                    },
                },
            },
        },
        take: 50, // Typical page size
    });

    console.log(`   ✓ Loaded ${productsWithMatches.length} products with matches\n`);

    // ============================================================================
    // WORKFLOW 3: Price History
    // ============================================================================
    console.log('📈 Simulating Price History Load...');

    if (productsWithMatches.length > 0) {
        const sampleProduct = productsWithMatches[0];

        const priceHistory = await instrumentedPrisma.priceHistory.findMany({
            where: { productId: sampleProduct.id },
            orderBy: { recordedAt: 'desc' },
            take: 30, // Last 30 days
        });

        console.log(`   ✓ Loaded ${priceHistory.length} price history records\n`);
    }

    // ============================================================================
    // WORKFLOW 4: Competitor Analysis
    // ============================================================================
    console.log('🔍 Simulating Competitor Analysis...');

    // Get all competitor products with matches
    const competitorProductsWithMatches = await instrumentedPrisma.product.findMany({
        where: {
            tenantId,
            siteId: { in: competitorSites.map(s => s.id) },
        },
        include: {
            Site: true,
            matchesAsCompetitor: {
                include: {
                    userProduct: true,
                },
            },
        },
        take: 100,
    });

    console.log(`   ✓ Loaded ${competitorProductsWithMatches.length} competitor products\n`);

    // ============================================================================
    // WORKFLOW 5: Pricing Rules
    // ============================================================================
    console.log('⚙️  Simulating Pricing Rules Load...');

    const pricingRules = await instrumentedPrisma.pricingRule.findMany({
        where: { tenantId },
    });

    console.log(`   ✓ Loaded ${pricingRules.length} pricing rules\n`);

    // ============================================================================
    // WORKFLOW 6: Audit Logs
    // ============================================================================
    console.log('📝 Simulating Audit Logs Load...');

    const auditLogs = await instrumentedPrisma.tenantAuditLog.findMany({
        where: { tenantId },
        orderBy: { createdAt: 'desc' },
        take: 50,
    });

    console.log(`   ✓ Loaded ${auditLogs.length} audit logs\n`);

    // ============================================================================
    // WORKFLOW 7: Complex Aggregations
    // ============================================================================
    console.log('🧮 Simulating Complex Aggregations...');

    // Average prices by site
    const avgPricesBySite = await instrumentedPrisma.product.groupBy({
        by: ['siteId'],
        where: { tenantId },
        _avg: {
            currentPrice: true,
        },
        _count: {
            id: true,
        },
    });

    console.log(`   ✓ Calculated average prices for ${avgPricesBySite.length} sites\n`);

    // ============================================================================
    // WORKFLOW 8: Search/Filter Operations
    // ============================================================================
    console.log('🔎 Simulating Search/Filter Operations...');

    // Search by name
    const searchResults = await instrumentedPrisma.product.findMany({
        where: {
            tenantId,
            title: {
                contains: 'Samsung',
                mode: 'insensitive',
            },
        },
        take: 20,
    });

    // Filter by price range
    const priceFilterResults = await instrumentedPrisma.product.findMany({
        where: {
            tenantId,
            currentPrice: {
                gte: 100,
                lte: 500,
            },
        },
        take: 20,
    });

    console.log(`   ✓ Search found ${searchResults.length} results`);
    console.log(`   ✓ Price filter found ${priceFilterResults.length} results\n`);

    // ============================================================================
    // WORKFLOW 9: Bulk Operations
    // ============================================================================
    console.log('📦 Simulating Bulk Operations...');

    // Get multiple products by IDs
    const productIds = productsWithMatches.slice(0, 10).map(p => p.id);
    const bulkProducts = await instrumentedPrisma.product.findMany({
        where: {
            id: { in: productIds },
        },
    });

    console.log(`   ✓ Bulk loaded ${bulkProducts.length} products\n`);

    // ============================================================================
    // WORKFLOW 10: Nested Relations
    // ============================================================================
    console.log('🔗 Simulating Nested Relations Load...');

    const sitesWithProducts = await instrumentedPrisma.site.findMany({
        where: { tenantId },
        include: {
            Product: {
                take: 10,
            },
        },
    });

    console.log(`   ✓ Loaded ${sitesWithProducts.length} sites with nested relations\n`);
}

async function main() {
    try {
        // Run the simulation
        await simulateTypicalWorkflow();

        console.log('✅ Workflow simulation complete!\n');
        console.log('Generating performance report...\n');

        // Get and print the performance report
        const tracker = getPerformanceTracker();
        tracker.printReport();

        // Export detailed JSON report
        const jsonReport = tracker.exportReport();
        const fs = await import('fs');
        const path = await import('path');

        const reportPath = path.join(process.cwd(), 'query-performance-report.json');
        fs.writeFileSync(reportPath, jsonReport);

        console.log(`📄 Detailed report saved to: ${reportPath}\n`);

        // Identify the slowest query
        const report = tracker.getReport();
        if (report.slowestQueries.length > 0) {
            const slowest = report.slowestQueries[0];
            console.log('🐌 SLOWEST QUERY IDENTIFIED:');
            console.log(`   Model: ${slowest.model}`);
            console.log(`   Operation: ${slowest.operation}`);
            console.log(`   Average Time: ${slowest.avgTime.toFixed(2)}ms`);
            console.log(`   Max Time: ${slowest.maxTime.toFixed(2)}ms`);
            console.log(`   Execution Count: ${slowest.count}`);
            console.log(`   Total Time: ${slowest.totalTime.toFixed(2)}ms\n`);

            // Provide optimization suggestions
            console.log('💡 OPTIMIZATION SUGGESTIONS:');
            if (slowest.avgTime > 1000) {
                console.log('   ⚠️  This query is VERY SLOW (>1s average)');
                console.log('   → Check if proper indexes exist');
                console.log('   → Consider adding database indexes on filtered columns');
                console.log('   → Review the query for N+1 problems');
                console.log('   → Consider caching if data doesn\'t change frequently');
            } else if (slowest.avgTime > 500) {
                console.log('   ⚠️  This query is slow (>500ms average)');
                console.log('   → Review query complexity and relations');
                console.log('   → Consider pagination or limiting results');
                console.log('   → Check if SELECT fields can be reduced');
            } else if (slowest.avgTime > 100) {
                console.log('   ℹ️  This query is acceptable but could be optimized');
                console.log('   → Monitor as data grows');
                console.log('   → Consider adding indexes if execution count is high');
            } else {
                console.log('   ✅ Query performance is good!');
            }
            console.log('');
        }

    } catch (error) {
        console.error('❌ Error during performance measurement:', error);
        process.exit(1);
    } finally {
        await instrumentedPrisma.$disconnect();
    }
}

main();
