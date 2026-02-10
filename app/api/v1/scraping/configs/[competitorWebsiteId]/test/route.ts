import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withErrorHandling } from "@/lib/middleware/global-error-handler";
import { getCachedSession } from "@/lib/auth/cached-session";
import { withRequestContextAndRateLimit } from "@/lib/middleware/with-request-context";
import {
    validateBody,
    validationErrorResponse,
    testScrapingConfigSchema,
} from "@/lib/validation";
import {
    UnauthorizedError,
    NotFoundError,
} from "@/lib/utils/error-handler";

/**
 * POST /api/v1/scraping/configs/:competitorWebsiteId/test
 *
 * Test scraping configuration by performing a test scrape
 *
 * Requirements: 15.1
 */
async function handlePOST(
    req: NextRequest,
    { params }: { params: Promise<{ competitorWebsiteId: string }> }
) {
    const session = await getCachedSession();

    if (!session?.user) {
        throw new UnauthorizedError("Authentication required to test scraping configuration");
    }

    const tenantId = session.user.tenantId;
    const { competitorWebsiteId } = await params;

    // Validate input
    const validation = await validateBody(req, testScrapingConfigSchema);

    if (!validation.success) {
        return validationErrorResponse(validation);
    }

    const { testUrl, config } = validation.data!;

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

    // Get existing configuration or use defaults
    const existingConfig = competitorWebsite.ScrapingConfig;

    // Merge existing config with test config
    const testConfig = {
        preferredStrategy: config?.preferredStrategy || existingConfig?.preferredStrategy || "http_client",
        requiresJavascript: config?.requiresJavascript ?? existingConfig?.requiresJavascript ?? false,
        proxyRequired: config?.proxyRequired ?? existingConfig?.proxyRequired ?? false,
        baseDelayMs: config?.baseDelayMs || existingConfig?.baseDelayMs || 2000,
        maxDelayMs: config?.maxDelayMs || existingConfig?.maxDelayMs || 300000,
        backoffMultiplier: config?.backoffMultiplier || (existingConfig?.backoffMultiplier ? Number(existingConfig.backoffMultiplier) : 2.0),
        maxRetries: config?.maxRetries ?? existingConfig?.maxRetries ?? 3,
        timeoutMs: config?.timeoutMs || existingConfig?.timeoutMs || 30000,
        priceSelectors: config?.priceSelectors || (existingConfig?.priceSelectors as string[]) || [".price", "[itemprop='price']", ".product-price"],
        currencySelector: config?.currencySelector ?? existingConfig?.currencySelector ?? null,
        fallbackRegex: config?.fallbackRegex ?? existingConfig?.fallbackRegex ?? null,
    };

    // Determine test URL
    const urlToTest = testUrl || competitorWebsite.baseUrl;

    // TODO: In a real implementation, this would trigger an actual test scrape
    // For now, we'll simulate a test response

    // Simulate a test scrape (in production, this would call the actual scraper)
    const testResult = {
        success: true,
        url: urlToTest,
        strategy: testConfig.preferredStrategy,
        responseTime: Math.floor(Math.random() * 3000) + 500, // Simulated response time
        statusCode: 200,
        priceExtracted: true,
        price: "99.99",
        currency: "USD",
        selectorUsed: testConfig.priceSelectors[0],
        warnings: [] as string[],
        errors: [] as string[],
    };

    // Add warnings based on configuration
    if (testConfig.timeoutMs < 10000) {
        testResult.warnings.push("Timeout is set below 10 seconds, which may cause failures for slow sites");
    }

    if (testConfig.maxRetries === 0) {
        testResult.warnings.push("Max retries is set to 0, failed requests will not be retried");
    }

    if (!testConfig.proxyRequired && testConfig.preferredStrategy.includes("proxy")) {
        testResult.warnings.push("Strategy includes proxy but proxyRequired is false");
    }

    return NextResponse.json({
        success: true,
        data: {
            testResult,
            configTested: testConfig,
            message: "Test scrape completed successfully. Note: This is a simulated test. In production, this would perform an actual scrape.",
        },
    });
}

export async function POST(
    req: NextRequest,
    context: { params: Promise<{ competitorWebsiteId: string }> }
) {
    return withRequestContextAndRateLimit(req, "write", withErrorHandling(() => handlePOST(req, context)));
}
