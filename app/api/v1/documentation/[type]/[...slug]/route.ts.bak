import { NextRequest, NextResponse } from 'next/server';
import { documentationService } from '@/lib/documentation/service';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { checkAdminAccess, NotFoundError, formatErrorResponse } from '@/lib/documentation/errors';
import { rateLimitTenantDocs, rateLimitAdminDocs, addRateLimitHeaders } from '@/lib/documentation/rate-limit';

/**
 * GET /api/v1/documentation/:type/:slug
 * Get a single document by type and slug
 */
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ type: string; slug: string[] }> }
) {
    const requestId = crypto.randomUUID();

    try {
        const { type, slug: slugArray } = await params;
        const slug = slugArray.join('/');

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

        // Rate limiting and authentication for admin docs
        let rateLimitResult;
        if (type === 'admin') {
            const session = await getServerSession(authOptions);
            checkAdminAccess(session);

            // Rate limit admin docs (1000 req/hour per user)
            const rateLimitCheck = await rateLimitAdminDocs(request, session!.user.id);
            if ('status' in rateLimitCheck) {
                return rateLimitCheck;
            }
            rateLimitResult = rateLimitCheck.result;
        } else {
            // Rate limit tenant docs (100 req/minute per IP)
            const rateLimitCheck = await rateLimitTenantDocs(request);
            if ('status' in rateLimitCheck) {
                return rateLimitCheck;
            }
            rateLimitResult = rateLimitCheck.result;
        }

        // Get query parameters
        const searchParams = request.nextUrl.searchParams;
        const format = searchParams.get('format') || 'both'; // 'markdown', 'html', or 'both'

        // Get document
        const document = await documentationService.getDocument(type, slug);

        if (!document) {
            throw new NotFoundError('Document', { slug, type });
        }

        // Get breadcrumbs
        const breadcrumbs = await documentationService.getBreadcrumbs(type, slug);

        // Prepare response data based on format
        const responseData: any = {
            id: document.id,
            type: document.type,
            slug: document.slug,
            title: document.title,
            category: document.category,
            subcategory: document.subcategory,
            metadata: document.metadata,
            createdAt: document.createdAt,
            updatedAt: document.updatedAt,
            updatedBy: document.updatedBy,
            breadcrumbs,
        };

        // Include content based on format
        if (format === 'markdown' || format === 'both') {
            responseData.content = document.content;
        }
        if (format === 'html' || format === 'both') {
            responseData.htmlContent = document.htmlContent;
        }

        const response = NextResponse.json({
            success: true,
            data: responseData,
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
        console.error('Error fetching document:', error);

        const errorResponse = formatErrorResponse(error as Error, requestId);
        const statusCode = (error as any).statusCode || 500;

        return NextResponse.json(errorResponse, { status: statusCode });
    }
}
