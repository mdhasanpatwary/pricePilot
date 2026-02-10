import { NextRequest, NextResponse } from 'next/server';
import { metricsAggregator } from '@/lib/services/metrics-aggregator';
import { getCachedSession } from "@/lib/auth/cached-session";
import { withRequestContextAndRateLimit } from "@/lib/middleware/with-request-context";

/**
 * GET /api/v1/admin/metrics/tenant/[id]
 * Get tenant-specific metrics including resource usage and performance
 *
 * Requirements: 3.5
 */
async function handleGET(
    _request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        // Authentication check
        const session = await getCachedSession();
        if (!session?.user) {
            return NextResponse.json(
                { error: 'Unauthorized' },
                { status: 401 }
            );
        }

        // Check if user is super admin or regular admin
        const user = session.user as any;
        const isAdmin = user.role === 'ADMIN' || user.isSuperAdmin === true;

        if (!isAdmin) {
            return NextResponse.json(
                { error: 'Unauthorized - Admin access required' },
                { status: 401 }
            );
        }

        const { id: tenantId } = await params;

        if (!tenantId) {
            return NextResponse.json(
                { error: 'Tenant ID is required' },
                { status: 400 }
            );
        }

        // Get tenant metrics
        const metrics = await metricsAggregator.getTenantMetrics(tenantId);

        return NextResponse.json({
            success: true,
            data: metrics,
        });
    } catch (error) {
        console.error('[Tenant Metrics API] Error:', error);

        // Handle tenant not found error
        if (error instanceof Error && error.message.includes('Tenant not found')) {
            return NextResponse.json(
                {
                    success: false,
                    error: 'Tenant not found',
                    details: error.message,
                },
                { status: 404 }
            );
        }

        return NextResponse.json(
            {
                success: false,
                error: 'Failed to fetch tenant metrics',
                details: error instanceof Error ? error.message : 'Unknown error',
            },
            { status: 500 }
        );
    }
}

export async function GET(
    req: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    return withRequestContextAndRateLimit(req, 'read', () => handleGET(req, context));
}
