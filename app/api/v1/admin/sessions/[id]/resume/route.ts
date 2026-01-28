import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { sessionTracker } from '@/lib/services/session-tracker';
import { withRateLimit } from '@/lib/middleware/ratelimit';

/**
 * POST /api/v1/admin/sessions/[id]/resume
 * Resume a paused scraping session
 *
 * Requirements: 12.1, 12.4
 */
async function handlePOST(
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

        // Resume the session
        const result = await sessionTracker.resumeSession(sessionId);

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
        console.error('[Session Resume API] Error:', error);
        return NextResponse.json(
            {
                success: false,
                error: 'Failed to resume session',
                details: error instanceof Error ? error.message : 'Unknown error',
            },
            { status: 500 }
        );
    }
}

export async function POST(
    req: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    return withRateLimit(req, 'write', () => handlePOST(req, context));
}
