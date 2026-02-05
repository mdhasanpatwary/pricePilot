import { NextRequest, NextResponse } from 'next/server';
import { searchService } from '@/lib/documentation/search';
import { DocumentationType } from '@prisma/client';

export async function GET(request: NextRequest) {
    try {
        const searchParams = request.nextUrl.searchParams;
        const query = searchParams.get('q');
        const type = searchParams.get('type') || 'tenant';
        const category = searchParams.get('category');
        const tags = searchParams.get('tags')?.split(',').filter(Boolean);
        const limit = parseInt(searchParams.get('limit') || '20');
        const offset = parseInt(searchParams.get('offset') || '0');

        if (!query) {
            return NextResponse.json(
                {
                    success: false,
                    error: {
                        code: 'MISSING_QUERY',
                        message: 'Search query is required',
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

        const docType = type === 'tenant' ? DocumentationType.TENANT : DocumentationType.ADMIN;

        // Perform search
        const results = await searchService.search(query, docType, {
            category: category || undefined,
            tags: tags || undefined,
            limit,
            offset,
        });

        return NextResponse.json({
            success: true,
            data: results,
            ...results, // Include results at root level for easier access
        });
    } catch (error) {
        console.error('Search error:', error);
        return NextResponse.json(
            {
                success: false,
                error: {
                    code: 'SEARCH_ERROR',
                    message: 'Failed to perform search',
                },
            },
            { status: 500 }
        );
    }
}
