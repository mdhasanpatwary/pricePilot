/**
 * Cache Statistics API Endpoint
 * 
 * GET /api/v1/admin/performance/cache-stats
 * 
 * Returns current cache layer statistics including hit rates,
 * memory usage, and performance metrics.
 * 
 * Requirements: 4.4
 */

import { NextRequest, NextResponse } from 'next/server';
import { CacheMonitoringService } from '@/lib/services/cache-monitoring';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { withRateLimit } from '@/lib/middleware/ratelimit';

async function handleGET() {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // Check if user is super admin or regular admin
        const user = session.user as any;
        const isAdmin = user.role === "ADMIN" || user.isSuperAdmin === true;

        if (!isAdmin) {
            return NextResponse.json(
                { error: "Unauthorized - Admin access required" },
                { status: 403 }
            );
        }

        // Get comprehensive health status from monitoring service
        const monitoringService = new CacheMonitoringService();
        const healthStatus = await monitoringService.getHealthStatus();

        return NextResponse.json({
            success: true,
            data: healthStatus,
            meta: {
                timestamp: new Date().toISOString(),
            },
        });
    } catch (error) {
        console.error('[Cache Stats API] Error:', error);

        return NextResponse.json(
            {
                success: false,
                error: {
                    code: 'CACHE_STATS_ERROR',
                    message: 'Failed to fetch cache statistics',
                    details: error instanceof Error ? error.message : 'Unknown error',
                },
            },
            { status: 500 }
        );
    }
}

export async function GET(req: NextRequest) {
    return withRateLimit(req, 'read', handleGET);
}
