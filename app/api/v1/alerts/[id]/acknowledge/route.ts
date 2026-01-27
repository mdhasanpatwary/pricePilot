/**
 * Alert Acknowledgment API Endpoint
 * 
 * POST /api/v1/alerts/:id/acknowledge
 * - Mark alert as acknowledged in database
 * - Update acknowledgedAt timestamp
 * - Return updated alert
 * 
 * Requirements: 12.5
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';

export async function POST(
    _request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        // Authenticate user
        const session = await getServerSession(authOptions);
        if (!session?.user) {
            return NextResponse.json(
                { error: 'Unauthorized', message: 'Authentication required' },
                { status: 401 }
            );
        }

        // Check if user is super admin (alerts are system-wide)
        const user = await prisma.user.findUnique({
            where: { id: session.user.id },
            select: { isSuperAdmin: true },
        });

        if (!user?.isSuperAdmin) {
            return NextResponse.json(
                { error: 'Forbidden', message: 'Admin access required' },
                { status: 403 }
            );
        }

        const { id: alertId } = await params;

        // Check if alert exists
        const existingAlert = await prisma.alert.findUnique({
            where: { id: alertId },
        });

        if (!existingAlert) {
            return NextResponse.json(
                { error: 'Not Found', message: 'Alert not found' },
                { status: 404 }
            );
        }

        // Update alert to acknowledged
        const updatedAlert = await prisma.alert.update({
            where: { id: alertId },
            data: {
                acknowledged: true,
                acknowledgedAt: new Date(),
            },
        });

        logger.info('Alert acknowledged', {
            userId: session.user.id,
            alertId,
            alertType: updatedAlert.type,
            severity: updatedAlert.severity,
        });

        return NextResponse.json({
            success: true,
            alert: updatedAlert,
        });
    } catch (error) {
        const errorParams = await params;
        logger.error('Failed to acknowledge alert', { error, alertId: errorParams.id });
        return NextResponse.json(
            {
                error: 'Internal Server Error',
                message: 'Failed to acknowledge alert',
                details: error instanceof Error ? error.message : 'Unknown error',
            },
            { status: 500 }
        );
    }
}
