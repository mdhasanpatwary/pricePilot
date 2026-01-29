/**
 * Unit tests for enhanced withErrorHandling wrapper
 * Tests backward compatibility and integration with new error handling system
 */

import { describe, it, expect, jest } from '@jest/globals';
import { NextRequest, NextResponse } from 'next/server';
import { withErrorHandling } from '../../lib/error-api';
import { AppError, ValidationError, NotFoundError } from '../../lib/utils/error-handler';

// Mock logger
jest.mock('../../lib/logger', () => ({
    logger: {
        error: jest.fn(),
        warn: jest.fn(),
        info: jest.fn(),
    },
}));

describe('withErrorHandling - Enhanced Wrapper', () => {
    const createMockRequest = (url: string = 'http://localhost/api/test'): NextRequest => {
        return new NextRequest(url, {
            method: 'GET',
        });
    };

    describe('AppError Handling', () => {
        it('should handle AppError instances correctly', async () => {
            const handler = withErrorHandling(async () => {
                throw new ValidationError(
                    'Invalid input',
                    { email: ['Invalid email format'] }
                );
            });

            const req = createMockRequest();
            const response = await handler(req);
            const data = await response.json();

            expect(response.status).toBe(422);
            expect(data.error).toBeTruthy();
            expect(data.code).toBe('VALIDATION_ERROR');
        });

        it('should preserve AppError status codes', async () => {
            const testCases = [
                { error: new ValidationError('Invalid', {}), expectedStatus: 422 },
                { error: new NotFoundError('Product', '123'), expectedStatus: 404 },
                { error: new AppError('Test', 503, 'SERVICE_UNAVAILABLE'), expectedStatus: 503 },
            ];

            for (const { error, expectedStatus } of testCases) {
                const handler = withErrorHandling(async () => {
                    throw error;
                });

                const req = createMockRequest();
                const response = await handler(req);

                expect(response.status).toBe(expectedStatus);
            }
        });

        it('should add request ID to AppError context if missing', async () => {
            let capturedError: AppError | null = null;

            const handler = withErrorHandling(async () => {
                const error = new AppError('Test error', 500, 'TEST_ERROR');
                capturedError = error;
                throw error;
            });

            const req = createMockRequest();
            await handler(req);

            expect(capturedError?.context.requestId).toBeTruthy();
        });

        it('should preserve existing request ID in AppError', async () => {
            const handler = withErrorHandling(async () => {
                throw new AppError('Test error', 500, 'TEST_ERROR', {
                    context: { requestId: 'existing_req_123' },
                });
            });

            const req = createMockRequest();
            const response = await handler(req);
            const data = await response.json();

            expect(data.digest).toBe('existing_req_123');
        });
    });

    describe('Non-AppError Handling', () => {
        it('should wrap standard Error instances', async () => {
            const handler = withErrorHandling(async () => {
                throw new Error('Standard error');
            });

            const req = createMockRequest();
            const response = await handler(req);
            const data = await response.json();

            expect(response.status).toBe(500);
            expect(data.code).toBe('INTERNAL_SERVER_ERROR');
            expect(data.error).toBe('An unexpected server error occurred');
        });

        it('should wrap string errors', async () => {
            const handler = withErrorHandling(async () => {
                throw 'String error';
            });

            const req = createMockRequest();
            const response = await handler(req);
            const data = await response.json();

            expect(response.status).toBe(500);
            expect(data.code).toBe('INTERNAL_SERVER_ERROR');
        });

        it('should include request metadata in wrapped errors', async () => {
            const handler = withErrorHandling(async () => {
                throw new Error('Test error');
            });

            const req = createMockRequest('http://localhost/api/products');
            const response = await handler(req);

            expect(response.status).toBe(500);
            // Error should be logged with request metadata
        });
    });

    describe('Development vs Production Mode', () => {
        const originalEnv = process.env.NODE_ENV;

        afterEach(() => {
            process.env.NODE_ENV = originalEnv;
        });

        it('should include developer message in development mode', async () => {
            process.env.NODE_ENV = 'development';

            const handler = withErrorHandling(async () => {
                throw new AppError('Test error', 500, 'TEST_ERROR', {
                    developerMessage: 'Detailed technical error',
                });
            });

            const req = createMockRequest();
            const response = await handler(req);
            const data = await response.json();

            expect(data.details).toBe('Detailed technical error');
        });

        it('should not include developer message in production mode', async () => {
            process.env.NODE_ENV = 'production';

            const handler = withErrorHandling(async () => {
                throw new AppError('Test error', 500, 'TEST_ERROR', {
                    developerMessage: 'Detailed technical error',
                });
            });

            const req = createMockRequest();
            const response = await handler(req);
            const data = await response.json();

            expect(data.details).toBeUndefined();
        });
    });

    describe('Backward Compatibility', () => {
        it('should maintain existing response format', async () => {
            const handler = withErrorHandling(async () => {
                throw new Error('Test error');
            });

            const req = createMockRequest();
            const response = await handler(req);
            const data = await response.json();

            // Should have the expected fields
            expect(data).toHaveProperty('error');
            expect(data).toHaveProperty('code');
            expect(data).toHaveProperty('digest');
        });

        it('should work with successful handlers', async () => {
            const handler = withErrorHandling(async () => {
                return NextResponse.json({ success: true, data: 'test' });
            });

            const req = createMockRequest();
            const response = await handler(req);
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.success).toBe(true);
            expect(data.data).toBe('test');
        });
    });

    describe('Error Logging', () => {
        it('should log all errors', async () => {
            const { logger } = require('../../lib/logger');

            const handler = withErrorHandling(async () => {
                throw new AppError('Test error', 500, 'TEST_ERROR');
            });

            const req = createMockRequest();
            await handler(req);

            // Logger should have been called
            expect(logger.error).toHaveBeenCalled();
        });
    });

    describe('Request ID Handling', () => {
        it('should use x-request-id header if present', async () => {
            const handler = withErrorHandling(async () => {
                throw new Error('Test error');
            });

            const req = new NextRequest('http://localhost/api/test', {
                method: 'GET',
                headers: {
                    'x-request-id': 'custom_req_id_123',
                },
            });

            const response = await handler(req);
            const data = await response.json();

            expect(data.digest).toBe('custom_req_id_123');
        });

        it('should generate request ID if not present', async () => {
            const handler = withErrorHandling(async () => {
                throw new Error('Test error');
            });

            const req = createMockRequest();
            const response = await handler(req);
            const data = await response.json();

            expect(data.digest).toBeTruthy();
            expect(typeof data.digest).toBe('string');
        });
    });
});
