/**
 * Unit tests for security error audit logging
 * Tests Requirements 4.8
 */

import { ErrorLogger } from '@/lib/utils/error-logger';
import { UnauthorizedError, ForbiddenError, ValidationError } from '@/lib/utils/error-handler';
import { ErrorSanitizer } from '@/lib/utils/error-sanitizer';
import { recordAuditLog } from '@/lib/audit';

// Mock dependencies
jest.mock('@/lib/logger', () => ({
    logger: {
        error: jest.fn(),
        warn: jest.fn(),
        info: jest.fn(),
    },
}));

jest.mock('@/lib/audit', () => ({
    recordAuditLog: jest.fn(),
}));

describe('ErrorLogger - Security Error Audit Logging', () => {
    let errorLogger: ErrorLogger;
    let mockRecordAuditLog: jest.MockedFunction<typeof recordAuditLog>;

    beforeEach(() => {
        jest.clearAllMocks();
        const sanitizer = new ErrorSanitizer();
        errorLogger = new ErrorLogger(require('@/lib/logger').logger, sanitizer);
        mockRecordAuditLog = recordAuditLog as jest.MockedFunction<typeof recordAuditLog>;
    });

    describe('UnauthorizedError audit logging', () => {
        it('should log UnauthorizedError to audit trail with IP and user agent', async () => {
            const error = new UnauthorizedError('Invalid credentials', {
                context: {
                    tenantId: 'tenant-123',
                    userId: 'user-456',
                    operation: 'login',
                    requestId: 'req-789',
                    metadata: {
                        userEmail: 'test@example.com',
                    },
                },
            });

            const request = {
                ip: '192.168.1.1',
                userAgent: 'Mozilla/5.0',
            };

            errorLogger.logError(error, request);

            // Wait for async audit log
            await new Promise(resolve => setTimeout(resolve, 10));

            expect(mockRecordAuditLog).toHaveBeenCalledWith({
                tenantId: 'tenant-123',
                userId: 'user-456',
                userEmail: 'test@example.com',
                action: 'SECURITY_UNAUTHORIZED_ACCESS',
                entityId: 'req-789',
                details: {
                    errorCode: 'UNAUTHORIZED',
                    errorMessage: 'Invalid credentials',
                    operation: 'login',
                    timestamp: expect.any(String),
                    userAgent: 'Mozilla/5.0',
                },
                ipAddress: '192.168.1.1',
            });
        });

        it('should log UnauthorizedError without request info', async () => {
            const error = new UnauthorizedError('Missing token', {
                context: {
                    tenantId: 'tenant-123',
                    userId: 'user-456',
                    operation: 'api-call',
                    requestId: 'req-abc',
                    metadata: {
                        userEmail: 'user@example.com',
                    },
                },
            });

            errorLogger.logError(error);

            // Wait for async audit log
            await new Promise(resolve => setTimeout(resolve, 10));

            expect(mockRecordAuditLog).toHaveBeenCalledWith({
                tenantId: 'tenant-123',
                userId: 'user-456',
                userEmail: 'user@example.com',
                action: 'SECURITY_UNAUTHORIZED_ACCESS',
                entityId: 'req-abc',
                details: {
                    errorCode: 'UNAUTHORIZED',
                    errorMessage: 'Missing token',
                    operation: 'api-call',
                    timestamp: expect.any(String),
                    userAgent: undefined,
                },
                ipAddress: undefined,
            });
        });

        it('should not log UnauthorizedError without tenant context', async () => {
            const error = new UnauthorizedError('No context', {
                context: {
                    userId: 'user-456',
                },
            });

            errorLogger.logError(error);

            // Wait for async audit log
            await new Promise(resolve => setTimeout(resolve, 10));

            expect(mockRecordAuditLog).not.toHaveBeenCalled();
        });

        it('should not log UnauthorizedError without user context', async () => {
            const error = new UnauthorizedError('No user', {
                context: {
                    tenantId: 'tenant-123',
                },
            });

            errorLogger.logError(error);

            // Wait for async audit log
            await new Promise(resolve => setTimeout(resolve, 10));

            expect(mockRecordAuditLog).not.toHaveBeenCalled();
        });
    });

    describe('ForbiddenError audit logging', () => {
        it('should log ForbiddenError to audit trail with required permission', async () => {
            const error = new ForbiddenError(
                'Insufficient permissions',
                'admin:write',
                {
                    context: {
                        tenantId: 'tenant-123',
                        userId: 'user-456',
                        operation: 'delete-user',
                        requestId: 'req-xyz',
                        metadata: {
                            userEmail: 'user@example.com',
                        },
                    },
                }
            );

            const request = {
                ip: '10.0.0.1',
                userAgent: 'Chrome/91.0',
            };

            errorLogger.logError(error, request);

            // Wait for async audit log
            await new Promise(resolve => setTimeout(resolve, 10));

            expect(mockRecordAuditLog).toHaveBeenCalledWith({
                tenantId: 'tenant-123',
                userId: 'user-456',
                userEmail: 'user@example.com',
                action: 'SECURITY_FORBIDDEN_ACCESS',
                entityId: 'req-xyz',
                details: {
                    errorCode: 'FORBIDDEN',
                    errorMessage: 'Insufficient permissions',
                    operation: 'delete-user',
                    timestamp: expect.any(String),
                    userAgent: 'Chrome/91.0',
                    requiredPermission: 'admin:write',
                },
                ipAddress: '10.0.0.1',
            });
        });

        it('should log ForbiddenError without required permission', async () => {
            const error = new ForbiddenError('Access denied', undefined, {
                context: {
                    tenantId: 'tenant-123',
                    userId: 'user-456',
                    operation: 'view-admin',
                    requestId: 'req-def',
                    metadata: {
                        userEmail: 'test@example.com',
                    },
                },
            });

            errorLogger.logError(error);

            // Wait for async audit log
            await new Promise(resolve => setTimeout(resolve, 10));

            expect(mockRecordAuditLog).toHaveBeenCalledWith({
                tenantId: 'tenant-123',
                userId: 'user-456',
                userEmail: 'test@example.com',
                action: 'SECURITY_FORBIDDEN_ACCESS',
                entityId: 'req-def',
                details: {
                    errorCode: 'FORBIDDEN',
                    errorMessage: 'Access denied',
                    operation: 'view-admin',
                    timestamp: expect.any(String),
                    userAgent: undefined,
                },
                ipAddress: undefined,
            });
        });
    });

    describe('Non-security errors', () => {
        it('should not log ValidationError to audit trail', async () => {
            const error = new ValidationError(
                'Invalid input',
                { email: ['Invalid format'] },
                {
                    context: {
                        tenantId: 'tenant-123',
                        userId: 'user-456',
                    },
                }
            );

            errorLogger.logError(error);

            // Wait for async audit log
            await new Promise(resolve => setTimeout(resolve, 10));

            expect(mockRecordAuditLog).not.toHaveBeenCalled();
        });
    });

    describe('Audit logging failures', () => {
        it('should handle audit logging failures gracefully', async () => {
            mockRecordAuditLog.mockRejectedValueOnce(new Error('Audit system down'));

            const error = new UnauthorizedError('Test error', {
                context: {
                    tenantId: 'tenant-123',
                    userId: 'user-456',
                    metadata: {
                        userEmail: 'test@example.com',
                    },
                },
            });

            // Should not throw
            expect(() => errorLogger.logError(error)).not.toThrow();

            // Wait for async audit log
            await new Promise(resolve => setTimeout(resolve, 10));

            // Audit log should have been attempted
            expect(mockRecordAuditLog).toHaveBeenCalled();
        });
    });

    describe('Email fallback', () => {
        it('should use "unknown" email when not provided in metadata', async () => {
            const error = new UnauthorizedError('Test', {
                context: {
                    tenantId: 'tenant-123',
                    userId: 'user-456',
                    requestId: 'req-123',
                },
            });

            errorLogger.logError(error);

            // Wait for async audit log
            await new Promise(resolve => setTimeout(resolve, 10));

            expect(mockRecordAuditLog).toHaveBeenCalledWith(
                expect.objectContaining({
                    userEmail: 'unknown',
                })
            );
        });
    });
});
