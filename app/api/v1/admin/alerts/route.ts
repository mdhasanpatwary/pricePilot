/**
 * Admin Alerts API - Get unacknowledged alert count
 * 
 * GET /api/v1/admin/alerts?acknowledged=false
 * 
 * Returns the count of unacknowledged alerts for the admin sidebar badge
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/v1/admin/alerts
 * 
 * Get unacknowledged alert count
 */
export async function GET(request: NextRequest) {
    try {
        // Authenticate user
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) {
            return NextResponse.json(
                {
                    success: false,
                    error: {
                        code: 'UNAUTHORIZED',
                        message: 'Authentication required',
                    },
                },
                { status: 401 }
            );
        }

        // Get user's tenant
        const user = await prisma.user.findUnique({
            where: { id: session.user.id },
            select: { tenantId: true },
        });

        if (!user?.tenantId) {
            return NextResponse.json(
                {
                    success: false,
                    error: {
                        code: 'FORBIDDEN',
                        message: 'User not associated with a tenant',
                    },
                },
                { status: 403 }
            );
        }

        // Check if filtering for unacknowledged
        const acknowledged = request.nextUrl.searchParams.get('acknowledged');

        if (acknowledged === 'false') {
            // Count unacknowledged alerts
            const count = await prisma.scrapingAlert.count({
                where: {
                    tenantId: user.tenantId,
                    acknowledged: false,
                },
            });

            return NextResponse.json({
                success: true,
                unacknowledgedCount: count,
            });
        }

        // Default: return all alerts count
        const count = await prisma.scrapingAlert.count({
            where: {
                tenantId: user.tenantId,
            },
        });

        return NextResponse.json({
            success: true,
            totalCount: count,
        });
    } catch (error) {
        console.error('Failed to fetch alert count:', error);
        return NextResponse.json(
            {
                success: false,
                error: {
                    code: 'INTERNAL_ERROR',
                    message: 'Failed to fetch alert count',
                },
            },
            { status: 500 }
        );
    }
}
