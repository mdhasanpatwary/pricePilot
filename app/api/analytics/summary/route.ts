import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/analytics/summary
 * Real-time dashboard statistics aggregated from the database
 */
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tenantId = session.user.tenantId;

  try {
    // Determine currency dynamically from integrated USER site products first,
    // then fall back to Tenant.currency, then USD.
    let currency = "USD";
    try {
      // Prefer the USER Site currency (most recently synced or created)
      const userSite = await prisma.site.findFirst({
        where: { tenantId, type: "USER" },
        orderBy: [
          { lastSyncAt: "desc" },
          { createdAt: "desc" },
        ],
      });
      if ((userSite as any)?.currency) {
        currency = (userSite as any).currency;
      } else {
        const anyUserProduct = await prisma.product.findFirst({
          where: { tenantId, site: { type: "USER" } },
          select: { currency: true },
          orderBy: { createdAt: "desc" },
        });
        if (anyUserProduct?.currency) {
          currency = anyUserProduct.currency;
        } else {
          const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
          currency = (tenant as any)?.currency || "USD";
        }
      }
    } catch {
      // ignore and keep default USD
    }
    // 1. Total SKUs (user products)
    const totalProducts = await prisma.product.count({
      where: {
        tenantId,
        site: { type: "USER" },
      },
    });

    // 2. Active Competitors
    const activeCompetitors = await prisma.site.count({
      where: {
        tenantId,
        type: "COMPETITOR",
      },
    });

    // 3. Critical Alerts (products at risk - more expensive than competition)
    const matches = await prisma.productMatch.findMany({
      where: {
        userProduct: { tenantId },
      },
      include: {
        userProduct: true,
        competitorProduct: true,
      },
    });

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

    const marketEdge = matches.length > 0
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
        nearCheapest: matches.length - cheapestCount - neutralCount - expensiveCount,
        neutral: neutralCount,
        expensive: expensiveCount,
      },
    });
  } catch (error) {
    console.error("Error fetching analytics summary:", error);
    return NextResponse.json(
      { error: "Failed to fetch analytics" },
      { status: 500 }
    );
  }
}
