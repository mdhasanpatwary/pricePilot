/**
 * Uptime Monitoring API Endpoint
 *
 * GET /api/v1/monitoring/uptime
 *
 * Returns system uptime statistics including:
 * - Current system status
 * - Uptime percentage for various time periods
 * - Downtime incidents
 * - SLA compliance status
 *
 * Query Parameters:
 * - period: Time period in days (default: 30)
 * - includeIncidents: Include downtime incidents (default: false)
 *
 * Requirements: System uptime >99.9% maintained
 *
 * Authentication: Required (Admin role only)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { uptimeTracker } from '@/lib/services/monitoring/uptime-tracker';
import { withRateLimit } from '@/lib/middleware/ratelimit';
import { logger } from '@/lib/logger';

/**
 * GET handler for uptime statistics endpoint
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
                    },
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
                    },
                },
                { status: 403 }
            );
        }

        // Parse query parameters
        const { searchParams } = new URL(req.url);
        const period = parseInt(searchParams.get('period') || '30');
        const includeIncidents = searchParams.get('includeIncidents') === 'true';

        // Validate period
        if (period < 1 || period > 365) {
            return NextResponse.json(
                {
                    success: false,
                    error: {
                        code: 'VALIDATION_ERROR',
                        message: 'Period must be between 1 and 365 days',
                    },
                },
                { status: 422 }
            );
        }

        // Get current status
        const currentStatus = await uptimeTracker.getCurrentStatus();

        // Get uptime statistics for requested period
        const stats = await uptimeTracker.getUptimeStats(period);

        // Get uptime for common periods
        const last24Hours = await uptimeTracker.getUptimeStats(1);
        const last7Days = await uptimeTracker.getUptimeStats(7);
        const last30Days = await uptimeTracker.getUptimeStats(30);

        // Build response
        const response: any = {
            currentStatus,
            stats,
            periods: {
                last24Hours,
                last7Days,
                last30Days,
            },
            slaTarget: 99.9,
            slaCompliant: stats.slaCompliant,
        };

        // Include incidents if requested
        if (includeIncidents) {
            const incidents = await uptimeTracker.getDowntimeIncidents(period);
            response.incidents = incidents;
        }

        logger.info('Uptime statistics retrieved', {
            userId: session.user.id,
            period,
            uptimePercentage: stats.uptimePercentage,
            slaCompliant: stats.slaCompliant,
        });

        return NextResponse.json({
            success: true,
            data: response,
            meta: {
                requestId: crypto.randomUUID(),
                timestamp: new Date().toISOString(),
            },
        });
    } catch (error) {
        logger.error('Failed to get uptime statistics', {
            error: error instanceof Error ? error.message : String(error),
        });

        return NextResponse.json(
            {
                success: false,
                error: {
                    code: 'INTERNAL_ERROR',
                    message: 'Failed to retrieve uptime statistics',
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
