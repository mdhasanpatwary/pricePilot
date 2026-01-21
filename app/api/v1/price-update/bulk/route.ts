import { NextRequest, NextResponse } from "next/server";
import { UpdateExecutionService } from "@/lib/services/execution";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { withRateLimit } from "@/lib/middleware/ratelimit";
import {
  validateBody,
  validationErrorResponse,
  bulkPriceUpdateExecutionSchema,
} from "@/lib/validation";
import { recordAuditLog, getIpAddress } from "@/lib/audit";

async function handlePOST(req: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const validation = await validateBody(req, bulkPriceUpdateExecutionSchema);

    if (!validation.success) {
      return validationErrorResponse(validation);
    }

    const { product_ids, logic_type, value, min_price } = validation.data!;

    const result = await UpdateExecutionService.executeBulkUpdate(
      product_ids,
      logic_type,
      value,
      min_price,
    );

    await recordAuditLog({
      tenantId: session.user.tenantId,
      userId: session.user.id,
      userEmail: session.user.email!,
      action: "BULK_PRICE_UPDATE",
      entityId: "SYSTEM",
      ipAddress: getIpAddress(req),
      details: {
        productCount: product_ids.length,
        logicType: logic_type,
        value,
        minPrice: min_price,
      },
    });

    return NextResponse.json({
      message: "Price updates completed",
      ...result,
    });
  } catch (error) {
    const err = error as Error;
    console.error("Execution error:", err);
    return NextResponse.json(
      {
        error: "Failed to execute price updates",
        details: err.message,
      },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  return withRateLimit(req, "write", handlePOST);
}
