import { sessionRepository } from './session-repository';
import { redisSessionManager } from './redis-session-manager';
import {
    ScrapingSessionData,
    SessionStatus,
    SessionStage,
    SessionError,
    SessionMetrics,
    SessionFilters,
} from '@/lib/types/admin-dashboard';
import { logger } from '@/lib/logger';

/**
 * SessionTracker Service
 *
 * Tracks all active scraping sessions in real-time with complete lifecycle information.
 *
 * Storage Strategy:
 * - Active sessions: Redis (TTL: 1 hour) for fast access
 * - Completed sessions: PostgreSQL for persistence (retention: 30 days)
 * - Dual-write: Updates go to both Redis and PostgreSQL
 *
 * Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 2.1, 2.2, 2.3, 2.4, 2.5
 */
export class SessionTracker {
    private static instance: SessionTracker;

    private constructor() { }

    static getInstance(): SessionTracker {
        if (!SessionTracker.instance) {
            SessionTracker.instance = new SessionTracker();
        }
        return SessionTracker.instance;
    }

    /**
     * Create a new scraping session
     *
     * @param tenantId - Tenant identifier
     * @param tenantName - Tenant display name
     * @param siteUrl - Base URL of the site being scraped
     * @param targetUrl - Specific URL being scraped
     * @param userAgent - User agent string to use
     * @returns Session ID
     */
    async createSession(
        tenantId: string,
        tenantName: string,
        siteUrl: string,
        targetUrl: string,
        userAgent?: string
    ): Promise<string> {
        const sessionId = crypto.randomUUID();

        try {
            // Create session in database
            await sessionRepository.createSession({
                id: sessionId,
                tenantId,
                tenantName,
                siteUrl,
                targetUrl,
                status: 'initializing',
                currentStage: 'proxy_selection',
                userAgent,
            });

            // Store in Redis for real-time access
            await redisSessionManager.setSession(sessionId, {
                tenantId,
                status: 'initializing',
                currentStage: 'proxy_selection',
                proxyUsed: null,
                startTime: new Date().toISOString(),
                metrics: JSON.stringify({
                    navigationTime: 0,
                    challengeSolveTime: 0,
                    extractionTime: 0,
                    totalTime: 0,
                }),
            });

            logger.info('[SessionTracker] Session created', {
                sessionId,
                tenantId,
                siteUrl,
                targetUrl,
            });

            return sessionId;
        } catch (error) {
            logger.error('[SessionTracker] Error creating session', {
                error,
                tenantId,
                siteUrl,
                targetUrl,
            });
            // Return session ID even if storage fails - allow operation to continue
            return sessionId;
        }
    }

    /**
     * Update session stage with optional data
     *
     * @param sessionId - Session identifier
     * @param stage - New stage
     * @param data - Optional stage-specific data
     */
    async updateStage(
        sessionId: string,
        stage: SessionStage,
        data?: {
            proxy?: string;
            userAgent?: string;
            challengeType?: string;
            challengeStatus?: 'waiting' | 'solving' | 'solved' | 'failed';
            extractedData?: any;
            requestsCompleted?: number;
            requestsTotal?: number;
            metrics?: Partial<SessionMetrics>;
        }
    ): Promise<void> {
        try {
            const updates: any = {
                currentStage: stage,
                status: this.getStatusFromStage(stage),
            };

            // Add optional data to updates
            if (data?.proxy) {
                updates.proxyUsed = data.proxy;
            }
            if (data?.userAgent) {
                updates.userAgent = data.userAgent;
            }
            if (data?.challengeType) {
                updates.challengeType = data.challengeType;
            }
            if (data?.challengeStatus) {
                updates.challengeStatus = data.challengeStatus;
            }
            if (data?.extractedData) {
                updates.extractedData = data.extractedData;
            }
            if (data?.requestsCompleted !== undefined) {
                updates.requestsCompleted = data.requestsCompleted;
            }
            if (data?.requestsTotal !== undefined) {
                updates.requestsTotal = data.requestsTotal;
            }

            // Handle metrics update
            if (data?.metrics) {
                const currentSession = await this.getSession(sessionId);
                if (currentSession) {
                    updates.metrics = {
                        ...currentSession.metrics,
                        ...data.metrics,
                    };
                }
            }

            // Update database
            await sessionRepository.updateSession(sessionId, updates);

            // Update Redis
            const redisUpdates: any = {
                currentStage: stage,
                status: updates.status,
            };
            if (data?.proxy) {
                redisUpdates.proxyUsed = data.proxy;
            }
            if (updates.metrics) {
                redisUpdates.metrics = JSON.stringify(updates.metrics);
            }

            await redisSessionManager.updateSession(sessionId, redisUpdates);

            logger.debug('[SessionTracker] Session stage updated', {
                sessionId,
                stage,
                status: updates.status,
            });
        } catch (error) {
            logger.error('[SessionTracker] Error updating session stage', {
                error,
                sessionId,
                stage,
            });
            // Continue operation even if update fails
        }
    }

