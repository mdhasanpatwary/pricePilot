/**
 * Tests for Performance Baselines API
 */

import { GET, POST, DELETE } from '@/app/api/v1/admin/performance/baselines/route';
import { POST as COMPARE } from '@/app/api/v1/admin/performance/baselines/compare/route';
import { GET as GET_REGRESSIONS } from '@/app/api/v1/admin/performance/regressions/route';
import { NextRequest } from 'next/server';

// Mock dependencies
jest.mock('@/lib/database/optimized-prisma');
jest.mock('@/lib/services/performance-baseline-manager');
jest.mock('@/lib/logger');

import { getOptimizedPrisma } from '@/lib/database/optimized-prisma';
import { PerformanceBaselineManager } from '@/lib/services/performance-baseline-manager';

describe('Performance Baselines API', () => {
    let mockManager: any;

    beforeEach(() => {
        jest.clearAllMocks();

        mockManager = {
            getAllBaselines: jest.fn(),
            establishBaseline: jest.fn(),
            deleteBaseline: jest.fn(),
            compareAgainstBaseline: jest.fn(),
            getRecentRegressions: jest.fn(),
        };

        (getOptimizedPrisma as jest.Mock).mockReturnValue({
            pool: {},
        });

        (PerformanceBaselineManager as jest.Mock).mockImplementation(() => mockManager);
    });

    describe('GET /api/v1/admin/performance/baselines', () => {
        it('should return all baselines', async () => {
            const mockBaselines = [
                {
                    queryFingerprint: 'query1',
                    queryName: 'Query 1',
                    p50: 50,
                    p95: 95,
                    p99: 99,
                    isCritical: true,
                    establishedAt: new Date(),
                },
            ];

            mockManager.getAllBaselines.mockResolvedValue(mockBaselines);

            const request = new NextRequest('http://localhost/api/v1/admin/performance/baselines');
            const response = await GET(request);
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.success).toBe(true);
            expect(data.data.baselines).toEqual(mockBaselines);
            expect(data.data.count).toBe(1);
        });

        it('should handle errors', async () => {
            mockManager.getAllBaselines.mockRejectedValue(new Error('Database error'));

            const request = new NextRequest('http://localhost/api/v1/admin/performance/baselines');
            const response = await GET(request);
            const data = await response.json();

            expect(response.status).toBe(500);
            expect(data.success).toBe(false);
            expect(data.error.code).toBe('BASELINE_FETCH_ERROR');
        });
    });

    describe('POST /api/v1/admin/performance/baselines', () => {
        it('should establish a new baseline', async () => {
            const mockBaseline = {
                queryFingerprint: 'test_query',
                p50: 50,
                p95: 95,
                p99: 99,
                establishedAt: new Date(),
            };

            mockManager.establishBaseline.mockResolvedValue(mockBaseline);

            const request = new NextRequest('http://localhost/api/v1/admin/performance/baselines', {
                method: 'POST',
                body: JSON.stringify({
                    queryFingerprint: 'test_query',
                    queryName: 'Test Query',
                    sql: 'SELECT 1',
                    isCritical: true,
                }),
            });

            const response = await POST(request);
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.success).toBe(true);
            expect(data.data.baseline).toEqual(mockBaseline);
        });

        it('should validate required fields', async () => {
            const request = new NextRequest('http://localhost/api/v1/admin/performance/baselines', {
                method: 'POST',
                body: JSON.stringify({
                    queryFingerprint: 'test_query',
                    // Missing queryName and sql
                }),
            });

            const response = await POST(request);
            const data = await response.json();

            expect(response.status).toBe(400);
            expect(data.success).toBe(false);
            expect(data.error.code).toBe('INVALID_INPUT');
        });
    });

    describe('DELETE /api/v1/admin/performance/baselines', () => {
        it('should delete a baseline', async () => {
            mockManager.deleteBaseline.mockResolvedValue(undefined);

            const request = new NextRequest(
                'http://localhost/api/v1/admin/performance/baselines?queryFingerprint=test_query',
                { method: 'DELETE' }
            );

            const response = await DELETE(request);
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.success).toBe(true);
            expect(mockManager.deleteBaseline).toHaveBeenCalledWith('test_query');
        });

        it('should validate query fingerprint parameter', async () => {
            const request = new NextRequest(
                'http://localhost/api/v1/admin/performance/baselines',
                { method: 'DELETE' }
            );

            const response = await DELETE(request);
            const data = await response.json();

            expect(response.status).toBe(400);
            expect(data.success).toBe(false);
            expect(data.error.code).toBe('INVALID_INPUT');
        });
    });

    describe('POST /api/v1/admin/performance/baselines/compare', () => {
        it('should compare against baseline', async () => {
            const mockComparison = {
                queryFingerprint: 'test_query',
                baselineP95: 100,
                currentP95: 110,
                degradationPercent: 10,
                isRegression: false,
            };

            mockManager.compareAgainstBaseline.mockResolvedValue(mockComparison);

            const request = new NextRequest(
                'http://localhost/api/v1/admin/performance/baselines/compare',
                {
                    method: 'POST',
                    body: JSON.stringify({
                        queryFingerprint: 'test_query',
                        sql: 'SELECT 1',
                        params: [],
                    }),
                }
            );

            const response = await COMPARE(request);
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.success).toBe(true);
            expect(data.data.comparison).toEqual(mockComparison);
            expect(data.data.status).toBe('ok');
        });

        it('should detect regression', async () => {
            const mockComparison = {
                queryFingerprint: 'test_query',
                baselineP95: 100,
                currentP95: 150,
                degradationPercent: 50,
                isRegression: true,
            };

            mockManager.compareAgainstBaseline.mockResolvedValue(mockComparison);

            const request = new NextRequest(
                'http://localhost/api/v1/admin/performance/baselines/compare',
                {
                    method: 'POST',
                    body: JSON.stringify({
                        queryFingerprint: 'test_query',
                        sql: 'SELECT 1',
                    }),
                }
            );

            const response = await COMPARE(request);
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.data.status).toBe('regression');
        });

        it('should handle missing baseline', async () => {
            mockManager.compareAgainstBaseline.mockResolvedValue(null);

            const request = new NextRequest(
                'http://localhost/api/v1/admin/performance/baselines/compare',
                {
                    method: 'POST',
                    body: JSON.stringify({
                        queryFingerprint: 'nonexistent',
                        sql: 'SELECT 1',
                    }),
                }
            );

            const response = await COMPARE(request);
            const data = await response.json();

            expect(response.status).toBe(404);
            expect(data.success).toBe(false);
            expect(data.error.code).toBe('BASELINE_NOT_FOUND');
        });
    });

    describe('GET /api/v1/admin/performance/regressions', () => {
        it('should return recent regressions', async () => {
            const mockRegressions = [
                {
                    queryFingerprint: 'query1',
                    baselineP95: 100,
                    currentP95: 150,
                    degradationPercent: 50,
                    isRegression: true,
                    detectedAt: new Date(),
                },
            ];

            mockManager.getRecentRegressions.mockResolvedValue(mockRegressions);

            const request = new NextRequest(
                'http://localhost/api/v1/admin/performance/regressions'
            );

            const response = await GET_REGRESSIONS(request);
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.success).toBe(true);
            expect(data.data.regressions).toEqual(mockRegressions);
            expect(data.data.count).toBe(1);
        });

        it('should respect limit parameter', async () => {
            mockManager.getRecentRegressions.mockResolvedValue([]);

            const request = new NextRequest(
                'http://localhost/api/v1/admin/performance/regressions?limit=5'
            );

            await GET_REGRESSIONS(request);

            expect(mockManager.getRecentRegressions).toHaveBeenCalledWith(5);
        });
    });
});
