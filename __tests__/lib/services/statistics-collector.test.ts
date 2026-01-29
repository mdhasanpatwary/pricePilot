/**
 * Tests for StatisticsCollector
 * 
 * Tests statistics collection, historical tracking, and cleanup.
 */

import { Pool } from 'pg';
import { StatisticsCollector } from '@/lib/services/statistics-collector';
import { STATISTICS_HISTORY_RETENTION_DAYS } from '@/lib/database/optimization-constants';

// Mock pg Pool
jest.mock('pg', () => {
    const mockClient = {
        query: jest.fn(),
        release: jest.fn(),
    };

    const mockPool = {
        connect: jest.fn().mockResolvedValue(mockClient),
        end: jest.fn(),
    };

    return {
        Pool: jest.fn(() => mockPool),
    };
});

describe('StatisticsCollector', () => {
    let pool: Pool;
    let collector: StatisticsCollector;
    let mockClient: any;

    beforeEach(() => {
        jest.clearAllMocks();
        pool = new Pool();
        collector = new StatisticsCollector(pool);
        mockClient = {
            query: jest.fn(),
            release: jest.fn(),
        };
        (pool.connect as jest.Mock).mockResolvedValue(mockClient);
    });

    describe('collectTableStatistics', () => {
        it('should collect statistics for all tables', async () => {
            mockClient.query
                .mockResolvedValueOnce({
                    rows: [
                        {
                            table_name: 'public.user_products',
                            size_bytes: '1000000',
                            table_size_bytes: '800000',
                            index_size_bytes: '200000',
                            row_count: '5000',
                            last_vacuum: new Date('2024-01-01'),
                            last_autovacuum: null,
                            last_analyze: new Date('2024-01-02'),
                            last_autoanalyze: null,
                        },
                        {
                            table_name: 'public.price_history',
                            size_bytes: '2000000',
                            table_size_bytes: '1800000',
                            index_size_bytes: '200000',
                            row_count: '10000',
                            last_vacuum: null,
                            last_autovacuum: new Date('2024-01-01'),
                            last_analyze: null,
                            last_autoanalyze: new Date('2024-01-02'),
                        },
                    ],
                })
                .mockResolvedValue({}); // For INSERT queries

            const stats = await collector.collectTableStatistics();

            expect(stats).toHaveLength(2);
            expect(stats[0].tableName).toBe('public.user_products');
            expect(stats[0].sizeBytes).toBe(1000000);
            expect(stats[0].rowCount).toBe(5000);
            expect(stats[0].indexSizeBytes).toBe(200000);
            expect(stats[0].lastVacuum).toEqual(new Date('2024-01-01'));
            expect(stats[0].lastAnalyze).toEqual(new Date('2024-01-02'));

            // Verify INSERT was called for each table
            expect(mockClient.query).toHaveBeenCalledWith(
                expect.stringContaining('INSERT INTO database_statistics_history'),
                expect.any(Array)
            );
        });

        it('should handle tables with null values', async () => {
            mockClient.query
                .mockResolvedValueOnce({
                    rows: [
                        {
                            table_name: 'public.new_table',
                            size_bytes: null,
                            table_size_bytes: null,
                            index_size_bytes: null,
                            row_count: null,
                            last_vacuum: null,
                            last_autovacuum: null,
                            last_analyze: null,
                            last_autoanalyze: null,
                        },
                    ],
                })
                .mockResolvedValue({});

            const stats = await collector.collectTableStatistics();

            expect(stats).toHaveLength(1);
            expect(stats[0].sizeBytes).toBe(0);
            expect(stats[0].rowCount).toBe(0);
            expect(stats[0].lastVacuum).toBeNull();
        });

        it('should handle collection errors', async () => {
            mockClient.query.mockRejectedValueOnce(new Error('Connection failed'));

            await expect(collector.collectTableStatistics()).rejects.toThrow(
                'Connection failed'
            );
            expect(mockClient.release).toHaveBeenCalled();
        });
    });

    describe('collectIndexStatistics', () => {
        it('should collect statistics for all indexes', async () => {
            mockClient.query
                .mockResolvedValueOnce({
                    rows: [
                        {
                            index_name: 'public.idx_user_products_tenant',
                            table_name: 'public.user_products',
                            size_bytes: '500000',
                            scans: '1000',
                            tuples_read: '50000',
                            tuples_fetched: '45000',
                        },
                        {
                            index_name: 'public.idx_price_history_product',
                            table_name: 'public.price_history',
                            size_bytes: '300000',
                            scans: '500',
                            tuples_read: '25000',
                            tuples_fetched: '20000',
                        },
                    ],
                })
                .mockResolvedValue({}); // For INSERT queries

            const stats = await collector.collectIndexStatistics();

            expect(stats).toHaveLength(2);
            expect(stats[0].indexName).toBe('public.idx_user_products_tenant');
            expect(stats[0].tableName).toBe('public.user_products');
            expect(stats[0].sizeBytes).toBe(500000);
            expect(stats[0].scans).toBe(1000);
            expect(stats[0].tuplesRead).toBe(50000);
            expect(stats[0].tuplesFetched).toBe(45000);

            // Verify INSERT was called for each index
            expect(mockClient.query).toHaveBeenCalledWith(
                expect.stringContaining('INSERT INTO index_statistics_history'),
                expect.any(Array)
            );
        });

        it('should handle indexes with null values', async () => {
            mockClient.query
                .mockResolvedValueOnce({
                    rows: [
                        {
                            index_name: 'public.new_index',
                            table_name: 'public.new_table',
                            size_bytes: null,
                            scans: null,
                            tuples_read: null,
                            tuples_fetched: null,
                        },
                    ],
                })
                .mockResolvedValue({});

            const stats = await collector.collectIndexStatistics();

            expect(stats).toHaveLength(1);
            expect(stats[0].sizeBytes).toBe(0);
            expect(stats[0].scans).toBe(0);
        });
    });

    describe('collectAllStatistics', () => {
        it('should collect both table and index statistics', async () => {
            // Mock table statistics
            mockClient.query
                .mockResolvedValueOnce({
                    rows: [
                        {
                            table_name: 'public.user_products',
                            size_bytes: '1000000',
                            table_size_bytes: '800000',
                            index_size_bytes: '200000',
                            row_count: '5000',
                            last_vacuum: null,
                            last_autovacuum: null,
                            last_analyze: null,
                            last_autoanalyze: null,
                        },
                    ],
                })
                .mockResolvedValueOnce({}) // INSERT for table
                // Mock index statistics
                .mockResolvedValueOnce({
                    rows: [
                        {
                            index_name: 'public.idx_user_products_tenant',
                            table_name: 'public.user_products',
                            size_bytes: '500000',
                            scans: '1000',
                            tuples_read: '50000',
                            tuples_fetched: '45000',
                        },
                    ],
                })
                .mockResolvedValue({}); // INSERT for index

            const stats = await collector.collectAllStatistics();

            expect(stats.tables).toHaveLength(1);
            expect(stats.indexes).toHaveLength(1);
        });
    });

    describe('cleanupOldStatistics', () => {
        it('should delete old statistics', async () => {
            mockClient.query
                .mockResolvedValueOnce({ rowCount: 100 }) // Tables deleted
                .mockResolvedValueOnce({ rowCount: 50 }); // Indexes deleted

            const result = await collector.cleanupOldStatistics();

            expect(result.tablesDeleted).toBe(100);
            expect(result.indexesDeleted).toBe(50);

            // Verify DELETE queries were called
            expect(mockClient.query).toHaveBeenCalledWith(
                expect.stringContaining('DELETE FROM database_statistics_history')
            );
            expect(mockClient.query).toHaveBeenCalledWith(
                expect.stringContaining('DELETE FROM index_statistics_history')
            );
        });

        it('should use correct retention period', async () => {
            mockClient.query
                .mockResolvedValueOnce({ rowCount: 0 })
                .mockResolvedValueOnce({ rowCount: 0 });

            await collector.cleanupOldStatistics();

            expect(mockClient.query).toHaveBeenCalledWith(
                expect.stringContaining(`${STATISTICS_HISTORY_RETENTION_DAYS} days`)
            );
        });

        it('should handle cleanup errors', async () => {
            mockClient.query.mockRejectedValueOnce(new Error('Delete failed'));

            await expect(collector.cleanupOldStatistics()).rejects.toThrow(
                'Delete failed'
            );
            expect(mockClient.release).toHaveBeenCalled();
        });
    });

    describe('getTableHistory', () => {
        it('should return historical statistics for a table', async () => {
            const mockHistory = [
                {
                    table_name: 'public.user_products',
                    size_bytes: '1000000',
                    row_count: '5000',
                    index_size_bytes: '200000',
                    bloat_percent: '10.5',
                    last_vacuum: new Date('2024-01-01'),
                    last_analyze: new Date('2024-01-02'),
                    collected_at: new Date('2024-01-15'),
                },
                {
                    table_name: 'public.user_products',
                    size_bytes: '900000',
                    row_count: '4500',
                    index_size_bytes: '180000',
                    bloat_percent: '8.2',
                    last_vacuum: new Date('2023-12-31'),
                    last_analyze: new Date('2024-01-01'),
                    collected_at: new Date('2024-01-14'),
                },
            ];

            mockClient.query.mockResolvedValueOnce({ rows: mockHistory });

            const history = await collector.getTableHistory('public.user_products', 30);

            expect(history).toHaveLength(2);
            expect(history[0].tableName).toBe('public.user_products');
            expect(history[0].sizeBytes).toBe(1000000);
            expect(history[0].bloatPercent).toBe(10.5);

            // Verify query parameters
            expect(mockClient.query).toHaveBeenCalledWith(
                expect.stringContaining('WHERE table_name = $1'),
                ['public.user_products']
            );
        });

        it('should return empty array for table with no history', async () => {
            mockClient.query.mockResolvedValueOnce({ rows: [] });

            const history = await collector.getTableHistory('public.new_table', 30);

            expect(history).toHaveLength(0);
        });
    });

    describe('getIndexHistory', () => {
        it('should return historical statistics for an index', async () => {
            const mockHistory = [
                {
                    index_name: 'public.idx_user_products_tenant',
                    table_name: 'public.user_products',
                    size_bytes: '500000',
                    scans: '1000',
                    tuples_read: '50000',
                    tuples_fetched: '45000',
                    collected_at: new Date('2024-01-15'),
                },
            ];

            mockClient.query.mockResolvedValueOnce({ rows: mockHistory });

            const history = await collector.getIndexHistory(
                'public.idx_user_products_tenant',
                30
            );

            expect(history).toHaveLength(1);
            expect(history[0].indexName).toBe('public.idx_user_products_tenant');
            expect(history[0].scans).toBe(1000);
        });
    });

    describe('getGrowthTrends', () => {
        it('should calculate growth trends', async () => {
            mockClient.query.mockResolvedValueOnce({
                rows: [
                    {
                        table_name: 'public.user_products',
                        start_size: '1000000',
                        end_size: '1200000',
                        growth_bytes: '200000',
                        growth_percent: '0.2',
                    },
                    {
                        table_name: 'public.price_history',
                        start_size: '2000000',
                        end_size: '2100000',
                        growth_bytes: '100000',
                        growth_percent: '0.05',
                    },
                ],
            });

            const trends = await collector.getGrowthTrends(30);

            expect(trends).toHaveLength(2);
            expect(trends[0].tableName).toBe('public.user_products');
            expect(trends[0].startSize).toBe(1000000);
            expect(trends[0].endSize).toBe(1200000);
            expect(trends[0].growthBytes).toBe(200000);
            expect(trends[0].growthPercent).toBe(0.2);
        });

        it('should handle tables with no growth', async () => {
            mockClient.query.mockResolvedValueOnce({
                rows: [
                    {
                        table_name: 'public.static_table',
                        start_size: '1000000',
                        end_size: '1000000',
                        growth_bytes: '0',
                        growth_percent: '0',
                    },
                ],
            });

            const trends = await collector.getGrowthTrends(30);

            expect(trends).toHaveLength(1);
            expect(trends[0].growthPercent).toBe(0);
        });

        it('should return empty array when no historical data exists', async () => {
            mockClient.query.mockResolvedValueOnce({ rows: [] });

            const trends = await collector.getGrowthTrends(30);

            expect(trends).toHaveLength(0);
        });
    });
});
