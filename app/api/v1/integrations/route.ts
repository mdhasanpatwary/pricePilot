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
import { recordAuditLog, getIpAddress } from "@/lib/audit";
import { WebsiteService } from "@/lib/services/website-service";
import { EncryptionError } from "@/lib/services/encryption/errors";

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
        syncLogs: {
          orderBy: { createdAt: "desc" },
          take: 10,
        },
      },
      orderBy: {
        createdAt: "desc"
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
      isSyncing: site.isSyncing,
      syncProcessed: site.syncProcessed,
      syncTotal: site.syncTotal,
      syncLastAction: site.syncLastAction,
      lastSync: site.lastSyncAt?.toISOString() || null,
      logs: site.syncLogs.map(log => ({
        id: log.id,
        level: log.level,
        message: log.message,
        createdAt: log.createdAt.toISOString()
      }))
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

    const { platform, baseUrl, apiToken, type, searchQueryPattern } = validation.data!;

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
    let site;
    try {
      site = await WebsiteService.createWebsite(
        {
          tenantId,
          platform,
          type: type || "USER",
          baseUrl,
          apiToken,
          searchQueryPattern,
        },
        session.user.id
      );
    } catch (error) {
      if (error instanceof EncryptionError) {
        console.error('[Integrations API] Token encryption failed:', error);
        return NextResponse.json(
          { error: 'Failed to encrypt API token. Please try again.' },
          { status: 500 }
        );
      }
      throw error;
    }

    await recordAuditLog({
      tenantId,
      userId: session.user.id,
      userEmail: session.user.email!,
      action: "CREATE_INTEGRATION",
      entityId: site.id,
      ipAddress: getIpAddress(req),
      details: { platform, baseUrl, type: type || "USER", searchQueryPattern },
    });

    // Invalidate product list cache for this tenant
    const { invalidateCache } = await import("@/lib/middleware/api-cache");
    await invalidateCache(`api:products:*:${tenantId}:*`).catch(err =>
      console.error("Cache invalidation error:", err)
    );

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

    // Invalidate product list cache for this tenant
    const { invalidateCache } = await import("@/lib/middleware/api-cache");
    await invalidateCache(`api:products:*:${tenantId}:*`).catch(err =>
      console.error("Cache invalidation error:", err)
    );

    await recordAuditLog({
      tenantId,
      userId: session.user.id,
      userEmail: session.user.email!,
      action: "DELETE_INTEGRATION",
      entityId: siteId,
      ipAddress: getIpAddress(req),
      details: { baseUrl: site.baseUrl },
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
