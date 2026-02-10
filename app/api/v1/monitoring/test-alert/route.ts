/**
 * Test Alert API Endpoint
 * 
 * POST /api/v1/monitoring/test-alert - Send a test alert through all configured channels
 * 
 * Requirements: 10.1, 10.2, 10.3
 * 
 * Authentication: Required (Admin role only)
 */

import { NextRequest, NextResponse } from 'next/server';
import { notificationRouter } from '@/lib/services/monitoring/notification-router';
import { logger } from '@/lib/logger';
import { z } from 'zod';
import type { TriggeredAlert } from '@/lib/services/monitoring/alert-rules-evaluator';
import { getCachedSession } from "@/lib/auth/cached-session";
import { withRequestContextAndRateLimit } from "@/lib/middleware/with-request-context";

/**
 * Request body schema
 */
const testAlertSchema = z.object({
    channels: z.array(z.string()).min(1, 'At least one channel is required'),
    severity: z.enum(['CRITICAL', 'WARNING', 'INFO']).optional().default('INFO'),
    message: z.string().optional(),
});

/**
 * POST handler - Send a test alert
 * 
 * Requirements:
 * - 10.1: Provide test endpoint to trigger sample alerts
 * - 10.2: Send notifications through all configured channels
 * - 10.3: Mark test alerts clearly in notifications
 */
async function handlePOST(req: NextRequest) {
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

        // Parse and validate request body
        const body = await req.json();
        const validation = testAlertSchema.safeParse(body);

        if (!validation.success) {
            return NextResponse.json(
                {
                    success: false,
                    error: {
                        code: 'VALIDATION_ERROR',
                        message: 'Invalid request body',
                        details: validation.error.format(),
                    }
                },
                { status: 400 }
            );
        }

        const { channels, severity, message } = validation.data;

        // Create a test alert (Requirement 10.3: Mark as test)
        const testAlert: TriggeredAlert = {
            ruleId: 'test-alert',
            ruleName: '🧪 Test Alert',
            severity: severity,
            triggeredAt: new Date(),
            metricValue: 100,
            threshold: 50,
            tenantId: null,
            context: {
                isTest: true, // Mark as test alert
                testMessage: message || 'This is a test alert to verify notification delivery',
                triggeredBy: session.user.email || session.user.id,
                metricType: 'test',
            },
        };

        logger.info('Sending test alert', {
            userId: session.user.id,
            channels,
            severity,
        });

        // Send notification through all configured channels (Requirement 10.2)
        const results = await notificationRouter.sendNotification(testAlert, channels);

        // Calculate statistics
        const successCount = results.filter(r => r.success).length;
        const failureCount = results.length - successCount;

        logger.info('Test alert sent', {
            userId: session.user.id,
            totalChannels: results.length,
            successCount,
            failureCount,
        });

        return NextResponse.json({
            success: true,
            data: {
                alert: {
                    ruleName: testAlert.ruleName,
                    severity: testAlert.severity,
                    triggeredAt: testAlert.triggeredAt,
                    isTest: true,
                },
                deliveryResults: results,
                statistics: {
                    totalChannels: results.length,
                    successCount,
                    failureCount,
                    successRate: results.length > 0 ? (successCount / results.length) * 100 : 0,
                },
            },
            meta: {
                requestId: crypto.randomUUID(),
                timestamp: new Date().toISOString(),
            },
        });
    } catch (error) {
        logger.error('Failed to send test alert', {
            error: error instanceof Error ? error.message : String(error),
        });

        return NextResponse.json(
            {
                success: false,
                error: {
                    code: 'INTERNAL_ERROR',
                    message: error instanceof Error ? error.message : 'Failed to send test alert',
                },
            },
            { status: 500 }
        );
    }
}

export async function POST(req: NextRequest) {
    return withRequestContextAndRateLimit(req, 'write', handlePOST);
}
