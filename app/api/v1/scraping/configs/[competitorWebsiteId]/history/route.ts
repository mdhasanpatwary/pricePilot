import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withErrorHandling } from "@/lib/middleware/global-error-handler";
import { UnauthorizedError, NotFoundError } from "@/lib/utils/error-handler";
import { getCachedSession } from "@/lib/auth/cached-session";
import { withRequestContextAndRateLimit } from "@/lib/middleware/with-request-context";

/**
 * GET /api/v1/scraping/configs/:competitorWebsiteId/history
 * 
 * Get configuration change history for a specific competitor website
 * 
 * Requirements: 15.7
 */
async function handleGET(
    _req: NextRequest,
    { params }: { params: Promise<{ competitorWebsiteId: string }> }
) {
    const session = await getCachedSession();

    if (!session?.user) {
        throw new UnauthorizedError("Authentication required to access configuration history");
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
    });

    if (!competitorWebsite) {
        throw new NotFoundError("Competitor website", competitorWebsiteId);
    }

    // Get audit logs for this configuration
    const auditLogs = await prisma.tenantAuditLog.findMany({
        where: {
            tenantId,
            action: "UPDATE_SCRAPING_CONFIG",
            entityId: competitorWebsiteId,
        },
        orderBy: {
            createdAt: "desc",
        },
        take: 50, // Limit to last 50 changes
    });

    // Parse and format the history
    const history = auditLogs.map((log) => {
        let details = null;
        try {
            details = log.details ? JSON.parse(log.details) : null;
        } catch (e) {
            // Ignore parse errors
        }

        return {
            id: log.id,
            timestamp: log.createdAt,
            userEmail: log.userEmail,
            userId: log.userId,
            oldConfig: details?.oldConfig || null,
            newConfig: details?.newConfig || null,
            changes: details ? calculateChanges(details.oldConfig, details.newConfig) : [],
        };
    });

    return NextResponse.json({
        success: true,
        data: {
            competitorWebsiteId,
            competitorWebsiteUrl: competitorWebsite.baseUrl,
            history,
        },
    });
}

/**
 * Calculate the specific changes between old and new config
 */
function calculateChanges(oldConfig: any, newConfig: any): Array<{
    field: string;
    oldValue: any;
    newValue: any;
}> {
    if (!oldConfig || !newConfig) {
        return [];
    }

    const changes: Array<{ field: string; oldValue: any; newValue: any }> = [];
    const fields = [
        "preferredStrategy",
        "requiresJavascript",
        "proxyRequired",
        "baseDelayMs",
        "maxDelayMs",
        "backoffMultiplier",
        "maxRetries",
        "timeoutMs",
        "priceSelectors",
        "currencySelector",
        "fallbackRegex",
    ];

    for (const field of fields) {
        const oldValue = oldConfig[field];
        const newValue = newConfig[field];

        // Deep comparison for arrays
        if (Array.isArray(oldValue) && Array.isArray(newValue)) {
            if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
                changes.push({ field, oldValue, newValue });
            }
        } else if (oldValue !== newValue) {
            changes.push({ field, oldValue, newValue });
        }
    }

    return changes;
}

/**
 * POST /api/v1/scraping/configs/:competitorWebsiteId/history/:historyId/revert
 * 
 * Revert to a previous configuration
 * 
 * Requirements: 15.7
 */
