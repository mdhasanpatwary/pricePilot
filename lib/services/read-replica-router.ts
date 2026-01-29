/**
 * Read Replica Router
 * 
 * Routes database queries to appropriate database instances (primary or replicas)
 * based on query type, replica health, and replication lag.
 * 
 * Features:
 * - Automatic query type detection (SELECT vs write operations)
 * - Replica health monitoring and circuit breaker
 * - Replication lag monitoring and lag-based routing
 * - Automatic failover to primary on replica failure
 * - Routing statistics and metrics
 */

import pg from 'pg';
import {
    ReadReplicaRouter,
    Query,
    ReplicationStatus,
    RoutingStats,
} from '@/lib/types/database-optimization';
import { ConnectionPoolManagerImpl } from './connection-pool-manager';

interface ReplicaConfig {
    id: string;
    connectionString: string;
    priority: number; // Lower number = higher priority
}

interface ReplicaState {
    id: string;
    pool: ConnectionPoolManagerImpl;
    healthy: boolean;
    lagSeconds: number;
    lastCheck: Date;
    failureCount: number;
    circuitBreakerOpen: boolean;
}

const LAG_WARNING_THRESHOLD = 5; // seconds
const LAG_FAILOVER_THRESHOLD = 30; // seconds
const CIRCUIT_BREAKER_THRESHOLD = 3; // failures before opening circuit
const CIRCUIT_BREAKER_RESET_TIME = 60000; // 1 minute

export class ReadReplicaRouterImpl implements ReadReplicaRouter {
    private primaryPool: ConnectionPoolManagerImpl;
    private replicas: Map<string, ReplicaState> = new Map();
    private stats: RoutingStats = {
        primaryQueries: 0,
        replicaQueries: 0,
        failoverCount: 0,
        avgReplicationLag: 0,
    };
    private lagCheckInterval: NodeJS.Timeout | null = null;

    constructor(
        primaryConnectionString: string,
        replicaConfigs: ReplicaConfig[] = []
    ) {
        // Initialize primary pool
        this.primaryPool = new ConnectionPoolManagerImpl(primaryConnectionString);

        // Initialize replica pools
        for (const config of replicaConfigs) {
            const pool = new ConnectionPoolManagerImpl(config.connectionString);
            this.replicas.set(config.id, {
                id: config.id,
                pool,
                healthy: true,
                lagSeconds: 0,
                lastCheck: new Date(),
                failureCount: 0,
                circuitBreakerOpen: false,
            });
        }

        // Start replication lag monitoring
        if (this.replicas.size > 0) {
            this.startLagMonitoring();
        }
    }

    /**
     * Detect query type from SQL statement
     */
    private detectQueryType(sql: string): 'read' | 'write' {
        const normalizedSql = sql.trim().toUpperCase();

        // Write operations
        if (
            normalizedSql.startsWith('INSERT') ||
            normalizedSql.startsWith('UPDATE') ||
            normalizedSql.startsWith('DELETE') ||
            normalizedSql.startsWith('CREATE') ||
            normalizedSql.startsWith('ALTER') ||
            normalizedSql.startsWith('DROP') ||
            normalizedSql.startsWith('TRUNCATE')
        ) {
            return 'write';
        }

        // Read operations (SELECT, WITH for CTEs that are read-only)
        return 'read';
    }

    /**
     * Select the best available replica based on health and lag
     */
    private selectReplica(): ReplicaState | null {
        const healthyReplicas = Array.from(this.replicas.values()).filter(
            (replica) =>
                replica.healthy &&
                !replica.circuitBreakerOpen &&
                replica.lagSeconds < LAG_FAILOVER_THRESHOLD
        );

        if (healthyReplicas.length === 0) {
            return null;
        }

        // Sort by lag (ascending) to get the least lagged replica
        healthyReplicas.sort((a, b) => a.lagSeconds - b.lagSeconds);

        return healthyReplicas[0];
    }

