#!/usr/bin/env ts-node

/**
 * Run Performance Tests
 *
 * Executes comprehensive performance tests including:
 * - Multi-tenant workload simulation
 * - Concurrent connection testing
 * - Query response time measurement
 * - Performance baseline comparison
 *
 * Usage:
 *   npm run performance:test
 *   npm run performance:test -- --test=concurrent
 *   npm run performance:test -- --duration=120
 */

import { getConnectionPoolManager } from '@/lib/services/connection-pool-manager';
import { PerformanceTester } from '@/lib/services/performance-tester';
import { PerformanceBaselineManager } from '@/lib/services/performance-baseline-manager';


interface TestOptions {
    test?: string;
    duration?: number;
    connections?: number;
    tenants?: number;
}

async function parseArgs(): Promise<TestOptions> {
    const args = process.argv.slice(2);
    const options: TestOptions = {};

    for (const arg of args) {
        if (arg.startsWith('--test=')) {
            options.test = arg.split('=')[1];
        } else if (arg.startsWith('--duration=')) {
            options.duration = parseInt(arg.split('=')[1], 10);
        } else if (arg.startsWith('--connections=')) {
            options.connections = parseInt(arg.split('=')[1], 10);
        } else if (arg.startsWith('--tenants=')) {
            options.tenants = parseInt(arg.split('=')[1], 10);
        }
    }

    return options;
}

async function testConcurrentConnections(
    tester: PerformanceTester,
    connectionCount: number
): Promise<void> {
    console.log(`\n🔗 Testing ${connectionCount} concurrent connections...`);

    const result = await tester.testConcurrentConnections(connectionCount);

    console.log('✅ Concurrent Connection Test Results:');
    console.log(`   Successful: ${result.successful}`);
    console.log(`   Failed: ${result.failed}`);
    console.log(`   Avg Connection Time: ${result.avgConnectionTime.toFixed(2)}ms`);
    console.log(`   Max Connection Time: ${result.maxConnectionTime.toFixed(2)}ms`);

    if (result.failed > 0) {
        console.warn(`⚠️  Warning: ${result.failed} connections failed`);
    }
}

async function testMultiTenantWorkload(
    tester: PerformanceTester,
    options: TestOptions
): Promise<void> {
    const duration = options.duration || 60;
    const connections = options.connections || 100;
    const tenants = options.tenants || 10;

    console.log(`\n🏢 Simulating multi-tenant workload...`);
    console.log(`   Duration: ${duration}s`);
    console.log(`   Concurrent Connections: ${connections}`);
    console.log(`   Tenant Count: ${tenants}`);

    const result = await tester.simulateMultiTenantWorkload({
        concurrentConnections: connections,
        queriesPerSecond: 1000,
        durationSeconds: duration,
        tenantCount: tenants,
    });

    console.log('✅ Multi-Tenant Workload Results:');
    console.log(`   Queries Executed: ${result.queriesExecuted}`);
    console.log(`   Success Rate: ${((result.successCount / result.queriesExecuted) * 100).toFixed(2)}%`);
    console.log(`   p50: ${result.metrics.p50.toFixed(2)}ms`);
    console.log(`   p95: ${result.metrics.p95.toFixed(2)}ms`);
    console.log(`   p99: ${result.metrics.p99.toFixed(2)}ms`);
    console.log(`   Min: ${result.metrics.min.toFixed(2)}ms`);
    console.log(`   Max: ${result.metrics.max.toFixed(2)}ms`);
    console.log(`   Avg: ${result.metrics.avg.toFixed(2)}ms`);

    if (result.failureCount > 0) {
        console.warn(`⚠️  Warning: ${result.failureCount} queries failed`);
    }
}

