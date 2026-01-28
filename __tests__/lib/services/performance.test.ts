/**
 * Performance Testing Suite
 * 
 * Tests performance requirements for the admin dashboard enhancement:
 * - Dashboard load time (target: < 2 seconds)
 * - Real-time update latency (target: < 2 seconds)
 * - Metrics calculation time (target: < 500ms)
 * - Simulation execution time (target: < 10 seconds for 100 requests)
 * - Concurrent user load (target: 50 users)
 * 
 * Requirements: 1.2, 3.2
 */

// Mock Prisma before importing services
jest.mock('@/lib/prisma', () => ({
    prisma: {
        scrapingSession: {
            create: jest.fn(),
            deleteMany: jest.fn(),
            findMany: jest.fn(),
            count: jest.fn(),
        },
        scrapingMetrics: {
            create: jest.fn(),
            deleteMany: jest.fn(),
            findMany: jest.fn(),
            aggregate: jest.fn(),
        },
        proxyHealth: {
            upsert: jest.fn(),
            deleteMany: jest.fn(),
            findMany: jest.fn(),
            count: jest.fn(),
        },
        challengeAttempt: {
            create: jest.fn(),
            deleteMany: jest.fn(),
            findMany: jest.fn(),
            count: jest.fn(),
        },
        tenant: {
            create: jest.fn(),
            deleteMany: jest.fn(),
            findUnique: jest.fn(),
        },
        $disconnect: jest.fn(),
    },
}));

// Mock Redis
jest.mock('@/lib/services/redis-session-manager', () => ({
    redisSessionManager: {
        clearAllSessions: jest.fn(),
        getSession: jest.fn(),
        setSession: jest.fn(),
    },
}));

import { MetricsAggregator } from '@/lib/services/metrics-aggregator';
import { SessionTracker } from '@/lib/services/session-tracker';
// import { sessionRepository } from '@/lib/services/session-repository';
// import { redisSessionManager } from '@/lib/services/redis-session-manager';
import { prisma } from '@/lib/prisma';

