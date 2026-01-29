/**
 * Unit tests for GlobalErrorHandler
 * 
 * Tests the global error handler middleware functionality including:
 * - Error wrapping and transformation
 * - HTTP status code mapping
 * - Request ID handling
 * - Development vs production mode
 * - Error logging integration
 */

import { NextRequest, NextResponse } from 'next/server';
import {
    GlobalErrorHandler,
    withGlobalErrorHandler,
    withErrorHandling,
} from '@/lib/middleware/global-error-handler';
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
import { ErrorLogger } from '@/lib/utils/error-logger';

// Mock the logger
jest.mock('@/lib/logger', () => ({
    logger: {
        error: jest.fn(),
        warn: jest.fn(),
        info: jest.fn(),
    },
}));

// Mock NextResponse.json
jest.mock('next/server', () => {
    const actual = jest.requireActual('next/server');
    return {
        ...actual,
        NextResponse: {
            ...actual.NextResponse,
            json: jest.fn((body: any, init?: any) => {
                return {
                    status: init?.status || 200,
                    headers: new Map(Object.entries(init?.headers || {})),
                    json: async () => body,
                } as any;
            }),
        },
    };
});

describe('GlobalErrorHandler', () => {
    let handler: GlobalErrorHandler;
    let mockErrorLogger: jest.Mocked<ErrorLogger>;

    beforeEach(() => {
        // Create mock error logger
        mockErrorLogger = {
            logError: jest.fn(),
        } as any;

        // Create handler instance
        handler = new GlobalErrorHandler(mockErrorLogger, false);
    });

    describe('handleError', () => {
        it('should handle AppError and return correct status code', () => {
            const error = new ValidationError(
                'Invalid input',
                { email: ['Invalid email format'] }
            );

            const req = new NextRequest('http://localhost/api/test');
            const response = handler.handleError(error, req);

            expect(response.status).toBe(422);
            expect(mockErrorLogger.logError).toHaveBeenCalledWith(
                error,
                expect.any(Object)
            );
        });

        it('should wrap non-AppError errors', () => {
            const error = new Error('Something went wrong');
            const req = new NextRequest('http://localhost/api/test');
            const response = handler.handleError(error, req);

            expect(response.status).toBe(500);
            expect(mockErrorLogger.logError).toHaveBeenCalled();
        });

        it('should add request ID if missing', () => {
            const error = new AppError('Test error', 500, 'TEST_ERROR');
            const req = new NextRequest('http://localhost/api/test');

            const response = handler.handleError(error, req);

            expect(error.context.requestId).toBeDefined();
            expect(response.headers.get('X-Request-ID')).toBeDefined();
        });

        it('should use existing request ID from error context', () => {
            const requestId = 'existing-request-id';
            const error = new AppError('Test error', 500, 'TEST_ERROR', {
                context: { requestId },
            });
            const req = new NextRequest('http://localhost/api/test');

            const response = handler.handleError(error, req);

            expect(error.context.requestId).toBe(requestId);
            expect(response.headers.get('X-Request-ID')).toBe(requestId);
        });

        it('should handle logging failures gracefully', () => {
            mockErrorLogger.logError.mockImplementation(() => {
                throw new Error('Logging failed');
            });

            const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
            const error = new AppError('Test error', 500, 'TEST_ERROR');
            const req = new NextRequest('http://localhost/api/test');

            const response = handler.handleError(error, req);

            expect(response.status).toBe(500);
            expect(consoleSpy).toHaveBeenCalled();
            consoleSpy.mockRestore();
        });
    });

    describe('HTTP Status Code Mapping', () => {
        const testCases = [
            { ErrorClass: ValidationError, args: ['Invalid', {}], expectedStatus: 422 },
            { ErrorClass: NotFoundError, args: ['Product', '123'], expectedStatus: 404 },
            { ErrorClass: UnauthorizedError, args: [], expectedStatus: 401 },
            { ErrorClass: ForbiddenError, args: [], expectedStatus: 403 },
            { ErrorClass: ConflictError, args: ['Conflict'], expectedStatus: 409 },
            { ErrorClass: RateLimitError, args: [100, 60], expectedStatus: 429 },
            { ErrorClass: ExternalServiceError, args: ['OpenCart', 'Failed'], expectedStatus: 502 },
        ];

        testCases.forEach(({ ErrorClass, args, expectedStatus }) => {
            it(`should return ${expectedStatus} for ${ErrorClass.name}`, () => {
                const error = new (ErrorClass as any)(...args);
                const req = new NextRequest('http://localhost/api/test');
                const response = handler.handleError(error, req);

                expect(response.status).toBe(expectedStatus);
            });
        });
    });

    describe('Error Response Format', () => {
        it('should return standardized error response format', async () => {
            const error = new ValidationError(
                'Invalid input',
                { email: ['Invalid email format'] }
            );
            const req = new NextRequest('http://localhost/api/test');
            const response = handler.handleError(error, req);

            const json = await response.json();

            expect(json).toHaveProperty('success', false);
            expect(json).toHaveProperty('error');
            expect(json.error).toHaveProperty('code');
            expect(json.error).toHaveProperty('message');
            expect(json).toHaveProperty('meta');
            expect(json.meta).toHaveProperty('requestId');
            expect(json.meta).toHaveProperty('timestamp');
        });

        it('should include error details for ValidationError', async () => {
            const fields = { email: ['Invalid email format'], price: ['Must be positive'] };
            const error = new ValidationError('Invalid input', fields);
            const req = new NextRequest('http://localhost/api/test');
            const response = handler.handleError(error, req);

            const json = await response.json();

            expect(json.error.details).toHaveProperty('fields', fields);
        });

        it('should include developer message in development mode', async () => {
            const devHandler = new GlobalErrorHandler(mockErrorLogger, true);
            const error = new AppError('Test error', 500, 'TEST_ERROR', {
                developerMessage: 'Detailed technical info',
            });
            const req = new NextRequest('http://localhost/api/test');
            const response = devHandler.handleError(error, req);

            const json = await response.json();

            expect(json.error.details).toHaveProperty('developerMessage', 'Detailed technical info');
            expect(json.error.details).toHaveProperty('stack');
        });

        it('should NOT include developer message in production mode', async () => {
            const prodHandler = new GlobalErrorHandler(mockErrorLogger, false);
            const error = new AppError('Test error', 500, 'TEST_ERROR', {
                developerMessage: 'Detailed technical info',
            });
            const req = new NextRequest('http://localhost/api/test');
            const response = prodHandler.handleError(error, req);

            const json = await response.json();

            expect(json.error.details?.developerMessage).toBeUndefined();
        });
    });

    describe('withGlobalErrorHandler middleware', () => {
        it('should call handler and return response on success', async () => {
            const mockHandler = jest.fn().mockResolvedValue(
                NextResponse.json({ data: 'success' })
            );
            const req = new NextRequest('http://localhost/api/test');

            const response = await withGlobalErrorHandler(req, mockHandler);

            expect(mockHandler).toHaveBeenCalledWith(req);
            expect(response.status).toBe(200);
        });

        it('should catch errors and return error response', async () => {
            const mockHandler = jest.fn().mockRejectedValue(
                new ValidationError('Invalid', { field: ['error'] })
            );
            const req = new NextRequest('http://localhost/api/test');

            const response = await withGlobalErrorHandler(req, mockHandler);

            expect(response.status).toBe(422);
        });
    });

    describe('withErrorHandling wrapper', () => {
        it('should wrap handler and catch errors', async () => {
            const mockHandler = jest.fn().mockRejectedValue(
                new NotFoundError('Product', '123')
            );
            const req = new NextRequest('http://localhost/api/test');

            const wrappedHandler = withErrorHandling(mockHandler);
            const response = await wrappedHandler(req);

            expect(response.status).toBe(404);
        });

        it('should pass through successful responses', async () => {
            const mockHandler = jest.fn().mockResolvedValue(
                NextResponse.json({ data: 'success' })
            );
            const req = new NextRequest('http://localhost/api/test');

            const wrappedHandler = withErrorHandling(mockHandler);
            const response = await wrappedHandler(req);

            expect(response.status).toBe(200);
        });
    });

    describe('Request ID handling', () => {
        it('should extract request ID from x-request-id header', () => {
            const requestId = 'test-request-id';
            const req = new NextRequest('http://localhost/api/test', {
                headers: { 'x-request-id': requestId },
            });
            const error = new AppError('Test', 500, 'TEST');

            const response = handler.handleError(error, req);

            expect(response.headers.get('X-Request-ID')).toBe(requestId);
        });

        it('should extract request ID from x-correlation-id header', () => {
            const requestId = 'test-correlation-id';
            const req = new NextRequest('http://localhost/api/test', {
                headers: { 'x-correlation-id': requestId },
            });
            const error = new AppError('Test', 500, 'TEST');

            const response = handler.handleError(error, req);

            expect(response.headers.get('X-Request-ID')).toBe(requestId);
        });

        it('should generate request ID if not present', () => {
            const req = new NextRequest('http://localhost/api/test');
            const error = new AppError('Test', 500, 'TEST');

            const response = handler.handleError(error, req);

            const requestId = response.headers.get('X-Request-ID');
            expect(requestId).toBeDefined();
            expect(requestId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
        });
    });

    describe('Error logging', () => {
        it('should log error before sending response', () => {
            const error = new AppError('Test error', 500, 'TEST_ERROR');
            const req = new NextRequest('http://localhost/api/test');

            handler.handleError(error, req);

            // Verify error was logged with request info
            expect(mockErrorLogger.logError).toHaveBeenCalledWith(
                error,
                expect.any(Object)
            );
            expect(mockErrorLogger.logError).toHaveBeenCalledTimes(1);
        });

        it('should extract IP address from x-forwarded-for header', () => {
            const error = new AppError('Test error', 500, 'TEST_ERROR');
            const req = new NextRequest('http://localhost/api/test', {
                headers: {
                    'x-forwarded-for': '192.168.1.1, 10.0.0.1',
                },
            });

            handler.handleError(error, req);

            expect(mockErrorLogger.logError).toHaveBeenCalledWith(
                error,
                expect.objectContaining({
                    ip: '192.168.1.1',
                })
            );
        });

        it('should extract IP address from x-real-ip header', () => {
            const error = new AppError('Test error', 500, 'TEST_ERROR');
            const req = new NextRequest('http://localhost/api/test', {
                headers: {
                    'x-real-ip': '10.0.0.1',
                },
            });

            handler.handleError(error, req);

            expect(mockErrorLogger.logError).toHaveBeenCalledWith(
                error,
                expect.objectContaining({
                    ip: '10.0.0.1',
                })
            );
        });

        it('should extract user agent from request headers', () => {
            const error = new AppError('Test error', 500, 'TEST_ERROR');
            const req = new NextRequest('http://localhost/api/test', {
                headers: {
                    'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
                },
            });

            handler.handleError(error, req);

            expect(mockErrorLogger.logError).toHaveBeenCalledWith(
                error,
                expect.objectContaining({
                    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
                })
            );
        });

        it('should handle missing IP and user agent gracefully', () => {
            const error = new AppError('Test error', 500, 'TEST_ERROR');
            const req = new NextRequest('http://localhost/api/test');

            handler.handleError(error, req);

            expect(mockErrorLogger.logError).toHaveBeenCalledWith(
                error,
                expect.objectContaining({
                    ip: undefined,
                    userAgent: undefined,
                })
            );
        });
    });
});