async function testQueryResponseTime(
    tester: PerformanceTester
): Promise<void> {
    console.log('\n⏱️  Measuring query response times...');

    const queries = [
        {
            name: 'Simple SELECT',
            sql: 'SELECT 1',
        },
        {
            name: 'User Products Query',
            sql: `SELECT * FROM user_products WHERE status = 'active' LIMIT 20`,
        },
        {
            name: 'Product Matches Query',
            sql: `SELECT * FROM product_matches WHERE status = 'active' LIMIT 50`,
        },
    ];

    for (const query of queries) {
        try {
            const metrics = await tester.measureQueryResponseTime(query.sql, [], 100);

            console.log(`\n   ${query.name}:`);
            console.log(`      p50: ${metrics.p50.toFixed(2)}ms`);
            console.log(`      p95: ${metrics.p95.toFixed(2)}ms`);
            console.log(`      p99: ${metrics.p99.toFixed(2)}ms`);
        } catch (error) {
            console.error(`   ❌ Failed to measure ${query.name}:`, error);
        }
    }
}

async function checkRegressions(
    manager: PerformanceBaselineManager
): Promise<void> {
    console.log('\n🔍 Checking for performance regressions...');

    const regressions = await manager.getRecentRegressions(10);

    if (regressions.length === 0) {
        console.log('✅ No recent regressions detected');
        return;
    }

    console.log(`⚠️  Found ${regressions.length} recent regressions:`);

    for (const regression of regressions) {
        console.log(`\n   Query: ${regression.queryFingerprint}`);
        console.log(`   Baseline p95: ${regression.baselineP95.toFixed(2)}ms`);
        console.log(`   Current p95: ${regression.currentP95.toFixed(2)}ms`);
        console.log(`   Degradation: ${regression.degradationPercent.toFixed(2)}%`);
        console.log(`   Detected: ${regression.detectedAt}`);
    }
}

async function runAllTests(options: TestOptions): Promise<void> {
    const pool = getConnectionPoolManager().getPool();
    const tester = new PerformanceTester(pool);
    const manager = new PerformanceBaselineManager(pool);

    console.log('🚀 Starting Performance Test Suite');
    console.log('='.repeat(50));

    try {
        // Test concurrent connections
        await testConcurrentConnections(
            tester,
            options.connections || 100
        );

        // Test query response times
        await testQueryResponseTime(tester);

        // Test multi-tenant workload
        await testMultiTenantWorkload(tester, options);

        // Check for regressions
        await checkRegressions(manager);

        console.log('\n' + '='.repeat(50));
        console.log('✅ Performance test suite completed successfully');
    } catch (error) {
        console.error('\n❌ Performance test suite failed:', error);
        process.exit(1);
    }
}

async function runSpecificTest(
    testName: string,
    options: TestOptions
): Promise<void> {
    const pool = getConnectionPoolManager().getPool();
    const tester = new PerformanceTester(pool);
    const manager = new PerformanceBaselineManager(pool);

    console.log(`🚀 Running test: ${testName}`);
    console.log('='.repeat(50));

    try {
        switch (testName) {
            case 'concurrent':
            case 'connections':
                await testConcurrentConnections(
                    tester,
                    options.connections || 100
                );
                break;

            case 'workload':
            case 'multi-tenant':
                await testMultiTenantWorkload(tester, options);
                break;

            case 'response-time':
            case 'query':
                await testQueryResponseTime(tester);
                break;

            case 'regressions':
            case 'baseline':
                await checkRegressions(manager);
                break;

            default:
                console.error(`❌ Unknown test: ${testName}`);
                console.log('\nAvailable tests:');
                console.log('  - concurrent (or connections)');
                console.log('  - workload (or multi-tenant)');
                console.log('  - response-time (or query)');
                console.log('  - regressions (or baseline)');
                process.exit(1);
        }

        console.log('\n' + '='.repeat(50));
        console.log('✅ Test completed successfully');
    } catch (error) {
        console.error('\n❌ Test failed:', error);
        process.exit(1);
    }
}

async function main(): Promise<void> {
    const options = await parseArgs();

    if (options.test) {
        await runSpecificTest(options.test, options);
    } else {
        await runAllTests(options);
    }

    process.exit(0);
}

// Run the script
main().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
});
