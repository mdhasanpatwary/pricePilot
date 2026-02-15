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
    // Optimization: Select only necessary fields and use DB retry
    const matches = await withDbRetry(() => prisma.productMatch.findMany({
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
      }
    }), { operationName: 'FetchMatchesForAnalytics' });

    const atRiskCount = matches.filter((m) => {
      const userPrice = parseFloat(m.userProduct.currentPrice.toString());
      const compPrice = parseFloat(m.competitorProduct.currentPrice.toString());
      return userPrice > compPrice;
    }).length;

    // 4. Market Edge (average price advantage)
    const totalDifference = matches.reduce((sum, m) => {
      const userPrice = parseFloat(m.userProduct.currentPrice.toString());
      const compPrice = parseFloat(m.competitorProduct.currentPrice.toString());
      return sum + (compPrice - userPrice); // Positive = we're cheaper
    }, 0);

    const marketEdge =
      matches.length > 0
        ? Number((totalDifference / matches.length).toFixed(2))
        : 0;

    // 5. Position Summary
    const cheapestCount = matches.filter((m) => {
      const userPrice = parseFloat(m.userProduct.currentPrice.toString());
      const compPrice = parseFloat(m.competitorProduct.currentPrice.toString());
      return userPrice < compPrice * 0.95; // 5% cheaper
    }).length;

    const neutralCount = matches.filter((m) => {
      const userPrice = parseFloat(m.userProduct.currentPrice.toString());
      const compPrice = parseFloat(m.competitorProduct.currentPrice.toString());
      const diff = Math.abs(userPrice - compPrice);
      return diff <= compPrice * 0.05; // Within 5%
    }).length;

    const expensiveCount = matches.filter((m) => {
      const userPrice = parseFloat(m.userProduct.currentPrice.toString());
      const compPrice = parseFloat(m.competitorProduct.currentPrice.toString());
      return userPrice > compPrice * 1.05; // 5% more expensive
    }).length;

    // 6. Category Breakdown
    const categories = Array.from(
      new Set(matches.map((m) => m.userProduct.category).filter(Boolean)),
    );
    const categoryBreakdown = categories.map((cat) => {
      const catMatches = matches.filter((m) => m.userProduct.category === cat);
      const cheapest = catMatches.filter((m) => {
        const up = parseFloat(m.userProduct.currentPrice.toString());
        const cp = parseFloat(m.competitorProduct.currentPrice.toString());
        return up < cp * 0.95;
      }).length;

      return {
        name: cat,
        total: catMatches.length,
        cheapest,
        expensive: catMatches.filter((m) => {
          const up = parseFloat(m.userProduct.currentPrice.toString());
          const cp = parseFloat(m.competitorProduct.currentPrice.toString());
          return up > cp * 1.05;
        }).length,
      };
    });

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
          matches.length - cheapestCount - neutralCount - expensiveCount,
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
