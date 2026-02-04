import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { withRateLimit } from "@/lib/middleware/ratelimit";
import { withErrorHandling } from "@/lib/middleware/global-error-handler";
import { UnauthorizedError } from "@/lib/utils/error-handler";

/**
 * GET /api/v1/scraping/configs
 * 
 * Get all scraping configurations for the tenant's competitor websites
 * 
 * Requirements: 15.1
 */
async function handleGET() {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
        throw new UnauthorizedError("Authentication required to access scraping configurations");
    }

    const tenantId = session.user.tenantId;

    // Get all competitor websites for this tenant
    const competitorWebsites = await prisma.site.findMany({
        where: {
            tenantId,
            type: "COMPETITOR",
        },
        select: {
            id: true,
            baseUrl: true,
            scrapingConfigs: true,
        },
    });

    // Format the response
    const configs = competitorWebsites.map((site) => {
        const config = site.scrapingConfigs[0]; // One-to-one relationship

        return {
            competitorWebsiteId: site.id,
            competitorWebsiteUrl: site.baseUrl,
            config: config
                ? {
                    preferredStrategy: config.preferredStrategy,
                    requiresJavascript: config.requiresJavascript,
                    proxyRequired: config.proxyRequired,
                    baseDelayMs: config.baseDelayMs,
                    maxDelayMs: config.maxDelayMs,
                    backoffMultiplier: Number(config.backoffMultiplier),
                    maxRetries: config.maxRetries,
                    timeoutMs: config.timeoutMs,
                    priceSelectors: config.priceSelectors as string[],
                    currencySelector: config.currencySelector,
                    fallbackRegex: config.fallbackRegex,
                    createdAt: config.createdAt,
                    updatedAt: config.updatedAt,
                }
                : null,
        };
    });

    return NextResponse.json({
        success: true,
        data: configs,
    });
}

export async function GET(req: NextRequest) {
    return withRateLimit(req, "read", withErrorHandling(handleGET));
}
