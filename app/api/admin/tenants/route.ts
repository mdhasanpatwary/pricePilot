import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
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
        sites: {
          where: { type: "USER" },
          take: 1,
          select: { baseUrl: true },
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
      storeUrl: t.sites[0]?.baseUrl || null,
      // Calculate current usage
      activeStores: 0,
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

/**
 * POST /api/admin/tenants
 * Create a new tenant
 */
async function handlePOST(req: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session || !session.user.isSuperAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { name, planType, storeLimit, competitorLimit } = body;

    if (!name) {
      return NextResponse.json(
        { error: "Company name is required" },
        { status: 400 },
      );
    }

    const newTenant = await prisma.tenant.create({
      data: {
        companyName: name,
        planType: planType || "BASIC",
        storeLimit: storeLimit ? parseInt(storeLimit) : 1,
        competitorLimit: competitorLimit ? parseInt(competitorLimit) : 3,
      },
    });

    return NextResponse.json(newTenant, { status: 201 });
  } catch (error) {
    console.error("Failed to create tenant:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}

/**
 * DELETE /api/admin/tenants
 * Delete a tenant
 */
async function handleDELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session || !session.user.isSuperAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { error: "Tenant ID is required" },
        { status: 400 },
      );
    }

    // Note: Due to foreign key constraints, we should ideally handle cascade deletes
    // or restrict deletion if dependencies exist. Prisma schema has some onDelete: Cascade
    // but not for all relations.
    await prisma.tenant.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete tenant:", error);
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

export async function POST(req: NextRequest) {
  return withRateLimit(req, "write", handlePOST);
}

export async function DELETE(req: NextRequest) {
  return withRateLimit(req, "write", handleDELETE);
}