    /**
     * Record an error for a session
     *
     * @param sessionId - Session identifier
     * @param error - Error object or message
     */
    async recordError(sessionId: string, error: Error | string): Promise<void> {
        try {
            const currentSession = await this.getSession(sessionId);
            if (!currentSession) {
                logger.warn('[SessionTracker] Cannot record error - session not found', {
                    sessionId,
                });
                return;
            }

            const sessionError: SessionError = {
                timestamp: new Date(),
                message: typeof error === 'string' ? error : error.message,
                stack: typeof error === 'string' ? undefined : error.stack,
            };

            const updatedErrors = [...currentSession.errors, sessionError];

            await sessionRepository.updateSession(sessionId, {
                errors: updatedErrors,
            });

            logger.info('[SessionTracker] Error recorded', {
                sessionId,
                errorMessage: sessionError.message,
            });
        } catch (err) {
            logger.error('[SessionTracker] Error recording session error', {
                error: err,
                sessionId,
            });
        }
    }

    /**
     * Complete a session (success or failure)
     *
     * @param sessionId - Session identifier
     * @param success - Whether the session completed successfully
     * @param data - Optional completion data
     */
    async completeSession(
        sessionId: string,
        success: boolean,
        data?: {
            extractedData?: any;
            metrics?: SessionMetrics;
        }
    ): Promise<void> {
        try {
            const endTime = new Date();
            const currentSession = await this.getSession(sessionId);

            if (!currentSession) {
                logger.warn('[SessionTracker] Cannot complete session - session not found', {
                    sessionId,
                });
                return;
            }

            // Calculate total time
            const totalTime = endTime.getTime() - currentSession.startTime.getTime();

            const updates: any = {
                status: success ? 'completed' : 'failed',
                endTime,
                metrics: {
                    ...currentSession.metrics,
                    totalTime,
                    ...(data?.metrics || {}),
                },
            };

            if (data?.extractedData) {
                updates.extractedData = data.extractedData;
            }

            // Update database
            await sessionRepository.updateSession(sessionId, updates);

            // Remove from Redis (session is no longer active)
            await redisSessionManager.deleteSession(sessionId, currentSession.tenantId);

            logger.info('[SessionTracker] Session completed', {
                sessionId,
                success,
                totalTime,
            });
        } catch (error) {
            logger.error('[SessionTracker] Error completing session', {
                error,
                sessionId,
                success,
            });
        }
    }

    /**
     * Get active sessions with optional tenant filter
     *
     * @param tenantId - Optional tenant filter
     * @returns Array of active sessions
     */
    async getActiveSessions(tenantId?: string): Promise<ScrapingSessionData[]> {
        try {
            // Try to get from Redis first for real-time data
            const redisSessionIds = tenantId
                ? await redisSessionManager.getTenantSessions(tenantId)
                : await redisSessionManager.getAllActiveSessions();

            if (redisSessionIds.length > 0) {
                // Fetch full session data from database
                const sessions = await Promise.all(
                    redisSessionIds.map(id => sessionRepository.getSession(id))
                );
                return sessions.filter((s): s is ScrapingSessionData => s !== null);
            }

            // Fallback to database if Redis is empty
            return await sessionRepository.getActiveSessions({ tenantId });
        } catch (error) {
            logger.error('[SessionTracker] Error getting active sessions', {
                error,
                tenantId,
            });
            // Fallback to database
            return await sessionRepository.getActiveSessions({ tenantId });
        }
    }

    /**
     * Get session by ID
     *
     * @param sessionId - Session identifier
     * @returns Session data or null if not found
     */
    async getSession(sessionId: string): Promise<ScrapingSessionData | null> {
        try {
            // Try Redis first for active sessions
            const redisData = await redisSessionManager.getSession(sessionId);
            if (redisData) {
                // Fetch full data from database
                return await sessionRepository.getSession(sessionId);
            }

            // Fallback to database
            return await sessionRepository.getSession(sessionId);
        } catch (error) {
            logger.error('[SessionTracker] Error getting session', {
                error,
                sessionId,
            });
            return null;
        }
    }

