import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { recordAuditLog, getIpAddress } from "@/lib/audit";

/**
 * Robust CSV Value Formatter
 */
function formatCSVValue(val: any): string {
    if (val === null || val === undefined) return "";
    const str = String(val);
    if (str.includes(",") || str.includes('"') || str.includes("\n")) {
        return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
}

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

    // Prepare Tech-Ready CSV headers
    const headers = [
      "SKU",
      "Title",
      "Current Price",
      "Currency",
      "Category",
      "Brand",
      "Model",
      "RAM",
      "Storage",
      "In Stock",
      "Competitor Price",
      "Competitor Site",
      "Market Gap"
    ];

    const rows = products.map((p) => {
      const bestMatch = p.matchesAsUser[0];
      const specs = (p.specifications as any) || {};
      
      const userPrice = parseFloat(p.currentPrice.toString());
      const compPrice = bestMatch ? parseFloat(bestMatch.competitorProduct.currentPrice.toString()) : null;
      const gap = compPrice ? (compPrice - userPrice).toFixed(2) : "";

      return [
        formatCSVValue(p.sku),
        formatCSVValue(p.title),
        userPrice,
        p.currency,
        formatCSVValue(p.category),
        formatCSVValue(p.brand),
        formatCSVValue(p.model),
        formatCSVValue(specs.ram),
        formatCSVValue(specs.storage),
        p.inStock ? "Yes" : "No",
        compPrice || "",
        formatCSVValue(bestMatch?.competitorProduct.site?.baseUrl),
        gap
      ];
    });

    const csvContent = [
      headers.join(","),
      ...rows.map((row) => row.join(",")),
    ].join("\n");

    await recordAuditLog({
      tenantId,
      userId: session.user.id,
      userEmail: session.user.email!,
      action: "EXPORT_PRODUCTS_BULK",
      entityId: "SYSTEM",
      ipAddress: getIpAddress(_req),
      details: { count: products.length },
    });

    return new NextResponse(csvContent, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="PricePilot-Tech-Catalog-${new Date().toISOString().split("T")[0]}.csv"`,
      },
    });
  } catch (error) {
    console.error("Export error:", error);
    return NextResponse.json(
      { error: "Failed to generate bulk export" },
      { status: 500 },
    );
  }
}
