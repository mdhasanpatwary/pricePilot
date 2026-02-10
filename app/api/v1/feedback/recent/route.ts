/**
 * API endpoint for retrieving recent feedback
 */

import { NextRequest, NextResponse } from 'next/server';
import { UserSatisfactionService } from '@/lib/services/user-satisfaction';
import { getCachedSession } from "@/lib/auth/cached-session";

export async function GET(req: NextRequest) {
    try {
        const session = await getCachedSession();

        if (!session?.user) {
            return NextResponse.json(
                { success: false, error: 'Unauthorized' },
                { status: 401 }
            );
        }

        const { searchParams } = new URL(req.url);
        const limit = parseInt(searchParams.get('limit') || '50');
        const global = searchParams.get('global') === 'true' && session.user.isSuperAdmin;

        const tenantId = global ? undefined : session.user.tenantId;

        const feedback = await UserSatisfactionService.getRecentFeedback(tenantId, limit);

        return NextResponse.json({
            success: true,
            data: feedback,
        });
    } catch (error) {
        console.error('Failed to get recent feedback:', error);
        return NextResponse.json(
            {
                success: false,
                error: 'Failed to get recent feedback',
            },
            { status: 500 }
        );
    }
}
