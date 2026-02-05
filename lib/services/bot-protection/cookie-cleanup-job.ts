/**
 * Cookie Cleanup Job
 * 
 * Periodic job to remove expired cookies and clean up stale sessions.
 * Maintains session hygiene and prevents accumulation of outdated session data.
 * 
 * Requirements: 5.4
 */

import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';

export interface CleanupConfig {
    /**
     * Remove sessions that haven't been used in this many days
     */
    staleSessionDays: number;

    /**
     * Batch size for processing sessions
     */
    batchSize: number;
}

const DEFAULT_CONFIG: CleanupConfig = {
    staleSessionDays: 7,
    batchSize: 100,
};

export interface CookieCleanupResult {
    expiredSessionsDeleted: number;
    staleSessionsDeleted: number;
    totalCookiesRemoved: number;
    errors: string[];
    executedAt: Date;
    durationMs: number;
}

export class CookieCleanupJob {
    private config: CleanupConfig;

    constructor(config?: Partial<CleanupConfig>) {
        this.config = { ...DEFAULT_CONFIG, ...config };
    }

    /**
     * Execute cookie cleanup job
     * 
     * Removes expired cookies and stale sessions from the database.
     */
    async execute(): Promise<CookieCleanupResult> {
        const startTime = Date.now();
        const errors: string[] = [];

        let expiredSessionsDeleted = 0;
        let staleSessionsDeleted = 0;
        let totalCookiesRemoved = 0;

        try {
            logger.info('Starting cookie cleanup job');

            // Step 1: Delete expired sessions
            const expiredResult = await this.deleteExpiredSessions();
            expiredSessionsDeleted = expiredResult.deleted;
            totalCookiesRemoved += expiredResult.cookiesRemoved;

            if (expiredResult.error) {
                errors.push(expiredResult.error);
            }

            // Step 2: Delete stale sessions (not used recently)
            const staleResult = await this.deleteStaleSessions();
            staleSessionsDeleted = staleResult.deleted;
            totalCookiesRemoved += staleResult.cookiesRemoved;

            if (staleResult.error) {
                errors.push(staleResult.error);
            }

            logger.info('Cookie cleanup job completed', {
                expiredSessionsDeleted,
                staleSessionsDeleted,
                totalCookiesRemoved,
                errors: errors.length,
            });
        } catch (error) {
            const errorMsg = `Cookie cleanup job failed: ${error instanceof Error ? error.message : String(error)
                }`;
            errors.push(errorMsg);
            logger.error(errorMsg);
        }

        const durationMs = Date.now() - startTime;

        return {
            expiredSessionsDeleted,
            staleSessionsDeleted,
            totalCookiesRemoved,
            errors,
            executedAt: new Date(),
            durationMs,
        };
    }

    /**
     * Delete sessions that have expired based on expiresAt timestamp
     */
    private async deleteExpiredSessions(): Promise<{
        deleted: number;
        cookiesRemoved: number;
        error?: string;
    }> {
        try {
            const now = new Date();

            // Get expired sessions to count cookies
            const expiredSessions = await prisma.scrapingCookieJar.findMany({
                where: {
                    expiresAt: {
                        lt: now,
                    },
                },
                select: {
                    id: true,
                    cookies: true,
                },
                take: this.config.batchSize,
            });

            if (expiredSessions.length === 0) {
                logger.debug('No expired sessions found');
                return { deleted: 0, cookiesRemoved: 0 };
            }

            // Count cookies
            let cookiesRemoved = 0;
            for (const session of expiredSessions) {
                const cookies = session.cookies as any[];
                if (Array.isArray(cookies)) {
                    cookiesRemoved += cookies.length;
                }
            }

            // Delete expired sessions
            const result = await prisma.scrapingCookieJar.deleteMany({
                where: {
                    expiresAt: {
                        lt: now,
                    },
                },
            });

            logger.info('Deleted expired sessions', {
                count: result.count,
                cookiesRemoved,
            });

            return {
                deleted: result.count,
                cookiesRemoved,
            };
        } catch (error) {
            const errorMsg = `Failed to delete expired sessions: ${error instanceof Error ? error.message : String(error)
                }`;
            logger.error(errorMsg);
            return {
                deleted: 0,
                cookiesRemoved: 0,
                error: errorMsg,
            };
        }
    }

