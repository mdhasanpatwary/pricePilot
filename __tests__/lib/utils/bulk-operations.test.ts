/**
 * Unit Tests for Bulk Operations Utilities
 * 
 * Tests batch insert, bulk update, transaction wrapper, and chunked processing.
 */

import {
    batchInsert,
    bulkUpdate,
    withTransaction,
    processInChunks,
    batchDelete,
    smartBulkInsert,
    copyBulkLoad,
    getOptimalInsertionMethod,
} from '@/lib/utils/bulk-operations';

// Mock Prisma client
const createMockPrisma = () => {
    const mockModel = {
        createMany: jest.fn().mockResolvedValue({ count: 0 }),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
    };

    return {
        userProducts: mockModel,
        priceHistory: mockModel,
        $transaction: jest.fn(async (callback) => {
            return await callback(createMockPrisma());
        }),
    } as any;
};

describe('Bulk Operations Utilities', () => {
    let mockPrisma: any;

    beforeEach(() => {
        mockPrisma = createMockPrisma();
        jest.clearAllMocks();
    });

    describe('batchInsert', () => {
        it('should insert records in batches of 1000 by default', async () => {
            const records = Array.from({ length: 2500 }, (_, i) => ({
                name: `Product ${i}`,
                price: 99.99,
            }));

            mockPrisma.userProducts.createMany.mockResolvedValue({ count: 1000 });

            const result = await batchInsert(mockPrisma, 'userProducts', records);

            // Should create 3 batches: 1000, 1000, 500
            expect(mockPrisma.userProducts.createMany).toHaveBeenCalledTimes(3);
            expect(result.totalRecords).toBe(2500);
            expect(result.successCount).toBe(2500);
            expect(result.failureCount).toBe(0);
        });

        it('should use custom batch size when provided', async () => {
            const records = Array.from({ length: 1500 }, (_, i) => ({
                name: `Product ${i}`,
                price: 99.99,
            }));

            mockPrisma.userProducts.createMany.mockResolvedValue({ count: 500 });

            const result = await batchInsert(mockPrisma, 'userProducts', records, {
                batchSize: 500,
            });

            // Should create 3 batches of 500
            expect(mockPrisma.userProducts.createMany).toHaveBeenCalledTimes(3);
            expect(result.successCount).toBe(1500);
        });

        it('should handle empty array', async () => {
            const result = await batchInsert(mockPrisma, 'userProducts', []);

            expect(mockPrisma.userProducts.createMany).not.toHaveBeenCalled();
            expect(result.totalRecords).toBe(0);
            expect(result.successCount).toBe(0);
        });

        it('should retry failed batches', async () => {
            const records = Array.from({ length: 100 }, (_, i) => ({
                name: `Product ${i}`,
                price: 99.99,
            }));

            // Fail first time, succeed second time
            mockPrisma.userProducts.createMany
                .mockRejectedValueOnce(new Error('Connection timeout'))
                .mockResolvedValueOnce({ count: 100 });

            const result = await batchInsert(mockPrisma, 'userProducts', records, {
                maxRetries: 3,
                retryDelayMs: 10,
            });

            expect(mockPrisma.userProducts.createMany).toHaveBeenCalledTimes(2);
            expect(result.successCount).toBe(100);
            expect(result.failureCount).toBe(0);
        });

        it('should record failures after max retries', async () => {
            const records = Array.from({ length: 100 }, (_, i) => ({
                name: `Product ${i}`,
                price: 99.99,
            }));

            mockPrisma.userProducts.createMany.mockRejectedValue(
                new Error('Persistent error')
            );

            const result = await batchInsert(mockPrisma, 'userProducts', records, {
                maxRetries: 2,
                retryDelayMs: 10,
            });

            expect(mockPrisma.userProducts.createMany).toHaveBeenCalledTimes(3); // Initial + 2 retries
            expect(result.successCount).toBe(0);
            expect(result.failureCount).toBe(100);
            expect(result.errors).toHaveLength(1);
            expect(result.errors[0].error).toContain('Persistent error');
        });
    });

    describe('bulkUpdate', () => {
        it('should group updates by identical data', async () => {
            const updates = [
                { id: '1', data: { price: 89.99 } },
                { id: '2', data: { price: 89.99 } },
                { id: '3', data: { price: 129.99 } },
                { id: '4', data: { price: 89.99 } },
            ];

            // Mock to return the actual count of IDs in each batch
            mockPrisma.userProducts.updateMany
                .mockResolvedValueOnce({ count: 3 })  // First group: 3 records with 89.99
                .mockResolvedValueOnce({ count: 1 }); // Second group: 1 record with 129.99

            const result = await bulkUpdate(mockPrisma, 'userProducts', updates);

            // Should create 2 update groups: one for 89.99 (3 records), one for 129.99 (1 record)
            expect(mockPrisma.userProducts.updateMany).toHaveBeenCalledTimes(2);
            expect(result.successCount).toBe(4);
        });

        it('should use WHERE IN clause for updates', async () => {
            const updates = [
                { id: '1', data: { price: 99.99 } },
                { id: '2', data: { price: 99.99 } },
            ];

            mockPrisma.userProducts.updateMany.mockResolvedValue({ count: 2 });

            await bulkUpdate(mockPrisma, 'userProducts', updates);

            expect(mockPrisma.userProducts.updateMany).toHaveBeenCalledWith({
                where: {
                    id: {
                        in: ['1', '2'],
                    },
                },
                data: { price: 99.99 },
            });
        });

        it('should handle empty updates array', async () => {
            const result = await bulkUpdate(mockPrisma, 'userProducts', []);

            expect(mockPrisma.userProducts.updateMany).not.toHaveBeenCalled();
            expect(result.totalRecords).toBe(0);
        });

        it('should batch large ID lists', async () => {
            const updates = Array.from({ length: 2500 }, (_, i) => ({
                id: `id-${i}`,
                data: { price: 99.99 },
            }));

            // Mock to return the actual count for each batch
            mockPrisma.userProducts.updateMany
                .mockResolvedValueOnce({ count: 1000 })
                .mockResolvedValueOnce({ count: 1000 })
                .mockResolvedValueOnce({ count: 500 });

            const result = await bulkUpdate(mockPrisma, 'userProducts', updates, {
                batchSize: 1000,
            });

            // Should create 3 batches: 1000, 1000, 500
            expect(mockPrisma.userProducts.updateMany).toHaveBeenCalledTimes(3);
            expect(result.successCount).toBe(2500);
        });

        it('should handle update failures', async () => {
            const updates = [
                { id: '1', data: { price: 99.99 } },
                { id: '2', data: { price: 129.99 } },
            ];

            mockPrisma.userProducts.updateMany
                .mockResolvedValueOnce({ count: 1 })
                .mockRejectedValueOnce(new Error('Update failed'));

            const result = await bulkUpdate(mockPrisma, 'userProducts', updates);

            expect(result.successCount).toBe(1);
            expect(result.failureCount).toBe(1);
            expect(result.errors).toHaveLength(1);
        });
    });

    describe('withTransaction', () => {
        it('should execute operations in transaction', async () => {
            const operations = jest.fn(async (tx) => {
                await tx.userProducts.createMany({ data: [] });
                return { success: true };
            });

            const result = await withTransaction(mockPrisma, operations);

            expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
            expect(operations).toHaveBeenCalledTimes(1);
            expect(result).toEqual({ success: true });
        });

        it('should rollback on error', async () => {
            const operations = jest.fn(async () => {
                throw new Error('Operation failed');
            });

            await expect(withTransaction(mockPrisma, operations)).rejects.toThrow(
                'Operation failed'
            );

            expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
        });

        it('should pass transaction client to operations', async () => {
            let receivedTx: any;

            await withTransaction(mockPrisma, async (tx) => {
                receivedTx = tx;
                return true;
            });

            expect(receivedTx).toBeDefined();
            expect(receivedTx.userProducts).toBeDefined();
        });
    });

    describe('processInChunks', () => {
        it('should process records in chunks', async () => {
            const records = Array.from({ length: 25000 }, (_, i) => ({
                id: `record-${i}`,
            }));

            const processor = jest.fn(async (chunk, index) => {
                return { chunkIndex: index, count: chunk.length };
            });

            const results = await processInChunks(records, 10000, processor);

            expect(processor).toHaveBeenCalledTimes(3); // 10k, 10k, 5k
            expect(results).toHaveLength(3);
            expect(results[0]).toEqual({ chunkIndex: 0, count: 10000 });
            expect(results[1]).toEqual({ chunkIndex: 1, count: 10000 });
            expect(results[2]).toEqual({ chunkIndex: 2, count: 5000 });
        });

        it('should handle empty array', async () => {
            const processor = jest.fn();

            const results = await processInChunks([], 10000, processor);

            expect(processor).not.toHaveBeenCalled();
            expect(results).toHaveLength(0);
        });

        it('should handle single chunk', async () => {
            const records = Array.from({ length: 500 }, (_, i) => ({ id: i }));
            const processor = jest.fn(async (chunk) => chunk.length);

            const results = await processInChunks(records, 10000, processor);

            expect(processor).toHaveBeenCalledTimes(1);
            expect(results).toEqual([500]);
        });

        it('should propagate errors from processor', async () => {
            const records = Array.from({ length: 1000 }, (_, i) => ({ id: i }));
            const processor = jest.fn(async () => {
                throw new Error('Processing failed');
            });

            await expect(
                processInChunks(records, 500, processor)
            ).rejects.toThrow('Processing failed');
        });

        it('should pass chunk index to processor', async () => {
            const records = Array.from({ length: 3000 }, (_, i) => ({ id: i }));
            const processor = jest.fn(async (chunk, index) => index);

            const results = await processInChunks(records, 1000, processor);

            expect(results).toEqual([0, 1, 2]);
        });
    });

    describe('batchDelete', () => {
        it('should delete records in batches', async () => {
            const ids = Array.from({ length: 2500 }, (_, i) => `id-${i}`);

            // Mock to return the actual count for each batch
            mockPrisma.userProducts.deleteMany
                .mockResolvedValueOnce({ count: 1000 })
                .mockResolvedValueOnce({ count: 1000 })
                .mockResolvedValueOnce({ count: 500 });

            const result = await batchDelete(mockPrisma, 'userProducts', ids);

            expect(mockPrisma.userProducts.deleteMany).toHaveBeenCalledTimes(3);
            expect(result.totalRecords).toBe(2500);
            expect(result.successCount).toBe(2500);
        });

        it('should use WHERE IN clause', async () => {
            const ids = ['id-1', 'id-2', 'id-3'];

            mockPrisma.userProducts.deleteMany.mockResolvedValue({ count: 3 });

            await batchDelete(mockPrisma, 'userProducts', ids);

            expect(mockPrisma.userProducts.deleteMany).toHaveBeenCalledWith({
                where: {
                    id: {
                        in: ids,
                    },
                },
            });
        });

        it('should handle empty ID array', async () => {
            const result = await batchDelete(mockPrisma, 'userProducts', []);

            expect(mockPrisma.userProducts.deleteMany).not.toHaveBeenCalled();
            expect(result.totalRecords).toBe(0);
        });

        it('should handle delete failures', async () => {
            const ids = Array.from({ length: 100 }, (_, i) => `id-${i}`);

            mockPrisma.userProducts.deleteMany.mockRejectedValue(
                new Error('Delete failed')
            );

            const result = await batchDelete(mockPrisma, 'userProducts', ids);

            expect(result.successCount).toBe(0);
            expect(result.failureCount).toBe(100);
            expect(result.errors).toHaveLength(1);
        });

        it('should use custom batch size', async () => {
            const ids = Array.from({ length: 1500 }, (_, i) => `id-${i}`);

            mockPrisma.userProducts.deleteMany.mockResolvedValue({ count: 500 });

            const result = await batchDelete(mockPrisma, 'userProducts', ids, {
                batchSize: 500,
            });

            expect(mockPrisma.userProducts.deleteMany).toHaveBeenCalledTimes(3);
            expect(result.successCount).toBe(1500);
        });
    });

    describe('Integration scenarios', () => {
        it('should handle batch insert within transaction', async () => {
            const records = Array.from({ length: 100 }, (_, i) => ({
                name: `Product ${i}`,
            }));

            mockPrisma.userProducts.createMany.mockResolvedValue({ count: 100 });

            const result = await withTransaction(mockPrisma, async (tx) => {
                return await batchInsert(tx as any, 'userProducts', records);
            });

            expect(result.successCount).toBe(100);
            expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
        });

        it('should handle bulk update within transaction', async () => {
            const updates = [
                { id: '1', data: { price: 99.99 } },
                { id: '2', data: { price: 99.99 } },
            ];

            mockPrisma.userProducts.updateMany.mockResolvedValue({ count: 2 });

            const result = await withTransaction(mockPrisma, async (tx) => {
                return await bulkUpdate(tx as any, 'userProducts', updates);
            });

            expect(result.successCount).toBe(2);
        });

        it('should handle chunked batch inserts', async () => {
            const records = Array.from({ length: 25000 }, (_, i) => ({
                name: `Product ${i}`,
            }));

            mockPrisma.userProducts.createMany.mockResolvedValue({ count: 1000 });

            const results = await processInChunks(records, 10000, async (chunk) => {
                return await batchInsert(mockPrisma, 'userProducts', chunk);
            });

            expect(results).toHaveLength(3);
            expect(results.every((r) => r.successCount > 0)).toBe(true);
        });
    });

    describe('Performance and timing', () => {
        it('should track operation duration', async () => {
            const records = Array.from({ length: 100 }, (_, i) => ({
                name: `Product ${i}`,
            }));

            mockPrisma.userProducts.createMany.mockImplementation(
                () => new Promise((resolve) => setTimeout(() => resolve({ count: 100 }), 50))
            );

            const result = await batchInsert(mockPrisma, 'userProducts', records);

            expect(result.durationMs).toBeGreaterThan(0);
            expect(result.durationMs).toBeGreaterThanOrEqual(50);
        });

        it('should track chunked processing duration', async () => {
            const records = Array.from({ length: 1000 }, (_, i) => ({ id: i }));
            const processor = jest.fn(async (chunk) => {
                await new Promise((resolve) => setTimeout(resolve, 10));
                return chunk.length;
            });

            const startTime = Date.now();
            await processInChunks(records, 500, processor);
            const duration = Date.now() - startTime;

            expect(duration).toBeGreaterThanOrEqual(20); // At least 2 chunks * 10ms
        });
    });

    describe('COPY operations', () => {
        describe('smartBulkInsert', () => {
            it('should use batch insert for small datasets', async () => {
                const records = Array.from({ length: 1000 }, (_, i) => ({
                    name: `Product ${i}`,
                    price: 99.99,
                }));

                mockPrisma.userProducts.createMany.mockResolvedValue({ count: 1000 });

                const result = await smartBulkInsert(mockPrisma, 'userProducts', records);

                expect(mockPrisma.userProducts.createMany).toHaveBeenCalled();
                expect(result.successCount).toBe(1000);
            });

            it('should use COPY for large datasets', async () => {
                const records = Array.from({ length: 60000 }, (_, i) => ({
                    name: `Product ${i}`,
                    price: 99.99,
                }));

                mockPrisma.$executeRawUnsafe = jest.fn().mockResolvedValue(60000);

                const result = await smartBulkInsert(
                    mockPrisma,
                    'userProducts',
                    records,
                    ['name', 'price']
                );

                expect(mockPrisma.$executeRawUnsafe).toHaveBeenCalled();
                expect(result.totalRecords).toBe(60000);
            });

            it('should handle empty array', async () => {
                const result = await smartBulkInsert(mockPrisma, 'userProducts', []);

                expect(result.totalRecords).toBe(0);
                expect(result.successCount).toBe(0);
            });

            it('should auto-detect columns from first record', async () => {
                const records = Array.from({ length: 60000 }, (_, i) => ({
                    name: `Product ${i}`,
                    price: 99.99,
                    tenantId: 'tenant-1',
                }));

                mockPrisma.$executeRawUnsafe = jest.fn().mockResolvedValue(60000);

                const result = await smartBulkInsert(mockPrisma, 'userProducts', records);

                expect(mockPrisma.$executeRawUnsafe).toHaveBeenCalled();
                expect(result.totalRecords).toBe(60000);
            });
        });

        describe('copyBulkLoad', () => {
            it('should format CSV data correctly', async () => {
                const records = [
                    { name: 'Product 1', price: 99.99, active: true },
                    { name: 'Product 2', price: 149.99, active: false },
                ];

                mockPrisma.$executeRawUnsafe = jest.fn().mockResolvedValue(2);

                const result = await copyBulkLoad(
                    mockPrisma,
                    'user_products',
                    records,
                    ['name', 'price', 'active']
                );

                expect(mockPrisma.$executeRawUnsafe).toHaveBeenCalled();
                expect(result.successCount).toBe(2);
            });

            it('should handle null values', async () => {
                const records = [
                    { name: 'Product 1', description: null, price: 99.99 },
                ];

                mockPrisma.$executeRawUnsafe = jest.fn().mockResolvedValue(1);

                const result = await copyBulkLoad(
                    mockPrisma,
                    'user_products',
                    records,
                    ['name', 'description', 'price']
                );

                expect(result.successCount).toBe(1);
            });

            it('should handle dates', async () => {
                const now = new Date();
                const records = [
                    { name: 'Product 1', createdAt: now },
                ];

                mockPrisma.$executeRawUnsafe = jest.fn().mockResolvedValue(1);

                const result = await copyBulkLoad(
                    mockPrisma,
                    'user_products',
                    records,
                    ['name', 'createdAt']
                );

                expect(result.successCount).toBe(1);
            });

            it('should handle JSON objects', async () => {
                const records = [
                    { name: 'Product 1', metadata: { color: 'red', size: 'large' } },
                ];

                mockPrisma.$executeRawUnsafe = jest.fn().mockResolvedValue(1);

                const result = await copyBulkLoad(
                    mockPrisma,
                    'user_products',
                    records,
                    ['name', 'metadata']
                );

                expect(result.successCount).toBe(1);
            });

            it('should handle errors', async () => {
                const records = [
                    { name: 'Product 1', price: 99.99 },
                ];

                mockPrisma.$executeRawUnsafe = jest.fn().mockRejectedValue(
                    new Error('COPY failed')
                );

                const result = await copyBulkLoad(
                    mockPrisma,
                    'user_products',
                    records,
                    ['name', 'price']
                );

                expect(result.successCount).toBe(0);
                expect(result.failureCount).toBe(1);
                expect(result.errors[0].error).toContain('COPY failed');
            });

            it('should handle empty array', async () => {
                const result = await copyBulkLoad(
                    mockPrisma,
                    'user_products',
                    [],
                    ['name', 'price']
                );

                expect(result.totalRecords).toBe(0);
                expect(result.successCount).toBe(0);
            });
        });

        describe('getOptimalInsertionMethod', () => {
            it('should return batch for small datasets', () => {
                expect(getOptimalInsertionMethod(1000)).toBe('batch');
                expect(getOptimalInsertionMethod(10000)).toBe('batch');
                expect(getOptimalInsertionMethod(49999)).toBe('batch');
            });

            it('should return copy for large datasets', () => {
                expect(getOptimalInsertionMethod(50000)).toBe('copy');
                expect(getOptimalInsertionMethod(100000)).toBe('copy');
                expect(getOptimalInsertionMethod(1000000)).toBe('copy');
            });

            it('should handle edge case at threshold', () => {
                expect(getOptimalInsertionMethod(49999)).toBe('batch');
                expect(getOptimalInsertionMethod(50000)).toBe('copy');
                expect(getOptimalInsertionMethod(50001)).toBe('copy');
            });
        });
    });
});