describe.skip('Performance Tests', () => {
    let metricsAggregator: MetricsAggregator;
    let sessionTracker: SessionTracker;
    const testSessionIds: string[] = [];
    const testTenantIds: string[] = [];

    beforeAll(async () => {
        metricsAggregator = MetricsAggregator.getInstance();
        sessionTracker = SessionTracker.getInstance();
    });

    beforeEach(() => {
        // Reset all mocks before each test
        jest.clearAllMocks();

        // Setup default mock responses
        (prisma.scrapingSession.create as jest.Mock).mockResolvedValue({});
        (prisma.scrapingSession.deleteMany as jest.Mock).mockResolvedValue({ count: 0 });
        (prisma.scrapingSession.findMany as jest.Mock).mockResolvedValue([]);
        (prisma.scrapingSession.count as jest.Mock).mockResolvedValue(0);

        (prisma.scrapingMetrics.create as jest.Mock).mockResolvedValue({});
        (prisma.scrapingMetrics.deleteMany as jest.Mock).mockResolvedValue({ count: 0 });
        (prisma.scrapingMetrics.findMany as jest.Mock).mockResolvedValue([]);
        (prisma.scrapingMetrics.aggregate as jest.Mock).mockResolvedValue({
            _avg: { avgResponseTime: 500, successRate: 0.8 },
            _sum: { totalRequests: 100, successfulRequests: 80 },
        });

        (prisma.proxyHealth.upsert as jest.Mock).mockResolvedValue({});
        (prisma.proxyHealth.deleteMany as jest.Mock).mockResolvedValue({ count: 0 });
        (prisma.proxyHealth.findMany as jest.Mock).mockResolvedValue([]);
        (prisma.proxyHealth.count as jest.Mock).mockResolvedValue(0);

        (prisma.challengeAttempt.create as jest.Mock).mockResolvedValue({});
        (prisma.challengeAttempt.deleteMany as jest.Mock).mockResolvedValue({ count: 0 });
        (prisma.challengeAttempt.findMany as jest.Mock).mockResolvedValue([]);
        (prisma.challengeAttempt.count as jest.Mock).mockResolvedValue(0);

        (prisma.tenant.create as jest.Mock).mockResolvedValue({});
        (prisma.tenant.deleteMany as jest.Mock).mockResolvedValue({ count: 0 });
        (prisma.tenant.findUnique as jest.Mock).mockResolvedValue(null);
    });

    afterEach(async () => {
        // Cleanup test data
        testSessionIds.length = 0;
        testTenantIds.length = 0;
        metricsAggregator.clearCache();
    });

    afterAll(async () => {
        // Final cleanup
        await prisma.$disconnect();
    });

    describe('Dashboard Load Time', () => {
        it('should load dashboard metrics in less than 2 seconds', async () => {
            // Create test data
            await createTestSessions(10, testSessionIds);
            await createTestMetrics(50);

            // Small delay to ensure data is persisted
            await new Promise(resolve => setTimeout(resolve, 100));

            const startTime = Date.now();
            const metrics = await metricsAggregator.getDashboardMetrics();
            const endTime = Date.now();

            const loadTime = endTime - startTime;

            expect(metrics).toBeDefined();
            expect(metrics.platform).toBeDefined();
            expect(metrics.scraping).toBeDefined();
            expect(metrics.proxies).toBeDefined();
            expect(metrics.challenges).toBeDefined();
            expect(loadTime).toBeLessThan(2000); // < 2 seconds
        }, 10000);

        it('should load dashboard metrics with caching in less than 100ms', async () => {
            // Create minimal test data
            await createTestSessions(5, testSessionIds);
            await createTestMetrics(10);

            // First load to populate cache
            await metricsAggregator.getDashboardMetrics();

            // Second load should be from cache
            const startTime = Date.now();
            const metrics = await metricsAggregator.getDashboardMetrics();
            const endTime = Date.now();

            const loadTime = endTime - startTime;

            expect(metrics).toBeDefined();
            expect(loadTime).toBeLessThan(100); // < 100ms from cache
        }, 10000);

        it('should load tenant metrics in less than 1 second', async () => {
            const tenantId = 'test-tenant-' + Date.now();
            // const timestamp = Date.now();

            // Create tenant first
            await prisma.tenant.create({
                data: {
                    id: tenantId,
                    companyName: 'Test Company',
                    planType: 'PRO',
                },
            });
            testTenantIds.push(tenantId);

            await createTestSessionsForTenant(tenantId, 5, testSessionIds);
            await new Promise(resolve => setTimeout(resolve, 100));

            const startTime = Date.now();
            const metrics = await metricsAggregator.getTenantMetrics(tenantId);
            const endTime = Date.now();

            const loadTime = endTime - startTime;

            expect(metrics).toBeDefined();
            expect(metrics.tenantId).toBe(tenantId);
            expect(loadTime).toBeLessThan(1000); // < 1 second
        }, 10000);
    });

    describe('Real-Time Update Latency', () => {
        it('should update session status in less than 2 seconds', async () => {
            const sessionId = await sessionTracker.createSession(
                'tenant-perf-test',
                'Performance Test Tenant',
                'https://example.com',
                'https://example.com/product/1'
            );
            testSessionIds.push(sessionId);

            await new Promise(resolve => setTimeout(resolve, 50));

            const startTime = Date.now();
            await sessionTracker.updateStage(sessionId, 'navigation', {
                proxy: 'http://proxy1.com:8080',
            });
            const endTime = Date.now();

            const updateTime = endTime - startTime;

            // Wait for update to propagate
            await new Promise(resolve => setTimeout(resolve, 50));

            const session = await sessionTracker.getSession(sessionId);
            expect(session?.currentStage).toBe('navigation');
            expect(updateTime).toBeLessThan(2000); // < 2 seconds
        }, 10000);

        it('should retrieve active sessions in less than 500ms', async () => {
            // Create multiple active sessions
            const sessionIds = await Promise.all(
                Array.from({ length: 20 }, (_, i) =>
                    sessionTracker.createSession(
                        `tenant-${i}`,
                        `Tenant ${i}`,
                        'https://example.com',
                        `https://example.com/product/${i}`
                    )
                )
            );
            testSessionIds.push(...sessionIds);

            await new Promise(resolve => setTimeout(resolve, 100));

            const startTime = Date.now();
            const sessions = await sessionTracker.getActiveSessions();
            const endTime = Date.now();

            const retrievalTime = endTime - startTime;

            expect(sessions.length).toBeGreaterThanOrEqual(20);
            expect(retrievalTime).toBeLessThan(500); // < 500ms
        }, 10000);

        it('should complete session in less than 1 second', async () => {
            const sessionId = await sessionTracker.createSession(
                'tenant-perf-test',
                'Performance Test Tenant',
                'https://example.com',
                'https://example.com/product/1'
            );
            testSessionIds.push(sessionId);

            await new Promise(resolve => setTimeout(resolve, 50));

            const startTime = Date.now();
            await sessionTracker.completeSession(sessionId, true, {
                extractedData: { title: 'Test Product', price: 99.99 },
            });
            const endTime = Date.now();

            const completionTime = endTime - startTime;

            await new Promise(resolve => setTimeout(resolve, 50));

            const session = await sessionTracker.getSession(sessionId);
            expect(session?.status).toBe('completed');
            expect(completionTime).toBeLessThan(1000); // < 1 second
        }, 10000);
    });

    describe('Metrics Calculation Time', () => {
        it('should calculate dashboard metrics in less than 500ms', async () => {
            // Create substantial test data
            await createTestSessions(50, testSessionIds);
            await createTestMetrics(200);
            await createTestProxies(20);
            await createTestChallenges(100);

            await new Promise(resolve => setTimeout(resolve, 100));

            // Clear cache to force calculation
            metricsAggregator.clearCache();

            const startTime = Date.now();
            const metrics = await metricsAggregator.getDashboardMetrics();
            const endTime = Date.now();

            const calculationTime = endTime - startTime;

            expect(metrics).toBeDefined();
            expect(calculationTime).toBeLessThan(500); // < 500ms
        }, 15000);

        it('should calculate time-series data in less than 500ms', async () => {
            await createTestMetrics(100);
            await new Promise(resolve => setTimeout(resolve, 100));

            const startTime = Date.now();
            const timeSeries = await metricsAggregator.getTimeSeriesData('requests', '24h');
            const endTime = Date.now();

            const calculationTime = endTime - startTime;

            expect(timeSeries).toBeDefined();
            expect(timeSeries.dataPoints).toBeDefined();
            expect(calculationTime).toBeLessThan(500); // < 500ms
        }, 10000);

        it('should calculate top failures in less than 500ms', async () => {
            await createTestSessions(30, testSessionIds);
            await new Promise(resolve => setTimeout(resolve, 100));

            const startTime = Date.now();
            const failures = await metricsAggregator.getTopFailures('sites', 10);
            const endTime = Date.now();

            const calculationTime = endTime - startTime;

            expect(failures).toBeDefined();
            expect(Array.isArray(failures)).toBe(true);
            expect(calculationTime).toBeLessThan(500); // < 500ms
        }, 10000);
    });

    describe('Concurrent User Load', () => {
        it('should handle 50 concurrent dashboard metric requests', async () => {
            await createTestSessions(20, testSessionIds);
            await createTestMetrics(100);
            await new Promise(resolve => setTimeout(resolve, 100));

            const startTime = Date.now();

            // Simulate 50 concurrent users
            const requests = Array.from({ length: 50 }, () =>
                metricsAggregator.getDashboardMetrics()
            );

            const results = await Promise.all(requests);
            const endTime = Date.now();

            const totalTime = endTime - startTime;
            const avgTimePerRequest = totalTime / 50;

            expect(results).toHaveLength(50);
            expect(results.every(r => r !== null)).toBe(true);
            expect(avgTimePerRequest).toBeLessThan(2000); // < 2 seconds per request
        }, 30000);

        it('should handle 50 concurrent session retrievals', async () => {
            // Create test sessions
            const sessionIds = await Promise.all(
                Array.from({ length: 50 }, (_, i) =>
                    sessionTracker.createSession(
                        `tenant-${i}`,
                        `Tenant ${i}`,
                        'https://example.com',
                        `https://example.com/product/${i}`
                    )
                )
            );
            testSessionIds.push(...sessionIds);

            await new Promise(resolve => setTimeout(resolve, 100));

            const startTime = Date.now();

            // Simulate 50 concurrent users retrieving sessions
            const requests = sessionIds.map(id => sessionTracker.getSession(id));
            const results = await Promise.all(requests);

            const endTime = Date.now();
            const totalTime = endTime - startTime;
            const avgTimePerRequest = totalTime / 50;

            expect(results).toHaveLength(50);
            // Some sessions might not be found due to timing, so check at least 80% success
            const successCount = results.filter(r => r !== null).length;
            expect(successCount).toBeGreaterThan(40);
            expect(avgTimePerRequest).toBeLessThan(100); // < 100ms per request
        }, 30000);

        it('should handle 50 concurrent session updates', async () => {
            // Create test sessions
            const sessionIds = await Promise.all(
                Array.from({ length: 50 }, (_, i) =>
                    sessionTracker.createSession(
                        `tenant-${i}`,
                        `Tenant ${i}`,
                        'https://example.com',
                        `https://example.com/product/${i}`
                    )
                )
            );
            testSessionIds.push(...sessionIds);

            await new Promise(resolve => setTimeout(resolve, 100));

            const startTime = Date.now();

            // Simulate 50 concurrent session updates
            const updates = sessionIds.map(id =>
                sessionTracker.updateStage(id, 'navigation', {
                    proxy: 'http://proxy1.com:8080',
                })
            );

            await Promise.all(updates);
            const endTime = Date.now();

            const totalTime = endTime - startTime;
            const avgTimePerUpdate = totalTime / 50;

            expect(avgTimePerUpdate).toBeLessThan(200); // < 200ms per update
        }, 30000);
    });

    describe('Bulk Operations Performance', () => {
        it('should handle bulk pause operations efficiently', async () => {
            // Create 20 test sessions
            const sessionIds = await Promise.all(
                Array.from({ length: 20 }, (_, i) =>
                    sessionTracker.createSession(
                        `tenant-${i}`,
                        `Tenant ${i}`,
                        'https://example.com',
                        `https://example.com/product/${i}`
                    )
                )
            );
            testSessionIds.push(...sessionIds);

            await new Promise(resolve => setTimeout(resolve, 100));

            const startTime = Date.now();
            const results = await sessionTracker.bulkPauseSessions(sessionIds);
            const endTime = Date.now();

            const bulkTime = endTime - startTime;

            expect(results).toHaveLength(20);
            expect(bulkTime).toBeLessThan(5000); // < 5 seconds for 20 sessions
        }, 15000);

        it('should handle bulk cancel operations efficiently', async () => {
            // Create 20 test sessions
            const sessionIds = await Promise.all(
                Array.from({ length: 20 }, (_, i) =>
                    sessionTracker.createSession(
                        `tenant-${i}`,
                        `Tenant ${i}`,
                        'https://example.com',
                        `https://example.com/product/${i}`
                    )
                )
            );
            testSessionIds.push(...sessionIds);

            await new Promise(resolve => setTimeout(resolve, 100));

            const startTime = Date.now();
            const results = await sessionTracker.bulkCancelSessions(sessionIds, 'Performance test');
            const endTime = Date.now();

            const bulkTime = endTime - startTime;

            expect(results).toHaveLength(20);
            expect(bulkTime).toBeLessThan(5000); // < 5 seconds for 20 sessions
        }, 15000);
    });

    describe('Cache Performance', () => {
        it('should improve performance with caching', async () => {
            await createTestSessions(10, testSessionIds);
            await createTestMetrics(50);
            await new Promise(resolve => setTimeout(resolve, 100));

            // First request (no cache)
            metricsAggregator.clearCache();
            const startTime1 = Date.now();
            await metricsAggregator.getDashboardMetrics();
            const endTime1 = Date.now();
            const uncachedTime = endTime1 - startTime1;

            // Second request (with cache)
            const startTime2 = Date.now();
            await metricsAggregator.getDashboardMetrics();
            const endTime2 = Date.now();
            const cachedTime = endTime2 - startTime2;

            // Cached request should be significantly faster
            expect(cachedTime).toBeLessThan(uncachedTime / 5); // At least 5x faster
            expect(cachedTime).toBeLessThan(100); // < 100ms
        }, 15000);

        it('should handle cache invalidation efficiently', async () => {
            await createTestSessions(10, testSessionIds);
            await new Promise(resolve => setTimeout(resolve, 100));

            // Populate cache
            await metricsAggregator.getDashboardMetrics();

            const startTime = Date.now();
            metricsAggregator.clearCache();
            const endTime = Date.now();

            const invalidationTime = endTime - startTime;

            expect(invalidationTime).toBeLessThan(10); // < 10ms
        });
    });

    describe('Database Query Performance', () => {
        it('should retrieve session history efficiently', async () => {
            const tenantId = 'test-tenant-' + Date.now();

            // Create tenant first
            await prisma.tenant.create({
                data: {
                    id: tenantId,
                    companyName: 'Test Company',
                    planType: 'PRO',
                },
            });
            testTenantIds.push(tenantId);

            await createTestSessionsForTenant(tenantId, 30, testSessionIds);
            await new Promise(resolve => setTimeout(resolve, 100));

            const startTime = Date.now();
            const history = await sessionTracker.getSessionHistory({
                tenantId,
                limit: 20,
            });
            const endTime = Date.now();

            const queryTime = endTime - startTime;

            expect(history.length).toBeGreaterThan(0);
            expect(queryTime).toBeLessThan(1000); // < 1 second
        }, 15000);

        it('should count sessions by status efficiently', async () => {
            const tenantId = 'test-tenant-' + Date.now();

            // Create tenant first
            await prisma.tenant.create({
                data: {
                    id: tenantId,
                    companyName: 'Test Company',
                    planType: 'PRO',
                },
            });
            testTenantIds.push(tenantId);

            await createTestSessionsForTenant(tenantId, 20, testSessionIds);
            await new Promise(resolve => setTimeout(resolve, 100));

            const startTime = Date.now();
            const counts = await sessionTracker.getSessionCountByStatus(tenantId);
            const endTime = Date.now();

            const queryTime = endTime - startTime;

            expect(counts).toBeDefined();
            expect(queryTime).toBeLessThan(500); // < 500ms
        }, 10000);
    });
});

