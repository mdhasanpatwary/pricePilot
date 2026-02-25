/**
 * GDPR Account Deletion API
 *
 * Implements GDPR Article 17 (Right to Erasure / Right to be Forgotten)
 */

import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { getCachedSession } from "@/lib/auth/cached-session";

/**
 * Request account deletion
 */
export async function POST(req: NextRequest) {
    try {
        const session = await getCachedSession();

        if (!session?.user?.id) {
            return NextResponse.json(
                { success: false, error: 'Unauthorized' },
                { status: 401 }
            );
        }

        const { reason, confirmEmail } = await req.json();

        // Verify email confirmation
        if (confirmEmail !== session.user.email) {
            return NextResponse.json(
                {
                    success: false,
                    error: 'Email confirmation does not match',
                },
                { status: 400 }
            );
        }

        const { GDPRService } = await import('@/lib/services/gdpr-service');
        const result = await GDPRService.requestAccountDeletion(
            session.user.id,
            reason
        );

        return NextResponse.json({
            success: true,
            message: 'Account deletion requested successfully',
            deletionDate: result.deletionDate,
            recoveryDeadline: result.recoveryDeadline,
        });
    } catch (error) {
        logger.error('GDPR account deletion request failed', { error });
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to request account deletion',
            },
            { status: 500 }
        );
    }
}

/**
 * Cancel account deletion
 */
export async function DELETE(_req: NextRequest) {
    try {
        const session = await getCachedSession();

        if (!session?.user?.id) {
            return NextResponse.json(
                { success: false, error: 'Unauthorized' },
                { status: 401 }
            );
        }

        const { GDPRService } = await import('@/lib/services/gdpr-service');
        await GDPRService.cancelAccountDeletion(session.user.id);

        return NextResponse.json({
            success: true,
            message: 'Account deletion cancelled successfully',
        });
    } catch (error) {
        logger.error('GDPR account deletion cancellation failed', { error });
        return NextResponse.json(
            {
                success: false,
                error: 'Failed to cancel account deletion',
            },
            { status: 500 }
        );
    }
}
