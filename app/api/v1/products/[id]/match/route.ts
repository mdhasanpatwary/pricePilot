import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import {
  validateBody,
  validateParams,
  validationErrorResponse,
  manualMatchSchema,
  uuidSchema,
} from "@/lib/validation";
import { CacheInvalidationService } from "@/lib/services/cache-invalidation";
import { getCachedSession } from "@/lib/auth/cached-session";
import { withRequestContextAndRateLimit } from "@/lib/middleware/with-request-context";
import { withDbRetry } from "@/lib/utils/db-retry";

async function handlePOST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getCachedSession();
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
    let site = await withDbRetry(() => prisma.site.findFirst({
      where: {
        tenantId: session.user.tenantId,
        baseUrl: origin,
        type: "COMPETITOR",
      },
    }), { operationName: 'FindCompetitorSite' });

    if (!site) {
      site = await withDbRetry(() => prisma.site.create({
        data: {
          tenantId: session.user.tenantId,
          baseUrl: origin,
          type: "COMPETITOR",
          platform: "GENERIC",
        },
      }), { operationName: 'CreateCompetitorSite' });
    }

    // 2. Create/Update Competitor Product
    const existingCompProduct = await withDbRetry(() => prisma.product.findFirst({
      where: { siteId: site!.id, url },
    }), { operationName: 'FindCompetitorProduct' });

    let compProduct;
    if (existingCompProduct) {
      compProduct = existingCompProduct;
    } else {
      compProduct = await withDbRetry(() => prisma.product.create({
        data: {
          tenantId: session.user.tenantId,
          siteId: site!.id,
          url,
          title: "Discovered Product",
          currentPrice: 0,
          currency: "USD",
        },
      }), { operationName: 'CreateCompetitorProduct' });
    }

    // 3. Create/Update Match
    const existingMatch = await withDbRetry(() => prisma.productMatch.findFirst({
      where: { userProductId: productId, competitorProductId: compProduct.id },
    }), { operationName: 'FindProductMatch' });

    if (!existingMatch) {
      await withDbRetry(() => prisma.productMatch.create({
        data: {
          userProductId: productId,
          competitorProductId: compProduct.id,
          matchType: "MANUAL",
          confidenceScore: 1.0,
        },
      }), { operationName: 'CreateProductMatch' });
    } else {
      await withDbRetry(() => prisma.productMatch.update({
        where: { id: existingMatch.id },
        data: {
          matchType: "MANUAL",
          confidenceScore: 1.0,
        },
      }), { operationName: 'UpdateProductMatch' });
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

    // 4. Trigger immediate sync to get price/details - Async/Non-blocking
    try {
      const { SyncOrchestrator } = await import("@/lib/services/sync-orchestrator");
      SyncOrchestrator.dispatchProductSync(compProduct.id).catch(e =>
        console.error("Failed to queue manual link sync:", e)
      );
    } catch (e) {
      console.warn("Could not dispatch manual link sync:", e);
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
  return withRequestContextAndRateLimit(req, "write", (r) => handlePOST(r, context));
}
