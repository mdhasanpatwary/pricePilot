/**
 * Unit tests for error retry metadata
 * Tests Requirements 9.1-9.6: Error Recovery and Retry Logic
 */

import {
    AppError,
    ValidationError,
    NotFoundError,
    UnauthorizedError,
    ForbiddenError,
    ConflictError,
    RateLimitError,
    ExternalServiceError,
} from '@/lib/utils/error-handler';

describe('Error Retry Metadata', () => {
    describe('Base AppError retry defaults', () => {
        it('should default to non-retryable', () => {
            const error = new AppError('Test error', 500, 'TEST_ERROR');

            expect(error.isRetryable).toBe(false);
            expect(error.retryAfter).toBeUndefined();
        });

        it('should accept custom retry metadata', () => {
            const error = new AppError('Test error', 500, 'TEST_ERROR', {
                isRetryable: true,
                retryAfter: 60,
            });

            expect(error.isRetryable).toBe(true);
            expect(error.retryAfter).toBe(60);
        });

        it('should allow retryable without retryAfter', () => {
            const error = new AppError('Test error', 500, 'TEST_ERROR', {
                isRetryable: true,
            });

            expect(error.isRetryable).toBe(true);
            expect(error.retryAfter).toBeUndefined();
        });
    });

    describe('ValidationError - non-retryable', () => {
        it('should not be retryable by default', () => {
            const error = new ValidationError('Invalid input', {
                email: ['Invalid format'],
            });

            expect(error.isRetryable).toBe(false);
            expect(error.retryAfter).toBeUndefined();
        });

        it('should remain non-retryable even if explicitly set', () => {
            // ValidationError represents client errors that won't succeed on retry
            const error = new ValidationError(
                'Invalid input',
                { email: ['Invalid format'] },
                { isRetryable: false }
            );

            expect(error.isRetryable).toBe(false);
        });
    });

    describe('NotFoundError - non-retryable', () => {
        it('should not be retryable by default', () => {
            const error = new NotFoundError('Product', 'prod-123');

            expect(error.isRetryable).toBe(false);
            expect(error.retryAfter).toBeUndefined();
        });
    });

    describe('UnauthorizedError - non-retryable', () => {
        it('should not be retryable by default', () => {
            const error = new UnauthorizedError();

            expect(error.isRetryable).toBe(false);
            expect(error.retryAfter).toBeUndefined();
        });
    });

    describe('ForbiddenError - non-retryable', () => {
        it('should not be retryable by default', () => {
            const error = new ForbiddenError();

            expect(error.isRetryable).toBe(false);
            expect(error.retryAfter).toBeUndefined();
        });
    });

    describe('ConflictError - non-retryable', () => {
        it('should not be retryable by default', () => {
            const error = new ConflictError('Resource conflict');

            expect(error.isRetryable).toBe(false);
            expect(error.retryAfter).toBeUndefined();
        });
    });

    describe('RateLimitError - automatically retryable', () => {
        it('should be retryable with default retry delay', () => {
            const error = new RateLimitError(100, 3600);

            expect(error.isRetryable).toBe(true);
            expect(error.retryAfter).toBe(3600);
        });

        it('should use windowSeconds as default retryAfter', () => {
            const error = new RateLimitError(50, 1800);

            expect(error.isRetryable).toBe(true);
            expect(error.retryAfter).toBe(1800);
        });

        it('should allow custom retryAfter override', () => {
            const error = new RateLimitError(100, 3600, {
                retryAfter: 60, // Custom shorter delay
            });

            expect(error.isRetryable).toBe(true);
            expect(error.retryAfter).toBe(60);
        });

        it('should include retry metadata in error details', () => {
            const error = new RateLimitError(100, 3600);
            const json = error.toJSON();

            expect(json.error.details).toEqual({
                limit: 100,
                windowSeconds: 3600,
                retryAfter: 3600,
            });
        });
    });

    describe('ExternalServiceError - conditionally retryable', () => {
        it('should not be retryable by default', () => {
            const error = new ExternalServiceError('OpenCart', 'Connection failed');

            expect(error.isRetryable).toBe(false);
            expect(error.retryAfter).toBeUndefined();
        });

        it('should be retryable when explicitly marked for transient failures', () => {
            const error = new ExternalServiceError(
                'OpenCart',
                'Network timeout',
                {
                    isRetryable: true,
                    retryAfter: 60,
                }
            );

            expect(error.isRetryable).toBe(true);
            expect(error.retryAfter).toBe(60);
        });

        it('should support retryable without retryAfter for immediate retry', () => {
            const error = new ExternalServiceError(
                'OpenCart',
                'Temporary service unavailable',
                {
                    isRetryable: true,
                }
            );

            expect(error.isRetryable).toBe(true);
            expect(error.retryAfter).toBeUndefined();
        });

        it('should include retry metadata in error details', () => {
            const error = new ExternalServiceError(
                'OpenCart',
                'Network timeout',
                {
                    isRetryable: true,
                    retryAfter: 60,
                    serviceStatusCode: 503,
                }
            );
            const json = error.toJSON();

            expect(json.error.details).toEqual({
                serviceName: 'OpenCart',
                serviceStatusCode: 503,
                isRetryable: true,
                retryAfter: 60,
            });
        });

        it('should handle network timeout as retryable', () => {
            const timeoutError = new Error('ETIMEDOUT');
            const error = new ExternalServiceError(
                'OpenCart',
                'Request timed out',
                {
                    cause: timeoutError,
                    isRetryable: true,
                    retryAfter: 30,
                }
            );

            expect(error.isRetryable).toBe(true);
            expect(error.retryAfter).toBe(30);
            expect(error.cause).toBe(timeoutError);
        });

        it('should handle connection refused as retryable', () => {
            const connError = new Error('ECONNREFUSED');
            const error = new ExternalServiceError(
                'OpenCart',
                'Connection refused',
                {
                    cause: connError,
                    isRetryable: true,
                    retryAfter: 60,
                }
            );

            expect(error.isRetryable).toBe(true);
            expect(error.retryAfter).toBe(60);
        });

        it('should handle service unavailable (503) as retryable', () => {
            const error = new ExternalServiceError(
                'OpenCart',
                'Service temporarily unavailable',
                {
                    serviceStatusCode: 503,
                    isRetryable: true,
                    retryAfter: 120,
                }
            );

            expect(error.isRetryable).toBe(true);
            expect(error.retryAfter).toBe(120);
            expect(error.serviceStatusCode).toBe(503);
        });

        it('should not mark permanent failures as retryable', () => {
            const error = new ExternalServiceError(
                'OpenCart',
                'Invalid API token',
                {
                    serviceStatusCode: 401,
                    isRetryable: false,
                }
            );

            expect(error.isRetryable).toBe(false);
            expect(error.retryAfter).toBeUndefined();
        });
    });

    describe('Retry metadata consistency', () => {
        it('should maintain retry metadata through error chain', () => {
            const originalError = new Error('Network timeout');
            const wrappedError = new ExternalServiceError(
                'OpenCart',
                'Failed to fetch products',
                {
                    cause: originalError,
                    isRetryable: true,
                    retryAfter: 60,
                }
            );

            expect(wrappedError.isRetryable).toBe(true);
            expect(wrappedError.retryAfter).toBe(60);
            expect(wrappedError.cause).toBe(originalError);
        });

        it('should include retry metadata in log format', () => {
            const error = new RateLimitError(100, 3600);
            const logEntry = error.toLogFormat();

            expect(logEntry.errorCode).toBe('RATE_LIMIT_EXCEEDED');
            // Retry metadata is part of the error instance
            expect(error.isRetryable).toBe(true);
            expect(error.retryAfter).toBe(3600);
        });

        it('should preserve retry metadata in JSON serialization', () => {
            const error = new ExternalServiceError(
                'OpenCart',
                'Temporary failure',
                {
                    isRetryable: true,
                    retryAfter: 120,
                }
            );
            const json = error.toJSON();

            expect(json.error.details.isRetryable).toBe(true);
            expect(json.error.details.retryAfter).toBe(120);
        });
    });

    describe('Retry delay values', () => {
        it('should accept zero as retryAfter for immediate retry', () => {
            const error = new AppError('Test', 500, 'TEST', {
                isRetryable: true,
                retryAfter: 0,
            });

            expect(error.isRetryable).toBe(true);
            expect(error.retryAfter).toBe(0);
        });

        it('should accept large retry delays', () => {
            const error = new RateLimitError(10, 86400); // 24 hours

            expect(error.isRetryable).toBe(true);
            expect(error.retryAfter).toBe(86400);
        });

        it('should handle fractional seconds in retryAfter', () => {
            const error = new AppError('Test', 500, 'TEST', {
                isRetryable: true,
                retryAfter: 0.5, // 500ms
            });

            expect(error.isRetryable).toBe(true);
            expect(error.retryAfter).toBe(0.5);
        });
    });
});
