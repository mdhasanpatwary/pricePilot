/**
 * Session Management Utilities
 * 
 * Provides utilities for managing user sessions including:
 * - Session invalidation on password change
 * - Session revocation
 * - Session cleanup
 * 
 * Requirements: 2.7.7
 */

import { prisma } from '@/lib/prisma';

export class SessionManager {
    /**
     * Invalidate all sessions for a user
     * Used when password is changed or account is compromised
     */
    static async invalidateAllUserSessions(userId: string): Promise<void> {
        try {
            await prisma.session.deleteMany({
                where: { userId },
            });
        } catch (error) {
            console.error('[SessionManager] Failed to invalidate sessions:', error);
            throw new Error('Failed to invalidate user sessions');
        }
    }

    /**
     * Invalidate a specific session
     * Used for single device logout
     */
    static async invalidateSession(sessionToken: string): Promise<void> {
        try {
            await prisma.session.delete({
                where: { sessionToken },
            });
        } catch (error) {
            console.error('[SessionManager] Failed to invalidate session:', error);
            throw new Error('Failed to invalidate session');
        }
    }

    /**
     * Get all active sessions for a user
     */
    static async getUserSessions(userId: string) {
        try {
            return await prisma.session.findMany({
                where: {
                    userId,
                    expires: {
                        gt: new Date(),
                    },
                },
                orderBy: {
                    lastUsedAt: 'desc',
                },
            });
        } catch (error) {
            console.error('[SessionManager] Failed to get user sessions:', error);
            throw new Error('Failed to retrieve user sessions');
        }
    }

    /**
     * Clean up expired sessions
     * Should be run periodically via cron
     */
    static async cleanupExpiredSessions(): Promise<number> {
        try {
            const result = await prisma.session.deleteMany({
                where: {
                    expires: {
                        lt: new Date(),
                    },
                },
            });
            return result.count;
        } catch (error) {
            console.error('[SessionManager] Failed to cleanup expired sessions:', error);
            throw new Error('Failed to cleanup expired sessions');
        }
    }

    /**
     * Extend session expiration (for remember me)
     */
    static async extendSession(sessionToken: string, days: number = 30): Promise<void> {
        try {
            await prisma.session.update({
                where: { sessionToken },
                data: {
                    expires: new Date(Date.now() + days * 24 * 60 * 60 * 1000),
                },
            });
        } catch (error) {
            console.error('[SessionManager] Failed to extend session:', error);
            throw new Error('Failed to extend session');
        }
    }

    /**
     * Update session last used timestamp
     */
    static async updateSessionActivity(sessionToken: string): Promise<void> {
        try {
            await prisma.session.update({
                where: { sessionToken },
                data: {
                    lastUsedAt: new Date(),
                },
            });
        } catch (error) {
            // Don't throw error for activity updates
            console.error('[SessionManager] Failed to update session activity:', error);
        }
    }
}
