import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/analytics/history
 * Price history data for dashboard charts
 */
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tenantId = (session.user as any).tenantId;
  const url = new URL(req.url);
  const productId = url.searchParams.get("productId");
  const days = parseInt(url.searchParams.get("days") || "7");

  try {
    if (productId) {
      // Get history for a specific product
      const history = await prisma.priceHistory.findMany({
        where: {
          productId,
          product: { tenantId },
          recordedAt: {
            gte: new Date(Date.now() - days * 24 * 60 * 60 * 1000),
          },
        },
        orderBy: {
          recordedAt: "asc",
        },
      });

      const formattedHistory = history.map((h) => ({
        date: h.recordedAt.toISOString().split("T")[0],
        price: parseFloat(h.price.toString()),
      }));

      return NextResponse.json(formattedHistory);
    } else {
      // Get aggregated price trend for all user products
      const userProducts = await prisma.product.findMany({
        where: {
          tenantId,
          site: { type: "USER" },
        },
        select: { id: true },
      });

      const productIds = userProducts.map((p) => p.id);

      const history = await prisma.priceHistory.findMany({
        where: {
          productId: { in: productIds },
          recordedAt: {
            gte: new Date(Date.now() - days * 24 * 60 * 60 * 1000),
          },
        },
        orderBy: {
          recordedAt: "asc",
        },
      });

      // Group by date and calculate average
      const grouped = history.reduce((acc: any, h) => {
        const date = h.recordedAt.toISOString().split("T")[0];
        if (!acc[date]) {
          acc[date] = { total: 0, count: 0 };
        }
        acc[date].total += parseFloat(h.price.toString());
        acc[date].count += 1;
        return acc;
      }, {});

      const chartData = Object.entries(grouped).map(([date, data]: [string, any]) => ({
        date,
        index: Math.round(data.total / data.count),
      }));

      return NextResponse.json(chartData);
    }
  } catch (error) {
    console.error("Error fetching price history:", error);
    return NextResponse.json(
      { error: "Failed to fetch price history" },
      { status: 500 }
    );
  }
}
