/**
 * Pagination Utility Tests
 * 
 * Tests the pagination helper functions for correctness
 */

import { paginate, getPaginationParams } from '@/lib/utils/pagination';

describe('Pagination Utility', () => {
    describe('paginate', () => {
        let mockModel: any;

        beforeEach(() => {
            mockModel = {
                findMany: jest.fn(),
                count: jest.fn(),
            };
        });

        it('should paginate results with default parameters', async () => {
            const mockData = [{ id: '1' }, { id: '2' }];
            mockModel.findMany.mockResolvedValue(mockData);
            mockModel.count.mockResolvedValue(100);

            const result = await paginate(
                mockModel,
                { tenantId: 'test' },
                {},
                { site: true }
            );

            expect(result.data).toEqual(mockData);
            expect(result.pagination).toEqual({
                page: 1,
                limit: 20,
                total: 100,
                totalPages: 5,
                hasNext: true,
                hasPrev: false,
            });

            expect(mockModel.findMany).toHaveBeenCalledWith({
                where: { tenantId: 'test' },
                include: { site: true },
                skip: 0,
                take: 20,
                orderBy: undefined,
            });
        });

        it('should handle custom page and limit', async () => {
            const mockData = [{ id: '3' }];
            mockModel.findMany.mockResolvedValue(mockData);
            mockModel.count.mockResolvedValue(50);

            const result = await paginate(
                mockModel,
                { tenantId: 'test' },
                { page: 3, limit: 10 },
                undefined
            );

            expect(result.pagination).toEqual({
                page: 3,
                limit: 10,
                total: 50,
                totalPages: 5,
                hasNext: true,
                hasPrev: true,
            });

            expect(mockModel.findMany).toHaveBeenCalledWith({
                where: { tenantId: 'test' },
                include: undefined,
                skip: 20, // (3-1) * 10
                take: 10,
                orderBy: undefined,
            });
        });

        it('should handle sorting parameters', async () => {
            mockModel.findMany.mockResolvedValue([]);
            mockModel.count.mockResolvedValue(0);

            await paginate(
                mockModel,
                {},
                { sortBy: 'createdAt', sortOrder: 'desc' },
                undefined
            );

            expect(mockModel.findMany).toHaveBeenCalledWith({
                where: {},
                include: undefined,
                skip: 0,
                take: 20,
                orderBy: { createdAt: 'desc' },
            });
        });

        it('should enforce maximum limit of 100', async () => {
            mockModel.findMany.mockResolvedValue([]);
            mockModel.count.mockResolvedValue(0);

            await paginate(
                mockModel,
                {},
                { limit: 500 }, // Try to request 500
                undefined
            );

            expect(mockModel.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    take: 100, // Should be capped at 100
                })
            );
        });

        it('should enforce minimum page of 1', async () => {
            mockModel.findMany.mockResolvedValue([]);
            mockModel.count.mockResolvedValue(0);

            await paginate(
                mockModel,
                {},
                { page: -5 }, // Try negative page
                undefined
            );

            expect(mockModel.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    skip: 0, // Should start at 0 (page 1)
                })
            );
        });

        it('should correctly calculate hasNext and hasPrev', async () => {
            mockModel.findMany.mockResolvedValue([]);
            mockModel.count.mockResolvedValue(100);

            // First page
            let result = await paginate(mockModel, {}, { page: 1, limit: 20 }, undefined);
            expect(result.pagination.hasNext).toBe(true);
            expect(result.pagination.hasPrev).toBe(false);

            // Middle page
            result = await paginate(mockModel, {}, { page: 3, limit: 20 }, undefined);
            expect(result.pagination.hasNext).toBe(true);
            expect(result.pagination.hasPrev).toBe(true);

            // Last page
            result = await paginate(mockModel, {}, { page: 5, limit: 20 }, undefined);
            expect(result.pagination.hasNext).toBe(false);
            expect(result.pagination.hasPrev).toBe(true);
        });

        it('should handle empty results', async () => {
            mockModel.findMany.mockResolvedValue([]);
            mockModel.count.mockResolvedValue(0);

            const result = await paginate(mockModel, {}, {}, undefined);

            expect(result.data).toEqual([]);
            expect(result.pagination).toEqual({
                page: 1,
                limit: 20,
                total: 0,
                totalPages: 0,
                hasNext: false,
                hasPrev: false,
            });
        });
    });

    describe('getPaginationParams', () => {
        it('should extract pagination parameters from URLSearchParams', () => {
            const searchParams = new URLSearchParams({
                page: '3',
                limit: '50',
                sortBy: 'createdAt',
                sortOrder: 'desc',
            });

            const result = getPaginationParams(searchParams);

            expect(result).toEqual({
                page: 3,
                limit: 50,
                sortBy: 'createdAt',
                sortOrder: 'desc',
            });
        });

        it('should use defaults when parameters are missing', () => {
            const searchParams = new URLSearchParams();

            const result = getPaginationParams(searchParams);

            expect(result).toEqual({
                page: 1,
                limit: 20,
                sortBy: undefined,
                sortOrder: undefined,
            });
        });

        it('should handle invalid numeric values', () => {
            const searchParams = new URLSearchParams({
                page: 'invalid',
                limit: 'also-invalid',
            });

            const result = getPaginationParams(searchParams);

            expect(result.page).toBeNaN();
            expect(result.limit).toBeNaN();
        });
    });
});
