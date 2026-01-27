/**
 * SessionTracker Service Tests
 * 
 * Tests for the SessionTracker service that manages scraping session lifecycle
 * Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 2.1, 2.2, 2.3, 2.4, 2.5
 */

import { SessionTracker } from '@/lib/services/session-tracker';
import { sessionRepository } from '@/lib/services/session-repository';
import { redisSessionManager } from '@/lib/services/redis-session-manager';

describe('SessionTracker', () => {
    let sessionTracker: SessionTracker;

    beforeEach(() => {
        sessionTracker = SessionTracker.getInstance();
    });

    afterEach(async () => {
        // Cleanup Redis after each test
        await redisSessionManager.clearAllSessions();
    });

    describe('createSession', () => {
        it('should create a new session with valid parameters', async () => {
            const sessionId = await sessionTracker.createSession(
                'tenant-123',
                'Test Tenant',
                'https://example.com',
                'https://example.com/product/123',
                'Mozilla/5.0'
            );

            expect(sessionId).toBeDefined();
            expect(typeof sessionId).toBe('string');

            // Verify session was created in database
            const session = await sessionRepository.getSession(sessionId);
            expect(session).toBeDefined();
            expect(session?.tenantId).toBe('tenant-123');
            expect(session?.tenantName).toBe('Test Tenant');
            expect(session?.siteUrl).toBe('https://example.com');
            expect(session?.targetUrl).toBe('https://example.com/product/123');
            expect(session?.status).toBe('initializing');
            expect(session?.currentStage).toBe('proxy_selection');

            // Verify session was created in Redis
            const redisSession = await redisSessionManager.getSession(sessionId);
            expect(redisSession).toBeDefined();
            expect(redisSession?.tenantId).toBe('tenant-123');
        });

        it('should create session without user agent', async () => {
            const sessionId = await sessionTracker.createSession(
                'tenant-456',
                'Another Tenant',
                'https://test.com',
                'https://test.com/page'
            );

            expect(sessionId).toBeDefined();
            const session = await sessionRepository.getSession(sessionId);
            expect(session).toBeDefined();
        });
    });

    describe('updateStage', () => {
        it('should update session stage', async () => {
            const sessionId = await sessionTracker.createSession(
                'tenant-123',
                'Test Tenant',
                'https://example.com',
                'https://example.com/product/123'
            );

            await sessionTracker.updateStage(sessionId, 'navigation', {
                proxy: 'http://proxy1.com:8080',
            });

            const session = await sessionRepository.getSession(sessionId);
            expect(session?.currentStage).toBe('navigation');
            expect(session?.status).toBe('running');
            expect(session?.proxyUsed).toBe('http://proxy1.com:8080');
        });

        it('should update challenge information', async () => {
            const sessionId = await sessionTracker.createSession(
                'tenant-123',
                'Test Tenant',
                'https://example.com',
                'https://example.com/product/123'
            );

            await sessionTracker.updateStage(sessionId, 'challenge_detection', {
                challengeType: 'cloudflare',
                challengeStatus: 'waiting',
            });

            const session = await sessionRepository.getSession(sessionId);
            expect(session?.currentStage).toBe('challenge_detection');
            expect(session?.status).toBe('waiting_challenge');
            expect(session?.challengeType).toBe('cloudflare');
            expect(session?.challengeStatus).toBe('waiting');
        });

        it('should update request counts', async () => {
            const sessionId = await sessionTracker.createSession(
                'tenant-123',
                'Test Tenant',
                'https://example.com',
                'https://example.com/product/123'
            );

            await sessionTracker.updateStage(sessionId, 'data_extraction', {
                requestsCompleted: 5,
                requestsTotal: 10,
            });

            const session = await sessionRepository.getSession(sessionId);
            expect(session?.requestsCompleted).toBe(5);
            expect(session?.requestsTotal).toBe(10);
        });
    });

    describe('recordError', () => {
        it('should record error with Error object', async () => {
            const sessionId = await sessionTracker.createSession(
                'tenant-123',
                'Test Tenant',
                'https://example.com',
                'https://example.com/product/123'
            );

            const error = new Error('Test error message');
            await sessionTracker.recordError(sessionId, error);

            const session = await sessionRepository.getSession(sessionId);
            expect(session?.errors).toHaveLength(1);
            expect(session?.errors[0].message).toBe('Test error message');
            expect(session?.errors[0].stack).toBeDefined();
        });

        it('should record error with string message', async () => {
            const sessionId = await sessionTracker.createSession(
                'tenant-123',
                'Test Tenant',
                'https://example.com',
                'https://example.com/product/123'
            );

            await sessionTracker.recordError(sessionId, 'String error message');

            const session = await sessionRepository.getSession(sessionId);
            expect(session?.errors).toHaveLength(1);
            expect(session?.errors[0].message).toBe('String error message');
        });

        it('should record multiple errors', async () => {
            const sessionId = await sessionTracker.createSession(
                'tenant-123',
                'Test Tenant',
                'https://example.com',
                'https://example.com/product/123'
            );

            await sessionTracker.recordError(sessionId, 'Error 1');
            await sessionTracker.recordError(sessionId, 'Error 2');
            await sessionTracker.recordError(sessionId, 'Error 3');

            const session = await sessionRepository.getSession(sessionId);
            expect(session?.errors).toHaveLength(3);
            expect(session?.errors[0].message).toBe('Error 1');
            expect(session?.errors[1].message).toBe('Error 2');
            expect(session?.errors[2].message).toBe('Error 3');
        });
    });

    describe('completeSession', () => {
        it('should complete session successfully', async () => {
            const sessionId = await sessionTracker.createSession(
                'tenant-123',
                'Test Tenant',
                'https://example.com',
                'https://example.com/product/123'
            );

            await sessionTracker.completeSession(sessionId, true, {
                extractedData: { title: 'Product Title', price: 99.99 },
            });

            const session = await sessionRepository.getSession(sessionId);
            expect(session?.status).toBe('completed');
            expect(session?.endTime).toBeDefined();
            expect(session?.extractedData).toEqual({ title: 'Product Title', price: 99.99 });
            expect(session?.metrics.totalTime).toBeGreaterThan(0);

            // Verify session was removed from Redis
            const redisSession = await redisSessionManager.getSession(sessionId);
            expect(redisSession).toBeNull();
        });

        it('should complete session with failure', async () => {
            const sessionId = await sessionTracker.createSession(
                'tenant-123',
                'Test Tenant',
                'https://example.com',
                'https://example.com/product/123'
            );

            await sessionTracker.completeSession(sessionId, false);

            const session = await sessionRepository.getSession(sessionId);
            expect(session?.status).toBe('failed');
            expect(session?.endTime).toBeDefined();
        });
    });

    describe('getActiveSessions', () => {
        it('should return all active sessions', async () => {
            const sessionId1 = await sessionTracker.createSession(
                'tenant-123',
                'Test Tenant',
                'https://example.com',
                'https://example.com/product/1'
            );

            const sessionId2 = await sessionTracker.createSession(
                'tenant-456',
                'Another Tenant',
                'https://test.com',
                'https://test.com/product/2'
            );

            const sessions = await sessionTracker.getActiveSessions();
            expect(sessions.length).toBeGreaterThanOrEqual(2);

            const sessionIds = sessions.map(s => s.id);
            expect(sessionIds).toContain(sessionId1);
            expect(sessionIds).toContain(sessionId2);
        });

        it('should filter sessions by tenant', async () => {
            await sessionTracker.createSession(
                'tenant-123',
                'Test Tenant',
                'https://example.com',
                'https://example.com/product/1'
            );

            await sessionTracker.createSession(
                'tenant-456',
                'Another Tenant',
                'https://test.com',
                'https://test.com/product/2'
            );

            const sessions = await sessionTracker.getActiveSessions('tenant-123');
            expect(sessions.length).toBeGreaterThanOrEqual(1);
            expect(sessions.every(s => s.tenantId === 'tenant-123')).toBe(true);
        });
    });

    describe('getSession', () => {
        it('should retrieve session by ID', async () => {
            const sessionId = await sessionTracker.createSession(
                'tenant-123',
                'Test Tenant',
                'https://example.com',
                'https://example.com/product/123'
            );

            const session = await sessionTracker.getSession(sessionId);
            expect(session).toBeDefined();
            expect(session?.id).toBe(sessionId);
            expect(session?.tenantId).toBe('tenant-123');
        });

        it('should return null for non-existent session', async () => {
            const session = await sessionTracker.getSession('non-existent-id');
            expect(session).toBeNull();
        });
    });

    describe('getSessionHistory', () => {
        it('should retrieve completed sessions', async () => {
            const sessionId = await sessionTracker.createSession(
                'tenant-123',
                'Test Tenant',
                'https://example.com',
                'https://example.com/product/123'
            );

            await sessionTracker.completeSession(sessionId, true);

            const history = await sessionTracker.getSessionHistory({
                tenantId: 'tenant-123',
                limit: 10,
            });

            expect(history.length).toBeGreaterThanOrEqual(1);
            const completedSession = history.find(s => s.id === sessionId);
            expect(completedSession).toBeDefined();
            expect(completedSession?.status).toBe('completed');
        });

        it('should filter by status', async () => {
            const sessionId1 = await sessionTracker.createSession(
                'tenant-123',
                'Test Tenant',
                'https://example.com',
                'https://example.com/product/1'
            );

            const sessionId2 = await sessionTracker.createSession(
                'tenant-123',
                'Test Tenant',
                'https://example.com',
                'https://example.com/product/2'
            );

            await sessionTracker.completeSession(sessionId1, true);
            await sessionTracker.completeSession(sessionId2, false);

            const completedSessions = await sessionTracker.getSessionHistory({
                tenantId: 'tenant-123',
                status: 'completed',
            });

            expect(completedSessions.every(s => s.status === 'completed')).toBe(true);
        });
    });

    describe('getSessionCountByStatus', () => {
        it('should return session counts by status', async () => {
            const sessionId1 = await sessionTracker.createSession(
                'tenant-123',
                'Test Tenant',
                'https://example.com',
                'https://example.com/product/1'
            );

            const sessionId2 = await sessionTracker.createSession(
                'tenant-123',
                'Test Tenant',
                'https://example.com',
                'https://example.com/product/2'
            );

            await sessionTracker.completeSession(sessionId1, true);
            await sessionTracker.completeSession(sessionId2, false);

            const counts = await sessionTracker.getSessionCountByStatus('tenant-123');
            expect(counts).toBeDefined();
            expect(typeof counts.completed).toBe('number');
            expect(typeof counts.failed).toBe('number');
        });
    });
});
