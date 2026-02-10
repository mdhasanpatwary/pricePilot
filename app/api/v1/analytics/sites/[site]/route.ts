import { NextRequest, NextResponse } from "next/server";
import { MetricsTracker } from "@/lib/services/metrics-tracker";
import { getCachedSession } from "@/lib/auth/cached-session";
import { withRequestContextAndRateLimit } from "@/lib/middleware/with-request-context";

/**
 * GET /api/v1/analytics/sites/:site?timeRange=24h
 * Get comprehensive site analytics with trending and failure analysis
 * 
 * Query Parameters:
 * - timeRange: '1h' | '24h' | '7d' (optional, default: '24h')
 * 
 * Requirements: 5.2, 5.3, 5.4
 */
async function handleGET(
    request: NextRequest,
    { params }: { params: Promise<{ site: string }> }
) {
    try {
        // Authentication check
        const session = await getCachedSession();
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

        // Get site from params
        const { site: siteParam } = await params;
        const site = decodeURIComponent(siteParam);

        // Parse query parameters
        const searchParams = request.nextUrl.searchParams;
        const timeRange = searchParams.get('timeRange') || '24h';

        // Validate time range
        if (!['1h', '24h', '7d'].includes(timeRange)) {
            return NextResponse.json(
                { error: "Invalid time range. Must be '1h', '24h', or '7d'" },
                { status: 400 }
            );
        }

        // Create metrics tracker instance
        const metricsTracker = new MetricsTracker({ autoPersist: false });

        // Get site analytics
        const analytics = await metricsTracker.getSiteAnalytics(
            site,
            timeRange as '1h' | '24h' | '7d'
        );

        return NextResponse.json({
            success: true,
            data: analytics
        });

    } catch (error) {
        console.error("[Site Analytics API] Error:", error);
        return NextResponse.json(
            {
                success: false,
                error: "Failed to fetch site analytics",
                details: error instanceof Error ? error.message : "Unknown error"
            },
            { status: 500 }
        );
    }
}

export async function GET(
    req: NextRequest,
    context: { params: Promise<{ site: string }> }
) {
    return withRequestContextAndRateLimit(req, 'read', (r) => handleGET(r, context));
}
