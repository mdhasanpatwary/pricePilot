/**
 * API endpoint to check if user should be prompted for feedback
 */

import { NextRequest, NextResponse } from 'next/server';
import { UserSatisfactionService } from '@/lib/services/user-satisfaction';
import { getCachedSession } from "@/lib/auth/cached-session";
import { withRequestContextAndRateLimit } from "@/lib/middleware/with-request-context";

async function handleGET(_req: NextRequest) {

    try {
        const session = await getCachedSession();

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

export async function GET(req: NextRequest) {
    return withRequestContextAndRateLimit(req, "read", handleGET);
}
