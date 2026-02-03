/**
 * Retry Utility for Transient Failures
 * 
 * Provides configurable retry logic with exponential backoff for handling
 * transient failures in external API calls and network operations.
 * 
 * Features:
 * - Exponential backoff with jitter
 * - Configurable max retries and initial delay
 * - Selective retry based on error type
 * - Comprehensive logging of retry attempts
 * - Support for custom retry conditions
 */

import { logger } from '../logger';
import axios from 'axios';

/**
 * Configuration options for retry behavior
 */
export interface RetryOptions {
    /**
     * Maximum number of retry attempts
     * @default 3
     */
    maxRetries?: number;

    /**
     * Initial backoff delay in milliseconds
     * @default 1000
     */
    initialBackoff?: number;

    /**
     * Maximum backoff delay in milliseconds
     * @default 30000 (30 seconds)
     */
    maxBackoff?: number;

    /**
     * Backoff multiplier for exponential backoff
     * @default 2
     */
    backoffMultiplier?: number;

    /**
     * Add random jitter to backoff delay (0-1)
     * Helps prevent thundering herd problem
     * @default 0.1 (10% jitter)
     */
    jitter?: number;

    /**
     * Custom function to determine if error should be retried
     * @param error The error that occurred
     * @param attempt Current attempt number (1-indexed)
     * @returns true if should retry, false otherwise
     */
    shouldRetry?: (error: any, attempt: number) => boolean;

    /**
     * Operation name for logging purposes
     */
    operationName?: string;

    /**
     * Additional context for logging
     */
    context?: Record<string, any>;

    /**
     * Callback invoked before each retry attempt
     * @param error The error that occurred
     * @param attempt Current attempt number (1-indexed)
     * @param delay Delay before next retry in milliseconds
     */
    onRetry?: (error: any, attempt: number, delay: number) => void | Promise<void>;
}

/**
 * Default retry configuration
 */
const DEFAULT_OPTIONS: Required<Omit<RetryOptions, 'shouldRetry' | 'operationName' | 'context' | 'onRetry'>> = {
    maxRetries: 3,
    initialBackoff: 1000,
    maxBackoff: 30000,
    backoffMultiplier: 2,
    jitter: 0.1,
};

/**
 * Default retry condition for HTTP errors
 * Retries on:
 * - Network errors (no response)
 * - Server errors (5xx)
 * - Rate limiting (429)
 * - Request timeout (408)
 * - Connection errors (ECONNREFUSED, ETIMEDOUT, ENOTFOUND)
 */
export function isRetryableHttpError(error: any): boolean {
    // Axios errors
    if (axios.isAxiosError(error)) {
        const status = error.response?.status;

        // No response = network error, should retry
        if (!status) {
            return true;
        }

        // Retry on server errors, rate limits, and timeouts
        if (status >= 500 || status === 429 || status === 408) {
            return true;
        }

        // Don't retry client errors (4xx) except those above
        return false;
    }

    // Network errors
    if (error.code === 'ECONNREFUSED' ||
        error.code === 'ETIMEDOUT' ||
        error.code === 'ENOTFOUND' ||
        error.code === 'ECONNRESET' ||
        error.code === 'EPIPE') {
        return true;
    }

    // Default: don't retry unknown errors
    return false;
}

/**
 * Calculate backoff delay with exponential backoff and jitter
 */
function calculateBackoff(
    attempt: number,
    initialBackoff: number,
    maxBackoff: number,
    multiplier: number,
    jitter: number
): number {
    // Exponential backoff: initialBackoff * (multiplier ^ attempt)
    const exponentialDelay = initialBackoff * Math.pow(multiplier, attempt - 1);

    // Cap at max backoff
    const cappedDelay = Math.min(exponentialDelay, maxBackoff);

    // Add jitter to prevent thundering herd
    const jitterAmount = cappedDelay * jitter;
    const jitterOffset = (Math.random() * 2 - 1) * jitterAmount;

    return Math.max(0, Math.floor(cappedDelay + jitterOffset));
}

