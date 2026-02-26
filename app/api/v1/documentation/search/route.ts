import { NextRequest, NextResponse } from 'next/server';
import { searchService } from '@/lib/documentation/search';
import { DocumentationType } from '@prisma/client';
import { SearchError, formatErrorResponse } from '@/lib/documentation/errors';
import { rateLimitSearch, addRateLimitHeaders } from '@/lib/documentation/rate-limit';
import { validateSearchParams } from '@/lib/documentation/security';
import { withRequestContextOnly } from '@/lib/middleware/with-request-context';

async function handleGET(request: NextRequest) {

    const requestId = crypto.randomUUID();

    try {
        // Rate limit search (100 req/minute per IP)
        const rateLimitCheck = await rateLimitSearch(request);
        if ('status' in rateLimitCheck) {
            return rateLimitCheck;
        }
        const rateLimitResult = rateLimitCheck.result;

        const searchParams = request.nextUrl.searchParams;
        const query = searchParams.get('q');
        const type = searchParams.get('type') || 'tenant';
        const category = searchParams.get('category');
        const tags = searchParams.get('tags')?.split(',').filter(Boolean);
        const limit = parseInt(searchParams.get('limit') || '20');
        const offset = parseInt(searchParams.get('offset') || '0');

        // Validate search parameters
        const validation = validateSearchParams({
            q: query || '',
            type,
            category: category || undefined,
            tags: tags || undefined,
            limit,
            offset,
        });

        if (!validation.success) {
            return NextResponse.json(
                {
                    success: false,
                    error: {
                        code: 'VALIDATION_ERROR',
                        message: 'Invalid search parameters',
                        details: {
                            fields: validation.errors,
                        },
                    },
                },
                { status: 400 }
            );
        }

        const validatedParams = validation.data;

        const docType = validatedParams.type === 'admin' ? DocumentationType.ADMIN : DocumentationType.TENANT;

        // Perform search with retry logic
        const results = await searchService.search(validatedParams.q, docType, {
            category: validatedParams.category,
            tags: validatedParams.tags,
            limit: validatedParams.limit || 20,
            offset: validatedParams.offset || 0,
        });

        const response = NextResponse.json({
            success: true,
            data: results,
            meta: {
                requestId,
                timestamp: new Date().toISOString(),
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
        console.error('Search error:', error);

        // Handle search-specific errors with graceful degradation
        if (error instanceof SearchError) {
            const errorResponse: any = formatErrorResponse(error, requestId);

            // Include popular pages as fallback
            if (error.details?.suggestions) {
                errorResponse.data = {
                    popularPages: error.details.suggestions,
                    message: 'Search is temporarily unavailable. Here are some popular pages:',
                };
            }

            return NextResponse.json(errorResponse, { status: error.statusCode });
        }

        // Generic error
        const errorResponse = formatErrorResponse(error as Error, requestId);
        return NextResponse.json(errorResponse, { status: 500 });
    }
}

export async function GET(req: NextRequest) {
    return withRequestContextOnly(req, handleGET);
}
