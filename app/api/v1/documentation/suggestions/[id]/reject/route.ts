/**
 * Reject Documentation Suggestion API
 * 
 * POST /api/v1/documentation/suggestions/:id/reject
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { DocumentationSuggestionStatus } from '@prisma/client';

export async function POST(
    _request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        // Check authentication
        const session = await getServerSession(authOptions);
        if (!session?.user) {
            return NextResponse.json(
                { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
                { status: 401 }
            );
        }

        // Check admin role
        if (session.user.role !== 'ADMIN' && !session.user.isSuperAdmin) {
            return NextResponse.json(
                { success: false, error: { code: 'FORBIDDEN', message: 'Admin access required' } },
                { status: 403 }
            );
        }

        const { id: suggestionId } = await params;

        // Check if suggestion exists
        const suggestion = await prisma.documentationSuggestion.findUnique({
            where: { id: suggestionId },
        });

        if (!suggestion) {
            return NextResponse.json(
                { success: false, error: { code: 'NOT_FOUND', message: 'Suggestion not found' } },
                { status: 404 }
            );
        }

        // Check if already reviewed
        if (suggestion.status !== DocumentationSuggestionStatus.PENDING) {
            return NextResponse.json(
                {
                    success: false,
                    error: {
                        code: 'INVALID_STATE',
                        message: `Suggestion already ${suggestion.status.toLowerCase()}`,
                    },
                },
                { status: 400 }
            );
        }

        // Reject the suggestion
        const updatedSuggestion = await prisma.documentationSuggestion.update({
            where: { id: suggestionId },
            data: {
                status: DocumentationSuggestionStatus.REJECTED,
                reviewedBy: session.user.id,
                reviewedAt: new Date(),
            },
        });

        return NextResponse.json({
            success: true,
            data: {
                suggestion: {
                    id: updatedSuggestion.id,
                    status: updatedSuggestion.status.toLowerCase(),
                    reviewedBy: updatedSuggestion.reviewedBy,
                    reviewedAt: updatedSuggestion.reviewedAt?.toISOString(),
                },
            },
            meta: {
                requestId: crypto.randomUUID(),
                timestamp: new Date().toISOString(),
            },
        });
    } catch (error) {
        console.error('[DocumentationSuggestionsAPI] Error rejecting suggestion:', error);
        return NextResponse.json(
            {
                success: false,
                error: {
                    code: 'INTERNAL_ERROR',
                    message: 'Failed to reject documentation suggestion',
                },
            },
            { status: 500 }
        );
    }
}
