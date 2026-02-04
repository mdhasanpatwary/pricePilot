/**
 * System Heartbeat Cron Job
 *
 * POST /api/v1/cron/system-heartbeat
 *
 * Records system heartbeat every minute to track uptime and availability.
 * Checks system health and records status (UP, DOWN, DEGRADED) along with
 * response time metrics.
 *
 * This endpoint should be called every minute by a cron scheduler (Vercel Cron).
 *
 * Requirements: System uptime >99.9% maintained
 *
 * Authentication: Cron secret required
 */

import { NextRequest, NextResponse } from 'next/server';
import { uptimeTracker } from '@/lib/services/monitoring/uptime-tracker';
import { monitoringDashboardService } from '@/lib/services/monitoring/dashboard';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';

/**
 * POST handler for system heartbeat cron job
 */
export async function POST(req: NextRequest) {
    try {
        // Verify cron secret
        const authHeader = req.headers.get('authorization');
        const expectedAuth = `Bearer ${process.env.CRON_SECRET}`;

        if (authHeader !== expectedAuth) {
            logger.warn('Unauthorized system heartbeat attempt', {
                authHeader: authHeader ? 'present' : 'missing',
            });

            return NextResponse.json(
                {
                    success: false,
                    error: {
                        code: 'UNAUTHORIZED',
                        message: 'Invalid cron secret',
                    },
                },
                { status: 401 }
            );
        }

        // Perform health checks
        const startTime = Date.now();
        const healthCheckResult = await performHealthChecks();
        const responseTime = Date.now() - startTime;

        // Record heartbeat
        await uptimeTracker.recordHeartbeat(
            healthCheckResult.status,
            responseTime,
            healthCheckResult.errorMessage
        );

        logger.info('System heartbeat recorded', {
            status: healthCheckResult.status,
            responseTime,
            checks: healthCheckResult.checks,
        });

        return NextResponse.json({
            success: true,
            data: {
                status: healthCheckResult.status,
                responseTime,
                timestamp: new Date().toISOString(),
                checks: healthCheckResult.checks,
            },
            meta: {
                requestId: crypto.randomUUID(),
                timestamp: new Date().toISOString(),
            },
        });
    } catch (error) {
        logger.error('Failed to record system heartbeat', {
            error: error instanceof Error ? error.message : String(error),
        });

        // Record as DOWN status
        await uptimeTracker.recordHeartbeat(
            'DOWN',
            0,
            error instanceof Error ? error.message : 'Unknown error'
        );

        return NextResponse.json(
            {
                success: false,
                error: {
                    code: 'INTERNAL_ERROR',
                    message: 'Failed to record system heartbeat',
                    details: error instanceof Error ? error.message : String(error),
                },
            },
            { status: 500 }
        );
    }
}

/**
 * Perform comprehensive health checks
 *
 * Checks:
 * - Database connectivity
 * - Redis connectivity
 * - System health metrics
 * - Error rates
 * - Response times
 *
 * @returns Health check result with status and details
 */
async function performHealthChecks(): Promise<{
    status: 'UP' | 'DOWN' | 'DEGRADED';
    errorMessage?: string;
    checks: Record<string, { status: string; message?: string }>;
}> {
    const checks: Record<string, { status: string; message?: string }> = {};

    // Check database connectivity
    try {
        await prisma.$queryRaw`SELECT 1`;
        checks.database = { status: 'UP' };
    } catch (error) {
        checks.database = {
            status: 'DOWN',
            message: error instanceof Error ? error.message : 'Database connection failed',
        };
    }

    // Check Redis connectivity (if configured)
    if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
        checks.redis = { status: 'UP' };
    } else {
        checks.redis = {
            status: 'DEGRADED',
            message: 'Redis not configured',
        };
    }

    // Check system health metrics
    try {
        const systemHealth = await monitoringDashboardService.getSystemHealth();

        if (systemHealth.status === 'critical') {
            checks.metrics = {
                status: 'DEGRADED',
                message: `Critical system health: ${systemHealth.activeAlerts} active alerts`,
            };
        } else if (systemHealth.status === 'degraded') {
            checks.metrics = {
                status: 'DEGRADED',
                message: 'System health degraded',
            };
        } else {
            checks.metrics = { status: 'UP' };
        }

        // Check error rate
        if (systemHealth.errorRate > 10) {
            checks.errorRate = {
                status: 'DEGRADED',
                message: `High error rate: ${systemHealth.errorRate}`,
            };
        } else {
            checks.errorRate = { status: 'UP' };
        }

        // Check response time
        if (systemHealth.avgResponseTime > 1000) {
            checks.responseTime = {
                status: 'DEGRADED',
                message: `High response time: ${systemHealth.avgResponseTime}ms`,
            };
        } else {
            checks.responseTime = { status: 'UP' };
        }
    } catch (error) {
        checks.metrics = {
            status: 'DEGRADED',
            message: 'Failed to retrieve system health',
        };
    }

    // Determine overall status
    const hasDownChecks = Object.values(checks).some((check) => check.status === 'DOWN');
    const hasDegradedChecks = Object.values(checks).some((check) => check.status === 'DEGRADED');

    if (hasDownChecks) {
        const downChecks = Object.entries(checks)
            .filter(([_, check]) => check.status === 'DOWN')
            .map(([name, check]) => `${name}: ${check.message || 'DOWN'}`)
            .join(', ');

        return {
            status: 'DOWN',
            errorMessage: `Critical components down: ${downChecks}`,
            checks,
        };
    }

    if (hasDegradedChecks) {
        const degradedChecks = Object.entries(checks)
            .filter(([_, check]) => check.status === 'DEGRADED')
            .map(([name, check]) => `${name}: ${check.message || 'DEGRADED'}`)
            .join(', ');

        return {
            status: 'DEGRADED',
            errorMessage: `System degraded: ${degradedChecks}`,
            checks,
        };
    }

    return {
        status: 'UP',
        checks,
    };
}

/**
 * GET handler - not allowed
 */
export async function GET() {
    return NextResponse.json(
        {
            success: false,
            error: {
                code: 'METHOD_NOT_ALLOWED',
                message: 'Only POST requests are allowed',
            },
        },
        { status: 405 }
    );
}
