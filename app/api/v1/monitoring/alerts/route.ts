/**
 * Monitoring Active Alerts API Endpoint
 * 
 * GET /api/v1/monitoring/alerts
 * 
 * Returns currently active (unresolved) alerts.
 * 
 * Query Parameters:
 * - tenantId: Optional tenant ID for filtering (super admin only)
 * 
 * Requirements: 6.5, 6.8, 9.5
 * 
 * Authentication: Required (Admin role only)
 */

import { NextRequest, NextResponse } from 'next/server';
import { monitoringDashboardService } from '@/lib/services/monitoring/dashboard';
import { logger } from '@/lib/logger';
import { z } from 'zod';
import { getCachedSession } from "@/lib/auth/cached-session";
import { withRequestContextAndRateLimit } from "@/lib/middleware/with-request-context";

/**
 * Query parameter validation schema
 */
const alertsQuerySchema = z.object({
    tenantId: z.string().min(1).optional(),
});

/**
 * GET handler for active alerts endpoint
 */
async function handleGET(req: NextRequest) {
    try {
        // Check authentication
        const session = await getCachedSession();

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

        // Parse and validate query parameters
        const searchParams = req.nextUrl.searchParams;
        const tenantIdParam = searchParams.get('tenantId');
        const queryParams = {
            // Keep empty string to let Zod validate it, only convert null to undefined
            tenantId: tenantIdParam === null ? undefined : tenantIdParam,
        };

        const validationResult = alertsQuerySchema.safeParse(queryParams);

        if (!validationResult.success) {
            return NextResponse.json(
                {
                    success: false,
                    error: {
                        code: 'VALIDATION_ERROR',
                        message: 'Invalid query parameters',
                        details: {
                            fields: validationResult.error.flatten().fieldErrors,
                        },
                    },
                },
                { status: 422 }
            );
        }

        const { tenantId } = validationResult.data;

        // Only super admins can filter by tenant
        if (tenantId && !session.user.isSuperAdmin) {
            return NextResponse.json(
                {
                    success: false,
                    error: {
                        code: 'FORBIDDEN',
                        message: 'Only super admins can filter by tenant',
                    }
                },
                { status: 403 }
            );
        }

        // Get active alerts
        const alerts = await monitoringDashboardService.getActiveAlerts(tenantId);

        logger.info('Active alerts retrieved', {
            userId: session.user.id,
            alertCount: alerts.length,
            tenantId,
        });

        return NextResponse.json({
            success: true,
            data: {
                alerts,
                count: alerts.length,
            },
            meta: {
                requestId: crypto.randomUUID(),
                timestamp: new Date().toISOString(),
            },
        });
    } catch (error) {
        logger.error('Failed to get active alerts', {
            error: error instanceof Error ? error.message : String(error),
        });

        return NextResponse.json(
            {
                success: false,
                error: {
                    code: 'INTERNAL_ERROR',
                    message: 'Failed to retrieve active alerts',
                    details: error instanceof Error ? error.message : String(error),
                },
            },
            { status: 500 }
        );
    }
}

export async function GET(req: NextRequest) {
    return withRequestContextAndRateLimit(req, 'read', () => handleGET(req));
}
