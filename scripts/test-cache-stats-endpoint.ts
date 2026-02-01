/**
 * Test script for cache stats endpoint
 * 
 * This script verifies that the cache stats endpoint is properly configured
 * and returns the expected data structure.
 */

import { CacheMonitoringService } from '@/lib/services/cache-monitoring';

async function testCacheStatsEndpoint() {
    console.log('Testing Cache Stats Endpoint Implementation...\n');

    try {
        // Test 1: Verify CacheMonitoringService can be instantiated
        console.log('✓ Test 1: Instantiating CacheMonitoringService...');
        const monitoringService = new CacheMonitoringService();
        console.log('  Success: CacheMonitoringService instantiated\n');

        // Test 2: Verify getHealthStatus method exists and returns expected structure
        console.log('✓ Test 2: Calling getHealthStatus...');
        const healthStatus = await monitoringService.getHealthStatus();
        console.log('  Success: Health status retrieved');
        console.log('  Status:', healthStatus.status);
        console.log('  Timestamp:', healthStatus.timestamp);

        if (healthStatus.redis) {
            console.log('  Redis Connected:', healthStatus.redis.connected);
            console.log('  Memory Usage:', (healthStatus.redis.memoryUsage / 1024 / 1024).toFixed(2), 'MB');
            console.log('  Memory Limit:', (healthStatus.redis.memoryLimit / 1024 / 1024).toFixed(2), 'MB');
            console.log('  Memory Usage %:', (healthStatus.redis.memoryUsagePercent * 100).toFixed(1), '%');
        }

        if (healthStatus.performance) {
            console.log('  Hit Rate:', (healthStatus.performance.hitRate * 100).toFixed(1), '%');
            console.log('  Total Keys:', healthStatus.performance.totalKeys);
            console.log('  Evictions:', healthStatus.performance.evictions);
        }

        if (healthStatus.alerts && healthStatus.alerts.length > 0) {
            console.log('  Alerts:', healthStatus.alerts.length);
            healthStatus.alerts.forEach((alert, index) => {
                console.log(`    ${index + 1}. [${alert.level.toUpperCase()}] ${alert.message}`);
            });
        } else {
            console.log('  Alerts: None');
        }
        console.log();

        // Test 3: Verify response structure matches requirements
        console.log('✓ Test 3: Validating response structure...');
        const requiredFields = ['status', 'timestamp'];
        const missingFields = requiredFields.filter(field => !(field in healthStatus));

        if (missingFields.length > 0) {
            console.log('  ✗ Missing required fields:', missingFields.join(', '));
            return false;
        }

        console.log('  Success: All required fields present\n');

        // Test 4: Verify status is valid
        console.log('✓ Test 4: Validating status value...');
        const validStatuses = ['healthy', 'unhealthy'];
        if (!validStatuses.includes(healthStatus.status)) {
            console.log('  ✗ Invalid status:', healthStatus.status);
            return false;
        }
        console.log('  Success: Status is valid\n');

        console.log('═══════════════════════════════════════════════════');
        console.log('✓ All tests passed!');
        console.log('═══════════════════════════════════════════════════');
        console.log('\nEndpoint Details:');
        console.log('  URL: GET /api/v1/admin/performance/cache-stats');
        console.log('  Authentication: Required (Admin only)');
        console.log('  Rate Limited: Yes');
        console.log('  Requirements: 4.4');
        console.log('\nResponse Structure:');
        console.log('  - success: boolean');
        console.log('  - data: CacheHealth object');
        console.log('    - status: "healthy" | "unhealthy"');
        console.log('    - redis: { connected, memoryUsage, memoryLimit, memoryUsagePercent }');
        console.log('    - performance: { hitRate, avgResponseTime, totalHits, totalMisses, totalKeys, evictions }');
        console.log('    - alerts: Alert[]');
        console.log('    - timestamp: ISO8601 string');
        console.log('  - meta: { timestamp }');

        return true;
    } catch (error) {
        console.error('\n✗ Test failed with error:');
        console.error(error);
        return false;
    }
}

// Run the test
testCacheStatsEndpoint()
    .then(success => {
        process.exit(success ? 0 : 1);
    })
    .catch(error => {
        console.error('Unexpected error:', error);
        process.exit(1);
    });
