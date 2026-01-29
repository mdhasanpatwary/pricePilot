/**
 * Unit Tests for Index Manager Component
 * 
 * Tests the IndexManager class functionality including:
 * - Index suggestion generation
 * - Unused index detection
 * - Concurrent index creation
 * - Index fragmentation monitoring
 * - Index statistics collection
 */

import { IndexManager } from '@/lib/services/index-manager';

// Mock the dependencies
jest.mock('@/lib/database/optimized-prisma', () => ({
    optimizedPrisma: {
        indexRecommendation: {
            create: jest.fn(),
            updateMany: jest.fn()
        }
    }
}));

jest.mock('@/lib/services/connection-pool-manager', () => ({
    getConnectionPoolManager: jest.fn()
}));

jest.mock('@/lib/database/optimization-constants', () => ({
    OPTIMIZATION_CONFIG: {
        INDEX_MANAGER: {
            FRAGMENTATION_THRESHOLD: 30,
            MIN_TABLE_SIZE_FOR_INDEX: 10000,
            UNUSED_INDEX_DAYS: 30
        }
    },
    isMaintenanceWindow: jest.fn(() => true)
}));

import { optimizedPrisma } from '@/lib/database/optimized-prisma';
import { getConnectionPoolManager } from '@/lib/services/connection-pool-manager';

