/**
 * Tests for encryption audit logging
 */

import {
    logTokenEncrypted,
    logTokenDecrypted,
    logTokenMigrated,
    logDecryptionFailed,
    logKeyAccessed,
    logKeyValidated,
    logEncryptionFailed,
} from '@/lib/services/encryption/audit-logger';
import { DecryptionError } from '@/lib/services/encryption/errors';

// Mock the logger to prevent console output during tests
jest.mock('@/lib/logger', () => ({
    logger: {
        info: jest.fn(),
        error: jest.fn(),
        debug: jest.fn(),
    },
}));

// Mock Prisma to prevent database calls during tests
jest.mock('@/lib/prisma', () => ({
    prisma: {
        tenantAuditLog: {
            create: jest.fn().mockResolvedValue({ id: 'test-log-id' }),
        },
    },
}));

describe('Encryption Audit Logger', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('logTokenEncrypted', () => {
        it('should log token encryption event', async () => {
            const tenantId = 'tenant-123';
            const userId = 'user-456';
            const websiteId = 'website-789';

            await logTokenEncrypted(tenantId, userId, websiteId);

            // Verify logger was called
            const { logger } = require('@/lib/logger');
            expect(logger.info).toHaveBeenCalledWith(
                'API token encrypted',
                expect.objectContaining({
                    event: 'TOKEN_ENCRYPTED',
                    tenantId,
                    userId,
                    websiteId,
                })
            );

            // Verify database audit log was created
            const { prisma } = require('@/lib/prisma');
            expect(prisma.tenantAuditLog.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        tenantId,
                        userId,
                        action: 'TOKEN_ENCRYPTED',
                        entityId: websiteId,
                    }),
                })
            );
        });

        it('should handle logging failures gracefully', async () => {
            const { prisma } = require('@/lib/prisma');
            prisma.tenantAuditLog.create.mockRejectedValueOnce(
                new Error('Database error')
            );

            // Should not throw
            await expect(
                logTokenEncrypted('tenant-123', 'user-456', 'website-789')
            ).resolves.not.toThrow();

            // Should log the error
            const { logger } = require('@/lib/logger');
            expect(logger.error).toHaveBeenCalledWith(
                'Failed to log token encryption event',
                expect.any(Object)
            );
        });
    });

    describe('logTokenDecrypted', () => {
        it('should log token decryption event', async () => {
            const tenantId = 'tenant-123';
            const websiteId = 'website-789';
            const purpose = 'product_sync';

            await logTokenDecrypted(tenantId, websiteId, purpose);

            // Verify logger was called
            const { logger } = require('@/lib/logger');
            expect(logger.info).toHaveBeenCalledWith(
                'API token decrypted',
                expect.objectContaining({
                    event: 'TOKEN_DECRYPTED',
                    tenantId,
                    websiteId,
                    purpose,
                })
            );

            // Verify database audit log was created
            const { prisma } = require('@/lib/prisma');
            expect(prisma.tenantAuditLog.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        tenantId,
                        action: 'TOKEN_DECRYPTED',
                        entityId: websiteId,
                    }),
                })
            );
        });
    });

    describe('logTokenMigrated', () => {
        it('should log token migration event', async () => {
            const tenantId = 'tenant-123';
            const websiteId = 'website-789';

            await logTokenMigrated(tenantId, websiteId);

            // Verify logger was called
            const { logger } = require('@/lib/logger');
            expect(logger.info).toHaveBeenCalledWith(
                'Plaintext token migrated to encrypted format',
                expect.objectContaining({
                    event: 'TOKEN_MIGRATED',
                    tenantId,
                    websiteId,
                })
            );

            // Verify database audit log was created
            const { prisma } = require('@/lib/prisma');
            expect(prisma.tenantAuditLog.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        tenantId,
                        action: 'TOKEN_MIGRATED',
                        entityId: websiteId,
                    }),
                })
            );
        });
    });

    describe('logDecryptionFailed', () => {
        it('should log decryption failure as security event', async () => {
            const tenantId = 'tenant-123';
            const websiteId = 'website-789';
            const error = new DecryptionError('Decryption failed');

            await logDecryptionFailed(tenantId, websiteId, error);

            // Verify logger was called with error level
            const { logger } = require('@/lib/logger');
            expect(logger.error).toHaveBeenCalledWith(
                'Token decryption failed - security event',
                expect.objectContaining({
                    event: 'DECRYPTION_FAILED',
                    tenantId,
                    websiteId,
                    errorType: 'DecryptionError',
                    errorMessage: 'Decryption failed',
                })
            );

            // Verify database audit log was created
            const { prisma } = require('@/lib/prisma');
            expect(prisma.tenantAuditLog.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        tenantId,
                        action: 'DECRYPTION_FAILED',
                        entityId: websiteId,
                    }),
                })
            );
        });
    });

    describe('logKeyAccessed', () => {
        it('should log key access event', () => {
            const operation = 'encrypt';

            logKeyAccessed(operation);

            // Verify logger was called
            const { logger } = require('@/lib/logger');
            expect(logger.debug).toHaveBeenCalledWith(
                'Encryption key accessed',
                expect.objectContaining({
                    event: 'KEY_ACCESSED',
                    operation,
                })
            );
        });

        it('should handle logging failures gracefully', () => {
            const { logger } = require('@/lib/logger');
            logger.debug.mockImplementationOnce(() => {
                throw new Error('Logger error');
            });

            // Should not throw
            expect(() => logKeyAccessed('encrypt')).not.toThrow();
        });
    });

    describe('logKeyValidated', () => {
        it('should log successful key validation', () => {
            logKeyValidated(true);

            // Verify logger was called
            const { logger } = require('@/lib/logger');
            expect(logger.info).toHaveBeenCalledWith(
                'Encryption key validated successfully',
                expect.objectContaining({
                    event: 'KEY_VALIDATED',
                })
            );
        });

        it('should log failed key validation', () => {
            const errorMessage = 'Invalid key length';

            logKeyValidated(false, errorMessage);

            // Verify logger was called with error level
            const { logger } = require('@/lib/logger');
            expect(logger.error).toHaveBeenCalledWith(
                'Encryption key validation failed',
                expect.objectContaining({
                    event: 'KEY_VALIDATED',
                    errorMessage,
                })
            );
        });
    });

    describe('logEncryptionFailed', () => {
        it('should log encryption failure', async () => {
            const tenantId = 'tenant-123';
            const userId = 'user-456';
            const websiteId = 'website-789';
            const error = new Error('Encryption failed');

            await logEncryptionFailed(tenantId, userId, websiteId, error);

            // Verify logger was called with error level
            const { logger } = require('@/lib/logger');
            expect(logger.error).toHaveBeenCalledWith(
                'Token encryption failed',
                expect.objectContaining({
                    event: 'ENCRYPTION_FAILED',
                    tenantId,
                    userId,
                    websiteId,
                    errorType: 'Error',
                    errorMessage: 'Encryption failed',
                })
            );

            // Verify database audit log was created
            const { prisma } = require('@/lib/prisma');
            expect(prisma.tenantAuditLog.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        tenantId,
                        userId,
                        action: 'ENCRYPTION_FAILED',
                        entityId: websiteId,
                    }),
                })
            );
        });
    });

    describe('Security: No sensitive data in logs', () => {
        it('should never log plaintext tokens', async () => {
            const { logger } = require('@/lib/logger');
            const { prisma } = require('@/lib/prisma');

            await logTokenEncrypted('tenant-123', 'user-456', 'website-789');
            await logTokenDecrypted('tenant-123', 'website-789', 'sync');
            await logTokenMigrated('tenant-123', 'website-789');

            // Check all logger calls
            const allLoggerCalls = [
                ...logger.info.mock.calls,
                ...logger.error.mock.calls,
                ...logger.debug.mock.calls,
            ];

            // Verify no calls contain sensitive patterns
            allLoggerCalls.forEach((call) => {
                const callString = JSON.stringify(call);
                expect(callString).not.toMatch(/api[_-]?token/i);
                expect(callString).not.toMatch(/password/i);
                expect(callString).not.toMatch(/secret/i);
            });

            // Check all database calls
            const allDbCalls = prisma.tenantAuditLog.create.mock.calls;
            allDbCalls.forEach((call) => {
                const callString = JSON.stringify(call);
                expect(callString).not.toMatch(/plaintext/i);
            });
        });

        it('should never log encryption keys', () => {
            const { logger } = require('@/lib/logger');

            logKeyAccessed('encrypt');
            logKeyValidated(true);
            logKeyValidated(false, 'Invalid key');

            // Check all logger calls
            const allLoggerCalls = [
                ...logger.info.mock.calls,
                ...logger.error.mock.calls,
                ...logger.debug.mock.calls,
            ];

            // Verify no calls contain key patterns
            allLoggerCalls.forEach((call) => {
                const callString = JSON.stringify(call);
                expect(callString).not.toMatch(/[A-Za-z0-9+/]{40,}={0,2}/); // Base64 pattern
                expect(callString).not.toMatch(/ENCRYPTION_MASTER_KEY/);
            });
        });
    });
});
