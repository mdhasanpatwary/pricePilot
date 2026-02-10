import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { sessionTracker } from '@/lib/services/session-tracker';
import { withRateLimit } from '@/lib/middleware/ratelimit';

/**
 * GET /api/v1/admin/sessions
 * Get active scraping sessions with optional filtering
 *
 * Query Parameters:
 * - tenantId: Filter by tenant ID
 * - status: Filter by session status
 *
 * Requirements: 1.1, 1.2, 1.3, 1.4, 1.5
 */
async function handleGET(request: NextRequest) {
    try {
        // Authentication check
        const session = await getServerSession(authOptions);
        if (!session?.user) {
            return NextResponse.json(
                { error: 'Unauthorized' },
                { status: 401 }
            );
        }

        // Check if user is super admin or regular admin
        const user = session.user as any;
        const isAdmin = user.role === 'ADMIN' || user.isSuperAdmin === true;

        if (!isAdmin) {
            return NextResponse.json(
                { error: 'Unauthorized - Admin access required' },
                { status: 401 }
            );
        }

        // Parse query parameters
        const searchParams = request.nextUrl.searchParams;
        const tenantId = searchParams.get('tenantId') || undefined;
        const status = searchParams.get('status') || undefined;

        // Get active sessions
        const sessions = await sessionTracker.getActiveSessions(tenantId);

        // Apply status filter if provided
        let filteredSessions = sessions;
        if (status) {
            filteredSessions = sessions.filter(s => s.status === status);
        }

        // Get session count by status for summary
        const statusCounts = await sessionTracker.getSessionCountByStatus(tenantId);

        return NextResponse.json({
            success: true,
            data: {
                sessions: filteredSessions,
                summary: {
                    total: filteredSessions.length,
                    statusCounts,
                },
            },
        });
    } catch (error) {
        console.error('[Sessions API] Error:', error);
        return NextResponse.json(
            {
                success: false,
                error: 'Failed to fetch sessions',
                details: error instanceof Error ? error.message : 'Unknown error',
            },
            { status: 500 }
        );
    }
}

export async function GET(req: NextRequest) {
    return withRateLimit(req, 'read', () => handleGET(req));
}
