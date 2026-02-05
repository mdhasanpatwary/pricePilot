import { NextRequest, NextResponse } from 'next/server';
import { documentationService } from '@/lib/documentation/service';

export async function GET(
    _request: NextRequest,
    { params }: { params: Promise<{ type: string }> }
) {
    try {
        const { type } = await params;

        // Validate type
        if (type !== 'tenant' && type !== 'admin') {
            return NextResponse.json(
                { success: false, error: { code: 'INVALID_TYPE', message: 'Type must be tenant or admin' } },
                { status: 400 }
            );
        }

        // Get table of contents
        const toc = await documentationService.getTableOfContents(type);

        return NextResponse.json({
            success: true,
            data: {
                toc,
            },
        });
    } catch (error) {
        console.error('Error fetching table of contents:', error);
        return NextResponse.json(
            {
                success: false,
                error: {
                    code: 'INTERNAL_ERROR',
                    message: 'Failed to fetch table of contents',
                },
            },
            { status: 500 }
        );
    }
}