describe('IndexManager', () => {
    let indexManager: IndexManager;
    let mockPool: any;

    beforeEach(() => {
        // Create mock pool
        mockPool = {
            query: jest.fn()
        };

        // Mock the connection pool manager
        (getConnectionPoolManager as jest.Mock).mockReturnValue({
            getPool: () => mockPool
        });

        indexManager = new IndexManager();
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('suggestIndexes', () => {
        it('should suggest indexes for tables with slow queries', async () => {
            // Mock pg_stat_statements query
            mockPool.query
                .mockResolvedValueOnce({
                    rows: [
                        {
                            tablename: 'user_products',
                            size_bytes: '150000000',
                            write_activity: '5000',
                            slow_query_count: 8
                        }
                    ]
                })
                // Mock existing indexes query
                .mockResolvedValueOnce({
                    rows: [
                        {
                            indexname: 'user_products_pkey',
                            indexdef: 'CREATE UNIQUE INDEX user_products_pkey ON user_products(id)'
                        }
                    ]
                });

            // Mock Prisma create
            (optimizedPrisma.indexRecommendation.create as jest.Mock).mockResolvedValue({
                id: '1',
                tableName: 'user_products',
                columns: ['tenantId', 'status']
            });

            const suggestions = await indexManager.suggestIndexes();

            expect(suggestions.length).toBeGreaterThan(0);
            expect(suggestions[0]).toHaveProperty('tableName');
            expect(suggestions[0]).toHaveProperty('columns');
            expect(suggestions[0]).toHaveProperty('reason');
            expect(suggestions[0]).toHaveProperty('estimatedImpact');
            expect(suggestions[0]).toHaveProperty('createStatement');
        });

        it('should not suggest indexes that already exist', async () => {
            mockPool.query
                .mockResolvedValueOnce({
                    rows: [
                        {
                            tablename: 'user_products',
                            size_bytes: '150000000',
                            write_activity: '5000',
                            slow_query_count: 8
                        }
                    ]
                })
                .mockResolvedValueOnce({
                    rows: [
                        {
                            indexname: 'idx_user_products_tenant_status',
                            indexdef: 'CREATE INDEX idx_user_products_tenant_status ON user_products(tenantid, status)'
                        },
                        {
                            indexname: 'idx_user_products_tenant_created',
                            indexdef: 'CREATE INDEX idx_user_products_tenant_created ON user_products(tenantid, createdat)'
                        },
                        {
                            indexname: 'idx_user_products_updated',
                            indexdef: 'CREATE INDEX idx_user_products_updated ON user_products(updatedat)'
                        }
                    ]
                });

            const suggestions = await indexManager.suggestIndexes();

            // Should not suggest indexes that already exist
            expect(suggestions.length).toBe(0);
        });

        it('should estimate high impact for large tables with many slow queries', async () => {
            mockPool.query
                .mockResolvedValueOnce({
                    rows: [
                        {
                            tablename: 'price_history',
                            size_bytes: '500000000', // 500MB
                            write_activity: '2000',
                            slow_query_count: 10
                        }
                    ]
                })
                .mockResolvedValueOnce({
                    rows: []
                });

            (optimizedPrisma.indexRecommendation.create as jest.Mock).mockResolvedValue({});

            const suggestions = await indexManager.suggestIndexes();

            const highImpactSuggestions = suggestions.filter(s => s.estimatedImpact === 'high');
            expect(highImpactSuggestions.length).toBeGreaterThan(0);
        });
    });

    describe('findUnusedIndexes', () => {
        it('should identify indexes with zero scans', async () => {
            mockPool.query.mockResolvedValueOnce({
                rows: [
                    {
                        schemaname: 'public',
                        tablename: 'old_table',
                        indexname: 'idx_old_table_unused',
                        idx_scan: 0,
                        index_size: '50 MB',
                        size_bytes: '52428800',
                        last_vacuum: null
                    },
                    {
                        schemaname: 'public',
                        tablename: 'another_table',
                        indexname: 'idx_another_unused',
                        idx_scan: 0,
                        index_size: '25 MB',
                        size_bytes: '26214400',
                        last_vacuum: '2024-01-01'
                    }
                ]
            });

            const unusedIndexes = await indexManager.findUnusedIndexes(30);

            expect(unusedIndexes).toHaveLength(2);
            expect(unusedIndexes[0]).toHaveProperty('indexName');
            expect(unusedIndexes[0]).toHaveProperty('tableName');
            expect(unusedIndexes[0]).toHaveProperty('sizeBytes');
            expect(unusedIndexes[0]).toHaveProperty('dropStatement');
            expect(unusedIndexes[0].dropStatement).toContain('DROP INDEX CONCURRENTLY');
        });

        it('should not include primary key or unique indexes', async () => {
            mockPool.query.mockResolvedValueOnce({
                rows: [] // Query already filters these out
            });

            const unusedIndexes = await indexManager.findUnusedIndexes(30);

            expect(unusedIndexes).toHaveLength(0);
        });

        it('should order unused indexes by size descending', async () => {
            mockPool.query.mockResolvedValueOnce({
                rows: [
                    {
                        schemaname: 'public',
                        tablename: 'table1',
                        indexname: 'idx_large',
                        idx_scan: 0,
                        index_size: '100 MB',
                        size_bytes: '104857600',
                        last_vacuum: null
                    },
                    {
                        schemaname: 'public',
                        tablename: 'table2',
                        indexname: 'idx_small',
                        idx_scan: 0,
                        index_size: '10 MB',
                        size_bytes: '10485760',
                        last_vacuum: null
                    }
                ]
            });

            const unusedIndexes = await indexManager.findUnusedIndexes(30);

            expect(unusedIndexes[0].sizeBytes).toBeGreaterThan(unusedIndexes[1].sizeBytes);
        });
    });

    describe('createIndexConcurrently', () => {
        it('should generate correct CREATE INDEX CONCURRENTLY SQL', async () => {
            mockPool.query.mockResolvedValueOnce({});
            (optimizedPrisma.indexRecommendation.updateMany as jest.Mock).mockResolvedValue({});

            const indexDef = {
                name: 'idx_test_table_columns',
                tableName: 'test_table',
                columns: ['column1', 'column2'],
                unique: false
            };

            await indexManager.createIndexConcurrently(indexDef);

            expect(mockPool.query).toHaveBeenCalledWith(
                expect.stringContaining('CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_test_table_columns')
            );
            expect(mockPool.query).toHaveBeenCalledWith(
                expect.stringContaining('ON test_table(column1, column2)')
            );
        });

        it('should generate UNIQUE index when specified', async () => {
            mockPool.query.mockResolvedValueOnce({});
            (optimizedPrisma.indexRecommendation.updateMany as jest.Mock).mockResolvedValue({});

            const indexDef = {
                name: 'idx_test_unique',
                tableName: 'test_table',
                columns: ['email'],
                unique: true
            };

            await indexManager.createIndexConcurrently(indexDef);

            expect(mockPool.query).toHaveBeenCalledWith(
                expect.stringContaining('CREATE UNIQUE INDEX CONCURRENTLY')
            );
        });

        it('should include WHERE clause when provided', async () => {
            mockPool.query.mockResolvedValueOnce({});
            (optimizedPrisma.indexRecommendation.updateMany as jest.Mock).mockResolvedValue({});

            const indexDef = {
                name: 'idx_test_partial',
                tableName: 'test_table',
                columns: ['status'],
                unique: false,
                where: "status = 'active'"
            };

            await indexManager.createIndexConcurrently(indexDef);

            expect(mockPool.query).toHaveBeenCalledWith(
                expect.stringContaining("WHERE status = 'active'")
            );
        });

        it('should update recommendation status after creation', async () => {
            mockPool.query.mockResolvedValueOnce({});
            (optimizedPrisma.indexRecommendation.updateMany as jest.Mock).mockResolvedValue({});

            const indexDef = {
                name: 'idx_test',
                tableName: 'test_table',
                columns: ['col1'],
                unique: false
            };

            await indexManager.createIndexConcurrently(indexDef);

            expect(optimizedPrisma.indexRecommendation.updateMany).toHaveBeenCalledWith({
                where: {
                    tableName: 'test_table',
                    columns: {
                        equals: ['col1']
                    },
                    status: 'pending'
                },
                data: {
                    status: 'applied',
                    appliedAt: expect.any(Date)
                }
            });
        });

        it('should throw error if index creation fails', async () => {
            mockPool.query.mockRejectedValueOnce(new Error('Index creation failed'));

            const indexDef = {
                name: 'idx_test',
                tableName: 'test_table',
                columns: ['col1'],
                unique: false
            };

            await expect(indexManager.createIndexConcurrently(indexDef)).rejects.toThrow('Index creation failed');
        });
    });

    describe('rebuildFragmentedIndexes', () => {
        it('should rebuild indexes exceeding fragmentation threshold', async () => {
            // Mock index list query
            mockPool.query
                .mockResolvedValueOnce({
                    rows: [
                        {
                            schemaname: 'public',
                            tablename: 'large_table',
                            indexname: 'idx_large_fragmented',
                            size_bytes: '20971520' // 20MB
                        }
                    ]
                })
                // Mock fragmentation check
                .mockResolvedValueOnce({
                    rows: [{ fragmentation_percent: '45.50' }]
                })
                // Mock REINDEX
                .mockResolvedValueOnce({});

            await indexManager.rebuildFragmentedIndexes(30);

            expect(mockPool.query).toHaveBeenCalledWith(
                expect.stringContaining('REINDEX INDEX CONCURRENTLY idx_large_fragmented')
            );
        });

        it('should skip indexes below fragmentation threshold', async () => {
            mockPool.query
                .mockResolvedValueOnce({
                    rows: [
                        {
                            schemaname: 'public',
                            tablename: 'table1',
                            indexname: 'idx_healthy',
                            size_bytes: '20971520'
                        }
                    ]
                })
                .mockResolvedValueOnce({
                    rows: [{ fragmentation_percent: '15.00' }]
                });

            await indexManager.rebuildFragmentedIndexes(30);

            // Should not call REINDEX
            expect(mockPool.query).toHaveBeenCalledTimes(2);
        });

        it('should continue on error for individual indexes', async () => {
            mockPool.query
                .mockResolvedValueOnce({
                    rows: [
                        {
                            schemaname: 'public',
                            tablename: 'table1',
                            indexname: 'idx_error',
                            size_bytes: '20971520'
                        },
                        {
                            schemaname: 'public',
                            tablename: 'table2',
                            indexname: 'idx_success',
                            size_bytes: '20971520'
                        }
                    ]
                })
                .mockRejectedValueOnce(new Error('Fragmentation check failed'))
                .mockResolvedValueOnce({
                    rows: [{ fragmentation_percent: '40.00' }]
                })
                .mockResolvedValueOnce({});

            await indexManager.rebuildFragmentedIndexes(30);

            // Should still process the second index
            expect(mockPool.query).toHaveBeenCalledWith(
                expect.stringContaining('REINDEX INDEX CONCURRENTLY idx_success')
            );
        });
    });

    describe('getIndexStats', () => {
        it('should return comprehensive index statistics', async () => {
            mockPool.query
                .mockResolvedValueOnce({
                    rows: [
                        {
                            schemaname: 'public',
                            tablename: 'user_products',
                            indexname: 'idx_user_products_tenant',
                            scans: '15000',
                            tuples_read: '500000',
                            tuples_returned: '450000',
                            size_bytes: '52428800' // 50MB
                        },
                        {
                            schemaname: 'public',
                            tablename: 'price_history',
                            indexname: 'idx_price_history_recorded',
                            scans: '8000',
                            tuples_read: '200000',
                            tuples_returned: '180000',
                            size_bytes: '5242880' // 5MB (below fragmentation check threshold)
                        }
                    ]
                })
                // Mock fragmentation check for large index
                .mockResolvedValueOnce({
                    rows: [{ fragmentation_percent: '12.50' }]
                });

            const stats = await indexManager.getIndexStats();

            expect(stats).toHaveLength(2);
            expect(stats[0]).toEqual({
                indexName: 'idx_user_products_tenant',
                tableName: 'user_products',
                sizeBytes: 52428800,
                scans: 15000,
                tuplesRead: 500000,
                tuplesReturned: 450000,
                fragmentation: 12.5
            });
            expect(stats[1]).toEqual({
                indexName: 'idx_price_history_recorded',
                tableName: 'price_history',
                sizeBytes: 5242880,
                scans: 8000,
                tuplesRead: 200000,
                tuplesReturned: 180000,
                fragmentation: 0 // Not checked for small indexes
            });
        });

        it('should handle fragmentation check failures gracefully', async () => {
            mockPool.query
                .mockResolvedValueOnce({
                    rows: [
                        {
                            schemaname: 'public',
                            tablename: 'test_table',
                            indexname: 'idx_test',
                            scans: '1000',
                            tuples_read: '10000',
                            tuples_returned: '9000',
                            size_bytes: '20971520' // 20MB
                        }
                    ]
                })
                .mockRejectedValueOnce(new Error('pgstatindex failed'));

            const stats = await indexManager.getIndexStats();

            expect(stats).toHaveLength(1);
            expect(stats[0].fragmentation).toBe(0);
        });

        it('should order indexes by size descending', async () => {
            mockPool.query.mockResolvedValueOnce({
                rows: [
                    {
                        schemaname: 'public',
                        tablename: 'table1',
                        indexname: 'idx_large',
                        scans: '1000',
                        tuples_read: '10000',
                        tuples_returned: '9000',
                        size_bytes: '104857600' // 100MB
                    },
                    {
                        schemaname: 'public',
                        tablename: 'table2',
                        indexname: 'idx_small',
                        scans: '500',
                        tuples_read: '5000',
                        tuples_returned: '4500',
                        size_bytes: '10485760' // 10MB
                    }
                ]
            });

            const stats = await indexManager.getIndexStats();

            expect(stats[0].sizeBytes).toBeGreaterThan(stats[1].sizeBytes);
        });
    });
});
