/**
 * Test Documentation Monitoring System
 * 
 * This script tests the monitoring and logging functionality for the documentation system.
 */

import { documentationMonitor, LogCategory } from '@/lib/documentation/monitoring';
import { DocumentationType } from '@prisma/client';

async function testMonitoring() {
    console.log('🧪 Testing Documentation Monitoring System\n');

    try {
        // Test 1: Log document modification
        console.log('📝 Test 1: Logging document modification...');
        await documentationMonitor.logDocumentModification(
            'test-doc-id-123',
            'CREATE',
            'test-user-id',
            {
                type: 'tenant',
                slug: 'test-document',
                title: 'Test Document',
                category: 'getting-started',
            }
        );
        console.log('✅ Document modification logged\n');

        // Test 2: Log suggestion generation
        console.log('📝 Test 2: Logging suggestion generation...');
        await documentationMonitor.logSuggestionGeneration(
            'test-suggestion-id-456',
            'test-doc-id-123',
            DocumentationType.TENANT,
            'task-789',
            {
                category: 'products',
                hasTitle: true,
                contentLength: 500,
            }
        );
        console.log('✅ Suggestion generation logged\n');

        // Test 3: Log access denial
        console.log('📝 Test 3: Logging access denial...');
        await documentationMonitor.logAccessDenial(
            'test-user-id',
            '/admin-docs/system-monitoring',
            'User does not have admin role',
            {
                userRole: 'VIEWER',
                requiredRole: 'ADMIN',
            }
        );
        console.log('✅ Access denial logged\n');

        // Test 4: Log search operation
        console.log('📝 Test 4: Logging search operation...');
        await documentationMonitor.logSearch(
            'product setup',
            DocumentationType.TENANT,
            15,
            120,
            'test-user-id',
            {
                cached: false,
                filters: { category: 'products' },
            }
        );
        console.log('✅ Search operation logged\n');

        // Test 5: Log slow search (should trigger warning)
        console.log('📝 Test 5: Logging slow search...');
        await documentationMonitor.logSearch(
            'complex query',
            DocumentationType.ADMIN,
            5,
            350, // > 200ms threshold
            'test-user-id'
        );
        console.log('✅ Slow search logged (warning should be triggered)\n');

        // Test 6: Log error
        console.log('📝 Test 6: Logging error...');
        const testError = new Error('Test error for monitoring');
        await documentationMonitor.logError(
            LogCategory.SEARCH,
            testError,
            {
                query: 'test query',
                type: 'TENANT',
            }
        );
        console.log('✅ Error logged\n');

        // Test 7: Log cache operations
        console.log('📝 Test 7: Logging cache operations...');
        await documentationMonitor.logCacheOperation('HIT', 'search:TENANT:product', {
            ttl: 300,
        });
        await documentationMonitor.logCacheOperation('MISS', 'search:ADMIN:monitoring');
        await documentationMonitor.logCacheOperation('INVALIDATE', undefined, {
            type: 'TENANT',
        });
        console.log('✅ Cache operations logged\n');

        // Test 8: Log migration
        console.log('📝 Test 8: Logging migration...');
        await documentationMonitor.logMigration(
            'migrate-tenant-docs',
            'START',
            {
                totalFiles: 50,
            }
        );
        await documentationMonitor.logMigration(
            'migrate-tenant-docs',
            'PROGRESS',
            {
                processed: 25,
                totalFiles: 50,
            }
        );
        await documentationMonitor.logMigration(
            'migrate-tenant-docs',
            'COMPLETE',
            {
                processed: 50,
                totalFiles: 50,
                duration: 5000,
            }
        );
        console.log('✅ Migration logged\n');

        // Test 9: Get recent logs
        console.log('📝 Test 9: Retrieving recent logs...');
        const recentLogs = await documentationMonitor.getRecentLogs(10);
        console.log(`✅ Retrieved ${recentLogs.length} recent logs`);
        if (recentLogs.length > 0) {
            console.log('   Sample log:', {
                level: recentLogs[0].level,
                category: recentLogs[0].category,
                message: recentLogs[0].message,
            });
        }
        console.log('');

        // Test 10: Get error metrics
        console.log('📝 Test 10: Retrieving error metrics...');
        const errorMetrics = await documentationMonitor.getAllErrorMetrics(24);
        console.log(`✅ Retrieved error metrics for ${errorMetrics.length} categories`);
        if (errorMetrics.length > 0) {
            console.log('   Sample metric:', {
                category: errorMetrics[0].category,
                errorCount: errorMetrics[0].errorCount,
                errorRate: errorMetrics[0].errorRate.toFixed(2) + ' errors/hour',
            });
        }
        console.log('');

        // Test 11: Get category-specific error metrics
        console.log('📝 Test 11: Retrieving category-specific error metrics...');
        const searchErrors = await documentationMonitor.getErrorMetrics(
            LogCategory.SEARCH,
            24
        );
        console.log('✅ Search error metrics:', {
            errorCount: searchErrors.errorCount,
            errorRate: searchErrors.errorRate.toFixed(2) + ' errors/hour',
            lastError: searchErrors.lastError.toISOString(),
        });
        console.log('');

        console.log('✨ All monitoring tests completed successfully!');
        console.log('\n📊 Summary:');
        console.log('   - Document modifications: Logged');
        console.log('   - Suggestion generation: Logged');
        console.log('   - Access control: Logged');
        console.log('   - Search operations: Logged');
        console.log('   - Errors: Logged and tracked');
        console.log('   - Cache operations: Logged');
        console.log('   - Migrations: Logged');
        console.log('   - Log retrieval: Working');
        console.log('   - Error metrics: Working');

    } catch (error) {
        console.error('❌ Monitoring test failed:', error);
        throw error;
    }
}

// Run the test
testMonitoring()
    .then(() => {
        console.log('\n✅ Test completed successfully');
        process.exit(0);
    })
    .catch((error) => {
        console.error('\n❌ Test failed:', error);
        process.exit(1);
    });
