import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { sessionTracker } from '@/lib/services/session-tracker';

/**
 * GET /api/v1/admin/sessions/[id]
 * Get detailed information for a specific session
 *
 * Requirements: 2.1, 2.2, 2.3, 2.4, 2.5
 */
export async function GET(
    _request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
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

        const { id: sessionId } = await params;

        // Get session details
        const sessionData = await sessionTracker.getSession(sessionId);

        if (!sessionData) {
            return NextResponse.json(
                {
                    success: false,
                    error: 'Session not found',
                },
                { status: 404 }
            );
        }

        return NextResponse.json({
            success: true,
            data: sessionData,
        });
    } catch (error) {
        console.error('[Session Detail API] Error:', error);
        return NextResponse.json(
            {
                success: false,
                error: 'Failed to fetch session details',
                details: error instanceof Error ? error.message : 'Unknown error',
            },
            { status: 500 }
        );
    }
}
