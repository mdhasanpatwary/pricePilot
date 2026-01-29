/**
 * Query Analyzer Tests
 * 
 * Tests for the QueryAnalyzer component including slow query logging,
 * query plan analysis, recommendation generation, and performance trends.
 */

import { PrismaClient } from '@prisma/client';
import {
    QueryAnalyzerImpl,
    getQueryAnalyzer,
    resetQueryAnalyzer,
} from '@/lib/services/query-analyzer';
import {
    SlowQueryData,
    TimeRange,
} from '@/lib/types/database-optimization';

// Mock Prisma Client
const mockPrisma = {
    slowQuery: {
        create: jest.fn(),
        findMany: jest.fn(),
    },
    queryPerformanceMetric: {
        findMany: jest.fn(),
    },
    $queryRaw: jest.fn(),
    $queryRawUnsafe: jest.fn(),
    $executeRaw: jest.fn(),
} as unknown as PrismaClient;

describe('QueryAnalyzer', () => {
    let queryAnalyzer: QueryAnalyzerImpl;

    beforeEach(() => {
        queryAnalyzer = new QueryAnalyzerImpl(mockPrisma);
        jest.clearAllMocks();
    });

    describe('logSlowQuery', () => {
        it('should log queries exceeding threshold', async () => {
            const slowQuery: SlowQueryData = {
                query: 'SELECT * FROM users WHERE id = $1',
                params: [123],
                executionTime: 1500,
                affectedRows: 1,
                tenantId: 'tenant-1',
                timestamp: new Date(),
                executionPlan: 'Seq Scan on users',
            };

            await queryAnalyzer.logSlowQuery(slowQuery);

            expect(mockPrisma.slowQuery.create).toHaveBeenCalledTimes(1);
            expect(mockPrisma.slowQuery.create).toHaveBeenCalledWith({
                data: expect.objectContaining({
                    queryText: slowQuery.query,
                    executionTimeMs: slowQuery.executionTime,
                    affectedRows: slowQuery.affectedRows,
                    tenantId: slowQuery.tenantId,
                    executionPlan: slowQuery.executionPlan,
                }),
            });
        });

        it('should not log queries below threshold', async () => {
            const fastQuery: SlowQueryData = {
                query: 'SELECT * FROM users WHERE id = $1',
                params: [123],
                executionTime: 500, // Below 1000ms threshold
                affectedRows: 1,
                tenantId: 'tenant-1',
                timestamp: new Date(),
                executionPlan: 'Index Scan',
            };

            await queryAnalyzer.logSlowQuery(fastQuery);

            expect(mockPrisma.slowQuery.create).not.toHaveBeenCalled();
        });

        it('should generate query fingerprint', async () => {
            const slowQuery: SlowQueryData = {
                query: 'SELECT * FROM users WHERE id = 123',
                params: [],
                executionTime: 1500,
                affectedRows: 1,
                tenantId: 'tenant-1',
                timestamp: new Date(),
                executionPlan: 'Seq Scan',
            };

            await queryAnalyzer.logSlowQuery(slowQuery);

            expect(mockPrisma.slowQuery.create).toHaveBeenCalledWith({
                data: expect.objectContaining({
                    queryFingerprint: expect.any(String),
                }),
            });
        });

        it('should store params as JSON', async () => {
            const slowQuery: SlowQueryData = {
                query: 'SELECT * FROM users WHERE id = $1 AND name = $2',
                params: [123, 'John'],
                executionTime: 1500,
                affectedRows: 1,
                tenantId: 'tenant-1',
                timestamp: new Date(),
                executionPlan: 'Seq Scan',
            };

            await queryAnalyzer.logSlowQuery(slowQuery);

            expect(mockPrisma.slowQuery.create).toHaveBeenCalledWith({
                data: expect.objectContaining({
                    params: slowQuery.params,
                }),
            });
        });
    });

    describe('getTopSlowQueries', () => {
        it('should return top slow queries', async () => {
            const mockResults = [
                {
                    query: 'select * from users where ?',
                    avg_execution_time: '2500.50',
                    max_execution_time: 5000,
                    execution_count: '10',
                    last_executed: new Date('2024-01-15'),
                },
                {
                    query: 'select * from products where ?',
                    avg_execution_time: '1800.25',
                    max_execution_time: 3000,
                    execution_count: '5',
                    last_executed: new Date('2024-01-14'),
                },
            ];

            (mockPrisma.$queryRaw as jest.Mock).mockResolvedValue(mockResults);

            const timeRange: TimeRange = {
                start: new Date('2024-01-01'),
                end: new Date('2024-01-31'),
            };

            const result = await queryAnalyzer.getTopSlowQueries(20, timeRange);

            expect(result).toHaveLength(2);
            expect(result[0]).toEqual({
                query: 'select * from users where ?',
                avgExecutionTime: 2500.50,
                maxExecutionTime: 5000,
                executionCount: 10,
                lastExecuted: expect.any(Date),
            });
        });

        it('should respect limit parameter', async () => {
            (mockPrisma.$queryRaw as jest.Mock).mockResolvedValue([]);

            const timeRange: TimeRange = {
                start: new Date('2024-01-01'),
                end: new Date('2024-01-31'),
            };

            await queryAnalyzer.getTopSlowQueries(10, timeRange);

            expect(mockPrisma.$queryRaw).toHaveBeenCalled();
        });

        it('should filter by time range', async () => {
            (mockPrisma.$queryRaw as jest.Mock).mockResolvedValue([]);

            const timeRange: TimeRange = {
                start: new Date('2024-01-01'),
                end: new Date('2024-01-31'),
            };

            await queryAnalyzer.getTopSlowQueries(20, timeRange);

            expect(mockPrisma.$queryRaw).toHaveBeenCalled();
        });
    });

    describe('analyzeQueryPlan', () => {
        it('should analyze query execution plan', async () => {
            const mockPlan = [
                {
                    'QUERY PLAN': [
                        {
                            Plan: {
                                'Node Type': 'Seq Scan',
                                'Total Cost': 100.5,
                                'Actual Total Time': 95.3,
                            },
                        },
                    ],
                },
            ];

            (mockPrisma.$queryRawUnsafe as jest.Mock).mockResolvedValue(mockPlan);

            const result = await queryAnalyzer.analyzeQueryPlan(
                'SELECT * FROM users WHERE id = $1',
                [123]
            );

            expect(result).toEqual({
                planText: expect.any(String),
                estimatedCost: 100.5,
                actualCost: 95.3,
                indexesUsed: [],
                sequentialScans: true,
            });
        });

        it('should detect sequential scans', async () => {
            const mockPlan = [
                {
                    'QUERY PLAN': [
                        {
                            Plan: {
                                'Node Type': 'Seq Scan',
                                'Total Cost': 100,
                                'Actual Total Time': 95,
                            },
                        },
                    ],
                },
            ];

            (mockPrisma.$queryRawUnsafe as jest.Mock).mockResolvedValue(mockPlan);

            const result = await queryAnalyzer.analyzeQueryPlan('SELECT * FROM users', []);

            expect(result.sequentialScans).toBe(true);
        });

        it('should handle EXPLAIN failures gracefully', async () => {
            (mockPrisma.$queryRawUnsafe as jest.Mock).mockRejectedValue(
                new Error('EXPLAIN failed')
            );

            const result = await queryAnalyzer.analyzeQueryPlan('INVALID QUERY', []);

            expect(result).toEqual({
                planText: 'Failed to generate execution plan',
                estimatedCost: 0,
                actualCost: 0,
                indexesUsed: [],
                sequentialScans: false,
            });
        });
    });

    describe('generateRecommendations', () => {
        it('should recommend index for WHERE clause', async () => {
            const query = 'SELECT * FROM users WHERE email = $1';
            const recommendations = await queryAnalyzer.generateRecommendations(query);

            const indexRec = recommendations.find(r => r.type === 'index');
            expect(indexRec).toBeDefined();
            expect(indexRec?.description).toContain('WHERE clause');
        });

        it('should recommend against SELECT *', async () => {
            const query = 'SELECT * FROM users';
            const recommendations = await queryAnalyzer.generateRecommendations(query);

            const rewriteRec = recommendations.find(
                r => r.type === 'rewrite' && r.description.includes('SELECT *')
            );
            expect(rewriteRec).toBeDefined();
        });

        it('should recommend LIMIT for unbounded queries', async () => {
            const query = 'SELECT id, name FROM users';
            const recommendations = await queryAnalyzer.generateRecommendations(query);

            const limitRec = recommendations.find(
                r => r.type === 'rewrite' && r.description.includes('LIMIT')
            );
            expect(limitRec).toBeDefined();
        });

        it('should recommend JOIN over subqueries', async () => {
            const query = 'SELECT * FROM users WHERE id IN (SELECT user_id FROM orders)';
            const recommendations = await queryAnalyzer.generateRecommendations(query);

            const joinRec = recommendations.find(
                r => r.type === 'rewrite' && r.description.includes('subqueries')
            );
            expect(joinRec).toBeDefined();
        });

        it('should recommend caching for read queries', async () => {
            const query = 'SELECT * FROM products WHERE category = $1';
            const recommendations = await queryAnalyzer.generateRecommendations(query);

            const cacheRec = recommendations.find(r => r.type === 'cache');
            expect(cacheRec).toBeDefined();
        });

        it('should return multiple recommendations', async () => {
            const query = 'SELECT * FROM users WHERE email = $1';
            const recommendations = await queryAnalyzer.generateRecommendations(query);

            expect(recommendations.length).toBeGreaterThan(0);
            expect(recommendations.every(r => r.type && r.description && r.implementation)).toBe(true);
        });
    });

    describe('getPerformanceTrends', () => {
        it('should return performance trends', async () => {
            const mockMetrics = [
                {
                    date: new Date('2024-01-01'),
                    avgExecutionTimeMs: 1500.5,
                    executionCount: 100,
                    p95ExecutionTimeMs: 2500,
                },
                {
                    date: new Date('2024-01-02'),
                    avgExecutionTimeMs: 1400.3,
                    executionCount: 120,
                    p95ExecutionTimeMs: 2300,
                },
            ];

            (mockPrisma.queryPerformanceMetric.findMany as jest.Mock).mockResolvedValue(mockMetrics);

            const timeRange: TimeRange = {
                start: new Date('2024-01-01'),
                end: new Date('2024-01-31'),
            };

            const result = await queryAnalyzer.getPerformanceTrends(timeRange);

            expect(result).toHaveLength(2);
            expect(result[0]).toEqual({
                date: expect.any(Date),
                avgExecutionTime: 1500.5,
                executionCount: 100,
                p95ExecutionTime: 2500,
            });
        });

        it('should order trends by date ascending', async () => {
            (mockPrisma.queryPerformanceMetric.findMany as jest.Mock).mockResolvedValue([]);

            const timeRange: TimeRange = {
                start: new Date('2024-01-01'),
                end: new Date('2024-01-31'),
            };

            await queryAnalyzer.getPerformanceTrends(timeRange);

            expect(mockPrisma.queryPerformanceMetric.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    orderBy: { date: 'asc' },
                })
            );
        });
    });

    describe('aggregateDailyMetrics', () => {
        it('should aggregate metrics for a given date', async () => {
            (mockPrisma.$executeRaw as jest.Mock).mockResolvedValue(undefined);

            const date = new Date('2024-01-15');
            await queryAnalyzer.aggregateDailyMetrics(date);

            expect(mockPrisma.$executeRaw).toHaveBeenCalledTimes(1);
        });

        it('should handle date boundaries correctly', async () => {
            (mockPrisma.$executeRaw as jest.Mock).mockResolvedValue(undefined);

            const date = new Date('2024-01-15T12:30:00Z');
            await queryAnalyzer.aggregateDailyMetrics(date);

            expect(mockPrisma.$executeRaw).toHaveBeenCalled();
        });
    });

    describe('Singleton Pattern', () => {
        beforeEach(() => {
            resetQueryAnalyzer();
        });

        it('should return same instance on multiple calls', () => {
            const instance1 = getQueryAnalyzer(mockPrisma);
            const instance2 = getQueryAnalyzer(mockPrisma);

            expect(instance1).toBe(instance2);
        });

        it('should reset instance', () => {
            const instance1 = getQueryAnalyzer(mockPrisma);
            resetQueryAnalyzer();
            const instance2 = getQueryAnalyzer(mockPrisma);

            expect(instance1).not.toBe(instance2);
        });
    });
});
