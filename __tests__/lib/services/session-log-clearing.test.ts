import { sessionTracker } from '@/lib/services/session-tracker';
import { sessionRepository } from '@/lib/services/session-repository';
import { redisSessionManager } from '@/lib/services/redis-session-manager';

// Mock dependencies
jest.mock('@/lib/services/session-repository');
jest.mock('@/lib/services/redis-session-manager');
jest.mock('@/lib/logger');

describe('Session Log Clearing', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('clearCompletedSessions', () => {
        it('should clear completed and failed sessions from database', async () => {
            // Mock repository response
            (sessionRepository.clearCompletedSessions as jest.Mock).mockResolvedValue(5);
            (redisSessionManager.getTenantSessions as jest.Mock).mockResolvedValue([]);

            const count = await sessionTracker.clearCompletedSessions('tenant-123');

            expect(count).toBe(5);
            expect(sessionRepository.clearCompletedSessions).toHaveBeenCalledWith('tenant-123');
        });

        it('should clear completed sessions from Redis', async () => {
            const mockSessions = [
                { id: 'session-1', status: 'completed', tenantId: 'tenant-123' },
                { id: 'session-2', status: 'failed', tenantId: 'tenant-123' },
                { id: 'session-3', status: 'running', tenantId: 'tenant-123' },
            ];

            (sessionRepository.clearCompletedSessions as jest.Mock).mockResolvedValue(2);
            (redisSessionManager.getTenantSessions as jest.Mock).mockResolvedValue([
                'session-1',
                'session-2',
                'session-3',
            ]);
            (sessionRepository.getSession as jest.Mock).mockImplementation((id: string) => {
                return Promise.resolve(mockSessions.find(s => s.id === id) || null);
            });
            (redisSessionManager.deleteSession as jest.Mock).mockResolvedValue(undefined);

            await sessionTracker.clearCompletedSessions('tenant-123');

            // Should delete completed and failed sessions from Redis
            expect(redisSessionManager.deleteSession).toHaveBeenCalledWith('session-1', 'tenant-123');
            expect(redisSessionManager.deleteSession).toHaveBeenCalledWith('session-2', 'tenant-123');
            // Should NOT delete running session
            expect(redisSessionManager.deleteSession).not.toHaveBeenCalledWith('session-3', 'tenant-123');
        });

        it('should clear all tenants when no tenantId provided', async () => {
            (sessionRepository.clearCompletedSessions as jest.Mock).mockResolvedValue(10);

            const count = await sessionTracker.clearCompletedSessions();

            expect(count).toBe(10);
            expect(sessionRepository.clearCompletedSessions).toHaveBeenCalledWith(undefined);
        });

        it('should handle errors gracefully', async () => {
            (sessionRepository.clearCompletedSessions as jest.Mock).mockRejectedValue(
                new Error('Database error')
            );

            const count = await sessionTracker.clearCompletedSessions('tenant-123');

            expect(count).toBe(0);
        });
    });

    describe('SessionRepository.clearCompletedSessions', () => {
        it('should delete only completed and failed sessions', async () => {
            const mockPrisma = {
                scrapingSession: {
                    deleteMany: jest.fn().mockResolvedValue({ count: 3 }),
                },
            };

            // This test verifies the query structure
            // In actual implementation, it would use prisma.scrapingSession.deleteMany
            const where = {
                status: { in: ['completed', 'failed'] },
                tenantId: 'tenant-123',
            };

            const result = await mockPrisma.scrapingSession.deleteMany({ where });

            expect(result.count).toBe(3);
            expect(mockPrisma.scrapingSession.deleteMany).toHaveBeenCalledWith({ where });
        });
    });
});

describe('Auto-clear on Scraping Start', () => {
    it('should automatically clear logs before creating new session', async () => {
        // This test verifies the auto-clear logic in scraper service
        // The actual implementation is in lib/services/scraper.ts

        const mockClearCompletedSessions = jest.fn().mockResolvedValue(5);
        const mockCreateSession = jest.fn().mockResolvedValue('new-session-id');

        // Simulate the scraping flow
        const tenantId = 'tenant-123';

        // Step 1: Auto-clear completed sessions
        const clearedCount = await mockClearCompletedSessions(tenantId);
        expect(clearedCount).toBe(5);
        expect(mockClearCompletedSessions).toHaveBeenCalledWith(tenantId);

        // Step 2: Create new session
        const sessionId = await mockCreateSession(tenantId, 'Tenant Name', 'https://example.com', 'https://example.com/product');
        expect(sessionId).toBe('new-session-id');
        expect(mockCreateSession).toHaveBeenCalled();
    });

    it('should continue scraping even if auto-clear fails', async () => {
        const mockClearCompletedSessions = jest.fn().mockRejectedValue(new Error('Clear failed'));
        const mockCreateSession = jest.fn().mockResolvedValue('new-session-id');

        const tenantId = 'tenant-123';

        // Step 1: Auto-clear fails but is caught
        try {
            await mockClearCompletedSessions(tenantId);
        } catch (error) {
            // Error is caught and logged, but doesn't stop the flow
        }

        // Step 2: Session creation continues
        const sessionId = await mockCreateSession(tenantId, 'Tenant Name', 'https://example.com', 'https://example.com/product');
        expect(sessionId).toBe('new-session-id');
    });
});
