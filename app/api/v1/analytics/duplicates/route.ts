import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withRequestContextAndRateLimit } from "@/lib/middleware/with-request-context";
import { getCachedSession } from "@/lib/auth/cached-session";
import { compareTwoStrings } from "string-similarity";
import {
  validateBody,
  validationErrorResponse,
  mergeDuplicatesSchema,
} from "@/lib/validation";

/**
 * GET /api/v1/analytics/duplicates
 * Identifies potential duplicate products across sites (or within the same site) 
 * based on high title similarity, SKU, or Brand/Model combo.
 */
async function handleGET(_req: NextRequest) {
  const session = await getCachedSession();

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
    // 1. Fetch all products for the tenant
    const products = await prisma.product.findMany({
      where: { tenantId },
      include: { Site: true },
    });

    const potentialDuplicates: any[] = [];
    const processedIds = new Set<string>();

    // 2. Simple Quadratic Similarity Check (Optimized for small/medium catalogs)
    // For very large catalogs, we would use LSH or similar.
    for (let i = 0; i < products.length; i++) {
      const p1 = products[i];
      if (processedIds.has(p1.id)) continue;

      const matches = [];
      for (let j = i + 1; j < products.length; j++) {
        const p2 = products[j];
        if (processedIds.has(p2.id)) continue;

        let score = 0;
        let reason = "";

        // Strategy A: SKU Match
        if (p1.sku && p2.sku && p1.sku.toLowerCase() === p2.sku.toLowerCase()) {
          score = 1.0;
          reason = "Exact SKU Match";
        }
        // Strategy B: Brand/Model Match
        else if (p1.brand && p1.model && p1.brand === p2.brand && p1.model === p2.model) {
          score = 0.95;
          reason = "Brand & Model Match";
        }
        // Strategy C: High Title Similarity
        else {
          const similarity = compareTwoStrings(p1.title.toLowerCase(), p2.title.toLowerCase());
          if (similarity > 0.85) {
            score = Number(similarity.toFixed(2));
            reason = "High Title Similarity";
          }
        }

        if (score > 0) {
          matches.push({ ...p2, score, reason });
        }
      }

      if (matches.length > 0) {
        potentialDuplicates.push({
          anchor: p1,
          duplicates: matches
        });
        // Mark as processed to avoid redundant groups
        matches.forEach(m => processedIds.add(m.id));
      }
    }

    return NextResponse.json({
      totalGroups: potentialDuplicates.length,
      groups: potentialDuplicates
    });
  } catch (error) {
    console.error("Error detecting duplicates:", error);
    return NextResponse.json(
      { error: "Failed to perform duplicate detection" },
      { status: 500 },
    );
  }
}

export async function GET(req: NextRequest) {
  return withRequestContextAndRateLimit(req, "read", handleGET);
}

/**
 * POST /api/v1/analytics/duplicates
 * Executes a merge operation.
 * anchorId: The ID of the product to KEEP.
 * duplicateIds: Array of product IDs to REMOVE and move their data to anchor.
 */
async function handlePOST(req: NextRequest) {
  const session = await getCachedSession();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    // Validate input
    const validation = await validateBody(req, mergeDuplicatesSchema);
    if (!validation.success) {
      return validationErrorResponse(validation);
    }

    const { anchorId, duplicateIds } = validation.data!;

    // Process in a transaction to ensure data integrity
    await prisma.$transaction(async (tx) => {
      for (const dupId of duplicateIds) {
        // 1. Move Matches (Unified Tracking)
        await tx.productMatch.updateMany({
          where: { userProductId: dupId },
          data: { userProductId: anchorId }
        });

        await tx.productMatch.updateMany({
          where: { competitorProductId: dupId },
          data: { competitorProductId: anchorId }
        });

        // 2. Move Price History
        await tx.priceHistory.updateMany({
          where: { productId: dupId },
          data: { productId: anchorId }
        });

        // 3. Delete Redundant Product
        await tx.product.delete({
          where: { id: dupId }
        });
      }
    });

    return NextResponse.json({ success: true, message: `${duplicateIds.length} items merged into master entry.` });
  } catch (error) {
    console.error("Merge error:", error);
    return NextResponse.json({ error: "Merge operation failed" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  return withRequestContextAndRateLimit(req, "write", handlePOST);
}
