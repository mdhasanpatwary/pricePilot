/**
 * Alert Rules API Endpoints
 * 
 * GET /api/v1/monitoring/alert-rules - List all alert rules
 * POST /api/v1/monitoring/alert-rules - Create a new alert rule
 * 
 * Requirements: 7.1, 7.2, 7.3, 7.5
 * 
 * Authentication: Required (Admin role only)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { alertConfigurationService } from '@/lib/services/monitoring/alert-configuration';
import { withRateLimit } from '@/lib/middleware/ratelimit';
import { logger } from '@/lib/logger';
import { z } from 'zod';

/**
 * Validation schema for alert rule creation
 */
const createAlertRuleSchema = z.object({
    name: z.string().min(1).max(255),
    description: z.string().optional().default(''),
    severity: z.enum(['CRITICAL', 'WARNING', 'INFO']),
    enabled: z.boolean().default(true),
    metricType: z.string().min(1),
    condition: z.object({
        operator: z.enum(['GT', 'GTE', 'LT', 'LTE', 'EQ']),
        aggregation: z.enum(['COUNT', 'AVG', 'SUM', 'MAX', 'MIN', 'P95', 'P99']),
    }),
    timeWindow: z.number().positive().max(86400), // Max 24 hours
    threshold: z.number(),
    notificationChannels: z.array(z.string()),
    tenantId: z.string().optional().nullable(),
});

/**
 * GET handler - List all alert rules
 * 
 * Query parameters:
 * - tenantId: Optional tenant ID to filter rules
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
        const { searchParams } = new URL(req.url);
        const tenantId = searchParams.get('tenantId') || undefined;

        // List alert rules
        const rules = await alertConfigurationService.listRules(tenantId);

        logger.info('Alert rules listed', {
            userId: session.user.id,
            tenantId,
            count: rules.length,
        });

        return NextResponse.json({
            success: true,
            data: {
                rules,
                count: rules.length,
            },
            meta: {
                requestId: crypto.randomUUID(),
                timestamp: new Date().toISOString(),
            },
        });
    } catch (error) {
        logger.error('Failed to list alert rules', {
            error: error instanceof Error ? error.message : String(error),
        });

        return NextResponse.json(
            {
                success: false,
                error: {
                    code: 'INTERNAL_ERROR',
                    message: 'Failed to list alert rules',
                    details: error instanceof Error ? error.message : String(error),
                },
            },
            { status: 500 }
        );
    }
}

/**
 * POST handler - Create a new alert rule
 */
async function handlePOST(req: NextRequest) {
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

        // Parse and validate request body
        const body = await req.json();
        const validationResult = createAlertRuleSchema.safeParse(body);

        if (!validationResult.success) {
            return NextResponse.json(
                {
                    success: false,
                    error: {
                        code: 'VALIDATION_ERROR',
                        message: 'Invalid request data',
                        details: validationResult.error.issues,
                    },
                },
                { status: 422 }
            );
        }

        // Create alert rule
        const rule = await alertConfigurationService.createRule(validationResult.data);

        logger.info('Alert rule created', {
            userId: session.user.id,
            ruleId: rule.id,
            ruleName: rule.name,
        });

        return NextResponse.json(
            {
                success: true,
                data: rule,
                meta: {
                    requestId: crypto.randomUUID(),
                    timestamp: new Date().toISOString(),
                },
            },
            { status: 201 }
        );
    } catch (error) {
        logger.error('Failed to create alert rule', {
            error: error instanceof Error ? error.message : String(error),
        });

        return NextResponse.json(
            {
                success: false,
                error: {
                    code: 'INTERNAL_ERROR',
                    message: 'Failed to create alert rule',
                    details: error instanceof Error ? error.message : String(error),
                },
            },
            { status: 500 }
        );
    }
}

export async function GET(req: NextRequest) {
    return withRateLimit(req, 'read', (r) => handleGET(r));
}

export async function POST(req: NextRequest) {
    return withRateLimit(req, 'write', (r) => handlePOST(r));
}
