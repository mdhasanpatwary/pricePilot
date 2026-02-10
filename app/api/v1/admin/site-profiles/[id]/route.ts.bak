import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { withRateLimit } from '@/lib/middleware/ratelimit';

/**
 * DELETE /api/v1/admin/site-profiles/:id
 * 
 * Delete a site profile from the database
 * 
 * Requirements: 8.8
 */
async function handleDELETE(
    _request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        // Authenticate and verify admin role
        const session = await getServerSession(authOptions);

        if (!session?.user) {
            return NextResponse.json(
                { error: 'Unauthorized', message: 'Authentication required' },
                { status: 401 }
            );
        }

        // Check if user is super admin
        const user = await prisma.user.findUnique({
            where: { id: session.user.id },
            select: { isSuperAdmin: true, role: true }
        });

        if (!user?.isSuperAdmin && user?.role !== 'ADMIN') {
            return NextResponse.json(
                { error: 'Forbidden', message: 'Admin access required' },
                { status: 403 }
            );
        }

        const { id } = await params;

        // Validate profile exists
        const existingProfile = await prisma.siteProfile.findUnique({
            where: { id }
        });

        if (!existingProfile) {
            return NextResponse.json(
                {
                    success: false,
                    error: 'Not Found',
                    message: 'Site profile not found'
                },
                { status: 404 }
            );
        }

        // Delete the profile
        await prisma.siteProfile.delete({
            where: { id }
        });

        logger.info('[API] Site profile deleted', {
            id,
            domain: existingProfile.domain
        });

        return NextResponse.json({
            success: true,
            message: 'Site profile deleted successfully'
        });

    } catch (error) {
        logger.error('[API] Error deleting site profile', { error });
        return NextResponse.json(
            {
                success: false,
                error: 'Internal Server Error',
                message: 'Failed to delete site profile',
                details: error instanceof Error ? error.message : 'Unknown error'
            },
            { status: 500 }
        );
    }
}

export async function DELETE(
    req: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    return withRateLimit(req, 'write', () => handleDELETE(req, context));
}
