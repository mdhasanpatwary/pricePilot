import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { metricsAggregator } from '@/lib/services/metrics-aggregator';

/**
 * GET /api/v1/admin/metrics/dashboard
 * Get real-time dashboard metrics aggregated from multiple sources
 *
 * Requirements: 3.1, 3.2, 3.3, 3.4, 3.5
 */
export async function GET(_request: NextRequest) {
    try {
        // Authentication check
        const session = await getServerSession(authOptions);
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

        // Get dashboard metrics
        const metrics = await metricsAggregator.getDashboardMetrics();

        return NextResponse.json({
            success: true,
            data: metrics,
        });
    } catch (error) {
        console.error('[Dashboard Metrics API] Error:', error);
        return NextResponse.json(
            {
                success: false,
                error: 'Failed to fetch dashboard metrics',
                details: error instanceof Error ? error.message : 'Unknown error',
            },
            { status: 500 }
        );
    }
}
