import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]/route";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tenantId = session.user.tenantId;

  try {
    const products = await prisma.product.findMany({
      where: {
        tenantId,
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
    };

    interface ProductWithStock {
      id: string;
      sku: string | null;
      title: string;
      currentPrice: any;
      inStock: boolean;
      stockLevel: number | null;
      matchesAsUser: any[];
      updatedAt: Date;
    }

    // Map to the format expected by the frontend
    const formattedProducts = (products as unknown as ProductWithStock[]).map((product) => {
      const bestMatch = product.matchesAsUser[0];
      const compPrice = bestMatch ? parseFloat(bestMatch.competitorProduct.currentPrice.toString()) : 0;
      const yourPrice = parseFloat(product.currentPrice.toString());

      let diff = 0;
      let status = "NEUTRAL";

      if (compPrice > 0) {
        diff = compPrice - yourPrice;
        if (yourPrice > compPrice) {
          status = "RED";
          stats.atRisk++;
        } else if (yourPrice < compPrice) {
          status = "GREEN";
          stats.optimal++;
        } else {
          status = "NEUTRAL";
          stats.parity++;
        }
      } else {
        stats.parity++;
      }

      return {
        id: product.id,
        sku: product.sku || "N/A",
        title: product.title,
        yourPrice,
        compPrice: compPrice || yourPrice,
        diff,
        status,
        match: bestMatch?.competitorProduct.site?.baseUrl || "Market",
        stock: product.inStock ? (product.stockLevel || 24) : 0,
        inStock: product.inStock,
      };
    });

    return NextResponse.json({
      products: formattedProducts,
      stats
    });
  } catch (error) {
    console.error("Error fetching products:", error);
    return NextResponse.json({ error: "Failed to fetch products" }, { status: 500 });
  }
}
