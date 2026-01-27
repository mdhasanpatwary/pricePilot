import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { sessionTracker } from '@/lib/services/session-tracker';
import { SessionFilters, SessionStatus } from '@/lib/types/admin-dashboard';

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
export async function GET(request: NextRequest) {
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
        const status = searchParams.get('status') as SessionStatus | undefined;
        const startDateStr = searchParams.get('startDate');
        const endDateStr = searchParams.get('endDate');
        const limitStr = searchParams.get('limit');
        const offsetStr = searchParams.get('offset');

        // Build filters
        const filters: SessionFilters = {
            tenantId,
            status,
            limit: limitStr ? parseInt(limitStr, 10) : 100,
            offset: offsetStr ? parseInt(offsetStr, 10) : 0,
        };

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

        // Validate limit and offset
        if (filters.limit && (filters.limit < 1 || filters.limit > 1000)) {
            return NextResponse.json(
                {
                    success: false,
                    error: 'Invalid limit parameter (must be between 1 and 1000)',
                },
                { status: 400 }
            );
        }

        if (filters.offset && filters.offset < 0) {
            return NextResponse.json(
                {
                    success: false,
                    error: 'Invalid offset parameter (must be >= 0)',
                },
                { status: 400 }
            );
        }

        // Get session history
        const sessions = await sessionTracker.getSessionHistory(filters);

        // Get total count for pagination (without limit/offset)
        const countFilters: SessionFilters = {
            tenantId: filters.tenantId,
            status: filters.status,
            startDate: filters.startDate,
            endDate: filters.endDate,
        };
        const allSessions = await sessionTracker.getSessionHistory(countFilters);
        const totalCount = allSessions.length;

        return NextResponse.json({
            success: true,
            data: {
                sessions,
                pagination: {
                    total: totalCount,
                    limit: filters.limit || 100,
                    offset: filters.offset || 0,
                    hasMore: (filters.offset || 0) + sessions.length < totalCount,
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
