import { GET as getDashboardMetrics } from '@/app/api/v1/admin/metrics/dashboard/route';
import { GET as getTenantMetrics } from '@/app/api/v1/admin/metrics/tenant/[id]/route';
import { GET as getSiteAnalytics } from '@/app/api/v1/admin/analytics/sites/route';
import { GET as getProxyAnalytics } from '@/app/api/v1/admin/analytics/proxies/route';
import { GET as getChallengeAnalytics } from '@/app/api/v1/admin/analytics/challenges/route';

// Mock NextAuth
jest.mock('next-auth', () => ({
    getServerSession: jest.fn(),
}));

// Mock authOptions
jest.mock('@/lib/auth', () => ({
    authOptions: {},
}));

// Mock MetricsAggregator
jest.mock('@/lib/services/metrics-aggregator', () => ({
    metricsAggregator: {
        getDashboardMetrics: jest.fn(),
        getTenantMetrics: jest.fn(),
        getTopFailures: jest.fn(),
        getTimeSeriesData: jest.fn(),
    },
}));

// Mock Prisma
jest.mock('@/lib/prisma', () => ({
    prisma: {
        scrapingSession: {
            findMany: jest.fn(),
        },
        proxyHealth: {
            findMany: jest.fn(),
            findUnique: jest.fn(),
        },
        proxyMetrics: {
            findMany: jest.fn(),
        },
        challengeAttempt: {
            findMany: jest.fn(),
        },
    },
}));

// Mock Next.js Request/Response
jest.mock('next/server', () => ({
    NextRequest: jest.fn().mockImplementation((url, options) => ({
        url,
        method: options?.method || 'GET',
        nextUrl: new URL(url),
    })),
    NextResponse: {
        json: jest.fn().mockImplementation((data, init) => ({
            status: init?.status || 200,
            json: jest.fn().mockResolvedValue(data),
            headers: new Map(),
        })),
    },
}));

import { getServerSession } from 'next-auth';
import { metricsAggregator } from '@/lib/services/metrics-aggregator';
import { prisma } from '@/lib/prisma';