/**
 * Execute an async operation with retry logic
 * 
 * @param operation The async operation to execute
 * @param options Retry configuration options
 * @returns Promise resolving to the operation result
 * @throws The last error if all retries are exhausted
 * 
 * @example
 * ```typescript
 * const result = await withRetry(
 *   async () => {
 *     return await axios.get('https://api.example.com/data');
 *   },
 *   {
 *     maxRetries: 3,
 *     operationName: 'fetchData',
 *     context: { url: 'https://api.example.com/data' }
 *   }
 * );
 * ```
 */
export async function withRetry<T>(
    operation: () => Promise<T>,
    options: RetryOptions = {}
): Promise<T> {
    const config = {
        ...DEFAULT_OPTIONS,
        ...options,
    };

    const shouldRetry = options.shouldRetry || isRetryableHttpError;
    let lastError: any;

    for (let attempt = 1; attempt <= config.maxRetries; attempt++) {
        try {
            // Execute the operation
            const result = await operation();

            // Success - log if this was a retry
            if (attempt > 1) {
                logger.info('Operation succeeded after retry', {
                    operationName: config.operationName,
                    attempt,
                    totalAttempts: config.maxRetries,
                    context: config.context,
                });
            }

            return result;
        } catch (error) {
            lastError = error;

            // Check if we should retry this error
            const canRetry = shouldRetry(error, attempt);
            const isLastAttempt = attempt === config.maxRetries;

            // If this is the last attempt or error is not retryable, throw
            if (isLastAttempt || !canRetry) {
                logger.error('Operation failed after retries', {
                    operationName: config.operationName,
                    attempt,
                    totalAttempts: config.maxRetries,
                    canRetry,
                    error: error instanceof Error ? {
                        message: error.message,
                        name: error.name,
                        stack: error.stack,
                    } : error,
                    context: config.context,
                });
                throw error;
            }

            // Calculate backoff delay
            const delay = calculateBackoff(
                attempt,
                config.initialBackoff,
                config.maxBackoff,
                config.backoffMultiplier,
                config.jitter
            );

            // Log retry attempt
            logger.warn('Operation failed, retrying', {
                operationName: config.operationName,
                attempt,
                totalAttempts: config.maxRetries,
                nextRetryIn: `${delay}ms`,
                error: error instanceof Error ? {
                    message: error.message,
                    name: error.name,
                } : error,
                context: config.context,
            });

            // Call onRetry callback if provided
            if (options.onRetry) {
                try {
                    await options.onRetry(error, attempt, delay);
                } catch (callbackError) {
                    logger.error('onRetry callback failed', {
                        operationName: config.operationName,
                        callbackError,
                    });
                }
            }

            // Wait before retrying
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }

    // This should never be reached, but TypeScript needs it
    throw lastError;
}

/**
 * Retry configuration presets for common scenarios
 */
export const RetryPresets = {
    /**
     * Fast retry for quick operations (3 retries, 500ms initial backoff)
     */
    FAST: {
        maxRetries: 3,
        initialBackoff: 500,
        maxBackoff: 5000,
    } as RetryOptions,

    /**
     * Standard retry for most operations (3 retries, 1s initial backoff)
     */
    STANDARD: {
        maxRetries: 3,
        initialBackoff: 1000,
        maxBackoff: 10000,
    } as RetryOptions,

    /**
     * Aggressive retry for critical operations (5 retries, 2s initial backoff)
     */
    AGGRESSIVE: {
        maxRetries: 5,
        initialBackoff: 2000,
        maxBackoff: 30000,
    } as RetryOptions,

    /**
     * Conservative retry for rate-limited APIs (3 retries, 5s initial backoff)
     */
    CONSERVATIVE: {
        maxRetries: 3,
        initialBackoff: 5000,
        maxBackoff: 60000,
    } as RetryOptions,
};

/**
 * Helper to create a retry wrapper for a specific operation type
 * 
 * @example
 * ```typescript
 * const retryableAxios = createRetryWrapper({
 *   maxRetries: 3,
 *   operationName: 'HTTP Request',
 * });
 * 
 * const response = await retryableAxios(() => 
 *   axios.get('https://api.example.com/data')
 * );
 * ```
 */
export function createRetryWrapper(defaultOptions: RetryOptions) {
    return async function <T>(
        operation: () => Promise<T>,
        overrideOptions?: RetryOptions
    ): Promise<T> {
        return withRetry(operation, {
            ...defaultOptions,
            ...overrideOptions,
        });
    };
}
