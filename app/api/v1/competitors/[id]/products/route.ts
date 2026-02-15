/**
 * Competitor Products API Endpoint
 *
 * Provides competitor product data with caching
 * Requirements: 8.3 - Cache GET requests for competitor products (TTL: 10 minutes)
 */

import { NextRequest, NextResponse } from "next/server";
import { withErrorHandling } from "@/lib/middleware/global-error-handler";
import { withCache } from "@/lib/middleware/api-cache";
import { UnauthorizedError, NotFoundError } from "@/lib/utils/error-handler";
import { prisma } from "@/lib/prisma";
import { sanitizeProducts } from "@/lib/middleware/sanitize-response";
import { getCachedSession } from "@/lib/auth/cached-session";
import { withRequestContextAndRateLimit } from "@/lib/middleware/with-request-context";
import { getOrSetRequestCache } from "@/lib/cache/request-cache";
import { withDbRetry } from "@/lib/utils/db-retry";

async function handleGET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const session = await getCachedSession();

    if (!session?.user) {
        throw new UnauthorizedError('Authentication required to access competitor products');
    }

    const tenantId = session.user.tenantId;
    const { id: competitorId } = await params;

    // Verify the competitor site belongs to this tenant - cached per request
    const competitorSite = await getOrSetRequestCache(
        `competitor-site:${competitorId}:${tenantId}`,
        () => withDbRetry(() => prisma.site.findFirst({
            where: {
                id: competitorId,
                tenantId,
                type: "COMPETITOR",
            },
            include: {
                _count: {
                    select: { Product: true }
                }
            }
        }), { operationName: 'VerifyCompetitorSite' })
    );

    if (!competitorSite) {
        throw new NotFoundError('Competitor site', competitorId);
    }

    // Parse query parameters
    const searchParams = req.nextUrl.searchParams;
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const skip = (page - 1) * limit;

    // Get competitor products
    const total = (competitorSite as any)._count.Product;
    const products = await withDbRetry(() => prisma.product.findMany({
        where: {
            siteId: competitorId,
            tenantId,
        },
        include: {
            _count: {
                select: { matchesAsCompetitor: true }
            }
        },
        orderBy: {
            updatedAt: "desc",
        },
        skip,
        take: limit,
    }), { operationName: 'FetchCompetitorProducts' });

    // Format products for response
    const formattedProducts = products.map((product) => ({
        id: product.id,
        sku: product.sku || "N/A",
        title: product.title,
        image: product.imageUrl || null,
        price: parseFloat(product.currentPrice.toString()),
        inStock: product.inStock,
        brand: product.brand || "Generic",
        model: product.model || "N/A",
        category: product.category || "Uncategorized",
        url: product.url || null,
        lastScrapedAt: product.updatedAt,
        matchCount: (product as any)._count.matchesAsCompetitor,
        specifications: product.specifications || {},
    }));

    // Sanitize competitor products to prevent XSS attacks
    // Requirement 2.7.3: XSS prevention for competitor product data
    const sanitizedProducts = sanitizeProducts(formattedProducts);

    return NextResponse.json({
        products: sanitizedProducts,
        pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
        },
        competitor: {
            id: competitorSite.id,
            name: competitorSite.baseUrl,
            url: competitorSite.baseUrl,
        },
    });
}

export async function GET(
    req: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    return withRequestContextAndRateLimit(req, "read", (req) => {
        const cachedHandler = withCache(
            (req) => withErrorHandling((req) => handleGET(req, context))(req),
            {
                ttl: 600, // 10 minutes
                keyPrefix: 'api:competitors:products',
                varyBy: ['page', 'limit'],
                tenantIsolated: true,
            }
        );
        return cachedHandler(req);
    });
}
