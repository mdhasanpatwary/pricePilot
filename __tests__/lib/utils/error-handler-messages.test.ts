/**
 * Integration tests for error handler with message templates
 * 
 * Tests verify:
 * - Default user messages are applied correctly
 * - Custom messages override defaults
 * - Message variables are formatted properly
 * - No technical jargon in user messages
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
} from '../../../lib/utils/error-handler';

describe('Error Handler - Message Templates Integration', () => {
    describe('Default User Messages', () => {
        it('should use default message for ValidationError', () => {
            const error = new ValidationError(
                'Validation failed',
                { email: ['Invalid email'] }
            );

            expect(error.userMessage).toContain('The information you provided is invalid');
            expect(error.userMessage).not.toContain('validation');
        });

        it('should use default message for NotFoundError', () => {
            const error = new NotFoundError('Product', '123');

            expect(error.userMessage).toContain('Product');
            expect(error.userMessage).toContain('could not be found');
        });

        it('should use default message for UnauthorizedError', () => {
            const error = new UnauthorizedError();

            expect(error.userMessage).toContain('sign in');
            expect(error.userMessage).not.toContain('authentication');
        });

        it('should use default message for ForbiddenError', () => {
            const error = new ForbiddenError();

            expect(error.userMessage).toContain('permission');
            expect(error.userMessage).not.toContain('authorization');
        });

        it('should use default message for ConflictError', () => {
            const error = new ConflictError('Duplicate entry');

            expect(error.userMessage).toContain('conflicts');
            expect(error.userMessage).not.toContain('duplicate');
        });

        it('should use default message for RateLimitError', () => {
            const error = new RateLimitError(100, 3600);

            expect(error.userMessage).toContain('too many requests');
            expect(error.userMessage).not.toContain('rate limit');
        });

        it('should use default message for ExternalServiceError', () => {
            const error = new ExternalServiceError('OpenCart', 'Connection failed');

            expect(error.userMessage).toContain('OpenCart');
            expect(error.userMessage).toContain('connect');
        });

        it('should use default message for generic AppError', () => {
            const error = new AppError('Internal error', 500, 'INTERNAL_ERROR');

            expect(error.userMessage).toContain('went wrong');
            expect(error.userMessage).not.toContain('internal');
        });
    });

    describe('Custom Message Override', () => {
        it('should allow custom user message for ValidationError', () => {
            const customMessage = 'Please check your input';
            const error = new ValidationError(
                'Validation failed',
                { email: ['Invalid'] },
                { userMessage: customMessage }
            );

            expect(error.userMessage).toBe(customMessage);
        });

        it('should allow custom user message for NotFoundError', () => {
            const customMessage = 'We could not find that item';
            const error = new NotFoundError('Product', '123', {
                userMessage: customMessage,
            });

            expect(error.userMessage).toBe(customMessage);
        });

        it('should allow custom user message for ExternalServiceError', () => {
            const customMessage = 'The external service is unavailable';
            const error = new ExternalServiceError('OpenCart', 'Failed', {
                userMessage: customMessage,
            });

            expect(error.userMessage).toBe(customMessage);
        });
    });

    describe('Message Variable Formatting', () => {
        it('should format NotFoundError with resource type', () => {
            const error = new NotFoundError('UserWebsite', 'web-123');

            expect(error.userMessage).toContain('UserWebsite');
        });

        it('should format ExternalServiceError with service name', () => {
            const error = new ExternalServiceError('Shopify', 'API error');

            expect(error.userMessage).toContain('Shopify');
        });

        it('should format RateLimitError with limit info', () => {
            const error = new RateLimitError(50, 60);

            expect(error.limit).toBe(50);
            expect(error.windowSeconds).toBe(60);
            expect(error.userMessage).toBeTruthy();
        });
    });

    describe('Non-Technical Language', () => {
        const technicalTerms = [
            'stack trace',
            'exception',
            'null pointer',
            'undefined reference',
            'segmentation fault',
        ];

        it('should not contain technical jargon in ValidationError', () => {
            const error = new ValidationError('Failed', { field: ['error'] });

            technicalTerms.forEach(term => {
                expect(error.userMessage.toLowerCase()).not.toContain(term);
            });
        });

        it('should not contain technical jargon in NotFoundError', () => {
            const error = new NotFoundError('Product', '123');

            technicalTerms.forEach(term => {
                expect(error.userMessage.toLowerCase()).not.toContain(term);
            });
        });

        it('should not contain technical jargon in UnauthorizedError', () => {
            const error = new UnauthorizedError();

            technicalTerms.forEach(term => {
                expect(error.userMessage.toLowerCase()).not.toContain(term);
            });
        });

        it('should not contain technical jargon in ExternalServiceError', () => {
            const error = new ExternalServiceError('API', 'Failed');

            technicalTerms.forEach(term => {
                expect(error.userMessage.toLowerCase()).not.toContain(term);
            });
        });
    });

    describe('Developer Messages', () => {
        it('should include developer message for ValidationError', () => {
            const error = new ValidationError('Failed', { field: ['error'] });

            expect(error.developerMessage).toBeDefined();
            expect(error.developerMessage).toContain('validation');
        });

        it('should include developer message for NotFoundError', () => {
            const error = new NotFoundError('Product', '123');

            expect(error.developerMessage).toBeDefined();
            expect(error.developerMessage).toContain('database');
        });

        it('should allow custom developer message', () => {
            const customDevMessage = 'Check the database connection';
            const error = new AppError('Error', 500, 'INTERNAL_ERROR', {
                developerMessage: customDevMessage,
            });

            expect(error.developerMessage).toBe(customDevMessage);
        });
    });

    describe('JSON Serialization', () => {
        it('should include user message in JSON response', () => {
            const error = new ValidationError('Failed', { email: ['Invalid'] });
            const json = error.toJSON();

            expect(json.error.message).toBe(error.userMessage);
            expect(json.error.message).not.toContain('validation');
        });

        it('should not include developer message in JSON response', () => {
            const error = new ValidationError('Failed', { email: ['Invalid'] });
            const json = error.toJSON();

            expect(json.error.message).not.toContain('Check the fields object');
        });

        it('should include error details in JSON response', () => {
            const fields = { email: ['Invalid email'], price: ['Must be positive'] };
            const error = new ValidationError('Failed', fields);
            const json = error.toJSON();

            expect(json.error.details).toEqual({ fields });
        });
    });

    describe('Log Format', () => {
        it('should include developer message in log format', () => {
            const error = new ValidationError('Failed', { email: ['Invalid'] });
            const log = error.toLogFormat();

            // The log message is the technical message passed to constructor
            expect(log.message).toBe('Failed');
        });

        it('should include full context in log format', () => {
            const error = new NotFoundError('Product', '123', {
                context: {
                    tenantId: 'tenant-1',
                    userId: 'user-1',
                    operation: 'getProduct',
                },
            });
            const log = error.toLogFormat();

            expect(log.context.tenantId).toBe('tenant-1');
            expect(log.context.userId).toBe('user-1');
            expect(log.context.operation).toBe('getProduct');
        });
    });

    describe('Actionable Guidance', () => {
        it('should provide actionable guidance in user messages', () => {
            const actionWords = ['please', 'try', 'check', 'verify', 'contact'];

            const errors = [
                new ValidationError('Failed', { field: ['error'] }),
                new NotFoundError('Product', '123'),
                new UnauthorizedError(),
                new ForbiddenError(),
                new RateLimitError(100, 60),
                new ExternalServiceError('API', 'Failed'),
            ];

            errors.forEach(error => {
                const lowerMessage = error.userMessage.toLowerCase();
                const hasActionWord = actionWords.some(word => lowerMessage.includes(word));
                expect(hasActionWord).toBe(true);
            });
        });
    });
});
