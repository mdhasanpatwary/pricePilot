import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { ExportService, ExportFormat } from "@/lib/services/export-service";
import { prisma } from "@/lib/prisma";
import { withRateLimit } from "@/lib/middleware/ratelimit";

/**
 * GET /api/v1/admin/export/metrics
 * Export proxy metrics in specified format
 * 
 * Query Parameters:
 * - format: json | csv | pdf (default: json)
 * - startDate: Filter by start date (optional)
 * - endDate: Filter by end date (optional)
 * 
 * Requirements: 15.2, 15.5
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

        // Fetch proxy metrics from scraping sessions
        const sessions = await prisma.scrapingSession.findMany({
            where: {
                startTime: {
                    gte: startDate,
                    lte: endDate,
                },
                proxyUsed: {
                    not: null,
                },
            },
            select: {
                proxyUsed: true,
                status: true,
                metrics: true,
                startTime: true,
                endTime: true,
            },
        });

        // Aggregate metrics by proxy
        const proxyMetricsMap = new Map<string, any>();

        sessions.forEach(session => {
            if (!session.proxyUsed) return;

            const proxy = session.proxyUsed;
            if (!proxyMetricsMap.has(proxy)) {
                proxyMetricsMap.set(proxy, {
                    proxyUrl: proxy,
                    type: proxy.includes("residential") ? "residential" : "datacenter",
                    totalRequests: 0,
                    successCount: 0,
                    failureCount: 0,
                    responseTimes: [],
                    lastCheckTime: session.startTime,
                });
            }

            const metrics = proxyMetricsMap.get(proxy);
            metrics.totalRequests++;

            if (session.status === "completed") {
                metrics.successCount++;
            } else if (session.status === "failed") {
                metrics.failureCount++;
            }

            if (session.metrics && typeof session.metrics === "object") {
                const metricsObj = session.metrics as any;
                if (metricsObj.totalTime) {
                    metrics.responseTimes.push(metricsObj.totalTime);
                }
            }

            if (session.startTime > metrics.lastCheckTime) {
                metrics.lastCheckTime = session.startTime;
            }
        });

        // Calculate final metrics
        const proxyMetrics = Array.from(proxyMetricsMap.values()).map(metrics => {
            const successRate = metrics.totalRequests > 0
                ? (metrics.successCount / metrics.totalRequests * 100).toFixed(2)
                : "0.00";
            const failureRate = metrics.totalRequests > 0
                ? (metrics.failureCount / metrics.totalRequests * 100).toFixed(2)
                : "0.00";
            const avgResponseTime = metrics.responseTimes.length > 0
                ? (metrics.responseTimes.reduce((a: number, b: number) => a + b, 0) / metrics.responseTimes.length).toFixed(2)
                : "N/A";

            return {
                proxyUrl: metrics.proxyUrl,
                type: metrics.type,
                totalRequests: metrics.totalRequests,
                successCount: metrics.successCount,
                failureCount: metrics.failureCount,
                successRate: `${successRate}%`,
                failureRate: `${failureRate}%`,
                avgResponseTime: avgResponseTime !== "N/A" ? `${avgResponseTime}ms` : "N/A",
                lastCheckTime: metrics.lastCheckTime.toISOString(),
            };
        });

        // Export metrics
        const exported = await ExportService.exportProxyMetrics(proxyMetrics, { format });

        // Return file
        return new NextResponse(exported.data as any, {
            headers: {
                "Content-Type": exported.contentType,
                "Content-Disposition": `attachment; filename="${exported.filename}"`,
            },
        });
    } catch (error) {
        console.error("[Export Metrics API] Error:", error);
        return NextResponse.json(
            {
                success: false,
                error: "Failed to export metrics",
                details: error instanceof Error ? error.message : "Unknown error"
            },
            { status: 500 }
        );
    }
}

export async function GET(req: NextRequest) {
    return withRateLimit(req, "importExport", handleGET);
}
