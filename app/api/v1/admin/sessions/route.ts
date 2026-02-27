import { NextRequest, NextResponse } from 'next/server';
import { sessionTracker } from '@/lib/services/session-tracker';
import { getCachedSession } from "@/lib/auth/cached-session";
import { withRequestContextAndRateLimit } from "@/lib/middleware/with-request-context";

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
        const session = await getCachedSession();
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
        const cursor = searchParams.get('cursor') || undefined;
        const limit = parseInt(searchParams.get('limit') || '100', 10);

        // Build filters for repository
        const filters: any = { tenantId, limit };
        if (status) filters.status = status;
        if (cursor) filters.cursor = cursor;

        // Fetch sessions directly using filters (DB will handle status and pagination)
        const sessions = await sessionTracker.getActiveSessions(filters);

        // Get session count by status for summary (constant-time count query)
        const statusCounts = await sessionTracker.getSessionCountByStatus(tenantId);

        // determine next cursor if we returned as many rows as the limit
        let nextCursor: string | null = null;
        if (sessions.length === limit && sessions.length > 0) {
            const last = sessions[sessions.length - 1];
            const { encodeCursor } = await import('@/lib/utils/cursor-pagination');
            nextCursor = encodeCursor({ timestamp: last.startTime.getTime(), id: last.id });
        }

        return NextResponse.json({
            success: true,
            data: {
                sessions,
                summary: {
                    total: sessions.length,
                    statusCounts,
                },
                pagination: {
                    limit,
                    nextCursor,
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
    return withRequestContextAndRateLimit(req, 'read', () => handleGET(req));
}
