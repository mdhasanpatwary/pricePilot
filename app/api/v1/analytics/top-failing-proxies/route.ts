import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { MetricsTracker } from "@/lib/services/metrics-tracker";

/**
 * GET /api/v1/analytics/top-failing-proxies?limit=10&timeRange=24h
 * Get list of proxies with highest failure rates
 * Highlights proxies with success rate < 50%
 * 
 * Query Parameters:
 * - limit: number (optional, default: 10)
 * - timeRange: '1h' | '24h' | '7d' (optional, default: '24h')
 * 
 * Requirements: 5.5, 11.5
 */
export async function GET(request: NextRequest) {
    try {
        // Authentication check
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
                { status: 401 }
            );
        }

        // Parse query parameters
        const searchParams = request.nextUrl.searchParams;
        const limitParam = searchParams.get('limit');
        const timeRange = searchParams.get('timeRange') || '24h';

        // Validate and parse limit
        const limit = limitParam ? parseInt(limitParam, 10) : 10;
        if (isNaN(limit) || limit < 1 || limit > 100) {
            return NextResponse.json(
                { error: "Invalid limit. Must be between 1 and 100" },
                { status: 400 }
            );
        }

        // Validate time range
        if (!['1h', '24h', '7d'].includes(timeRange)) {
            return NextResponse.json(
                { error: "Invalid time range. Must be '1h', '24h', or '7d'" },
                { status: 400 }
            );
        }

        // Create metrics tracker instance
        const metricsTracker = new MetricsTracker({ autoPersist: false });

        // Get top failing proxies
        const topFailingProxies = await metricsTracker.getTopFailingProxies(
            limit,
            timeRange as '1h' | '24h' | '7d'
        );

        // Highlight proxies with success rate < 50% (failure rate > 50%)
        const proxiesWithHighlight = topFailingProxies.map(proxy => ({
            ...proxy,
            successRate: 1 - proxy.failureRate,
            highlighted: proxy.failureRate > 0.5 // Success rate < 50%
        }));

        return NextResponse.json({
            success: true,
            data: {
                proxies: proxiesWithHighlight,
                limit,
                timeRange
            }
        });

    } catch (error) {
        console.error("[Top Failing Proxies API] Error:", error);
        return NextResponse.json(
            {
                success: false,
                error: "Failed to fetch top failing proxies",
                details: error instanceof Error ? error.message : "Unknown error"
            },
            { status: 500 }
        );
    }
}
