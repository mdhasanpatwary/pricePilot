/**
 * Tests for Materialized View Manager
 * 
 * Tests materialized view creation, refresh, and querying
 */

import { MaterializedViewManager } from '@/lib/services/materialized-view-manager';
import { PrismaClient } from '@prisma/client';

// Mock Prisma client
const mockPrisma = {
    $executeRawUnsafe: jest.fn(),
    $queryRawUnsafe: jest.fn(),
} as unknown as PrismaClient;

describe('MaterializedViewManager', () => {
    let manager: MaterializedViewManager;

    beforeEach(() => {
        jest.clearAllMocks();
        manager = new MaterializedViewManager(mockPrisma);
    });

    afterEach(async () => {
        await manager.cleanup();
    });

    describe('createDailyPriceComparisonView', () => {
        it('should create materialized view with indexes', async () => {
            await manager.createDailyPriceComparisonView();

            expect(mockPrisma.$executeRawUnsafe).toHaveBeenCalledWith(
                expect.stringContaining('CREATE MATERIALIZED VIEW IF NOT EXISTS daily_price_comparison_summary')
            );

            expect(mockPrisma.$executeRawUnsafe).toHaveBeenCalledWith(
                expect.stringContaining('CREATE UNIQUE INDEX IF NOT EXISTS idx_dpcs_user_product')
            );
        });
    });

    describe('refreshView', () => {
        it('should refresh materialized view concurrently', async () => {
            await manager.refreshView('daily_price_comparison_summary');

            expect(mockPrisma.$executeRawUnsafe).toHaveBeenCalledWith(
                'REFRESH MATERIALIZED VIEW CONCURRENTLY daily_price_comparison_summary'
            );
        });
    });

    describe('refreshDailyPriceComparisonView', () => {
        it('should refresh the daily price comparison view', async () => {
            await manager.refreshDailyPriceComparisonView();

            expect(mockPrisma.$executeRawUnsafe).toHaveBeenCalledWith(
                'REFRESH MATERIALIZED VIEW CONCURRENTLY daily_price_comparison_summary'
            );
        });
    });

    describe('scheduleRefresh', () => {
        it('should schedule automatic refresh', () => {
            jest.useFakeTimers();

            manager.scheduleRefresh('daily_price_comparison_summary', 15);

            // Fast-forward 15 minutes
            jest.advanceTimersByTime(15 * 60 * 1000);

            expect(mockPrisma.$executeRawUnsafe).toHaveBeenCalledWith(
                'REFRESH MATERIALIZED VIEW CONCURRENTLY daily_price_comparison_summary'
            );

            jest.useRealTimers();
        });

        it('should replace existing schedule', () => {
            jest.useFakeTimers();

            manager.scheduleRefresh('daily_price_comparison_summary', 10);
            manager.scheduleRefresh('daily_price_comparison_summary', 15);

            // Fast-forward 10 minutes (old interval)
            jest.advanceTimersByTime(10 * 60 * 1000);

            // Should not have been called yet (new interval is 15 minutes)
            expect(mockPrisma.$executeRawUnsafe).not.toHaveBeenCalled();

            // Fast-forward to 15 minutes
            jest.advanceTimersByTime(5 * 60 * 1000);

            expect(mockPrisma.$executeRawUnsafe).toHaveBeenCalledTimes(1);

            jest.useRealTimers();
        });
    });

    describe('stopRefresh', () => {
        it('should stop scheduled refresh', () => {
            jest.useFakeTimers();

            manager.scheduleRefresh('daily_price_comparison_summary', 15);
            manager.stopRefresh('daily_price_comparison_summary');

            // Fast-forward 15 minutes
            jest.advanceTimersByTime(15 * 60 * 1000);

            // Should not have been called
            expect(mockPrisma.$executeRawUnsafe).not.toHaveBeenCalled();

            jest.useRealTimers();
        });
    });

    describe('stopAllRefreshes', () => {
        it('should stop all scheduled refreshes', () => {
            jest.useFakeTimers();

            manager.scheduleRefresh('view1', 10);
            manager.scheduleRefresh('view2', 15);
            manager.stopAllRefreshes();

            // Fast-forward 20 minutes
            jest.advanceTimersByTime(20 * 60 * 1000);

            // Should not have been called
            expect(mockPrisma.$executeRawUnsafe).not.toHaveBeenCalled();

            jest.useRealTimers();
        });
    });

    describe('getViewStats', () => {
        it('should return view statistics', async () => {
            const mockDate = new Date('2024-01-01T12:00:00Z');

            (mockPrisma.$queryRawUnsafe as jest.Mock)
                .mockResolvedValueOnce([
                    {
                        name: 'daily_price_comparison_summary',
                        size: '2048 kB',
                        size_bytes: '2097152',
                    },
                ])
                .mockResolvedValueOnce([{ count: '15000' }])
                .mockResolvedValueOnce([{ refreshed_at: mockDate }]);

            const stats = await manager.getViewStats('daily_price_comparison_summary');

            expect(stats).toEqual({
                name: 'daily_price_comparison_summary',
                rowCount: 15000,
                sizeBytes: 2097152,
                lastRefreshed: mockDate,
                nextRefresh: new Date(mockDate.getTime() + 15 * 60 * 1000),
            });
        });

        it('should return null if view does not exist', async () => {
            (mockPrisma.$queryRawUnsafe as jest.Mock).mockResolvedValueOnce([]);

            const stats = await manager.getViewStats('nonexistent_view');

            expect(stats).toBeNull();
        });

        it('should handle errors gracefully', async () => {
            (mockPrisma.$queryRawUnsafe as jest.Mock).mockRejectedValueOnce(
                new Error('Database error')
            );

            const stats = await manager.getViewStats('daily_price_comparison_summary');

            expect(stats).toBeNull();
        });
    });

    describe('viewExists', () => {
        it('should return true if view exists', async () => {
            (mockPrisma.$queryRawUnsafe as jest.Mock).mockResolvedValueOnce([{ count: '1' }]);

            const exists = await manager.viewExists('daily_price_comparison_summary');

            expect(exists).toBe(true);
        });

        it('should return false if view does not exist', async () => {
            (mockPrisma.$queryRawUnsafe as jest.Mock).mockResolvedValueOnce([{ count: '0' }]);

            const exists = await manager.viewExists('nonexistent_view');

            expect(exists).toBe(false);
        });
    });

    describe('dropView', () => {
        it('should drop materialized view', async () => {
            await manager.dropView('daily_price_comparison_summary');

            expect(mockPrisma.$executeRawUnsafe).toHaveBeenCalledWith(
                'DROP MATERIALIZED VIEW IF EXISTS daily_price_comparison_summary CASCADE'
            );
        });
    });

    describe('queryDailyPriceComparison', () => {
        it('should query view with tenant filter', async () => {
            const mockResults = [
                {
                    user_product_id: '1',
                    tenantId: 'tenant-123',
                    product_name: 'Product 1',
                    user_price: 99.99,
                    price_status: 'RED',
                },
            ];

            (mockPrisma.$queryRawUnsafe as jest.Mock).mockResolvedValueOnce(mockResults);

            const results = await manager.queryDailyPriceComparison({
                tenantId: 'tenant-123',
            });

            expect(mockPrisma.$queryRawUnsafe).toHaveBeenCalledWith(
                expect.stringContaining('WHERE "tenantId" = $1'),
                'tenant-123',
                100,
                0
            );

            expect(results).toEqual(mockResults);
        });

        it('should query view with price status filter', async () => {
            const mockResults = [
                {
                    user_product_id: '1',
                    tenantId: 'tenant-123',
                    product_name: 'Product 1',
                    user_price: 99.99,
                    price_status: 'RED',
                },
            ];

            (mockPrisma.$queryRawUnsafe as jest.Mock).mockResolvedValueOnce(mockResults);

            const results = await manager.queryDailyPriceComparison({
                tenantId: 'tenant-123',
                priceStatus: 'RED',
            });

            expect(mockPrisma.$queryRawUnsafe).toHaveBeenCalledWith(
                expect.stringContaining('AND price_status = $2'),
                'tenant-123',
                'RED',
                100,
                0
            );

            expect(results).toEqual(mockResults);
        });

        it('should support pagination', async () => {
            (mockPrisma.$queryRawUnsafe as jest.Mock).mockResolvedValueOnce([]);

            await manager.queryDailyPriceComparison({
                tenantId: 'tenant-123',
                limit: 50,
                offset: 100,
            });

            expect(mockPrisma.$queryRawUnsafe).toHaveBeenCalledWith(
                expect.stringContaining('LIMIT'),
                'tenant-123',
                50,
                100
            );
        });
    });

    describe('initialize', () => {
        it('should create view if it does not exist', async () => {
            (mockPrisma.$queryRawUnsafe as jest.Mock).mockResolvedValueOnce([{ count: '0' }]);

            await manager.initialize();

            expect(mockPrisma.$executeRawUnsafe).toHaveBeenCalledWith(
                expect.stringContaining('CREATE MATERIALIZED VIEW IF NOT EXISTS')
            );

            expect(mockPrisma.$executeRawUnsafe).toHaveBeenCalledWith(
                expect.stringContaining('REFRESH MATERIALIZED VIEW CONCURRENTLY')
            );
        });

        it('should not create view if it already exists', async () => {
            (mockPrisma.$queryRawUnsafe as jest.Mock).mockResolvedValueOnce([{ count: '1' }]);

            await manager.initialize();

            expect(mockPrisma.$executeRawUnsafe).not.toHaveBeenCalledWith(
                expect.stringContaining('CREATE MATERIALIZED VIEW')
            );
        });

        it('should schedule refresh', async () => {
            jest.useFakeTimers();

            (mockPrisma.$queryRawUnsafe as jest.Mock).mockResolvedValueOnce([{ count: '1' }]);

            await manager.initialize();

            // Fast-forward 15 minutes
            jest.advanceTimersByTime(15 * 60 * 1000);

            expect(mockPrisma.$executeRawUnsafe).toHaveBeenCalledWith(
                'REFRESH MATERIALIZED VIEW CONCURRENTLY daily_price_comparison_summary'
            );

            jest.useRealTimers();
        });
    });

    describe('cleanup', () => {
        it('should stop all refreshes', async () => {
            jest.useFakeTimers();

            manager.scheduleRefresh('view1', 10);
            manager.scheduleRefresh('view2', 15);

            await manager.cleanup();

            // Fast-forward 20 minutes
            jest.advanceTimersByTime(20 * 60 * 1000);

            // Should not have been called
            expect(mockPrisma.$executeRawUnsafe).not.toHaveBeenCalled();

            jest.useRealTimers();
        });
    });
});
