/**
 * Last Known Good Price Service
 *
 * Service for retrieving and formatting competitor product data with
 * last known good price fallback logic.
 *
 * Requirements: 14.2
 */

import { prisma } from '@/lib/prisma';
import { getDisplayPrice } from '@/lib/utils/last-known-good-price';

/**
 * Competitor product with display price
 */
export interface CompetitorProductWithDisplayPrice {
    id: string;
    title: string;
    url: string | null;
    sku: string | null;
    brand: string | null;
    model: string | null;
    displayPrice: number | null;
    currency: string;
    isLastKnownGood: boolean;
    lastKnownGoodAge?: string;
    isStale?: boolean;
    inStock: boolean;
    lastCrawledAt: Date | null;
    siteId: string;
    siteName?: string;
}

/**
 * Get competitor products with display price logic
 *
 * Retrieves competitor products and applies last known good price fallback.
 * When current scraping fails, displays the last successfully scraped price.
 *
 * Requirements: 14.2
 *
 * @param tenantId - Tenant ID
 * @param filters - Optional filters
 * @returns Array of competitor products with display prices
 */
export async function getCompetitorProductsWithDisplayPrice(
    tenantId: string,
    filters?: {
        siteId?: string;
        productId?: string;
    }
): Promise<CompetitorProductWithDisplayPrice[]> {
    // Build where clause
    const where: any = {
        tenantId,
        Site: {
            type: 'COMPETITOR',
        },
    };

    if (filters?.siteId) {
        where.siteId = filters.siteId;
    }

    if (filters?.productId) {
        where.id = filters.productId;
    }

    // Fetch products with last known good price fields
    const products = await prisma.product.findMany({
        where,
        select: {
            id: true,
            title: true,
            url: true,
            sku: true,
            brand: true,
            model: true,
            currentPrice: true,
            currency: true,
            lastKnownGoodPrice: true,
            lastKnownGoodPriceAt: true,
            lastKnownGoodCurrency: true,
            inStock: true,
            lastCrawledAt: true,
            siteId: true,
            Site: {
                select: {
                    baseUrl: true,
                },
            },
        },
        orderBy: {
            updatedAt: 'desc',
        },
    });

    // Map to display format with fallback logic
    return products.map((product) => {
        const displayPriceData = getDisplayPrice({
            id: product.id,
            currentPrice: product.currentPrice ? Number(product.currentPrice) : null,
            lastKnownGoodPrice: product.lastKnownGoodPrice
                ? Number(product.lastKnownGoodPrice)
                : null,
            lastKnownGoodPriceAt: product.lastKnownGoodPriceAt,
            lastKnownGoodCurrency: product.lastKnownGoodCurrency,
        });

        return {
            id: product.id,
            title: product.title,
            url: product.url,
            sku: product.sku,
            brand: product.brand,
            model: product.model,
            displayPrice: displayPriceData.price,
            currency: displayPriceData.currency,
            isLastKnownGood: displayPriceData.isLastKnownGood,
            lastKnownGoodAge: displayPriceData.age,
            isStale: displayPriceData.isStale,
            inStock: product.inStock,
            lastCrawledAt: product.lastCrawledAt,
            siteId: product.siteId,
            siteName: product.Site.baseUrl,
        };
    });
}

/**
 * Get single competitor product with display price
 *
 * Requirements: 14.2
 *
 * @param productId - Product ID
 * @param tenantId - Tenant ID
 * @returns Competitor product with display price or null
 */
export async function getCompetitorProductWithDisplayPrice(
    productId: string,
    tenantId: string
): Promise<CompetitorProductWithDisplayPrice | null> {
    const products = await getCompetitorProductsWithDisplayPrice(tenantId, {
        productId,
    });

    return products.length > 0 ? products[0] : null;
}

/**
 * Get competitor products for a specific site with display prices
 *
 * Requirements: 14.2
 *
 * @param siteId - Competitor site ID
 * @param tenantId - Tenant ID
 * @returns Array of competitor products with display prices
 */
export async function getCompetitorProductsBySite(
    siteId: string,
    tenantId: string
): Promise<CompetitorProductWithDisplayPrice[]> {
    return getCompetitorProductsWithDisplayPrice(tenantId, {
        siteId,
    });
}
