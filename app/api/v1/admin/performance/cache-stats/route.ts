/**
 * Cache Statistics API Endpoint
 * 
 * GET /api/v1/admin/performance/cache-stats
 * 
 * Returns current cache layer statistics including hit rates,
 * memory usage, and performance metrics.
 */

import { NextRequest, NextResponse } from 'next/server';
import { cacheLayer } from '@/lib/services/cache-layer';

export async function GET(request: NextRequest) {
    try {
        // Get cache statistics
        const cacheStats = await cacheLayer.getCacheStats();

        // Calculate additional metrics
        const totalRequests = cacheStats.hitRate + cacheStats.missRate;
        const hitRatePercent = totalRequests > 0
            ? (cacheStats.hitRate / totalRequests * 100)
            : 0;
        const missRatePercent = totalRequests > 0
            ? (cacheStats.missRate / totalRequests * 100)
            : 0;

        const memoryUsedMB = (cacheStats.memoryUsedBytes / (1024 * 1024)).toFixed(2);

        // Determine cache health
        let cacheHealth: 'healthy' | 'warning' | 'critical' = 'healthy';
        if (hitRatePercent < 50) {
            cacheHealth = 'critical';
        } else if (hitRatePercent < 60) {
            cacheHealth = 'warning';
        }

        // Determine memory status
        let memoryStatus: 'good' | 'warning' | 'critical' = 'good';
        const memoryUsedGB = cacheStats.memoryUsedBytes / (1024 * 1024 * 1024);
        if (memoryUsedGB > 4) {
            memoryStatus = 'critical';
        } else if (memoryUsedGB > 2) {
            memoryStatus = 'warning';
        }

        return NextResponse.json({
            success: true,
            data: {
                cacheHealth,
                performance: {
                    hitRate: cacheStats.hitRate,
                    missRate: cacheStats.missRate,
                    totalRequests,
                    hitRatePercent: parseFloat(hitRatePercent.toFixed(2)),
                    missRatePercent: parseFloat(missRatePercent.toFixed(2)),
                    hitRateStatus: hitRatePercent >= 60 ? 'good' :
                        hitRatePercent >= 50 ? 'acceptable' : 'poor',
                },
                memory: {
                    usedBytes: cacheStats.memoryUsedBytes,
                    usedMB: parseFloat(memoryUsedMB),
                    usedGB: parseFloat((cacheStats.memoryUsedBytes / (1024 * 1024 * 1024)).toFixed(2)),
                    status: memoryStatus,
                },
                keys: {
                    total: cacheStats.totalKeys,
                    evictions: cacheStats.evictions,
                    evictionRate: totalRequests > 0
                        ? parseFloat((cacheStats.evictions / totalRequests * 100).toFixed(2))
                        : 0,
                },
                alerts: [
                    ...(hitRatePercent < 60 ? [{
                        level: hitRatePercent < 50 ? 'critical' : 'warning',
                        message: `Cache hit rate is ${hitRatePercent.toFixed(1)}% (target: 60%+)`,
                        recommendation: 'Review cache TTL settings or increase cache warming frequency',
                    }] : []),
                    ...(cacheStats.evictions > 1000 ? [{
                        level: 'warning',
                        message: `High eviction count: ${cacheStats.evictions}`,
                        recommendation: 'Consider increasing cache memory or reducing TTL values',
                    }] : []),
                    ...(memoryStatus === 'critical' ? [{
                        level: 'critical',
                        message: `Cache memory usage is ${memoryUsedMB}MB`,
                        recommendation: 'Increase Redis memory limit or review cache key patterns',
                    }] : []),
                ],
            },
            meta: {
                timestamp: new Date().toISOString(),
            },
        });
    } catch (error) {
        console.error('Error fetching cache stats:', error);

        return NextResponse.json(
            {
                success: false,
                error: {
                    code: 'CACHE_STATS_ERROR',
                    message: 'Failed to fetch cache statistics',
                    details: error instanceof Error ? error.message : 'Unknown error',
                },
            },
            { status: 500 }
        );
    }
}
