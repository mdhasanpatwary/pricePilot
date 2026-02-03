/**
 * Alert Delivery Statistics API Endpoint
 * 
 * GET /api/v1/monitoring/delivery-stats - Get alert delivery statistics
 * 
 * Requirements: 10.4, 10.5
 * 
 * Authentication: Required (Admin role only)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { withRateLimit } from '@/lib/middleware/ratelimit';
import { logger } from '@/lib/logger';

/**
 * GET handler - Get alert delivery statistics
 * 
 * Requirements:
 * - 10.4: Log all alert deliveries with success/failure status
 * - 10.5: Display alert delivery statistics
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

        // Get query parameters
        const searchParams = req.nextUrl.searchParams;
        const timeRange = searchParams.get('timeRange') || '24h';
        const channelId = searchParams.get('channelId');

        // Calculate time range
        const now = new Date();
        let startTime = new Date();

        switch (timeRange) {
            case '1h':
                startTime = new Date(now.getTime() - 60 * 60 * 1000);
                break;
            case '24h':
                startTime = new Date(now.getTime() - 24 * 60 * 60 * 1000);
                break;
            case '7d':
                startTime = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                break;
            case '30d':
                startTime = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
                break;
            default:
                startTime = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        }

        // Fetch alert history with notifications
        const alertHistory = await prisma.monitoringAlertHistory.findMany({
            where: {
                triggeredAt: {
                    gte: startTime,
                },
            },
            orderBy: {
                triggeredAt: 'desc',
            },
        });

        // Calculate statistics
        let totalAlerts = 0;
        let totalNotifications = 0;
        let successfulNotifications = 0;
        let failedNotifications = 0;
        const channelStats: Record<string, {
            sent: number;
            delivered: number;
            failed: number;
            successRate: number;
        }> = {};

        for (const alert of alertHistory) {
            totalAlerts++;

            const notifications = (alert.notificationsSent as any[]) || [];

            for (const notification of notifications) {
                // Filter by channel if specified
                if (channelId && notification.channel !== channelId) {
                    continue;
                }

                totalNotifications++;

                if (notification.success) {
                    successfulNotifications++;
                } else {
                    failedNotifications++;
                }

                // Update channel statistics
                const channel = notification.channel;
                if (!channelStats[channel]) {
                    channelStats[channel] = {
                        sent: 0,
                        delivered: 0,
                        failed: 0,
                        successRate: 0,
                    };
                }

                channelStats[channel].sent++;
                if (notification.success) {
                    channelStats[channel].delivered++;
                } else {
                    channelStats[channel].failed++;
                }
            }
        }

        // Calculate success rates for each channel
        for (const channel in channelStats) {
            const stats = channelStats[channel];
            stats.successRate = stats.sent > 0 ? (stats.delivered / stats.sent) * 100 : 0;
        }

        // Overall success rate
        const overallSuccessRate = totalNotifications > 0
            ? (successfulNotifications / totalNotifications) * 100
            : 0;

        // Get recent failures for troubleshooting
        const recentFailures = alertHistory
            .flatMap(alert => {
                const notifications = (alert.notificationsSent as any[]) || [];
                return notifications
                    .filter(n => !n.success && (!channelId || n.channel === channelId))
                    .map(n => ({
                        alertId: alert.id,
                        ruleName: alert.ruleName,
                        severity: alert.severity,
                        triggeredAt: alert.triggeredAt,
                        channel: n.channel,
                        error: n.error,
                        sentAt: n.sentAt,
                    }));
            })
            .slice(0, 10); // Last 10 failures

        logger.info('Retrieved alert delivery statistics', {
            userId: session.user.id,
            timeRange,
            channelId,
            totalAlerts,
            totalNotifications,
        });

        return NextResponse.json({
            success: true,
            data: {
                timeRange,
                startTime,
                endTime: now,
                overall: {
                    totalAlerts,
                    totalNotifications,
                    successfulNotifications,
                    failedNotifications,
                    successRate: overallSuccessRate,
                },
                byChannel: channelStats,
                recentFailures,
            },
            meta: {
                requestId: crypto.randomUUID(),
                timestamp: new Date().toISOString(),
            },
        });
    } catch (error) {
        logger.error('Failed to get delivery statistics', {
            error: error instanceof Error ? error.message : String(error),
        });

        return NextResponse.json(
            {
                success: false,
                error: {
                    code: 'INTERNAL_ERROR',
                    message: error instanceof Error ? error.message : 'Failed to get delivery statistics',
                },
            },
            { status: 500 }
        );
    }
}

export async function GET(req: NextRequest) {
    return withRateLimit(req, 'read', handleGET);
}
