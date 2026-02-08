import { prisma } from "@/lib/prisma";
import { CacheEnhancedService, ComparisonFilters } from "./cache-enhanced";
import { logger } from "@/lib/logger";

/**
 * Comparison Service with Caching
 *
 * Handles product comparison queries with intelligent caching:
 * - Comparison reports with filtering and pagination
 * - Individual product comparisons
 * - Graceful degradation on cache failures
 * - 5-minute TTL for comparison data
 * - Cache warming for related competitor products
 *
 * Requirements: 1.2, 1.6, 3.2
 */

export interface ComparisonReport {
    products: ComparisonProduct[];
    stats: ComparisonStats;
    currency: string;
}

export interface ComparisonProduct {
    id: string;
    sku: string;
    title: string;
    image: string | null;
    yourPrice: number;
    compPrice: number | null;
    diff: number;
    status: "RED" | "GREEN" | "NEUTRAL" | "COMP_OOS" | "NOT_FOUND";
    match: string | null;
    stock: number;
    inStock: boolean;
    compInStock: boolean;
    category: string;
    brand: string;
    model: string;
    siteName: string;
    allMatches: CompetitorMatch[];
    specifications: any;
    url: string | null;
}

export interface CompetitorMatch {
    id: string;
    siteName: string;
    url: string;
    price: number;
    image: string | null;
    inStock: boolean;
}

export interface ComparisonStats {
    atRisk: number;
    optimal: number;
    parity: number;
    competitorOos: number;
    notFound: number;
}

export interface ProductComparison {
    product: ComparisonProduct;
    competitors: CompetitorMatch[];
    priceHistory: PriceHistoryEntry[];
}

export interface PriceHistoryEntry {
    date: Date;
    price: number;
    productType: "user" | "competitor";
}

export class ComparisonService {
    private cacheService: CacheEnhancedService;
    private readonly COMPARISON_TTL = 300; // 5 minutes

    constructor(cacheService?: CacheEnhancedService) {
        this.cacheService = cacheService || new CacheEnhancedService();
    }

    /**
     * Get comparison report with caching
     * Requirement 1.2: Cache infrastructure integration
     * Requirement 1.6: Graceful degradation on cache failure
     * Requirement 3.2: Warm related competitor products when generating report
     */
    async getComparisonReport(
        tenantId: string,
        filters: ComparisonFilters = {}
    ): Promise<ComparisonReport> {
        try {
            // Try cache first
            const cached = await this.cacheService.getCachedComparison(tenantId, filters);
            if (cached) {
                logger.info('[ComparisonService] Cache hit for comparison report', { tenantId, filters });
                return cached;
            }

            logger.info('[ComparisonService] Cache miss, querying database', { tenantId, filters });

            // Cache miss - query database
            const report = await this.queryComparisonData(tenantId, filters);

            // Store in cache (fire and forget - don't block response)
            this.cacheService.cacheComparison(tenantId, filters, report, this.COMPARISON_TTL)
                .catch(error => {
                    logger.error('[ComparisonService] Failed to cache comparison report', { tenantId, filters, error });
                });

            // Warm related competitor products (fire and forget)
            // Requirement 3.2: Warm cache with related competitor products
            this.warmRelatedCompetitorProducts(tenantId, report.products)
                .catch(error => {
                    logger.error('[ComparisonService] Failed to warm competitor products', { tenantId, error });
                    // Don't block response on warming failure
                });

            return report;
        } catch (error) {
            logger.error('[ComparisonService] Error getting comparison report', { tenantId, filters, error });

            // Graceful degradation - try direct query without cache
            try {
                return await this.queryComparisonData(tenantId, filters);
            } catch (dbError) {
                logger.error('[ComparisonService] Database query failed', { tenantId, filters, error: dbError });
                throw dbError;
            }
        }
    }