    /**
     * Route query to appropriate database
     */
    async route(query: Query): Promise<pg.Pool> {
        // Auto-detect query type if not provided
        const queryType = query.type || this.detectQueryType(query.sql);

        // All write operations go to primary
        if (queryType === 'write') {
            this.stats.primaryQueries++;
            return this.primaryPool.getPool();
        }

        // For read operations, try to use a replica
        const replica = this.selectReplica();

        if (replica) {
            this.stats.replicaQueries++;
            return replica.pool.getPool();
        }

        // Failover to primary if no healthy replica available
        this.stats.primaryQueries++;
        this.stats.failoverCount++;

        if (this.replicas.size > 0) {
            console.warn('No healthy replicas available, routing read query to primary');
        }

        return this.primaryPool.getPool();
    }

    /**
     * Check replication lag for all replicas
     */
    async checkReplicationLag(): Promise<ReplicationStatus[]> {
        const statuses: ReplicationStatus[] = [];

        // Query primary for replication status
        try {
            const client = await this.primaryPool.getPool().connect();
            try {
                const result = await client.query(`
                    SELECT 
                        application_name as replica_id,
                        EXTRACT(EPOCH FROM (NOW() - pg_last_xact_replay_timestamp())) as lag_seconds,
                        state,
                        sync_state
                    FROM pg_stat_replication
                `);

                // Update replica states based on primary's view
                for (const row of result.rows) {
                    const replicaId = row.replica_id;
                    const lagSeconds = parseFloat(row.lag_seconds) || 0;
                    const replica = this.replicas.get(replicaId);

                    if (replica) {
                        replica.lagSeconds = lagSeconds;
                        replica.lastCheck = new Date();

                        // Log warning if lag exceeds threshold
                        if (lagSeconds > LAG_WARNING_THRESHOLD) {
                            console.warn(
                                `Replication lag warning for ${replicaId}: ${lagSeconds.toFixed(2)}s`
                            );
                        }

                        // Mark as unhealthy if lag is too high
                        if (lagSeconds > LAG_FAILOVER_THRESHOLD) {
                            replica.healthy = false;
                            console.error(
                                `Replica ${replicaId} marked unhealthy due to high lag: ${lagSeconds.toFixed(2)}s`
                            );
                        } else {
                            replica.healthy = true;
                        }

                        statuses.push({
                            replicaId,
                            lagSeconds,
                            healthy: replica.healthy && !replica.circuitBreakerOpen,
                            lastCheck: replica.lastCheck,
                        });
                    }
                }
            } finally {
                client.release();
            }
        } catch (error) {
            console.error('Failed to check replication lag:', error);
        }

        // For replicas not in pg_stat_replication, perform direct health check
        for (const [replicaId, replica] of this.replicas.entries()) {
            if (!statuses.find((s) => s.replicaId === replicaId)) {
                try {
                    const client = await replica.pool.getPool().connect();
                    try {
                        // Check if replica is in recovery mode
                        const result = await client.query('SELECT pg_is_in_recovery()');
                        const isReplica = result.rows[0].pg_is_in_recovery;

                        if (isReplica) {
                            // Get lag from replica's perspective
                            const lagResult = await client.query(`
                                SELECT EXTRACT(EPOCH FROM (NOW() - pg_last_xact_replay_timestamp())) as lag_seconds
                            `);
                            const lagSeconds = parseFloat(lagResult.rows[0].lag_seconds) || 0;

                            replica.lagSeconds = lagSeconds;
                            replica.lastCheck = new Date();
                            replica.healthy = lagSeconds < LAG_FAILOVER_THRESHOLD;
                            replica.failureCount = 0;

                            statuses.push({
                                replicaId,
                                lagSeconds,
                                healthy: replica.healthy && !replica.circuitBreakerOpen,
                                lastCheck: replica.lastCheck,
                            });
                        }
                    } finally {
                        client.release();
                    }
                } catch (error) {
                    console.error(`Failed to check replica ${replicaId}:`, error);
                    replica.failureCount++;

                    // Open circuit breaker if too many failures
                    if (replica.failureCount >= CIRCUIT_BREAKER_THRESHOLD) {
                        replica.circuitBreakerOpen = true;
                        replica.healthy = false;
                        console.error(
                            `Circuit breaker opened for replica ${replicaId} after ${replica.failureCount} failures`
                        );

                        // Schedule circuit breaker reset
                        setTimeout(() => {
                            replica.circuitBreakerOpen = false;
                            replica.failureCount = 0;
                            console.log(`Circuit breaker reset for replica ${replicaId}`);
                        }, CIRCUIT_BREAKER_RESET_TIME);
                    }

                    statuses.push({
                        replicaId,
                        lagSeconds: -1,
                        healthy: false,
                        lastCheck: new Date(),
                    });
                }
            }
        }

        // Update average replication lag
        const healthyLags = statuses
            .filter((s) => s.healthy && s.lagSeconds >= 0)
            .map((s) => s.lagSeconds);

        if (healthyLags.length > 0) {
            this.stats.avgReplicationLag =
                healthyLags.reduce((sum, lag) => sum + lag, 0) / healthyLags.length;
        }

        return statuses;
    }

