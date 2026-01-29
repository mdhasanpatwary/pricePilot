/**
 * Tests for Performance Baseline Manager
 */

import { Pool } from 'pg';
import { PerformanceBaselineManager, BaselineConfig } from '@/lib/services/performance-baseline-manager';
import { PerformanceTester } from '@/lib/services/performance-tester';

// Mock dependencies
jest.mock('pg');
jest.mock('@/lib/services/performance-tester');

describe('PerformanceBaselineManager', () => {
    let pool: Pool;
    let manager: PerformanceBaselineManager;
    let mockQuery: jest.Mock;
    let mockMeasureQueryResponseTime: jest.Mock;

    beforeEach(() => {
        jest.clearAllMocks();

        mockQuery = jest.fn();
        pool = {
            query: mockQuery,
        } as any;

        mockMeasureQueryResponseTime = jest.fn();
        (PerformanceTester as jest.Mock).mockImplementation(() => ({
            measureQueryResponseTime: mockMeasureQueryResponseTime,
        }));

        manager = new PerformanceBaselineManager(pool);

        // Default mock implementations
        mockQuery.mockResolvedValue({ rows: [], rowCount: 0 });
        mockMeasureQueryResponseTime.mockResolvedValue({
            p50: 50,
            p95: 95,
            p99: 99,
        });
    });

    describe('establishBaseline', () => {
        it('should establish a performance baseline', async () => {
            const config: BaselineConfig = {
                queryFingerprint: 'test_query',
                queryName: 'Test Query',
                sql: 'SELECT 1',
                params: [],
                isCritical: true,
            };

            const baseline = await manager.establishBaseline(config);

            expect(baseline.queryFingerprint).toBe('test_query');
            expect(baseline.p50).toBe(50);
            expect(baseline.p95).toBe(95);
            expect(baseline.p99).toBe(99);
            expect(baseline.establishedAt).toBeInstanceOf(Date);
            expect(mockMeasureQueryResponseTime).toHaveBeenCalledWith(
                config.sql,
                config.params,
                expect.any(Number)
            );
            expect(mockQuery).toHaveBeenCalled();
        });

        it('should store baseline in database', async () => {
            const config: BaselineConfig = {
                queryFingerprint: 'test_query',
                queryName: 'Test Query',
                sql: 'SELECT 1',
                isCritical: true,
            };

            await manager.establishBaseline(config);

            expect(mockQuery).toHaveBeenCalledWith(
                expect.stringContaining('INSERT INTO performance_baselines'),
                expect.arrayContaining([
                    'test_query',
                    'Test Query',
                    'SELECT 1',
                    50,
                    95,
                    99,
                    true,
                    expect.any(Date),
                ])
            );
        });
    });

    describe('getBaseline', () => {
        it('should retrieve baseline from database', async () => {
            mockQuery.mockResolvedValue({
                rows: [
                    {
                        query_fingerprint: 'test_query',
                        p50: '50',
                        p95: '95',
                        p99: '99',
                        established_at: new Date(),
                    },
                ],
            });

            const baseline = await manager.getBaseline('test_query');

            expect(baseline).not.toBeNull();
            expect(baseline?.queryFingerprint).toBe('test_query');
            expect(baseline?.p50).toBe(50);
            expect(baseline?.p95).toBe(95);
            expect(baseline?.p99).toBe(99);
        });

        it('should return null if baseline not found', async () => {
            mockQuery.mockResolvedValue({ rows: [] });

            const baseline = await manager.getBaseline('nonexistent');

            expect(baseline).toBeNull();
        });
    });

    describe('compareAgainstBaseline', () => {
        beforeEach(() => {
            // Mock getBaseline
            mockQuery.mockResolvedValue({
                rows: [
                    {
                        query_fingerprint: 'test_query',
                        p50: '50',
                        p95: '100',
                        p99: '150',
                        established_at: new Date(),
                    },
                ],
            });
        });

        it('should detect no regression when performance is similar', async () => {
            mockMeasureQueryResponseTime.mockResolvedValue({
                p50: 52,
                p95: 105,
                p99: 155,
            });

            const comparison = await manager.compareAgainstBaseline(
                'test_query',
                'SELECT 1',
                []
            );

            expect(comparison).not.toBeNull();
            expect(comparison?.isRegression).toBe(false);
            expect(comparison?.degradationPercent).toBeLessThan(20);
        });

        it('should detect regression when performance degrades >20%', async () => {
            mockMeasureQueryResponseTime.mockResolvedValue({
                p50: 80,
                p95: 150, // 50% degradation from baseline of 100
                p99: 200,
            });

            const comparison = await manager.compareAgainstBaseline(
                'test_query',
                'SELECT 1',
                []
            );

            expect(comparison).not.toBeNull();
            expect(comparison?.isRegression).toBe(true);
            expect(comparison?.degradationPercent).toBeGreaterThan(20);
            expect(comparison?.baselineP95).toBe(100);
            expect(comparison?.currentP95).toBe(150);
        });

        it('should return null if no baseline exists', async () => {
            mockQuery.mockResolvedValue({ rows: [] });

            const comparison = await manager.compareAgainstBaseline(
                'nonexistent',
                'SELECT 1',
                []
            );

            expect(comparison).toBeNull();
        });

        it('should record regression when detected', async () => {
            mockMeasureQueryResponseTime.mockResolvedValue({
                p50: 80,
                p95: 150,
                p99: 200,
            });

            // First call returns baseline, second call inserts regression
            mockQuery
                .mockResolvedValueOnce({
                    rows: [
                        {
                            query_fingerprint: 'test_query',
                            p50: '50',
                            p95: '100',
                            p99: '150',
                            established_at: new Date(),
                        },
                    ],
                })
                .mockResolvedValueOnce({ rows: [], rowCount: 1 });

            await manager.compareAgainstBaseline('test_query', 'SELECT 1', []);

            expect(mockQuery).toHaveBeenCalledWith(
                expect.stringContaining('INSERT INTO performance_regressions'),
                expect.any(Array)
            );
        });
    });

    describe('getAllBaselines', () => {
        it('should retrieve all baselines', async () => {
            mockQuery.mockResolvedValue({
                rows: [
                    {
                        query_fingerprint: 'query1',
                        query_name: 'Query 1',
                        p50: '50',
                        p95: '95',
                        p99: '99',
                        is_critical: true,
                        established_at: new Date(),
                    },
                    {
                        query_fingerprint: 'query2',
                        query_name: 'Query 2',
                        p50: '30',
                        p95: '60',
                        p99: '80',
                        is_critical: false,
                        established_at: new Date(),
                    },
                ],
            });

            const baselines = await manager.getAllBaselines();

            expect(baselines).toHaveLength(2);
            expect(baselines[0].queryFingerprint).toBe('query1');
            expect(baselines[0].isCritical).toBe(true);
            expect(baselines[1].queryFingerprint).toBe('query2');
            expect(baselines[1].isCritical).toBe(false);
        });
    });

    describe('getRecentRegressions', () => {
        it('should retrieve recent regressions', async () => {
            const detectedAt = new Date();
            mockQuery.mockResolvedValue({
                rows: [
                    {
                        query_fingerprint: 'query1',
                        baseline_p95: '100',
                        current_p95: '150',
                        degradation_percent: '50',
                        detected_at: detectedAt,
                        query_name: 'Query 1',
                    },
                ],
            });

            const regressions = await manager.getRecentRegressions(10);

            expect(regressions).toHaveLength(1);
            expect(regressions[0].queryFingerprint).toBe('query1');
            expect(regressions[0].baselineP95).toBe(100);
            expect(regressions[0].currentP95).toBe(150);
            expect(regressions[0].degradationPercent).toBe(50);
            expect(regressions[0].isRegression).toBe(true);
        });
    });

    describe('deleteBaseline', () => {
        it('should delete baseline from database', async () => {
            await manager.deleteBaseline('test_query');

            expect(mockQuery).toHaveBeenCalledWith(
                expect.stringContaining('DELETE FROM performance_baselines'),
                ['test_query']
            );
        });
    });

    describe('establishCriticalBaselines', () => {
        it('should establish baselines for all critical queries', async () => {
            const baselines = await manager.establishCriticalBaselines();

            expect(baselines.length).toBeGreaterThan(0);
            expect(mockMeasureQueryResponseTime).toHaveBeenCalled();
            expect(mockQuery).toHaveBeenCalled();
        });

        it('should continue on individual failures', async () => {
            mockMeasureQueryResponseTime
                .mockRejectedValueOnce(new Error('Failed'))
                .mockResolvedValue({ p50: 50, p95: 95, p99: 99 });

            const baselines = await manager.establishCriticalBaselines();

            // Should still return baselines for successful queries
            expect(baselines.length).toBeGreaterThan(0);
        });
    });

    describe('regression threshold', () => {
        it('should use 20% as regression threshold', async () => {
            mockQuery.mockResolvedValue({
                rows: [
                    {
                        query_fingerprint: 'test_query',
                        p50: '50',
                        p95: '100',
                        p99: '150',
                        established_at: new Date(),
                    },
                ],
            });

            // Exactly 20% degradation
            mockMeasureQueryResponseTime.mockResolvedValue({
                p50: 60,
                p95: 120,
                p99: 180,
            });

            const comparison = await manager.compareAgainstBaseline(
                'test_query',
                'SELECT 1',
                []
            );

            expect(comparison?.degradationPercent).toBe(20);
            expect(comparison?.isRegression).toBe(false); // Should be false at exactly 20%

            // Just over 20% degradation
            mockMeasureQueryResponseTime.mockResolvedValue({
                p50: 60,
                p95: 121,
                p99: 180,
            });

            const comparison2 = await manager.compareAgainstBaseline(
                'test_query',
                'SELECT 1',
                []
            );

            expect(comparison2?.isRegression).toBe(true);
        });
    });
});
