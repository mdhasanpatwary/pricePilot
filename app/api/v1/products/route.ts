import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { withRateLimit } from "@/lib/middleware/ratelimit";
import { withErrorHandling } from "@/lib/middleware/global-error-handler";
import { UnauthorizedError } from "@/lib/utils/error-handler";
import { withCache, CacheConfigs } from "@/lib/middleware/api-cache";

async function handleGET(req: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    throw new UnauthorizedError('Authentication required to access products');
  }

  const tenantId = session.user.tenantId;

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
    const anyUserProduct = await prisma.product.findFirst({
      where: { tenantId, site: { type: "USER" } },
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
    // keep default USD
  }

  const where: any = {
    tenantId,
    site: { type: "USER" },
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

  const products = await prisma.product.findMany({
    where,
    include: {
      site: true,
      matchesAsUser: {
        include: {
          competitorProduct: {
            include: {
              site: true,
            },
          },
        },
      },
    },
    orderBy: {
      updatedAt: "desc",
    },
  });

  // Aggregate stats
  const stats = {
    atRisk: 0,
    optimal: 0,
    parity: 0,
    competitorOos: 0,
    notFound: 0,
  };

  // Map to the format expected by the frontend
  const formattedProducts = products.map((product) => {
    const allMatches = product.matchesAsUser.map((m) => {
      let siteName = "Unknown";
      try {
        const urlObj = new URL(m.competitorProduct.site.baseUrl);
        siteName = urlObj.hostname.replace("www.", "");
      } catch (e) { }

      return {
        id: m.id,
        siteName,
        url: m.competitorProduct.url || m.competitorProduct.site.baseUrl,
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
      match: bestMatch?.competitorProduct.site?.baseUrl || null,
      stock: product.inStock ? product.stockLevel || 0 : 0,
      inStock: product.inStock,
      compInStock,
      category: product.category || "Uncategorized",
      brand: product.brand || "Generic",
      model: product.model || "N/A",
      siteName: product.site?.baseUrl
        ? new URL(product.site.baseUrl).hostname.replace("www.", "")
        : "Unknown",
      allMatches,
      specifications: product.specifications || {},
      url: product.url || null,
    };
  });

  return NextResponse.json({
    products: formattedProducts,
    stats,
    currency,
  });
}

export async function GET(req: NextRequest) {
  // Apply caching with 2-minute TTL (120 seconds)
  const cachedHandler = withCache(
    (req) => withRateLimit(req, "read", withErrorHandling(handleGET)),
    {
      ttl: 120, // 2 minutes
      keyPrefix: 'api:products',
      varyBy: ['q', 'brand', 'category', 'stock', 'ram', 'storage', 'processor'],
      tenantIsolated: true,
    }
  );

  return cachedHandler(req);
}
