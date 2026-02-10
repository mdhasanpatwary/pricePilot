/**
 * GET /api/v1/scraping/attempts/:id
 * 
 * Get a single scrape attempt by ID with associated detection logs.
 * 
 * Requirements: 8.7
 */

import { NextRequest, NextResponse } from 'next/server';
import { LoggingService } from '@/lib/services/bot-protection/logging-service';
import { getCachedSession } from "@/lib/auth/cached-session";

const loggingService = new LoggingService();

export async function GET(
    _request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
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
                        message: 'Tenant context required',
                    },
                },
                { status: 403 }
            );
        }

        const { id } = await params;

        // Get scrape attempt
        const attempt = await loggingService.getScrapeAttemptById(id);

        if (!attempt) {
            return NextResponse.json(
                {
                    success: false,
                    error: {
                        code: 'NOT_FOUND',
                        message: 'Scrape attempt not found',
                    },
                },
                { status: 404 }
            );
        }

        // Verify tenant access
        if (attempt.tenantId !== tenantId) {
            return NextResponse.json(
                {
                    success: false,
                    error: {
                        code: 'FORBIDDEN',
                        message: 'Access denied to this scrape attempt',
                    },
                },
                { status: 403 }
            );
        }

        // Get associated detection logs
        const detections = await loggingService.getDetectionsByScrapeAttempt(id);

        return NextResponse.json(
            {
                success: true,
                data: {
                    attempt,
                    detections,
                },
                meta: {
                    requestId: crypto.randomUUID(),
                    timestamp: new Date().toISOString(),
                },
            },
            { status: 200 }
        );
    } catch (error) {
        console.error('Failed to get scrape attempt:', error);
        return NextResponse.json(
            {
                success: false,
                error: {
                    code: 'INTERNAL_ERROR',
                    message: 'Failed to retrieve scrape attempt',
                    details: error instanceof Error ? error.message : 'Unknown error',
                },
            },
            { status: 500 }
        );
    }
}
