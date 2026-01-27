import { logger } from "../logger";

/**
 * Configuration options for RetryStrategy
 */
export interface RetryOptions {
    maxRetries: number; // Default: 3
    initialDelay: number; // Default: 1000ms
    maxDelay: number; // Default: 30000ms
    backoffMultiplier: number; // Default: 2
    jitter: boolean; // Default: true
}

/**
 * Context information tracked across retry attempts
 */
export interface RetryContext {
    attempt: number;
    previousProxy?: string;
    previousUserAgent?: string;
    lastError?: Error;
    startTime: number;
}

/**
 * RetryStrategy implements intelligent retry logic with exponential backoff
 * 
 * Features:
 * - Exponential backoff with configurable multiplier
 * - Jitter to randomize delays and prevent thundering herd
 * - Max delay cap to prevent excessive wait times
 * - Retry context tracking for proxy/user agent rotation
 * - Error classification for retry decisions
 */
export class RetryStrategy {
    private options: Required<RetryOptions>;

    constructor(options?: Partial<RetryOptions>) {
        this.options = {
            maxRetries: options?.maxRetries ?? 3,
            initialDelay: options?.initialDelay ?? 1000,
            maxDelay: options?.maxDelay ?? 30000,
            backoffMultiplier: options?.backoffMultiplier ?? 2,
            jitter: options?.jitter ?? true,
        };

        logger.info('[RetryStrategy] Initialized with options:', this.options);
    }

    /**
     * Calculate delay for a given retry attempt using exponential backoff
     * 
     * Formula: delay = min(initialDelay * (backoffMultiplier ^ (attempt - 1)), maxDelay)
     * With jitter: delay = delay * (0.5 + random(0, 0.5))
     * 
     * @param attempt - The retry attempt number (1-based)
     * @returns Delay in milliseconds
     */
    calculateDelay(attempt: number): number {
        if (attempt < 1) {
            throw new Error('Attempt number must be >= 1');
        }

        // Calculate base delay with exponential backoff
        const baseDelay = this.options.initialDelay * Math.pow(this.options.backoffMultiplier, attempt - 1);

        // Apply max delay cap
        const cappedDelay = Math.min(baseDelay, this.options.maxDelay);

        // Apply jitter if enabled
        if (this.options.jitter) {
            // Jitter adds randomness between 50% and 100% of the delay
            const jitterFactor = 0.5 + Math.random() * 0.5;
            return Math.floor(cappedDelay * jitterFactor);
        }

        return cappedDelay;
    }

    /**
     * Execute an operation with retry logic
     * 
     * @param operation - The operation to execute, receives retry context
     * @param shouldRetry - Function to determine if error should trigger retry
     * @returns Result of the operation
     * @throws Last error if all retries exhausted
     */
    async executeWithRetry<T>(
        operation: (context: RetryContext) => Promise<T>,
        shouldRetry: (error: Error, context: RetryContext) => boolean
    ): Promise<T> {
        const startTime = Date.now();
        let lastError: Error | undefined;

        for (let attempt = 1; attempt <= this.options.maxRetries + 1; attempt++) {
            const context: RetryContext = {
                attempt,
                startTime,
                lastError,
            };

            try {
                logger.info(`[RetryStrategy] Attempt ${attempt}/${this.options.maxRetries + 1}`);
                const result = await operation(context);

                if (attempt > 1) {
                    logger.info(`[RetryStrategy] ✅ Succeeded on attempt ${attempt}`);
                }

                return result;
            } catch (error) {
                lastError = error as Error;

                // Check if we should retry
                const isLastAttempt = attempt > this.options.maxRetries;
                const shouldRetryError = shouldRetry(lastError, context);

                if (isLastAttempt || !shouldRetryError) {
                    logger.error(
                        `[RetryStrategy] ❌ Failed after ${attempt} attempts. Error: ${lastError.message}`
                    );
                    throw lastError;
                }

                // Calculate delay for next retry
                const delay = this.calculateDelay(attempt);
                logger.warn(
                    `[RetryStrategy] ⚠️ Attempt ${attempt} failed: ${lastError.message}. Retrying in ${delay}ms...`
                );

                // Wait before next retry
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }

        // This should never be reached, but TypeScript needs it
        throw lastError || new Error('Retry failed with unknown error');
    }

    /**
     * Determine if an error should trigger a retry
     * 
     * Retryable errors:
     * - Network errors (ECONNRESET, ETIMEDOUT, ENOTFOUND)
     * - HTTP 429 (Rate Limit)
     * - HTTP 503 (Service Unavailable)
     * - HTTP 408 (Request Timeout)
     * - Scrape block errors (Cloudflare, etc.)
     * 
     * Non-retryable errors:
     * - HTTP 404 (Not Found)
     * - HTTP 400 (Bad Request)
     * - HTTP 401/403 (Authentication/Authorization - unless it's a block)
     * 
     * @param error - The error to classify
     * @returns true if error should trigger retry
     */
    shouldRetryError(error: Error): boolean {
        const errorMessage = error.message.toLowerCase();
        const errorName = error.name.toLowerCase();

        // Network errors - always retry
        const networkErrors = ['econnreset', 'etimedout', 'enotfound', 'econnrefused', 'enetunreach'];
        if (networkErrors.some(code => errorMessage.includes(code) || errorName.includes(code))) {
            logger.info(`[RetryStrategy] Network error detected: ${error.message} - will retry`);
            return true;
        }

        // Timeout errors - always retry
        if (errorMessage.includes('timeout') || errorMessage.includes('timed out')) {
            logger.info(`[RetryStrategy] Timeout error detected - will retry`);
            return true;
        }

        // HTTP status code errors
        if (errorMessage.includes('429') || errorMessage.includes('rate limit')) {
            logger.info(`[RetryStrategy] Rate limit error detected - will retry`);
            return true;
        }

        if (errorMessage.includes('503') || errorMessage.includes('service unavailable')) {
            logger.info(`[RetryStrategy] Service unavailable error detected - will retry`);
            return true;
        }

        if (errorMessage.includes('408') || errorMessage.includes('request timeout')) {
            logger.info(`[RetryStrategy] Request timeout error detected - will retry`);
            return true;
        }

        // Scrape block errors - always retry
        if (errorName.includes('scrapeblock') || errorMessage.includes('blocked')) {
            logger.info(`[RetryStrategy] Scrape block error detected - will retry`);
            return true;
        }

        // Cloudflare/security challenges - retry
        if (errorMessage.includes('cloudflare') || errorMessage.includes('challenge')) {
            logger.info(`[RetryStrategy] Security challenge detected - will retry`);
            return true;
        }

        // Non-retryable errors
        const nonRetryablePatterns = [
            '404', 'not found',
            '400', 'bad request',
            '401', 'unauthorized',
            '422', 'unprocessable'
        ];

        if (nonRetryablePatterns.some(pattern => errorMessage.includes(pattern))) {
            logger.info(`[RetryStrategy] Non-retryable error detected: ${error.message} - will not retry`);
            return false;
        }

        // Default: retry for unknown errors
        logger.info(`[RetryStrategy] Unknown error type: ${error.message} - will retry`);
        return true;
    }

    /**
     * Get current retry options
     */
    getOptions(): Required<RetryOptions> {
        return { ...this.options };
    }
}
