import { GET as getActiveSessions } from '@/app/api/v1/admin/sessions/route';
import { GET as getSessionDetail } from '@/app/api/v1/admin/sessions/[id]/route';
import { GET as getSessionHistory } from '@/app/api/v1/admin/sessions/history/route';

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
        getSession: jest.fn(),
        getSessionHistory: jest.fn(),
        getSessionCountByStatus: jest.fn(),
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

describe('/api/v1/admin/sessions', () => {
    const mockAdminSession = {
        user: {
            id: 'admin-123',
            email: 'admin@example.com',
            role: 'ADMIN',
            isSuperAdmin: true,
        },
    };

    const mockSession = {
        id: 'session-1',
        tenantId: 'tenant-1',
        tenantName: 'Test Tenant',
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

    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('GET /api/v1/admin/sessions', () => {
        it('should return 401 if not authenticated', async () => {
            (getServerSession as jest.Mock).mockResolvedValue(null);

            const req = {
                url: 'http://localhost:3000/api/v1/admin/sessions',
                nextUrl: new URL('http://localhost:3000/api/v1/admin/sessions'),
            } as any;

            const response = await getActiveSessions(req);

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
                url: 'http://localhost:3000/api/v1/admin/sessions',
                nextUrl: new URL('http://localhost:3000/api/v1/admin/sessions'),
            } as any;

            const response = await getActiveSessions(req);

            expect(response.status).toBe(401);
            const data = await response.json();
            expect(data.error).toBe('Unauthorized - Admin access required');
        });

        it('should return active sessions for admin', async () => {
            (getServerSession as jest.Mock).mockResolvedValue(mockAdminSession);
            (sessionTracker.getActiveSessions as jest.Mock).mockResolvedValue([
                mockSession,
            ]);
            (sessionTracker.getSessionCountByStatus as jest.Mock).mockResolvedValue({
                running: 1,
                completed: 5,
                failed: 2,
            });

            const req = {
                url: 'http://localhost:3000/api/v1/admin/sessions',
                nextUrl: new URL('http://localhost:3000/api/v1/admin/sessions'),
            } as any;

            const response = await getActiveSessions(req);

            expect(response.status).toBe(200);
            const data = await response.json();

            expect(data.success).toBe(true);
            expect(data.data.sessions).toHaveLength(1);
            expect(data.data.sessions[0].id).toBe('session-1');
            expect(data.data.summary.total).toBe(1);
            expect(data.data.summary.statusCounts).toEqual({
                running: 1,
                completed: 5,
                failed: 2,
            });
        });

        it('should filter sessions by tenantId', async () => {
            (getServerSession as jest.Mock).mockResolvedValue(mockAdminSession);
            (sessionTracker.getActiveSessions as jest.Mock).mockResolvedValue([
                mockSession,
            ]);
            (sessionTracker.getSessionCountByStatus as jest.Mock).mockResolvedValue({
                running: 1,
            });

            const req = {
                url: 'http://localhost:3000/api/v1/admin/sessions?tenantId=tenant-1',
                nextUrl: new URL(
                    'http://localhost:3000/api/v1/admin/sessions?tenantId=tenant-1'
                ),
            } as any;

            const response = await getActiveSessions(req);

            expect(response.status).toBe(200);
            expect(sessionTracker.getActiveSessions).toHaveBeenCalledWith('tenant-1');
        });

        it('should filter sessions by status', async () => {
            (getServerSession as jest.Mock).mockResolvedValue(mockAdminSession);
            (sessionTracker.getActiveSessions as jest.Mock).mockResolvedValue([
                mockSession,
                { ...mockSession, id: 'session-2', status: 'completed' },
            ]);
            (sessionTracker.getSessionCountByStatus as jest.Mock).mockResolvedValue({
                running: 1,
                completed: 1,
            });

            const req = {
                url: 'http://localhost:3000/api/v1/admin/sessions?status=running',
                nextUrl: new URL(
                    'http://localhost:3000/api/v1/admin/sessions?status=running'
                ),
            } as any;

            const response = await getActiveSessions(req);

            expect(response.status).toBe(200);
            const data = await response.json();

            expect(data.data.sessions).toHaveLength(1);
            expect(data.data.sessions[0].status).toBe('running');
        });
    });

    describe('GET /api/v1/admin/sessions/[id]', () => {
        it('should return 401 if not authenticated', async () => {
            (getServerSession as jest.Mock).mockResolvedValue(null);

            const req = {
                url: 'http://localhost:3000/api/v1/admin/sessions/session-1',
                nextUrl: new URL(
                    'http://localhost:3000/api/v1/admin/sessions/session-1'
                ),
            } as any;

            const response = await getSessionDetail(req, { params: { id: 'session-1' } });

            expect(response.status).toBe(401);
        });

        it('should return 404 if session not found', async () => {
            (getServerSession as jest.Mock).mockResolvedValue(mockAdminSession);
            (sessionTracker.getSession as jest.Mock).mockResolvedValue(null);

            const req = {
                url: 'http://localhost:3000/api/v1/admin/sessions/session-1',
                nextUrl: new URL(
                    'http://localhost:3000/api/v1/admin/sessions/session-1'
                ),
            } as any;

            const response = await getSessionDetail(req, { params: { id: 'session-1' } });

            expect(response.status).toBe(404);
            const data = await response.json();
            expect(data.error).toBe('Session not found');
        });

        it('should return session details for admin', async () => {
            (getServerSession as jest.Mock).mockResolvedValue(mockAdminSession);
            (sessionTracker.getSession as jest.Mock).mockResolvedValue(mockSession);

            const req = {
                url: 'http://localhost:3000/api/v1/admin/sessions/session-1',
                nextUrl: new URL(
                    'http://localhost:3000/api/v1/admin/sessions/session-1'
                ),
            } as any;

            const response = await getSessionDetail(req, { params: { id: 'session-1' } });

            expect(response.status).toBe(200);
            const data = await response.json();

            expect(data.success).toBe(true);
            expect(data.data.id).toBe('session-1');
            expect(data.data.tenantId).toBe('tenant-1');
            expect(sessionTracker.getSession).toHaveBeenCalledWith('session-1');
        });
    });

    describe('GET /api/v1/admin/sessions/history', () => {
        it('should return 401 if not authenticated', async () => {
            (getServerSession as jest.Mock).mockResolvedValue(null);

            const req = {
                url: 'http://localhost:3000/api/v1/admin/sessions/history',
                nextUrl: new URL('http://localhost:3000/api/v1/admin/sessions/history'),
            } as any;

            const response = await getSessionHistory(req);

            expect(response.status).toBe(401);
        });

        it('should return session history for admin', async () => {
            (getServerSession as jest.Mock).mockResolvedValue(mockAdminSession);
            const completedSession = {
                ...mockSession,
                status: 'completed' as const,
                endTime: new Date('2024-01-01T10:05:00Z'),
            };
            (sessionTracker.getSessionHistory as jest.Mock).mockResolvedValue([
                completedSession,
            ]);

            const req = {
                url: 'http://localhost:3000/api/v1/admin/sessions/history',
                nextUrl: new URL('http://localhost:3000/api/v1/admin/sessions/history'),
            } as any;

            const response = await getSessionHistory(req);

            expect(response.status).toBe(200);
            const data = await response.json();

            expect(data.success).toBe(true);
            expect(data.data.sessions).toHaveLength(1);
            expect(data.data.pagination.total).toBe(1);
            expect(data.data.pagination.limit).toBe(100);
            expect(data.data.pagination.offset).toBe(0);
        });

        it('should apply filters correctly', async () => {
            (getServerSession as jest.Mock).mockResolvedValue(mockAdminSession);
            (sessionTracker.getSessionHistory as jest.Mock).mockResolvedValue([]);

            const req = {
                url: 'http://localhost:3000/api/v1/admin/sessions/history?tenantId=tenant-1&status=completed&limit=50&offset=10',
                nextUrl: new URL(
                    'http://localhost:3000/api/v1/admin/sessions/history?tenantId=tenant-1&status=completed&limit=50&offset=10'
                ),
            } as any;

            const response = await getSessionHistory(req);

            expect(response.status).toBe(200);
            expect(sessionTracker.getSessionHistory).toHaveBeenCalledWith(
                expect.objectContaining({
                    tenantId: 'tenant-1',
                    status: 'completed',
                    limit: 50,
                    offset: 10,
                })
            );
        });

        it('should validate limit parameter', async () => {
            (getServerSession as jest.Mock).mockResolvedValue(mockAdminSession);

            const req = {
                url: 'http://localhost:3000/api/v1/admin/sessions/history?limit=2000',
                nextUrl: new URL(
                    'http://localhost:3000/api/v1/admin/sessions/history?limit=2000'
                ),
            } as any;

            const response = await getSessionHistory(req);

            expect(response.status).toBe(400);
            const data = await response.json();
            expect(data.error).toContain('Invalid limit parameter');
        });

        it('should validate offset parameter', async () => {
            (getServerSession as jest.Mock).mockResolvedValue(mockAdminSession);

            const req = {
                url: 'http://localhost:3000/api/v1/admin/sessions/history?offset=-1',
                nextUrl: new URL(
                    'http://localhost:3000/api/v1/admin/sessions/history?offset=-1'
                ),
            } as any;

            const response = await getSessionHistory(req);

            expect(response.status).toBe(400);
            const data = await response.json();
            expect(data.error).toContain('Invalid offset parameter');
        });

        it('should parse date filters correctly', async () => {
            (getServerSession as jest.Mock).mockResolvedValue(mockAdminSession);
            (sessionTracker.getSessionHistory as jest.Mock).mockResolvedValue([]);

            const req = {
                url: 'http://localhost:3000/api/v1/admin/sessions/history?startDate=2024-01-01T00:00:00Z&endDate=2024-01-31T23:59:59Z',
                nextUrl: new URL(
                    'http://localhost:3000/api/v1/admin/sessions/history?startDate=2024-01-01T00:00:00Z&endDate=2024-01-31T23:59:59Z'
                ),
            } as any;

            const response = await getSessionHistory(req);

            expect(response.status).toBe(200);
            expect(sessionTracker.getSessionHistory).toHaveBeenCalledWith(
                expect.objectContaining({
                    startDate: new Date('2024-01-01T00:00:00Z'),
                    endDate: new Date('2024-01-31T23:59:59Z'),
                })
            );
        });
    });
});
