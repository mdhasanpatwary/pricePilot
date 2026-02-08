import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { withRateLimit } from "@/lib/middleware/ratelimit";
import { withErrorHandling } from "@/lib/middleware/global-error-handler";
import {
    validateBody,
    validationErrorResponse,
    updateScrapingConfigSchema,
} from "@/lib/validation";
import { recordAuditLog, getIpAddress } from "@/lib/audit";
import {
    UnauthorizedError,
    NotFoundError,
} from "@/lib/utils/error-handler";

/**
 * GET /api/v1/scraping/configs/:competitorWebsiteId
 *
 * Get scraping configuration for a specific competitor website
 *
 * Requirements: 15.1, 15.2
 */
async function handleGET(
    _req: NextRequest,
    { params }: { params: Promise<{ competitorWebsiteId: string }> }
) {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
        throw new UnauthorizedError("Authentication required to access scraping configuration");
    }

    const tenantId = session.user.tenantId;
    const { competitorWebsiteId } = await params;

    // Verify the competitor website belongs to this tenant
    const competitorWebsite = await prisma.site.findFirst({
        where: {
            id: competitorWebsiteId,
            tenantId,
            type: "COMPETITOR",
        },
        include: {
            ScrapingConfig: true,
        },
    });

    if (!competitorWebsite) {
        throw new NotFoundError("Competitor website", competitorWebsiteId);
    }

    const config = competitorWebsite.ScrapingConfig;

    if (!config) {
        // Return default configuration if none exists
        return NextResponse.json({
            success: true,
            data: {
                competitorWebsiteId,
                competitorWebsiteUrl: competitorWebsite.baseUrl,
                config: null,
                defaultConfig: {
                    preferredStrategy: "http_client",
                    requiresJavascript: false,
                    proxyRequired: false,
                    baseDelayMs: 2000,
                    maxDelayMs: 300000,
                    backoffMultiplier: 2.0,
                    maxRetries: 3,
                    timeoutMs: 30000,
                    priceSelectors: [".price", "[itemprop='price']", ".product-price"],
                    currencySelector: null,
                    fallbackRegex: null,
                },
            },
        });
    }

    return NextResponse.json({
        success: true,
        data: {
            competitorWebsiteId,
            competitorWebsiteUrl: competitorWebsite.baseUrl,
            config: {
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
            },
        },
    });
}

/**
 * PUT /api/v1/scraping/configs/:competitorWebsiteId
 *
 * Update scraping configuration for a specific competitor website
 *
 * Requirements: 15.1, 15.3, 15.4, 15.5, 15.6, 15.7
 */
