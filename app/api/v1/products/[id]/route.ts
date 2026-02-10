import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { getCachedSession } from "@/lib/auth/cached-session";
import { withRequestContextAndRateLimit } from "@/lib/middleware/with-request-context";
import {
  validateParams,
  validationErrorResponse,
  uuidSchema,
} from "@/lib/validation";

async function handleDELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getCachedSession();
  if (!session?.user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rawParams = await params;
  const paramValidation = validateParams(
    rawParams,
    z.object({ id: uuidSchema }),
  );

  if (!paramValidation.success) {
    return validationErrorResponse(paramValidation);
  }

  const { id } = paramValidation.data!;
  const tenantId = session.user.tenantId;

  try {
    // Check if the product belongs to the tenant
    const product = await prisma.product.findFirst({
      where: {
        id,
        tenantId,
      },
    });

    if (!product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    // Delete the product - foreign keys with Cascade should handle matches, price history, logs, etc.
    await prisma.product.delete({
      where: { id },
    });

    // Invalidate product list cache for this tenant
    const { invalidateCache } = await import("@/lib/middleware/api-cache");
    await invalidateCache(`api:products:*:${tenantId}:*`).catch(err =>
      console.error("Cache invalidation error:", err)
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete product error:", error);
    return NextResponse.json(
      { error: "Failed to delete product" },
      { status: 500 },
    );
  }
}

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  return withRequestContextAndRateLimit(req, "write", (r) => handleDELETE(r, context));
}
