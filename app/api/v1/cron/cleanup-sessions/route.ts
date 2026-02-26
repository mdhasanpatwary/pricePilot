import { withRequestContextOnly } from '@/lib/middleware/with-request-context';
/**
 * Session Cleanup Cron Job
 * 
 * Periodically removes expired sessions from the database
 * Requirements: 2.7.7
 * 
 * Schedule: Daily at 2 AM
 */

import { NextRequest, NextResponse } from 'next/server';
import { SessionManager } from '@/lib/utils/session-manager';

async function handleGET(req: NextRequest) {
    try {
        // Verify cron secret
        const authHeader = req.headers.get('authorization');
        const cronSecret = process.env.CRON_SECRET;

        if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
            return NextResponse.json(
                { success: false, error: 'Unauthorized' },
                { status: 401 }
            );
        }

        // Clean up expired sessions
        const deletedCount = await SessionManager.cleanupExpiredSessions();

        console.log(`[SessionCleanup] Cleaned up ${deletedCount} expired sessions`);

        return NextResponse.json({
            success: true,
            message: `Cleaned up ${deletedCount} expired sessions`,
            deletedCount,
        });
    } catch (error) {
        console.error('[SessionCleanup] Error:', error);
        return NextResponse.json(
            {
                success: false,
                error: 'Failed to cleanup sessions',
            },
            { status: 500 }
        );
    }
}

export async function GET(req: NextRequest) {
    return withRequestContextOnly(req, handleGET);
}
