/**
 * Archive Manager Tests
 * 
 * Tests for data archival functionality including:
 * - Age-based record selection
 * - Batch archival transaction handling
 * - Referential integrity preservation
 * - Archive query API
 * - Archive statistics
 */

import { PrismaClient } from '@prisma/client';
import { ArchiveManager } from '@/lib/services/archive-manager';

// Mock Prisma Client
const mockPrisma = {
    $transaction: jest.fn(),
    $queryRaw: jest.fn(),
    $queryRawUnsafe: jest.fn(),
    $executeRaw: jest.fn(),
    $executeRawUnsafe: jest.fn(),
} as unknown as PrismaClient;

describe('ArchiveManager', () => {
    let archiveManager: ArchiveManager;

    beforeEach(() => {
        jest.clearAllMocks();
        archiveManager = new ArchiveManager(mockPrisma);
    });

    describe('archivePriceHistory', () => {
        it('should archive records older than specified days', async () => {
            const mockOldRecords = [
                {
                    id: 'ph-1',
                    product_id: 'prod-1',
                    price: 99.99,
                    recorded_at: new Date('2023-01-01'),
                    created_at: new Date('2023-01-01'),
                    tenant_id: 'tenant-1',
                },
            ];

            (mockPrisma.$transaction as jest.Mock).mockImplementation(async (callback: any) => {
                const tx = {
                    $queryRaw: jest.fn().mockResolvedValue(mockOldRecords),
                    $executeRawUnsafe: jest.fn().mockResolvedValue(1),
                    $executeRaw: jest.fn().mockResolvedValue(1),
                };
                return callback(tx);
            });

            const result = await archiveManager.archivePriceHistory(90);

            expect(result.recordsArchived).toBeGreaterThan(0);
            expect(result.recordsDeleted).toBeGreaterThan(0);
            expect(result.durationMs).toBeGreaterThanOrEqual(0);
            expect(result.spaceFreedBytes).toBeGreaterThan(0);
        });

        it('should process records in batches of 10,000', async () => {
            const batchSize = 10000;
            const mockBatch = Array.from({ length: batchSize }, (_, i) => ({
                id: `ph-${i}`,
                product_id: `prod-${i}`,
                price: 99.99,
                recorded_at: new Date('2023-01-01'),
                created_at: new Date('2023-01-01'),
                tenant_id: 'tenant-1',
            }));

            let callCount = 0;
            (mockPrisma.$transaction as jest.Mock).mockImplementation(async (callback: any) => {
                const tx = {
                    $queryRaw: jest.fn().mockResolvedValue(callCount++ === 0 ? mockBatch : []),
                    $executeRawUnsafe: jest.fn().mockResolvedValue(batchSize),
                    $executeRaw: jest.fn().mockResolvedValue(batchSize),
                };
                return callback(tx);
            });

            const result = await archiveManager.archivePriceHistory(90);

            expect(result.recordsArchived).toBe(batchSize);
        });

        it('should handle empty result set', async () => {
            (mockPrisma.$transaction as jest.Mock).mockImplementation(async (callback: any) => {
                const tx = {
                    $queryRaw: jest.fn().mockResolvedValue([]),
                    $executeRawUnsafe: jest.fn(),
                    $executeRaw: jest.fn(),
                };
                return callback(tx);
            });

            const result = await archiveManager.archivePriceHistory(90);

            expect(result.recordsArchived).toBe(0);
            expect(result.recordsDeleted).toBe(0);
        });

        it('should use default retention period of 90 days', async () => {
            (mockPrisma.$transaction as jest.Mock).mockImplementation(async (callback: any) => {
                const tx = {
                    $queryRaw: jest.fn().mockResolvedValue([]),
                    $executeRawUnsafe: jest.fn(),
                    $executeRaw: jest.fn(),
                };
                return callback(tx);
            });

            await archiveManager.archivePriceHistory();

            // Verify transaction was called (default parameter used)
            expect(mockPrisma.$transaction).toHaveBeenCalled();
        });
    });

    describe('archiveAuditLogs', () => {
        it('should archive audit logs older than specified days', async () => {
            const mockOldRecords = [
                {
                    id: 'audit-1',
                    tenant_id: 'tenant-1',
                    user_id: 'user-1',
                    user_email: 'user@example.com',
                    action: 'UPDATE_PRICE',
                    entity_id: 'prod-1',
                    details: 'Updated price',
                    ip_address: '192.168.1.1',
                    created_at: new Date('2022-01-01'),
                },
            ];

            (mockPrisma.$transaction as jest.Mock).mockImplementation(async (callback: any) => {
                const tx = {
                    $queryRaw: jest.fn().mockResolvedValue(mockOldRecords),
                    $executeRawUnsafe: jest.fn().mockResolvedValue(1),
                    $executeRaw: jest.fn().mockResolvedValue(1),
                };
                return callback(tx);
            });

            const result = await archiveManager.archiveAuditLogs(365);

            expect(result.recordsArchived).toBeGreaterThan(0);
            expect(result.recordsDeleted).toBeGreaterThan(0);
            expect(result.durationMs).toBeGreaterThanOrEqual(0);
            expect(result.spaceFreedBytes).toBeGreaterThan(0);
        });

        it('should use default retention period of 365 days', async () => {
            (mockPrisma.$transaction as jest.Mock).mockImplementation(async (callback: any) => {
                const tx = {
                    $queryRaw: jest.fn().mockResolvedValue([]),
                    $executeRawUnsafe: jest.fn(),
                    $executeRaw: jest.fn(),
                };
                return callback(tx);
            });

            await archiveManager.archiveAuditLogs();

            expect(mockPrisma.$transaction).toHaveBeenCalled();
        });
    });

    describe('queryPriceHistoryArchive', () => {
        it('should query archived price history with filters', async () => {
            const mockResults = [
                {
                    id: 'ph-1',
                    product_id: 'prod-1',
                    price: 99.99,
                    recorded_at: new Date('2023-01-01'),
                    created_at: new Date('2023-01-01'),
                    archived_at: new Date('2024-01-01'),
                    tenant_id: 'tenant-1',
                },
            ];

            (mockPrisma.$queryRawUnsafe as jest.Mock).mockResolvedValue(mockResults);

            const results = await archiveManager.queryPriceHistoryArchive({
                tenantId: 'tenant-1',
                productId: 'prod-1',
                startDate: new Date('2023-01-01'),
                endDate: new Date('2023-12-31'),
                limit: 100,
                offset: 0,
            });

            expect(results).toEqual(mockResults);
            expect(mockPrisma.$queryRawUnsafe).toHaveBeenCalled();
        });

        it('should apply tenant filter', async () => {
            (mockPrisma.$queryRawUnsafe as jest.Mock).mockResolvedValue([]);

            await archiveManager.queryPriceHistoryArchive({
                tenantId: 'tenant-1',
            });

            const call = (mockPrisma.$queryRawUnsafe as jest.Mock).mock.calls[0];
            expect(call[0]).toContain('tenant_id = $1');
        });

        it('should apply date range filters', async () => {
            (mockPrisma.$queryRawUnsafe as jest.Mock).mockResolvedValue([]);

            await archiveManager.queryPriceHistoryArchive({
                startDate: new Date('2023-01-01'),
                endDate: new Date('2023-12-31'),
            });

            const call = (mockPrisma.$queryRawUnsafe as jest.Mock).mock.calls[0];
            expect(call[0]).toContain('recorded_at >=');
            expect(call[0]).toContain('recorded_at <=');
        });

        it('should use default limit of 100', async () => {
            (mockPrisma.$queryRawUnsafe as jest.Mock).mockResolvedValue([]);

            await archiveManager.queryPriceHistoryArchive({});

            const call = (mockPrisma.$queryRawUnsafe as jest.Mock).mock.calls[0];
            expect(call[call.length - 2]).toBe(100); // Second to last param is limit
        });
    });

    describe('queryAuditLogsArchive', () => {
        it('should query archived audit logs with filters', async () => {
            const mockResults = [
                {
                    id: 'audit-1',
                    tenant_id: 'tenant-1',
                    user_id: 'user-1',
                    user_email: 'user@example.com',
                    action: 'UPDATE_PRICE',
                    entity_id: 'prod-1',
                    details: 'Updated price',
                    ip_address: '192.168.1.1',
                    created_at: new Date('2022-01-01'),
                    archived_at: new Date('2023-01-01'),
                },
            ];

            (mockPrisma.$queryRawUnsafe as jest.Mock).mockResolvedValue(mockResults);

            const results = await archiveManager.queryAuditLogsArchive({
                tenantId: 'tenant-1',
                startDate: new Date('2022-01-01'),
                endDate: new Date('2022-12-31'),
            });

            expect(results).toEqual(mockResults);
        });
    });

    describe('getArchiveStats', () => {
        it('should return archive statistics', async () => {
            const mockPriceStats = [
                {
                    count: BigInt(1000),
                    oldest_record: new Date('2023-01-01'),
                    size_bytes: BigInt(100000),
                },
            ];

            const mockAuditStats = [
                {
                    count: BigInt(500),
                    oldest_record: new Date('2022-01-01'),
                    size_bytes: BigInt(50000),
                },
            ];

            (mockPrisma.$queryRaw as jest.Mock)
                .mockResolvedValueOnce(mockPriceStats)
                .mockResolvedValueOnce(mockAuditStats);

            const stats = await archiveManager.getArchiveStats();

            expect(stats.priceHistoryArchived).toBe(1000);
            expect(stats.auditLogsArchived).toBe(500);
            expect(stats.totalArchiveSizeBytes).toBe(150000);
            expect(stats.oldestArchivedRecord).toBeInstanceOf(Date);
        });

        it('should handle empty archives', async () => {
            (mockPrisma.$queryRaw as jest.Mock)
                .mockResolvedValueOnce([{ count: BigInt(0), oldest_record: null, size_bytes: BigInt(0) }])
                .mockResolvedValueOnce([{ count: BigInt(0), oldest_record: null, size_bytes: BigInt(0) }]);

            const stats = await archiveManager.getArchiveStats();

            expect(stats.priceHistoryArchived).toBe(0);
            expect(stats.auditLogsArchived).toBe(0);
            expect(stats.totalArchiveSizeBytes).toBe(0);
            expect(stats.oldestArchivedRecord).toBeNull();
        });
    });

    describe('isMaintenanceWindow', () => {
        it('should return true during maintenance window (2-4 AM UTC)', () => {
            // Mock date to 3 AM UTC
            jest.useFakeTimers();
            jest.setSystemTime(new Date('2024-01-01T03:00:00Z'));

            const result = archiveManager.isMaintenanceWindow();

            expect(result).toBe(true);

            jest.useRealTimers();
        });

        it('should return false outside maintenance window', () => {
            // Mock date to 10 AM UTC
            jest.useFakeTimers();
            jest.setSystemTime(new Date('2024-01-01T10:00:00Z'));

            const result = archiveManager.isMaintenanceWindow();

            expect(result).toBe(false);

            jest.useRealTimers();
        });

        it('should return true at start of window (2 AM)', () => {
            jest.useFakeTimers();
            jest.setSystemTime(new Date('2024-01-01T02:00:00Z'));

            const result = archiveManager.isMaintenanceWindow();

            expect(result).toBe(true);

            jest.useRealTimers();
        });

        it('should return false at end of window (4 AM)', () => {
            jest.useFakeTimers();
            jest.setSystemTime(new Date('2024-01-01T04:00:00Z'));

            const result = archiveManager.isMaintenanceWindow();

            expect(result).toBe(false);

            jest.useRealTimers();
        });
    });

    describe('runScheduledArchival', () => {
        it('should run archival during maintenance window', async () => {
            // Mock maintenance window
            jest.useFakeTimers();
            jest.setSystemTime(new Date('2024-01-01T03:00:00Z'));

            (mockPrisma.$transaction as jest.Mock).mockImplementation(async (callback: any) => {
                const tx = {
                    $queryRaw: jest.fn().mockResolvedValue([]),
                    $executeRawUnsafe: jest.fn(),
                    $executeRaw: jest.fn(),
                };
                return callback(tx);
            });

            const results = await archiveManager.runScheduledArchival();

            expect(results).toHaveProperty('priceHistory');
            expect(results).toHaveProperty('auditLogs');

            jest.useRealTimers();
        });

        it('should throw error outside maintenance window', async () => {
            // Mock outside maintenance window
            jest.useFakeTimers();
            jest.setSystemTime(new Date('2024-01-01T10:00:00Z'));

            await expect(archiveManager.runScheduledArchival()).rejects.toThrow(
                'Archival can only run during maintenance window'
            );

            jest.useRealTimers();
        });
    });

    describe('error handling', () => {
        it('should handle transaction errors in price history archival', async () => {
            (mockPrisma.$transaction as jest.Mock).mockRejectedValue(
                new Error('Transaction failed')
            );

            await expect(archiveManager.archivePriceHistory()).rejects.toThrow(
                'Transaction failed'
            );
        });

        it('should handle transaction errors in audit log archival', async () => {
            (mockPrisma.$transaction as jest.Mock).mockRejectedValue(
                new Error('Transaction failed')
            );

            await expect(archiveManager.archiveAuditLogs()).rejects.toThrow(
                'Transaction failed'
            );
        });

        it('should handle query errors in archive queries', async () => {
            (mockPrisma.$queryRawUnsafe as jest.Mock).mockRejectedValue(
                new Error('Query failed')
            );

            await expect(
                archiveManager.queryPriceHistoryArchive({ tenantId: 'tenant-1' })
            ).rejects.toThrow('Query failed');
        });
    });
});
