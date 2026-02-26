/**
 * API endpoint for retrieving feedback breakdown by category
 */

import { NextRequest, NextResponse } from 'next/server';
import { UserSatisfactionService } from '@/lib/services/user-satisfaction';
import { getCachedSession } from "@/lib/auth/cached-session";
import { withRequestContextAndRateLimit } from '@/lib/middleware/with-request-context';

async function handleGET(req: NextRequest) {

    try {
        const session = await getCachedSession();

        if (!session?.user) {
            return NextResponse.json(
                { success: false, error: 'Unauthorized' },
                { status: 401 }
            );
        }

        const { searchParams } = new URL(req.url);
        const startDate = searchParams.get('startDate')
            ? new Date(searchParams.get('startDate')!)
            : undefined;
        const endDate = searchParams.get('endDate')
            ? new Date(searchParams.get('endDate')!)
            : undefined;
        const global = searchParams.get('global') === 'true' && session.user.isSuperAdmin;

        const tenantId = global ? undefined : session.user.tenantId;

        const breakdown = await UserSatisfactionService.getFeedbackByCategory(
            tenantId,
            startDate,
            endDate
        );

        return NextResponse.json({
            success: true,
            data: breakdown,
        });
    } catch (error) {
        console.error('Failed to get feedback by category:', error);
        return NextResponse.json(
            {
                success: false,
                error: 'Failed to get feedback by category',
            },
            { status: 500 }
        );
    }
}

export async function GET(req: NextRequest) {
    return withRequestContextAndRateLimit(req, "read", handleGET);
}
