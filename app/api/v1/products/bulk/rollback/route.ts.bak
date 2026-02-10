import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { withRateLimit } from "@/lib/middleware/ratelimit";

async function handlePOST(req: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { snapshotId } = await req.json();
    const tenantId = session.user.tenantId;

    // Find the snapshot
    const snapshot = await (prisma.bulkOperationSnapshot as any).findFirst({
      where: {
        id: snapshotId,
        tenantId,
      },
    });

    if (!snapshot) {
      return NextResponse.json(
        { error: "Snapshot not found" },
        { status: 404 },
      );
    }

    // Parse the original data
    const originalProducts = JSON.parse(snapshot.snapshot as string);

    // Rollback each product
    let rolledBack = 0;
    for (const product of originalProducts) {
      await prisma.product.update({
        where: { id: product.id },
        data: {
          currentPrice: product.currentPrice,
          inStock: product.inStock,
        },
      });

      // Invalidate cache for rolled back product
      // Requirement 2.9.4: Cache invalidation on data updates
      try {
        const { cacheEnhancedService } = await import("@/lib/services/cache-enhanced");
        await cacheEnhancedService.invalidateProduct(tenantId, product.id);
      } catch (cacheError) {
        // Log but don't fail the rollback
      }

      // Create price history entry
      await prisma.priceHistory.create({
        data: {
          productId: product.id,
          price: product.currentPrice,
        },
      });

      rolledBack++;
    }

    // Invalidate comparisons cache after all products are rolled back
    try {
      const { cacheEnhancedService } = await import("@/lib/services/cache-enhanced");
      await cacheEnhancedService.invalidateComparisons(tenantId);
    } catch (cacheError) {
      // Log but don't fail the rollback
    }

    // Mark snapshot as rolled back
    await (prisma.bulkOperationSnapshot as any).update({
      where: { id: snapshotId },
      data: { rolledBack: true },
    });

    return NextResponse.json({
      success: true,
      rolledBack,
      message: `Successfully rolled back ${rolledBack} products`,
    });
  } catch (error) {
    console.error("Rollback error:", error);
    return NextResponse.json(
      { error: "Failed to rollback changes" },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  return withRateLimit(req, "api", handlePOST);
}
