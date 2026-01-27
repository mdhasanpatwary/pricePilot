import { RetryQueueService } from '@/lib/services/retry-queue';
import { prisma } from '@/lib/prisma';

// Mock Prisma
jest.mock('@/lib/prisma', () => ({
    prisma: {
        retryQueue: {
            findFirst: jest.fn(),
            findUnique: jest.fn(),
            findMany: jest.fn(),
            create: jest.fn(),
            update: jest.fn(),
            count: jest.fn(),
            deleteMany: jest.fn(),
        },
    },
}));

describe('RetryQueueService', () => {
    let service: RetryQueueService;

    beforeEach(() => {
        service = RetryQueueService.getInstance();
        jest.clearAllMocks();
    });

    describe('addToRetryQueue', () => {
        it('should create a new retry queue item', async () => {
            const mockItem = {
                id: 'test-id',
                tenantId: 'tenant-1',
                siteId: 'site-1',
                productId: 'product-1',
                url: 'https://example.com/product',
                retryCount: 0,
                maxRetries: 4,
                nextRetryAt: new Date(),
                lastAttemptAt: null,
                lastError: 'Test error',
                status: 'PENDING',
                createdAt: new Date(),
                updatedAt: new Date(),
            };

            (prisma.retryQueue.findFirst as jest.Mock).mockResolvedValue(null);
            (prisma.retryQueue.create as jest.Mock).mockResolvedValue(mockItem);

            const result = await service.addToRetryQueue({
                tenantId: 'tenant-1',
                siteId: 'site-1',
                productId: 'product-1',
                url: 'https://example.com/product',
                error: 'Test error',
            });

            expect(result).toEqual(mockItem);
            expect(prisma.retryQueue.create).toHaveBeenCalledWith({
                data: expect.objectContaining({
                    tenantId: 'tenant-1',
                    siteId: 'site-1',
                    productId: 'product-1',
                    url: 'https://example.com/product',
                    retryCount: 0,
                    maxRetries: 4,
                    lastError: 'Test error',
                    status: 'PENDING',
                }),
            });
        });

        it('should update existing retry queue item', async () => {
            const existingItem = {
                id: 'existing-id',
                tenantId: 'tenant-1',
                siteId: 'site-1',
                productId: 'product-1',
                url: 'https://example.com/product',
                retryCount: 1,
                maxRetries: 4,
                nextRetryAt: new Date(),
                lastAttemptAt: new Date(),
                lastError: 'Previous error',
                status: 'PENDING',
                createdAt: new Date(),
                updatedAt: new Date(),
            };

            const updatedItem = {
                ...existingItem,
                retryCount: 2,
                lastError: 'New error',
            };

            (prisma.retryQueue.findFirst as jest.Mock).mockResolvedValue(existingItem);
            (prisma.retryQueue.update as jest.Mock).mockResolvedValue(updatedItem);

            const result = await service.addToRetryQueue({
                tenantId: 'tenant-1',
                siteId: 'site-1',
                productId: 'product-1',
                url: 'https://example.com/product',
                error: 'New error',
            });

            expect(result.retryCount).toBe(2);
            expect(result.lastError).toBe('New error');
            expect(prisma.retryQueue.update).toHaveBeenCalled();
        });

        it('should mark as FAILED when max retries exceeded', async () => {
            const existingItem = {
                id: 'existing-id',
                tenantId: 'tenant-1',
                siteId: 'site-1',
                productId: 'product-1',
                url: 'https://example.com/product',
                retryCount: 3,
                maxRetries: 4,
                nextRetryAt: new Date(),
                lastAttemptAt: new Date(),
                lastError: 'Previous error',
                status: 'PENDING',
                createdAt: new Date(),
                updatedAt: new Date(),
            };

            const updatedItem = {
                ...existingItem,
                retryCount: 4,
                status: 'FAILED',
                lastError: 'Final error',
            };

            (prisma.retryQueue.findFirst as jest.Mock).mockResolvedValue(existingItem);
            (prisma.retryQueue.update as jest.Mock).mockResolvedValue(updatedItem);

            const result = await service.addToRetryQueue({
                tenantId: 'tenant-1',
                siteId: 'site-1',
                productId: 'product-1',
                url: 'https://example.com/product',
                error: 'Final error',
            });

            expect(result.status).toBe('FAILED');
            expect(result.retryCount).toBe(4);
        });
    });

    describe('getNextRetryBatch', () => {
        it('should return pending items ready for retry', async () => {
            const mockItems = [
                {
                    id: 'item-1',
                    tenantId: 'tenant-1',
                    siteId: 'site-1',
                    productId: 'product-1',
                    url: 'https://example.com/product1',
                    retryCount: 0,
                    maxRetries: 4,
                    nextRetryAt: new Date(Date.now() - 1000),
                    lastAttemptAt: null,
                    lastError: 'Error 1',
                    status: 'PENDING',
                    createdAt: new Date(),
                    updatedAt: new Date(),
                },
                {
                    id: 'item-2',
                    tenantId: 'tenant-1',
                    siteId: 'site-1',
                    productId: 'product-2',
                    url: 'https://example.com/product2',
                    retryCount: 1,
                    maxRetries: 4,
                    nextRetryAt: new Date(Date.now() - 2000),
                    lastAttemptAt: new Date(),
                    lastError: 'Error 2',
                    status: 'PENDING',
                    createdAt: new Date(),
                    updatedAt: new Date(),
                },
            ];

            (prisma.retryQueue.findMany as jest.Mock).mockResolvedValue(mockItems);

            const result = await service.getNextRetryBatch(10);

            expect(result).toEqual(mockItems);
            expect(prisma.retryQueue.findMany).toHaveBeenCalledWith({
                where: {
                    status: 'PENDING',
                    nextRetryAt: {
                        lte: expect.any(Date),
                    },
                },
                orderBy: {
                    nextRetryAt: 'asc',
                },
                take: 10,
            });
        });

        it('should return empty array when no items ready', async () => {
            (prisma.retryQueue.findMany as jest.Mock).mockResolvedValue([]);

            const result = await service.getNextRetryBatch(10);

            expect(result).toEqual([]);
        });
    });

    describe('markSuccess', () => {
        it('should update status to SUCCESS', async () => {
            (prisma.retryQueue.update as jest.Mock).mockResolvedValue({
                id: 'test-id',
                status: 'SUCCESS',
            });

            await service.markSuccess('test-id');

            expect(prisma.retryQueue.update).toHaveBeenCalledWith({
                where: { id: 'test-id' },
                data: {
                    status: 'SUCCESS',
                    updatedAt: expect.any(Date),
                },
            });
        });
    });

    describe('markFailed', () => {
        it('should update status to FAILED with error message', async () => {
            (prisma.retryQueue.update as jest.Mock).mockResolvedValue({
                id: 'test-id',
                status: 'FAILED',
                lastError: 'Permanent failure',
            });

            await service.markFailed('test-id', 'Permanent failure');

            expect(prisma.retryQueue.update).toHaveBeenCalledWith({
                where: { id: 'test-id' },
                data: {
                    status: 'FAILED',
                    lastError: 'Permanent failure',
                    updatedAt: expect.any(Date),
                },
            });
        });
    });

    describe('getStats', () => {
        it('should return retry queue statistics', async () => {
            (prisma.retryQueue.count as jest.Mock)
                .mockResolvedValueOnce(5)  // pending
                .mockResolvedValueOnce(2)  // inProgress
                .mockResolvedValueOnce(10) // success
                .mockResolvedValueOnce(3)  // failed
                .mockResolvedValueOnce(20); // total

            const stats = await service.getStats();

            expect(stats).toEqual({
                pending: 5,
                inProgress: 2,
                success: 10,
                failed: 3,
                total: 20,
            });
        });
    });

    describe('cleanupOldItems', () => {
        it('should delete old completed items', async () => {
            (prisma.retryQueue.deleteMany as jest.Mock).mockResolvedValue({ count: 15 });

            const count = await service.cleanupOldItems();

            expect(count).toBe(15);
            expect(prisma.retryQueue.deleteMany).toHaveBeenCalledWith({
                where: {
                    status: {
                        in: ['SUCCESS', 'FAILED'],
                    },
                    updatedAt: {
                        lt: expect.any(Date),
                    },
                },
            });
        });
    });
});
