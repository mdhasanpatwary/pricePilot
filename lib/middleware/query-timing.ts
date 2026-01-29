/**
 * Query Timing Middleware
 * 
 * Captures query execution times and logs slow queries automatically.
 * Integrates with QueryAnalyzer for performance monitoring.
 * 
 * Requirements: 1.1, 1.2
 */

import { Prisma, PrismaClient } from '@prisma/client';
import { getQueryAnalyzer } from '@/lib/services/query-analyzer';
import { SLOW_QUERY_THRESHOLD_MS } from '@/lib/database/optimization-constants';

/**
 * Query timing middleware for Prisma
 * Captures execution time and logs slow queries
 */
export function createQueryTimingMiddleware(prisma: PrismaClient): Prisma.Middleware {
    const queryAnalyzer = getQueryAnalyzer(prisma);

    return async (params, next) => {
        const startTime = Date.now();

        try {
            const result = await next(params);
            const executionTime = Date.now() - startTime;

            // Log slow queries
            if (executionTime >= SLOW_QUERY_THRESHOLD_MS) {
                // Extract tenant ID from params if available
                let tenantId: string | undefined;
                if (params.args?.where?.tenantId) {
                    tenantId = params.args.where.tenantId;
                } else if (params.args?.data?.tenantId) {
                    tenantId = params.args.data.tenantId;
                }

                // Build query representation
                const query = `${params.model}.${params.action}`;

                // Log the slow query asynchronously (don't block the response)
                queryAnalyzer.logSlowQuery({
                    query,
                    params: params.args || {},
                    executionTime,
                    affectedRows: Array.isArray(result) ? result.length : 1,
                    tenantId: tenantId || 'unknown',
                    timestamp: new Date(startTime),
                    executionPlan: '', // Will be populated by analyzer if needed
                }).catch(error => {
                    console.error('Failed to log slow query:', error);
                });
            }

            return result;
        } catch (error) {
            const executionTime = Date.now() - startTime;

            // Log failed queries that took long time
            if (executionTime >= SLOW_QUERY_THRESHOLD_MS) {
                console.warn(`Slow query failed after ${executionTime}ms:`, {
                    model: params.model,
                    action: params.action,
                    error: error instanceof Error ? error.message : 'Unknown error',
                });
            }

            throw error;
        }
    };
}

/**
 * Apply query timing middleware to Prisma client
 */
export function applyQueryTimingMiddleware(prisma: PrismaClient): void {
    // Skip middleware in test environment if $use is not available
    if (typeof prisma.$use !== 'function') {
        console.warn('Prisma $use middleware not available, skipping query timing middleware');
        return;
    }

    const middleware = createQueryTimingMiddleware(prisma);
    prisma.$use(middleware);
}
