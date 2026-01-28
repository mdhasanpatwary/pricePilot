/**
 * Tests for MigrationUtility
 * Validates batch migration functionality
 */

import { MigrationUtility, MigrationOptions, MigrationResult } from '@/lib/services/encryption/migration-utility';
import { EncryptionService } from '@/lib/services/encryption/encryption-service';
import { KeyManager } from '@/lib/services/encryption/key-manager';
import { prisma } from '@/lib/prisma';

// Mock dependencies
jest.mock('@/lib/prisma', () => ({
    prisma: {
        site: {
            findMany: jest.fn(),
            update: jest.fn(),
        },
        $transaction: jest.fn(),
        tenantAuditLog: {
            create: jest.fn(),
        },
    },
}));

jest.mock('@/lib/logger', () => ({
    logger: {
        info: jest.fn(),
        debug: jest.fn(),
        error: jest.fn(),
    },
}));

describe('MigrationUtility', () => {
    let migrationUtility: MigrationUtility;
    let encryptionService: EncryptionService;

    beforeAll(() => {
        // Set up encryption key for tests
        process.env.ENCRYPTION_MASTER_KEY = Buffer.from('a'.repeat(32)).toString('base64');
    });

    beforeEach(() => {
        migrationUtility = new MigrationUtility();
        const keyManager = new KeyManager();
        encryptionService = new EncryptionService(keyManager);
        jest.clearAllMocks();
    });

    describe('migrateAllTokens', () => {
        it('should migrate plaintext tokens successfully', async () => {
            const mockSites = [
                {
                    id: 'site-1',
                    tenantId: 'tenant-1',
                    apiToken: 'plaintext-token-1',
                },
                {
                    id: 'site-2',
                    tenantId: 'tenant-1',
                    apiToken: 'plaintext-token-2',
                },
            ];

            (prisma.site.findMany as jest.Mock).mockResolvedValue(mockSites);
            (prisma.$transaction as jest.Mock).mockImplementation(async (callback) => {
                return callback({
                    site: {
                        update: jest.fn().mockResolvedValue({}),
                    },
                    tenantAuditLog: {
                        create: jest.fn().mockResolvedValue({}),
                    },
                });
            });

            const options: MigrationOptions = {
                dryRun: false,
                batchSize: 10,
                continueOnError: true,
            };

            const result = await migrationUtility.migrateAllTokens(options);

            expect(result.total).toBe(2);
            expect(result.migrated).toBe(2);
            expect(result.failed).toBe(0);
            expect(result.skipped).toBe(0);
            expect(result.errors).toHaveLength(0);
        });

        it('should skip already encrypted tokens', async () => {
            const encryptedToken = encryptionService.encrypt('test-token');

            const mockSites = [
                {
                    id: 'site-1',
                    tenantId: 'tenant-1',
                    apiToken: encryptedToken,
                },
            ];

            (prisma.site.findMany as jest.Mock).mockResolvedValue(mockSites);

            const options: MigrationOptions = {
                dryRun: false,
                batchSize: 10,
                continueOnError: true,
            };

            const result = await migrationUtility.migrateAllTokens(options);

            expect(result.total).toBe(1);
            expect(result.migrated).toBe(0);
            expect(result.skipped).toBe(1);
            expect(result.failed).toBe(0);
        });

        it('should handle dry run mode', async () => {
            const mockSites = [
                {
                    id: 'site-1',
                    tenantId: 'tenant-1',
                    apiToken: 'plaintext-token',
                },
            ];

            (prisma.site.findMany as jest.Mock).mockResolvedValue(mockSites);

            const options: MigrationOptions = {
                dryRun: true,
                batchSize: 10,
                continueOnError: true,
            };

            const result = await migrationUtility.migrateAllTokens(options);

            expect(result.total).toBe(1);
            expect(result.migrated).toBe(1);
            expect(result.failed).toBe(0);
            expect(prisma.$transaction).not.toHaveBeenCalled();
        });

        it('should continue on error when configured', async () => {
            const mockSites = [
                {
                    id: 'site-1',
                    tenantId: 'tenant-1',
                    apiToken: 'plaintext-token-1',
                },
                {
                    id: 'site-2',
                    tenantId: 'tenant-1',
                    apiToken: 'plaintext-token-2',
                },
            ];

            (prisma.site.findMany as jest.Mock).mockResolvedValue(mockSites);
            (prisma.$transaction as jest.Mock)
                .mockRejectedValueOnce(new Error('Database error'))
                .mockImplementation(async (callback) => {
                    return callback({
                        site: {
                            update: jest.fn().mockResolvedValue({}),
                        },
                        tenantAuditLog: {
                            create: jest.fn().mockResolvedValue({}),
                        },
                    });
                });

            const options: MigrationOptions = {
                dryRun: false,
                batchSize: 10,
                continueOnError: true,
            };

            const result = await migrationUtility.migrateAllTokens(options);

            expect(result.total).toBe(2);
            expect(result.migrated).toBe(1);
            expect(result.failed).toBe(1);
            expect(result.errors).toHaveLength(1);
            expect(result.errors[0].websiteId).toBe('site-1');
        });

        it('should stop on error when configured', async () => {
            const mockSites = [
                {
                    id: 'site-1',
                    tenantId: 'tenant-1',
                    apiToken: 'plaintext-token-1',
                },
                {
                    id: 'site-2',
                    tenantId: 'tenant-1',
                    apiToken: 'plaintext-token-2',
                },
            ];

            (prisma.site.findMany as jest.Mock).mockResolvedValue(mockSites);
            (prisma.$transaction as jest.Mock).mockRejectedValue(new Error('Database error'));

            const options: MigrationOptions = {
                dryRun: false,
                batchSize: 10,
                continueOnError: false,
            };

            const result = await migrationUtility.migrateAllTokens(options);

            expect(result.total).toBe(2);
            expect(result.migrated).toBe(0);
            expect(result.failed).toBe(1);
            expect(result.errors).toHaveLength(1);
        });
    });

    describe('migrateToken', () => {
        it('should return false for already encrypted tokens', async () => {
            const encryptedToken = encryptionService.encrypt('test-token');

            const result = await migrationUtility.migrateToken(
                'site-1',
                'tenant-1',
                encryptedToken,
                false
            );

            expect(result).toBe(false);
        });

        it('should return true for plaintext tokens in dry run', async () => {
            const result = await migrationUtility.migrateToken(
                'site-1',
                'tenant-1',
                'plaintext-token',
                true
            );

            expect(result).toBe(true);
            expect(prisma.$transaction).not.toHaveBeenCalled();
        });

        it('should encrypt and update plaintext tokens', async () => {
            (prisma.$transaction as jest.Mock).mockImplementation(async (callback) => {
                return callback({
                    site: {
                        update: jest.fn().mockResolvedValue({}),
                    },
                    tenantAuditLog: {
                        create: jest.fn().mockResolvedValue({}),
                    },
                });
            });

            const result = await migrationUtility.migrateToken(
                'site-1',
                'tenant-1',
                'plaintext-token',
                false
            );

            expect(result).toBe(true);
            expect(prisma.$transaction).toHaveBeenCalled();
        });
    });

    describe('generateReport', () => {
        it('should generate a formatted report', () => {
            const result: MigrationResult = {
                total: 10,
                migrated: 8,
                failed: 1,
                skipped: 1,
                errors: [
                    {
                        websiteId: 'site-1',
                        tenantId: 'tenant-1',
                        error: 'Test error',
                        timestamp: new Date('2024-01-01T00:00:00Z'),
                    },
                ],
                durationMs: 5000,
            };

            const report = migrationUtility.generateReport(result);

            expect(report).toContain('API Token Migration Report');
            expect(report).toContain('Total websites checked: 10');
            expect(report).toContain('Successfully migrated:  8');
            expect(report).toContain('Already encrypted:      1');
            expect(report).toContain('Failed:                 1');
            expect(report).toContain('Duration:               5.00s');
            expect(report).toContain('Success Rate: 90.0%');
            expect(report).toContain('Website ID: site-1');
            expect(report).toContain('Test error');
        });

        it('should handle zero total gracefully', () => {
            const result: MigrationResult = {
                total: 0,
                migrated: 0,
                failed: 0,
                skipped: 0,
                errors: [],
                durationMs: 100,
            };

            const report = migrationUtility.generateReport(result);

            expect(report).toContain('Success Rate: 0.0%');
            expect(report).toContain('No errors encountered');
        });
    });

    describe('generateJsonReport', () => {
        it('should generate a JSON report', () => {
            const result: MigrationResult = {
                total: 5,
                migrated: 4,
                failed: 0,
                skipped: 1,
                errors: [],
                durationMs: 2000,
            };

            const jsonReport = migrationUtility.generateJsonReport(result);
            const parsed = JSON.parse(jsonReport);

            expect(parsed.total).toBe(5);
            expect(parsed.migrated).toBe(4);
            expect(parsed.failed).toBe(0);
            expect(parsed.skipped).toBe(1);
            expect(parsed.durationMs).toBe(2000);
        });
    });
});
