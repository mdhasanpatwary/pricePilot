import { prisma } from "@/lib/prisma";
import {
    ScrapingSessionData,
    SessionFilters,
    SessionStatus,
    SessionStage,
    SessionError,
    SessionMetrics
} from "@/lib/types/admin-dashboard";
import { logger } from "@/lib/logger";

/**
 * Repository for ScrapingSession database operations
 * Handles persistence of session data to PostgreSQL
 */
export class SessionRepository {
    /**
     * Create a new scraping session in the database
     */
    async createSession(data: {
        id: string;
        tenantId: string;
        tenantName: string;
        siteUrl: string;
        targetUrl: string;
        status: SessionStatus;
        currentStage: SessionStage;
        proxyUsed?: string;
        userAgent?: string;
    }): Promise<ScrapingSessionData> {
        try {
            const session = await prisma.scrapingSession.create({
                data: {
                    id: data.id,
                    tenantId: data.tenantId,
                    tenantName: data.tenantName,
                    siteUrl: data.siteUrl,
                    targetUrl: data.targetUrl,
                    status: data.status,
                    currentStage: data.currentStage,
                    proxyUsed: data.proxyUsed || null,
                    userAgent: data.userAgent || null,
                    requestsCompleted: 0,
                    requestsTotal: 0,
                    errors: [],
                    metrics: {
                        navigationTime: 0,
                        challengeSolveTime: 0,
                        extractionTime: 0,
                        totalTime: 0,
                    },
                },
            });

            return this.mapToSessionData(session);
        } catch (error) {
            logger.error("[SessionRepository] Error creating session", { error, data });
            throw error;
        }
    }

    /**
     * Update an existing session
     */
    async updateSession(
        sessionId: string,
        updates: Partial<{
            status: SessionStatus;
            currentStage: SessionStage;
            proxyUsed: string;
            requestsCompleted: number;
            requestsTotal: number;
            challengeType: string;
            challengeStatus: string;
            extractedData: any;
            errors: SessionError[];
            metrics: SessionMetrics;
            endTime: Date;
        }>
    ): Promise<ScrapingSessionData> {
        try {
            const session = await prisma.scrapingSession.update({
                where: { id: sessionId },
                data: updates as any,
            });

            return this.mapToSessionData(session);
        } catch (error) {
            logger.error("[SessionRepository] Error updating session", { error, sessionId, updates });
            throw error;
        }
    }

    /**
     * Get session by ID
     */
    async getSession(sessionId: string): Promise<ScrapingSessionData | null> {
        try {
            const session = await prisma.scrapingSession.findUnique({
                where: { id: sessionId },
            });

            return session ? this.mapToSessionData(session) : null;
        } catch (error) {
            logger.error("[SessionRepository] Error getting session", { error, sessionId });
            return null;
        }
    }

    /**
     * Get active sessions with optional filters
     */
    async getActiveSessions(filters?: SessionFilters): Promise<ScrapingSessionData[]> {
        try {
            const where: any = {
                status: {
                    in: ['initializing', 'running', 'waiting_challenge'],
                },
            };

            if (filters?.tenantId) {
                where.tenantId = filters.tenantId;
            }

            if (filters?.status) {
                where.status = filters.status;
            }

            let queryConfig: any = {
                where,
                orderBy: [
                    { startTime: 'desc' },
                    { id: 'desc' }
                ],
                take: filters?.limit || 100,
            };

            // keyset pagination using cursor overrides offset
            if (filters?.cursor) {
                const { decodeCursor } = await import('@/lib/utils/cursor-pagination');
                const decoded = decodeCursor(filters.cursor);
                if (decoded) {
                    // startTime < cursor.timestamp OR (startTime = cursor.timestamp AND id < cursor.id)
                    queryConfig.where.AND = [
                        {
                            OR: [
                                { startTime: { lt: new Date(decoded.timestamp) } },
                                {
                                    AND: [
                                        { startTime: new Date(decoded.timestamp) },
                                        { id: { lt: decoded.id } },
                                    ],
                                },
                            ],
                        },
                    ];
                }
            } else if (filters?.offset) {
                // legacy offset support for backwards compatibility
                queryConfig.skip = filters.offset;
            }

            const sessions = await prisma.scrapingSession.findMany(queryConfig);

            return sessions.map(s => this.mapToSessionData(s));
        } catch (error) {
            logger.error("[SessionRepository] Error getting active sessions", { error, filters });
            return [];
        }
    }