    /**
     * Get session history with filters
     *
     * @param filters - Session filters
     * @returns Array of sessions matching filters
     */
    async getSessionHistory(filters: SessionFilters): Promise<ScrapingSessionData[]> {
        try {
            return await sessionRepository.getSessionHistory(filters);
        } catch (error) {
            logger.error('[SessionTracker] Error getting session history', {
                error,
                filters,
            });
            return [];
        }
    }

    /**
     * Get session count by status for a tenant
     *
     * @param tenantId - Optional tenant filter
     * @returns Object with status counts
     */
    async getSessionCountByStatus(tenantId?: string): Promise<Record<string, number>> {
        try {
            return await sessionRepository.getSessionCountByStatus(tenantId);
        } catch (error) {
            logger.error('[SessionTracker] Error getting session count by status', {
                error,
                tenantId,
            });
            return {};
        }
    }

    /**
     * Cleanup old sessions from database
     *
     * @param olderThanDays - Delete sessions older than this many days
     * @returns Number of sessions deleted
     */
    async cleanupOldSessions(olderThanDays: number = 30): Promise<number> {
        try {
            const count = await sessionRepository.deleteOldSessions(olderThanDays);
            logger.info('[SessionTracker] Old sessions cleaned up', {
                count,
                olderThanDays,
            });
            return count;
        } catch (error) {
            logger.error('[SessionTracker] Error cleaning up old sessions', {
                error,
                olderThanDays,
            });
            return 0;
        }
    }

    /**
     * Clear completed and failed sessions for a tenant
     * This is useful when starting a new scraping session to show only fresh logs
     *
     * @param tenantId - Optional tenant filter (if not provided, clears all)
     * @returns Number of sessions cleared
     */
    async clearCompletedSessions(tenantId?: string): Promise<number> {
        try {
            const count = await sessionRepository.clearCompletedSessions(tenantId);

            // Also clear from Redis
            if (tenantId) {
                const tenantSessions = await redisSessionManager.getTenantSessions(tenantId);
                for (const sessionId of tenantSessions) {
                    const session = await this.getSession(sessionId);
                    if (session && (session.status === 'completed' || session.status === 'failed')) {
                        await redisSessionManager.deleteSession(sessionId, tenantId);
                    }
                }
            }

            logger.info('[SessionTracker] Completed sessions cleared', {
                count,
                tenantId,
            });
            return count;
        } catch (error) {
            logger.error('[SessionTracker] Error clearing completed sessions', {
                error,
                tenantId,
            });
            return 0;
        }
    }

    /**
     * Pause a session
     * Requirements: 12.1, 12.4
     *
     * @param sessionId - Session identifier
     * @returns Success status
     */
    async pauseSession(sessionId: string): Promise<{ success: boolean; message: string }> {
        try {
            const session = await this.getSession(sessionId);
            if (!session) {
                return { success: false, message: 'Session not found' };
            }

            if (session.status === 'completed' || session.status === 'failed') {
                return { success: false, message: 'Cannot pause completed or failed session' };
            }

            // Update status to indicate paused state
            await sessionRepository.updateSession(sessionId, {
                status: 'initializing', // Use initializing as paused state
                // Preserve current stage for resumption
            });

            await redisSessionManager.updateSession(sessionId, {
                status: 'initializing',
            });

            logger.info('[SessionTracker] Session paused', { sessionId });
            return { success: true, message: 'Session paused successfully' };
        } catch (error) {
            logger.error('[SessionTracker] Error pausing session', { error, sessionId });
            return { success: false, message: 'Failed to pause session' };
        }
    }

    /**
     * Resume a paused session
     * Requirements: 12.1, 12.4
     *
     * @param sessionId - Session identifier
     * @returns Success status
     */
    async resumeSession(sessionId: string): Promise<{ success: boolean; message: string }> {
        try {
            const session = await this.getSession(sessionId);
            if (!session) {
                return { success: false, message: 'Session not found' };
            }

            if (session.status === 'completed' || session.status === 'failed') {
                return { success: false, message: 'Cannot resume completed or failed session' };
            }

            // Resume from current stage
            const newStatus = this.getStatusFromStage(session.currentStage);

            await sessionRepository.updateSession(sessionId, {
                status: newStatus,
            });

            await redisSessionManager.updateSession(sessionId, {
                status: newStatus,
            });

            logger.info('[SessionTracker] Session resumed', { sessionId });
            return { success: true, message: 'Session resumed successfully' };
        } catch (error) {
            logger.error('[SessionTracker] Error resuming session', { error, sessionId });
            return { success: false, message: 'Failed to resume session' };
        }
    }

