/**
 * Maintenance Window Detail API Endpoint
 * 
 * DELETE /api/v1/monitoring/maintenance-window/:id - Delete a maintenance window
 * 
 * Requirements: 7.4
 * 
 * Authentication: Required (Admin role only)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { alertConfigurationService } from '@/lib/services/monitoring/alert-configuration';
import { withRateLimit } from '@/lib/middleware/ratelimit';
import { logger } from '@/lib/logger';

/**
 * DELETE handler - Delete a maintenance window
 */
async function handleDELETE(
    _req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;

        // Check authentication
        const session = await getServerSession(authOptions);

        if (!session?.user) {
            return NextResponse.json(
                {
                    success: false,
                    error: {
                        code: 'UNAUTHORIZED',
                        message: 'Authentication required',
                    }
                },
                { status: 401 }
            );
        }

        // Check admin role
        const isAdmin = session.user.role === 'ADMIN' || session.user.isSuperAdmin === true;

        if (!isAdmin) {
            return NextResponse.json(
                {
                    success: false,
                    error: {
                        code: 'FORBIDDEN',
                        message: 'Admin access required',
                    }
                },
                { status: 403 }
            );
        }

        // Delete maintenance window
        await alertConfigurationService.deleteMaintenanceWindow(id);

        logger.info('Maintenance window deleted', {
            userId: session.user.id,
            windowId: id,
        });

        return NextResponse.json(
            {
                success: true,
                data: {
                    message: 'Maintenance window deleted successfully',
                },
                meta: {
                    requestId: crypto.randomUUID(),
                    timestamp: new Date().toISOString(),
                },
            },
            { status: 200 }
        );
    } catch (error) {
        const { id } = await params;
        logger.error('Failed to delete maintenance window', {
            error: error instanceof Error ? error.message : String(error),
            windowId: id,
        });

        const status = error instanceof Error && error.message.includes('not found') ? 404 : 500;

        return NextResponse.json(
            {
                success: false,
                error: {
                    code: status === 404 ? 'NOT_FOUND' : 'INTERNAL_ERROR',
                    message: error instanceof Error ? error.message : 'Failed to delete maintenance window',
                },
            },
            { status }
        );
    }
}

export async function DELETE(req: NextRequest, context: { params: Promise<{ id: string }> }) {
    return withRateLimit(req, 'write', (r) => handleDELETE(r, context));
}
