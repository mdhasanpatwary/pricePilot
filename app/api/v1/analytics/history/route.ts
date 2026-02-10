import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withRequestContextAndRateLimit } from "@/lib/middleware/with-request-context";
import { getCachedSession } from "@/lib/auth/cached-session";
import { paginate, getPaginationParams } from "@/lib/utils/pagination";

/**
 * GET /api/analytics/history
 * Price history data for dashboard charts
 * 
 * Query Parameters:
 * - productId: Optional product ID to get history for a specific product
 * - days: Number of days of history to fetch (default: 7)
 * - page: Page number for pagination (default: 1)
 * - limit: Items per page (default: 20, max: 100)
 * - sortBy: Field to sort by (default: recordedAt)
 * - sortOrder: Sort order (asc/desc, default: asc)
 */
async function handleGET(req: NextRequest) {
  const session = await getCachedSession();

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Allow super admins to impersonate a tenant
  const searchParams = req.nextUrl.searchParams;
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
  const url = new URL(req.url);
  const productId = url.searchParams.get("productId");
  const days = parseInt(url.searchParams.get("days") || "7");

  // Get pagination parameters
  const paginationParams = getPaginationParams(searchParams);

  try {
    if (productId) {
      // Get history for a specific product with pagination
      const paginatedResult = await paginate(
        prisma.priceHistory,
        {
          productId,
          product: { tenantId },
          recordedAt: {
            gte: new Date(Date.now() - days * 24 * 60 * 60 * 1000),
          },
        },
        {
          ...paginationParams,
          sortBy: paginationParams.sortBy || 'recordedAt',
          sortOrder: paginationParams.sortOrder || 'asc'
        }
      );

      const formattedHistory = paginatedResult.data.map((h: any) => ({
        date: h.recordedAt.toISOString().split("T")[0],
        price: parseFloat(h.price.toString()),
      }));

      return NextResponse.json({
        history: formattedHistory,
        pagination: paginatedResult.pagination,
      });
    } else {
      // Get aggregated price trend for ALL products (User and competitors)
      // With pagination support
      const allProducts = await prisma.product.findMany({
        where: { tenantId },
        select: {
          id: true,
          Site: {
            select: {
              type: true,
            },
          },
        },
      });

      const userProductIds = allProducts
        .filter((p) => p.Site.type === "USER")
        .map((p) => p.id);
      const rivalProductIds = allProducts
        .filter((p) => p.Site.type === "COMPETITOR")
        .map((p) => p.id);

      const paginatedResult = await paginate(
        prisma.priceHistory,
        {
          productId: { in: [...userProductIds, ...rivalProductIds] },
          recordedAt: {
            gte: new Date(Date.now() - days * 24 * 60 * 60 * 1000),
          },
        },
        {
          ...paginationParams,
          sortBy: paginationParams.sortBy || 'recordedAt',
          sortOrder: paginationParams.sortOrder || 'asc'
        }
      );

      const history = paginatedResult.data;

      // Group by date and calculate average for each type
      interface GroupedData {
        [key: string]: {
          user: { total: number; count: number };
          rivals: { total: number; count: number };
        };
      }

      const grouped = history.reduce((acc: GroupedData, h: any) => {
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

      return NextResponse.json({
        chartData,
        pagination: paginatedResult.pagination,
      });
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
  return withRequestContextAndRateLimit(req, "read", handleGET);
}
