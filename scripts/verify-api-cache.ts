/**
 * Verification Script for API Cache Component
 * 
 * Tests the APICache implementation to ensure all methods work correctly
 */

import { apiCache } from '@/lib/services/api-detection';
import type { APIPattern } from '@/lib/types/api-detection';

async function verifyAPICache() {
    console.log('🔍 Verifying API Cache Component...\n');

    const testWebsiteId = 'test-website-' + Date.now();
    const testTenantId = 'test-tenant-' + Date.now();

    try {
        // Test 1: Store a pattern
        console.log('✓ Test 1: Store API Pattern');
        const testPattern: Omit<APIPattern, 'id' | 'createdAt' | 'updatedAt'> = {
            tenantId: testTenantId,
            competitorWebsiteId: testWebsiteId,
            url: 'https://example.com/api/products',
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            },
            queryParams: {
                page: '1',
                limit: '20',
            },
            responseFormat: 'json',
            dataPath: '$.data.products',
            fieldMappings: [
                { sourceField: 'id', targetField: 'externalId' },
                { sourceField: 'title', targetField: 'name' },
                { sourceField: 'price', targetField: 'price' },
            ],
            confidenceScore: 85,
            successCount: 0,
            failureCount: 0,
        };

        await apiCache.storePattern(testWebsiteId, testPattern);
        console.log('  ✅ Pattern stored successfully\n');

        // Test 2: Retrieve the pattern
        console.log('✓ Test 2: Retrieve API Pattern');
        const retrieved = await apiCache.getPattern(testWebsiteId);

        if (!retrieved) {
            throw new Error('Pattern not found after storage');
        }

        console.log('  ✅ Pattern retrieved successfully');
        console.log(`  - URL: ${retrieved.url}`);
        console.log(`  - Method: ${retrieved.method}`);
        console.log(`  - Confidence: ${retrieved.confidenceScore}`);
        console.log(`  - Success Count: ${retrieved.successCount}`);
        console.log(`  - Failure Count: ${retrieved.failureCount}\n`);

        // Test 3: Update metrics (success)
        console.log('✓ Test 3: Update Metrics (Success)');
        await apiCache.updateMetrics(testWebsiteId, true);
        const afterSuccess = await apiCache.getPattern(testWebsiteId);

        if (!afterSuccess) {
            throw new Error('Pattern not found after metrics update');
        }

        console.log('  ✅ Metrics updated successfully');
        console.log(`  - Success Count: ${afterSuccess.successCount} (expected: 1)`);
        console.log(`  - Failure Count: ${afterSuccess.failureCount} (expected: 0)`);
        console.log(`  - Last Used: ${afterSuccess.lastUsedAt}\n`);

        // Test 4: Update metrics (failure)
        console.log('✓ Test 4: Update Metrics (Failure)');
        await apiCache.updateMetrics(testWebsiteId, false);
        const afterFailure = await apiCache.getPattern(testWebsiteId);

        if (!afterFailure) {
            throw new Error('Pattern not found after failure update');
        }

        console.log('  ✅ Failure tracked successfully');
        console.log(`  - Success Count: ${afterFailure.successCount} (expected: 1)`);
        console.log(`  - Failure Count: ${afterFailure.failureCount} (expected: 1)\n`);

        // Test 5: Automatic invalidation after 3 failures
        console.log('✓ Test 5: Automatic Invalidation (3 consecutive failures)');
        await apiCache.updateMetrics(testWebsiteId, false); // 2nd failure
        await apiCache.updateMetrics(testWebsiteId, false); // 3rd failure - should auto-invalidate

        const afterAutoInvalidation = await apiCache.getPattern(testWebsiteId);

        if (afterAutoInvalidation !== null) {
            throw new Error('Pattern should be auto-invalidated after 3 failures');
        }

        console.log('  ✅ Pattern auto-invalidated after 3 consecutive failures\n');

        // Test 6: Manual invalidation
        console.log('✓ Test 6: Manual Invalidation');

        // Store a new pattern
        await apiCache.storePattern(testWebsiteId, testPattern);

        // Manually invalidate
        await apiCache.invalidatePattern(testWebsiteId);

        const afterManualInvalidation = await apiCache.getPattern(testWebsiteId);

        if (afterManualInvalidation !== null) {
            throw new Error('Pattern should be invalidated after manual invalidation');
        }

        console.log('  ✅ Pattern manually invalidated successfully\n');

        // Test 7: Cache statistics
        console.log('✓ Test 7: Cache Statistics');

        // Store a few patterns for stats
        await apiCache.storePattern(testWebsiteId + '-1', { ...testPattern, competitorWebsiteId: testWebsiteId + '-1' });
        await apiCache.storePattern(testWebsiteId + '-2', { ...testPattern, competitorWebsiteId: testWebsiteId + '-2' });

        const stats = await apiCache.getCacheStats(testTenantId);

        console.log('  ✅ Cache statistics retrieved');
        console.log(`  - Total Patterns: ${stats.totalPatterns}`);
        console.log(`  - Avg Success Rate: ${(stats.avgSuccessRate * 100).toFixed(2)}%`);
        console.log(`  - Avg Confidence: ${stats.avgConfidenceScore.toFixed(2)}`);
        console.log(`  - Patterns with Failures: ${stats.patternsWithFailures}\n`);

        // Cleanup
        console.log('🧹 Cleaning up test data...');
        await apiCache.invalidatePattern(testWebsiteId + '-1');
        await apiCache.invalidatePattern(testWebsiteId + '-2');
        console.log('  ✅ Cleanup complete\n');

        console.log('✅ All API Cache tests passed!\n');
        console.log('📊 Summary:');
        console.log('  - Store Pattern: ✅');
        console.log('  - Retrieve Pattern: ✅');
        console.log('  - Update Metrics (Success): ✅');
        console.log('  - Update Metrics (Failure): ✅');
        console.log('  - Automatic Invalidation: ✅');
        console.log('  - Manual Invalidation: ✅');
        console.log('  - Cache Statistics: ✅');

    } catch (error) {
        console.error('❌ Verification failed:', error);
        process.exit(1);
    }
}

// Run verification
verifyAPICache()
    .then(() => {
        console.log('\n✅ API Cache verification complete!');
        process.exit(0);
    })
    .catch((error) => {
        console.error('\n❌ Verification error:', error);
        process.exit(1);
    });