describe('Metrics and Analytics API Endpoints', () => {
    const mockAdminSession = {
        user: {
            id: 'admin-123',
            email: 'admin@example.com',
            role: 'ADMIN',
            isSuperAdmin: true,
        },
    };

    const mockDashboardMetrics = {
        platform: {
            activeSessions: 5,
            requestsPerMinute: 100,
            avgSessionDuration: 5000,
            totalTenants: 10,
            activeTenants: 7,
        },
        scraping: {
            successRate: 0.95,
            blockRate: 0.03,
            challengeRate: 0.02,
            avgResponseTime: 1500,
            requestsLast24h: 10000,
        },
        proxies: {
            totalProxies: 50,
            healthyProxies: 45,
            avgSuccessRate: 0.92,
            avgResponseTime: 800,
        },
        challenges: {
            totalChallenges: 200,
            solveRate: 0.88,
            avgSolveTime: 3000,
        },
    };

    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('GET /api/v1/admin/metrics/dashboard', () => {
        it('should return 401 if not authenticated', async () => {
            (getServerSession as jest.Mock).mockResolvedValue(null);

            const req = {
                url: 'http://localhost:3000/api/v1/admin/metrics/dashboard',
                nextUrl: new URL('http://localhost:3000/api/v1/admin/metrics/dashboard'),
            } as any;

            const response = await getDashboardMetrics(req);

            expect(response.status).toBe(401);
            const data = await response.json();
            expect(data.error).toBe('Unauthorized');
        });

        it('should return 401 if user is not admin', async () => {
            (getServerSession as jest.Mock).mockResolvedValue({
                user: { id: 'user-123', role: 'USER' },
            });

            const req = {
                url: 'http://localhost:3000/api/v1/admin/metrics/dashboard',
                nextUrl: new URL('http://localhost:3000/api/v1/admin/metrics/dashboard'),
            } as any;

            const response = await getDashboardMetrics(req);

            expect(response.status).toBe(401);
        });

        it('should return dashboard metrics for admin', async () => {
            (getServerSession as jest.Mock).mockResolvedValue(mockAdminSession);
            (metricsAggregator.getDashboardMetrics as jest.Mock).mockResolvedValue(mockDashboardMetrics);

            const req = {
                url: 'http://localhost:3000/api/v1/admin/metrics/dashboard',
                nextUrl: new URL('http://localhost:3000/api/v1/admin/metrics/dashboard'),
            } as any;

            const response = await getDashboardMetrics(req);

            expect(response.status).toBe(200);
            const data = await response.json();
            expect(data.success).toBe(true);
            expect(data.data).toEqual(mockDashboardMetrics);
        });
    });

    describe('GET /api/v1/admin/metrics/tenant/[id]', () => {
        const mockTenantMetrics = {
            tenantId: 'tenant-1',
            tenantName: 'Test Tenant',
            activeSessions: 3,
            successRate: 0.92,
            avgScrapeTime: 4500,
            dataQualityScore: 0.88,
            resourceUsage: {
                requestsToday: 500,
                quotaLimit: 1000,
                quotaUsed: 0.5,
            },
        };

        it('should return 401 if not authenticated', async () => {
            (getServerSession as jest.Mock).mockResolvedValue(null);

            const req = {
                url: 'http://localhost:3000/api/v1/admin/metrics/tenant/tenant-1',
                nextUrl: new URL('http://localhost:3000/api/v1/admin/metrics/tenant/tenant-1'),
            } as any;

            const response = await getTenantMetrics(req, { params: { id: 'tenant-1' } });

            expect(response.status).toBe(401);
        });

        it('should return tenant metrics for admin', async () => {
            (getServerSession as jest.Mock).mockResolvedValue(mockAdminSession);
            (metricsAggregator.getTenantMetrics as jest.Mock).mockResolvedValue(mockTenantMetrics);

            const req = {
                url: 'http://localhost:3000/api/v1/admin/metrics/tenant/tenant-1',
                nextUrl: new URL('http://localhost:3000/api/v1/admin/metrics/tenant/tenant-1'),
            } as any;

            const response = await getTenantMetrics(req, { params: { id: 'tenant-1' } });

            expect(response.status).toBe(200);
            const data = await response.json();
            expect(data.success).toBe(true);
            expect(data.data).toEqual(mockTenantMetrics);
        });

        it('should return 404 if tenant not found', async () => {
            (getServerSession as jest.Mock).mockResolvedValue(mockAdminSession);
            (metricsAggregator.getTenantMetrics as jest.Mock).mockRejectedValue(
                new Error('Tenant not found: tenant-999')
            );

            const req = {
                url: 'http://localhost:3000/api/v1/admin/metrics/tenant/tenant-999',
                nextUrl: new URL('http://localhost:3000/api/v1/admin/metrics/tenant/tenant-999'),
            } as any;

            const response = await getTenantMetrics(req, { params: { id: 'tenant-999' } });

            expect(response.status).toBe(404);
        });
    });

    describe('GET /api/v1/admin/analytics/sites', () => {
        it('should return site analytics with time range filtering', async () => {
            (getServerSession as jest.Mock).mockResolvedValue(mockAdminSession);
            (metricsAggregator.getTopFailures as jest.Mock).mockResolvedValue([
                {
                    identifier: 'https://example.com',
                    totalRequests: 1000,
                    failedRequests: 50,
                    failureRate: 0.05,
                    lastFailure: new Date(),
                },
            ]);
            (metricsAggregator.getTimeSeriesData as jest.Mock).mockResolvedValue({
                metric: 'requests',
                dataPoints: [],
            });
            (prisma.scrapingSession.findMany as jest.Mock).mockResolvedValue([]);

            const req = {
                url: 'http://localhost:3000/api/v1/admin/analytics/sites?timeRange=24h',
                nextUrl: new URL('http://localhost:3000/api/v1/admin/analytics/sites?timeRange=24h'),
            } as any;

            const response = await getSiteAnalytics(req);

            expect(response.status).toBe(200);
            const data = await response.json();
            expect(data.success).toBe(true);
            expect(data.data.timeRange).toBe('24h');
        });

        it('should return 400 for invalid time range', async () => {
            (getServerSession as jest.Mock).mockResolvedValue(mockAdminSession);

            const req = {
                url: 'http://localhost:3000/api/v1/admin/analytics/sites?timeRange=invalid',
                nextUrl: new URL('http://localhost:3000/api/v1/admin/analytics/sites?timeRange=invalid'),
            } as any;

            const response = await getSiteAnalytics(req);

            expect(response.status).toBe(400);
        });
    });

    describe('GET /api/v1/admin/analytics/proxies', () => {
        it('should return proxy analytics', async () => {
            (getServerSession as jest.Mock).mockResolvedValue(mockAdminSession);
            (metricsAggregator.getTopFailures as jest.Mock).mockResolvedValue([]);
            (metricsAggregator.getTimeSeriesData as jest.Mock).mockResolvedValue({
                metric: 'response_time',
                dataPoints: [],
            });
            (prisma.proxyHealth.findMany as jest.Mock).mockResolvedValue([
                {
                    proxyUrl: 'http://proxy1.com:8080',
                    isHealthy: true,
                    lastChecked: new Date(),
                    successCount: 900,
                    failureCount: 100,
                    avgResponseTime: 800,
                },
            ]);

            const req = {
                url: 'http://localhost:3000/api/v1/admin/analytics/proxies',
                nextUrl: new URL('http://localhost:3000/api/v1/admin/analytics/proxies'),
            } as any;

            const response = await getProxyAnalytics(req);

            expect(response.status).toBe(200);
            const data = await response.json();
            expect(data.success).toBe(true);
            expect(data.data.proxyHealth).toBeDefined();
        });
    });

    describe('GET /api/v1/admin/analytics/challenges', () => {
        it('should return challenge analytics', async () => {
            (getServerSession as jest.Mock).mockResolvedValue(mockAdminSession);
            (prisma.challengeAttempt.findMany as jest.Mock).mockResolvedValue([
                {
                    challengeType: 'cloudflare',
                    site: 'https://example.com',
                    solved: true,
                    duration: 3000,
                    timestamp: new Date(),
                },
                {
                    challengeType: 'recaptcha',
                    site: 'https://example.com',
                    solved: false,
                    duration: 5000,
                    timestamp: new Date(),
                },
            ]);

            const req = {
                url: 'http://localhost:3000/api/v1/admin/analytics/challenges',
                nextUrl: new URL('http://localhost:3000/api/v1/admin/analytics/challenges'),
            } as any;

            const response = await getChallengeAnalytics(req);

            expect(response.status).toBe(200);
            const data = await response.json();
            expect(data.success).toBe(true);
            expect(data.data.summary).toBeDefined();
            expect(data.data.byType).toBeDefined();
            expect(data.data.bySite).toBeDefined();
        });

        it('should filter by challenge type', async () => {
            (getServerSession as jest.Mock).mockResolvedValue(mockAdminSession);
            (prisma.challengeAttempt.findMany as jest.Mock).mockResolvedValue([
                {
                    challengeType: 'cloudflare',
                    site: 'https://example.com',
                    solved: true,
                    duration: 3000,
                    timestamp: new Date(),
                },
            ]);

            const req = {
                url: 'http://localhost:3000/api/v1/admin/analytics/challenges?challengeType=cloudflare',
                nextUrl: new URL('http://localhost:3000/api/v1/admin/analytics/challenges?challengeType=cloudflare'),
            } as any;

            const response = await getChallengeAnalytics(req);

            expect(response.status).toBe(200);
            expect(prisma.challengeAttempt.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: expect.objectContaining({
                        challengeType: 'cloudflare',
                    }),
                })
            );
        });
    });
});