    /**
     * Cancel a session
     * Requirements: 12.1, 12.5
     *
     * @param sessionId - Session identifier
     * @param reason - Cancellation reason
     * @returns Success status
     */
    async cancelSession(
        sessionId: string,
        reason?: string
    ): Promise<{ success: boolean; message: string }> {
        try {
            const session = await this.getSession(sessionId);
            if (!session) {
                return { success: false, message: 'Session not found' };
            }

            if (session.status === 'completed' || session.status === 'failed') {
                return { success: false, message: 'Session already completed or failed' };
            }

            // Record cancellation error
            if (reason) {
                await this.recordError(sessionId, `Session canceled: ${reason}`);
            }

            // Mark as failed with cancellation
            await sessionRepository.updateSession(sessionId, {
                status: 'failed',
                endTime: new Date(),
            });

            // Clean up Redis
            await redisSessionManager.deleteSession(sessionId, session.tenantId);

            logger.info('[SessionTracker] Session canceled', { sessionId, reason });
            return { success: true, message: 'Session canceled successfully' };
        } catch (error) {
            logger.error('[SessionTracker] Error canceling session', { error, sessionId });
            return { success: false, message: 'Failed to cancel session' };
        }
    }

    /**
     * Retry a failed session
     * Requirements: 12.2
     *
     * @param sessionId - Session identifier
     * @param overrides - Optional configuration overrides
     * @returns New session ID
     */
    async retrySession(
        sessionId: string,
        overrides?: {
            proxy?: string;
            userAgent?: string;
        }
    ): Promise<{ success: boolean; message: string; newSessionId?: string }> {
        try {
            const session = await this.getSession(sessionId);
            if (!session) {
                return { success: false, message: 'Session not found' };
            }

            // Create new session with same parameters
            const newSessionId = await this.createSession(
                session.tenantId,
                session.tenantName,
                session.siteUrl,
                session.targetUrl,
                overrides?.userAgent || session.userAgent || undefined
            );

            // If proxy override provided, update the new session
            if (overrides?.proxy) {
                await this.updateStage(newSessionId, 'proxy_selection', {
                    proxy: overrides.proxy,
                });
            }

            logger.info('[SessionTracker] Session retried', {
                originalSessionId: sessionId,
                newSessionId,
            });

            return {
                success: true,
                message: 'Session retry initiated',
                newSessionId,
            };
        } catch (error) {
            logger.error('[SessionTracker] Error retrying session', { error, sessionId });
            return { success: false, message: 'Failed to retry session' };
        }
    }

    /**
     * Bulk pause sessions
     * Requirements: 12.3
     *
     * @param sessionIds - Array of session identifiers
     * @returns Results for each session
     */
    async bulkPauseSessions(
        sessionIds: string[]
    ): Promise<Array<{ sessionId: string; success: boolean; message: string }>> {
        const results = await Promise.all(
            sessionIds.map(async (sessionId) => {
                const result = await this.pauseSession(sessionId);
                return { sessionId, ...result };
            })
        );
        return results;
    }

    /**
     * Bulk resume sessions
     * Requirements: 12.3
     *
     * @param sessionIds - Array of session identifiers
     * @returns Results for each session
     */
    async bulkResumeSessions(
        sessionIds: string[]
    ): Promise<Array<{ sessionId: string; success: boolean; message: string }>> {
        const results = await Promise.all(
            sessionIds.map(async (sessionId) => {
                const result = await this.resumeSession(sessionId);
                return { sessionId, ...result };
            })
        );
        return results;
    }

    /**
     * Bulk cancel sessions
     * Requirements: 12.3
     *
     * @param sessionIds - Array of session identifiers
     * @param reason - Cancellation reason
     * @returns Results for each session
     */
    async bulkCancelSessions(
        sessionIds: string[],
        reason?: string
    ): Promise<Array<{ sessionId: string; success: boolean; message: string }>> {
        const results = await Promise.all(
            sessionIds.map(async (sessionId) => {
                const result = await this.cancelSession(sessionId, reason);
                return { sessionId, ...result };
            })
        );
        return results;
    }

    /**
     * Helper: Determine session status from stage
     */
    private getStatusFromStage(stage: SessionStage): SessionStatus {
        switch (stage) {
            case 'proxy_selection':
                return 'initializing';
            case 'navigation':
            case 'data_extraction':
            case 'validation':
                return 'running';
            case 'challenge_detection':
            case 'challenge_solving':
                return 'waiting_challenge';
            default:
                return 'running';
        }
    }
}

// Export singleton instance
export const sessionTracker = SessionTracker.getInstance();
