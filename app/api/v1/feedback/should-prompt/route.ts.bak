/**
 * API endpoint to check if user should be prompted for feedback
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { UserSatisfactionService } from '@/lib/services/user-satisfaction';

export async function GET(_req: NextRequest) {
    try {
        const session = await getServerSession(authOptions);

        if (!session?.user) {
            return NextResponse.json(
                { success: false, error: 'Unauthorized' },
                { status: 401 }
            );
        }

        const shouldPrompt = await UserSatisfactionService.shouldPromptUser(
            session.user.id,
            session.user.tenantId
        );

        if (shouldPrompt) {
            // Record that we're prompting the user
            await UserSatisfactionService.recordPrompt(
                session.user.id,
                session.user.tenantId
            );
        }

        return NextResponse.json({
            success: true,
            data: {
                shouldPrompt,
            },
        });
    } catch (error) {
        console.error('Failed to check if should prompt:', error);
        return NextResponse.json(
            {
                success: false,
                error: 'Failed to check prompt status',
            },
            { status: 500 }
        );
    }
}