    /**
     * Delete sessions that haven't been updated recently (stale)
     */
    private async deleteStaleSessions(): Promise<{
        deleted: number;
        cookiesRemoved: number;
        error?: string;
    }> {
        try {
            const staleThreshold = new Date();
            staleThreshold.setDate(staleThreshold.getDate() - this.config.staleSessionDays);

            // Get stale sessions to count cookies
            const staleSessions = await prisma.scrapingCookieJar.findMany({
                where: {
                    updatedAt: {
                        lt: staleThreshold,
                    },
                },
                select: {
                    id: true,
                    cookies: true,
                },
                take: this.config.batchSize,
            });

            if (staleSessions.length === 0) {
                logger.debug('No stale sessions found');
                return { deleted: 0, cookiesRemoved: 0 };
            }

            // Count cookies
            let cookiesRemoved = 0;
            for (const session of staleSessions) {
                const cookies = session.cookies as any[];
                if (Array.isArray(cookies)) {
                    cookiesRemoved += cookies.length;
                }
            }

            // Delete stale sessions
            const result = await prisma.scrapingCookieJar.deleteMany({
                where: {
                    updatedAt: {
                        lt: staleThreshold,
                    },
                },
            });

            logger.info('Deleted stale sessions', {
                count: result.count,
                cookiesRemoved,
                staleThresholdDays: this.config.staleSessionDays,
            });

            return {
                deleted: result.count,
                cookiesRemoved,
            };
        } catch (error) {
            const errorMsg = `Failed to delete stale sessions: ${error instanceof Error ? error.message : String(error)
                }`;
            logger.error(errorMsg);
            return {
                deleted: 0,
                cookiesRemoved: 0,
                error: errorMsg,
            };
        }
    }

    /**
     * Get cleanup statistics
     * 
     * Returns counts of sessions eligible for cleanup without actually deleting them.
     */
    async getCleanupStatistics(): Promise<{
        expiredSessions: number;
        staleSessions: number;
        totalSessions: number;
        estimatedCookies: number;
    }> {
        const now = new Date();
        const staleThreshold = new Date();
        staleThreshold.setDate(staleThreshold.getDate() - this.config.staleSessionDays);

        const [expiredCount, staleCount, totalCount, allSessions] = await Promise.all([
            prisma.scrapingCookieJar.count({
                where: {
                    expiresAt: {
                        lt: now,
                    },
                },
            }),
            prisma.scrapingCookieJar.count({
                where: {
                    updatedAt: {
                        lt: staleThreshold,
                    },
                },
            }),
            prisma.scrapingCookieJar.count(),
            prisma.scrapingCookieJar.findMany({
                select: {
                    cookies: true,
                },
            }),
        ]);

        // Estimate total cookies
        let estimatedCookies = 0;
        for (const session of allSessions) {
            const cookies = session.cookies as any[];
            if (Array.isArray(cookies)) {
                estimatedCookies += cookies.length;
            }
        }

        return {
            expiredSessions: expiredCount,
            staleSessions: staleCount,
            totalSessions: totalCount,
            estimatedCookies,
        };
    }

    /**
     * Clean up cookies for a specific competitor website
     * 
     * Useful for manual cleanup or when a site's scraping strategy changes.
     */
    async cleanupWebsiteSessions(competitorWebsiteId: string): Promise<{
        deleted: number;
        cookiesRemoved: number;
    }> {
        try {
            // Get sessions for this website to count cookies
            const sessions = await prisma.scrapingCookieJar.findMany({
                where: {
                    competitorWebsiteId,
                },
                select: {
                    id: true,
                    cookies: true,
                },
            });

            // Count cookies
            let cookiesRemoved = 0;
            for (const session of sessions) {
                const cookies = session.cookies as any[];
                if (Array.isArray(cookies)) {
                    cookiesRemoved += cookies.length;
                }
            }

            // Delete sessions
            const result = await prisma.scrapingCookieJar.deleteMany({
                where: {
                    competitorWebsiteId,
                },
            });

            logger.info('Cleaned up website sessions', {
                competitorWebsiteId,
                deleted: result.count,
                cookiesRemoved,
            });

            return {
                deleted: result.count,
                cookiesRemoved,
            };
        } catch (error) {
            logger.error('Failed to cleanup website sessions', {
                competitorWebsiteId,
                error: error instanceof Error ? error.message : String(error),
            });
            throw error;
        }
    }
}

/**
 * Run cookie cleanup job (for cron execution)
 * 
 * Example cron schedule: every 6 hours
 */
export async function runCookieCleanup(): Promise<CookieCleanupResult> {
    const job = new CookieCleanupJob();
    const result = await job.execute();

    // Log result
    logger.info('Cookie cleanup completed', {
        expiredSessionsDeleted: result.expiredSessionsDeleted,
        staleSessionsDeleted: result.staleSessionsDeleted,
        totalCookiesRemoved: result.totalCookiesRemoved,
        durationMs: result.durationMs,
        errors: result.errors.length,
    });

    if (result.errors.length > 0) {
        logger.error('Cookie cleanup errors', { errors: result.errors });
    }

    return result;
}
