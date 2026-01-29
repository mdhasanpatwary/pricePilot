/**
 * Tests for MaintenanceScheduler
 * 
 * Tests table bloat detection, VACUUM scheduling, and growth monitoring.
 */

import { Pool } from 'pg';
import { MaintenanceScheduler } from '@/lib/services/maintenance-scheduler';
import {
    TABLE_BLOAT_WARNING_THRESHOLD,
    TABLE_BLOAT_CRITICAL_THRESHOLD,
} from '@/lib/database/optimization-constants';

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

describe('MaintenanceScheduler', () => {
    let pool: Pool;
    let scheduler: MaintenanceScheduler;
    let mockClient: any;

    beforeEach(() => {
        jest.clearAllMocks();
        pool = new Pool();
        scheduler = new MaintenanceScheduler(pool);
        mockClient = {
            query: jest.fn(),
            release: jest.fn(),
        };
        (pool.connect as jest.Mock).mockResolvedValue(mockClient);
    });

    describe('detectTableBloat', () => {
        it('should detect tables with bloat', async () => {
            // Mock tables list
            mockClient.query
                .mockResolvedValueOnce({
                    rows: [
                        { schemaname: 'public', tablename: 'user_products' },
                        { schemaname: 'public', tablename: 'price_history' },
                    ],
                })
                // Mock pgstattuple results
                .mockResolvedValueOnce({
                    rows: [
                        {
                            table_len: '1000000',
                            dead_tuple_len: '250000', // 25% bloat
                        },
                    ],
                })
                .mockResolvedValueOnce({
                    rows: [
                        {
                            table_len: '2000000',
                            dead_tuple_len: '100000', // 5% bloat
                        },
                    ],
                });

            const bloatInfo = await scheduler.detectTableBloat();

            expect(bloatInfo).toHaveLength(2);
            expect(bloatInfo[0].tableName).toBe('public.user_products');
            expect(bloatInfo[0].bloatPercent).toBe(0.25);
            expect(bloatInfo[0].shouldVacuum).toBe(true);
            expect(bloatInfo[1].shouldVacuum).toBe(false);
        });

        it('should handle tables that cannot be analyzed', async () => {
            mockClient.query
                .mockResolvedValueOnce({
                    rows: [{ schemaname: 'public', tablename: 'locked_table' }],
                })
                .mockRejectedValueOnce(new Error('Table is locked'));

            const bloatInfo = await scheduler.detectTableBloat();

            expect(bloatInfo).toHaveLength(0);
            expect(mockClient.release).toHaveBeenCalled();
        });

        it('should identify critical bloat correctly', async () => {
            mockClient.query
                .mockResolvedValueOnce({
                    rows: [{ schemaname: 'public', tablename: 'bloated_table' }],
                })
                .mockResolvedValueOnce({
                    rows: [
                        {
                            table_len: '1000000',
                            dead_tuple_len: '350000', // 35% bloat (critical)
                        },
                    ],
                });

            const bloatInfo = await scheduler.detectTableBloat();

            expect(bloatInfo[0].bloatPercent).toBeGreaterThanOrEqual(
                TABLE_BLOAT_CRITICAL_THRESHOLD
            );
            expect(bloatInfo[0].shouldVacuum).toBe(true);
        });
    });

    describe('scheduleVacuum', () => {
        it('should schedule VACUUM for warning-level bloat', async () => {
            const bloatInfo = [
                {
                    tableName: 'public.user_products',
                    bloatPercent: 0.25,
                    bloatBytes: 250000,
                    shouldVacuum: true,
                },
            ];

            const schedules = await scheduler.scheduleVacuum(bloatInfo);

            expect(schedules).toHaveLength(1);
            expect(schedules[0].operation).toBe('VACUUM');
            expect(schedules[0].tableName).toBe('public.user_products');
            expect(schedules[0].scheduledTime).toBeInstanceOf(Date);
        });

        it('should schedule VACUUM FULL for critical bloat', async () => {
            const bloatInfo = [
                {
                    tableName: 'public.bloated_table',
                    bloatPercent: 0.35,
                    bloatBytes: 350000,
                    shouldVacuum: true,
                },
            ];

            const schedules = await scheduler.scheduleVacuum(bloatInfo);

            expect(schedules).toHaveLength(1);
            expect(schedules[0].operation).toBe('VACUUM_FULL');
        });

        it('should not schedule VACUUM for tables below threshold', async () => {
            const bloatInfo = [
                {
                    tableName: 'public.clean_table',
                    bloatPercent: 0.1,
                    bloatBytes: 100000,
                    shouldVacuum: false,
                },
            ];

            const schedules = await scheduler.scheduleVacuum(bloatInfo);

            expect(schedules).toHaveLength(0);
        });

        it('should estimate duration for VACUUM operations', async () => {
            const bloatInfo = [
                {
                    tableName: 'public.large_table',
                    bloatPercent: 0.25,
                    bloatBytes: 10 * 1024 * 1024, // 10MB
                    shouldVacuum: true,
                },
            ];

            const schedules = await scheduler.scheduleVacuum(bloatInfo);

            expect(schedules[0].estimatedDuration).toBeGreaterThan(0);
        });
    });

    describe('executeVacuum', () => {
        it('should execute VACUUM operation', async () => {
            const schedule = {
                operation: 'VACUUM' as const,
                tableName: 'public.user_products',
                scheduledTime: new Date(),
                estimatedDuration: 5000,
            };

            mockClient.query.mockResolvedValueOnce({});

            await scheduler.executeVacuum(schedule);

            expect(mockClient.query).toHaveBeenCalledWith(
                'VACUUM public.user_products'
            );
            expect(mockClient.release).toHaveBeenCalled();
        });

        it('should execute VACUUM FULL operation', async () => {
            const schedule = {
                operation: 'VACUUM_FULL' as const,
                tableName: 'public.bloated_table',
                scheduledTime: new Date(),
                estimatedDuration: 10000,
            };

            mockClient.query.mockResolvedValueOnce({});

            await scheduler.executeVacuum(schedule);

            expect(mockClient.query).toHaveBeenCalledWith(
                'VACUUM FULL public.bloated_table'
            );
        });

        it('should handle VACUUM failures', async () => {
            const schedule = {
                operation: 'VACUUM' as const,
                tableName: 'public.locked_table',
                scheduledTime: new Date(),
                estimatedDuration: 5000,
            };

            mockClient.query.mockRejectedValueOnce(new Error('Table is locked'));

            await expect(scheduler.executeVacuum(schedule)).rejects.toThrow(
                'Table is locked'
            );
            expect(mockClient.release).toHaveBeenCalled();
        });
    });

    describe('monitorGrowth', () => {
        it('should detect high growth tables', async () => {
            // Mock current sizes
            mockClient.query
                .mockResolvedValueOnce({
                    rows: [
                        {
                            table_name: 'public.user_products',
                            size_bytes: '1200000', // 1.2MB
                        },
                    ],
                })
                // Mock historical sizes (7 days ago)
                .mockResolvedValueOnce({
                    rows: [
                        {
                            table_name: 'public.user_products',
                            size_bytes: '1000000', // 1MB (20% growth)
                        },
                    ],
                });

            const alerts = await scheduler.monitorGrowth();

            expect(alerts).toHaveLength(1);
            expect(alerts[0].tableName).toBe('public.user_products');
            expect(alerts[0].growthPercent).toBe(0.2);
            expect(alerts[0].currentSizeBytes).toBe(1200000);
        });

        it('should not alert for normal growth', async () => {
            mockClient.query
                .mockResolvedValueOnce({
                    rows: [
                        {
                            table_name: 'public.user_products',
                            size_bytes: '1100000', // 1.1MB
                        },
                    ],
                })
                .mockResolvedValueOnce({
                    rows: [
                        {
                            table_name: 'public.user_products',
                            size_bytes: '1000000', // 1MB (10% growth - below threshold)
                        },
                    ],
                });

            const alerts = await scheduler.monitorGrowth();

            expect(alerts).toHaveLength(0);
        });

        it('should handle tables without historical data', async () => {
            mockClient.query
                .mockResolvedValueOnce({
                    rows: [
                        {
                            table_name: 'public.new_table',
                            size_bytes: '1000000',
                        },
                    ],
                })
                .mockResolvedValueOnce({
                    rows: [], // No historical data
                });

            const alerts = await scheduler.monitorGrowth();

            expect(alerts).toHaveLength(0);
        });
    });

    describe('getIndexSizes', () => {
        it('should return index sizes', async () => {
            mockClient.query.mockResolvedValueOnce({
                rows: [
                    {
                        index_name: 'public.idx_user_products_tenant',
                        size_bytes: '500000',
                    },
                    {
                        index_name: 'public.idx_price_history_product',
                        size_bytes: '300000',
                    },
                ],
            });

            const sizes = await scheduler.getIndexSizes();

            expect(sizes).toHaveLength(2);
            expect(sizes[0].indexName).toBe('public.idx_user_products_tenant');
            expect(sizes[0].sizeBytes).toBe(500000);
        });
    });

    describe('runMaintenanceCheck', () => {
        it('should run complete maintenance check', async () => {
            // Mock detectTableBloat
            mockClient.query
                .mockResolvedValueOnce({
                    rows: [{ schemaname: 'public', tablename: 'user_products' }],
                })
                .mockResolvedValueOnce({
                    rows: [
                        {
                            table_len: '1000000',
                            dead_tuple_len: '250000',
                        },
                    ],
                })
                // Mock monitorGrowth - current sizes
                .mockResolvedValueOnce({
                    rows: [
                        {
                            table_name: 'public.user_products',
                            size_bytes: '1200000',
                        },
                    ],
                })
                // Mock monitorGrowth - historical sizes
                .mockResolvedValueOnce({
                    rows: [
                        {
                            table_name: 'public.user_products',
                            size_bytes: '1000000',
                        },
                    ],
                });

            const results = await scheduler.runMaintenanceCheck();

            expect(results.bloatInfo).toBeDefined();
            expect(results.schedules).toBeDefined();
            expect(results.growthAlerts).toBeDefined();
        });
    });
});
