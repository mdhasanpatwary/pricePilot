import { NextRequest, NextResponse } from 'next/server';
import { analyticsService } from '@/lib/documentation/analytics';
import { rateLimitFeedback, addRateLimitHeaders } from '@/lib/documentation/rate-limit';
import { validateFeedback } from '@/lib/documentation/security';
import { getCachedSession } from "@/lib/auth/cached-session";
import { withRequestContextAndRateLimit } from "@/lib/middleware/with-request-context";

async function handlePOST(request: NextRequest) {
    try {
        const body = await request.json();

        // Validate and sanitize input
        const validation = validateFeedback(body);
        if (!validation.success) {
            return NextResponse.json(
                {
                    success: false,
                    error: {
                        code: 'VALIDATION_ERROR',
                        message: 'Invalid input',
                        details: {
                            fields: validation.errors,
                        },
                    },
                },
                { status: 400 }
            );
        }

        const { documentId, rating, comment } = validation.data;

        // Get user ID if authenticated (optional)
        const session = await getCachedSession();
        const userId = session?.user?.id;

        // Rate limit feedback (10 submissions/hour per user or IP)
        const rateLimitCheck = await rateLimitFeedback(request, userId);
        if ('status' in rateLimitCheck) {
            return rateLimitCheck;
        }
        const rateLimitResult = rateLimitCheck.result;

        // Track feedback
        await analyticsService.trackFeedback(documentId, rating, comment, userId);

        const response = NextResponse.json({
            success: true,
            data: {
                tracked: true,
            },
        });

        // Add rate limit headers
        return addRateLimitHeaders(
            response,
            rateLimitResult.limit,
            rateLimitResult.remaining,
            rateLimitResult.reset
        );
    } catch (error) {
        console.error('Error tracking feedback:', error);
        return NextResponse.json(
            {
                success: false,
                error: {
                    code: 'INTERNAL_ERROR',
                    message: 'Failed to track feedback',
                },
            },
            { status: 500 }
        );
    }
}

export async function POST(request: NextRequest) {
    return withRequestContextAndRateLimit(request, 'write', handlePOST);
}
