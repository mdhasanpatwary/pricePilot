/**
 * Replica-Aware Prisma Client
 * 
 * Extends the optimized Prisma client with read replica routing capabilities.
 * Automatically routes read queries to replicas and write queries to primary.
 * 
 * Requirements: 9.1, 9.2, 9.3, 9.4, 9.5
 */

import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { ReadReplicaRouterImpl } from '@/lib/services/read-replica-router';
import { applyQueryTimingMiddleware } from '@/lib/middleware/query-timing';

const globalForReplicaPrisma = global as unknown as {
    replicaAwarePrisma: PrismaClient;
    replicaRouter: ReadReplicaRouterImpl;
};

/**
 * Get replica configuration from environment
 */
function getReplicaConfig() {
    const replicas = [];

    // Support multiple replicas via environment variables
    // READ_REPLICA_1_URL, READ_REPLICA_2_URL, etc.
    let replicaIndex = 1;
    while (process.env[`READ_REPLICA_${replicaIndex}_URL`]) {
        replicas.push({
            id: `replica-${replicaIndex}`,
            connectionString: process.env[`READ_REPLICA_${replicaIndex}_URL`]!,
            priority: replicaIndex,
        });
        replicaIndex++;
    }

    return replicas;
}

/**
 * Get or create the replica-aware Prisma client instance
 */
export function getReplicaAwarePrisma(): PrismaClient {
    if (!globalForReplicaPrisma.replicaAwarePrisma) {
        const primaryUrl = process.env.DATABASE_URL!;
        const replicaConfigs = getReplicaConfig();

        // Initialize replica router if replicas are configured
        if (replicaConfigs.length > 0) {
            console.log(`[ReplicaAwarePrisma] Initializing with ${replicaConfigs.length} replica(s)`);

            globalForReplicaPrisma.replicaRouter = new ReadReplicaRouterImpl(
                primaryUrl,
                replicaConfigs
            );

            // Use the router's primary pool for the adapter
            const pool = globalForReplicaPrisma.replicaRouter.getPool();
            const adapter = new PrismaPg(pool);

            globalForReplicaPrisma.replicaAwarePrisma = new PrismaClient({
                adapter,
                log: process.env.NODE_ENV === 'production'
                    ? ['error', 'warn']
                    : ['query', 'error', 'warn'],
                errorFormat: 'pretty',
            });
        } else {
            console.log('[ReplicaAwarePrisma] No replicas configured, using primary only');

            // Fall back to standard optimized Prisma if no replicas
            const { getOptimizedPrisma } = require('./optimized-prisma');
            globalForReplicaPrisma.replicaAwarePrisma = getOptimizedPrisma();
        }

        // Apply query timing middleware
        applyQueryTimingMiddleware(globalForReplicaPrisma.replicaAwarePrisma);
    }

    return globalForReplicaPrisma.replicaAwarePrisma;
}

/**
 * Get the replica router instance (if configured)
 */
export function getReplicaRouter(): ReadReplicaRouterImpl | null {
    return globalForReplicaPrisma.replicaRouter || null;
}

/**
 * Export the replica-aware Prisma client
 */
export const replicaAwarePrisma = getReplicaAwarePrisma();

/**
 * Graceful shutdown handler
 */
export async function disconnectReplicaAwarePrisma(): Promise<void> {
    if (globalForReplicaPrisma.replicaAwarePrisma) {
        await globalForReplicaPrisma.replicaAwarePrisma.$disconnect();
    }

    if (globalForReplicaPrisma.replicaRouter) {
        await globalForReplicaPrisma.replicaRouter.shutdown();
    }
}

/**
 * Get replication status (if replicas are configured)
 */
export async function getReplicationStatus(): Promise<any[]> {
    const router = getReplicaRouter();
    if (!router) {
        return [];
    }

    return router.checkReplicationLag();
}

/**
 * Get routing statistics (if replicas are configured)
 */
export async function getRoutingStats(): Promise<any> {
    const router = getReplicaRouter();
    if (!router) {
        return {
            primaryQueries: 0,
            replicaQueries: 0,
            failoverCount: 0,
            avgReplicationLag: 0,
            replicasConfigured: false,
        };
    }

    const stats = router.getRoutingStats();
    return {
        ...stats,
        replicasConfigured: true,
    };
}
