import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { ExportService, ExportFormat } from "@/lib/services/export-service";
import { MetricsAggregator } from "@/lib/services/metrics-aggregator";
import { withRateLimit } from "@/lib/middleware/ratelimit";

/**
 * GET /api/v1/admin/export/analytics
 * Export analytics data in specified format
 * 
 * Query Parameters:
 * - format: json | csv | pdf (default: json)
 * - type: dashboard | sites | proxies | challenges (default: dashboard)
 * - tenantId: Filter by tenant (optional)
 * - startDate: Filter by start date (optional)
 * - endDate: Filter by end date (optional)
 * 
 * Requirements: 15.4, 15.5
 */
async function handleGET(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const user = session.user as any;
        const isAdmin = user.role === "ADMIN" || user.isSuperAdmin === true;

        if (!isAdmin) {
            return NextResponse.json({ error: "Unauthorized - Admin access required" }, { status: 401 });
        }

        // Parse query parameters
        const searchParams = request.nextUrl.searchParams;
        const format = (searchParams.get("format") || "json") as ExportFormat;
        const type = searchParams.get("type") || "dashboard";
        const startDate = searchParams.get("startDate")
            ? new Date(searchParams.get("startDate")!)
            : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // Default: last 7 days
        const endDate = searchParams.get("endDate")
            ? new Date(searchParams.get("endDate")!)
            : new Date();

        // Validate format
        if (!["json", "csv", "pdf"].includes(format)) {
            return NextResponse.json(
                { error: "Invalid format. Must be json, csv, or pdf" },
                { status: 400 }
            );
        }

        // Validate type
        if (!["dashboard", "sites", "proxies", "challenges"].includes(type)) {
            return NextResponse.json(
                { error: "Invalid type. Must be dashboard, sites, proxies, or challenges" },
                { status: 400 }
            );
        }

        // Fetch analytics data based on type
        let analyticsData: any;
        const metricsAggregator = MetricsAggregator.getInstance();

        switch (type) {
            case "dashboard":
                analyticsData = await metricsAggregator.getDashboardMetrics();
                analyticsData.exportInfo = {
                    type: "dashboard",
                    startDate: startDate.toISOString(),
                    endDate: endDate.toISOString(),
                    generatedAt: new Date().toISOString(),
                };
                break;

            case "sites":
                analyticsData = await metricsAggregator.getSiteAnalytics(
                    startDate.toISOString(),
                    endDate.toISOString()
                );
                analyticsData.exportInfo = {
                    type: "sites",
                    startDate: startDate.toISOString(),
                    endDate: endDate.toISOString(),
                    generatedAt: new Date().toISOString(),
                };
                break;

            case "proxies":
                analyticsData = await metricsAggregator.getProxyAnalytics(
                    startDate.toISOString(),
                    endDate.toISOString()
                );
                analyticsData.exportInfo = {
                    type: "proxies",
                    startDate: startDate.toISOString(),
                    endDate: endDate.toISOString(),
                    generatedAt: new Date().toISOString(),
                };
                break;

            case "challenges":
                analyticsData = await metricsAggregator.getChallengeAnalytics(
                    startDate.toISOString(),
                    endDate.toISOString()
                );
                analyticsData.exportInfo = {
                    type: "challenges",
                    startDate: startDate.toISOString(),
                    endDate: endDate.toISOString(),
                    generatedAt: new Date().toISOString(),
                };
                break;

            default:
                return NextResponse.json(
                    { error: "Invalid analytics type" },
                    { status: 400 }
                );
        }

        // Export analytics
        const exported = await ExportService.exportAnalytics(analyticsData, { format });

        // Return file
        return new NextResponse(exported.data as any, {
            headers: {
                "Content-Type": exported.contentType,
                "Content-Disposition": `attachment; filename="${exported.filename}"`,
            },
        });
    } catch (error) {
        console.error("[Export Analytics API] Error:", error);
        return NextResponse.json(
            {
                success: false,
                error: "Failed to export analytics",
                details: error instanceof Error ? error.message : "Unknown error"
            },
            { status: 500 }
        );
    }
}

export async function GET(req: NextRequest) {
    return withRateLimit(req, "importExport", handleGET);
}
