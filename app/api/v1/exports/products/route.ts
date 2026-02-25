import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { recordAuditLog, getIpAddress } from "@/lib/audit";
import { getCachedSession } from "@/lib/auth/cached-session";
import { withRequestContextAndRateLimit } from "@/lib/middleware/with-request-context";

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

async function handleGET(_req: NextRequest) {
  const session = await getCachedSession();

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tenantId = session.user.tenantId;

  try {
    const totalCount = await prisma.product.count({
      where: {
        tenantId,
        Site: { type: "USER" },
      },
    });

    await recordAuditLog({
      tenantId,
      userId: session.user.id,
      userEmail: session.user.email!,
      action: "EXPORT_PRODUCTS_BULK",
      entityId: "SYSTEM",
      ipAddress: getIpAddress(_req),
      details: { count: totalCount },
    });

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

    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        controller.enqueue(encoder.encode(headers.join(",") + "\n"));

        let skip = 0;
        const take = 1000;
        let hasMore = true;

        while (hasMore) {
          try {
            const batch = await prisma.product.findMany({
              where: {
                tenantId,
                Site: { type: "USER" },
              },
              orderBy: { id: "asc" },
              take,
              skip,
              include: {
                matchesAsUser: {
                  include: {
                    competitorProduct: {
                      include: { Site: true },
                    },
                  },
                },
              },
            });

            if (batch.length === 0) break;
            hasMore = batch.length === take;
            skip += take;

            const rows = batch.map((p) => {
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
                formatCSVValue(bestMatch?.competitorProduct.Site?.baseUrl),
                gap
              ].join(",");
            });

            if (rows.length > 0) {
              controller.enqueue(encoder.encode(rows.join("\n") + "\n"));
            }
          } catch (batchError) {
            console.error("Export batch error:", batchError);
            controller.error(batchError);
            break;
          }
        }
        controller.close();
      }
    });

    return new NextResponse(stream, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="PricePilot-Tech-Catalog-${new Date().toISOString().split("T")[0]}.csv"`,
        "Transfer-Encoding": "chunked"
      },
    });
  } catch (error) {
    console.error("Export initiation error:", error);
    return NextResponse.json(
      { error: "Failed to generate bulk export" },
      { status: 500 },
    );
  }
}

export async function GET(req: NextRequest) {
  return withRequestContextAndRateLimit(req, "importExport", handleGET);
}