async function handlePUT(
    req: NextRequest,
    { params }: { params: Promise<{ competitorWebsiteId: string }> }
) {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
        throw new UnauthorizedError("Authentication required to update scraping configuration");
    }

    const tenantId = session.user.tenantId;
    const { competitorWebsiteId } = await params;

    // Validate input
    const validation = await validateBody(req, updateScrapingConfigSchema);

    if (!validation.success) {
        return validationErrorResponse(validation);
    }

    const configData = validation.data!;

    // Verify the competitor website belongs to this tenant
    const competitorWebsite = await prisma.site.findFirst({
        where: {
            id: competitorWebsiteId,
            tenantId,
            type: "COMPETITOR",
        },
        include: {
            ScrapingConfig: true,
        },
    });

    if (!competitorWebsite) {
        throw new NotFoundError("Competitor website", competitorWebsiteId);
    }

    // Get existing configuration for audit trail
    const existingConfig = competitorWebsite.ScrapingConfig;

    // Prepare update data
    const updateData: any = {};

    if (configData.preferredStrategy !== undefined) {
        updateData.preferredStrategy = configData.preferredStrategy;
    }
    if (configData.requiresJavascript !== undefined) {
        updateData.requiresJavascript = configData.requiresJavascript;
    }
    if (configData.proxyRequired !== undefined) {
        updateData.proxyRequired = configData.proxyRequired;
    }
    if (configData.baseDelayMs !== undefined) {
        updateData.baseDelayMs = configData.baseDelayMs;
    }
    if (configData.maxDelayMs !== undefined) {
        updateData.maxDelayMs = configData.maxDelayMs;
    }
    if (configData.backoffMultiplier !== undefined) {
        updateData.backoffMultiplier = configData.backoffMultiplier;
    }
    if (configData.maxRetries !== undefined) {
        updateData.maxRetries = configData.maxRetries;
    }
    if (configData.timeoutMs !== undefined) {
        updateData.timeoutMs = configData.timeoutMs;
    }
    if (configData.priceSelectors !== undefined) {
        updateData.priceSelectors = configData.priceSelectors;
    }
    if (configData.currencySelector !== undefined) {
        updateData.currencySelector = configData.currencySelector;
    }
    if (configData.fallbackRegex !== undefined) {
        updateData.fallbackRegex = configData.fallbackRegex;
    }

    // Upsert configuration
    const updatedConfig = await prisma.scrapingConfig.upsert({
        where: {
            competitorWebsiteId,
        },
        create: {
            tenantId,
            competitorWebsiteId,
            ...updateData,
            // Set defaults for required fields if not provided
            preferredStrategy: updateData.preferredStrategy || "http_client",
            baseDelayMs: updateData.baseDelayMs || 2000,
            maxDelayMs: updateData.maxDelayMs || 300000,
            backoffMultiplier: updateData.backoffMultiplier || 2.0,
            maxRetries: updateData.maxRetries || 3,
            timeoutMs: updateData.timeoutMs || 30000,
            priceSelectors: updateData.priceSelectors || [".price", "[itemprop='price']", ".product-price"],
        },
        update: updateData,
    });

    // Record audit log
    await recordAuditLog({
        tenantId,
        userId: session.user.id,
        userEmail: session.user.email!,
        action: "UPDATE_SCRAPING_CONFIG",
        entityId: competitorWebsiteId,
        ipAddress: getIpAddress(req),
        details: JSON.stringify({
            competitorWebsiteUrl: competitorWebsite.baseUrl,
            oldConfig: existingConfig
                ? {
                    preferredStrategy: existingConfig.preferredStrategy,
                    requiresJavascript: existingConfig.requiresJavascript,
                    proxyRequired: existingConfig.proxyRequired,
                    baseDelayMs: existingConfig.baseDelayMs,
                    maxDelayMs: existingConfig.maxDelayMs,
                    backoffMultiplier: Number(existingConfig.backoffMultiplier),
                    maxRetries: existingConfig.maxRetries,
                    timeoutMs: existingConfig.timeoutMs,
                    priceSelectors: existingConfig.priceSelectors,
                    currencySelector: existingConfig.currencySelector,
                    fallbackRegex: existingConfig.fallbackRegex,
                }
                : null,
            newConfig: {
                preferredStrategy: updatedConfig.preferredStrategy,
                requiresJavascript: updatedConfig.requiresJavascript,
                proxyRequired: updatedConfig.proxyRequired,
                baseDelayMs: updatedConfig.baseDelayMs,
                maxDelayMs: updatedConfig.maxDelayMs,
                backoffMultiplier: Number(updatedConfig.backoffMultiplier),
                maxRetries: updatedConfig.maxRetries,
                timeoutMs: updatedConfig.timeoutMs,
                priceSelectors: updatedConfig.priceSelectors,
                currencySelector: updatedConfig.currencySelector,
                fallbackRegex: updatedConfig.fallbackRegex,
            },
        }),
    });

    return NextResponse.json({
        success: true,
        data: {
            competitorWebsiteId,
            config: {
                preferredStrategy: updatedConfig.preferredStrategy,
                requiresJavascript: updatedConfig.requiresJavascript,
                proxyRequired: updatedConfig.proxyRequired,
                baseDelayMs: updatedConfig.baseDelayMs,
                maxDelayMs: updatedConfig.maxDelayMs,
                backoffMultiplier: Number(updatedConfig.backoffMultiplier),
                maxRetries: updatedConfig.maxRetries,
                timeoutMs: updatedConfig.timeoutMs,
                priceSelectors: updatedConfig.priceSelectors as string[],
                currencySelector: updatedConfig.currencySelector,
                fallbackRegex: updatedConfig.fallbackRegex,
                createdAt: updatedConfig.createdAt,
                updatedAt: updatedConfig.updatedAt,
            },
        },
        message: "Scraping configuration updated successfully",
    });
}

export async function GET(
    req: NextRequest,
    context: { params: Promise<{ competitorWebsiteId: string }> }
) {
    return withRateLimit(req, "read", withErrorHandling(() => handleGET(req, context)));
}

export async function PUT(
    req: NextRequest,
    context: { params: Promise<{ competitorWebsiteId: string }> }
) {
    return withRateLimit(req, "write", withErrorHandling(() => handlePUT(req, context)));
}
