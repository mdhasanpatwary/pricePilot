import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";
import { formatDistanceToNow } from "date-fns";

/**
 * GET /api/analytics/logs
 * Real execution logs from PriceUpdateLog table
 */
export async function GET(_req: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tenantId = session.user.tenantId;

  try {
    const logs = await prisma.priceUpdateLog.findMany({
      where: {
        product: {
          tenantId,
        },
      },
      include: {
        product: true,
      },
      orderBy: {
        executedAt: "desc",
      },
      take: 10,
    });

    const formattedLogs = logs.map((log) => ({
      name: log.product.title,
      sku: log.product.sku || "N/A",
      action: log.logicType === "FIXED" ? "Price Fix" : "Dynamic Adj",
      value: `${log.newPrice > log.oldPrice ? "+" : ""}$${(parseFloat(log.newPrice.toString()) - parseFloat(log.oldPrice.toString())).toFixed(2)}`,
      time: formatDistanceToNow(new Date(log.executedAt), {
        addSuffix: false,
      }).replace("about ", ""),
    }));

    return NextResponse.json(formattedLogs);
  } catch (error) {
    console.error("Error fetching execution logs:", error);
    return NextResponse.json(
      { error: "Failed to fetch logs" },
      { status: 500 },
    );
  }
}
