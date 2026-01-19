import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { withRateLimit } from "@/lib/middleware/ratelimit";

/**
 * GET /api/admin/tenants
 * Fetch all tenants with their limits and stats
 */
async function handleGET(_req: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session || !session.user.isSuperAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const tenants = await prisma.tenant.findMany({
      include: {
        _count: {
          select: {
            sites: true,
            products: true,
          },
        },
        users: {
          take: 1,
          select: { email: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const formattedTenants = tenants.map((t) => ({
      id: t.id,
      name: t.companyName,
      email: t.users[0]?.email || "No Admin",
      plan: t.planType,
      status: "ACTIVE",
      joined: t.createdAt.toISOString(),
      products: t._count.products,
      storeLimit: t.storeLimit,
      competitorLimit: t.competitorLimit,
      // Calculate current usage
      activeStores: 0, // We'll need another query or more complex include to separate types
    }));

    // In a real scenario, we'd do a more complex query to count sites by type
    // but for now, we'll fetch the specific site counts
    const siteCounts = await prisma.site.groupBy({
      by: ["tenantId", "type"],
      _count: true,
    });

    const result = formattedTenants.map((t) => {
      const stores =
        siteCounts.find((s) => s.tenantId === t.id && s.type === "USER")
          ?._count || 0;
      const competitors =
        siteCounts.find((s) => s.tenantId === t.id && s.type === "COMPETITOR")
          ?._count || 0;
      return {
        ...t,
        activeStores: stores,
        activeCompetitors: competitors,
      };
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("Failed to fetch tenants:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}

/**
 * PATCH /api/admin/tenants
 * Update tenant limits or plan
 */
async function handlePATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session || !session.user.isSuperAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { id, storeLimit, competitorLimit, planType } = body;

    if (!id) {
      return NextResponse.json(
        { error: "Tenant ID is required" },
        { status: 400 },
      );
    }

    const updatedTenant = await prisma.tenant.update({
      where: { id },
      data: {
        ...(storeLimit !== undefined && { storeLimit: parseInt(storeLimit) }),
        ...(competitorLimit !== undefined && {
          competitorLimit: parseInt(competitorLimit),
        }),
        ...(planType !== undefined && { planType }),
      },
    });

    return NextResponse.json(updatedTenant);
  } catch (error) {
    console.error("Failed to update tenant:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}

export async function GET(req: NextRequest) {
  return withRateLimit(req, "read", handleGET);
}

export async function PATCH(req: NextRequest) {
  return withRateLimit(req, "write", handlePATCH);
}
