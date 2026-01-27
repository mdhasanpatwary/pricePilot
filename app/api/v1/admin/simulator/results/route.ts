import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { proxySimulator } from '@/lib/services/proxy-simulator';
import { logger } from '@/lib/logger';

/**
 * GET /api/v1/admin/simulator/results
 * Retrieve list of recent simulation results
 *
 * Query Parameters:
 * - limit: Maximum number of results to return (default: 50, max: 100)
 *
 * Requirements: 8.3, 8.4, 8.5
 */
export async function GET(request: NextRequest) {
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

        // Parse query parameters
        const searchParams = request.nextUrl.searchParams;
        const limitParam = searchParams.get('limit');

        // Validate and parse limit
        let limit = 50; // default
        if (limitParam) {
            const parsedLimit = parseInt(limitParam, 10);
            if (isNaN(parsedLimit) || parsedLimit < 1) {
                return NextResponse.json(
                    {
                        success: false,
                        error: 'Invalid limit parameter',
                        details: 'Limit must be a positive integer',
                    },
                    { status: 400 }
                );
            }
            limit = Math.min(parsedLimit, 100); // cap at 100
        }

        logger.info('[Simulator API] Fetching simulation results', { limit });

        // Get simulation results
        const results = await proxySimulator.listSimulations(limit);

        return NextResponse.json({
            success: true,
            data: {
                results,
                count: results.length,
                limit,
            },
        });
    } catch (error) {
        logger.error('[Simulator API] Error fetching simulation results:', error as Error);

        return NextResponse.json(
            {
                success: false,
                error: 'Failed to fetch simulation results',
                details: error instanceof Error ? error.message : 'Unknown error',
            },
            { status: 500 }
        );
    }
}
