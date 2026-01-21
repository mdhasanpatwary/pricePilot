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

    // Create snapshot for rollback
    const snapshot = await (prisma.bulkOperationSnapshot as any).create({
      data: {
        tenantId,
        operation: "BULK_UPDATE",
        productCount: products.length,
        snapshot: JSON.stringify(products),
        changes: JSON.stringify(updates),
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

    await prisma.product.updateMany({
      where: {
        id: { in: productIds },
        tenantId,
      },
      data: updateData,
    });

    // Create price history entries if price changed
    if (updates.currentPrice !== undefined) {
      await prisma.priceHistory.createMany({
        data: productIds.map((productId) => ({
          productId,
          price: updates.currentPrice!,
        })),
      });
    }

    return NextResponse.json({
      success: true,
      updated: products.length,
      snapshotId: snapshot.id,
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

export async function POST(req: NextRequest) {
  return withRateLimit(req, "api", handlePOST);
}
