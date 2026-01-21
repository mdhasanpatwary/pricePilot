import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { withRateLimit } from "@/lib/middleware/ratelimit";
import {
  validateBody,
  validationErrorResponse,
  createIntegrationSchema,
} from "@/lib/validation";

/**
 * GET /api/integrations
 * Fetch all connected sites for the authenticated tenant
 */
async function handleGET(_req: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tenantId = session.user.tenantId;

  try {
    const sites = await prisma.site.findMany({
      where: {
        tenantId,
        type: "USER",
      },
      include: {
        _count: {
          select: { products: true },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    const formattedSites = sites.map((site) => ({
      id: site.id,
      platform: site.platform,
      type: site.type,
      name: new URL(site.baseUrl).hostname,
      url: site.baseUrl,
      products: site._count.products,
      status: site.lastSyncAt ? "CONNECTED" : "PENDING",
      lastSync: site.lastSyncAt?.toISOString() || null,
    }));

    return NextResponse.json(formattedSites);
  } catch (error) {
    console.error("Error fetching integrations:", error);
    return NextResponse.json(
      { error: "Failed to fetch integrations" },
      { status: 500 },
    );
  }
}

/**
 * POST /api/integrations
 * Create a new site connection
 */
async function handlePOST(req: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tenantId = session.user.tenantId;

  try {
    // Validate and sanitize input
    const validation = await validateBody(req, createIntegrationSchema);

    if (!validation.success) {
      return validationErrorResponse(validation);
    }

    const { platform, baseUrl, apiToken, type } = validation.data!;

    // Fetch tenant limits
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
    });

    if (!tenant) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }

    // Check for existing integration (Dynamic Limit)
    const existingCount = await prisma.site.count({
      where: {
        tenantId,
        type: "USER",
      },
    });

    if (existingCount >= tenant.storeLimit) {
      return NextResponse.json(
        {
          error: `Site integration limit reached (${tenant.storeLimit}). Please upgrade your plan or contact support to add more stores.`,
        },
        { status: 403 },
      );
    }

    // Create the site
    const site = await prisma.site.create({
      data: {
        tenantId,
        platform,
        type: type || "USER",
        baseUrl,
        apiToken,
      },
    });

    return NextResponse.json(
      {
        id: site.id,
        platform: site.platform,
        type: site.type,
        url: site.baseUrl,
        status: "CONNECTED",
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("Error creating integration:", error);
    return NextResponse.json(
      { error: "Failed to create integration" },
      { status: 500 },
    );
  }
}

/**
 * DELETE /api/integrations/[id]
 * Remove a site connection
 */
async function handleDELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tenantId = session.user.tenantId;

  try {
    const url = new URL(req.url);
    const siteId = url.searchParams.get("id");

    if (!siteId) {
      return NextResponse.json({ error: "Site ID required" }, { status: 400 });
    }

    // Verify ownership
    const site = await prisma.site.findFirst({
      where: {
        id: siteId,
        tenantId,
      },
    });

    if (!site) {
      return NextResponse.json({ error: "Site not found" }, { status: 404 });
    }

    // Delete the site (cascade will handle related products)
    await prisma.site.delete({
      where: { id: siteId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting integration:", error);
    return NextResponse.json(
      { error: "Failed to delete integration" },
      { status: 500 },
    );
  }
}

export async function GET(req: NextRequest) {
  return withRateLimit(req, "read", handleGET);
}

export async function POST(req: NextRequest) {
  return withRateLimit(req, "write", handlePOST);
}

export async function DELETE(req: NextRequest) {
  return withRateLimit(req, "write", handleDELETE);
}
