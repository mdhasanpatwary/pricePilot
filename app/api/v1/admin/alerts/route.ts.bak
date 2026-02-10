/**
 * Admin Alerts API - Get system alerts
 * 
 * GET /api/v1/admin/alerts?acknowledged=false
 * 
 * Returns alerts for the system health monitor
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { withRateLimit } from '@/lib/middleware/ratelimit';

/**
 * GET /api/v1/admin/alerts
 * 
 * Get system alerts with optional filtering
 */
async function handleGET(request: NextRequest) {
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

        // Check if user is admin
        const user = session.user as any;
        const isAdmin = user.role === "ADMIN" || user.isSuperAdmin === true;

        if (!isAdmin) {
            return NextResponse.json(
                {
                    success: false,
                    error: {
                        code: 'FORBIDDEN',
                        message: 'Admin access required',
                    },
                },
                { status: 403 }
            );
        }

        // Get user's tenant
        const dbUser = await prisma.user.findUnique({
            where: { id: session.user.id },
            select: { tenantId: true },
        });

        if (!dbUser?.tenantId) {
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
            // Get unacknowledged alerts with full data
            const alerts = await prisma.scrapingAlert.findMany({
                where: {
                    tenantId: dbUser.tenantId,
                    acknowledged: false,
                },
                orderBy: {
                    createdAt: 'desc',
                },
                take: 50, // Limit to 50 most recent
            });

            // Transform to match expected format
            const transformedAlerts = alerts.map(alert => ({
                id: alert.id,
                title: alert.type || 'System Alert',
                message: alert.message,
                severity: mapSeverity(alert.severity),
                createdAt: alert.createdAt,
                acknowledged: alert.acknowledged,
            }));

            return NextResponse.json({
                success: true,
                data: transformedAlerts,
            });
        }

        // Default: return all alerts
        const alerts = await prisma.scrapingAlert.findMany({
            where: {
                tenantId: dbUser.tenantId,
            },
            orderBy: {
                createdAt: 'desc',
            },
            take: 100,
        });

        const transformedAlerts = alerts.map(alert => ({
            id: alert.id,
            title: alert.type || 'System Alert',
            message: alert.message,
            severity: mapSeverity(alert.severity),
            createdAt: alert.createdAt,
            acknowledged: alert.acknowledged,
        }));

        return NextResponse.json({
            success: true,
            data: transformedAlerts,
        });
    } catch (error) {
        console.error('Failed to fetch alerts:', error);
        return NextResponse.json(
            {
                success: false,
                error: {
                    code: 'INTERNAL_ERROR',
                    message: 'Failed to fetch alerts',
                },
            },
            { status: 500 }
        );
    }
}

function mapSeverity(severity: string | null): 'critical' | 'warning' | 'info' {
    if (!severity) return 'info';
    const lower = severity.toLowerCase();
    if (lower === 'critical' || lower === 'error') return 'critical';
    if (lower === 'warning' || lower === 'warn') return 'warning';
    return 'info';
}

export async function GET(req: NextRequest) {
    return withRateLimit(req, 'read', handleGET);
}
