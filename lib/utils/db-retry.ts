/**
 * Database Retry Utility
 *
 * Provides automated retry logic for transient database failures
 * specifically tailored for Prisma and PostgreSQL.
 */

import { Prisma } from '@prisma/client';
import { logger } from '../logger';
import { DatabaseError } from './error-handler';

export interface DbRetryOptions {
    /**
     * Maximum number of retry attempts
     * @default 2
     */
    maxRetries?: number;

    /**
     * Initial delay between retries in milliseconds
     * @default 500
     */
    initialDelay?: number;

    /**
     * Operation name for logging
     */
    operationName?: string;
}

/**
 * Determine if a Prisma error is transient and should be retried
 */
export function isRetryableDbError(error: any): boolean {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
        // P1001: Can't reach database
        // P1002: Database timeout
        // P1008: Operations timeout
        // P2034: Transaction deadlock/conflict
        const retryableCodes = ['P1001', 'P1002', 'P1008', 'P2034'];
        return retryableCodes.includes(error.code);
    }

    if (error instanceof Prisma.PrismaClientInitializationError) {
        // Connection issues during initialization are often transient
        return true;
    }

    if (error instanceof Prisma.PrismaClientUnknownRequestError) {
        // Network-level drops sometimes appear as unknown errors
        return error.message.includes('broken pipe') ||
               error.message.includes('connection reset') ||
               error.message.includes('timed out');
    }

    // Generic network/connection errors from 'pg' driver
    if (error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT') {
        return true;
    }

    return false;
}

/**
 * Execute a database operation with retries for transient failures
 *
 * @param operation Function that executes a Prisma query
 * @param options Retry configuration
 */
export async function withDbRetry<T>(
    operation: () => Promise<T>,
    options: DbRetryOptions = {}
): Promise<T> {
    const maxRetries = options.maxRetries ?? 2;
    const initialDelay = options.initialDelay ?? 500;
    const operationName = options.operationName ?? 'Database Operation';

    let lastError: any;

    for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
        try {
            return await operation();
        } catch (error) {
            lastError = error;

            if (attempt > maxRetries || !isRetryableDbError(error)) {
                break;
            }

            const delay = initialDelay * Math.pow(2, attempt - 1);
            logger.warn(`[DbRetry] Transient error in ${operationName}. Attempt ${attempt}/${maxRetries}. Retrying in ${delay}ms...`, {
                errorCode: error instanceof Prisma.PrismaClientKnownRequestError ? error.code : 'unknown',
                error: error instanceof Error ? error.message : String(error)
            });

            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }

    // If we reach here, it means all retries failed or it's a non-retryable error
    const isRetryable = isRetryableDbError(lastError);

    logger.error(`[DbRetry] ${operationName} failed after ${maxRetries} retries or encountered non-retryable error.`, {
        error: lastError instanceof Error ? lastError.message : String(lastError),
        stack: lastError instanceof Error ? lastError.stack : undefined,
        isRetryable
    });

    throw new DatabaseError(`Database operation '${operationName}' failed: ${lastError instanceof Error ? lastError.message : String(lastError)}`, {
        cause: lastError instanceof Error ? lastError : undefined,
        isRetryable,
        context: {
            operation: operationName,
        }
    });
}
