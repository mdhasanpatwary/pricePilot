import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCachedSession } from "@/lib/auth/cached-session";
import { withRequestContextAndRateLimit } from "@/lib/middleware/with-request-context";

async function handleGET(_req: NextRequest) {

/**
 * GET /api/v1/admin/api-detection/patterns
 *
 * Get all cached API patterns for the tenant
 */
    try {
        const session = await getCachedSession();
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

        // Get all API patterns for the tenant
        const apiPatterns = await prisma.apiPattern.findMany({
            where: {
                tenantId: user.tenantId,
            },
            include: {
                Site: {
                    select: {
                        id: true,
                        baseUrl: true,
                    },
                },
            },
            orderBy: {
                lastUsedAt: "desc",
            },
        });

        // Format the response
        const patterns = apiPatterns.map((pattern) => ({
            id: pattern.id,
            competitorWebsiteId: pattern.competitorWebsiteId,
            websiteName: pattern.Site.baseUrl,
            websiteUrl: pattern.Site.baseUrl,
            pattern: pattern.pattern,
            confidenceScore: pattern.confidenceScore,
            successCount: pattern.successCount,
            failureCount: pattern.failureCount,
            lastUsedAt: pattern.lastUsedAt?.toISOString() || null,
            createdAt: pattern.createdAt.toISOString(),
        }));

        return NextResponse.json({ patterns });
    } catch (error) {
        console.error("Failed to get API patterns:", error);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        );
    }
}

export async function GET(req: NextRequest) {
    return withRequestContextAndRateLimit(req, "read", handleGET);
}
