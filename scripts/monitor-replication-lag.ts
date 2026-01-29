/**
 * Monitor Replication Lag Script
 * 
 * Monitors replication lag for all configured read replicas and displays
 * current status, health, and routing statistics.
 * 
 * Usage:
 *   npx tsx scripts/monitor-replication-lag.ts
 */

import { getReplicaRouter, getRoutingStats, getReplicationStatus } from '@/lib/database/replica-aware-prisma';

async function monitorReplicationLag() {
    console.log('='.repeat(80));
    console.log('Read Replica Replication Lag Monitor');
    console.log('='.repeat(80));
    console.log();

    try {
        const router = getReplicaRouter();

        if (!router) {
            console.log('No read replicas configured.');
            console.log();
            console.log('To configure replicas, set environment variables:');
            console.log('  READ_REPLICA_1_URL=postgresql://user:pass@replica1:5432/db');
            console.log('  READ_REPLICA_2_URL=postgresql://user:pass@replica2:5432/db');
            console.log('  ... and so on');
            return;
        }

        // Check replication lag
        console.log('Checking replication lag...');
        const statuses = await getReplicationStatus();

        console.log();
        console.log('Replication Status:');
        console.log('-'.repeat(80));

        statuses.forEach((status) => {
            const healthIcon = status.healthy ? '✓' : '✗';
            const lagStatus = status.lagSeconds < 5 ? 'GOOD' : status.lagSeconds < 30 ? 'WARNING' : 'CRITICAL';

            console.log(`${healthIcon} ${status.replicaId}`);
            console.log(`  Health: ${status.healthy ? 'Healthy' : 'Unhealthy'}`);
            console.log(`  Lag: ${status.lagSeconds >= 0 ? status.lagSeconds.toFixed(2) + 's' : 'Unknown'} [${lagStatus}]`);
            console.log(`  Last Check: ${status.lastCheck.toISOString()}`);
            console.log();
        });

        // Get routing statistics
        console.log('Routing Statistics:');
        console.log('-'.repeat(80));

        const stats = await getRoutingStats();
        const totalQueries = stats.primaryQueries + stats.replicaQueries;
        const replicaPercent = totalQueries > 0 ? (stats.replicaQueries / totalQueries * 100).toFixed(1) : '0.0';

        console.log(`Total Queries: ${totalQueries}`);
        console.log(`  Primary: ${stats.primaryQueries} (${(100 - parseFloat(replicaPercent)).toFixed(1)}%)`);
        console.log(`  Replica: ${stats.replicaQueries} (${replicaPercent}%)`);
        console.log(`Failover Count: ${stats.failoverCount}`);
        console.log(`Average Replication Lag: ${stats.avgReplicationLag.toFixed(2)}s`);
        console.log();

        // Health summary
        const healthyCount = statuses.filter(s => s.healthy).length;
        const unhealthyCount = statuses.length - healthyCount;

        console.log('Summary:');
        console.log('-'.repeat(80));
        console.log(`Total Replicas: ${statuses.length}`);
        console.log(`Healthy: ${healthyCount}`);
        console.log(`Unhealthy: ${unhealthyCount}`);

        if (unhealthyCount > 0) {
            console.log();
            console.log('⚠️  WARNING: Some replicas are unhealthy!');
            console.log('   Read queries may be routed to primary database.');
        }

        if (stats.avgReplicationLag > 5) {
            console.log();
            console.log('⚠️  WARNING: High average replication lag detected!');
            console.log('   Consider investigating replica performance.');
        }

        if (stats.failoverCount > 0) {
            console.log();
            console.log(`ℹ️  INFO: ${stats.failoverCount} failover(s) to primary have occurred.`);
        }

        console.log();
        console.log('='.repeat(80));

    } catch (error) {
        console.error('Error monitoring replication lag:', error);
        process.exit(1);
    }
}

// Run the monitor
monitorReplicationLag()
    .then(() => {
        console.log('Monitoring complete.');
        process.exit(0);
    })
    .catch((error) => {
        console.error('Fatal error:', error);
        process.exit(1);
    });
