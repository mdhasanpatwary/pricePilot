import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { formatDistanceToNow } from "date-fns";
import { withRequestContextAndRateLimit } from "@/lib/middleware/with-request-context";
import { getCachedSession } from "@/lib/auth/cached-session";

/**
 * GET /api/analytics/logs
 * Real execution logs from PriceUpdateLog table
 */
async function handleGET(_req: NextRequest) {
  const session = await getCachedSession();

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Allow super admins to impersonate a tenant
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
    const logs = await prisma.priceUpdateLog.findMany({
      where: {
        Product: {
          tenantId,
        },
      },
      include: {
        Product: true,
      },
      orderBy: {
        executedAt: "desc",
      },
      take: 10,
    });

    const formattedLogs = logs.map((log) => ({
      name: log.Product.title,
      sku: log.Product.sku || "N/A",
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

export async function GET(req: NextRequest) {
  return withRequestContextAndRateLimit(req, "read", handleGET);
}
