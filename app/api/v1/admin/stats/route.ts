import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withRequestContextAndRateLimit } from "@/lib/middleware/with-request-context";
import { getCachedSession } from "@/lib/auth/cached-session";

/**
 * GET /api/admin/stats
 * Fetch platform-wide statistics for the Super Admin
 */
async function handleGET(_req: NextRequest) {
  const session = await getCachedSession();

  if (!session || !session.user.isSuperAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // 1. Optimize counts using Promise.all and groupBy
    const [productCount, planStats, recentTenants] = await Promise.all([
      prisma.product.count(),
      prisma.tenant.groupBy({
        by: ['planType'],
        _count: { _all: true },
      }),
      prisma.tenant.findMany({
        take: 5,
        orderBy: { createdAt: "desc" },
        select: {
          companyName: true,
          planType: true,
          createdAt: true,
          User: {
            take: 1,
            select: { email: true }
          },
          _count: {
            select: { Product: true }
          }
        }
      })
    ]);

    // Calculate totals from planStats
    const tenantCount = planStats.reduce((sum, stat) => sum + stat._count._all, 0);
    const proTenants = planStats.find(s => s.planType === 'PRO')?._count._all || 0;
    const basicTenants = planStats.find(s => s.planType === 'BASIC')?._count._all || 0;

    // PRO = $199, BASIC = $49 (Example pricing)
    const mrr = proTenants * 199 + basicTenants * 49;

    const formattedTenants = recentTenants.map((t) => ({
      name: t.companyName,
      email: t.User[0]?.email || "No Admin",
      plan: t.planType,
      status: "ACTIVE", // Placeholder
      joined: t.createdAt.toLocaleDateString(),
      products: t._count.Product,
    }));

    return NextResponse.json({
      stats: {
        tenants: tenantCount,
        mrr: `$${mrr.toLocaleString()}`,
        scrapes: productCount * 12, // Simulation: products * check frequency
        health: "99.8%",
      },
      recentTenants: formattedTenants,
    });
  } catch (error) {
    console.error("Failed to fetch admin stats:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}

export async function GET(req: NextRequest) {
  return withRequestContextAndRateLimit(req, "read", handleGET);
}
