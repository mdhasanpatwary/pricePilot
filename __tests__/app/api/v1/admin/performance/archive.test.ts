/**
 * Archive API Tests
 * 
 * Tests for archive query API endpoints including:
 * - Price history archive queries
 * - Audit logs archive queries
 * - Archive statistics
 */

import { NextRequest } from 'next/server';
import { GET as getPriceHistory } from '@/app/api/v1/admin/performance/archive/price-history/route';
import { GET as getAuditLogs } from '@/app/api/v1/admin/performance/archive/audit-logs/route';
import { GET as getStats } from '@/app/api/v1/admin/performance/archive/stats/route';

// Mock next-auth
jest.mock('next-auth', () => ({
    getServerSession: jest.fn(),
}));

// Mock ArchiveManager
jest.mock('@/lib/services/archive-manager', () => ({
    ArchiveManager: jest.fn().mockImplementation(() => ({
        queryPriceHistoryArchive: jest.fn().mockResolvedValue([
            {
                id: 'ph-1',
                product_id: 'prod-1',
                price: 99.99,
                recorded_at: new Date('2023-01-01'),
                created_at: new Date('2023-01-01'),
                archived_at: new Date('2024-01-01'),
                tenant_id: 'tenant-1',
            },
        ]),
        queryAuditLogsArchive: jest.fn().mockResolvedValue([
            {
                id: 'audit-1',
                tenant_id: 'tenant-1',
                user_id: 'user-1',
                user_email: 'user@example.com',
                action: 'UPDATE_PRICE',
                entity_id: 'prod-1',
                details: 'Updated price',
                ip_address: '192.168.1.1',
                created_at: new Date('2022-01-01'),
                archived_at: new Date('2023-01-01'),
            },
        ]),
        getArchiveStats: jest.fn().mockResolvedValue({
            priceHistoryArchived: 1000,
            auditLogsArchived: 500,
            totalArchiveSizeBytes: 150000,
            oldestArchivedRecord: new Date('2022-01-01'),
        }),
    })),
}));

import { getServerSession } from 'next-auth';

const mockGetServerSession = getServerSession as jest.MockedFunction<typeof getServerSession>;

