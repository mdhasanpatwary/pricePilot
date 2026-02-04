/**
 * API endpoint for retrieving satisfaction scores
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { UserSatisfactionService } from '@/lib/services/user-satisfaction';

export async function GET(req: NextRequest) {
    try {
        const session = await getServerSession(authOptions);

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

        const score = await UserSatisfactionService.getSatisfactionScore(
            tenantId,
            startDate,
            endDate
        );

        return NextResponse.json({
            success: true,
            data: score,
        });
    } catch (error) {
        console.error('Failed to get satisfaction score:', error);
        return NextResponse.json(
            {
                success: false,
                error: 'Failed to get satisfaction score',
            },
            { status: 500 }
        );
    }
}
