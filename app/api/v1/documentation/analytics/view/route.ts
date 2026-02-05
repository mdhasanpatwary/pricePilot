import { NextRequest, NextResponse } from 'next/server';
import { analyticsService } from '@/lib/documentation/analytics';
import { getServerSession } from 'next-auth';

export async function POST(request: NextRequest) {
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
        const session = await getServerSession();
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
