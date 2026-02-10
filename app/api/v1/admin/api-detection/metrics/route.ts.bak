import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ApiDetectionMetrics } from "@/lib/services/api-detection/api-detection-metrics";

/**
 * GET /api/v1/admin/api-detection/metrics
 * 
 * Get API detection metrics for all competitor websites
 * 
 * Query params:
 * - range: "7d" | "30d" | "90d" (default: "30d")
 */
export async function GET(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // Check if user is admin
        const user = await prisma.user.findUnique({
            where: { id: session.user.id },
            select: { role: true, tenantId: true },
        });

        if (!user || user.role !== "ADMIN") {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        // Get date range from query params
        const searchParams = request.nextUrl.searchParams;
        const range = searchParams.get("range") || "30d";

        const endDate = new Date();
        const startDate = new Date();

        switch (range) {
            case "7d":
                startDate.setDate(startDate.getDate() - 7);
                break;
            case "90d":
                startDate.setDate(startDate.getDate() - 90);
                break;
            case "30d":
            default:
                startDate.setDate(startDate.getDate() - 30);
                break;
        }

        // Get metrics for all websites in the tenant
        const websiteMetricsData = await ApiDetectionMetrics.getTenantMetrics(
            user.tenantId,
            startDate,
            endDate
        );

        // Get website details
        const websiteIds = websiteMetricsData.map((m) => m.competitorWebsiteId);
        const websites = await prisma.site.findMany({
            where: {
                id: { in: websiteIds },
                tenantId: user.tenantId,
            },
            select: {
                id: true,
                baseUrl: true,
            },
        });

        const websiteMap = new Map(websites.map((w) => [w.id, w]));

        // Combine metrics with website details
        const websiteMetrics = websiteMetricsData
            .map((metric) => {
                const website = websiteMap.get(metric.competitorWebsiteId);
                if (!website) return null;

                return {
                    competitorWebsiteId: metric.competitorWebsiteId,
                    websiteName: website.baseUrl,
                    websiteUrl: website.baseUrl,
                    detectionSuccessRate: metric.detectionSuccessRate,
                    averageDetectionTimeMs: metric.averageDetectionTimeMs,
                    averageExtractionTimeMs: metric.averageExtractionTimeMs,
                    totalProductsExtracted: metric.totalProductsExtracted,
                    cacheHitRate: metric.cacheHitRate,
                    fallbackRate: metric.fallbackRate,
                };
            })
            .filter((m) => m !== null);

        // Calculate aggregated metrics
        const aggregated = websiteMetrics.length > 0 ? {
            totalWebsites: websiteMetrics.length,
            averageSuccessRate:
                websiteMetrics.reduce((sum, m) => sum + m.detectionSuccessRate, 0) /
                websiteMetrics.length,
            averageDetectionTime:
                websiteMetrics.reduce((sum, m) => sum + m.averageDetectionTimeMs, 0) /
                websiteMetrics.length,
            averageExtractionTime:
                websiteMetrics.reduce((sum, m) => sum + m.averageExtractionTimeMs, 0) /
                websiteMetrics.length,
            totalProductsExtracted: websiteMetrics.reduce(
                (sum, m) => sum + m.totalProductsExtracted,
                0
            ),
            averageCacheHitRate:
                websiteMetrics.reduce((sum, m) => sum + m.cacheHitRate, 0) /
                websiteMetrics.length,
            averageFallbackRate:
                websiteMetrics.reduce((sum, m) => sum + m.fallbackRate, 0) /
                websiteMetrics.length,
        } : null;

        return NextResponse.json({
            websiteMetrics,
            aggregated,
        });
    } catch (error) {
        console.error("Failed to get API detection metrics:", error);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        );
    }
}
