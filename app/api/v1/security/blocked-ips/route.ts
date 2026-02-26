/**
 * Blocked IPs Management API
 *
 * Allows administrators to view and manage blocked IP addresses
 */

import { NextRequest, NextResponse } from 'next/server';
import { incidentPreventionService } from '@/lib/services/security/incident-prevention';
import { z } from 'zod';
import { getCachedSession } from "@/lib/auth/cached-session";
import { withRequestContextAndRateLimit } from "@/lib/middleware/with-request-context";

const blockIPSchema = z.object({
    ipAddress: z.string().regex(/^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$|^(?:[A-F0-9]{1,4}:){7}[A-F0-9]{1,4}$/i, 'Invalid IP address'),
    duration: z.number().min(0), // 0 for permanent
    reason: z.string().min(1).max(500),
});

const unblockIPSchema = z.object({
    ipAddress: z.string().regex(/^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$|^(?:[A-F0-9]{1,4}:){7}[A-F0-9]{1,4}$/i, 'Invalid IP address'),
    reason: z.string().min(1).max(500),
});

/**
 * POST /api/v1/security/blocked-ips
 *
 * Block an IP address
 */
async function handlePOST(req: NextRequest) {
    try {
        const session = await getCachedSession();

        if (!session || session.user.role !== 'ADMIN') {
            return NextResponse.json(
                { success: false, error: 'Unauthorized' },
                { status: 401 }
            );
        }

        const body = await req.json();
        const validated = blockIPSchema.parse(body);

        await incidentPreventionService.blockIP(
            validated.ipAddress,
            validated.duration,
            validated.reason
        );

        return NextResponse.json({
            success: true,
            message: `IP ${validated.ipAddress} blocked successfully`,
        });
    } catch (error) {
        if (error instanceof z.ZodError) {
            return NextResponse.json(
                {
                    success: false,
                    error: {
                        code: 'VALIDATION_ERROR',
                        message: 'Invalid request data',
                        details: error.issues,
                    },
                },
                { status: 422 }
            );
        }

        console.error('Block IP error:', error);
        return NextResponse.json(
            {
                success: false,
                error: {
                    code: 'INTERNAL_ERROR',
                    message: 'Failed to block IP address',
                },
            },
            { status: 500 }
        );
    }
}

export async function POST(req: NextRequest) {
    return withRequestContextAndRateLimit(req, "write", handlePOST);
}

async function handleDELETE(req: NextRequest) {
    try {
        const session = await getCachedSession();

        if (!session || session.user.role !== 'ADMIN') {
            return NextResponse.json(
                { success: false, error: 'Unauthorized' },
                { status: 401 }
            );
        }

        const body = await req.json();
        const validated = unblockIPSchema.parse(body);

        await incidentPreventionService.unblockIP(
            validated.ipAddress,
            validated.reason
        );

        return NextResponse.json({
            success: true,
            message: `IP ${validated.ipAddress} unblocked successfully`,
        });
    } catch (error) {
        if (error instanceof z.ZodError) {
            return NextResponse.json(
                {
                    success: false,
                    error: {
                        code: 'VALIDATION_ERROR',
                        message: 'Invalid request data',
                        details: error.issues,
                    },
                },
                { status: 422 }
            );
        }

        console.error('Unblock IP error:', error);
        return NextResponse.json(
            {
                success: false,
                error: {
                    code: 'INTERNAL_ERROR',
                    message: 'Failed to unblock IP address',
                },
            },
            { status: 500 }
        );
    }
}

export async function DELETE(req: NextRequest) {
    return withRequestContextAndRateLimit(req, "write", handleDELETE);
}
