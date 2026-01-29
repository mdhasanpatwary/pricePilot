/**
 * Smoke tests for error handling infrastructure
 * These tests verify that the core error classes can be instantiated
 * and basic functionality works without requiring database access.
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
import { ErrorSanitizer } from '@/lib/utils/error-sanitizer';
import { ErrorLogger } from '@/lib/utils/error-logger';
import { logger } from '@/lib/logger';

describe('Error Handler Infrastructure - Smoke Tests', () => {
    describe('AppError', () => {
        it('should create an AppError instance', () => {
            const error = new AppError('Test error', 500, 'TEST_ERROR');

            expect(error).toBeInstanceOf(Error);
            expect(error).toBeInstanceOf(AppError);
            expect(error.message).toBe('Test error');
            expect(error.statusCode).toBe(500);
            expect(error.errorCode).toBe('TEST_ERROR');
            expect(error.isRetryable).toBe(false);
        });

        it('should capture context', () => {
            const error = new AppError('Test error', 500, 'TEST_ERROR', {
                context: {
                    tenantId: 'tenant-123',
                    userId: 'user-456',
                    operation: 'testOperation',
                },
            });

            expect(error.context.tenantId).toBe('tenant-123');
            expect(error.context.userId).toBe('user-456');
            expect(error.context.operation).toBe('testOperation');
            expect(error.context.timestamp).toBeDefined();
        });

        it('should serialize to JSON', () => {
            const error = new AppError('Test error', 500, 'TEST_ERROR');
            const json = error.toJSON();

            expect(json.success).toBe(false);
            expect(json.error.code).toBe('TEST_ERROR');
            expect(json.error.message).toBeDefined();
            expect(json.meta.timestamp).toBeDefined();
        });
    });

    describe('ValidationError', () => {
        it('should create a ValidationError with field details', () => {
            const error = new ValidationError('Validation failed', {
                email: ['Invalid email format'],
                price: ['Must be greater than 0'],
            });

            expect(error).toBeInstanceOf(ValidationError);
            expect(error.statusCode).toBe(422);
            expect(error.errorCode).toBe('VALIDATION_ERROR');
            expect(error.fields).toEqual({
                email: ['Invalid email format'],
                price: ['Must be greater than 0'],
            });
        });
    });

    describe('NotFoundError', () => {
        it('should create a NotFoundError', () => {
            const error = new NotFoundError('Product', 'prod-123');

            expect(error).toBeInstanceOf(NotFoundError);
            expect(error.statusCode).toBe(404);
            expect(error.errorCode).toBe('NOT_FOUND');
            expect(error.resourceType).toBe('Product');
            expect(error.resourceId).toBe('prod-123');
        });
    });

    describe('UnauthorizedError', () => {
        it('should create an UnauthorizedError', () => {
            const error = new UnauthorizedError();

            expect(error).toBeInstanceOf(UnauthorizedError);
            expect(error.statusCode).toBe(401);
            expect(error.errorCode).toBe('UNAUTHORIZED');
        });
    });

    describe('ForbiddenError', () => {
        it('should create a ForbiddenError', () => {
            const error = new ForbiddenError();

            expect(error).toBeInstanceOf(ForbiddenError);
            expect(error.statusCode).toBe(403);
            expect(error.errorCode).toBe('FORBIDDEN');
        });
    });

    describe('ConflictError', () => {
        it('should create a ConflictError', () => {
            const error = new ConflictError('Resource already exists');

            expect(error).toBeInstanceOf(ConflictError);
            expect(error.statusCode).toBe(409);
            expect(error.errorCode).toBe('CONFLICT');
        });
    });

    describe('RateLimitError', () => {
        it('should create a RateLimitError', () => {
            const error = new RateLimitError(100, 3600);

            expect(error).toBeInstanceOf(RateLimitError);
            expect(error.statusCode).toBe(429);
            expect(error.errorCode).toBe('RATE_LIMIT_EXCEEDED');
            expect(error.limit).toBe(100);
            expect(error.windowSeconds).toBe(3600);
            expect(error.isRetryable).toBe(true);
        });
    });

    describe('ExternalServiceError', () => {
        it('should create an ExternalServiceError', () => {
            const error = new ExternalServiceError('OpenCart', 'Connection failed');

            expect(error).toBeInstanceOf(ExternalServiceError);
            expect(error.statusCode).toBe(502);
            expect(error.errorCode).toBe('EXTERNAL_SERVICE_ERROR');
            expect(error.serviceName).toBe('OpenCart');
        });
    });

    describe('ErrorSanitizer', () => {
        it('should create an ErrorSanitizer instance', () => {
            const sanitizer = new ErrorSanitizer();

            expect(sanitizer).toBeInstanceOf(ErrorSanitizer);
        });

        it('should sanitize sensitive data in messages', () => {
            const sanitizer = new ErrorSanitizer();
            const message = 'Error with token: Bearer abc123xyz';
            const sanitized = sanitizer.sanitizeMessage(message);

            expect(sanitized).not.toContain('abc123xyz');
            expect(sanitized).toContain('[REDACTED]');
        });

        it('should sanitize sensitive fields in context metadata', () => {
            const sanitizer = new ErrorSanitizer();
            const context = {
                tenantId: 'tenant-123',
                timestamp: '2024-01-01T00:00:00Z',
                metadata: {
                    apiToken: 'secret-token',
                    password: 'secret-password',
                    normalField: 'normal-value',
                },
            };

            const sanitized = sanitizer.sanitizeContext(context as any);

            expect(sanitized.tenantId).toBe('tenant-123');
            expect(sanitized.metadata?.apiToken).toBe('[REDACTED]');
            expect(sanitized.metadata?.password).toBe('[REDACTED]');
            expect(sanitized.metadata?.normalField).toBe('normal-value');
        });
    });

    describe('ErrorLogger', () => {
        it('should create an ErrorLogger instance', () => {
            const sanitizer = new ErrorSanitizer();
            const errorLogger = new ErrorLogger(logger, sanitizer);

            expect(errorLogger).toBeInstanceOf(ErrorLogger);
        });

        it('should log errors without throwing', () => {
            const sanitizer = new ErrorSanitizer();
            const errorLogger = new ErrorLogger(logger, sanitizer);
            const error = new AppError('Test error', 500, 'TEST_ERROR');

            // Should not throw
            expect(() => errorLogger.logError(error)).not.toThrow();
        });
    });
});
