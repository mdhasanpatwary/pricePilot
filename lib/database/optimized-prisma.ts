/**
 * Optimized Prisma Client with Enhanced Connection Pooling
 * 
 * This module provides an optimized Prisma client that uses the enhanced
 * connection pool manager for better performance and monitoring.
 */

import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { getConnectionPoolManager } from '@/lib/services/connection-pool-manager';
import { applyQueryTimingMiddleware } from '@/lib/middleware/query-timing';

const globalForPrisma = global as unknown as {
    optimizedPrisma: PrismaClient;
};

/**
 * Get or create the optimized Prisma client instance
 */
export function getOptimizedPrisma(): PrismaClient {
    if (!globalForPrisma.optimizedPrisma) {
        const poolManager = getConnectionPoolManager();
        const pool = poolManager.getPool();
        const adapter = new PrismaPg(pool);

        globalForPrisma.optimizedPrisma = new PrismaClient({
            adapter,
            log: process.env.NODE_ENV === 'production'
                ? ['error', 'warn']
                : ['query', 'error', 'warn'],
            errorFormat: 'pretty',
        });

        // Apply query timing middleware for slow query logging
        applyQueryTimingMiddleware(globalForPrisma.optimizedPrisma);
    }

    return globalForPrisma.optimizedPrisma;
}

/**
 * Export the optimized Prisma client
 */
export const optimizedPrisma = getOptimizedPrisma();

/**
 * Graceful shutdown handler
 */
export async function disconnectOptimizedPrisma(): Promise<void> {
    if (globalForPrisma.optimizedPrisma) {
        await globalForPrisma.optimizedPrisma.$disconnect();
    }
}
