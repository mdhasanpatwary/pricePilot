import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";
import { withRateLimit } from "@/lib/middleware/ratelimit";

/**
 * GET /api/analytics/history
 * Price history data for dashboard charts
 */
async function handleGET(req: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tenantId = session.user.tenantId;
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
      // Get aggregated price trend for ALL products (User and competitors)
      const allProducts = await prisma.product.findMany({
        where: { tenantId },
        select: {
          id: true,
          site: {
            select: {
              type: true,
            },
          },
        },
      });

      const userProductIds = allProducts
        .filter((p) => p.site.type === "USER")
        .map((p) => p.id);
      const rivalProductIds = allProducts
        .filter((p) => p.site.type === "COMPETITOR")
        .map((p) => p.id);

      const history = await prisma.priceHistory.findMany({
        where: {
          productId: { in: [...userProductIds, ...rivalProductIds] },
          recordedAt: {
            gte: new Date(Date.now() - days * 24 * 60 * 60 * 1000),
          },
        },
        orderBy: {
          recordedAt: "asc",
        },
      });

      // Group by date and calculate average for each type
      interface GroupedData {
        [key: string]: {
          user: { total: number; count: number };
          rivals: { total: number; count: number };
        };
      }

      const grouped = history.reduce((acc: GroupedData, h) => {
        const date = h.recordedAt.toISOString().split("T")[0];
        const isUser = userProductIds.includes(h.productId);

        if (!acc[date]) {
          acc[date] = {
            user: { total: 0, count: 0 },
            rivals: { total: 0, count: 0 },
          };
        }

        const type = isUser ? "user" : "rivals";
        acc[date][type].total += parseFloat(h.price.toString());
        acc[date][type].count += 1;
        return acc;
      }, {} as GroupedData);

      const chartData = Object.entries(grouped)
        .map(([date, data]) => ({
          name: date.split("-").slice(1).reverse().join(" "), // "15 Jan" format
          index:
            data.user.count > 0
              ? Math.round(data.user.total / data.user.count)
              : null,
          rivals:
            data.rivals.count > 0
              ? Math.round(data.rivals.total / data.rivals.count)
              : null,
        }))
        .filter((d) => d.index !== null || d.rivals !== null);

      return NextResponse.json(chartData);
    }
  } catch (error) {
    console.error("Error fetching price history:", error);
    return NextResponse.json(
      { error: "Failed to fetch price history" },
      { status: 500 },
    );
  }
}

export async function GET(req: NextRequest) {
  return withRateLimit(req, "read", handleGET);
}
