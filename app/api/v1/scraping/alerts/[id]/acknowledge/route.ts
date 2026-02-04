/**
 * Scraping Alerts API - Acknowledge alert
 * 
 * POST /api/v1/scraping/alerts/:id/acknowledge
 * 
 * Marks an alert as acknowledged by the current user
 * 
 * Requirements: 12.1
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { alertService } from '@/lib/services/bot-protection/alert-service';

/**
 * POST /api/v1/scraping/alerts/:id/acknowledge
 * 
 * Acknowledge an alert
 * 
 * Requirements: 12.1
 */
export async function POST(
    _request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        // Await params
        const { id: alertId } = await params;

        // Authenticate user
        const session = await getServerSession(authOptions);
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

        // Get user's tenant
        const user = await prisma.user.findUnique({
            where: { id: session.user.id },
            select: { tenantId: true },
        });

        if (!user?.tenantId) {
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
                acknowledged: true,
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
        if (alert.tenantId !== user.tenantId) {
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

        // Check if already acknowledged
        if (alert.acknowledged) {
            return NextResponse.json(
                {
                    success: false,
                    error: {
                        code: 'ALREADY_ACKNOWLEDGED',
                        message: 'Alert has already been acknowledged',
                    },
                },
                { status: 400 }
            );
        }

        // Acknowledge the alert using the alert service
        await alertService.acknowledgeAlert(alertId, session.user.id);

        // Fetch updated alert
        const updatedAlert = await prisma.scrapingAlert.findUnique({
            where: { id: alertId },
            include: {
                competitorWebsite: {
                    select: {
                        id: true,
                        baseUrl: true,
                    },
                },
            },
        });

        return NextResponse.json({
            success: true,
            data: {
                alert: {
                    id: updatedAlert!.id,
                    severity: updatedAlert!.severity,
                    type: updatedAlert!.type,
                    title: updatedAlert!.title,
                    message: updatedAlert!.message,
                    competitorWebsite: updatedAlert!.competitorWebsite ? {
                        id: updatedAlert!.competitorWebsite.id,
                        baseUrl: updatedAlert!.competitorWebsite.baseUrl,
                    } : null,
                    metadata: updatedAlert!.metadata,
                    acknowledged: updatedAlert!.acknowledged,
                    acknowledgedAt: updatedAlert!.acknowledgedAt,
                    acknowledgedBy: updatedAlert!.acknowledgedBy,
                    createdAt: updatedAlert!.createdAt,
                },
            },
            meta: {
                requestId: crypto.randomUUID(),
                timestamp: new Date().toISOString(),
            },
        });
    } catch (error) {
        console.error('Failed to acknowledge alert:', error);
        return NextResponse.json(
            {
                success: false,
                error: {
                    code: 'INTERNAL_ERROR',
                    message: 'Failed to acknowledge alert',
                    details: error instanceof Error ? error.message : 'Unknown error',
                },
            },
            { status: 500 }
        );
    }
}
