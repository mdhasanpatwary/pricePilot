import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";

export async function GET(_req: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tenantId = session.user.tenantId;

  try {
    const products = await prisma.product.findMany({
      where: {
        tenantId,
        site: { type: "USER" },
      },
      include: {
        matchesAsUser: {
          include: {
            competitorProduct: {
              include: { site: true },
            },
          },
        },
      },
    });

    // Prepare CSV header
    const headers = [
      "ID",
      "SKU",
      "Title",
      "Current Price",
      "Currency",
      "Brand",
      "Model",
      "In Stock",
      "Stock Level",
      "Competitor Price",
      "Competitor Site",
      "Last Updated",
    ];

    interface ProductWithStock {
      id: string;
      sku: string | null;
      title: string;
      currentPrice: any;
      currency: string;
      brand: string | null;
      model: string | null;
      inStock: boolean;
      stockLevel: number | null;
      matchesAsUser: any[];
      updatedAt: Date;
    }

    const rows = (products as unknown as ProductWithStock[]).map((p) => {
      const bestMatch = p.matchesAsUser[0];
      return [
        p.id,
        p.sku || "",
        `"${p.title.replace(/"/g, '""')}"`,
        p.currentPrice,
        p.currency,
        p.brand || "",
        p.model || "",
        p.inStock ? "Yes" : "No",
        p.stockLevel ?? "",
        bestMatch?.competitorProduct.currentPrice ?? "",
        bestMatch?.competitorProduct.site?.baseUrl ?? "",
        p.updatedAt.toISOString(),
      ];
    });

    const csvContent = [
      headers.join(","),
      ...rows.map((row) => row.join(",")),
    ].join("\n");

    return new NextResponse(csvContent, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="pricepilot-products-${new Date().toISOString().split("T")[0]}.csv"`,
      },
    });
  } catch (error) {
    console.error("Export error:", error);
    return NextResponse.json(
      { error: "Failed to export products" },
      { status: 500 },
    );
  }
}
