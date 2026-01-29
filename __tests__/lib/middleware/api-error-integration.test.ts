/**
 * Integration tests for API error handling
 * Tests that the global error handler middleware works correctly with actual API routes
 * 
 * Requirements: 7.1-7.12
 */

import { NextRequest, NextResponse } from 'next/server';
import { withGlobalErrorHandler, withErrorHandling } from '@/lib/middleware/global-error-handler';
import {
    ValidationError,
    NotFoundError,
    UnauthorizedError,
    ForbiddenError,
    ConflictError,
    RateLimitError,
    ExternalServiceError,
    AppError,
} from '@/lib/utils/error-handler';

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
                };
            }),
        },
    };
});

describe('API Error Integration Tests', () => {
    describe('withGlobalErrorHandler', () => {
        it('should handle successful responses', async () => {
            const req = new NextRequest('http://localhost/api/test');

            const response = await withGlobalErrorHandler(req, async () => {
                return NextResponse.json({ success: true, data: 'test' });
            });

            expect(response.status).toBe(200);
            const data = await response.json();
            expect(data).toEqual({ success: true, data: 'test' });
        });

        it('should handle ValidationError with 422 status', async () => {
            const req = new NextRequest('http://localhost/api/test');

            const response = await withGlobalErrorHandler(req, async () => {
                throw new ValidationError(
                    'Invalid input',
                    {
                        email: ['Invalid email format'],
                        price: ['Must be greater than 0'],
                    }
                );
            });

            expect(response.status).toBe(422);
            const data = await response.json();
            expect(data.success).toBe(false);
            expect(data.error.code).toBe('VALIDATION_ERROR');
            // ValidationError uses default user message
            expect(data.error.message).toContain('invalid');
            expect(data.error.details.fields).toEqual({
                email: ['Invalid email format'],
                price: ['Must be greater than 0'],
            });
            expect(data.meta.requestId).toBeDefined();
            expect(data.meta.timestamp).toBeDefined();
        });

        it('should handle NotFoundError with 404 status', async () => {
            const req = new NextRequest('http://localhost/api/test');

            const response = await withGlobalErrorHandler(req, async () => {
                throw new NotFoundError('Product', 'prod_123');
            });

            expect(response.status).toBe(404);
            const data = await response.json();
            expect(data.success).toBe(false);
            expect(data.error.code).toBe('NOT_FOUND');
            expect(data.error.details.resourceType).toBe('Product');
            expect(data.error.details.resourceId).toBe('prod_123');
        });

        it('should handle UnauthorizedError with 401 status', async () => {
            const req = new NextRequest('http://localhost/api/test');

            const response = await withGlobalErrorHandler(req, async () => {
                throw new UnauthorizedError('Authentication required');
            });

            expect(response.status).toBe(401);
            const data = await response.json();
            expect(data.success).toBe(false);
            expect(data.error.code).toBe('UNAUTHORIZED');
        });

        it('should handle ForbiddenError with 403 status', async () => {
            const req = new NextRequest('http://localhost/api/test');

            const response = await withGlobalErrorHandler(req, async () => {
                throw new ForbiddenError('Insufficient permissions', 'admin');
            });

            expect(response.status).toBe(403);
            const data = await response.json();
            expect(data.success).toBe(false);
            expect(data.error.code).toBe('FORBIDDEN');
        });

        it('should handle ConflictError with 409 status', async () => {
            const req = new NextRequest('http://localhost/api/test');

            const response = await withGlobalErrorHandler(req, async () => {
                throw new ConflictError('Resource already exists', 'user_123');
            });

            expect(response.status).toBe(409);
            const data = await response.json();
            expect(data.success).toBe(false);
            expect(data.error.code).toBe('CONFLICT');
        });

        it('should handle RateLimitError with 429 status', async () => {
            const req = new NextRequest('http://localhost/api/test');

            const response = await withGlobalErrorHandler(req, async () => {
                throw new RateLimitError(100, 3600);
            });

            expect(response.status).toBe(429);
            const data = await response.json();
            expect(data.success).toBe(false);
            expect(data.error.code).toBe('RATE_LIMIT_EXCEEDED');
        });

        it('should handle ExternalServiceError with 502 status', async () => {
            const req = new NextRequest('http://localhost/api/test');

            const response = await withGlobalErrorHandler(req, async () => {
                throw new ExternalServiceError(
                    'OpenCart',
                    'Failed to connect',
                    { isRetryable: true, retryAfter: 60 }
                );
            });

            expect(response.status).toBe(502);
            const data = await response.json();
            expect(data.success).toBe(false);
            expect(data.error.code).toBe('EXTERNAL_SERVICE_ERROR');
        });

        it('should wrap non-AppError errors', async () => {
            const req = new NextRequest('http://localhost/api/test');

            const response = await withGlobalErrorHandler(req, async () => {
                throw new Error('Unexpected error');
            });

            expect(response.status).toBe(500);
            const data = await response.json();
            expect(data.success).toBe(false);
            expect(data.error.code).toBe('INTERNAL_ERROR');
            // Generic errors use default user message
            expect(data.error.message).toContain('went wrong');
        });

        it('should include request ID in response', async () => {
            const req = new NextRequest('http://localhost/api/test', {
                headers: {
                    'x-request-id': 'test-request-123',
                },
            });

            const response = await withGlobalErrorHandler(req, async () => {
                throw new ValidationError('Test error', {});
            });

            const data = await response.json();
            expect(data.meta.requestId).toBe('test-request-123');
        });

        it('should generate request ID if not provided', async () => {
            const req = new NextRequest('http://localhost/api/test');

            const response = await withGlobalErrorHandler(req, async () => {
                throw new ValidationError('Test error', {});
            });

            const data = await response.json();
            expect(data.meta.requestId).toBeDefined();
            expect(typeof data.meta.requestId).toBe('string');
            expect(data.meta.requestId.length).toBeGreaterThan(0);
        });

        it('should include X-Request-ID header in response', async () => {
            const req = new NextRequest('http://localhost/api/test');

            const response = await withGlobalErrorHandler(req, async () => {
                throw new ValidationError('Test error', {});
            });

            const requestId = response.headers.get('X-Request-ID');
            expect(requestId).toBeDefined();
            expect(typeof requestId).toBe('string');
        });
    });

    describe('withErrorHandling', () => {
        it('should work with existing middleware patterns', async () => {
            const handler = withErrorHandling(async (req: NextRequest) => {
                throw new ValidationError('Test error', { field: ['Error'] });
            });

            const req = new NextRequest('http://localhost/api/test');
            const response = await handler(req);

            expect(response.status).toBe(422);
            const data = await response.json();
            expect(data.success).toBe(false);
            expect(data.error.code).toBe('VALIDATION_ERROR');
        });

        it('should pass through successful responses', async () => {
            const handler = withErrorHandling(async (req: NextRequest) => {
                return NextResponse.json({ success: true, data: 'test' });
            });

            const req = new NextRequest('http://localhost/api/test');
            const response = await handler(req);

            expect(response.status).toBe(200);
            const data = await response.json();
            expect(data).toEqual({ success: true, data: 'test' });
        });

        it('should handle errors with context', async () => {
            const handler = withErrorHandling(async (req: NextRequest) => {
                throw new AppError(
                    'Test error',
                    500,
                    'TEST_ERROR',
                    {
                        context: {
                            tenantId: 'tenant_123',
                            userId: 'user_456',
                            operation: 'testOperation',
                        },
                    }
                );
            });

            const req = new NextRequest('http://localhost/api/test');
            const response = await handler(req);

            expect(response.status).toBe(500);
            const data = await response.json();
            expect(data.success).toBe(false);
            expect(data.error.code).toBe('TEST_ERROR');
        });
    });

    describe('Error Response Format', () => {
        it('should return standardized error response format', async () => {
            const req = new NextRequest('http://localhost/api/test');

            const response = await withGlobalErrorHandler(req, async () => {
                throw new ValidationError('Test error', { field: ['Error'] });
            });

            const data = await response.json();

            // Verify structure
            expect(data).toHaveProperty('success');
            expect(data).toHaveProperty('error');
            expect(data).toHaveProperty('meta');

            expect(data.success).toBe(false);

            expect(data.error).toHaveProperty('code');
            expect(data.error).toHaveProperty('message');

            expect(data.meta).toHaveProperty('requestId');
            expect(data.meta).toHaveProperty('timestamp');

            // Verify types
            expect(typeof data.error.code).toBe('string');
            expect(typeof data.error.message).toBe('string');
            expect(typeof data.meta.requestId).toBe('string');
            expect(typeof data.meta.timestamp).toBe('string');
        });

        it('should include details for specific error types', async () => {
            const req = new NextRequest('http://localhost/api/test');

            const response = await withGlobalErrorHandler(req, async () => {
                throw new ValidationError(
                    'Validation failed',
                    {
                        email: ['Invalid format'],
                        password: ['Too short'],
                    }
                );
            });

            const data = await response.json();
            expect(data.error.details).toBeDefined();
            expect(data.error.details.fields).toEqual({
                email: ['Invalid format'],
                password: ['Too short'],
            });
        });
    });

    describe('Development vs Production Mode', () => {
        const originalEnv = process.env.NODE_ENV;

        afterEach(() => {
            process.env.NODE_ENV = originalEnv;
        });

        it('should include developer message in development mode', async () => {
            process.env.NODE_ENV = 'development';

            const req = new NextRequest('http://localhost/api/test');

            const response = await withGlobalErrorHandler(req, async () => {
                throw new AppError(
                    'Test error',
                    500,
                    'TEST_ERROR',
                    {
                        developerMessage: 'This is a technical detail',
                    }
                );
            });

            const data = await response.json();
            expect(data.error.details?.developerMessage).toBe('This is a technical detail');
        });

        it('should not include developer message in production mode', async () => {
            // Create a new GlobalErrorHandler instance with production mode explicitly set
            const { GlobalErrorHandler } = require('@/lib/middleware/global-error-handler');
            const productionHandler = new GlobalErrorHandler(undefined, false); // isDevelopment = false

            const req = new NextRequest('http://localhost/api/test');

            const response = productionHandler.handleError(
                new AppError(
                    'Test error',
                    500,
                    'TEST_ERROR',
                    {
                        developerMessage: 'This is a technical detail',
                    }
                ),
                req
            );

            const data = await response.json();
            expect(data.error.details?.developerMessage).toBeUndefined();
        });
    });

    describe('Error Chaining', () => {
        it('should preserve original error as cause', async () => {
            const req = new NextRequest('http://localhost/api/test');

            const originalError = new Error('Original error');

            const response = await withGlobalErrorHandler(req, async () => {
                throw new AppError(
                    'Wrapped error',
                    500,
                    'WRAPPED_ERROR',
                    {
                        cause: originalError,
                    }
                );
            });

            expect(response.status).toBe(500);
            const data = await response.json();
            expect(data.error.code).toBe('WRAPPED_ERROR');
            // AppError uses default user message
            expect(data.error.message).toContain('unexpected');
        });
    });
});
