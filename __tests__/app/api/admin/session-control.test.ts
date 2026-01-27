import { POST as pauseSession } from '@/app/api/v1/admin/sessions/[id]/pause/route';
import { POST as resumeSession } from '@/app/api/v1/admin/sessions/[id]/resume/route';
import { POST as cancelSession } from '@/app/api/v1/admin/sessions/[id]/cancel/route';
import { POST as retrySession } from '@/app/api/v1/admin/sessions/[id]/retry/route';
import { POST as bulkOperations } from '@/app/api/v1/admin/sessions/bulk/route';

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
        pauseSession: jest.fn(),
        resumeSession: jest.fn(),
        cancelSession: jest.fn(),
        retrySession: jest.fn(),
        bulkPauseSessions: jest.fn(),
        bulkResumeSessions: jest.fn(),
        bulkCancelSessions: jest.fn(),
    },
}));

// Mock Next.js Request/Response
jest.mock('next/server', () => ({
    NextRequest: jest.fn().mockImplementation((url, options) => ({
        url,
        method: options?.method || 'POST',
        nextUrl: new URL(url),
        json: jest.fn().mockResolvedValue({}),
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

describe('Session Control API Endpoints', () => {
    const mockAdminSession = {
        user: {
            id: 'admin-123',
            email: 'admin@example.com',
            role: 'ADMIN',
            isSuperAdmin: true,
        },
    };

    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('POST /api/v1/admin/sessions/[id]/pause', () => {
        it('should return 401 if not authenticated', async () => {
            (getServerSession as jest.Mock).mockResolvedValue(null);

            const req = {
                url: 'http://localhost:3000/api/v1/admin/sessions/session-1/pause',
                method: 'POST',
            } as any;

            const response = await pauseSession(req, { params: { id: 'session-1' } });

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
                url: 'http://localhost:3000/api/v1/admin/sessions/session-1/pause',
                method: 'POST',
            } as any;

            const response = await pauseSession(req, { params: { id: 'session-1' } });

            expect(response.status).toBe(401);
        });

        it('should pause session successfully', async () => {
            (getServerSession as jest.Mock).mockResolvedValue(mockAdminSession);
            (sessionTracker.pauseSession as jest.Mock).mockResolvedValue({
                success: true,
                message: 'Session paused successfully',
            });

            const req = {
                url: 'http://localhost:3000/api/v1/admin/sessions/session-1/pause',
                method: 'POST',
            } as any;

            const response = await pauseSession(req, { params: { id: 'session-1' } });

            expect(response.status).toBe(200);
            const data = await response.json();
            expect(data.success).toBe(true);
            expect(data.message).toBe('Session paused successfully');
            expect(sessionTracker.pauseSession).toHaveBeenCalledWith('session-1');
        });

        it('should return 400 if pause fails', async () => {
            (getServerSession as jest.Mock).mockResolvedValue(mockAdminSession);
            (sessionTracker.pauseSession as jest.Mock).mockResolvedValue({
                success: false,
                message: 'Session not found',
            });

            const req = {
                url: 'http://localhost:3000/api/v1/admin/sessions/session-1/pause',
                method: 'POST',
            } as any;

            const response = await pauseSession(req, { params: { id: 'session-1' } });

            expect(response.status).toBe(400);
            const data = await response.json();
            expect(data.success).toBe(false);
            expect(data.error).toBe('Session not found');
        });
    });

    describe('POST /api/v1/admin/sessions/[id]/resume', () => {
        it('should resume session successfully', async () => {
            (getServerSession as jest.Mock).mockResolvedValue(mockAdminSession);
            (sessionTracker.resumeSession as jest.Mock).mockResolvedValue({
                success: true,
                message: 'Session resumed successfully',
            });

            const req = {
                url: 'http://localhost:3000/api/v1/admin/sessions/session-1/resume',
                method: 'POST',
            } as any;

            const response = await resumeSession(req, { params: { id: 'session-1' } });

            expect(response.status).toBe(200);
            const data = await response.json();
            expect(data.success).toBe(true);
            expect(data.message).toBe('Session resumed successfully');
            expect(sessionTracker.resumeSession).toHaveBeenCalledWith('session-1');
        });

        it('should return 400 if resume fails', async () => {
            (getServerSession as jest.Mock).mockResolvedValue(mockAdminSession);
            (sessionTracker.resumeSession as jest.Mock).mockResolvedValue({
                success: false,
                message: 'Cannot resume completed or failed session',
            });

            const req = {
                url: 'http://localhost:3000/api/v1/admin/sessions/session-1/resume',
                method: 'POST',
            } as any;

            const response = await resumeSession(req, { params: { id: 'session-1' } });

            expect(response.status).toBe(400);
            const data = await response.json();
            expect(data.error).toBe('Cannot resume completed or failed session');
        });
    });

    describe('POST /api/v1/admin/sessions/[id]/cancel', () => {
        it('should cancel session successfully', async () => {
            (getServerSession as jest.Mock).mockResolvedValue(mockAdminSession);
            (sessionTracker.cancelSession as jest.Mock).mockResolvedValue({
                success: true,
                message: 'Session canceled successfully',
            });

            const req = {
                url: 'http://localhost:3000/api/v1/admin/sessions/session-1/cancel',
                method: 'POST',
                json: jest.fn().mockResolvedValue({ reason: 'User requested' }),
            } as any;

            const response = await cancelSession(req, { params: { id: 'session-1' } });

            expect(response.status).toBe(200);
            const data = await response.json();
            expect(data.success).toBe(true);
            expect(sessionTracker.cancelSession).toHaveBeenCalledWith(
                'session-1',
                'User requested'
            );
        });

        it('should cancel session without reason', async () => {
            (getServerSession as jest.Mock).mockResolvedValue(mockAdminSession);
            (sessionTracker.cancelSession as jest.Mock).mockResolvedValue({
                success: true,
                message: 'Session canceled successfully',
            });

            const req = {
                url: 'http://localhost:3000/api/v1/admin/sessions/session-1/cancel',
                method: 'POST',
                json: jest.fn().mockRejectedValue(new Error('No body')),
            } as any;

            const response = await cancelSession(req, { params: { id: 'session-1' } });

            expect(response.status).toBe(200);
            expect(sessionTracker.cancelSession).toHaveBeenCalledWith(
                'session-1',
                undefined
            );
        });
    });

    describe('POST /api/v1/admin/sessions/[id]/retry', () => {
        it('should retry session successfully', async () => {
            (getServerSession as jest.Mock).mockResolvedValue(mockAdminSession);
            (sessionTracker.retrySession as jest.Mock).mockResolvedValue({
                success: true,
                message: 'Session retry initiated',
                newSessionId: 'session-2',
            });

            const req = {
                url: 'http://localhost:3000/api/v1/admin/sessions/session-1/retry',
                method: 'POST',
                json: jest
                    .fn()
                    .mockResolvedValue({ proxy: 'http://proxy2.com:8080' }),
            } as any;

            const response = await retrySession(req, { params: { id: 'session-1' } });

            expect(response.status).toBe(200);
            const data = await response.json();
            expect(data.success).toBe(true);
            expect(data.newSessionId).toBe('session-2');
            expect(sessionTracker.retrySession).toHaveBeenCalledWith('session-1', {
                proxy: 'http://proxy2.com:8080',
                userAgent: undefined,
            });
        });

        it('should retry session with user agent override', async () => {
            (getServerSession as jest.Mock).mockResolvedValue(mockAdminSession);
            (sessionTracker.retrySession as jest.Mock).mockResolvedValue({
                success: true,
                message: 'Session retry initiated',
                newSessionId: 'session-2',
            });

            const req = {
                url: 'http://localhost:3000/api/v1/admin/sessions/session-1/retry',
                method: 'POST',
                json: jest.fn().mockResolvedValue({
                    proxy: 'http://proxy2.com:8080',
                    userAgent: 'Custom User Agent',
                }),
            } as any;

            const response = await retrySession(req, { params: { id: 'session-1' } });

            expect(response.status).toBe(200);
            expect(sessionTracker.retrySession).toHaveBeenCalledWith('session-1', {
                proxy: 'http://proxy2.com:8080',
                userAgent: 'Custom User Agent',
            });
        });
    });

    describe('POST /api/v1/admin/sessions/bulk', () => {
        it('should return 401 if not authenticated', async () => {
            (getServerSession as jest.Mock).mockResolvedValue(null);

            const req = {
                url: 'http://localhost:3000/api/v1/admin/sessions/bulk',
                method: 'POST',
                json: jest.fn().mockResolvedValue({
                    operation: 'pause',
                    sessionIds: ['session-1', 'session-2'],
                }),
            } as any;

            const response = await bulkOperations(req);

            expect(response.status).toBe(401);
        });

        it('should perform bulk pause operation', async () => {
            (getServerSession as jest.Mock).mockResolvedValue(mockAdminSession);
            (sessionTracker.bulkPauseSessions as jest.Mock).mockResolvedValue([
                { sessionId: 'session-1', success: true, message: 'Paused' },
                { sessionId: 'session-2', success: true, message: 'Paused' },
            ]);

            const req = {
                url: 'http://localhost:3000/api/v1/admin/sessions/bulk',
                method: 'POST',
                json: jest.fn().mockResolvedValue({
                    operation: 'pause',
                    sessionIds: ['session-1', 'session-2'],
                }),
            } as any;

            const response = await bulkOperations(req);

            expect(response.status).toBe(200);
            const data = await response.json();
            expect(data.success).toBe(true);
            expect(data.operation).toBe('pause');
            expect(data.summary.total).toBe(2);
            expect(data.summary.successful).toBe(2);
            expect(data.summary.failed).toBe(0);
            expect(sessionTracker.bulkPauseSessions).toHaveBeenCalledWith([
                'session-1',
                'session-2',
            ]);
        });

        it('should perform bulk resume operation', async () => {
            (getServerSession as jest.Mock).mockResolvedValue(mockAdminSession);
            (sessionTracker.bulkResumeSessions as jest.Mock).mockResolvedValue([
                { sessionId: 'session-1', success: true, message: 'Resumed' },
                { sessionId: 'session-2', success: false, message: 'Already completed' },
            ]);

            const req = {
                url: 'http://localhost:3000/api/v1/admin/sessions/bulk',
                method: 'POST',
                json: jest.fn().mockResolvedValue({
                    operation: 'resume',
                    sessionIds: ['session-1', 'session-2'],
                }),
            } as any;

            const response = await bulkOperations(req);

            expect(response.status).toBe(200);
            const data = await response.json();
            expect(data.summary.successful).toBe(1);
            expect(data.summary.failed).toBe(1);
        });

        it('should perform bulk cancel operation with reason', async () => {
            (getServerSession as jest.Mock).mockResolvedValue(mockAdminSession);
            (sessionTracker.bulkCancelSessions as jest.Mock).mockResolvedValue([
                { sessionId: 'session-1', success: true, message: 'Canceled' },
            ]);

            const req = {
                url: 'http://localhost:3000/api/v1/admin/sessions/bulk',
                method: 'POST',
                json: jest.fn().mockResolvedValue({
                    operation: 'cancel',
                    sessionIds: ['session-1'],
                    reason: 'Maintenance',
                }),
            } as any;

            const response = await bulkOperations(req);

            expect(response.status).toBe(200);
            expect(sessionTracker.bulkCancelSessions).toHaveBeenCalledWith(
                ['session-1'],
                'Maintenance'
            );
        });

        it('should return 400 for invalid operation', async () => {
            (getServerSession as jest.Mock).mockResolvedValue(mockAdminSession);

            const req = {
                url: 'http://localhost:3000/api/v1/admin/sessions/bulk',
                method: 'POST',
                json: jest.fn().mockResolvedValue({
                    operation: 'invalid',
                    sessionIds: ['session-1'],
                }),
            } as any;

            const response = await bulkOperations(req);

            expect(response.status).toBe(400);
            const data = await response.json();
            expect(data.error).toContain('Invalid operation');
        });

        it('should return 400 for missing sessionIds', async () => {
            (getServerSession as jest.Mock).mockResolvedValue(mockAdminSession);

            const req = {
                url: 'http://localhost:3000/api/v1/admin/sessions/bulk',
                method: 'POST',
                json: jest.fn().mockResolvedValue({
                    operation: 'pause',
                    sessionIds: [],
                }),
            } as any;

            const response = await bulkOperations(req);

            expect(response.status).toBe(400);
            const data = await response.json();
            expect(data.error).toContain('operation and sessionIds are required');
        });
    });
});