    /**
     * Get individual product comparison with caching
     * Requirement 1.2: Cache infrastructure integration
     * Requirement 1.6: Graceful degradation on cache failure
     */
    async getProductComparison(
        tenantId: string,
        productId: string
    ): Promise<ProductComparison> {
        try {
            // Try cache first
            const cached = await this.cacheService.getCachedProduct(tenantId, productId);
            if (cached) {
                logger.info('[ComparisonService] Cache hit for product comparison', { tenantId, productId });
                return cached;
            }

            logger.info('[ComparisonService] Cache miss, querying database', { tenantId, productId });

            // Cache miss - query database
            const comparison = await this.queryProductComparison(tenantId, productId);

            // Store in cache (fire and forget)
            this.cacheService.cacheProduct(tenantId, productId, comparison, this.COMPARISON_TTL)
                .catch(error => {
                    logger.error('[ComparisonService] Failed to cache product comparison', { tenantId, productId, error });
                });

            return comparison;
        } catch (error) {
            logger.error('[ComparisonService] Error getting product comparison', { tenantId, productId, error });

            // Graceful degradation - try direct query without cache
            try {
                return await this.queryProductComparison(tenantId, productId);
            } catch (dbError) {
                logger.error('[ComparisonService] Database query failed', { tenantId, productId, error: dbError });
                throw dbError;
            }
        }
    }

    /**
     * Query comparison data from database
     * Private method - called when cache misses
     */
    private async queryComparisonData(
        tenantId: string,
        filters: ComparisonFilters
    ): Promise<ComparisonReport> {
        // Determine currency
        let currency = "USD";
        try {
            const anyUserProduct = await prisma.product.findFirst({
                where: { tenantId, Site: { type: "USER" } },
                select: { currency: true },
                orderBy: { createdAt: "desc" },
            });
            if (anyUserProduct?.currency) {
                currency = anyUserProduct.currency;
            } else {
                const userSite = await prisma.site.findFirst({
                    where: { tenantId, type: "USER" },
                    orderBy: { createdAt: "desc" },
                });
                if (userSite?.currency) {
                    currency = userSite.currency;
                } else {
                    const tenant = await prisma.tenant.findUnique({
                        where: { id: tenantId },
                    });
                    currency = (tenant as any)?.currency || "USD";
                }
            }
        } catch (e) {
            logger.warn('[ComparisonService] Failed to determine currency, using USD', { tenantId, error: e });
        }

        // Build where clause from filters
        const where: any = {
            tenantId,
            Site: { type: "USER" },
        };

        // Apply filters
        if (filters.status && filters.status !== "ALL") {
            // Status filtering will be done post-query since it depends on comparison logic
        }

        // Query products with matches
        const products = await prisma.product.findMany({
            where,
            include: {
                Site: true,
                matchesAsUser: {
                    include: {
                        competitorProduct: {
                            include: {
                                Site: true,
                            },
                        },
                    },
                },
            },
            orderBy: filters.sortBy
                ? { [filters.sortBy]: filters.sortOrder || "asc" }
                : { updatedAt: "desc" },
            skip: filters.page && filters.limit ? (filters.page - 1) * filters.limit : undefined,
            take: filters.limit,
        });

        // Aggregate stats
        const stats: ComparisonStats = {
            atRisk: 0,
            optimal: 0,
            parity: 0,
            competitorOos: 0,
            notFound: 0,
        };

        // Map to comparison format
        const formattedProducts: ComparisonProduct[] = products.map((product) => {
            const allMatches: CompetitorMatch[] = product.matchesAsUser.map((m) => {
                let siteName = "Unknown";
                try {
                    const urlObj = new URL(m.competitorProduct.Site.baseUrl);
                    siteName = urlObj.hostname.replace("www.", "");
                } catch (e) {
                    logger.warn('[ComparisonService] Invalid competitor URL', { url: m.competitorProduct.Site.baseUrl });
                }

                return {
                    id: m.id,
                    siteName,
                    url: m.competitorProduct.url || m.competitorProduct.Site.baseUrl,
                    price: parseFloat(m.competitorProduct.currentPrice.toString()),
                    image: m.competitorProduct.imageUrl || null,
                    inStock:
                        m.competitorProduct.inStock &&
                        parseFloat(m.competitorProduct.currentPrice.toString()) > 0,
                };
            });

            const bestMatch = product.matchesAsUser[0];
            const yourPrice = parseFloat(product.currentPrice.toString());

            let compPrice: number | null = null;
            let compInStock = false;
            let diff = 0;
            let status: "RED" | "GREEN" | "NEUTRAL" | "COMP_OOS" | "NOT_FOUND" = "NEUTRAL";

            if (bestMatch) {
                compPrice = parseFloat(
                    bestMatch.competitorProduct.currentPrice.toString(),
                );
                compInStock = bestMatch.competitorProduct.inStock && compPrice > 0;

                if (compInStock) {
                    diff = compPrice - yourPrice;
                    if (diff < 0) status = "RED";
                    else if (diff > 0) status = "GREEN";
                } else {
                    status = "COMP_OOS";
                }
            } else {
                status = "NOT_FOUND";
            }

            // Stats aggregation
            if (status === "RED") stats.atRisk++;
            else if (status === "GREEN") stats.optimal++;
            else if (status === "NEUTRAL") stats.parity++;
            else if (status === "COMP_OOS") stats.competitorOos++;
            else if (status === "NOT_FOUND") stats.notFound++;

            return {
                id: product.id,
                sku: product.sku || "N/A",
                title: product.title,
                image: product.imageUrl || null,
                yourPrice,
                compPrice,
                diff,
                status,
                match: bestMatch?.competitorProduct.Site?.baseUrl || null,
                stock: product.inStock ? product.stockLevel || 0 : 0,
                inStock: product.inStock,
                compInStock,
                category: product.category || "Uncategorized",
                brand: product.brand || "Generic",
                model: product.model || "N/A",
                siteName: product.Site?.baseUrl
                    ? new URL(product.Site.baseUrl).hostname.replace("www.", "")
                    : "Unknown",
                allMatches,
                specifications: product.specifications || {},
                url: product.url || null,
            };
        });

        // Apply status filter if specified
        let filteredProducts = formattedProducts;
        if (filters.status && filters.status !== "ALL") {
            filteredProducts = formattedProducts.filter(p => p.status === filters.status);
        }

        return {
            products: filteredProducts,
            stats,
            currency,
        };
    }

