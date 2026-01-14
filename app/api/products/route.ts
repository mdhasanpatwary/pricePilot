import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]/route";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tenantId = (session.user as any).tenantId;

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

    // Map to the format expected by the frontend
    const formattedProducts = products.map((product) => {
      const bestMatch = product.matchesAsUser[0];
      const compPrice = bestMatch ? parseFloat(bestMatch.competitorProduct.currentPrice.toString()) : parseFloat(product.currentPrice.toString());
      const yourPrice = parseFloat(product.currentPrice.toString());
      const diff = yourPrice - compPrice;

      let status = "NEUTRAL";
      if (diff > 0) status = "RED"; // More expensive
      if (diff < 0) status = "GREEN"; // Cheaper

      return {
        id: product.id,
        sku: product.sku || "N/A",
        title: product.title,
        yourPrice,
        compPrice,
        diff: -diff, // Frontend expects positive for "gain" (cheaper than rival) or negative for "loss"
        status,
        match: bestMatch?.competitorProduct.site?.baseUrl || "Market",
        stock: 10, // Mocking stock for now
      };
    });

    return NextResponse.json(formattedProducts);
  } catch (error) {
    console.error("Error fetching products:", error);
    return NextResponse.json({ error: "Failed to fetch products" }, { status: 500 });
  }
}
