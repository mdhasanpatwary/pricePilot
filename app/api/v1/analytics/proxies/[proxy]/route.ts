import { NextRequest, NextResponse } from "next/server";
import { MetricsTracker } from "@/lib/services/metrics-tracker";
import { getCachedSession } from "@/lib/auth/cached-session";
import { withRequestContextAndRateLimit } from "@/lib/middleware/with-request-context";

/**
 * GET /api/v1/analytics/proxies/:proxy?timeRange=24h
 * Get comprehensive proxy analytics with site-level breakdown
 * 
 * Query Parameters:
 * - timeRange: '1h' | '24h' | '7d' (optional, default: '24h')
 * 
 * Requirements: 5.5, 11.1, 11.2, 11.3, 11.4
 */
async function handleGET(
    request: NextRequest,
    { params }: { params: Promise<{ proxy: string }> }
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

        // Get proxy from params (URL decode it)
        const { proxy: proxyParam } = await params;
        const proxy = decodeURIComponent(proxyParam);

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

        // Get proxy analytics
        const analytics = await metricsTracker.getProxyAnalytics(
            proxy,
            timeRange as '1h' | '24h' | '7d'
        );

        return NextResponse.json({
            success: true,
            data: analytics
        });

    } catch (error) {
        console.error("[Proxy Analytics API] Error:", error);
        return NextResponse.json(
            {
                success: false,
                error: "Failed to fetch proxy analytics",
                details: error instanceof Error ? error.message : "Unknown error"
            },
            { status: 500 }
        );
    }
}

export async function GET(
    req: NextRequest,
    context: { params: Promise<{ proxy: string }> }
) {
    return withRequestContextAndRateLimit(req, 'read', (r) => handleGET(r, context));
}
