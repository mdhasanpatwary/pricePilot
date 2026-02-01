/**
 * Tests for Cache Stats API Endpoint
 * 
 * Integration tests for the cache statistics monitoring endpoint.
 * 
 * Requirements: 4.4
 */

import { GET } from '@/app/api/v1/admin/performance/cache-stats/route';
import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { CacheMonitoringService } from '@/lib/services/cache-monitoring';

// Mock the dependencies
jest.mock('next-auth');
jest.mock('@/lib/services/cache-monitoring');
jest.mock('@/lib/middleware/ratelimit', () => ({
    withRateLimit: jest.fn((req, type, handler) => handler()),
}));

describe('GET /api/v1/admin/performance/cache-stats', () => {
    const mockGetServerSession = getServerSession as jest.MockedFunction<typeof getServerSession>;

    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('should return 401 if user is not authenticated', async () => {
        mockGetServerSession.mockResolvedValue(null);

        const request = new NextRequest('http://localhost:3000/api/v1/admin/performance/cache-stats');
        const response = await GET(request);
        const data = await response.json();

        expect(response.status).toBe(401);
        expect(data.error).toBe('Unauthorized');
    });

    it('should return 403 if user is not an admin', async () => {
        mockGetServerSession.mockResolvedValue({
            user: {
                id: 'user-1',
                email: 'user@example.com',
                role: 'USER',
                isSuperAdmin: false,
            },
            expires: '2024-12-31',
        } as any);

        const request = new NextRequest('http://localhost:3000/api/v1/admin/performance/cache-stats');
        const response = await GET(request);
        const data = await response.json();

        expect(response.status).toBe(403);
        expect(data.error).toBe('Unauthorized - Admin access required');
    });

    it('should return cache statistics with health status for admin users', async () => {
        const mockHealthStatus = {
            status: 'healthy' as const,
            redis: {
                connected: true,
                memoryUsage: 104857600, // 100 MB
                memoryLimit: 524288000, // 500 MB
                memoryUsagePercent: 0.2,
            },
            performance: {
                hitRate: 0.7,
                avgResponseTime: 50,
                totalHits: 700,
                totalMisses: 300,
                totalKeys: 5000,
                evictions: 50,
            },
            alerts: [],
            timestamp: '2024-01-01T00:00:00.000Z',
        };

        mockGetServerSession.mockResolvedValue({
            user: {
                id: 'admin-1',
                email: 'admin@example.com',
                role: 'ADMIN',
                isSuperAdmin: false,
            },
            expires: '2024-12-31',
        } as any);

        const mockGetHealthStatus = jest.fn().mockResolvedValue(mockHealthStatus);
        (CacheMonitoringService as jest.MockedClass<typeof CacheMonitoringService>).mockImplementation(() => ({
            getHealthStatus: mockGetHealthStatus,
        } as any));

        const request = new NextRequest('http://localhost:3000/api/v1/admin/performance/cache-stats');
        const response = await GET(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.success).toBe(true);
        expect(data.data).toEqual(mockHealthStatus);
        expect(data.meta).toHaveProperty('timestamp');
        expect(mockGetHealthStatus).toHaveBeenCalledTimes(1);
    });

    it('should return cache statistics for super admin users', async () => {
        const mockHealthStatus = {
            status: 'healthy' as const,
            redis: {
                connected: true,
                memoryUsage: 104857600,
                memoryLimit: 524288000,
                memoryUsagePercent: 0.2,
            },
            performance: {
                hitRate: 0.75,
                avgResponseTime: 45,
                totalHits: 750,
                totalMisses: 250,
                totalKeys: 5000,
                evictions: 30,
            },
            alerts: [],
            timestamp: '2024-01-01T00:00:00.000Z',
        };

        mockGetServerSession.mockResolvedValue({
            user: {
                id: 'superadmin-1',
                email: 'superadmin@example.com',
                role: 'USER',
                isSuperAdmin: true,
            },
            expires: '2024-12-31',
        } as any);

        const mockGetHealthStatus = jest.fn().mockResolvedValue(mockHealthStatus);
        (CacheMonitoringService as jest.MockedClass<typeof CacheMonitoringService>).mockImplementation(() => ({
            getHealthStatus: mockGetHealthStatus,
        } as any));

        const request = new NextRequest('http://localhost:3000/api/v1/admin/performance/cache-stats');
        const response = await GET(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.success).toBe(true);
        expect(data.data).toEqual(mockHealthStatus);
    });

    it('should return cache statistics with alerts when thresholds are exceeded', async () => {
        const mockHealthStatus = {
            status: 'unhealthy' as const,
            redis: {
                connected: true,
                memoryUsage: 471859200, // 450 MB
                memoryLimit: 524288000, // 500 MB
                memoryUsagePercent: 0.9,
            },
            performance: {
                hitRate: 0.45,
                avgResponseTime: 150,
                totalHits: 450,
                totalMisses: 550,
                totalKeys: 5000,
                evictions: 1500,
            },
            alerts: [
                {
                    level: 'warning' as const,
                    message: 'Cache hit rate below threshold: 45.0%',
                    metric: 'hitRate',
                    value: 0.45,
                    threshold: 0.6,
                },
                {
                    level: 'warning' as const,
                    message: 'Cache memory usage high: 450MB (90.0%)',
                    metric: 'memoryUsage',
                    value: 471859200,
                    threshold: 419430400,
                },
            ],
            timestamp: '2024-01-01T00:00:00.000Z',
        };

        mockGetServerSession.mockResolvedValue({
            user: {
                id: 'admin-1',
                email: 'admin@example.com',
                role: 'ADMIN',
                isSuperAdmin: false,
            },
            expires: '2024-12-31',
        } as any);

        const mockGetHealthStatus = jest.fn().mockResolvedValue(mockHealthStatus);
        (CacheMonitoringService as jest.MockedClass<typeof CacheMonitoringService>).mockImplementation(() => ({
            getHealthStatus: mockGetHealthStatus,
        } as any));

        const request = new NextRequest('http://localhost:3000/api/v1/admin/performance/cache-stats');
        const response = await GET(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.success).toBe(true);
        expect(data.data.status).toBe('unhealthy');
        expect(data.data.alerts).toHaveLength(2);
        expect(data.data.alerts[0].level).toBe('warning');
    });

    it('should handle errors gracefully', async () => {
        mockGetServerSession.mockResolvedValue({
            user: {
                id: 'admin-1',
                email: 'admin@example.com',
                role: 'ADMIN',
                isSuperAdmin: false,
            },
            expires: '2024-12-31',
        } as any);

        const mockGetHealthStatus = jest.fn().mockRejectedValue(new Error('Redis connection failed'));
        (CacheMonitoringService as jest.MockedClass<typeof CacheMonitoringService>).mockImplementation(() => ({
            getHealthStatus: mockGetHealthStatus,
        } as any));

        const request = new NextRequest('http://localhost:3000/api/v1/admin/performance/cache-stats');
        const response = await GET(request);
        const data = await response.json();

        expect(response.status).toBe(500);
        expect(data.success).toBe(false);
        expect(data.error.code).toBe('CACHE_STATS_ERROR');
        expect(data.error.message).toBe('Failed to fetch cache statistics');
        expect(data.error.details).toBe('Redis connection failed');
    });
});
