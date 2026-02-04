/**
 * Effective Alert Rules API
 * 
 * Returns the effective alert rules for a tenant, considering both
 * tenant-specific overrides and global defaults.
 * 
 * Requirements: 2.15.3
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { alertConfigurationService } from '@/lib/services/monitoring/alert-configuration';
import { logger } from '@/lib/logger';

/**
 * GET /api/v1/monitoring/alert-rules/effective
 * 
 * Get effective alert rules for the authenticated user's tenant
 */
export async function GET(req: NextRequest) {
    try {
        const session = await getServerSession(authOptions);

        if (!session?.user) {
            return NextResponse.json(
                { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
                { status: 401 }
            );
        }

        // Get tenant ID from query params (for admin) or session
        const { searchParams } = new URL(req.url);
        const tenantId = searchParams.get('tenantId') || session.user.tenantId;

        if (!tenantId) {
            return NextResponse.json(
                { success: false, error: { code: 'BAD_REQUEST', message: 'Tenant ID required' } },
                { status: 400 }
            );
        }

        // Get effective rules (tenant-specific overrides + global defaults)
        const rules = await alertConfigurationService.getEffectiveRules(tenantId);

        return NextResponse.json({
            success: true,
            data: rules,
            meta: {
                tenantId,
                count: rules.length,
            },
        });
    } catch (error) {
        logger.error('Failed to get effective alert rules', {
            error: error instanceof Error ? error.message : String(error),
        });

        return NextResponse.json(
            {
                success: false,
                error: {
                    code: 'INTERNAL_ERROR',
                    message: 'Failed to get effective alert rules',
                },
            },
            { status: 500 }
        );
    }
}
