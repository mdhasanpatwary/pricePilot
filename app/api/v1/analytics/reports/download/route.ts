import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { withRateLimit } from "@/lib/middleware/ratelimit";

/**
 * GET /api/v1/analytics/reports/download
 * Generates and downloads a CSV report of the tenant's market position.
 */
async function handleGET(_req: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tenantId = session.user.tenantId;

  try {
    // 1. Fetch all user products with their matches
    const products = await prisma.product.findMany({
      where: {
        tenantId,
        Site: { type: "USER" },
      },
      include: {
        matchesAsUser: {
          include: {
            competitorProduct: {
              include: {
                Site: true,
              },
            },
          },
        },
      },
    });

    // 2. Generate CSV Content
    const headers = [
      "SKU",
      "Product Title",
      "Category",
      "My Price",
      "Currency",
      "Stock Status",
      "Competitor Count",
      "Cheapest Competitor Price",
      "Market Position",
      "Price Difference %",
    ];

    const rows = products.map((product) => {
      const userPrice = parseFloat(product.currentPrice.toString());
      const matches = product.matchesAsUser || [];

      let cheapestCompPrice = Infinity;
      matches.forEach((m) => {
        const p = parseFloat(m.competitorProduct.currentPrice.toString());
        if (p < cheapestCompPrice) cheapestCompPrice = p;
      });

      const hasCompetition = cheapestCompPrice !== Infinity;
      const diff = hasCompetition ? cheapestCompPrice - userPrice : 0;
      const diffPercent = hasCompetition
        ? ((diff / userPrice) * 100).toFixed(2)
        : "N/A";

      let position = "N/A";
      if (hasCompetition) {
        if (userPrice < cheapestCompPrice * 0.95) position = "CHEAPEST";
        else if (userPrice > cheapestCompPrice * 1.05) position = "EXPENSIVE";
        else position = "NEUTRAL";
      }

      return [
        `"${product.sku || ""}"`,
        `"${product.title.replace(/"/g, '""')}"`,
        `"${product.category || ""}"`,
        userPrice,
        product.currency,
        product.inStock ? "IN_STOCK" : "OUT_OF_STOCK",
        matches.length,
        hasCompetition ? cheapestCompPrice : "N/A",
        position,
        diffPercent === "N/A" ? "N/A" : `${diffPercent}%`,
      ];
    });

    const csvContent = [
      headers.join(","),
      ...rows.map((row) => row.join(",")),
    ].join("\n");

    // 3. Return as a downloadable file
    const date = new Date().toISOString().split("T")[0];
    const filename = `pricepilot-report-${date}.csv`;

    return new NextResponse(csvContent, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename=${filename}`,
      },
    });
  } catch (error) {
    console.error("Error generating report:", error);
    return NextResponse.json(
      { error: "Failed to generate report" },
      { status: 500 },
    );
  }
}

export async function GET(req: NextRequest) {
  return withRateLimit(req, "read", handleGET);
}
