/**
 * Tests for UserAgentTracker service
 * 
 * Requirements: 9.4
 */

import { UserAgentTracker, getUserAgentTracker } from '@/lib/services/user-agent-tracker';
import { USER_AGENTS } from '@/lib/config/user-agents';

describe('UserAgentTracker', () => {
    let tracker: UserAgentTracker;

    beforeEach(() => {
        tracker = new UserAgentTracker();
    });

    describe('recordRequest', () => {
        it('should record successful requests', () => {
            const userAgent = USER_AGENTS[0].userAgent;

            tracker.recordRequest(userAgent, true);

            const stats = tracker.getStats(userAgent);
            expect(stats).toBeDefined();
            expect(stats?.totalRequests).toBe(1);
            expect(stats?.successfulRequests).toBe(1);
            expect(stats?.failedRequests).toBe(0);
            expect(stats?.successRate).toBe(1);
        });

        it('should record failed requests', () => {
            const userAgent = USER_AGENTS[0].userAgent;

            tracker.recordRequest(userAgent, false);

            const stats = tracker.getStats(userAgent);
            expect(stats).toBeDefined();
            expect(stats?.totalRequests).toBe(1);
            expect(stats?.successfulRequests).toBe(0);
            expect(stats?.failedRequests).toBe(1);
            expect(stats?.successRate).toBe(0);
        });

        it('should calculate success rate correctly', () => {
            const userAgent = USER_AGENTS[0].userAgent;

            // Record 3 successes and 1 failure
            tracker.recordRequest(userAgent, true);
            tracker.recordRequest(userAgent, true);
            tracker.recordRequest(userAgent, true);
            tracker.recordRequest(userAgent, false);

            const stats = tracker.getStats(userAgent);
            expect(stats).toBeDefined();
            expect(stats?.totalRequests).toBe(4);
            expect(stats?.successfulRequests).toBe(3);
            expect(stats?.failedRequests).toBe(1);
            expect(stats?.successRate).toBe(0.75);
        });

        it('should track browser and OS information', () => {
            const userAgent = USER_AGENTS[0].userAgent;

            tracker.recordRequest(userAgent, true);

            const stats = tracker.getStats(userAgent);
            expect(stats).toBeDefined();
            expect(stats?.browser).toBe('Chrome');
            expect(stats?.os).toBe('Windows');
        });

        it('should update lastUsed timestamp', () => {
            const userAgent = USER_AGENTS[0].userAgent;
            const beforeTime = new Date();

            tracker.recordRequest(userAgent, true);

            const stats = tracker.getStats(userAgent);
            expect(stats).toBeDefined();
            expect(stats?.lastUsed.getTime()).toBeGreaterThanOrEqual(beforeTime.getTime());
        });
    });

    describe('getAllStats', () => {
        it('should return all tracked user agents sorted by success rate', () => {
            const ua1 = USER_AGENTS[0].userAgent;
            const ua2 = USER_AGENTS[1].userAgent;

            // UA1: 50% success rate
            tracker.recordRequest(ua1, true);
            tracker.recordRequest(ua1, false);

            // UA2: 100% success rate
            tracker.recordRequest(ua2, true);
            tracker.recordRequest(ua2, true);

            const allStats = tracker.getAllStats();
            expect(allStats).toHaveLength(2);
            expect(allStats[0].userAgent).toBe(ua2); // Higher success rate first
            expect(allStats[0].successRate).toBe(1);
            expect(allStats[1].userAgent).toBe(ua1);
            expect(allStats[1].successRate).toBe(0.5);
        });
    });

    describe('getTopPerformers', () => {
        it('should return top performing user agents', () => {
            // Record enough requests to meet the minimum threshold (10)
            const ua1 = USER_AGENTS[0].userAgent;
            const ua2 = USER_AGENTS[1].userAgent;

            // UA1: 90% success rate (9/10)
            for (let i = 0; i < 9; i++) {
                tracker.recordRequest(ua1, true);
            }
            tracker.recordRequest(ua1, false);

            // UA2: 80% success rate (8/10)
            for (let i = 0; i < 8; i++) {
                tracker.recordRequest(ua2, true);
            }
            for (let i = 0; i < 2; i++) {
                tracker.recordRequest(ua2, false);
            }

            const topPerformers = tracker.getTopPerformers(5);
            expect(topPerformers.length).toBeGreaterThan(0);
            expect(topPerformers[0].userAgent).toBe(ua1);
            expect(topPerformers[0].successRate).toBeCloseTo(0.9);
        });

        it('should only include user agents with at least 10 requests', () => {
            const ua1 = USER_AGENTS[0].userAgent;

            // Only 5 requests - should not be included
            for (let i = 0; i < 5; i++) {
                tracker.recordRequest(ua1, true);
            }

            const topPerformers = tracker.getTopPerformers(5);
            expect(topPerformers).toHaveLength(0);
        });
    });

    describe('getStatsByBrowser', () => {
        it('should aggregate statistics by browser', () => {
            // Record requests for different Chrome user agents
            const chromeUA1 = USER_AGENTS.find(ua => ua.browser === 'Chrome' && ua.os === 'Windows')!.userAgent;
            const chromeUA2 = USER_AGENTS.find(ua => ua.browser === 'Chrome' && ua.os === 'macOS')!.userAgent;

            tracker.recordRequest(chromeUA1, true);
            tracker.recordRequest(chromeUA1, false);
            tracker.recordRequest(chromeUA2, true);
            tracker.recordRequest(chromeUA2, true);

            const statsByBrowser = tracker.getStatsByBrowser();
            const chromeStats = statsByBrowser.get('Chrome');

            expect(chromeStats).toBeDefined();
            expect(chromeStats?.totalRequests).toBe(4);
            expect(chromeStats?.successRate).toBe(0.75); // 3 successes out of 4
        });
    });

    describe('getStatsByOS', () => {
        it('should aggregate statistics by OS', () => {
            // Record requests for different Windows user agents
            const windowsUA1 = USER_AGENTS.find(ua => ua.os === 'Windows' && ua.browser === 'Chrome')!.userAgent;
            const windowsUA2 = USER_AGENTS.find(ua => ua.os === 'Windows' && ua.browser === 'Firefox')!.userAgent;

            tracker.recordRequest(windowsUA1, true);
            tracker.recordRequest(windowsUA1, true);
            tracker.recordRequest(windowsUA2, true);
            tracker.recordRequest(windowsUA2, false);

            const statsByOS = tracker.getStatsByOS();
            const windowsStats = statsByOS.get('Windows');

            expect(windowsStats).toBeDefined();
            expect(windowsStats?.totalRequests).toBe(4);
            expect(windowsStats?.successRate).toBe(0.75); // 3 successes out of 4
        });
    });

    describe('getSummary', () => {
        it('should return comprehensive summary', () => {
            const ua1 = USER_AGENTS[0].userAgent;
            const ua2 = USER_AGENTS[1].userAgent;

            // Record enough requests for meaningful stats
            for (let i = 0; i < 10; i++) {
                tracker.recordRequest(ua1, true);
            }
            for (let i = 0; i < 5; i++) {
                tracker.recordRequest(ua2, true);
            }
            for (let i = 0; i < 5; i++) {
                tracker.recordRequest(ua2, false);
            }

            const summary = tracker.getSummary();

            expect(summary.totalUserAgents).toBe(2);
            expect(summary.totalRequests).toBe(20);
            expect(summary.overallSuccessRate).toBe(0.75); // 15 successes out of 20
            expect(summary.topPerformers.length).toBeGreaterThan(0);
            expect(summary.byBrowser.size).toBeGreaterThan(0);
            expect(summary.byOS.size).toBeGreaterThan(0);
        });
    });

    describe('reset', () => {
        it('should clear all statistics', () => {
            const userAgent = USER_AGENTS[0].userAgent;

            tracker.recordRequest(userAgent, true);
            expect(tracker.getStats(userAgent)).toBeDefined();

            tracker.reset();
            expect(tracker.getStats(userAgent)).toBeUndefined();
        });
    });

    describe('getUserAgentTracker singleton', () => {
        it('should return the same instance', () => {
            const instance1 = getUserAgentTracker();
            const instance2 = getUserAgentTracker();

            expect(instance1).toBe(instance2);
        });
    });
});