    /**
     * Query individual product comparison from database
     * Private method - called when cache misses
     */
    private async queryProductComparison(
        tenantId: string,
        productId: string
    ): Promise<ProductComparison> {
        // Query product with matches
        const product = await prisma.product.findFirst({
            where: {
                id: productId,
                tenantId,
            },
            include: {
                Site: true,
                matchesAsUser: {
                    include: {
                        competitorProduct: {
                            include: {
                                Site: true,
                            },
                        },
                    },
                },
                PriceHistory: {
                    orderBy: { recordedAt: "desc" },
                    take: 30, // Last 30 price points
                },
            },
        });

        if (!product) {
            throw new Error(`Product not found: ${productId}`);
        }

        // Format competitor matches
        const competitors: CompetitorMatch[] = product.matchesAsUser.map((m) => {
            let siteName = "Unknown";
            try {
                const urlObj = new URL(m.competitorProduct.Site.baseUrl);
                siteName = urlObj.hostname.replace("www.", "");
            } catch (e) {
                logger.warn('[ComparisonService] Invalid competitor URL', { url: m.competitorProduct.Site.baseUrl });
            }

            return {
                id: m.id,
                siteName,
                url: m.competitorProduct.url || m.competitorProduct.Site.baseUrl,
                price: parseFloat(m.competitorProduct.currentPrice.toString()),
                image: m.competitorProduct.imageUrl || null,
                inStock:
                    m.competitorProduct.inStock &&
                    parseFloat(m.competitorProduct.currentPrice.toString()) > 0,
            };
        });

        // Calculate comparison status
        const bestMatch = product.matchesAsUser[0];
        const yourPrice = parseFloat(product.currentPrice.toString());

        let compPrice: number | null = null;
        let compInStock = false;
        let diff = 0;
        let status: "RED" | "GREEN" | "NEUTRAL" | "COMP_OOS" | "NOT_FOUND" = "NEUTRAL";

        if (bestMatch) {
            compPrice = parseFloat(
                bestMatch.competitorProduct.currentPrice.toString(),
            );
            compInStock = bestMatch.competitorProduct.inStock && compPrice > 0;

            if (compInStock) {
                diff = compPrice - yourPrice;
                if (diff < 0) status = "RED";
                else if (diff > 0) status = "GREEN";
            } else {
                status = "COMP_OOS";
            }
        } else {
            status = "NOT_FOUND";
        }

        // Format product
        const formattedProduct: ComparisonProduct = {
            id: product.id,
            sku: product.sku || "N/A",
            title: product.title,
            image: product.imageUrl || null,
            yourPrice,
            compPrice,
            diff,
            status,
            match: bestMatch?.competitorProduct.Site?.baseUrl || null,
            stock: product.inStock ? product.stockLevel || 0 : 0,
            inStock: product.inStock,
            compInStock,
            category: product.category || "Uncategorized",
            brand: product.brand || "Generic",
            model: product.model || "N/A",
            siteName: product.Site?.baseUrl
                ? new URL(product.Site.baseUrl).hostname.replace("www.", "")
                : "Unknown",
            allMatches: competitors,
            specifications: product.specifications || {},
            url: product.url || null,
        };

        // Format price history
        const priceHistory: PriceHistoryEntry[] = (product as any).PriceHistory.map((h: any) => ({
            date: h.recordedAt,
            price: parseFloat(h.price.toString()),
            productType: "user" as const,
        }));

        return {
            product: formattedProduct,
            competitors,
            priceHistory,
        };
    }

