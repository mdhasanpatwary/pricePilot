import { NextRequest, NextResponse } from "next/server";
import { UpdateExecutionService } from "@/lib/services/execution";
import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/[...nextauth]/route";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { product_ids, logic_type, value, min_price } = await req.json();

    if (!product_ids || !Array.isArray(product_ids)) {
      return NextResponse.json({ error: "Product IDs array is required" }, { status: 400 });
    }

    const result = await UpdateExecutionService.executeBulkUpdate(
      product_ids,
      logic_type,
      value,
      min_price
    );

    return NextResponse.json({
      message: "Price updates completed",
      ...result
    });
  } catch (error: any) {
    console.error("Execution error:", error);
    return NextResponse.json({
      error: "Failed to execute price updates",
      details: error.message
    }, { status: 500 });
  }
}
