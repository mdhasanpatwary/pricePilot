import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { withRateLimit } from "@/lib/middleware/ratelimit";
import { recordAuditLog, getIpAddress } from "@/lib/audit";

/**
 * Enhanced CSV Parser that handles quotes and escapes
 */
function parseCSVLine(line: string): string[] {
  const result = [];
  let current = "";
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

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
    const lines = text.split(/\r?\n/).filter(line => line.trim());

    if (lines.length < 2) {
      return NextResponse.json(
        { error: "Empty or invalid CSV (Header + at least one data row required)" },
        { status: 400 },
      );
    }

    const headers = parseCSVLine(lines[0]).map(h => h.toLowerCase());
    
    // Core Columns
    const skuIdx = headers.findIndex(h => h.includes("sku"));
    const priceIdx = headers.findIndex(h => h.includes("price"));
    const titleIdx = headers.findIndex(h => h.includes("title"));
    
    // Tech Meta Columns
    const brandIdx = headers.findIndex(h => h.includes("brand"));
    const modelIdx = headers.findIndex(h => h.includes("model"));
    const categoryIdx = headers.findIndex(h => h.includes("category"));
    const ramIdx = headers.findIndex(h => h.includes("ram"));
    const storageIdx = headers.findIndex(h => h.includes("storage") || h.includes("ssd") || h.includes("hdd"));

    if (skuIdx === -1 || priceIdx === -1) {
      return NextResponse.json(
        { error: "CSV must contain at least 'SKU' and 'Price' columns. Recommended: 'Title', 'Brand', 'RAM', 'Storage'" },
        { status: 400 },
      );
    }

    const userSite = await prisma.site.findFirst({
      where: { tenantId, type: "USER" },
    });

    if (!userSite) {
      return NextResponse.json(
        { error: "No user store found. Please connect a store first." },
        { status: 400 },
      );
    }

    let updatedCount = 0;
    let createdCount = 0;
    const errors: string[] = [];

    for (let i = 1; i < lines.length; i++) {
        try {
            const values = parseCSVLine(lines[i]);
            const sku = values[skuIdx];
            const priceVal = values[priceIdx];
            const price = parseFloat(priceVal.replace(/[^0-9.]/g, ''));
            
            if (!sku || isNaN(price)) {
                errors.push(`Row ${i+1}: Invalid SKU or Price`);
                continue;
            }

            const title = titleIdx !== -1 ? values[titleIdx] : sku;
            const brand = brandIdx !== -1 ? values[brandIdx] : null;
            const model = modelIdx !== -1 ? values[modelIdx] : null;
            const category = categoryIdx !== -1 ? values[categoryIdx] : null;
            
            // Build specs JSON
            const specs: Record<string, string> = {};
            if (ramIdx !== -1 && values[ramIdx]) specs.ram = values[ramIdx];
            if (storageIdx !== -1 && values[storageIdx]) specs.storage = values[storageIdx];

            const existingProduct = await prisma.product.findFirst({
                where: { tenantId, sku, site: { type: "USER" } },
                select: { id: true }
            });

            if (existingProduct) {
                await prisma.product.update({
                    where: { id: existingProduct.id },
                    data: {
                        currentPrice: price,
                        title: title || undefined,
                        brand: brand || undefined,
                        model: model || undefined,
                        category: category || undefined,
                        specifications: Object.keys(specs).length > 0 ? specs : undefined
                    }
                });
                updatedCount++;
            } else {
                await prisma.product.create({
                    data: {
                        tenantId,
                        siteId: userSite.id,
                        sku,
                        title: title || sku,
                        currentPrice: price,
                        brand: brand || null,
                        model: model || null,
                        category: category || "Uncategorized",
                        specifications: specs,
                        currency: userSite.currency || "USD"
                    }
                });
                createdCount++;
            }
        } catch (e) {
            errors.push(`Row ${i+1}: Critical Processing Error`);
        }
    }

    await recordAuditLog({
      tenantId,
      userId: session.user.id,
      userEmail: session.user.email!,
      action: "IMPORT_PRODUCTS_BULK",
      entityId: "SYSTEM",
      ipAddress: getIpAddress(req),
      details: { created: createdCount, updated: updatedCount, errors: errors.length },
    });

    return NextResponse.json({
      success: true,
      updated: updatedCount,
      created: createdCount,
      errorCount: errors.length,
      errors: errors.slice(0, 10) // Only send first 10 for UI brevity
    });
  } catch (error) {
    console.error("Import error:", error);
    return NextResponse.json(
      { error: "Failed to process bulk import file" },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  return withRateLimit(req, "importExport", handleImport);
}
