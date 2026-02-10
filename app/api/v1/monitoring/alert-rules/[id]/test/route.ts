/**
 * Alert Rule Test API Endpoint
 *
 * POST /api/v1/monitoring/alert-rules/:id/test - Test an alert rule
 *
 * Requirements: 7.1, 10.1
 *
 * Authentication: Required (Admin role only)
 */

import { NextRequest, NextResponse } from 'next/server';
import { alertConfigurationService } from '@/lib/services/monitoring/alert-configuration';
import { logger } from '@/lib/logger';
import { getCachedSession } from "@/lib/auth/cached-session";
import { withRequestContextAndRateLimit } from "@/lib/middleware/with-request-context";

/**
 * POST handler - Test an alert rule
 *
 * Evaluates the alert rule immediately and returns whether it would trigger
 */
async function handlePOST(
    _req: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const { id } = params;

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

        // Test the alert rule
        const alert = await alertConfigurationService.testRule(id);

        logger.info('Alert rule tested', {
            userId: session.user.id,
            ruleId: id,
            triggered: alert !== null,
        });

        return NextResponse.json({
            success: true,
            data: {
                triggered: alert !== null,
                alert: alert || null,
                message: alert
                    ? `Alert would trigger: ${alert.ruleName} (${alert.metricValue} ${alert.severity})`
                    : 'Alert would not trigger (threshold not exceeded)',
            },
            meta: {
                requestId: crypto.randomUUID(),
                timestamp: new Date().toISOString(),
            },
        });
    } catch (error) {
        const { id } = params;
        logger.error('Failed to test alert rule', {
            error: error instanceof Error ? error.message : String(error),
            ruleId: id,
        });

        const status = error instanceof Error && error.message.includes('not found') ? 404 : 500;

        return NextResponse.json(
            {
                success: false,
                error: {
                    code: status === 404 ? 'NOT_FOUND' : 'INTERNAL_ERROR',
                    message: error instanceof Error ? error.message : 'Failed to test alert rule',
                },
            },
            { status }
        );
    }
}

export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
    const params = await context.params;
    return withRequestContextAndRateLimit(req, 'write', (r) => handlePOST(r, { params }));
}
