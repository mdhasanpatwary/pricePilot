/**
 * Maintenance Window API Endpoints
 * 
 * GET /api/v1/monitoring/maintenance-window - List all maintenance windows
 * POST /api/v1/monitoring/maintenance-window - Create a maintenance window
 * 
 * Requirements: 7.4
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
 * Validation schema for maintenance window creation
 */
const createMaintenanceWindowSchema = z.object({
    name: z.string().min(1).max(255),
    description: z.string().optional(),
    startTime: z.string().datetime(),
    endTime: z.string().datetime(),
});

/**
 * GET handler - List all maintenance windows
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

        // List maintenance windows
        const windows = await alertConfigurationService.listMaintenanceWindows();

        logger.info('Maintenance windows listed', {
            userId: session.user.id,
            count: windows.length,
        });

        return NextResponse.json({
            success: true,
            data: {
                windows,
                count: windows.length,
            },
            meta: {
                requestId: crypto.randomUUID(),
                timestamp: new Date().toISOString(),
            },
        });
    } catch (error) {
        logger.error('Failed to list maintenance windows', {
            error: error instanceof Error ? error.message : String(error),
        });

        return NextResponse.json(
            {
                success: false,
                error: {
                    code: 'INTERNAL_ERROR',
                    message: 'Failed to list maintenance windows',
                    details: error instanceof Error ? error.message : String(error),
                },
            },
            { status: 500 }
        );
    }
}

/**
 * POST handler - Create a maintenance window
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
        const validationResult = createMaintenanceWindowSchema.safeParse(body);

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

        // Create maintenance window
        const window = await alertConfigurationService.setMaintenanceWindow(
            validationResult.data.name,
            new Date(validationResult.data.startTime),
            new Date(validationResult.data.endTime),
            validationResult.data.description
        );

        logger.info('Maintenance window created', {
            userId: session.user.id,
            windowId: window.id,
            name: window.name,
        });

        return NextResponse.json(
            {
                success: true,
                data: window,
                meta: {
                    requestId: crypto.randomUUID(),
                    timestamp: new Date().toISOString(),
                },
            },
            { status: 201 }
        );
    } catch (error) {
        logger.error('Failed to create maintenance window', {
            error: error instanceof Error ? error.message : String(error),
        });

        return NextResponse.json(
            {
                success: false,
                error: {
                    code: 'INTERNAL_ERROR',
                    message: 'Failed to create maintenance window',
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

export async function POST(req: NextRequest) {
    return withRateLimit(req, 'write', handlePOST);
}
