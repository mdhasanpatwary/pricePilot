import { NextRequest, NextResponse } from 'next/server';
import { analyticsService } from '@/lib/documentation/analytics';
import { getCachedSession } from "@/lib/auth/cached-session";
import { withRequestContextAndRateLimit } from "@/lib/middleware/with-request-context";

async function handlePOST(request: NextRequest) {
    try {
        const body = await request.json();
        const { documentId, type } = body;

        if (!documentId || !type) {
            return NextResponse.json(
                {
                    success: false,
                    error: {
                        code: 'MISSING_FIELDS',
                        message: 'documentId and type are required',
                    },
                },
                { status: 400 }
            );
        }

        // Get user ID if authenticated (optional)
        const session = await getCachedSession();
        const userId = session?.user?.id;

        // Track page view
        await analyticsService.trackPageView(documentId, type, userId);

        return NextResponse.json({
            success: true,
            data: {
                tracked: true,
            },
        });
    } catch (error) {
        console.error('Error tracking page view:', error);
        return NextResponse.json(
            {
                success: false,
                error: {
                    code: 'INTERNAL_ERROR',
                    message: 'Failed to track page view',
                },
            },
            { status: 500 }
        );
    }
}

export async function POST(request: NextRequest) {
    return withRequestContextAndRateLimit(request, 'write', handlePOST);
}
