#!/usr/bin/env tsx

/**
 * Verify Index Performance
 *
 * This script runs test queries to verify that the new indexes
 * are being used and improving query performance.
 *
 * Task: 8.2 Add database indexes
 * Requirements: 2.9.1
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();


interface TestResult {
    query: string;
    description: string;
    executionTime: number;
    usesIndex: boolean;
    indexName?: string;
    planningTime?: number;
    executionTimeFromPlan?: number;
}

async function testQuery(
    description: string,
    query: string,
    expectedIndex?: string
): Promise<TestResult> {
    console.log(`\n🔍 Testing: ${description}`);
    console.log(`Query: ${query.substring(0, 100)}...`);

    const startTime = Date.now();

    try {
        // Get query plan
        const explainQuery = `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ${query}`;
        const plan = await prisma.$queryRawUnsafe<any[]>(explainQuery);

        const endTime = Date.now();
        const executionTime = endTime - startTime;

        // Parse the plan
        const planData = plan[0]['QUERY PLAN'][0];
        const planText = JSON.stringify(planData, null, 2);

        // Check if index is used
        const usesIndex = planText.toLowerCase().includes('index scan') ||
            planText.toLowerCase().includes('index only scan');

        let indexName: string | undefined;
        if (expectedIndex) {
            const indexMatch = planText.match(new RegExp(expectedIndex, 'i'));
            indexName = indexMatch ? expectedIndex : undefined;
        }

        // Extract timing from plan
        const planningTime = planData['Planning Time'];
        const executionTimeFromPlan = planData['Execution Time'];

        const result: TestResult = {
            query: description,
            description,
            executionTime,
            usesIndex,
            indexName,
            planningTime,
            executionTimeFromPlan
        };

        // Display results
        console.log(`⏱️  Execution Time: ${executionTime}ms`);
        console.log(`📊 Planning Time: ${planningTime?.toFixed(2)}ms`);
        console.log(`⚡ Execution Time (from plan): ${executionTimeFromPlan?.toFixed(2)}ms`);
        console.log(`📇 Uses Index: ${usesIndex ? '✅ Yes' : '❌ No'}`);

        if (indexName) {
            console.log(`🎯 Index Used: ${indexName}`);
        } else if (expectedIndex) {
            console.log(`⚠️  Expected index "${expectedIndex}" not used`);
        }

        return result;

    } catch (error: any) {
        console.error(`❌ Error: ${error.message}`);
        throw error;
    }
}

async function runPerformanceTests() {
    console.log('\n' + '='.repeat(60));
    console.log('🚀 Performance Test Suite');
    console.log('='.repeat(60));

    const results: TestResult[] = [];

    try {
        // Test 1: Product tenant + site query
        results.push(await testQuery(
            'Product listing by tenant and site',
            `SELECT * FROM "Product" WHERE "tenantId" = (SELECT id FROM "Tenant" LIMIT 1) AND "siteId" = (SELECT id FROM "Site" LIMIT 1) LIMIT 10`,
            'idx_product_tenant_site'
        ));

        // Test 2: Product external ID lookup
        results.push(await testQuery(
            'Product lookup by external ID',
            `SELECT * FROM "Product" WHERE "externalId" IS NOT NULL LIMIT 10`,
            'idx_product_external_id'
        ));

        // Test 3: Recently updated products
        results.push(await testQuery(
            'Recently updated products',
            `SELECT * FROM "Product" ORDER BY "updatedAt" DESC LIMIT 10`,
            'idx_product_updated_at'
        ));

        // Test 4: Product matches by user product and status
        results.push(await testQuery(
            'Product matches by user product and status',
            `SELECT * FROM "ProductMatch" WHERE "userProductId" = (SELECT id FROM "Product" LIMIT 1) AND "status" = 'APPROVED'`,
            'idx_product_match_user_status'
        ));

        // Test 5: Product matches by confidence
        results.push(await testQuery(
            'High confidence product matches',
            `SELECT * FROM "ProductMatch" ORDER BY "confidenceScore" DESC LIMIT 10`,
            'idx_product_match_confidence'
        ));

        // Test 6: Price history for product
        results.push(await testQuery(
            'Price history for product',
            `SELECT * FROM "PriceHistory" WHERE "productId" = (SELECT id FROM "Product" LIMIT 1) ORDER BY "recordedAt" DESC LIMIT 10`,
            'idx_price_history_product_date'
        ));

        // Test 7: Sites by tenant and type
        results.push(await testQuery(
            'Sites by tenant and type',
            `SELECT * FROM "Site" WHERE "tenantId" = (SELECT id FROM "Tenant" LIMIT 1) AND "type" = 'USER'`,
            'idx_site_tenant_type'
        ));

        // Test 8: Currently syncing sites
        results.push(await testQuery(
            'Currently syncing sites',
            `SELECT * FROM "Site" WHERE "isSyncing" = true ORDER BY "syncStartedAt"`,
            'idx_site_syncing_started'
        ));

        // Test 9: Unread notifications
        results.push(await testQuery(
            'Unread notifications by tenant',
            `SELECT * FROM "Notification" WHERE "tenantId" = (SELECT id FROM "Tenant" LIMIT 1) AND "isRead" = false ORDER BY "createdAt" DESC LIMIT 10`,
            'idx_notification_tenant_read_created'
        ));

        // Test 10: Audit logs by tenant
        results.push(await testQuery(
            'Recent audit logs by tenant',
            `SELECT * FROM "TenantAuditLog" WHERE "tenantId" = (SELECT id FROM "Tenant" LIMIT 1) ORDER BY "createdAt" DESC LIMIT 10`,
            'idx_audit_tenant_created'
        ));

        // Test 11: Audit logs by user
        results.push(await testQuery(
            'Audit logs by user',
            `SELECT * FROM "TenantAuditLog" WHERE "userId" = (SELECT id FROM "User" LIMIT 1) ORDER BY "createdAt" DESC LIMIT 10`,
            'idx_audit_user_id'
        ));

        // Test 12: Audit logs by action
        results.push(await testQuery(
            'Audit logs by action type',
            `SELECT * FROM "TenantAuditLog" WHERE "action" = 'APPROVE_MATCH' ORDER BY "createdAt" DESC LIMIT 10`,
            'idx_audit_action'
        ));

    } catch (error) {
        console.error('\n❌ Test suite failed:', error);
    }

    // Display summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 Test Summary');
    console.log('='.repeat(60));

    const totalTests = results.length;
    const testsUsingIndex = results.filter(r => r.usesIndex).length;
    const avgExecutionTime = results.reduce((sum, r) => sum + r.executionTime, 0) / totalTests;
    const avgPlanningTime = results.reduce((sum, r) => sum + (r.planningTime || 0), 0) / totalTests;
    const avgExecutionTimeFromPlan = results.reduce((sum, r) => sum + (r.executionTimeFromPlan || 0), 0) / totalTests;

    console.log(`\nTotal Tests: ${totalTests}`);
    console.log(`Tests Using Index: ${testsUsingIndex} (${((testsUsingIndex / totalTests) * 100).toFixed(1)}%)`);
    console.log(`Average Execution Time: ${avgExecutionTime.toFixed(2)}ms`);
    console.log(`Average Planning Time: ${avgPlanningTime.toFixed(2)}ms`);
    console.log(`Average Execution Time (from plan): ${avgExecutionTimeFromPlan.toFixed(2)}ms`);

    console.log('\n📋 Detailed Results:');
    console.log('='.repeat(60));

    results.forEach((result, i) => {
        console.log(`\n${i + 1}. ${result.description}`);
        console.log(`   Execution: ${result.executionTime}ms`);
        console.log(`   Uses Index: ${result.usesIndex ? '✅' : '❌'}`);
        if (result.indexName) {
            console.log(`   Index: ${result.indexName}`);
        }
    });

    console.log('\n' + '='.repeat(60));

    // Performance recommendations
    console.log('\n💡 Performance Recommendations:');
    console.log('='.repeat(60));

    const slowQueries = results.filter(r => (r.executionTimeFromPlan || 0) > 100);
    if (slowQueries.length > 0) {
        console.log('\n⚠️  Slow Queries (>100ms):');
        slowQueries.forEach(q => {
            console.log(`  - ${q.description}: ${q.executionTimeFromPlan?.toFixed(2)}ms`);
        });
    }

    const queriesNotUsingIndex = results.filter(r => !r.usesIndex);
    if (queriesNotUsingIndex.length > 0) {
        console.log('\n⚠️  Queries Not Using Indexes:');
        queriesNotUsingIndex.forEach(q => {
            console.log(`  - ${q.description}`);
        });
    }

    if (slowQueries.length === 0 && queriesNotUsingIndex.length === 0) {
        console.log('\n✅ All queries are performing well and using indexes!');
    }

    console.log('\n');
}

async function checkDatabaseStats() {
    console.log('\n' + '='.repeat(60));
    console.log('📊 Database Statistics');
    console.log('='.repeat(60));

    try {
        // Table sizes
        interface TableSize {
            table_name: string;
            total_size: string;
            table_size: string;
            indexes_size: string;
        }

        const tableSizes = await prisma.$queryRaw<TableSize[]>`
      SELECT
        table_name,
        pg_size_pretty(pg_total_relation_size(quote_ident(table_name)::regclass)) as total_size,
        pg_size_pretty(pg_relation_size(quote_ident(table_name)::regclass)) as table_size,
        pg_size_pretty(pg_total_relation_size(quote_ident(table_name)::regclass) - pg_relation_size(quote_ident(table_name)::regclass)) as indexes_size
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_type = 'BASE TABLE'
      ORDER BY pg_total_relation_size(quote_ident(table_name)::regclass) DESC
      LIMIT 10
    `;

        console.log('\n📦 Largest Tables:');
        tableSizes.forEach((table, i) => {
            console.log(`${i + 1}. ${table.table_name}`);
            console.log(`   Total: ${table.total_size}, Table: ${table.table_size}, Indexes: ${table.indexes_size}`);
        });

        // Row counts
        interface RowCount {
            table_name: string;
            row_count: bigint;
        }

        const rowCounts = await prisma.$queryRaw<RowCount[]>`
      SELECT
        schemaname || '.' || relname as table_name,
        n_live_tup as row_count
      FROM pg_stat_user_tables
      WHERE schemaname = 'public'
      ORDER BY n_live_tup DESC
      LIMIT 10
    `;

        console.log('\n📊 Tables by Row Count:');
        rowCounts.forEach((table, i) => {
            console.log(`${i + 1}. ${table.table_name}: ${table.row_count.toLocaleString()} rows`);
        });

    } catch (error) {
        console.error('❌ Stats check failed:', error);
    }

    console.log('\n' + '='.repeat(60) + '\n');
}

async function main() {
    console.log('\n' + '='.repeat(60));
    console.log('🔍 Index Performance Verification');
    console.log('='.repeat(60) + '\n');

    try {
        await checkDatabaseStats();
        await runPerformanceTests();

        console.log('✅ Verification completed!\n');

    } catch (error) {
        console.error('\n❌ Verification failed:', error);
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
}

main();
