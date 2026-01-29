#!/usr/bin/env tsx

/**
 * Cache Monitoring Script
 * 
 * Monitors cache performance and logs statistics.
 * Can be run manually or scheduled for regular monitoring.
 * 
 * Usage:
 *   npm run monitor-cache
 *   or
 *   tsx scripts/monitor-cache.ts
 * 
 * Requirements: 4.5
 */

import { cacheLayer } from "@/lib/services/cache-layer";
import { logger } from "@/lib/logger";

async function monitorCache(): Promise<void> {
    try {
        logger.info("[CacheMonitoring] Starting cache monitoring");

        // Get cache statistics
        const stats = await cacheLayer.getCacheStats();

        // Calculate percentages
        const hitRatePercent = (stats.hitRate * 100).toFixed(2);
        const missRatePercent = (stats.missRate * 100).toFixed(2);

        // Convert memory to MB
        const memoryUsedMB = (stats.memoryUsedBytes / 1024 / 1024).toFixed(2);

        // Log statistics
        logger.info("[CacheMonitoring] Cache statistics", {
            hitRate: hitRatePercent + "%",
            missRate: missRatePercent + "%",
            totalKeys: stats.totalKeys,
            memoryUsedMB: memoryUsedMB + " MB",
            memoryUsedBytes: stats.memoryUsedBytes,
            evictions: stats.evictions,
        });

        // Check for performance issues
        const issues: string[] = [];

        // Requirement 4.5: Alert when hit rate falls below 60%
        if (stats.hitRate < 0.6) {
            issues.push(
                `Low hit rate: ${hitRatePercent}% (threshold: 60%)`
            );
        }

        // Alert on high evictions
        if (stats.evictions > 1000) {
            issues.push(
                `High eviction count: ${stats.evictions} (consider increasing Redis memory)`
            );
        }

        // Alert on high memory usage (over 1GB)
        if (stats.memoryUsedBytes > 1024 * 1024 * 1024) {
            issues.push(
                `High memory usage: ${memoryUsedMB} MB (consider reviewing TTL settings)`
            );
        }

        // Log issues if any
        if (issues.length > 0) {
            logger.warn("[CacheMonitoring] Performance issues detected", {
                issues,
                stats: {
                    hitRate: hitRatePercent + "%",
                    totalKeys: stats.totalKeys,
                    memoryUsedMB: memoryUsedMB + " MB",
                    evictions: stats.evictions,
                },
            });
        } else {
            logger.info("[CacheMonitoring] Cache performance is healthy");
        }

        // Recommendations
        const recommendations: string[] = [];

        if (stats.hitRate < 0.6) {
            recommendations.push("Consider increasing TTL for frequently accessed data");
            recommendations.push("Review cache warming strategy");
            recommendations.push("Check if invalidation patterns are too aggressive");
        }

        if (stats.evictions > 1000) {
            recommendations.push("Increase Redis maxmemory setting");
            recommendations.push("Review cache key TTL settings");
            recommendations.push("Consider implementing cache size limits");
        }

        if (recommendations.length > 0) {
            logger.info("[CacheMonitoring] Recommendations", {
                recommendations,
            });
        }

        process.exit(issues.length > 0 ? 1 : 0);
    } catch (error) {
        logger.error("[CacheMonitoring] Cache monitoring failed", { error });
        process.exit(1);
    }
}

// Run the cache monitoring
monitorCache();
