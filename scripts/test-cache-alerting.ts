#!/usr/bin/env tsx

/**
 * Cache Alerting Test Script
 * 
 * Tests the cache alerting system by simulating various alert conditions.
 * 
 * Usage:
 *   npm run test-cache-alerting
 *   or
 *   tsx scripts/test-cache-alerting.ts
 */

import { cacheAlertingService } from "@/lib/services/cache-alerting";
import { cacheMonitoringService } from "@/lib/services/cache-monitoring";
import { logger } from "@/lib/logger";

async function testCacheAlerting(): Promise<void> {
    console.log("=".repeat(80));
    console.log("Cache Alerting System Test");
    console.log("=".repeat(80));
    console.log();

    try {
        // Test 1: Get current configuration
        console.log("Test 1: Get Alert Configuration");
        console.log("-".repeat(80));
        const config = cacheAlertingService.getConfig();
        console.log("Current configuration:");
        console.log(JSON.stringify(config, null, 2));
        console.log();

        // Test 2: Check cache health and generate alerts
        console.log("Test 2: Check Cache Health and Generate Alerts");
        console.log("-".repeat(80));
        await cacheAlertingService.checkAndAlert();
        console.log("✓ Alert check completed");
        console.log();

        // Test 3: Get alert history
        console.log("Test 3: Get Alert History");
        console.log("-".repeat(80));
        const history = cacheAlertingService.getAlertHistory(10);
        console.log(`Total alerts in history: ${history.length}`);
        if (history.length > 0) {
            console.log("\nRecent alerts:");
            history.forEach((alert, index) => {
                console.log(`\n${index + 1}. ${alert.message}`);
                console.log(`   Level: ${alert.level}`);
                console.log(`   Metric: ${alert.metric}`);
                console.log(`   Timestamp: ${alert.timestamp.toISOString()}`);
                console.log(`   Resolved: ${alert.resolved}`);
                if (alert.value !== undefined) {
                    console.log(`   Value: ${alert.value}`);
                }
                if (alert.threshold !== undefined) {
                    console.log(`   Threshold: ${alert.threshold}`);
                }
            });
        } else {
            console.log("No alerts in history");
        }
        console.log();

        // Test 4: Get active alerts
        console.log("Test 4: Get Active Alerts");
        console.log("-".repeat(80));
        const activeAlerts = cacheAlertingService.getActiveAlerts();
        console.log(`Active (unresolved) alerts: ${activeAlerts.length}`);
        if (activeAlerts.length > 0) {
            console.log("\nActive alerts:");
            activeAlerts.forEach((alert, index) => {
                console.log(`\n${index + 1}. ${alert.message}`);
                console.log(`   Level: ${alert.level}`);
                console.log(`   Metric: ${alert.metric}`);
                console.log(`   Timestamp: ${alert.timestamp.toISOString()}`);
            });
        } else {
            console.log("No active alerts - system is healthy!");
        }
        console.log();

        // Test 5: Get current cache health
        console.log("Test 5: Get Current Cache Health");
        console.log("-".repeat(80));
        const health = await cacheMonitoringService.getHealthStatus();
        console.log("Cache health status:");
        console.log(JSON.stringify(health, null, 2));
        console.log();

        // Test 6: Test performance check
        console.log("Test 6: Test Performance Check");
        console.log("-".repeat(80));
        const { healthy, latency } = await cacheMonitoringService.checkPerformance();
        console.log(`Performance check: ${healthy ? "✓ Healthy" : "✗ Unhealthy"}`);
        console.log(`Latency: ${latency}ms`);
        console.log();

        // Test 7: Update configuration (test only)
        console.log("Test 7: Update Configuration (Test)");
        console.log("-".repeat(80));
        console.log("Testing configuration update...");
        cacheAlertingService.updateConfig({
            hitRateThreshold: 0.5, // Lower threshold for testing
        });
        const updatedConfig = cacheAlertingService.getConfig();
        console.log("Updated configuration:");
        console.log(JSON.stringify(updatedConfig, null, 2));

        // Restore original configuration
        cacheAlertingService.updateConfig({
            hitRateThreshold: config.hitRateThreshold,
        });
        console.log("✓ Configuration restored");
        console.log();

        // Summary
        console.log("=".repeat(80));
        console.log("Test Summary");
        console.log("=".repeat(80));
        console.log(`✓ Alert system is ${config.enabled ? "enabled" : "disabled"}`);
        console.log(`✓ Notification channels: ${config.notificationChannels.join(", ")}`);
        console.log(`✓ Hit rate threshold: ${(config.hitRateThreshold * 100).toFixed(0)}%`);
        console.log(`✓ Memory threshold: ${(config.memoryUsageThreshold * 100).toFixed(0)}%`);
        console.log(`✓ Response time threshold: ${config.responseTimeThreshold}ms`);
        console.log(`✓ Total alerts in history: ${history.length}`);
        console.log(`✓ Active alerts: ${activeAlerts.length}`);
        console.log(`✓ Cache health: ${health.status}`);
        console.log(`✓ Cache performance: ${healthy ? "healthy" : "degraded"} (${latency}ms)`);
        console.log();

        // Recommendations
        if (activeAlerts.length > 0) {
            console.log("⚠️  Recommendations:");
            activeAlerts.forEach(alert => {
                console.log(`   - ${alert.message}`);

                if (alert.metric === 'hitRate') {
                    console.log("     → Consider increasing TTL for frequently accessed data");
                    console.log("     → Review cache warming strategy");
                }

                if (alert.metric === 'memoryUsage') {
                    console.log("     → Increase Redis maxmemory setting");
                    console.log("     → Review cache key TTL settings");
                }

                if (alert.metric === 'responseTime') {
                    console.log("     → Check Redis server performance");
                    console.log("     → Review network latency");
                }
            });
            console.log();
        }

        console.log("=".repeat(80));
        console.log("All tests completed successfully!");
        console.log("=".repeat(80));

        process.exit(0);
    } catch (error) {
        console.error("\n✗ Test failed:", error);
        logger.error("[TestCacheAlerting] Test failed", { error });
        process.exit(1);
    }
}

// Run the test
testCacheAlerting();
