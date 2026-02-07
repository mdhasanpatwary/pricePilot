import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { withRateLimit } from "@/lib/middleware/ratelimit";

/**
 * GET /api/admin/stats
 * Fetch platform-wide statistics for the Super Admin
 */
async function handleGET(_req: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session || !session.user.isSuperAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const tenantCount = await prisma.tenant.count();
    const productCount = await prisma.product.count();

    // Calculate simulated MRR based on plans (Mock logic for now but using real counts)
    const proTenants = await prisma.tenant.count({
      where: { planType: "PRO" },
    });
    const basicTenants = await prisma.tenant.count({
      where: { planType: "BASIC" },
    });

    // PRO = $199, BASIC = $49 (Example pricing)
    const mrr = proTenants * 199 + basicTenants * 49;

    // Get recent tenants
    const recentTenants = await prisma.tenant.findMany({
      take: 5,
      orderBy: { createdAt: "desc" },
      include: {
        User: { take: 1 },
        _count: { select: { Product: true } },
      },
    });

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
  return withRateLimit(req, "read", handleGET);
}
