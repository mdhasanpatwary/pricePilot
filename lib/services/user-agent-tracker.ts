/**
 * User Agent Tracker Service
 * 
 * Tracks success rates per user agent to identify which user agents
 * perform best for scraping operations.
 * 
 * Requirements: 9.4
 */

import { logger } from "../logger";
import { getUserAgentInfo } from "../config/user-agents";

interface UserAgentStats {
    userAgent: string;
    browser?: string;
    os?: string;
    totalRequests: number;
    successfulRequests: number;
    failedRequests: number;
    successRate: number;
    lastUsed: Date;
}

/**
 * UserAgentTracker tracks success rates for each user agent
 * to help identify which user agents perform best
 */
export class UserAgentTracker {
    private stats: Map<string, UserAgentStats> = new Map();

    /**
     * Record a request result for a user agent
     * 
     * @param userAgent The user agent string used for the request
     * @param success Whether the request was successful
     */
    recordRequest(userAgent: string, success: boolean): void {
        let stat = this.stats.get(userAgent);

        if (!stat) {
            const info = getUserAgentInfo(userAgent);
            stat = {
                userAgent,
                browser: info?.browser,
                os: info?.os,
                totalRequests: 0,
                successfulRequests: 0,
                failedRequests: 0,
                successRate: 0,
                lastUsed: new Date(),
            };
            this.stats.set(userAgent, stat);
        }

        // Update stats
        stat.totalRequests++;
        if (success) {
            stat.successfulRequests++;
        } else {
            stat.failedRequests++;
        }
        stat.successRate = stat.totalRequests > 0
            ? stat.successfulRequests / stat.totalRequests
            : 0;
        stat.lastUsed = new Date();

        logger.debug(`[UserAgentTracker] Recorded ${success ? 'success' : 'failure'} for user agent`, {
            browser: stat.browser,
            os: stat.os,
            successRate: stat.successRate.toFixed(2),
            totalRequests: stat.totalRequests,
        });
    }

    /**
     * Get statistics for a specific user agent
     * 
     * @param userAgent The user agent string
     * @returns Statistics for the user agent, or undefined if not tracked
     */
    getStats(userAgent: string): UserAgentStats | undefined {
        return this.stats.get(userAgent);
    }

    /**
     * Get statistics for all tracked user agents
     * 
     * @returns Array of user agent statistics, sorted by success rate (descending)
     */
    getAllStats(): UserAgentStats[] {
        return Array.from(this.stats.values())
            .sort((a, b) => b.successRate - a.successRate);
    }

    /**
     * Get top performing user agents
     * 
     * @param limit Maximum number of user agents to return
     * @returns Array of top performing user agents
     */
    getTopPerformers(limit: number = 5): UserAgentStats[] {
        return this.getAllStats()
            .filter(stat => stat.totalRequests >= 10) // Only consider user agents with enough data
            .slice(0, limit);
    }

    /**
     * Get worst performing user agents
     * 
     * @param limit Maximum number of user agents to return
     * @returns Array of worst performing user agents
     */
    getWorstPerformers(limit: number = 5): UserAgentStats[] {
        return this.getAllStats()
            .filter(stat => stat.totalRequests >= 10) // Only consider user agents with enough data
            .reverse()
            .slice(0, limit);
    }

    /**
     * Get statistics grouped by browser
     * 
     * @returns Map of browser name to aggregated statistics
     */
    getStatsByBrowser(): Map<string, { totalRequests: number; successRate: number }> {
        const browserStats = new Map<string, { totalRequests: number; successfulRequests: number }>();

        for (const stat of this.stats.values()) {
            if (!stat.browser) continue;

            const existing = browserStats.get(stat.browser) || { totalRequests: 0, successfulRequests: 0 };
            existing.totalRequests += stat.totalRequests;
            existing.successfulRequests += stat.successfulRequests;
            browserStats.set(stat.browser, existing);
        }

        // Convert to success rates
        const result = new Map<string, { totalRequests: number; successRate: number }>();
        for (const [browser, stats] of browserStats.entries()) {
            result.set(browser, {
                totalRequests: stats.totalRequests,
                successRate: stats.totalRequests > 0 ? stats.successfulRequests / stats.totalRequests : 0,
            });
        }

        return result;
    }

    /**
     * Get statistics grouped by OS
     * 
     * @returns Map of OS name to aggregated statistics
     */
    getStatsByOS(): Map<string, { totalRequests: number; successRate: number }> {
        const osStats = new Map<string, { totalRequests: number; successfulRequests: number }>();

        for (const stat of this.stats.values()) {
            if (!stat.os) continue;

            const existing = osStats.get(stat.os) || { totalRequests: 0, successfulRequests: 0 };
            existing.totalRequests += stat.totalRequests;
            existing.successfulRequests += stat.successfulRequests;
            osStats.set(stat.os, existing);
        }

        // Convert to success rates
        const result = new Map<string, { totalRequests: number; successRate: number }>();
        for (const [os, stats] of osStats.entries()) {
            result.set(os, {
                totalRequests: stats.totalRequests,
                successRate: stats.totalRequests > 0 ? stats.successfulRequests / stats.totalRequests : 0,
            });
        }

        return result;
    }

    /**
     * Reset all statistics
     */
    reset(): void {
        this.stats.clear();
        logger.info('[UserAgentTracker] Statistics reset');
    }

    /**
     * Get summary of all user agent statistics
     */
    getSummary(): {
        totalUserAgents: number;
        totalRequests: number;
        overallSuccessRate: number;
        topPerformers: UserAgentStats[];
        worstPerformers: UserAgentStats[];
        byBrowser: Map<string, { totalRequests: number; successRate: number }>;
        byOS: Map<string, { totalRequests: number; successRate: number }>;
    } {
        const allStats = Array.from(this.stats.values());
        const totalRequests = allStats.reduce((sum, stat) => sum + stat.totalRequests, 0);
        const totalSuccessful = allStats.reduce((sum, stat) => sum + stat.successfulRequests, 0);

        return {
            totalUserAgents: this.stats.size,
            totalRequests,
            overallSuccessRate: totalRequests > 0 ? totalSuccessful / totalRequests : 0,
            topPerformers: this.getTopPerformers(5),
            worstPerformers: this.getWorstPerformers(5),
            byBrowser: this.getStatsByBrowser(),
            byOS: this.getStatsByOS(),
        };
    }
}

// Singleton instance
let instance: UserAgentTracker | null = null;

/**
 * Get the singleton instance of UserAgentTracker
 */
export function getUserAgentTracker(): UserAgentTracker {
    if (!instance) {
        instance = new UserAgentTracker();
    }
    return instance;
}
