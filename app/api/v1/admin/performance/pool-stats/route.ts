/**
 * Connection Pool Statistics API Endpoint
 *
 * GET /api/v1/admin/performance/pool-stats
 *
 * Returns current connection pool statistics including utilization,
 * health status, and connection metrics.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getConnectionPoolManager } from '@/lib/services/connection-pool-manager';
import { withRequestContextAndRateLimit } from '@/lib/middleware/with-request-context';

async function handleGET(_request: NextRequest) {

    try {
        const poolManager = getConnectionPoolManager();

        // Get pool statistics
        const poolStats = poolManager.getPoolStats();

        // Get health status
        const healthStatus = await poolManager.healthCheck();

        // Calculate additional metrics
        const utilizationPercent = poolStats.utilizationPercent;
        const connectionEfficiency = poolStats.totalConnections > 0
            ? (poolStats.activeConnections / poolStats.totalConnections * 100).toFixed(1)
            : '0.0';

        // Determine pool health
        let poolHealth: 'healthy' | 'warning' | 'critical' = 'healthy';
        if (!healthStatus.healthy || utilizationPercent > 90) {
            poolHealth = 'critical';
        } else if (utilizationPercent > 80) {
            poolHealth = 'warning';
        }

        // Determine response time status
        let responseTimeStatus: 'good' | 'acceptable' | 'slow' = 'good';
        if (healthStatus.avgResponseTime > 1000) {
            responseTimeStatus = 'slow';
        } else if (healthStatus.avgResponseTime > 500) {
            responseTimeStatus = 'acceptable';
        }

        return NextResponse.json({
            success: true,
            data: {
                poolHealth,
                connections: {
                    total: poolStats.totalConnections,
                    active: poolStats.activeConnections,
                    idle: poolStats.idleConnections,
                    waiting: poolStats.waitingRequests,
                    utilizationPercent: poolStats.utilizationPercent,
                    efficiency: parseFloat(connectionEfficiency),
                },
                health: {
                    healthy: healthStatus.healthy,
                    primaryReachable: healthStatus.primaryReachable,
                    replicasReachable: healthStatus.replicasReachable,
                    avgResponseTime: healthStatus.avgResponseTime,
                    responseTimeStatus,
                },
                alerts: [
                    ...(utilizationPercent > 80 ? [{
                        level: utilizationPercent > 90 ? 'critical' : 'warning',
                        message: `Connection pool utilization at ${utilizationPercent.toFixed(1)}%`,
                        recommendation: 'Consider increasing max pool size or optimizing query performance',
                    }] : []),
                    ...(poolStats.waitingRequests > 0 ? [{
                        level: 'warning',
                        message: `${poolStats.waitingRequests} requests waiting for connections`,
                        recommendation: 'Increase connection pool size or reduce query execution time',
                    }] : []),
                    ...(!healthStatus.healthy ? [{
                        level: 'critical',
                        message: 'Connection pool health check failed',
                        recommendation: 'Check database connectivity and server status',
                    }] : []),
                    ...(healthStatus.avgResponseTime > 1000 ? [{
                        level: 'warning',
                        message: `Average response time is ${healthStatus.avgResponseTime}ms`,
                        recommendation: 'Investigate database performance or network latency',
                    }] : []),
                ],
            },
            meta: {
                timestamp: new Date().toISOString(),
            },
        });
    } catch (error) {
        console.error('Error fetching pool stats:', error);

        return NextResponse.json(
            {
                success: false,
                error: {
                    code: 'POOL_STATS_ERROR',
                    message: 'Failed to fetch connection pool statistics',
                    details: error instanceof Error ? error.message : 'Unknown error',
                },
            },
            { status: 500 }
        );
    }
}

export async function GET(req: NextRequest) {
    return withRequestContextAndRateLimit(req, "read", handleGET);
}
