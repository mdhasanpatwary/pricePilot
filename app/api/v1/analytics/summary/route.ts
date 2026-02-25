import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withRequestContextAndRateLimit } from "@/lib/middleware/with-request-context";
import { getCachedSession } from "@/lib/auth/cached-session";
import { withCache } from "@/lib/middleware/api-cache";
import { withErrorHandling } from "@/lib/middleware/global-error-handler";
import { withDbRetry } from "@/lib/utils/db-retry";
import { getTenantCurrency } from "@/lib/tenant/cached-tenant";

/**
 * GET /api/analytics/summary
 * Real-time dashboard statistics aggregated from the database
 */
async function handleGET(_req: NextRequest) {
  const session = await getCachedSession();

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Allow super admins to impersonate a tenant
  const searchParams = _req.nextUrl.searchParams;
  const impersonateId = searchParams.get("tenantId");
  const tenantId =
    session.user.isSuperAdmin && impersonateId
      ? impersonateId
      : session.user.tenantId;

  if (!tenantId) {
    return NextResponse.json(
      { error: "Tenant context not found" },
      { status: 400 },
    );
  }

  // Determine currency dynamically
  const currency = await getTenantCurrency(tenantId);

  try {
    // 1. Total SKUs (user products) - retry on transient failures
    const totalProducts = await withDbRetry(() => prisma.product.count({
      where: {
        tenantId,
        Site: { type: "USER" },
      },
    }), { operationName: 'CountUserProducts' });

    // 2. Active Competitors
    const activeCompetitors = await withDbRetry(() => prisma.site.count({
      where: {
        tenantId,
        type: "COMPETITOR",
      },
    }), { operationName: 'CountCompetitors' });

    // 3. Critical Alerts & Position Summary
    // Optimization: Process matches in batches to avoid OOM for large tenants
    let skip = 0;
    const take = 5000;
    let hasMore = true;

    let totalMatches = 0;
    let atRiskCount = 0;
    let totalDifference = 0;
    let cheapestCount = 0;
    let neutralCount = 0;
    let expensiveCount = 0;

    const categoryStats = new Map<string, { total: number; cheapest: number; expensive: number }>();

    while (hasMore) {
      const batch = await withDbRetry(() => prisma.productMatch.findMany({
        where: {
          userProduct: { tenantId },
        },
        select: {
          userProduct: {
            select: {
              currentPrice: true,
              category: true,
            }
          },
          competitorProduct: {
            select: {
              currentPrice: true,
            }
          }
        },
        take,
        skip,
        // Order by ID is required for stable skip offset
        orderBy: { id: 'asc' }
      }), { operationName: 'FetchMatchesForAnalytics' });

      if (batch.length === 0) break;
      hasMore = batch.length === take;
      skip += take;
      totalMatches += batch.length;

      for (const m of batch) {
        const userPrice = parseFloat(m.userProduct.currentPrice.toString());
        const compPrice = parseFloat(m.competitorProduct.currentPrice.toString());

        if (userPrice > compPrice) atRiskCount++;

        totalDifference += (compPrice - userPrice);

        if (userPrice < compPrice * 0.95) cheapestCount++;
        else if (userPrice > compPrice * 1.05) expensiveCount++;
        else neutralCount++;

        if (m.userProduct.category) {
          const cat = m.userProduct.category;
          let stats = categoryStats.get(cat);
          if (!stats) {
            stats = { total: 0, cheapest: 0, expensive: 0 };
            categoryStats.set(cat, stats);
          }
          stats.total++;
          if (userPrice < compPrice * 0.95) stats.cheapest++;
          else if (userPrice > compPrice * 1.05) stats.expensive++;
        }
      }
    }

    const marketEdge = totalMatches > 0
        ? Number((totalDifference / totalMatches).toFixed(2))
        : 0;

    // Format category breakdown
    const categoryBreakdown = Array.from(categoryStats.entries()).map(([name, stats]) => ({
      name,
      ...stats
    }));

    return NextResponse.json({
      stats: {
        totalSKUs: totalProducts,
        activeRivals: activeCompetitors,
        criticalAlerts: atRiskCount,
        marketEdge,
        currency,
      },
      positionSummary: {
        cheapest: cheapestCount,
        nearCheapest:
          totalMatches - cheapestCount - neutralCount - expensiveCount,
        neutral: neutralCount,
        expensive: expensiveCount,
      },
      categoryBreakdown,
    });
  } catch (error) {
    console.error("Error fetching analytics summary:", error);
    return NextResponse.json(
      { error: "Failed to fetch analytics" },
      { status: 500 },
    );
  }
}

export async function GET(req: NextRequest) {
  return withRequestContextAndRateLimit(req, "read", (req) => {
    const cachedHandler = withCache(
      (req) => withErrorHandling(handleGET)(req),
      {
        ttl: 600, // 10 minutes for dashboard stats
        keyPrefix: 'api:analytics:summary',
        tenantIsolated: true,
      }
    );
    return cachedHandler(req);
  });
}