describe('Archive API', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('GET /api/v1/admin/performance/archive/price-history', () => {
        it('should return 401 if not authenticated', async () => {
            mockGetServerSession.mockResolvedValue(null);

            const request = new NextRequest('http://localhost:3000/api/v1/admin/performance/archive/price-history');
            const response = await getPriceHistory(request);
            const data = await response.json();

            expect(response.status).toBe(401);
            expect(data.success).toBe(false);
            expect(data.error.code).toBe('UNAUTHORIZED');
        });

        it('should return 403 if not admin', async () => {
            mockGetServerSession.mockResolvedValue({
                user: { id: 'user-1', role: 'VIEWER', isSuperAdmin: false },
            } as any);

            const request = new NextRequest('http://localhost:3000/api/v1/admin/performance/archive/price-history');
            const response = await getPriceHistory(request);
            const data = await response.json();

            expect(response.status).toBe(403);
            expect(data.success).toBe(false);
            expect(data.error.code).toBe('FORBIDDEN');
        });

        it('should query price history archive with filters', async () => {
            mockGetServerSession.mockResolvedValue({
                user: { id: 'user-1', role: 'ADMIN', isSuperAdmin: false },
            } as any);

            const url = new URL('http://localhost:3000/api/v1/admin/performance/archive/price-history');
            url.searchParams.set('tenantId', 'tenant-1');
            url.searchParams.set('productId', 'prod-1');
            url.searchParams.set('startDate', '2023-01-01');
            url.searchParams.set('endDate', '2023-12-31');
            url.searchParams.set('limit', '50');
            url.searchParams.set('offset', '10');

            const request = new NextRequest(url);
            const response = await getPriceHistory(request);
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.success).toBe(true);
            expect(data.data.records).toHaveLength(1);
            expect(data.data.limit).toBe(50);
            expect(data.data.offset).toBe(10);
        });

        it('should use default limit and offset', async () => {
            mockGetServerSession.mockResolvedValue({
                user: { id: 'user-1', role: 'ADMIN', isSuperAdmin: false },
            } as any);

            const request = new NextRequest('http://localhost:3000/api/v1/admin/performance/archive/price-history');
            const response = await getPriceHistory(request);
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.data.limit).toBe(100);
            expect(data.data.offset).toBe(0);
        });

        it('should validate date format', async () => {
            mockGetServerSession.mockResolvedValue({
                user: { id: 'user-1', role: 'ADMIN', isSuperAdmin: false },
            } as any);

            const url = new URL('http://localhost:3000/api/v1/admin/performance/archive/price-history');
            url.searchParams.set('startDate', 'invalid-date');

            const request = new NextRequest(url);
            const response = await getPriceHistory(request);
            const data = await response.json();

            expect(response.status).toBe(400);
            expect(data.error.code).toBe('INVALID_DATE');
        });

        it('should validate limit range', async () => {
            mockGetServerSession.mockResolvedValue({
                user: { id: 'user-1', role: 'ADMIN', isSuperAdmin: false },
            } as any);

            const url = new URL('http://localhost:3000/api/v1/admin/performance/archive/price-history');
            url.searchParams.set('limit', '2000');

            const request = new NextRequest(url);
            const response = await getPriceHistory(request);
            const data = await response.json();

            expect(response.status).toBe(400);
            expect(data.error.code).toBe('INVALID_LIMIT');
        });
    });

    describe('GET /api/v1/admin/performance/archive/audit-logs', () => {
        it('should return 401 if not authenticated', async () => {
            mockGetServerSession.mockResolvedValue(null);

            const request = new NextRequest('http://localhost:3000/api/v1/admin/performance/archive/audit-logs');
            const response = await getAuditLogs(request);
            const data = await response.json();

            expect(response.status).toBe(401);
            expect(data.success).toBe(false);
        });

        it('should query audit logs archive with filters', async () => {
            mockGetServerSession.mockResolvedValue({
                user: { id: 'user-1', role: 'ADMIN', isSuperAdmin: false },
            } as any);

            const url = new URL('http://localhost:3000/api/v1/admin/performance/archive/audit-logs');
            url.searchParams.set('tenantId', 'tenant-1');
            url.searchParams.set('startDate', '2022-01-01');
            url.searchParams.set('endDate', '2022-12-31');

            const request = new NextRequest(url);
            const response = await getAuditLogs(request);
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.success).toBe(true);
            expect(data.data.records).toHaveLength(1);
        });
    });

    describe('GET /api/v1/admin/performance/archive/stats', () => {
        it('should return 401 if not authenticated', async () => {
            mockGetServerSession.mockResolvedValue(null);

            const request = new NextRequest('http://localhost:3000/api/v1/admin/performance/archive/stats');
            const response = await getStats(request);
            const data = await response.json();

            expect(response.status).toBe(401);
            expect(data.success).toBe(false);
        });

        it('should return archive statistics', async () => {
            mockGetServerSession.mockResolvedValue({
                user: { id: 'user-1', role: 'ADMIN', isSuperAdmin: false },
            } as any);

            const request = new NextRequest('http://localhost:3000/api/v1/admin/performance/archive/stats');
            const response = await getStats(request);
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.success).toBe(true);
            expect(data.data.priceHistoryArchived).toBe(1000);
            expect(data.data.auditLogsArchived).toBe(500);
            expect(data.data.totalArchiveSizeBytes).toBe(150000);
            expect(data.data.oldestArchivedRecord).toBeDefined();
        });

        it('should allow super admin access', async () => {
            mockGetServerSession.mockResolvedValue({
                user: { id: 'user-1', role: 'VIEWER', isSuperAdmin: true },
            } as any);

            const request = new NextRequest('http://localhost:3000/api/v1/admin/performance/archive/stats');
            const response = await getStats(request);
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.success).toBe(true);
        });
    });
});
