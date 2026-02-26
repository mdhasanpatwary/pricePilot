import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withErrorHandling } from "@/lib/middleware/global-error-handler";
import { withCache } from "@/lib/middleware/api-cache";
import { paginateCursor, getCursorPaginationParams } from "@/lib/utils/pagination";
import { sanitizeProducts } from "@/lib/middleware/sanitize-response";
import { withRequestContextAndRateLimit } from "@/lib/middleware/with-request-context";
import { requireTenantContext, type TenantContext } from "@/lib/auth/wrappers";
import { getTenantCurrency } from "@/lib/tenant/cached-tenant";
import { withDbRetry } from "@/lib/utils/db-retry";

async function handleGET(req: NextRequest, { tenantId }: TenantContext) {
  // Auth and tenant validation handled by requireTenantContext wrapper

  // Parse query parameters
  const searchParams = req.nextUrl.searchParams;
  const q = searchParams.get("q") || "";
  const brand = searchParams.get("brand");
  const category = searchParams.get("category");
  const stock = searchParams.get("stock");
  const ram = searchParams.get("ram");
  const storage = searchParams.get("storage");
  const processor = searchParams.get("processor");

  // Determine currency
  let currency = "USD";
  try {
    currency = await getTenantCurrency(tenantId);
  } catch (e) {
    // keep default USD
  }

  const where: any = {
    tenantId,
    Site: { type: "USER" },
  };

  // 1. Text Search
  if (q) {
    where.OR = [
      { title: { contains: q, mode: "insensitive" } },
      { sku: { contains: q, mode: "insensitive" } },
      { brand: { contains: q, mode: "insensitive" } },
      { model: { contains: q, mode: "insensitive" } },
    ];
  }

  // 2. Standard Filters
  if (brand && brand !== "ALL") where.brand = brand;
  if (category && category !== "ALL") where.category = category;
  if (stock === "INSTOCK") where.inStock = true;
  if (stock === "OOS") where.inStock = false;

  // 3. Tech Spec Filters (JSONB)
  if (ram || storage || processor) {
    const andConditions = [];
    if (ram) andConditions.push({ specifications: { path: ["ram"], equals: ram } });
    if (storage) andConditions.push({ specifications: { path: ["storage"], equals: storage } });
    if (processor) andConditions.push({ specifications: { path: ["processor"], equals: processor } });

    if (andConditions.length > 0) {
      where.AND = andConditions;
    }
  }

  // Get cursor pagination parameters (constant-time, no OFFSET scan)
  const paginationParams = getCursorPaginationParams(searchParams);
  const { sortBy = 'updatedAt', sortOrder = 'desc' } = paginationParams;

  // Get paginated results - retry on transient failures
  const paginatedResult = await withDbRetry(
    () =>
      paginateCursor(prisma.product, where, { ...paginationParams, sortBy, sortOrder }, {
        select: {
          id: true,
          sku: true,
          title: true,
          imageUrl: true,
          currentPrice: true,
          inStock: true,
          stockLevel: true,
          category: true,
          brand: true,
          model: true,
          specifications: true,
          url: true,
          Site: {
            select: {
              baseUrl: true,
            },
          },
        },
      }),
    { operationName: "ListProducts" },
  );

  const products = paginatedResult.data;
  const productIds = products.map((p: any) => p.id);

  // Fetch optimal matches per product avoiding N+1 lateral queries
  let matchesMap = new Map();
  if (productIds.length > 0) {
    const rawMatches = await withDbRetry(() => prisma.productMatch.findMany({
      where: { userProductId: { in: productIds } },
      orderBy: [
        { userProductId: "asc" },
        { competitorProduct: { currentPrice: "asc" } }
      ],
      distinct: ["userProductId"],
      select: {
        id: true,
        userProductId: true,
        competitorProduct: {
          select: {
            url: true,
            imageUrl: true,
            currentPrice: true,
            inStock: true,
            Site: { select: { baseUrl: true } },
          },
        },
      },
    }), { operationName: "ListProductsBestMatches" });

    for (const match of rawMatches) {
      matchesMap.set(match.userProductId, match);
    }
  }

  // Aggregate stats
  const stats = {
    atRisk: 0,
    optimal: 0,
    parity: 0,
    competitorOos: 0,
    notFound: 0,
  };

  // Map to the format expected by the frontend
  const formattedProducts = products.map((product: any) => {
    const bestMatchRaw = matchesMap.get(product.id);
    const allMatches = bestMatchRaw ? [(m => {
      let siteName = "Unknown";
      try {
        const urlObj = new URL(m.competitorProduct.Site.baseUrl);
        siteName = urlObj.hostname.replace("www.", "");
      } catch (e) {
        // Ignore URL parsing errors
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
    })(bestMatchRaw)] : [];

    const bestMatch = bestMatchRaw;
    const yourPrice = parseFloat(product.currentPrice.toString());

    let compPrice: number | null = null;
    let compInStock = false;
    let diff = 0;
    let status = "NEUTRAL";

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

  // Sanitize products to prevent XSS attacks
  // Requirement 2.7.3: XSS prevention for user-generated content
  const sanitizedProducts = sanitizeProducts(formattedProducts);

  return NextResponse.json({
    products: sanitizedProducts,
    stats,
    currency,
    pagination: paginatedResult.pagination,
  });
}

export async function GET(req: NextRequest) {
  return withRequestContextAndRateLimit(req, "read", requireTenantContext(async (req, context) => {
    const cachedHandler = withCache(
      (req) => withErrorHandling((r) => handleGET(r, context))(req),
      {
        ttl: 300, // 5 minutes
        keyPrefix: 'api:products',
        varyBy: ['q', 'brand', 'category', 'stock', 'ram', 'storage', 'processor', 'page', 'limit', 'sortBy', 'sortOrder'],
        tenantIsolated: true,
      }
    );
    return cachedHandler(req);
  }));
}
