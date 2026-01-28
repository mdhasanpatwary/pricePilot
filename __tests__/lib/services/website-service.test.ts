/**
 * Tests for WebsiteService with encryption integration
 */

import { WebsiteService } from '@/lib/services/website-service';
import { prisma } from '@/lib/prisma';
import { EncryptionService } from '@/lib/services/encryption/encryption-service';
// import { KeyManager } from '@/lib/services/encryption/key-manager';
import { EncryptionError, DecryptionError } from '@/lib/services/encryption/errors';
import { tokenCache } from '@/lib/services/encryption/token-cache';

// Mock Prisma
jest.mock('@/lib/prisma', () => ({
    prisma: {
        $transaction: jest.fn(),
        site: {
            findFirst: jest.fn(),
            findUnique: jest.fn(),
            create: jest.fn(),
            update: jest.fn(),
        },
        tenantAuditLog: {
            create: jest.fn(),
        },
    },
}));

// Mock encryption service
jest.mock('@/lib/services/encryption/key-manager');
jest.mock('@/lib/services/encryption/encryption-service');

describe('WebsiteService', () => {
    const mockTenantId = 'tenant-123';
    const mockUserId = 'user-123';
    const mockSiteId = 'site-123';
    const mockPlaintextToken = 'my-secret-api-token';
    const mockEncryptedToken = 'aes-256-gcm:abc123:def456:ghi789';

    beforeEach(() => {
        jest.clearAllMocks();
        tokenCache.clear();

        // Setup encryption service mock
        (EncryptionService.prototype.encrypt as jest.Mock).mockReturnValue(mockEncryptedToken);
        (EncryptionService.prototype.decrypt as jest.Mock).mockReturnValue(mockPlaintextToken);
        (EncryptionService.prototype.isEncrypted as jest.Mock).mockImplementation((value: string) => {
            return value.startsWith('aes-256-gcm:');
        });
    });

    describe('createWebsite', () => {
        it('should encrypt API token before saving to database', async () => {
            const mockSite = {
                id: mockSiteId,
                tenantId: mockTenantId,
                platform: 'OPENCART',
                type: 'USER',
                baseUrl: 'https://example.com',
                apiToken: mockEncryptedToken,
                searchQueryPattern: null,
            };

            // Mock transaction
            (prisma.$transaction as jest.Mock).mockImplementation(async (callback) => {
                const tx = {
                    site: {
                        create: jest.fn().mockResolvedValue(mockSite),
                    },
                    tenantAuditLog: {
                        create: jest.fn().mockResolvedValue({ id: 'log-1' }),
                    },
                };
                return callback(tx);
            });

            const result = await WebsiteService.createWebsite(
                {
                    tenantId: mockTenantId,
                    platform: 'OPENCART',
                    type: 'USER',
                    baseUrl: 'https://example.com',
                    apiToken: mockPlaintextToken,
                    searchQueryPattern: null,
                },
                mockUserId
            );

            expect(result.apiToken).toBe(mockEncryptedToken);
            expect(EncryptionService.prototype.encrypt).toHaveBeenCalledWith(mockPlaintextToken);
        });

        it('should handle encryption failure gracefully', async () => {
            const encryptionError = new EncryptionError('Encryption failed');
            (EncryptionService.prototype.encrypt as jest.Mock).mockImplementation(() => {
                throw encryptionError;
            });

            // Mock transaction
            (prisma.$transaction as jest.Mock).mockImplementation(async (callback) => {
                const tx = {
                    site: {
                        create: jest.fn(),
                    },
                    tenantAuditLog: {
                        create: jest.fn().mockResolvedValue({ id: 'log-1' }),
                    },
                };
                return callback(tx);
            });

            await expect(
                WebsiteService.createWebsite(
                    {
                        tenantId: mockTenantId,
                        platform: 'OPENCART',
                        type: 'USER',
                        baseUrl: 'https://example.com',
                        apiToken: mockPlaintextToken,
                        searchQueryPattern: null,
                    },
                    mockUserId
                )
            ).rejects.toThrow(EncryptionError);
        });

        it('should create site without token if apiToken is null', async () => {
            const mockSite = {
                id: mockSiteId,
                tenantId: mockTenantId,
                platform: 'OPENCART',
                type: 'USER',
                baseUrl: 'https://example.com',
                apiToken: null,
                searchQueryPattern: null,
            };

            // Mock transaction
            (prisma.$transaction as jest.Mock).mockImplementation(async (callback) => {
                const tx = {
                    site: {
                        create: jest.fn().mockResolvedValue(mockSite),
                    },
                    tenantAuditLog: {
                        create: jest.fn(),
                    },
                };
                return callback(tx);
            });

            const result = await WebsiteService.createWebsite(
                {
                    tenantId: mockTenantId,
                    platform: 'OPENCART',
                    type: 'USER',
                    baseUrl: 'https://example.com',
                    apiToken: null,
                    searchQueryPattern: null,
                },
                mockUserId
            );

            expect(result.apiToken).toBeNull();
            expect(EncryptionService.prototype.encrypt).not.toHaveBeenCalled();
        });
    });

    describe('updateWebsite', () => {
        it('should re-encrypt API token when updated', async () => {
            const existingSite = {
                id: mockSiteId,
                tenantId: mockTenantId,
                platform: 'OPENCART',
                type: 'USER',
                baseUrl: 'https://example.com',
                apiToken: 'old-encrypted-token',
            };

            const updatedSite = {
                ...existingSite,
                apiToken: mockEncryptedToken,
            };

            // Mock transaction
            (prisma.$transaction as jest.Mock).mockImplementation(async (callback) => {
                const tx = {
                    site: {
                        findFirst: jest.fn().mockResolvedValue(existingSite),
                        update: jest.fn().mockResolvedValue(updatedSite),
                    },
                    tenantAuditLog: {
                        create: jest.fn().mockResolvedValue({ id: 'log-1' }),
                    },
                };
                return callback(tx);
            });

            const result = await WebsiteService.updateWebsite(
                mockSiteId,
                { apiToken: mockPlaintextToken },
                mockTenantId,
                mockUserId
            );

            expect(result.apiToken).toBe(mockEncryptedToken);
            expect(EncryptionService.prototype.encrypt).toHaveBeenCalledWith(mockPlaintextToken);
        });

        it('should not encrypt if apiToken is not being updated', async () => {
            const existingSite = {
                id: mockSiteId,
                tenantId: mockTenantId,
                platform: 'OPENCART',
                type: 'USER',
                baseUrl: 'https://example.com',
                apiToken: mockEncryptedToken,
            };

            const updatedSite = {
                ...existingSite,
                baseUrl: 'https://newexample.com',
            };

            // Mock transaction
            (prisma.$transaction as jest.Mock).mockImplementation(async (callback) => {
                const tx = {
                    site: {
                        findFirst: jest.fn().mockResolvedValue(existingSite),
                        update: jest.fn().mockResolvedValue(updatedSite),
                    },
                    tenantAuditLog: {
                        create: jest.fn(),
                    },
                };
                return callback(tx);
            });

            await WebsiteService.updateWebsite(
                mockSiteId,
                { baseUrl: 'https://newexample.com' },
                mockTenantId,
                mockUserId
            );

            expect(EncryptionService.prototype.encrypt).not.toHaveBeenCalled();
        });
    });

    describe('getWebsiteWithToken', () => {
        it('should decrypt encrypted token', async () => {
            const mockSite = {
                id: mockSiteId,
                tenantId: mockTenantId,
                platform: 'OPENCART',
                type: 'USER',
                baseUrl: 'https://example.com',
                apiToken: mockEncryptedToken,
            };

            (prisma.site.findFirst as jest.Mock).mockResolvedValue(mockSite);
            // (prisma.auditLog.create as jest.Mock).mockResolvedValue({ id: 'log-1' });

            const result = await WebsiteService.getWebsiteWithToken(
                mockSiteId,
                mockTenantId,
                'test_purpose'
            );

            expect(result.decryptedToken).toBe(mockPlaintextToken);
            expect(EncryptionService.prototype.decrypt).toHaveBeenCalledWith(mockEncryptedToken);
            expect(EncryptionService.prototype.isEncrypted).toHaveBeenCalledWith(mockEncryptedToken);
        });

        it('should migrate plaintext token to encrypted format', async () => {
            const mockSite = {
                id: mockSiteId,
                tenantId: mockTenantId,
                platform: 'OPENCART',
                type: 'USER',
                baseUrl: 'https://example.com',
                apiToken: mockPlaintextToken, // Plaintext token
            };

            (prisma.site.findFirst as jest.Mock).mockResolvedValue(mockSite);
            (EncryptionService.prototype.isEncrypted as jest.Mock).mockReturnValue(false);

            // Mock transaction for migration
            (prisma.$transaction as jest.Mock).mockImplementation(async (callback) => {
                const tx = {
                    site: {
                        update: jest.fn().mockResolvedValue({
                            ...mockSite,
                            apiToken: mockEncryptedToken,
                        }),
                    },
                    tenantAuditLog: {
                        create: jest.fn().mockResolvedValue({ id: 'log-1' }),
                    },
                };
                return callback(tx);
            });

            const result = await WebsiteService.getWebsiteWithToken(
                mockSiteId,
                mockTenantId,
                'test_purpose'
            );

            expect(result.decryptedToken).toBe(mockPlaintextToken);
            expect(EncryptionService.prototype.encrypt).toHaveBeenCalledWith(mockPlaintextToken);
        });

        it('should handle migration failure and continue with plaintext token', async () => {
            const mockSite = {
                id: mockSiteId,
                tenantId: mockTenantId,
                platform: 'OPENCART',
                type: 'USER',
                baseUrl: 'https://example.com',
                apiToken: mockPlaintextToken, // Plaintext token
            };

            (prisma.site.findFirst as jest.Mock).mockResolvedValue(mockSite);
            (EncryptionService.prototype.isEncrypted as jest.Mock).mockReturnValue(false);
            (EncryptionService.prototype.encrypt as jest.Mock).mockImplementation(() => {
                throw new EncryptionError('Encryption failed during migration');
            });
            // (prisma.tenantAuditLog.create as jest.Mock).mockResolvedValue({ id: 'log-1' });

            // Should not throw error, but continue with plaintext token
            const result = await WebsiteService.getWebsiteWithToken(
                mockSiteId,
                mockTenantId,
                'test_purpose'
            );

            expect(result.decryptedToken).toBe(mockPlaintextToken);
            expect(EncryptionService.prototype.encrypt).toHaveBeenCalledWith(mockPlaintextToken);
            expect(prisma.tenantAuditLog.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        action: 'TOKEN_MIGRATION_FAILED',
                    }),
                })
            );
        });

        it('should handle decryption failure', async () => {
            const mockSite = {
                id: mockSiteId,
                tenantId: mockTenantId,
                platform: 'OPENCART',
                type: 'USER',
                baseUrl: 'https://example.com',
                apiToken: mockEncryptedToken,
            };

            (prisma.site.findFirst as jest.Mock).mockResolvedValue(mockSite);
            (EncryptionService.prototype.decrypt as jest.Mock).mockImplementation(() => {
                throw new DecryptionError('Decryption failed');
            });
            // (prisma.tenantAuditLog.create as jest.Mock).mockResolvedValue({ id: 'log-1' });

            await expect(
                WebsiteService.getWebsiteWithToken(mockSiteId, mockTenantId, 'test_purpose')
            ).rejects.toThrow(DecryptionError);
        });

        it('should return null decryptedToken if no apiToken exists', async () => {
            const mockSite = {
                id: mockSiteId,
                tenantId: mockTenantId,
                platform: 'OPENCART',
                type: 'USER',
                baseUrl: 'https://example.com',
                apiToken: null,
            };

            (prisma.site.findFirst as jest.Mock).mockResolvedValue(mockSite);

            const result = await WebsiteService.getWebsiteWithToken(
                mockSiteId,
                mockTenantId,
                'test_purpose'
            );

            expect(result.decryptedToken).toBeNull();
            expect(EncryptionService.prototype.decrypt).not.toHaveBeenCalled();
        });
    });
});
