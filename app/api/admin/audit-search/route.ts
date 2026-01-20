import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const query = searchParams.get("query");

  if (!query || query.length < 3) {
    return NextResponse.json({ results: [] });
  }

  try {
    // 1. Find Products matching the query (SKU or ID)
    const products = await prisma.product.findMany({
      where: {
        OR: [
          { sku: { contains: query, mode: "insensitive" } },
          { id: { contains: query, mode: "insensitive" } },
          { title: { contains: query, mode: "insensitive" } },
        ],
      },
      include: {
        site: {
            select: { baseUrl: true, type: true, tenant: { select: { companyName: true } } }
        }
      },
      take: 10,
    });

    const productIds = products.map((p) => p.id);
    const siteIds = products.map((p) => p.siteId);

    // 2. Find Logs (SyncLogs, PriceUpdateLogs, PriceHistory, Matches) related to these products
    const [priceUpdates, syncLogs, matches] = await Promise.all([
      // Price Updates via Rules Engine
      prisma.priceUpdateLog.findMany({
        where: { productId: { in: productIds } },
        orderBy: { executedAt: "desc" },
        take: 20,
      }),
      // Sync Logs for the SITES containing these products
      // (Since logs are per-site, we fetch recent logs for relevant sites)
      prisma.syncLog.findMany({
        where: { siteId: { in: siteIds } },
        orderBy: { createdAt: "desc" },
        take: 20,
      }),
      // Product Matches (Competitor Links)
      prisma.productMatch.findMany({
        where: { userProductId: { in: productIds } },
        include: { competitorProduct: { select: { title: true, currentPrice: true, url: true } } },
      }),
    ]);

    // 3. Format Response
    const results = products.map((product) => {
      const updates = priceUpdates.filter((u) => u.productId === product.id);
      const siteLogs = syncLogs.filter((l) => l.siteId === product.siteId);
      const productMatches = matches.filter((m) => m.userProductId === product.id);

      return {
        product: {
            id: product.id,
            title: product.title,
            sku: product.sku,
            price: product.currentPrice,
            site: product.site.baseUrl,
            tenant: product.site.tenant.companyName,
        },
        logs: {
            priceUpdates: updates,
            syncLogs: siteLogs, // Only site-level context available for now
            matches: productMatches
        }
      };
    });

    return NextResponse.json({ results });
  } catch (error) {
    console.error("Audit Search Error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
