import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { sessionTracker } from '@/lib/services/session-tracker';
import { withRateLimit } from '@/lib/middleware/ratelimit';

/**
 * POST /api/v1/admin/sessions/bulk
 * Perform bulk operations on multiple sessions
 *
 * Request Body:
 * {
 *   operation: 'pause' | 'resume' | 'cancel',
 *   sessionIds: string[],
 *   reason?: string (for cancel operation)
 * }
 *
 * Requirements: 12.3
 */
async function handlePOST(request: NextRequest) {
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

        // Parse request body
        const body = await request.json();
        const { operation, sessionIds, reason } = body;

        // Validate input
        if (!operation || !Array.isArray(sessionIds) || sessionIds.length === 0) {
            return NextResponse.json(
                {
                    success: false,
                    error: 'Invalid request: operation and sessionIds are required',
                },
                { status: 400 }
            );
        }

        if (!['pause', 'resume', 'cancel'].includes(operation)) {
            return NextResponse.json(
                {
                    success: false,
                    error: 'Invalid operation: must be pause, resume, or cancel',
                },
                { status: 400 }
            );
        }

        // Perform bulk operation
        let results;
        switch (operation) {
            case 'pause':
                results = await sessionTracker.bulkPauseSessions(sessionIds);
                break;
            case 'resume':
                results = await sessionTracker.bulkResumeSessions(sessionIds);
                break;
            case 'cancel':
                results = await sessionTracker.bulkCancelSessions(sessionIds, reason);
                break;
            default:
                return NextResponse.json(
                    {
                        success: false,
                        error: 'Invalid operation',
                    },
                    { status: 400 }
                );
        }

        // Calculate summary
        const successCount = results.filter(r => r.success).length;
        const failureCount = results.filter(r => !r.success).length;

        return NextResponse.json({
            success: true,
            operation,
            summary: {
                total: sessionIds.length,
                successful: successCount,
                failed: failureCount,
            },
            results,
        });
    } catch (error) {
        console.error('[Bulk Session Operations API] Error:', error);
        return NextResponse.json(
            {
                success: false,
                error: 'Failed to perform bulk operation',
                details: error instanceof Error ? error.message : 'Unknown error',
            },
            { status: 500 }
        );
    }
}

export async function POST(req: NextRequest) {
    return withRateLimit(req, 'write', () => handlePOST(req));
}
