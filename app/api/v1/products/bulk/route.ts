import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { withRateLimit } from "@/lib/middleware/ratelimit";
import { z } from "zod";

const bulkUpdateSchema = z.object({
  productIds: z.array(z.string()).min(1, "At least one product required"),
  updates: z.object({
    currentPrice: z.number().positive().optional(),
    inStock: z.boolean().optional(),
  }),
  preview: z.boolean().optional(),
});

async function handlePOST(req: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const validation = bulkUpdateSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: "Invalid request", details: validation.error.flatten() },
        { status: 400 },
      );
    }

    const { productIds, updates, preview } = validation.data;
    const tenantId = session.user.tenantId;
    const idempotencyKey = req.headers.get("x-idempotency-key");

    // 0. Idempotency Check
    if (idempotencyKey && !preview) {
      const existingOp = await (prisma.bulkOperationSnapshot as any).findFirst({
        where: { tenantId, idempotencyKey },
      });

      if (existingOp) {
        return NextResponse.json({
          success: true,
          updated: existingOp.productCount,
          snapshotId: existingOp.id,
          message: `Operation with key ${idempotencyKey} already completed.`,
          isDuplicate: true,
        });
      }
    }

    // Verify all products belong to this tenant
    const products = await prisma.product.findMany({
      where: {
        id: { in: productIds },
        tenantId,
      },
      select: {
        id: true,
        title: true,
        sku: true,
        currentPrice: true,
        inStock: true,
      },
    });

    if (products.length !== productIds.length) {
      return NextResponse.json(
        { error: "Some products not found or unauthorized" },
        { status: 404 },
      );
    }

    // Preview mode: return what would change
    if (preview) {
      const changes = products.map((product) => ({
        id: product.id,
        title: product.title,
        sku: product.sku,
        before: {
          currentPrice: product.currentPrice,
          inStock: product.inStock,
        },
        after: {
          currentPrice: updates.currentPrice ?? product.currentPrice,
          inStock: updates.inStock ?? product.inStock,
        },
      }));

      return NextResponse.json({
        preview: true,
        changes,
        count: changes.length,
      });
    }

    // 1. Transactional Update
    const result = await prisma.$transaction(async (tx) => {
      // Create snapshot for rollback
      const snapshot = await (tx.bulkOperationSnapshot as any).create({
        data: {
          tenantId,
          operation: "BULK_UPDATE",
          productCount: products.length,
          snapshot: JSON.stringify(products),
          changes: JSON.stringify(updates),
          idempotencyKey,
        },
      });

      // Perform bulk update
      const updateData: any = {};
      if (updates.currentPrice !== undefined) {
        updateData.currentPrice = updates.currentPrice;
      }
      if (updates.inStock !== undefined) {
        updateData.inStock = updates.inStock;
      }

      await tx.product.updateMany({
        where: {
          id: { in: productIds },
          tenantId,
        },
        data: updateData,
      });

      // Create price history entries if price changed
      if (updates.currentPrice !== undefined) {
        await tx.priceHistory.createMany({
          data: productIds.map((productId) => ({
            productId,
            price: updates.currentPrice!,
          })),
        });
      }

      return snapshot;
    });

    // Invalidate product list cache for this tenant
    const { invalidateCache } = await import("@/lib/middleware/api-cache");
    await invalidateCache(`api:products:*:${tenantId}:*`).catch(err =>
      console.error("Cache invalidation error:", err)
    );

    return NextResponse.json({
      success: true,
      updated: products.length,
      snapshotId: result.id,
      message: `Successfully updated ${products.length} products`,
    });
  } catch (error) {
    console.error("Bulk update error:", error);
    return NextResponse.json(
      { error: "Failed to perform bulk update" },
      { status: 500 },
    );
  }
}

async function handleDELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tenantId = session.user.tenantId;
  let productIds: string[] = [];

  try {
    const { searchParams } = new URL(req.url);
    const idsString = searchParams.get("ids");

    if (idsString) {
      productIds = idsString.split(",").map(id => id.trim()).filter(id => id.length > 0);
    } else {
      const body = await req.json().catch(() => ({}));
      productIds = (body.productIds || []).map((id: string) => id.trim()).filter((id: string) => id.length > 0);
    }

    if (!productIds || productIds.length === 0) {
      return NextResponse.json(
        { error: "At least one product ID is required" },
        { status: 400 },
      );
    }

    // Verify all products belong to this tenant and delete them
    const result = await prisma.$transaction(async (tx) => {
      // Find valid products first
      const validProducts = await tx.product.findMany({
        where: {
          id: { in: productIds },
          tenantId,
        },
        select: { id: true },
      });

      if (validProducts.length === 0) {
        // Debug: Check if they exist under ANY tenant
        const existingAnywhere = await tx.product.findMany({
          where: { id: { in: productIds } },
          select: { id: true, tenantId: true },
          take: 5
        });

        const debugInfo = existingAnywhere.length > 0
          ? `Found ${existingAnywhere.length} products but under different tenants (e.g., ${existingAnywhere[0].tenantId})`
          : "Products not found in database at all";

        throw new Error(`No valid products found for deletion. ${debugInfo}. Count: ${productIds.length}, Requested Tenant: ${tenantId}`);
      }

      const validIds = validProducts.map(p => p.id);

      // Perform bulk delete
      const deleteResult = await tx.product.deleteMany({
        where: {
          id: { in: validIds },
          tenantId,
        },
      });

      return deleteResult;
    });

    // Invalidate product list cache for this tenant
    const { invalidateCache } = await import("@/lib/middleware/api-cache");
    await invalidateCache(`api:products:*:${tenantId}:*`).catch(err =>
      console.error("Cache invalidation error:", err)
    );

    return NextResponse.json({
      success: true,
      deletedCount: result.count,
      message: `Successfully deleted ${result.count} products`,
    });
  } catch (error: any) {
    console.error("Bulk delete error:", error);
    return NextResponse.json(
      {
        error: error.message || "Failed to perform bulk delete",
        details: {
          message: error.message,
          productIds: productIds,
          tenantId: tenantId,
        }
      },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  return withRateLimit(req, "api", handlePOST);
}

export async function DELETE(req: NextRequest) {
  return withRateLimit(req, "write", handleDELETE);
}
