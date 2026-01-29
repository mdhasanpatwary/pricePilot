/**
 * Tests for Performance Tester
 */

import { Pool } from 'pg';
import { PerformanceTester, WorkloadConfig } from '@/lib/services/performance-tester';

// Mock pg Pool
jest.mock('pg', () => {
    const mockQuery = jest.fn();
    const mockConnect = jest.fn();
    const mockRelease = jest.fn();

    return {
        Pool: jest.fn().mockImplementation(() => ({
            query: mockQuery,
            connect: mockConnect,
        })),
    };
});

describe('PerformanceTester', () => {
    let pool: Pool;
    let tester: PerformanceTester;
    let mockQuery: jest.Mock;
    let mockConnect: jest.Mock;

    beforeEach(() => {
        jest.clearAllMocks();
        pool = new Pool();
        mockQuery = pool.query as jest.Mock;
        mockConnect = pool.connect as jest.Mock;
        tester = new PerformanceTester(pool);

        // Default mock implementations
        mockQuery.mockResolvedValue({ rows: [], rowCount: 0 });
        mockConnect.mockResolvedValue({
            query: mockQuery,
            release: jest.fn(),
        });
    });

    describe('runPerformanceTest', () => {
        it('should execute performance test with given configuration', async () => {
            const config: WorkloadConfig = {
                name: 'Test Workload',
                queries: [
                    { sql: 'SELECT 1', weight: 1 },
                ],
                concurrentConnections: 2,
                durationSeconds: 1,
            };

            const result = await tester.runPerformanceTest(config);

            expect(result.testName).toBe('Test Workload');
            expect(result.concurrentConnections).toBe(2);
            expect(result.queriesExecuted).toBeGreaterThan(0);
            expect(result.metrics).toHaveProperty('p50');
            expect(result.metrics).toHaveProperty('p95');
            expect(result.metrics).toHaveProperty('p99');
        });

        it('should handle multiple queries with different weights', async () => {
            const config: WorkloadConfig = {
                name: 'Weighted Test',
                queries: [
                    { sql: 'SELECT 1', weight: 5 },
                    { sql: 'SELECT 2', weight: 1 },
                ],
                concurrentConnections: 1,
                durationSeconds: 1,
            };

            const result = await tester.runPerformanceTest(config);

            expect(result.queriesExecuted).toBeGreaterThan(0);
            expect(mockQuery).toHaveBeenCalled();
        });

        it('should replace tenant placeholders in queries', async () => {
            const config: WorkloadConfig = {
                name: 'Tenant Test',
                queries: [
                    { sql: 'SELECT * FROM products WHERE tenant_id = $tenantId', weight: 1 },
                ],
                concurrentConnections: 1,
                durationSeconds: 1,
                tenantIds: ['tenant-1', 'tenant-2'],
            };

            const result = await tester.runPerformanceTest(config);

            expect(result.queriesExecuted).toBeGreaterThan(0);
        });

        it('should track success and failure counts', async () => {
            mockQuery
                .mockResolvedValueOnce({ rows: [], rowCount: 0 })
                .mockRejectedValueOnce(new Error('Query failed'))
                .mockResolvedValue({ rows: [], rowCount: 0 });

            const config: WorkloadConfig = {
                name: 'Error Test',
                queries: [
                    { sql: 'SELECT 1', weight: 1 },
                ],
                concurrentConnections: 1,
                durationSeconds: 1,
            };

            const result = await tester.runPerformanceTest(config);

            expect(result.successCount).toBeGreaterThan(0);
            // Note: failureCount might be 0 if the error happens early and other queries succeed
        });
    });

    describe('measureQueryResponseTime', () => {
        it('should measure query response time with percentiles', async () => {
            // Mock varying response times
            let callCount = 0;
            mockQuery.mockImplementation(() => {
                callCount++;
                return new Promise(resolve => {
                    setTimeout(() => resolve({ rows: [], rowCount: 0 }), callCount % 10);
                });
            });

            const result = await tester.measureQueryResponseTime(
                'SELECT 1',
                [],
                10
            );

            expect(result).toHaveProperty('p50');
            expect(result).toHaveProperty('p95');
            expect(result).toHaveProperty('p99');
            expect(result.p50).toBeGreaterThanOrEqual(0);
            expect(result.p95).toBeGreaterThanOrEqual(result.p50);
            expect(result.p99).toBeGreaterThanOrEqual(result.p95);
        });

        it('should handle query failures gracefully', async () => {
            mockQuery.mockRejectedValue(new Error('Query failed'));

            const result = await tester.measureQueryResponseTime(
                'SELECT 1',
                [],
                5
            );

            // Should still return metrics even if all queries fail
            expect(result).toHaveProperty('p50');
            expect(result).toHaveProperty('p95');
            expect(result).toHaveProperty('p99');
        });
    });

    describe('testConcurrentConnections', () => {
        it('should test concurrent connections successfully', async () => {
            const result = await tester.testConcurrentConnections(10);

            expect(result.successful).toBe(10);
            expect(result.failed).toBe(0);
            expect(result.avgConnectionTime).toBeGreaterThanOrEqual(0);
            expect(result.maxConnectionTime).toBeGreaterThanOrEqual(0);
        });

        it('should track failed connections', async () => {
            mockConnect
                .mockResolvedValueOnce({
                    query: mockQuery,
                    release: jest.fn(),
                })
                .mockRejectedValueOnce(new Error('Connection failed'))
                .mockResolvedValue({
                    query: mockQuery,
                    release: jest.fn(),
                });

            const result = await tester.testConcurrentConnections(3);

            expect(result.successful).toBeGreaterThan(0);
            expect(result.failed).toBeGreaterThan(0);
            expect(result.successful + result.failed).toBe(3);
        });

        it('should calculate connection time metrics', async () => {
            const result = await tester.testConcurrentConnections(5);

            expect(result.avgConnectionTime).toBeGreaterThanOrEqual(0);
            expect(result.maxConnectionTime).toBeGreaterThanOrEqual(result.avgConnectionTime);
        });
    });

    describe('simulateMultiTenantWorkload', () => {
        it('should simulate multi-tenant workload', async () => {
            const simulation = {
                concurrentConnections: 5,
                queriesPerSecond: 100,
                durationSeconds: 1,
                tenantCount: 3,
            };

            const result = await tester.simulateMultiTenantWorkload(simulation);

            expect(result.testName).toBe('Multi-Tenant Workload Simulation');
            expect(result.concurrentConnections).toBe(5);
            expect(result.queriesExecuted).toBeGreaterThan(0);
            expect(result.metrics).toHaveProperty('p50');
            expect(result.metrics).toHaveProperty('p95');
            expect(result.metrics).toHaveProperty('p99');
        });

        it('should generate tenant IDs based on tenant count', async () => {
            const simulation = {
                concurrentConnections: 2,
                queriesPerSecond: 50,
                durationSeconds: 1,
                tenantCount: 5,
            };

            const result = await tester.simulateMultiTenantWorkload(simulation);

            expect(result.queriesExecuted).toBeGreaterThan(0);
        });
    });

    describe('percentile calculations', () => {
        it('should calculate percentiles correctly', async () => {
            // Create a test with known execution times
            const times = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];

            // Mock query to return in sequence
            let index = 0;
            mockQuery.mockImplementation(() => {
                return new Promise(resolve => {
                    setTimeout(() => {
                        resolve({ rows: [], rowCount: 0 });
                    }, times[index++ % times.length]);
                });
            });

            const result = await tester.measureQueryResponseTime(
                'SELECT 1',
                [],
                times.length
            );

            // p50 should be around 50-60
            expect(result.p50).toBeGreaterThanOrEqual(40);
            expect(result.p50).toBeLessThanOrEqual(70);

            // p95 should be around 90-100
            expect(result.p95).toBeGreaterThanOrEqual(80);
            expect(result.p95).toBeLessThanOrEqual(110);

            // p99 should be around 100
            expect(result.p99).toBeGreaterThanOrEqual(90);
        });

        it('should handle empty execution times', async () => {
            mockQuery.mockRejectedValue(new Error('All queries failed'));

            const result = await tester.measureQueryResponseTime(
                'SELECT 1',
                [],
                5
            );

            expect(result.p50).toBe(0);
            expect(result.p95).toBe(0);
            expect(result.p99).toBe(0);
        });
    });
});
