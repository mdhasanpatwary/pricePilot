import { NextRequest, NextResponse } from 'next/server';
import { documentationService } from '@/lib/documentation/service';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

/**
 * GET /api/v1/documentation/:type/:slug
 * Get a single document by type and slug
 */
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ type: string; slug: string[] }> }
) {
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

        // Check authentication for admin docs
        if (type === 'admin') {
            const session = await getServerSession(authOptions);
            if (!session) {
                return NextResponse.json(
                    {
                        success: false,
                        error: {
                            code: 'UNAUTHORIZED',
                            message: 'Authentication required for admin documentation',
                        },
                    },
                    { status: 401 }
                );
            }

            if (session.user.role !== 'admin') {
                return NextResponse.json(
                    {
                        success: false,
                        error: {
                            code: 'FORBIDDEN',
                            message: 'Admin access required',
                        },
                    },
                    { status: 403 }
                );
            }
        }

        // Get query parameters
        const searchParams = request.nextUrl.searchParams;
        const format = searchParams.get('format') || 'both'; // 'markdown', 'html', or 'both'

        // Get document
        const document = await documentationService.getDocument(type, slug);

        if (!document) {
            return NextResponse.json(
                {
                    success: false,
                    error: {
                        code: 'NOT_FOUND',
                        message: 'Document not found',
                    },
                },
                { status: 404 }
            );
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

        return NextResponse.json({
            success: true,
            data: responseData,
            meta: {
                requestId: crypto.randomUUID(),
                timestamp: new Date().toISOString(),
            },
        });
    } catch (error) {
        console.error('Error fetching document:', error);
        return NextResponse.json(
            {
                success: false,
                error: {
                    code: 'INTERNAL_ERROR',
                    message: 'Failed to fetch document',
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
