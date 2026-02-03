/**
 * Monitoring Health API Endpoint
 * 
 * GET /api/v1/monitoring/health
 * 
 * Returns overall system health status including:
 * - System status (healthy, degraded, critical)
 * - Error rate
 * - Average response time
 * - Active alerts count
 * - Component health statuses
 * 
 * Requirements: 6.1, 6.2, 6.5, 6.6, 6.8
 * 
 * Authentication: Required (Admin role only)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { monitoringDashboardService } from '@/lib/services/monitoring/dashboard';
import { withRateLimit } from '@/lib/middleware/ratelimit';
import { logger } from '@/lib/logger';

/**
 * GET handler for system health endpoint
 */
async function handleGET(_req: NextRequest) {
    try {
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

        // Check admin role (ADMIN role or super admin)
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

        // Get system health
        const health = await monitoringDashboardService.getSystemHealth();

        logger.info('System health retrieved', {
            userId: session.user.id,
            status: health.status,
            activeAlerts: health.activeAlerts,
        });

        return NextResponse.json({
            success: true,
            data: health,
            meta: {
                requestId: crypto.randomUUID(),
                timestamp: new Date().toISOString(),
            },
        });
    } catch (error) {
        logger.error('Failed to get system health', {
            error: error instanceof Error ? error.message : String(error),
        });

        return NextResponse.json(
            {
                success: false,
                error: {
                    code: 'INTERNAL_ERROR',
                    message: 'Failed to retrieve system health',
                    details: error instanceof Error ? error.message : String(error),
                },
            },
            { status: 500 }
        );
    }
}

export async function GET(req: NextRequest) {
    return withRateLimit(req, 'read', handleGET);
}
