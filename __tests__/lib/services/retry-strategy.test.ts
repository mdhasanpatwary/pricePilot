import { RetryStrategy, RetryContext } from '@/lib/services/retry-strategy';

describe('RetryStrategy', () => {
    describe('calculateDelay', () => {
        it('should calculate exponential backoff delays', () => {
            const strategy = new RetryStrategy({
                initialDelay: 1000,
                backoffMultiplier: 2,
                maxDelay: 30000,
                jitter: false, // Disable jitter for predictable testing
            });

            // Attempt 1: 1000ms
            expect(strategy.calculateDelay(1)).toBe(1000);

            // Attempt 2: 2000ms
            expect(strategy.calculateDelay(2)).toBe(2000);

            // Attempt 3: 4000ms
            expect(strategy.calculateDelay(3)).toBe(4000);

            // Attempt 4: 8000ms
            expect(strategy.calculateDelay(4)).toBe(8000);
        });

        it('should enforce max delay cap', () => {
            const strategy = new RetryStrategy({
                initialDelay: 1000,
                backoffMultiplier: 2,
                maxDelay: 5000,
                jitter: false,
            });

            // Attempt 5 would be 16000ms, but capped at 5000ms
            expect(strategy.calculateDelay(5)).toBe(5000);

            // Attempt 10 would be 512000ms, but capped at 5000ms
            expect(strategy.calculateDelay(10)).toBe(5000);
        });

        it('should apply jitter when enabled', () => {
            const strategy = new RetryStrategy({
                initialDelay: 1000,
                backoffMultiplier: 2,
                maxDelay: 30000,
                jitter: true,
            });

            const delay = strategy.calculateDelay(1);

            // With jitter, delay should be between 50% and 100% of base delay
            expect(delay).toBeGreaterThanOrEqual(500);
            expect(delay).toBeLessThanOrEqual(1000);
        });

        it('should throw error for invalid attempt number', () => {
            const strategy = new RetryStrategy();

            expect(() => strategy.calculateDelay(0)).toThrow('Attempt number must be >= 1');
            expect(() => strategy.calculateDelay(-1)).toThrow('Attempt number must be >= 1');
        });
    });

    describe('shouldRetryError', () => {
        const strategy = new RetryStrategy();

        it('should retry network errors', () => {
            expect(strategy.shouldRetryError(new Error('ECONNRESET'))).toBe(true);
            expect(strategy.shouldRetryError(new Error('ETIMEDOUT'))).toBe(true);
            expect(strategy.shouldRetryError(new Error('ENOTFOUND'))).toBe(true);
            expect(strategy.shouldRetryError(new Error('ECONNREFUSED'))).toBe(true);
        });

        it('should retry timeout errors', () => {
            expect(strategy.shouldRetryError(new Error('Request timeout'))).toBe(true);
            expect(strategy.shouldRetryError(new Error('Operation timed out'))).toBe(true);
        });

        it('should retry rate limit errors', () => {
            expect(strategy.shouldRetryError(new Error('HTTP 429'))).toBe(true);
            expect(strategy.shouldRetryError(new Error('Rate limit exceeded'))).toBe(true);
        });

        it('should retry service unavailable errors', () => {
            expect(strategy.shouldRetryError(new Error('HTTP 503'))).toBe(true);
            expect(strategy.shouldRetryError(new Error('Service unavailable'))).toBe(true);
        });

        it('should retry scrape block errors', () => {
            const error = new Error('Blocked by Cloudflare');
            error.name = 'ScrapeBlockError';
            expect(strategy.shouldRetryError(error)).toBe(true);
        });

        it('should not retry client errors', () => {
            expect(strategy.shouldRetryError(new Error('HTTP 404'))).toBe(false);
            expect(strategy.shouldRetryError(new Error('Not found'))).toBe(false);
            expect(strategy.shouldRetryError(new Error('HTTP 400'))).toBe(false);
            expect(strategy.shouldRetryError(new Error('Bad request'))).toBe(false);
            expect(strategy.shouldRetryError(new Error('HTTP 401'))).toBe(false);
            expect(strategy.shouldRetryError(new Error('Unauthorized'))).toBe(false);
        });

        it('should retry unknown errors by default', () => {
            expect(strategy.shouldRetryError(new Error('Unknown error'))).toBe(true);
        });
    });

    describe('executeWithRetry', () => {
        it('should succeed on first attempt', async () => {
            const strategy = new RetryStrategy({ maxRetries: 3 });
            let attempts = 0;

            const result = await strategy.executeWithRetry(
                async (context: RetryContext) => {
                    attempts++;
                    return 'success';
                },
                () => true
            );

            expect(result).toBe('success');
            expect(attempts).toBe(1);
        });

        it('should retry on failure and succeed', async () => {
            const strategy = new RetryStrategy({
                maxRetries: 3,
                initialDelay: 10, // Short delay for testing
                jitter: false,
            });
            let attempts = 0;

            const result = await strategy.executeWithRetry(
                async (context: RetryContext) => {
                    attempts++;
                    if (attempts < 3) {
                        throw new Error('Temporary failure');
                    }
                    return 'success';
                },
                (error: Error) => error.message === 'Temporary failure'
            );

            expect(result).toBe('success');
            expect(attempts).toBe(3);
        });

        it('should throw error after max retries exhausted', async () => {
            const strategy = new RetryStrategy({
                maxRetries: 2,
                initialDelay: 10,
                jitter: false,
            });
            let attempts = 0;

            await expect(
                strategy.executeWithRetry(
                    async () => {
                        attempts++;
                        throw new Error('Persistent failure');
                    },
                    () => true
                )
            ).rejects.toThrow('Persistent failure');

            expect(attempts).toBe(3); // Initial + 2 retries
        });

        it('should not retry when shouldRetry returns false', async () => {
            const strategy = new RetryStrategy({ maxRetries: 3 });
            let attempts = 0;

            await expect(
                strategy.executeWithRetry(
                    async () => {
                        attempts++;
                        throw new Error('Non-retryable error');
                    },
                    () => false // Don't retry
                )
            ).rejects.toThrow('Non-retryable error');

            expect(attempts).toBe(1); // Only initial attempt
        });

        it('should provide retry context with attempt number', async () => {
            const strategy = new RetryStrategy({
                maxRetries: 2,
                initialDelay: 10,
                jitter: false,
            });
            const attemptNumbers: number[] = [];

            await strategy.executeWithRetry(
                async (context: RetryContext) => {
                    attemptNumbers.push(context.attempt);
                    if (context.attempt < 3) {
                        throw new Error('Retry');
                    }
                    return 'success';
                },
                () => true
            );

            expect(attemptNumbers).toEqual([1, 2, 3]);
        });

        it('should track last error in retry context', async () => {
            const strategy = new RetryStrategy({
                maxRetries: 2,
                initialDelay: 10,
                jitter: false,
            });
            let lastError: Error | undefined;

            await strategy.executeWithRetry(
                async (context: RetryContext) => {
                    lastError = context.lastError;
                    if (context.attempt < 2) {
                        throw new Error(`Error ${context.attempt}`);
                    }
                    return 'success';
                },
                () => true
            );

            expect(lastError?.message).toBe('Error 1');
        });
    });

    describe('getOptions', () => {
        it('should return current retry options', () => {
            const options = {
                maxRetries: 5,
                initialDelay: 2000,
                maxDelay: 60000,
                backoffMultiplier: 3,
                jitter: false,
            };

            const strategy = new RetryStrategy(options);
            const returnedOptions = strategy.getOptions();

            expect(returnedOptions).toEqual(options);
        });

        it('should return default options when none provided', () => {
            const strategy = new RetryStrategy();
            const options = strategy.getOptions();

            expect(options).toEqual({
                maxRetries: 3,
                initialDelay: 1000,
                maxDelay: 30000,
                backoffMultiplier: 2,
                jitter: true,
            });
        });
    });
});
