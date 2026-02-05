import { NextRequest, NextResponse } from 'next/server';
import { analyticsService } from '@/lib/documentation/analytics';
import { getServerSession } from 'next-auth';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { documentId, rating, comment } = body;

        if (!documentId || !rating) {
            return NextResponse.json(
                {
                    success: false,
                    error: {
                        code: 'MISSING_FIELDS',
                        message: 'documentId and rating are required',
                    },
                },
                { status: 400 }
            );
        }

        // Validate rating
        if (rating < 1 || rating > 5) {
            return NextResponse.json(
                {
                    success: false,
                    error: {
                        code: 'INVALID_RATING',
                        message: 'Rating must be between 1 and 5',
                    },
                },
                { status: 400 }
            );
        }

        // Get user ID if authenticated (optional)
        const session = await getServerSession();
        const userId = session?.user?.id;

        // Track feedback
        await analyticsService.trackFeedback(documentId, rating, comment, userId);

        return NextResponse.json({
            success: true,
            data: {
                tracked: true,
            },
        });
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
