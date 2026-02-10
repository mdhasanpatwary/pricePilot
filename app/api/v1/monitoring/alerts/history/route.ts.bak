/**
 * Monitoring Alert History API Endpoint
 * 
 * GET /api/v1/monitoring/alerts/history
 * 
 * Returns alert history with pagination.
 * 
 * Query Parameters:
 * - limit: Maximum number of alerts to return (default: 50, max: 500)
 * - tenantId: Optional tenant ID for filtering (super admin only)
 * 
 * Requirements: 6.5, 6.8, 9.5
 * 
 * Authentication: Required (Admin role only)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { monitoringDashboardService } from '@/lib/services/monitoring/dashboard';
import { withRateLimit } from '@/lib/middleware/ratelimit';
import { logger } from '@/lib/logger';
import { z } from 'zod';

/**
 * Query parameter validation schema
 */
const historyQuerySchema = z.object({
    limit: z.coerce.number().int().min(1).max(500).default(50),
    tenantId: z.string().min(1).optional(),
});

/**
 * GET handler for alert history endpoint
 */
async function handleGET(req: NextRequest) {
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

        // Parse and validate query parameters
        const searchParams = req.nextUrl.searchParams;
        const tenantIdParam = searchParams.get('tenantId');
        const queryParams = {
            limit: searchParams.get('limit') || '50',
            // Keep empty string to let Zod validate it, only convert null to undefined
            tenantId: tenantIdParam === null ? undefined : tenantIdParam,
        };

        const validationResult = historyQuerySchema.safeParse(queryParams);

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

        const { limit, tenantId } = validationResult.data;

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

        // Get alert history
        const history = await monitoringDashboardService.getAlertHistory(limit, tenantId);

        logger.info('Alert history retrieved', {
            userId: session.user.id,
            historyCount: history.length,
            limit,
            tenantId,
        });

        return NextResponse.json({
            success: true,
            data: {
                alerts: history,
                count: history.length,
                limit,
            },
            meta: {
                requestId: crypto.randomUUID(),
                timestamp: new Date().toISOString(),
            },
        });
    } catch (error) {
        logger.error('Failed to get alert history', {
            error: error instanceof Error ? error.message : String(error),
        });

        return NextResponse.json(
            {
                success: false,
                error: {
                    code: 'INTERNAL_ERROR',
                    message: 'Failed to retrieve alert history',
                    details: error instanceof Error ? error.message : String(error),
                },
            },
            { status: 500 }
        );
    }
}

export async function GET(req: NextRequest) {
    return withRateLimit(req, 'read', () => handleGET(req));
}
