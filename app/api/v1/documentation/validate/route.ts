/**
 * Documentation Content Validation API
 * 
 * POST /api/v1/documentation/validate
 * Validates documentation content before creation or update
 */

import { NextRequest, NextResponse } from 'next/server';
import { validateDocumentContent, formatValidationErrors } from '@/lib/documentation/validation';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { content, type } = body;

        // Validate input
        if (!content || typeof content !== 'string') {
            return NextResponse.json(
                {
                    success: false,
                    error: {
                        code: 'INVALID_INPUT',
                        message: 'Content is required and must be a string',
                    },
                },
                { status: 400 }
            );
        }

        if (!type || !['tenant', 'admin'].includes(type)) {
            return NextResponse.json(
                {
                    success: false,
                    error: {
                        code: 'INVALID_INPUT',
                        message: 'Type must be either "tenant" or "admin"',
                    },
                },
                { status: 400 }
            );
        }

        // Validate content
        const validation = await validateDocumentContent(content, type as 'tenant' | 'admin');

        return NextResponse.json({
            success: true,
            data: {
                isValid: validation.isValid,
                errors: validation.errors,
                warnings: validation.warnings,
                summary: formatValidationErrors(validation),
            },
        });
    } catch (error) {
        console.error('Validation error:', error);

        return NextResponse.json(
            {
                success: false,
                error: {
                    code: 'VALIDATION_ERROR',
                    message: error instanceof Error ? error.message : 'Failed to validate content',
                },
            },
            { status: 500 }
        );
    }
}
