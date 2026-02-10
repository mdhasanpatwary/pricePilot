/**
 * API endpoint for submitting user feedback
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { UserSatisfactionService } from '@/lib/services/user-satisfaction';
import { z } from 'zod';

const feedbackSchema = z.object({
    rating: z.number().min(1).max(5),
    category: z.enum([
        'OVERALL_EXPERIENCE',
        'EASE_OF_USE',
        'PERFORMANCE',
        'FEATURES',
        'SUPPORT',
        'DOCUMENTATION',
        'PRICE_UPDATES',
        'PRODUCT_MATCHING',
        'SCRAPING_ACCURACY',
        'DASHBOARD_UI',
        'NOTIFICATIONS',
        'SECURITY',
        'RELIABILITY',
    ]),
    feature: z.string().optional(),
    comment: z.string().max(2000).optional(),
    context: z.record(z.string(), z.any()).optional(),
});

export async function POST(req: NextRequest) {
    try {
        const session = await getServerSession(authOptions);

        if (!session?.user) {
            return NextResponse.json(
                { success: false, error: 'Unauthorized' },
                { status: 401 }
            );
        }

        const body = await req.json();
        const validated = feedbackSchema.parse(body);

        await UserSatisfactionService.submitFeedback({
            tenantId: session.user.tenantId,
            userId: session.user.id,
            rating: validated.rating,
            category: validated.category,
            feature: validated.feature,
            comment: validated.comment,
            context: validated.context,
        });

        return NextResponse.json({
            success: true,
            message: 'Thank you for your feedback!',
        });
    } catch (error) {
        if (error instanceof z.ZodError) {
            return NextResponse.json(
                {
                    success: false,
                    error: 'Invalid feedback data',
                    details: error.issues,
                },
                { status: 422 }
            );
        }

        console.error('Failed to submit feedback:', error);
        return NextResponse.json(
            {
                success: false,
                error: 'Failed to submit feedback',
            },
            { status: 500 }
        );
    }
}
