import { NextRequest, NextResponse } from 'next/server';
import { sessionTracker } from '@/lib/services/session-tracker';
import { getCachedSession } from "@/lib/auth/cached-session";
import { withRequestContextAndRateLimit } from "@/lib/middleware/with-request-context";

/**
 * POST /api/v1/admin/sessions/clear
 * Clear completed and failed sessions
 *
 * Body Parameters:
 * - tenantId: Optional tenant ID to filter clearing
 *
 * This endpoint is useful for clearing old logs before starting new scraping sessions
 */
async function handlePOST(request: NextRequest) {
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

        // Parse request body
        const body = await request.json().catch(() => ({}));
        const tenantId = body.tenantId || undefined;

        // Clear completed sessions
        const count = await sessionTracker.clearCompletedSessions(tenantId);

        return NextResponse.json({
            success: true,
            data: {
                cleared: count,
                message: `Successfully cleared ${count} completed/failed session(s)`,
            },
        });
    } catch (error) {
        console.error('[Clear Sessions API] Error:', error);
        return NextResponse.json(
            {
                success: false,
                error: 'Failed to clear sessions',
                details: error instanceof Error ? error.message : 'Unknown error',
            },
            { status: 500 }
        );
    }
}

export async function POST(req: NextRequest) {
    return withRequestContextAndRateLimit(req, 'write', () => handlePOST(req));
}
