/**
 * Alerts API Endpoint
 * 
 * GET /api/v1/alerts?severity=critical&acknowledged=false
 * - Fetch alerts from database
 * - Support filtering by acknowledged status and severity
 * - Sort unacknowledged alerts first
 * 
 * Requirements: 12.4, 12.6
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { withRateLimit } from '@/lib/middleware/ratelimit';

async function handleGET(request: NextRequest) {
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

        // Parse query parameters
        const searchParams = request.nextUrl.searchParams;
        const acknowledgedParam = searchParams.get('acknowledged');
        const severityParam = searchParams.get('severity');

        // Build filter conditions
        const where: any = {};

        // Filter by acknowledged status if provided
        if (acknowledgedParam !== null) {
            where.acknowledged = acknowledgedParam === 'true';
        }

        // Filter by severity if provided
        if (severityParam) {
            const validSeverities = ['critical', 'warning', 'info'];
            if (validSeverities.includes(severityParam)) {
                where.severity = severityParam;
            }
        }

        // Fetch alerts from database
        // Sort unacknowledged alerts first, then by creation date (newest first)
        const alerts = await prisma.alert.findMany({
            where,
            orderBy: [
                { acknowledged: 'asc' },  // false (unacknowledged) comes before true
                { createdAt: 'desc' },    // newest first
            ],
        });

        // Calculate unacknowledged count
        const unacknowledgedCount = await prisma.alert.count({
            where: {
                acknowledged: false,
            },
        });

        logger.info('Alerts fetched successfully', {
            userId: session.user.id,
            totalAlerts: alerts.length,
            unacknowledgedCount,
            filters: { acknowledged: acknowledgedParam, severity: severityParam },
        });

        return NextResponse.json({
            alerts,
            unacknowledgedCount,
        });
    } catch (error) {
        logger.error('Failed to fetch alerts', { error });
        return NextResponse.json(
            {
                error: 'Internal Server Error',
                message: 'Failed to fetch alerts',
                details: error instanceof Error ? error.message : 'Unknown error',
            },
            { status: 500 }
        );
    }
}

export async function GET(req: NextRequest) {
    return withRateLimit(req, 'read', handleGET);
}
