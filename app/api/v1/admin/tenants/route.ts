import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { withRateLimit } from "@/lib/middleware/ratelimit";
import { z } from "zod";
import {
  validateBody,
  validateQuery,
  validationErrorResponse,
  createTenantSchema,
  updateTenantSchema,
  uuidSchema,
} from "@/lib/validation";
import { recordAuditLog, getIpAddress } from "@/lib/audit";

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
          select: { id: true, email: true },
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

    // Fetch session counts for all users of these tenants (only non-expired)
    const sessionCounts = await (prisma as any).session.groupBy({
      by: ["userId"],
      where: {
        expires: {
          gt: new Date(),
        },
      },
      _count: true,
    });

    const result = formattedTenants.map((t) => {
      const stores =
        siteCounts.find((s) => s.tenantId === t.id && s.type === "USER")
          ?._count || 0;
      const competitors =
        siteCounts.find((s) => s.tenantId === t.id && s.type === "COMPETITOR")
          ?._count || 0;

      // Find all users for this tenant and sum their sessions
      const tenantUserIds =
        tenants
          .find((tenant) => tenant.id === t.id)
          ?.users.map((u) => (u as any).id) || [];

      const sessionCount = sessionCounts
        .filter((s: any) => tenantUserIds.includes(s.userId))
        .reduce((sum: number, s: any) => sum + s._count, 0);

      return {
        ...t,
        activeStores: stores,
        activeCompetitors: competitors,
        activeSessions: sessionCount,
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
    const validation = await validateBody(req, updateTenantSchema);

    if (!validation.success) {
      return validationErrorResponse(validation);
    }

    const { id, storeLimit, competitorLimit, planType, reset } =
      validation.data!;

    if (reset) {
      // Perform full reset for this specific tenant
      await prisma.$transaction([
        prisma.product.deleteMany({ where: { tenantId: id } }),
        prisma.site.deleteMany({ where: { tenantId: id } }),
        prisma.pricingRule.deleteMany({ where: { tenantId: id } }),
        prisma.alertRule.deleteMany({ where: { tenantId: id } }),
        prisma.notification.deleteMany({ where: { tenantId: id } }),
        prisma.tenantAuditLog.deleteMany({ where: { tenantId: id } }),
        prisma.bulkOperationSnapshot.deleteMany({ where: { tenantId: id } }),
        prisma.webhook.deleteMany({ where: { tenantId: id } }),
        prisma.apiKey.deleteMany({ where: { tenantId: id } }),
        // Reset Tenant settings
        prisma.tenant.update({
          where: { id: id },
          data: {
            slackEnabled: false,
            slackWebhookUrl: null,
            currency: "USD",
            backupConfig: null as any,
          },
        }),
      ]);

      await recordAuditLog({
        tenantId: session.user.tenantId,
        userId: session.user.id,
        userEmail: session.user.email!,
        action: "RESET_TENANT_DATA",
        entityId: id,
        ipAddress: getIpAddress(req),
        details: { targetTenantId: id },
      });

      return NextResponse.json({
        message: "Tenant data has been fully reset.",
      });
    }

    const updatedTenant = await prisma.tenant.update({
      where: { id },
      data: {
        ...(storeLimit !== undefined && { storeLimit: storeLimit }),
        ...(competitorLimit !== undefined && {
          competitorLimit: competitorLimit,
        }),
        ...(planType !== undefined && { planType }),
      },
    });

    await recordAuditLog({
      tenantId: session.user.tenantId, // Admin's tenant
      userId: session.user.id,
      userEmail: session.user.email!,
      action: "UPDATE_TENANT",
      entityId: id,
      ipAddress: getIpAddress(req),
      details: { storeLimit, competitorLimit, planType, targetTenantId: id },
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
    const validation = await validateBody(req, createTenantSchema);

    if (!validation.success) {
      return validationErrorResponse(validation);
    }

    const { name, planType, storeLimit, competitorLimit } = validation.data!;

    const newTenant = await prisma.tenant.create({
      data: {
        companyName: name,
        planType: planType || "BASIC",
        storeLimit: storeLimit,
        competitorLimit: competitorLimit,
      },
    });

    await recordAuditLog({
      tenantId: session.user.tenantId,
      userId: session.user.id,
      userEmail: session.user.email!,
      action: "CREATE_TENANT",
      entityId: newTenant.id,
      ipAddress: getIpAddress(req),
      details: { name, planType, storeLimit, competitorLimit },
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
    const paramValidation = validateQuery(req, z.object({ id: uuidSchema }));

    if (!paramValidation.success) {
      return validationErrorResponse(paramValidation);
    }

    const { id } = paramValidation.data!;

    // Note: Due to foreign key constraints, we should ideally handle cascade deletes
    // or restrict deletion if dependencies exist. Prisma schema has some onDelete: Cascade
    // but not for all relations.
    await prisma.tenant.delete({
      where: { id },
    });

    await recordAuditLog({
      tenantId: session.user.tenantId,
      userId: session.user.id,
      userEmail: session.user.email!,
      action: "DELETE_TENANT",
      entityId: id,
      ipAddress: getIpAddress(req),
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