    /**
     * Get session history with filters
     */
    async getSessionHistory(filters: SessionFilters): Promise<ScrapingSessionData[]> {
        try {
            const where: any = {};

            if (filters.tenantId) {
                where.tenantId = filters.tenantId;
            }

            if (filters.status) {
                where.status = filters.status;
            }

            if (filters.startDate || filters.endDate) {
                where.startTime = {};
                if (filters.startDate) {
                    where.startTime.gte = filters.startDate;
                }
                if (filters.endDate) {
                    where.startTime.lte = filters.endDate;
                }
            }

            let queryConfig: any = {
                where,
                orderBy: [
                    { startTime: 'desc' },
                    { id: 'desc' }
                ],
                take: filters.limit || 100,
            };

            if (filters?.cursor) {
                const { decodeCursor } = await import('@/lib/utils/cursor-pagination');
                const decoded = decodeCursor(filters.cursor);
                if (decoded) {
                    queryConfig.where.AND = [
                        {
                            OR: [
                                { startTime: { lt: new Date(decoded.timestamp) } },
                                {
                                    AND: [
                                        { startTime: new Date(decoded.timestamp) },
                                        { id: { lt: decoded.id } },
                                    ],
                                },
                            ],
                        },
                    ];
                }
            } else if (filters.offset) {
                // legacy offset support
                queryConfig.skip = filters.offset;
            }

            const sessions = await prisma.scrapingSession.findMany(queryConfig);

            return sessions.map(s => this.mapToSessionData(s));
        } catch (error) {
            logger.error("[SessionRepository] Error getting session history", { error, filters });
            return [];
        }
    }

    /**
     * Delete old sessions (cleanup)
     */
    async deleteOldSessions(olderThanDays: number = 30): Promise<number> {
        try {
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

            const result = await prisma.scrapingSession.deleteMany({
                where: {
                    startTime: {
                        lt: cutoffDate,
                    },
                },
            });

            return result.count;
        } catch (error) {
            logger.error("[SessionRepository] Error deleting old sessions", { error, olderThanDays });
            return 0;
        }
    }

    /**
     * Get session count by status
     */
    async getSessionCountByStatus(tenantId?: string): Promise<Record<string, number>> {
        try {
            const where: any = {};
            if (tenantId) {
                where.tenantId = tenantId;
            }

            const sessions = await prisma.scrapingSession.groupBy({
                by: ['status'],
                where,
                _count: true,
            });

            const counts: Record<string, number> = {};
            sessions.forEach(s => {
                counts[s.status] = s._count;
            });

            return counts;
        } catch (error) {
            logger.error("[SessionRepository] Error getting session count by status", { error, tenantId });
            return {};
        }
    }

    /**
     * Clear completed and failed sessions
     * Used to clean up logs before starting new scraping sessions
     */
    async clearCompletedSessions(tenantId?: string): Promise<number> {
        try {
            const where: any = {
                status: { in: ['completed', 'failed'] },
            };

            if (tenantId) {
                where.tenantId = tenantId;
            }

            const result = await prisma.scrapingSession.deleteMany({
                where,
            });

            logger.info('[SessionRepository] Cleared completed sessions', {
                count: result.count,
                tenantId,
            });

            return result.count;
        } catch (error) {
            logger.error('[SessionRepository] Error clearing completed sessions', { error, tenantId });
            return 0;
        }
    }

    /**
     * Map Prisma model to typed interface
     */
    private mapToSessionData(session: any): ScrapingSessionData {
        return {
            id: session.id,
            tenantId: session.tenantId,
            tenantName: session.tenantName,
            siteUrl: session.siteUrl,
            targetUrl: session.targetUrl,
            status: session.status as SessionStatus,
            currentStage: session.currentStage as SessionStage,
            proxyUsed: session.proxyUsed,
            userAgent: session.userAgent,
            requestsCompleted: session.requestsCompleted,
            requestsTotal: session.requestsTotal,
            challengeType: session.challengeType,
            challengeStatus: session.challengeStatus,
            extractedData: session.extractedData,
            errors: session.errors || [],
            metrics: session.metrics || {
                navigationTime: 0,
                challengeSolveTime: 0,
                extractionTime: 0,
                totalTime: 0,
            },
            startTime: session.startTime,
            endTime: session.endTime,
            createdAt: session.createdAt,
            updatedAt: session.updatedAt,
        };
    }
}

// Export singleton instance
export const sessionRepository = new SessionRepository();