    /**
     * Warm cache with related competitor products from comparison report
     * Requirement 3.2: Warm related competitor products when generating report
     * Private method - called after generating comparison report
     */
    private async warmRelatedCompetitorProducts(
        tenantId: string,
        products: ComparisonProduct[]
    ): Promise<void> {
        try {
            logger.debug('[ComparisonService] Warming related competitor products', {
                tenantId,
                productsCount: products.length
            });

            // Extract unique competitor site IDs from all matches
            const competitorSiteIds = new Set<string>();
            for (const product of products) {
                for (const match of product.allMatches || []) {
                    if (match.id) {
                        // Extract site ID from match ID (format: matchId contains competitor product info)
                        // We'll query the database to get the actual site IDs
                        competitorSiteIds.add(match.id);
                    }
                }
            }

            logger.debug('[ComparisonService] Found competitor matches', {
                tenantId,
                count: competitorSiteIds.size
            });

            // For each unique competitor site, cache their products
            const competitorSites = await prisma.site.findMany({
                where: {
                    tenantId,
                    type: 'COMPETITOR'
                },
                select: { id: true }
            });

            for (const site of competitorSites) {
                try {
                    // Get competitor products for this site
                    const competitorProducts = await prisma.product.findMany({
                        where: {
                            tenantId,
                            siteId: site.id,
                            Site: { type: 'COMPETITOR' }
                        },
                        take: 50, // Limit to top 50 products per site
                        orderBy: { updatedAt: 'desc' }
                    });

                    // Cache competitor products
                    await this.cacheService.cacheCompetitorProducts(
                        tenantId,
                        site.id,
                        competitorProducts,
                        1800 // 30 minutes TTL
                    );

                    logger.debug('[ComparisonService] Cached competitor products', {
                        tenantId,
                        siteId: site.id,
                        count: competitorProducts.length
                    });
                } catch (error) {
                    logger.warn('[ComparisonService] Failed to cache competitor products for site', {
                        tenantId,
                        siteId: site.id,
                        error: error instanceof Error ? error.message : String(error)
                    });
                    // Continue with next site
                }
            }

            logger.debug('[ComparisonService] Completed warming competitor products', { tenantId });
        } catch (error) {
            logger.error('[ComparisonService] Failed to warm related competitor products', {
                tenantId,
                error: error instanceof Error ? error.message : String(error)
            });
            // Don't throw - warming failures should not block operations
        }
    }
}

// Export singleton instance
export const comparisonService = new ComparisonService();
