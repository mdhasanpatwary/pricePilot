import { NextRequest, NextResponse } from 'next/server';
import { documentationService } from '@/lib/documentation/service';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

/**
 * GET /api/v1/documentation/:type
 * List documents by type with optional filtering
 */
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ type: string }> }
) {
    try {
        const { type } = await params;

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
        const category = searchParams.get('category') || undefined;

        // List documents
        const documents = await documentationService.listDocuments(type, category);

        return NextResponse.json({
            success: true,
            data: {
                documents,
                total: documents.length,
            },
            meta: {
                requestId: crypto.randomUUID(),
                timestamp: new Date().toISOString(),
            },
        });
    } catch (error) {
        console.error('Error listing documents:', error);
        return NextResponse.json(
            {
                success: false,
                error: {
                    code: 'INTERNAL_ERROR',
                    message: 'Failed to list documents',
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
