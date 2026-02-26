/**
 * Scraping Alerts API - Delete alert
 *
 * DELETE /api/v1/scraping/alerts/:id
 *
 * Deletes an alert from the system
 *
 * Requirements: 12.1
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCachedSession } from "@/lib/auth/cached-session";
import { invalidateCache } from "@/lib/middleware/api-cache";
import { withRequestContextAndRateLimit } from '@/lib/middleware/with-request-context';

async function handleDELETE(
    _request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {

/**
 * DELETE /api/v1/scraping/alerts/:id
 *
 * Delete an alert
 *
 * Requirements: 12.1
 */
    try {
        // Await params
        const { id: alertId } = await params;

        // Authenticate user
        const session = await getCachedSession();
        if (!session?.user?.id) {
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

        const tenantId = session.user.tenantId;

        if (!tenantId) {
            return NextResponse.json(
                {
                    success: false,
                    error: {
                        code: 'FORBIDDEN',
                        message: 'User not associated with a tenant',
                    },
                },
                { status: 403 }
            );
        }

        // Verify alert exists and belongs to user's tenant
        const alert = await prisma.scrapingAlert.findUnique({
            where: { id: alertId },
            select: {
                id: true,
                tenantId: true,
            },
        });

        if (!alert) {
            return NextResponse.json(
                {
                    success: false,
                    error: {
                        code: 'NOT_FOUND',
                        message: 'Alert not found',
                    },
                },
                { status: 404 }
            );
        }

        // Verify tenant ownership
        if (alert.tenantId !== tenantId) {
            return NextResponse.json(
                {
                    success: false,
                    error: {
                        code: 'FORBIDDEN',
                        message: 'Access denied to this alert',
                    },
                },
                { status: 403 }
            );
        }

        // Delete the alert
        await prisma.scrapingAlert.delete({
            where: { id: alertId },
        });
        await invalidateCache(`api:scraping-alerts:/api/v1/scraping/alerts:${tenantId}*`).catch((error) => {
            console.error('Scraping alerts cache invalidation error:', error);
        });

        return NextResponse.json({
            success: true,
            data: {
                message: 'Alert deleted successfully',
                alertId,
            },
            meta: {
                requestId: crypto.randomUUID(),
                timestamp: new Date().toISOString(),
            },
        });
    } catch (error) {
        console.error('Failed to delete alert:', error);
        return NextResponse.json(
            {
                success: false,
                error: {
                    code: 'INTERNAL_ERROR',
                    message: 'Failed to delete alert',
                    details: error instanceof Error ? error.message : 'Unknown error',
                },
            },
            { status: 500 }
        );
    }
}

export async function DELETE(req: NextRequest, context: { params: Promise<{ id: string }> }) {
    return withRequestContextAndRateLimit(req, "write", (r) => handleDELETE(r, context));
}