    /**
     * Mark a replica as unhealthy
     */
    async markUnhealthy(replicaId: string): Promise<void> {
        const replica = this.replicas.get(replicaId);
        if (replica) {
            replica.healthy = false;
            replica.failureCount++;
            console.warn(`Replica ${replicaId} marked as unhealthy`);

            // Open circuit breaker if threshold reached
            if (replica.failureCount >= CIRCUIT_BREAKER_THRESHOLD) {
                replica.circuitBreakerOpen = true;
                console.error(
                    `Circuit breaker opened for replica ${replicaId} after ${replica.failureCount} failures`
                );

                // Schedule circuit breaker reset
                setTimeout(() => {
                    replica.circuitBreakerOpen = false;
                    replica.failureCount = 0;
                    console.log(`Circuit breaker reset for replica ${replicaId}`);
                }, CIRCUIT_BREAKER_RESET_TIME);
            }
        }
    }

    /**
     * Get routing statistics
     */
    async getRoutingStats(): Promise<RoutingStats> {
        return { ...this.stats };
    }

    /**
     * Start periodic replication lag monitoring
     */
    private startLagMonitoring(): void {
        // Check lag every 30 seconds
        this.lagCheckInterval = setInterval(async () => {
            try {
                await this.checkReplicationLag();
            } catch (error) {
                console.error('Lag monitoring error:', error);
            }
        }, 30000);
    }

    /**
     * Stop lag monitoring and cleanup
     */
    async shutdown(): Promise<void> {
        if (this.lagCheckInterval) {
            clearInterval(this.lagCheckInterval);
            this.lagCheckInterval = null;
        }

        // Drain all pools
        await this.primaryPool.drain();
        for (const replica of this.replicas.values()) {
            await replica.pool.drain();
        }
    }
}

/**
 * Create a singleton instance of the read replica router
 */
let routerInstance: ReadReplicaRouterImpl | null = null;

export function getReadReplicaRouter(): ReadReplicaRouterImpl {
    if (!routerInstance) {
        const primaryConnectionString = process.env.DATABASE_URL;
        if (!primaryConnectionString) {
            throw new Error('DATABASE_URL environment variable is not set');
        }

        // Parse replica connection strings from environment
        const replicaConfigs: ReplicaConfig[] = [];
        const replicaUrls = process.env.DATABASE_REPLICA_URLS?.split(',') || [];

        replicaUrls.forEach((url, index) => {
            if (url.trim()) {
                replicaConfigs.push({
                    id: `replica-${index + 1}`,
                    connectionString: url.trim(),
                    priority: index,
                });
            }
        });

        routerInstance = new ReadReplicaRouterImpl(
            primaryConnectionString,
            replicaConfigs
        );
    }

    return routerInstance;
}

/**
 * Shutdown the read replica router
 */
export async function shutdownReadReplicaRouter(): Promise<void> {
    if (routerInstance) {
        await routerInstance.shutdown();
        routerInstance = null;
    }
}
