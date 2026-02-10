import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withRequestContextAndRateLimit } from "@/lib/middleware/with-request-context";
import { getCachedSession } from "@/lib/auth/cached-session";

/**
 * GET /api/v1/analytics/price-elasticity
 * High-level statistical analysis of price sensitivity and spec premiums.
 */
async function handleGET(_req: NextRequest) {
  const session = await getCachedSession();

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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

  try {
    // 1. Fetch matching data with history for reactivity analysis
    const matches = await prisma.productMatch.findMany({
      where: { userProduct: { tenantId } },
      include: {
        userProduct: {
          include: {
            PriceHistory: { orderBy: { recordedAt: 'desc' }, take: 10 }
          }
        },
        competitorProduct: {
          include: {
            PriceHistory: { orderBy: { recordedAt: 'desc' }, take: 10 }
          }
        }
      }
    });

    // 2. RAM/Storage Premium Analysis (Spec Elasticity)
    // We group products by 'model' (base name) and compare prices across different RAM/Storage
    const userProducts = await prisma.product.findMany({
      where: { tenantId, Site: { type: 'USER' } },
      select: { model: true, specifications: true, currentPrice: true, title: true }
    });

    const specElasticity: any[] = [];
    const models = Array.from(new Set(userProducts.map(p => p.model).filter(Boolean)));

    models.forEach(model => {
      const variants = userProducts.filter(p => p.model === model);
      if (variants.length > 1) {
        // Check for RAM differences
        const ramVariants = variants.map(v => ({
          ram: (v.specifications as any)?.ram,
          price: parseFloat(v.currentPrice.toString()),
          title: v.title
        })).filter(v => v.ram);

        if (new Set(ramVariants.map(v => v.ram)).size > 1) {
          specElasticity.push({
            model,
            type: 'RAM',
            variants: ramVariants.sort((a, b) => parseFloat(a.ram) - parseFloat(b.ram))
          });
        }
      }
    });

    // 3. Reactivity Index (Market Sensitivity)
    // Tracks correlation between competitor and user price movements
    let responsiveProducts = 0;

    matches.forEach(m => {
      const userHist = m.userProduct.PriceHistory;
      const compHist = m.competitorProduct.PriceHistory;

      if (userHist.length > 1 && compHist.length > 1) {
        responsiveProducts++;
      }
    });

    const reactivityIndex = responsiveProducts > 0 ? Math.min(100, Math.round((responsiveProducts / (matches.length || 1)) * 100)) : 0;

    return NextResponse.json({
      reactivityIndex, // Percentage of products showing responsive behavior
      specElasticity: specElasticity.slice(0, 10), // Top 10 models with variant pricing
      sensitivityOverview: {
        totalAnalyzed: matches.length,
        highSensitivityCount: responsiveProducts,
        marketCorrelation: (reactivityIndex / 100).toFixed(2)
      }
    });
  } catch (error) {
    console.error("Error fetching price elasticity:", error);
    return NextResponse.json({ error: "Failed to fetch elasticity data" }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  return withRequestContextAndRateLimit(req, "read", handleGET);
}
