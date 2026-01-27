import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { sessionTracker } from '@/lib/services/session-tracker';

/**
 * POST /api/v1/admin/sessions/[id]/cancel
 * Cancel a scraping session
 *
 * Requirements: 12.1, 12.5
 */
export async function POST(
    request: NextRequest,
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

        // Parse request body for optional reason
        let reason: string | undefined;
        try {
            const body = await request.json();
            reason = body.reason;
        } catch {
            // No body provided, that's okay
        }

        // Cancel the session
        const result = await sessionTracker.cancelSession(sessionId, reason);

        if (!result.success) {
            return NextResponse.json(
                {
                    success: false,
                    error: result.message,
                },
                { status: 400 }
            );
        }

        return NextResponse.json({
            success: true,
            message: result.message,
        });
    } catch (error) {
        console.error('[Session Cancel API] Error:', error);
        return NextResponse.json(
            {
                success: false,
                error: 'Failed to cancel session',
                details: error instanceof Error ? error.message : 'Unknown error',
            },
            { status: 500 }
        );
    }
}
