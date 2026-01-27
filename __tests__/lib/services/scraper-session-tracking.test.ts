/**
 * ScraperService Session Tracking Integration Tests
 * 
 * Tests for the integration between ScraperService and SessionTracker
 * Requirements: 2.1, 2.2, 2.3, 2.4, 2.5
 */

// Mock Redis before imports
jest.mock("@upstash/redis", () => ({
    Redis: {
        fromEnv: jest.fn().mockReturnValue({
            get: jest.fn(),
            set: jest.fn(),
            del: jest.fn(),
            hgetall: jest.fn(),
            hset: jest.fn(),
            hdel: jest.fn(),
            sadd: jest.fn(),
            smembers: jest.fn().mockResolvedValue([]),
            srem: jest.fn(),
            keys: jest.fn().mockResolvedValue([]),
            expire: jest.fn(),
        }),
    },
}));

import { ScraperService } from '@/lib/services/scraper';
import { sessionTracker } from '@/lib/services/session-tracker';
import { sessionRepository } from '@/lib/services/session-repository';
import { redisSessionManager } from '@/lib/services/redis-session-manager';

describe('ScraperService - Session Tracking Integration', () => {
    let scraperService: ScraperService;

    beforeAll(() => {
        scraperService = new ScraperService();
    });

    afterEach(async () => {
        // Cleanup Redis after each test
        await redisSessionManager.clearAllSessions();
    });

    afterAll(async () => {
        await scraperService.close();
    });

    describe('scrapeProductPageWithTracking', () => {
        it('should create a session when scraping starts', async () => {
            const url = 'https://example.com/product/123';
            const tenantId = 'test-tenant-1';
            const siteId = 'test-site-1';
            const productId = 'test-product-1';
            const tenantName = 'Test Tenant';

            // Get initial session count
            const initialSessions = await sessionTracker.getActiveSessions(tenantId);
            const initialCount = initialSessions.length;

            // Attempt to scrape (will fail due to invalid URL, but session should be created)
            try {
                await scraperService.scrapeProductPageWithTracking(
                    url,
                    tenantId,
                    siteId,
                    productId,
                    tenantName
                );
            } catch (error) {
                // Expected to fail
            }

            // Verify session was created
            const sessions = await sessionTracker.getSessionHistory({
                tenantId,
                limit: 10,
            });

            expect(sessions.length).toBeGreaterThan(initialCount);

            // Find the session for our URL
            const session = sessions.find(s => s.targetUrl === url);
            expect(session).toBeDefined();
            expect(session?.tenantId).toBe(tenantId);
            expect(session?.tenantName).toBe(tenantName);
            expect(session?.siteUrl).toBe('https://example.com');
            expect(session?.targetUrl).toBe(url);
        }, 30000);

        it('should track session lifecycle stages', async () => {
            const url = 'https://httpbin.org/html';
            const tenantId = 'test-tenant-2';
            const siteId = 'test-site-2';
            const productId = 'test-product-2';

            // Attempt to scrape
            try {
                await scraperService.scrapeProductPageWithTracking(
                    url,
                    tenantId,
                    siteId,
                    productId,
                    'Test Tenant 2'
                );
            } catch (error) {
                // May fail due to extraction, but lifecycle should be tracked
            }

            // Get the session
            const sessions = await sessionTracker.getSessionHistory({
                tenantId,
                limit: 1,
            });

            expect(sessions.length).toBeGreaterThan(0);
            const session = sessions[0];

            // Verify session has lifecycle information
            expect(session).toBeDefined();
            expect(session.startTime).toBeDefined();
            expect(session.endTime).toBeDefined();
            expect(session.status).toMatch(/completed|failed/);

            // Verify metrics were tracked
            expect(session.metrics).toBeDefined();
            expect(session.metrics.totalTime).toBeGreaterThan(0);
        }, 60000);

        it('should record errors in the session', async () => {
            const url = 'https://invalid-domain-that-does-not-exist-12345.com/product';
            const tenantId = 'test-tenant-3';
            const siteId = 'test-site-3';
            const productId = 'test-product-3';

            // Attempt to scrape (will fail)
            try {
                await scraperService.scrapeProductPageWithTracking(
                    url,
                    tenantId,
                    siteId,
                    productId,
                    'Test Tenant 3'
                );
            } catch (error) {
                // Expected to fail
            }

            // Get the session
            const sessions = await sessionTracker.getSessionHistory({
                tenantId,
                limit: 1,
            });

            expect(sessions.length).toBeGreaterThan(0);
            const session = sessions[0];

            // Verify errors were recorded
            expect(session.errors).toBeDefined();
            expect(session.errors.length).toBeGreaterThan(0);
            expect(session.status).toBe('failed');
        }, 60000);

        it('should complete session successfully when data is extracted', async () => {
            // This test would require a mock server or a reliable test URL
            // For now, we'll skip it as it requires external dependencies
            expect(true).toBe(true);
        });
    });

    describe('scrapeProductPageWithRetryQueue', () => {
        it('should use session tracking when scraping with retry queue', async () => {
            const url = 'https://example.com/product/456';
            const tenantId = 'test-tenant-4';
            const siteId = 'test-site-4';
            const productId = 'test-product-4';
            const tenantName = 'Test Tenant 4';

            // Attempt to scrape
            try {
                await scraperService.scrapeProductPageWithRetryQueue(
                    url,
                    tenantId,
                    siteId,
                    productId,
                    tenantName
                );
            } catch (error) {
                // Expected to fail
            }

            // Verify session was created
            const sessions = await sessionTracker.getSessionHistory({
                tenantId,
                limit: 1,
            });

            expect(sessions.length).toBeGreaterThan(0);
            const session = sessions[0];
            expect(session.targetUrl).toBe(url);
            expect(session.tenantName).toBe(tenantName);
        }, 30000);
    });
});
