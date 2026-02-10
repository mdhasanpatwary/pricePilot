import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { withRateLimit } from "@/lib/middleware/ratelimit";
import { z } from "zod";
import {
  validateBody,
  validateParams,
  validationErrorResponse,
  manualMatchSchema,
  uuidSchema,
} from "@/lib/validation";
import { CacheInvalidationService } from "@/lib/services/cache-invalidation";

async function handlePOST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    // Validate Params
    const rawParams = await params;
    const paramValidation = validateParams(
      rawParams,
      z.object({ id: uuidSchema }),
    );
    if (!paramValidation.success) {
      return validationErrorResponse(paramValidation);
    }
    const { id: productId } = paramValidation.data!;

    // Validate Body
    const validation = await validateBody(req, manualMatchSchema);
    if (!validation.success) {
      return validationErrorResponse(validation);
    }
    const { url } = validation.data!;

    const origin = new URL(url).origin;

    // 1. Ensure competitor site exists
    let site = await prisma.site.findFirst({
      where: {
        tenantId: session.user.tenantId,
        baseUrl: origin,
        type: "COMPETITOR",
      },
    });

    if (!site) {
      site = await prisma.site.create({
        data: {
          tenantId: session.user.tenantId,
          baseUrl: origin,
          type: "COMPETITOR",
          platform: "GENERIC",
        },
      });
    }

    // 2. Create/Update Competitor Product
    const existingCompProduct = await prisma.product.findFirst({
      where: { siteId: site.id, url },
    });

    let compProduct;
    if (existingCompProduct) {
      compProduct = existingCompProduct;
    } else {
      compProduct = await prisma.product.create({
        data: {
          tenantId: session.user.tenantId,
          siteId: site.id,
          url,
          title: "Discovered Product",
          currentPrice: 0,
          currency: "USD",
        },
      });
    }

    // 3. Create/Update Match
    const existingMatch = await prisma.productMatch.findFirst({
      where: { userProductId: productId, competitorProductId: compProduct.id },
    });

    if (!existingMatch) {
      await prisma.productMatch.create({
        data: {
          userProductId: productId,
          competitorProductId: compProduct.id,
          matchType: "MANUAL",
          confidenceScore: 1.0,
        },
      });
    } else {
      await prisma.productMatch.update({
        where: { id: existingMatch.id },
        data: {
          matchType: "MANUAL",
          confidenceScore: 1.0,
        },
      });
    }

    // Invalidate cache after match update
    // Requirement 2.3: Match update invalidation
    try {
      const cacheInvalidation = new CacheInvalidationService();
      await cacheInvalidation.onMatchUpdate(session.user.tenantId, productId);
    } catch (cacheError) {
      // Log cache invalidation error but don't fail the operation
      console.error('[MatchRoute] Cache invalidation failed:', cacheError);
    }

    // 4. Trigger immediate sync to get price/details
    try {
      const { SyncOrchestrator } =
        await import("@/lib/services/sync-orchestrator");
      await SyncOrchestrator.syncProduct(compProduct.id);
    } catch (e) {
      console.warn(
        "Immediate sync failed for manual link, will be retried in next site sync:",
        e,
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Manual matching error:", error);
    return NextResponse.json(
      { error: "Invalid URL or matching failed" },
      { status: 400 },
    );
  }
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  return withRateLimit(req, "write", (r) => handlePOST(r, context));
}