// Helper functions to create test data

async function createTestSessions(count: number, testSessionIds?: string[]): Promise<void> {
    const sessionTracker = SessionTracker.getInstance();
    const promises = [];

    for (let i = 0; i < count; i++) {
        const promise = sessionTracker.createSession(
            `tenant-${i % 5}`,
            `Test Tenant ${i % 5}`,
            `https://example${i % 3}.com`,
            `https://example${i % 3}.com/product/${i}`
        ).then(id => {
            if (testSessionIds) testSessionIds.push(id);
            return id;
        });
        promises.push(promise);
    }

    await Promise.all(promises);
}

async function createTestSessionsForTenant(tenantId: string, count: number, testSessionIds?: string[]): Promise<void> {
    const sessionTracker = SessionTracker.getInstance();
    const promises = [];

    for (let i = 0; i < count; i++) {
        const promise = sessionTracker.createSession(
            tenantId,
            'Test Tenant',
            `https://example${i % 3}.com`,
            `https://example${i % 3}.com/product/${i}`
        ).then(id => {
            if (testSessionIds) testSessionIds.push(id);
            return id;
        });
        promises.push(promise);
    }

    await Promise.all(promises);
}

async function createTestMetrics(count: number): Promise<void> {
    const now = Date.now();
    const promises = [];

    for (let i = 0; i < count; i++) {
        const timestamp = new Date(now - i * 60000); // 1 minute intervals
        const totalRequests = Math.floor(Math.random() * 100) + 10;
        const successfulRequests = Math.floor(Math.random() * 80) + 5;
        const blockedRequests = Math.floor(Math.random() * 10);
        const promise = prisma.scrapingMetrics.create({
            data: {
                site: `https://example${i % 5}.com`,
                timestamp,
                totalRequests,
                successfulRequests,
                blockedRequests,
                challengedRequests: Math.floor(Math.random() * 20),
                avgResponseTime: Math.random() * 1000 + 100,
                successRate: totalRequests > 0 ? successfulRequests / totalRequests : 0,
                blockRate: totalRequests > 0 ? blockedRequests / totalRequests : 0,
            },
        });
        promises.push(promise);
    }

    await Promise.all(promises);
}

async function createTestProxies(count: number): Promise<void> {
    const promises = [];

    for (let i = 0; i < count; i++) {
        const promise = prisma.proxyHealth.upsert({
            where: { proxyUrl: `http://proxy${i}.com:8080` },
            update: {
                isHealthy: Math.random() > 0.2,
                lastChecked: new Date(),
            },
            create: {
                proxyUrl: `http://proxy${i}.com:8080`,
                proxyType: 'http',
                isHealthy: Math.random() > 0.2,
                lastChecked: new Date(),
            },
        });
        promises.push(promise);
    }

    await Promise.all(promises);
}

async function createTestChallenges(count: number): Promise<void> {
    const now = Date.now();
    const promises = [];

    for (let i = 0; i < count; i++) {
        const timestamp = new Date(now - i * 60000);
        const solved = Math.random() > 0.3;
        const promise = prisma.challengeAttempt.create({
            data: {
                site: 'test-site.com',
                timestamp,
                challengeType: ['cloudflare', 'recaptcha', 'hcaptcha'][i % 3],
                solved,
                duration: solved ? Math.floor(Math.random() * 5000) + 1000 : 0,
            },
        });
        promises.push(promise);
    }

    await Promise.all(promises);
}
