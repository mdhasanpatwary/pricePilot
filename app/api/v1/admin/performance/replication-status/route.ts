/**
 * Replication Status API Endpoint
 * 
 * GET /api/v1/admin/performance/replication-status
 * 
 * Returns current replication lag status and routing statistics for all
 * configured read replicas.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getReadReplicaRouter } from '@/lib/services/read-replica-router';

export async function GET(_request: NextRequest) {
    try {
        const router = getReadReplicaRouter();

        // Check replication lag
        const replicationStatuses = await router.checkReplicationLag();

        // Get routing statistics
        const routingStats = await router.getRoutingStats();

        // Calculate health metrics
        const totalReplicas = replicationStatuses.length;
        const healthyReplicas = replicationStatuses.filter(s => s.healthy).length;
        const unhealthyReplicas = totalReplicas - healthyReplicas;

        // Calculate lag metrics
        const healthyLags = replicationStatuses
            .filter(s => s.healthy && s.lagSeconds >= 0)
            .map(s => s.lagSeconds);

        const maxLag = healthyLags.length > 0 ? Math.max(...healthyLags) : 0;
        const minLag = healthyLags.length > 0 ? Math.min(...healthyLags) : 0;

        // Determine overall health status
        let overallStatus: 'healthy' | 'warning' | 'critical' = 'healthy';
        if (unhealthyReplicas > 0 || routingStats.avgReplicationLag > 30) {
            overallStatus = 'critical';
        } else if (routingStats.avgReplicationLag > 5) {
            overallStatus = 'warning';
        }

        return NextResponse.json({
            success: true,
            data: {
                overallStatus,
                replicas: replicationStatuses.map(status => ({
                    id: status.replicaId,
                    healthy: status.healthy,
                    lagSeconds: status.lagSeconds,
                    lagStatus: status.lagSeconds < 5 ? 'good' : status.lagSeconds < 30 ? 'warning' : 'critical',
                    lastCheck: status.lastCheck.toISOString(),
                })),
                routing: {
                    primaryQueries: routingStats.primaryQueries,
                    replicaQueries: routingStats.replicaQueries,
                    totalQueries: routingStats.primaryQueries + routingStats.replicaQueries,
                    replicaQueryPercent: routingStats.primaryQueries + routingStats.replicaQueries > 0
                        ? (routingStats.replicaQueries / (routingStats.primaryQueries + routingStats.replicaQueries) * 100).toFixed(1)
                        : '0.0',
                    failoverCount: routingStats.failoverCount,
                },
                metrics: {
                    totalReplicas,
                    healthyReplicas,
                    unhealthyReplicas,
                    avgReplicationLag: routingStats.avgReplicationLag,
                    maxReplicationLag: maxLag,
                    minReplicationLag: minLag,
                },
            },
            meta: {
                timestamp: new Date().toISOString(),
            },
        });
    } catch (error) {
        console.error('Error fetching replication status:', error);

        return NextResponse.json(
            {
                success: false,
                error: {
                    code: 'REPLICATION_STATUS_ERROR',
                    message: 'Failed to fetch replication status',
                    details: error instanceof Error ? error.message : 'Unknown error',
                },
            },
            { status: 500 }
        );
    }
}