async function handlePOST(
    req: NextRequest,
    { params }: { params: Promise<{ competitorWebsiteId: string }> }
) {
    const session = await getCachedSession();

    if (!session?.user) {
        throw new UnauthorizedError("Authentication required to revert configuration");
    }

    const tenantId = session.user.tenantId;
    const { competitorWebsiteId } = await params;
    const { historyId } = await req.json();

    if (!historyId) {
        return NextResponse.json(
            {
                success: false,
                error: {
                    code: "VALIDATION_ERROR",
                    message: "History ID is required",
                },
            },
            { status: 400 }
        );
    }

    // Verify the competitor website belongs to this tenant
    const competitorWebsite = await prisma.site.findFirst({
        where: {
            id: competitorWebsiteId,
            tenantId,
            type: "COMPETITOR",
        },
    });

    if (!competitorWebsite) {
        throw new NotFoundError("Competitor website", competitorWebsiteId);
    }

    // Get the audit log entry
    const auditLog = await prisma.tenantAuditLog.findFirst({
        where: {
            id: historyId,
            tenantId,
            action: "UPDATE_SCRAPING_CONFIG",
            entityId: competitorWebsiteId,
        },
    });

    if (!auditLog) {
        throw new NotFoundError("Configuration history", historyId);
    }

    // Parse the old configuration
    let oldConfig = null;
    try {
        const details = auditLog.details ? JSON.parse(auditLog.details) : null;
        oldConfig = details?.oldConfig;
    } catch (e) {
        return NextResponse.json(
            {
                success: false,
                error: {
                    code: "INVALID_HISTORY",
                    message: "Unable to parse configuration history",
                },
            },
            { status: 400 }
        );
    }

    if (!oldConfig) {
        return NextResponse.json(
            {
                success: false,
                error: {
                    code: "NO_CONFIG",
                    message: "No configuration found in history",
                },
            },
            { status: 400 }
        );
    }

    // Get current configuration for audit trail
    const currentConfig = await prisma.scrapingConfig.findUnique({
        where: {
            competitorWebsiteId,
        },
    });

    // Revert to old configuration
    const revertedConfig = await prisma.scrapingConfig.upsert({
        where: {
            competitorWebsiteId,
        },
        create: {
            tenantId,
            competitorWebsiteId,
            ...oldConfig,
        },
        update: oldConfig,
    });

    // Record audit log for revert action
    await prisma.tenantAuditLog.create({
        data: {
            tenantId,
            userId: session.user.id,
            userEmail: session.user.email!,
            action: "REVERT_SCRAPING_CONFIG",
            entityId: competitorWebsiteId,
            ipAddress: req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "unknown",
            details: JSON.stringify({
                competitorWebsiteUrl: competitorWebsite.baseUrl,
                revertedFromHistoryId: historyId,
                revertedToTimestamp: auditLog.createdAt,
                currentConfig: currentConfig
                    ? {
                        preferredStrategy: currentConfig.preferredStrategy,
                        requiresJavascript: currentConfig.requiresJavascript,
                        proxyRequired: currentConfig.proxyRequired,
                        baseDelayMs: currentConfig.baseDelayMs,
                        maxDelayMs: currentConfig.maxDelayMs,
                        backoffMultiplier: Number(currentConfig.backoffMultiplier),
                        maxRetries: currentConfig.maxRetries,
                        timeoutMs: currentConfig.timeoutMs,
                        priceSelectors: currentConfig.priceSelectors,
                        currencySelector: currentConfig.currencySelector,
                        fallbackRegex: currentConfig.fallbackRegex,
                    }
                    : null,
                revertedConfig: oldConfig,
            }),
        },
    });

    return NextResponse.json({
        success: true,
        data: {
            competitorWebsiteId,
            config: {
                preferredStrategy: revertedConfig.preferredStrategy,
                requiresJavascript: revertedConfig.requiresJavascript,
                proxyRequired: revertedConfig.proxyRequired,
                baseDelayMs: revertedConfig.baseDelayMs,
                maxDelayMs: revertedConfig.maxDelayMs,
                backoffMultiplier: Number(revertedConfig.backoffMultiplier),
                maxRetries: revertedConfig.maxRetries,
                timeoutMs: revertedConfig.timeoutMs,
                priceSelectors: revertedConfig.priceSelectors as string[],
                currencySelector: revertedConfig.currencySelector,
                fallbackRegex: revertedConfig.fallbackRegex,
                createdAt: revertedConfig.createdAt,
                updatedAt: revertedConfig.updatedAt,
            },
        },
        message: "Configuration reverted successfully",
    });
}

export async function GET(
    req: NextRequest,
    context: { params: Promise<{ competitorWebsiteId: string }> }
) {
    return withRequestContextAndRateLimit(req, "read", withErrorHandling(() => handleGET(req, context)));
}

export async function POST(
    req: NextRequest,
    context: { params: Promise<{ competitorWebsiteId: string }> }
) {
    return withRequestContextAndRateLimit(req, "write", withErrorHandling(() => handlePOST(req, context)));
}
