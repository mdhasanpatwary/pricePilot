/**
 * Connection Pool Manager
 * 
 * Manages database connection pooling with health monitoring, metrics tracking,
 * and automatic connection lifecycle management.
 * 
 * Features:
 * - Configurable min/max connection limits
 * - Connection health checks
 * - Utilization monitoring and warnings
 * - Connection lifetime enforcement
 * - Exponential backoff retry logic
 * - Graceful shutdown support
 */

import pg from 'pg';
import {
    ConnectionPoolManager,
    PoolConfig,
    PoolStats,
    HealthStatus,
} from '@/lib/types/database-optimization';

const DEFAULT_POOL_CONFIG: PoolConfig = {
    min: 10,
    max: 50,
    idleTimeoutMillis: 60000, // 1 minute
    connectionTimeoutMillis: 30000, // 30 seconds
    maxLifetimeMillis: 1800000, // 30 minutes
    healthCheckIntervalMillis: 30000, // 30 seconds
};

export class ConnectionPoolManagerImpl implements ConnectionPoolManager {
    private pool: pg.Pool;
    private config: PoolConfig;
    private healthCheckInterval: NodeJS.Timeout | null = null;
    private connectionCreationTimes: Map<pg.PoolClient, number> = new Map();

    constructor(connectionString: string, config: Partial<PoolConfig> = {}) {
        this.config = { ...DEFAULT_POOL_CONFIG, ...config };

        this.pool = new pg.Pool({
            connectionString,
            min: this.config.min,
            max: this.config.max,
            idleTimeoutMillis: this.config.idleTimeoutMillis,
            connectionTimeoutMillis: this.config.connectionTimeoutMillis,
            // Enable keep-alive to detect dead connections
            keepAlive: true,
            keepAliveInitialDelayMillis: 10000,
        });

        this.setupEventHandlers();
        this.startHealthChecks();
    }

    /**
     * Set up event handlers for pool monitoring
     */
    private setupEventHandlers(): void {
        this.pool.on('connect', (client) => {
            this.connectionCreationTimes.set(client, Date.now());
        });

        this.pool.on('remove', (client) => {
            this.connectionCreationTimes.delete(client);
        });

        this.pool.on('error', (err, client) => {
            console.error('Unexpected pool error:', err);
            // Remove the client from tracking
            if (client) {
                this.connectionCreationTimes.delete(client);
            }
        });

        this.pool.on('acquire', () => {
            // Check utilization on each acquisition
            const stats = this.getPoolStats();
            if (stats.utilizationPercent > 80) {
                console.warn(
                    `High connection pool utilization: ${stats.utilizationPercent.toFixed(1)}%`,
                    {
                        total: stats.totalConnections,
                        active: stats.activeConnections,
                        idle: stats.idleConnections,
                        waiting: stats.waitingRequests,
                    }
                );
            }
        });
    }

    /**
     * Start periodic health checks
     */
    private startHealthChecks(): void {
        this.healthCheckInterval = setInterval(
            () => this.performHealthCheck(),
            this.config.healthCheckIntervalMillis
        );
    }

    /**
     * Perform health check on connections
     */
    private async performHealthCheck(): Promise<void> {
        try {
            const client = await this.pool.connect();
            try {
                // Simple health check query
                await client.query('SELECT 1');

                // Check connection lifetime
                const creationTime = this.connectionCreationTimes.get(client);
                if (creationTime) {
                    const lifetime = Date.now() - creationTime;
                    if (lifetime > this.config.maxLifetimeMillis) {
                        console.log('Removing connection due to max lifetime exceeded');
                        // Release and remove the connection
                        client.release(true);
                        return;
                    }
                }
            } finally {
                client.release();
            }
        } catch (error) {
            console.error('Health check failed:', error);
            // The pool will automatically handle connection replacement
        }
    }

    /**
     * Get the underlying connection pool
     */
    getPool(): pg.Pool {
        return this.pool;
    }

    /**
     * Get current pool statistics
     */
    getPoolStats(): PoolStats {
        const totalConnections = this.pool.totalCount;
        const idleConnections = this.pool.idleCount;
        const waitingRequests = this.pool.waitingCount;
        const activeConnections = totalConnections - idleConnections;
        const utilizationPercent = (totalConnections / this.config.max) * 100;

        return {
            totalConnections,
            idleConnections,
            activeConnections,
            waitingRequests,
            utilizationPercent,
        };
    }

    /**
     * Perform health check on the database
     */
    async healthCheck(): Promise<HealthStatus> {
        const startTime = Date.now();

        try {
            const client = await this.pool.connect();
            try {
                await client.query('SELECT 1');
                const responseTime = Date.now() - startTime;

                return {
                    healthy: true,
                    primaryReachable: true,
                    replicasReachable: 0, // Will be implemented with read replica router
                    avgResponseTime: responseTime,
                };
            } finally {
                client.release();
            }
        } catch (error) {
            console.error('Health check failed:', error);
            return {
                healthy: false,
                primaryReachable: false,
                replicasReachable: 0,
                avgResponseTime: Date.now() - startTime,
            };
        }
    }

    /**
     * Drain the pool for graceful shutdown
     */
    async drain(): Promise<void> {
        if (this.healthCheckInterval) {
            clearInterval(this.healthCheckInterval);
            this.healthCheckInterval = null;
        }

        await this.pool.end();
        this.connectionCreationTimes.clear();
    }

    /**
     * Execute a query with automatic retry and exponential backoff
     */
    async executeWithRetry<T>(
        queryFn: (client: pg.PoolClient) => Promise<T>,
        maxRetries: number = 5
    ): Promise<T> {
        let lastError: Error | null = null;

        for (let attempt = 0; attempt < maxRetries; attempt++) {
            try {
                const client = await this.pool.connect();
                try {
                    return await queryFn(client);
                } finally {
                    client.release();
                }
            } catch (error) {
                lastError = error as Error;

                if (attempt < maxRetries - 1) {
                    // Exponential backoff: 100ms, 200ms, 400ms, 800ms, 1600ms
                    const delayMs = 100 * Math.pow(2, attempt);
                    console.warn(
                        `Query attempt ${attempt + 1} failed, retrying in ${delayMs}ms:`,
                        error
                    );
                    await new Promise(resolve => setTimeout(resolve, delayMs));
                }
            }
        }

        throw new Error(
            `Query failed after ${maxRetries} attempts: ${lastError?.message}`
        );
    }
}

/**
 * Create a singleton instance of the connection pool manager
 */
let poolManager: ConnectionPoolManagerImpl | null = null;

export function getConnectionPoolManager(): ConnectionPoolManagerImpl {
    if (!poolManager) {
        const connectionString = process.env.DATABASE_URL;
        if (!connectionString) {
            throw new Error('DATABASE_URL environment variable is not set');
        }

        poolManager = new ConnectionPoolManagerImpl(connectionString, {
            min: parseInt(process.env.DB_POOL_MIN || '10'),
            max: parseInt(process.env.DB_POOL_MAX || '50'),
        });
    }

    return poolManager;
}

/**
 * Shutdown the connection pool manager
 */
export async function shutdownConnectionPoolManager(): Promise<void> {
    if (poolManager) {
        await poolManager.drain();
        poolManager = null;
    }
}
