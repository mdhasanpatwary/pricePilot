import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]/route";
import { withRateLimit } from "@/lib/middleware/ratelimit";

async function handleGET(_req: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tenantId = session.user.tenantId;

  try {
    // Determine currency from user's integrated products first, then tenant, else USD
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
        // Prefer USER site currency if available
        const userSite = await prisma.site.findFirst({
          where: { tenantId, type: "USER" },
          orderBy: { createdAt: "desc" },
        });
        if ((userSite as any)?.currency) {
          currency = (userSite as any).currency;
        } else {
          const tenant = await prisma.tenant.findUnique({
            where: { id: tenantId },
          });
          currency = (tenant as any)?.currency || "USD";
        }
      }
    } catch (e) {
      // keep default USD on any error
    }

    const products = await prisma.product.findMany({
      where: {
        tenantId,
        site: {
          type: "USER",
        },
      },
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

    interface ProductWithStock {
      id: string;
      sku: string | null;
      title: string;
      currentPrice: any;
      inStock: boolean;
      stockLevel: number | null;
      category: string | null;
      brand: string | null;
      model: string | null;
      site: { baseUrl: string };
      matchesAsUser: any[];
      updatedAt: Date;
    }

    // Map to the format expected by the frontend
    const formattedProducts = (products as unknown as ProductWithStock[]).map(
      (product) => {
        // Process all matches
        const allMatches = product.matchesAsUser.map((m) => {
          const urlObj = new URL(m.competitorProduct.site.baseUrl);
          return {
            siteName: urlObj.hostname.replace("www.", ""),
            url: m.competitorProduct.url || m.competitorProduct.site.baseUrl,
            price: parseFloat(m.competitorProduct.currentPrice.toString()),
            inStock:
              m.competitorProduct.inStock &&
              parseFloat(m.competitorProduct.currentPrice.toString()) > 0,
          };
        });

        const bestMatch = product.matchesAsUser[0];
        let rawCompPrice = bestMatch
          ? parseFloat(bestMatch.competitorProduct.currentPrice.toString())
          : null;
        const compInStock = bestMatch
          ? bestMatch.competitorProduct.inStock &&
            rawCompPrice !== null &&
            rawCompPrice > 0
          : false;
        const compPrice =
          rawCompPrice !== null && rawCompPrice > 0 ? rawCompPrice : null;
        const yourPrice = parseFloat(product.currentPrice.toString());

        let diff = 0;
        let status = "NEUTRAL";

        if (!bestMatch) {
          status = "NOT_FOUND";
        } else if (compPrice !== null && compInStock) {
          diff = compPrice - yourPrice;
          if (diff < 0) status = "RED";
          else if (diff > 0) status = "GREEN";
        } else if (bestMatch && (!compInStock || compPrice === null)) {
          status = "COMP_OOS";
        }

        // Stats aggregation
        if (status === "RED") {
          stats.atRisk++;
        } else if (status === "GREEN") {
          stats.optimal++;
        } else if (status === "NEUTRAL") {
          stats.parity++;
        } else if (status === "COMP_OOS") {
          stats.competitorOos++;
        } else if (status === "NOT_FOUND") {
          stats.notFound++;
        }

        return {
          id: product.id,
          sku: product.sku || "N/A",
          title: product.title,
          yourPrice,
          compPrice,
          diff,
          status,
          match: bestMatch?.competitorProduct.site?.baseUrl || null,
          stock: product.inStock ? product.stockLevel : 0,
          inStock: product.inStock,
          compInStock,
          category: product.category || "Uncategorized",
          brand: product.brand || "Generic",
          model: product.model || "N/A",
          siteName: product.site?.baseUrl
            ? new URL(product.site.baseUrl).hostname.replace("www.", "")
            : "Unknown",
          allMatches,
        };
      },
    );

    return NextResponse.json({
      products: formattedProducts,
      stats,
      currency,
    });
  } catch (error) {
    console.error("Error fetching products:", error);
    return NextResponse.json(
      { error: "Failed to fetch products" },
      { status: 500 },
    );
  }
}

export async function GET(req: NextRequest) {
  return withRateLimit(req, "read", handleGET);
}
