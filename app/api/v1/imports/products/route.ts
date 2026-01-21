import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { withRateLimit } from "@/lib/middleware/ratelimit";
import { recordAuditLog, getIpAddress } from "@/lib/audit";

async function handleImport(req: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tenantId = session.user.tenantId;

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const text = await file.text();
    const lines = text.split(/\r?\n/);

    if (lines.length < 2) {
      return NextResponse.json(
        { error: "Empty or invalid CSV" },
        { status: 400 },
      );
    }

    const headers = lines[0].split(",");
    const skuIdx = headers.findIndex((h) => h.toLowerCase().includes("sku"));
    const priceIdx = headers.findIndex((h) =>
      h.toLowerCase().includes("price"),
    );
    const titleIdx = headers.findIndex((h) =>
      h.toLowerCase().includes("title"),
    );

    if (skuIdx === -1 || priceIdx === -1) {
      return NextResponse.json(
        { error: "CSV must contain SKU and Price columns" },
        { status: 400 },
      );
    }

    let updatedCount = 0;
    let createdCount = 0;

    // Get the first USER site for this tenant to associate new products
    const userSite = await prisma.site.findFirst({
      where: { tenantId, type: "USER" },
    });

    if (!userSite) {
      return NextResponse.json(
        { error: "No user store found. Please connect a store first." },
        { status: 400 },
      );
    }

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      // Simple CSV split (not handling escaped commas yet)
      const values = line.split(",");
      const sku = values[skuIdx]?.trim();
      const price = parseFloat(values[priceIdx]?.trim());
      const title =
        titleIdx !== -1
          ? values[titleIdx]?.trim()?.replace(/^"(.*)"$/, "$1")
          : null;

      if (!sku || isNaN(price)) continue;

      const product = await prisma.product.upsert({
        where: {
          // This assumes SKU is unique per tenant for USER products.
          // In a real app we might use a composite key or filter by siteId.
          id:
            (
              await prisma.product.findFirst({
                where: { tenantId, sku, site: { type: "USER" } },
              })
            )?.id || "temp-id-for-creation",
        },
        update: {
          currentPrice: price,
          title: title || undefined,
        },
        create: {
          tenantId,
          siteId: userSite.id,
          sku,
          title: title || sku,
          currentPrice: price,
          currency: "USD",
        },
      });

      if (product.createdAt.getTime() === product.updatedAt.getTime()) {
        createdCount++;
      } else {
        updatedCount++;
      }
    }

    await recordAuditLog({
      tenantId,
      userId: session.user.id,
      userEmail: session.user.email!,
      action: "IMPORT_PRODUCTS",
      entityId: "SYSTEM",
      ipAddress: getIpAddress(req),
      details: { created: createdCount, updated: updatedCount },
    });

    return NextResponse.json({
      success: true,
      updated: updatedCount,
      created: createdCount,
    });
  } catch (error) {
    console.error("Import error:", error);
    return NextResponse.json(
      { error: "Failed to process CSV file" },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  return withRateLimit(req, "importExport", handleImport);
}
