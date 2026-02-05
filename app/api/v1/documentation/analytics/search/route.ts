import { NextRequest, NextResponse } from 'next/server';
import { analyticsService } from '@/lib/documentation/analytics';

/**
 * POST /api/v1/documentation/analytics/search
 * Track search query
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { query, type, resultsCount } = body;

        if (!query || !type || resultsCount === undefined) {
            return NextResponse.json(
                {
                    success: false,
                    error: {
                        code: 'MISSING_FIELDS',
                        message: 'query, type, and resultsCount are required',
                    },
                },
                { status: 400 }
            );
        }

        // Validate type
        if (type !== 'tenant' && type !== 'admin') {
            return NextResponse.json(
                {
                    success: false,
                    error: {
                        code: 'INVALID_TYPE',
                        message: 'Type must be tenant or admin',
                    },
                },
                { status: 400 }
            );
        }

        // Track search
        await analyticsService.trackSearch(query, type, resultsCount);

        return NextResponse.json({
            success: true,
            data: {
                tracked: true,
            },
            meta: {
                requestId: crypto.randomUUID(),
                timestamp: new Date().toISOString(),
            },
        });
    } catch (error) {
        console.error('Error tracking search:', error);
        return NextResponse.json(
            {
                success: false,
                error: {
                    code: 'INTERNAL_ERROR',
                    message: 'Failed to track search',
                },
                meta: {
                    requestId: crypto.randomUUID(),
                    timestamp: new Date().toISOString(),
                },
            },
            { status: 500 }
        );
    }
}
