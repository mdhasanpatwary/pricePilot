import { ConcurrencyLimiter, SiteMetrics } from '@/lib/services/concurrency-limiter';

describe('ConcurrencyLimiter', () => {
    let limiter: ConcurrencyLimiter;

    beforeEach(() => {
        limiter = new ConcurrencyLimiter({
            minConcurrency: 1,
            maxConcurrency: 10,
            initialConcurrency: 3,
        });
    });

    afterEach(() => {
        limiter.resetAll();
    });

    describe('Constructor', () => {
        it('should initialize with default config', () => {
            const defaultLimiter = new ConcurrencyLimiter();
            expect(defaultLimiter.getCurrentConcurrency('test.com')).toBe(3);
        });

        it('should initialize with custom config', () => {
            const customLimiter = new ConcurrencyLimiter({
                minConcurrency: 2,
                maxConcurrency: 20,
                initialConcurrency: 5,
            });
            expect(customLimiter.getCurrentConcurrency('test.com')).toBe(5);
        });

        it('should throw error if minConcurrency < 1', () => {
            expect(() => {
                new ConcurrencyLimiter({ minConcurrency: 0 });
            }).toThrow('minConcurrency must be at least 1');
        });

        it('should throw error if maxConcurrency < minConcurrency', () => {
            expect(() => {
                new ConcurrencyLimiter({ minConcurrency: 5, maxConcurrency: 3 });
            }).toThrow('maxConcurrency must be >= minConcurrency');
        });

        it('should throw error if initialConcurrency out of bounds', () => {
            expect(() => {
                new ConcurrencyLimiter({ minConcurrency: 2, maxConcurrency: 10, initialConcurrency: 15 });
            }).toThrow('initialConcurrency must be between minConcurrency and maxConcurrency');
        });
    });

    describe('Slot Acquisition and Release', () => {
        it('should acquire slot when under limit', async () => {
            await limiter.acquireSlot('test.com');
            expect(limiter.getActiveRequests('test.com')).toBe(1);
        });

        it('should release slot correctly', async () => {
            await limiter.acquireSlot('test.com');
            limiter.releaseSlot('test.com');
            expect(limiter.getActiveRequests('test.com')).toBe(0);
        });

        it('should queue requests when limit reached', async () => {
            // Acquire 3 slots (initial concurrency)
            await limiter.acquireSlot('test.com');
            await limiter.acquireSlot('test.com');
            await limiter.acquireSlot('test.com');

            expect(limiter.getActiveRequests('test.com')).toBe(3);

            // Fourth request should be queued
            const promise = limiter.acquireSlot('test.com');

            // Wait a bit to ensure it's queued
            await new Promise(resolve => setTimeout(resolve, 10));

            expect(limiter.getQueuedRequests('test.com')).toBe(1);

            // Release one slot to process queued request
            limiter.releaseSlot('test.com');

            // Wait for queued request to be processed
            await promise;

            expect(limiter.getActiveRequests('test.com')).toBe(3);
            expect(limiter.getQueuedRequests('test.com')).toBe(0);
        });

        it('should handle multiple sites independently', async () => {
            await limiter.acquireSlot('site1.com');
            await limiter.acquireSlot('site2.com');

            expect(limiter.getActiveRequests('site1.com')).toBe(1);
            expect(limiter.getActiveRequests('site2.com')).toBe(1);

            limiter.releaseSlot('site1.com');

            expect(limiter.getActiveRequests('site1.com')).toBe(0);
            expect(limiter.getActiveRequests('site2.com')).toBe(1);
        });
    });

    describe('Dynamic Concurrency Adjustment', () => {
        it('should reduce concurrency when block rate > 20%', () => {
            const metrics: SiteMetrics = {
                blockRate: 0.25,
                successRate: 0.75,
                avgResponseTime: 1000,
                recentRequests: 100,
            };

            limiter.adjustConcurrency('test.com', metrics);

            // Should reduce from 3 to 1 (50% reduction, rounded down)
            expect(limiter.getCurrentConcurrency('test.com')).toBe(1);
        });

        it('should increase concurrency when success rate > 80% and fast responses', () => {
            const metrics: SiteMetrics = {
                blockRate: 0.05,
                successRate: 0.85,
                avgResponseTime: 1500,
                recentRequests: 100,
            };

            limiter.adjustConcurrency('test.com', metrics);

            // Should increase from 3 to 4 (10% increase, rounded up)
            expect(limiter.getCurrentConcurrency('test.com')).toBe(4);
        });

        it('should not adjust if conditions not met', () => {
            const metrics: SiteMetrics = {
                blockRate: 0.15,
                successRate: 0.75,
                avgResponseTime: 1500,
                recentRequests: 100,
            };

            limiter.adjustConcurrency('test.com', metrics);

            // Should remain at 3
            expect(limiter.getCurrentConcurrency('test.com')).toBe(3);
        });

        it('should enforce minimum concurrency bound', () => {
            const metrics: SiteMetrics = {
                blockRate: 0.5,
                successRate: 0.5,
                avgResponseTime: 3000,
                recentRequests: 100,
            };

            // Reduce multiple times
            limiter.adjustConcurrency('test.com', metrics);
            limiter.adjustConcurrency('test.com', metrics);
            limiter.adjustConcurrency('test.com', metrics);

            // Should not go below 1
            expect(limiter.getCurrentConcurrency('test.com')).toBe(1);
        });

        it('should enforce maximum concurrency bound', () => {
            const metrics: SiteMetrics = {
                blockRate: 0.01,
                successRate: 0.95,
                avgResponseTime: 500,
                recentRequests: 100,
            };

            // Increase multiple times
            for (let i = 0; i < 20; i++) {
                limiter.adjustConcurrency('test.com', metrics);
            }

            // Should not go above 10
            expect(limiter.getCurrentConcurrency('test.com')).toBe(10);
        });

        it('should not increase if response time is slow', () => {
            const metrics: SiteMetrics = {
                blockRate: 0.05,
                successRate: 0.85,
                avgResponseTime: 3000, // Slow response time
                recentRequests: 100,
            };

            limiter.adjustConcurrency('test.com', metrics);

            // Should remain at 3 (no increase due to slow responses)
            expect(limiter.getCurrentConcurrency('test.com')).toBe(3);
        });
    });

    describe('Immediate Reduction', () => {
        it('should immediately reduce concurrency by 50%', () => {
            limiter.reduceImmediately('test.com', 'HTTP 429 Rate Limit');

            // Should reduce from 3 to 1 (50% reduction, rounded down)
            expect(limiter.getCurrentConcurrency('test.com')).toBe(1);
        });

        it('should respect minimum bound on immediate reduction', () => {
            limiter.reduceImmediately('test.com', 'HTTP 429 Rate Limit');
            limiter.reduceImmediately('test.com', 'HTTP 429 Rate Limit');

            // Should not go below 1
            expect(limiter.getCurrentConcurrency('test.com')).toBe(1);
        });
    });

    describe('Statistics', () => {
        it('should return correct stats for a site', async () => {
            await limiter.acquireSlot('test.com');
            await limiter.acquireSlot('test.com');

            const stats = limiter.getStats();
            const siteStats = stats.get('test.com');

            expect(siteStats).toBeDefined();
            expect(siteStats?.currentConcurrency).toBe(3);
            expect(siteStats?.activeRequests).toBe(2);
            expect(siteStats?.queuedRequests).toBe(0);
        });

        it('should return stats for multiple sites', async () => {
            await limiter.acquireSlot('site1.com');
            await limiter.acquireSlot('site2.com');

            const stats = limiter.getStats();

            expect(stats.size).toBe(2);
            expect(stats.get('site1.com')).toBeDefined();
            expect(stats.get('site2.com')).toBeDefined();
        });
    });

    describe('Reset', () => {
        it('should reset state for a specific site', async () => {
            await limiter.acquireSlot('test.com');
            limiter.resetSite('test.com');

            expect(limiter.getActiveRequests('test.com')).toBe(0);
            expect(limiter.getCurrentConcurrency('test.com')).toBe(3); // Back to initial
        });

        it('should reset all sites', async () => {
            await limiter.acquireSlot('site1.com');
            await limiter.acquireSlot('site2.com');

            limiter.resetAll();

            const stats = limiter.getStats();
            expect(stats.size).toBe(0);
        });
    });
});
