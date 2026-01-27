import { GET as getTenantDebug } from '@/app/api/v1/admin/debug/tenant/[id]/route';

// Mock NextAuth
jest.mock('next-auth', () => ({
    getServerSession: jest.fn(),
}));

// Mock authOptions
jest.mock('@/lib/auth', () => ({
    authOptions: {},
}));

// Mock SessionTracker
jest.mock('@/lib/services/session-tracker', () => ({
    sessionTracker: {
        getActiveSessions: jest.fn(),
        getSessionHistory: jest.fn(),
    },
}));

// Mock MetricsAggregator
jest.mock('@/lib/services/metrics-aggregator', () => ({
    metricsAggregator: {
        getTenantMetrics: jest.fn(),
    },
}));

// Mock Prisma
jest.mock('@/lib/prisma', () => ({
    prisma: {
        tenant: {
            findUnique: jest.fn(),
        },
        site: {
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
import { sessionTracker } from '@/lib/services/session-tracker';
import { metricsAggregator } from '@/lib/services/metrics-aggregator';
import { prisma } from '@/lib/prisma';

describe('GET /api/v1/admin/debug/tenant/[id]', () => {
    const mockAdminSession = {
        user: {
            id: 'admin-123',
            email: 'admin@example.com',
            role: 'ADMIN',
            isSuperAdmin: true,
        },
    };

    const mockTenant = {
        id: 'tenant-1',
        companyName: 'Test Company',
        planType: 'PREMIUM',
        createdAt: new Date('2024-01-01T00:00:00Z'),
    };

    const mockActiveSession = {
        id: 'session-1',
        tenantId: 'tenant-1',
        tenantName: 'Test Company',
        siteUrl: 'https://example.com',
        targetUrl: 'https://example.com/product/123',
        status: 'running' as const,
        currentStage: 'data_extraction' as const,
        proxyUsed: 'http://proxy1.com:8080',
        userAgent: 'Mozilla/5.0',
        requestsCompleted: 5,
        requestsTotal: 10,
        challengeType: null,
        challengeStatus: null,
        extractedData: null,
        errors: [],
        metrics: {
            navigationTime: 1000,
            challengeSolveTime: 0,
            extractionTime: 500,
            totalTime: 1500,
        },
        startTime: new Date('2024-01-01T10:00:00Z'),
        endTime: null,
        createdAt: new Date('2024-01-01T10:00:00Z'),
        updatedAt: new Date('2024-01-01T10:01:00Z'),
    };

    const mockFailedSession = {
        ...mockActiveSession,
        id: 'session-2',
        status: 'failed' as const,
        errors: [
            {
                timestamp: new Date('2024-01-01T10:05:00Z'),
                message: 'Proxy connection failed',
            },
            {
                timestamp: new Date('2024-01-01T10:06:00Z'),
                message: 'Challenge detection failed',
            },
        ],
        endTime: new Date('2024-01-01T10:07:00Z'),
    };

    const mockTenantMetrics = {
        tenantId: 'tenant-1',
        tenantName: 'Test Company',
        activeSessions: 1,
        successRate: 85.5,
        avgScrapeTime: 2500,
        dataQualityScore: 92.3,
        resourceUsage: {
            requestsToday: 150,
            quotaLimit: 1000,
            quotaUsed: 0.15,
        },
    };

    const now = new Date();
    const recentSync = new Date(now.getTime() - 1000 * 60 * 60 * 12); // 12 hours ago
    const staleSync = new Date(now.getTime() - 1000 * 60 * 60 * 48); // 48 hours ago

    const mockSites = [
        {
            id: 'site-1',
            type: 'COMPETITOR',
            platform: 'GENERIC',
            baseUrl: 'https://example.com',
            lastSyncAt: recentSync,
            createdAt: new Date('2024-01-01T00:00:00Z'),
        },
        {
            id: 'site-2',
            type: 'COMPETITOR',
            platform: 'GENERIC',
            baseUrl: 'https://stale-site.com',
            lastSyncAt: staleSync, // More than 24 hours ago
            createdAt: new Date('2024-01-01T00:00:00Z'),
        },
    ];

    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('should return 401 if not authenticated', async () => {
        (getServerSession as jest.Mock).mockResolvedValue(null);

        const req = {
            url: 'http://localhost:3000/api/v1/admin/debug/tenant/tenant-1',
            nextUrl: new URL(
                'http://localhost:3000/api/v1/admin/debug/tenant/tenant-1'
            ),
        } as any;

        const response = await getTenantDebug(req, { params: { id: 'tenant-1' } });

        expect(response.status).toBe(401);
        const data = await response.json();
        expect(data.error).toBe('Unauthorized');
    });

    it('should return 401 if user is not admin', async () => {
        (getServerSession as jest.Mock).mockResolvedValue({
            user: {
                id: 'user-123',
                email: 'user@example.com',
                role: 'USER',
            },
        });

        const req = {
            url: 'http://localhost:3000/api/v1/admin/debug/tenant/tenant-1',
            nextUrl: new URL(
                'http://localhost:3000/api/v1/admin/debug/tenant/tenant-1'
            ),
        } as any;

        const response = await getTenantDebug(req, { params: { id: 'tenant-1' } });

        expect(response.status).toBe(401);
    });

    it('should return 404 if tenant not found', async () => {
        (getServerSession as jest.Mock).mockResolvedValue(mockAdminSession);
        (prisma.tenant.findUnique as jest.Mock).mockResolvedValue(null);

        const req = {
            url: 'http://localhost:3000/api/v1/admin/debug/tenant/tenant-999',
            nextUrl: new URL(
                'http://localhost:3000/api/v1/admin/debug/tenant/tenant-999'
            ),
        } as any;

        const response = await getTenantDebug(req, { params: { id: 'tenant-999' } });

        expect(response.status).toBe(404);
        const data = await response.json();
        expect(data.error).toBe('Tenant not found');
    });

    it('should return comprehensive tenant debug information', async () => {
        (getServerSession as jest.Mock).mockResolvedValue(mockAdminSession);
        (prisma.tenant.findUnique as jest.Mock).mockResolvedValue(mockTenant);
        (sessionTracker.getActiveSessions as jest.Mock).mockResolvedValue([
            mockActiveSession,
        ]);
        (sessionTracker.getSessionHistory as jest.Mock).mockResolvedValue([
            mockActiveSession,
            mockFailedSession,
        ]);
        (metricsAggregator.getTenantMetrics as jest.Mock).mockResolvedValue(
            mockTenantMetrics
        );
        (prisma.site.findMany as jest.Mock).mockResolvedValue(mockSites);

        const req = {
            url: 'http://localhost:3000/api/v1/admin/debug/tenant/tenant-1',
            nextUrl: new URL(
                'http://localhost:3000/api/v1/admin/debug/tenant/tenant-1'
            ),
        } as any;

        const response = await getTenantDebug(req, { params: { id: 'tenant-1' } });

        expect(response.status).toBe(200);
        const data = await response.json();

        expect(data.success).toBe(true);
        expect(data.data.tenant.id).toBe('tenant-1');
        expect(data.data.tenant.name).toBe('Test Company');
        expect(data.data.activeSessions).toHaveLength(1);
        expect(data.data.metrics).toEqual(mockTenantMetrics);
        expect(data.data.configuration.sites).toHaveLength(2);
        expect(data.data.staleSites).toHaveLength(1);
        expect(data.data.staleSites[0].id).toBe('site-2');
    });

    it('should categorize errors correctly', async () => {
        (getServerSession as jest.Mock).mockResolvedValue(mockAdminSession);
        (prisma.tenant.findUnique as jest.Mock).mockResolvedValue(mockTenant);
        (sessionTracker.getActiveSessions as jest.Mock).mockResolvedValue([]);

        const sessionsWithErrors = [
            {
                ...mockActiveSession,
                id: 'session-1',
                errors: [
                    {
                        timestamp: new Date(),
                        message: 'Proxy connection failed',
                    },
                ],
            },
            {
                ...mockActiveSession,
                id: 'session-2',
                errors: [
                    {
                        timestamp: new Date(),
                        message: 'Challenge captcha failed',
                    },
                ],
            },
            {
                ...mockActiveSession,
                id: 'session-3',
                errors: [
                    {
                        timestamp: new Date(),
                        message: 'Parse error in extraction',
                    },
                ],
            },
            {
                ...mockActiveSession,
                id: 'session-4',
                errors: [
                    {
                        timestamp: new Date(),
                        message: 'Rate limit exceeded',
                    },
                ],
            },
        ];

        (sessionTracker.getSessionHistory as jest.Mock).mockResolvedValue(
            sessionsWithErrors
        );
        (metricsAggregator.getTenantMetrics as jest.Mock).mockResolvedValue(
            mockTenantMetrics
        );
        (prisma.site.findMany as jest.Mock).mockResolvedValue(mockSites);

        const req = {
            url: 'http://localhost:3000/api/v1/admin/debug/tenant/tenant-1',
            nextUrl: new URL(
                'http://localhost:3000/api/v1/admin/debug/tenant/tenant-1'
            ),
        } as any;

        const response = await getTenantDebug(req, { params: { id: 'tenant-1' } });

        expect(response.status).toBe(200);
        const data = await response.json();

        const errorCounts = data.data.recentErrors;
        const proxyErrors = errorCounts.find((e: any) => e.type === 'proxy_failure');
        const challengeErrors = errorCounts.find(
            (e: any) => e.type === 'challenge_failure'
        );
        const parseErrors = errorCounts.find((e: any) => e.type === 'parsing_error');
        const rateLimitErrors = errorCounts.find((e: any) => e.type === 'rate_limit');

        expect(proxyErrors.count).toBe(1);
        expect(challengeErrors.count).toBe(1);
        expect(parseErrors.count).toBe(1);
        expect(rateLimitErrors.count).toBe(1);
    });

    it('should calculate impact assessment correctly', async () => {
        (getServerSession as jest.Mock).mockResolvedValue(mockAdminSession);
        (prisma.tenant.findUnique as jest.Mock).mockResolvedValue(mockTenant);
        (sessionTracker.getActiveSessions as jest.Mock).mockResolvedValue([]);

        const sessions = [
            { ...mockActiveSession, status: 'completed' as const },
            { ...mockActiveSession, status: 'failed' as const },
            { ...mockActiveSession, status: 'failed' as const },
            { ...mockActiveSession, status: 'completed' as const },
        ];

        (sessionTracker.getSessionHistory as jest.Mock).mockResolvedValue(sessions);
        (metricsAggregator.getTenantMetrics as jest.Mock).mockResolvedValue(
            mockTenantMetrics
        );
        (prisma.site.findMany as jest.Mock).mockResolvedValue(mockSites);

        const req = {
            url: 'http://localhost:3000/api/v1/admin/debug/tenant/tenant-1',
            nextUrl: new URL(
                'http://localhost:3000/api/v1/admin/debug/tenant/tenant-1'
            ),
        } as any;

        const response = await getTenantDebug(req, { params: { id: 'tenant-1' } });

        expect(response.status).toBe(200);
        const data = await response.json();

        expect(data.data.impactAssessment.failureRate).toBe(50);
        expect(data.data.impactAssessment.businessImpact).toBe('medium');
    });

    it('should handle metrics aggregator failure gracefully', async () => {
        (getServerSession as jest.Mock).mockResolvedValue(mockAdminSession);
        (prisma.tenant.findUnique as jest.Mock).mockResolvedValue(mockTenant);
        (sessionTracker.getActiveSessions as jest.Mock).mockResolvedValue([]);
        (sessionTracker.getSessionHistory as jest.Mock).mockResolvedValue([]);
        (metricsAggregator.getTenantMetrics as jest.Mock).mockRejectedValue(
            new Error('Metrics unavailable')
        );
        (prisma.site.findMany as jest.Mock).mockResolvedValue([]);

        const req = {
            url: 'http://localhost:3000/api/v1/admin/debug/tenant/tenant-1',
            nextUrl: new URL(
                'http://localhost:3000/api/v1/admin/debug/tenant/tenant-1'
            ),
        } as any;

        const response = await getTenantDebug(req, { params: { id: 'tenant-1' } });

        expect(response.status).toBe(200);
        const data = await response.json();

        // Should provide default metrics
        expect(data.data.metrics.tenantId).toBe('tenant-1');
        expect(data.data.metrics.successRate).toBe(0);
    });
});
