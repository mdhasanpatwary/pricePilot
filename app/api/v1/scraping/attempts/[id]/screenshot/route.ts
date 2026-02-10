/**
 * GET /api/v1/scraping/attempts/:id/screenshot
 * 
 * Retrieve screenshot for a scrape attempt.
 * Returns the screenshot image file.
 * 
 * Requirements: 8.7
 */

import { NextRequest, NextResponse } from 'next/server';
import { LoggingService } from '@/lib/services/bot-protection/logging-service';
import { ScreenshotStorage } from '@/lib/services/bot-protection/screenshot-storage';
import { getCachedSession } from "@/lib/auth/cached-session";

const loggingService = new LoggingService();
const screenshotStorage = new ScreenshotStorage();

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

        // Check if screenshot exists
        if (!attempt.screenshotUrl) {
            return NextResponse.json(
                {
                    success: false,
                    error: {
                        code: 'NOT_FOUND',
                        message: 'No screenshot available for this scrape attempt',
                    },
                },
                { status: 404 }
            );
        }

        // Retrieve screenshot
        const screenshot = await screenshotStorage.retrieveScreenshot(attempt.screenshotUrl);

        // Return screenshot as image
        return new NextResponse(new Uint8Array(screenshot), {
            status: 200,
            headers: {
                'Content-Type': 'image/png',
                'Content-Length': screenshot.length.toString(),
                'Cache-Control': 'public, max-age=86400', // Cache for 24 hours
            },
        });
    } catch (error) {
        console.error('Failed to retrieve screenshot:', error);

        // Check if it's a file not found error
        if (error instanceof Error && 'code' in error && (error as NodeJS.ErrnoException).code === 'ENOENT') {
            return NextResponse.json(
                {
                    success: false,
                    error: {
                        code: 'NOT_FOUND',
                        message: 'Screenshot file not found',
                    },
                },
                { status: 404 }
            );
        }

        return NextResponse.json(
            {
                success: false,
                error: {
                    code: 'INTERNAL_ERROR',
                    message: 'Failed to retrieve screenshot',
                    details: error instanceof Error ? error.message : 'Unknown error',
                },
            },
            { status: 500 }
        );
    }
}
