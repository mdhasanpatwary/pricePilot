import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { withRateLimit } from "@/lib/middleware/ratelimit";

/**
 * GET /api/v1/analytics/competitor-analysis
 * Cross-competitor comparison data grouped by category.
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
    // 1. Get all competitor sites for this tenant
    const competitorSites = await prisma.site.findMany({
      where: { tenantId, type: "COMPETITOR" },
      select: { id: true, baseUrl: true }
    });

    // 2. Get all products from these sites
    const competitorProducts = await prisma.product.findMany({
      where: {
        tenantId,
        site: { type: "COMPETITOR" }
      },
      select: {
          id: true,
          siteId: true,
          category: true,
          currentPrice: true
      }
    });

    // 3. Get all matched products to see where they overlap
    const matches = await prisma.productMatch.findMany({
        where: { userProduct: { tenantId } },
        include: { 
            userProduct: { select: { category: true } },
            competitorProduct: { select: { siteId: true, category: true } } 
        }
    });

    // 4. Transform sites to include derived names (consistent with competitor route)
    const competitors = competitorSites.map(site => {
        let name = "Unknown";
        try {
            const urlObj = new URL(site.baseUrl.startsWith("http") ? site.baseUrl : `https://${site.baseUrl}`);
            const hostname = urlObj.hostname;
            const cleanHostname = hostname.replace(/^www\./, "");
            const parts = cleanHostname.split(".");
            const rawName = parts.length > 1 ? parts[0] : cleanHostname;
            name = rawName.charAt(0).toUpperCase() + rawName.slice(1);
        } catch (e) { /* ignore */ }
        return { ...site, name };
    });

    // 5. Extract unique categories
    const matchedCategories = Array.from(new Set(matches.map(m => m.userProduct.category).filter(Boolean))) as string[];
    const allCategories = Array.from(new Set(competitorProducts.map(p => p.category).filter(Boolean))) as string[];
    const categories = matchedCategories.length > 0 ? matchedCategories : allCategories;

    // 6. Aggregate metrics
    const analysis = categories.map(cat => {
        const catData: any = { category: cat };
        
        competitors.forEach(site => {
            const siteProducts = competitorProducts.filter(p => p.siteId === site.id && p.category === cat);
            const total = siteProducts.length;
            
            if (total > 0) {
                const avgPrice = siteProducts.reduce((sum, p) => sum + parseFloat(p.currentPrice.toString()), 0) / total;
                catData[site.name] = Math.round(avgPrice);
                catData[`${site.name}_count`] = total;
            } else {
                catData[site.name] = null;
                catData[`${site.name}_count`] = 0;
            }
        });

        return catData;
    });

    return NextResponse.json({
      competitors: competitors.map(s => ({ id: s.id, name: s.name })),
      categories,
      data: analysis
    });
  } catch (error) {
    console.error("Error fetching competitor analysis:", error);
    return NextResponse.json(
      { error: "Failed to fetch competitor analysis" },
      { status: 500 },
    );
  }
}

export async function GET(req: NextRequest) {
  return withRateLimit(req, "read", handleGET);
}
