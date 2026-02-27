import { NextRequest, NextResponse } from 'next/server';
import { sessionTracker } from '@/lib/services/session-tracker';
import { SessionFilters, SessionStatus } from '@/lib/types/admin-dashboard';
import { getCachedSession } from "@/lib/auth/cached-session";
import { withRequestContextAndRateLimit } from "@/lib/middleware/with-request-context";

/**
 * GET /api/v1/admin/sessions/history
 * Get historical session data with filtering
 *
 * Query Parameters:
 * - tenantId: Filter by tenant ID
 * - status: Filter by session status (completed, failed)
 * - startDate: Filter sessions starting after this date (ISO 8601)
 * - endDate: Filter sessions starting before this date (ISO 8601)
 * - limit: Maximum number of results (default: 100)
 * - offset: Pagination offset (default: 0)
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
        const status = searchParams.get('status') as SessionStatus | undefined;
        const startDateStr = searchParams.get('startDate');
        const endDateStr = searchParams.get('endDate');
        const limitStr = searchParams.get('limit');
        const cursor = searchParams.get('cursor') || undefined;

        // Build filters
        const filters: SessionFilters = {
            tenantId,
            status,
            limit: limitStr ? parseInt(limitStr, 10) : 100,
        };

        if (cursor) {
            filters.cursor = cursor;
        }

        // Parse dates if provided
        if (startDateStr) {
            const startDate = new Date(startDateStr);
            if (!isNaN(startDate.getTime())) {
                filters.startDate = startDate;
            }
        }

        if (endDateStr) {
            const endDate = new Date(endDateStr);
            if (!isNaN(endDate.getTime())) {
                filters.endDate = endDate;
            }
        }

        // Validate limit
        if (filters.limit && (filters.limit < 1 || filters.limit > 1000)) {
            return NextResponse.json(
                {
                    success: false,
                    error: 'Invalid limit parameter (must be between 1 and 1000)',
                },
                { status: 400 }
            );
        }

        // Get session history
        const sessions = await sessionTracker.getSessionHistory(filters);

        // Compute total count efficiently using prisma instead of fetching all sessions
        let totalCount = 0;
        try {
            const countWhere: any = {};
            if (tenantId) countWhere.tenantId = tenantId;
            if (status) countWhere.status = status;
            if (filters.startDate || filters.endDate) {
                countWhere.startTime = {};
                if (filters.startDate) countWhere.startTime.gte = filters.startDate;
                if (filters.endDate) countWhere.startTime.lte = filters.endDate;
            }
            totalCount = await prisma.scrapingSession.count({ where: countWhere });
        } catch (_err) {
            // If count fails, fall back to length of retrieved sessions
            totalCount = sessions.length;
        }

        // determine next cursor
        let nextCursor: string | null = null;
        if (sessions.length === filters.limit && sessions.length > 0) {
            const last = sessions[sessions.length - 1];
            const { encodeCursor } = await import('@/lib/utils/cursor-pagination');
            nextCursor = encodeCursor({ timestamp: last.startTime.getTime(), id: last.id });
        }

        return NextResponse.json({
            success: true,
            data: {
                sessions,
                pagination: {
                    total: totalCount,
                    limit: filters.limit || 100,
                    nextCursor,
                },
            },
        });
    } catch (error) {
        console.error('[Session History API] Error:', error);
        return NextResponse.json(
            {
                success: false,
                error: 'Failed to fetch session history',
                details: error instanceof Error ? error.message : 'Unknown error',
            },
            { status: 500 }
        );
    }
}

export async function GET(req: NextRequest) {
    return withRequestContextAndRateLimit(req, 'read', () => handleGET(req));
}
