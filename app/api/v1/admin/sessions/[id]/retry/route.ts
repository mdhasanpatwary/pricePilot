import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { sessionTracker } from '@/lib/services/session-tracker';
import { withRateLimit } from '@/lib/middleware/ratelimit';

/**
 * POST /api/v1/admin/sessions/[id]/retry
 * Retry a failed scraping session with optional configuration overrides
 *
 * Requirements: 12.2
 */
async function handlePOST(
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

        // Parse request body for optional overrides
        let overrides: { proxy?: string; userAgent?: string } | undefined;
        try {
            const body = await request.json();
            overrides = {
                proxy: body.proxy,
                userAgent: body.userAgent,
            };
        } catch {
            // No body provided, that's okay
        }

        // Retry the session
        const result = await sessionTracker.retrySession(sessionId, overrides);

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
            newSessionId: result.newSessionId,
        });
    } catch (error) {
        console.error('[Session Retry API] Error:', error);
        return NextResponse.json(
            {
                success: false,
                error: 'Failed to retry session',
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
