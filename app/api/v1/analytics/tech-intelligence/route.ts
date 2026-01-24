import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { withRateLimit } from "@/lib/middleware/ratelimit";

/**
 * GET /api/v1/analytics/tech-intelligence
 * Provides tech-specific market intelligence: brand performance and specification-based trends.
 */
async function handleGET(_req: NextRequest) {
  const session = await getServerSession(authOptions);

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
    // 1. Fetch all product matches with specifications and brand info
    const matches = await prisma.productMatch.findMany({
      where: {
        userProduct: { tenantId },
      },
      include: {
        userProduct: true,
        competitorProduct: true,
      },
    });

    if (matches.length === 0) {
      return NextResponse.json({
        brandPerformance: [],
        specInsights: {
          ram: [],
          storage: []
        }
      });
    }

    // 2. Aggregate Brand Performance
    const brands = Array.from(new Set(matches.map(m => m.userProduct.brand).filter(Boolean)));
    const brandPerformance = brands.map(brand => {
      const brandMatches = matches.filter(m => m.userProduct.brand === brand);
      const total = brandMatches.length;
      
      const atRisk = brandMatches.filter(m => {
        const up = parseFloat(m.userProduct.currentPrice.toString());
        const cp = parseFloat(m.competitorProduct.currentPrice.toString());
        return up > cp;
      }).length;

      const totalDiff = brandMatches.reduce((sum, m) => {
        const up = parseFloat(m.userProduct.currentPrice.toString());
        const cp = parseFloat(m.competitorProduct.currentPrice.toString());
        return sum + (cp - up);
      }, 0);

      const avgPrice = brandMatches.reduce((sum, m) => sum + parseFloat(m.userProduct.currentPrice.toString()), 0) / total;

      return {
        brand,
        total,
        atRisk,
        riskPercentage: Math.round((atRisk / total) * 100),
        avgPrice: Math.round(avgPrice),
        marketIndex: Number((totalDiff / total).toFixed(2))
      };
    }).sort((a, b) => b.total - a.total);

    // 3. Aggregate Specification Insights (RAM / Storage)
    const extractSpec = (p: any, key: string) => {
        const specs = p.specifications as any;
        if (!specs) return null;
        return specs[key];
    };

    const aggregateBySpec = (matches: any[], specKey: string) => {
        const variations = Array.from(new Set(matches.map(m => extractSpec(m.userProduct, specKey)).filter(Boolean)));
        return variations.map(v => {
            const varMatches = matches.filter(m => extractSpec(m.userProduct, specKey) === v);
            const total = varMatches.length;
            const avgPrice = varMatches.reduce((sum, m) => sum + parseFloat(m.userProduct.currentPrice.toString()), 0) / total;
            const competitorAvg = varMatches.reduce((sum, m) => sum + parseFloat(m.competitorProduct.currentPrice.toString()), 0) / total;
            
            return {
                value: v,
                total,
                avgPrice: Math.round(avgPrice),
                competitorAvg: Math.round(competitorAvg),
                gap: Math.round(competitorAvg - avgPrice)
            };
        }).sort((a, b) => b.total - a.total);
    };

    const ramInsights = aggregateBySpec(matches, 'ram');
    const storageInsights = aggregateBySpec(matches, 'storage');

    return NextResponse.json({
      brandPerformance,
      specInsights: {
        ram: ramInsights,
        storage: storageInsights
      }
    });
  } catch (error) {
    console.error("Error fetching tech intelligence:", error);
    return NextResponse.json(
      { error: "Failed to fetch tech intelligence" },
      { status: 500 },
    );
  }
}

export async function GET(req: NextRequest) {
  return withRateLimit(req, "read", handleGET);
}
