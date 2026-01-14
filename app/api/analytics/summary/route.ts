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

  const tenantId = (session.user as any).tenantId;

  try {
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
      ? (totalDifference / matches.length).toFixed(2)
      : "0.00";

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
        marketEdge: `$${marketEdge}`,
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
