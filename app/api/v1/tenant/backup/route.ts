import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { withRateLimit } from "@/lib/middleware/ratelimit";
import {
  validateBody,
  validationErrorResponse,
  backupConfigSchema,
} from "@/lib/validation";

/**
 * GET: Export all data for the current tenant
 */
async function handleGET(_req: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tenantId = session.user.tenantId;

  try {
    // Collect all tenant-related data
    const [tenant, products, sites, rules, auditLogs] = await Promise.all([
      (prisma.tenant as any).findUnique({
        where: { id: tenantId },
      }),
      prisma.product.findMany({
        where: { tenantId },
        include: { matchesAsUser: true },
      }),
      prisma.site.findMany({
        where: { tenantId },
      }),
      prisma.pricingRule.findMany({
        where: { tenantId },
      }),
      prisma.tenantAuditLog.findMany({
        where: { tenantId },
        take: 1000, // Limit to recent logs for size
        orderBy: { createdAt: "desc" },
      }),
    ]);

    const exportData = {
      tenant: {
        companyName: tenant?.companyName,
        planType: tenant?.planType,
        currency: tenant?.currency,
        createdAt: tenant?.createdAt,
      },
      exportTimestamp: new Date().toISOString(),
      version: "1.0",
      data: {
        products,
        sites,
        rules,
        auditLogs,
      },
    };

    const filename = `pricepilot_export_${tenant?.companyName.toLowerCase().replace(/\s+/g, "_")}_${new Date().toISOString().split("T")[0]}.json`;

    return new NextResponse(JSON.stringify(exportData, null, 2), {
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error("Tenant export failed:", error);
    return NextResponse.json(
      { error: "Failed to generate data export" },
      { status: 500 },
    );
  }
}

export async function GET(req: NextRequest) {
  return withRateLimit(req, 'read', handleGET);
}

/**
 * PATCH: Update backup settings (e.g. Google Drive link)
 */
async function handlePATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tenantId = session.user.tenantId;

  try {
    // Validate request body
    const validation = await validateBody(req, backupConfigSchema);

    if (!validation.success) {
      return validationErrorResponse(validation);
    }

    const { googleDriveLink } = validation.data!;

    const tenant = await (prisma.tenant as any).findUnique({
      where: { id: tenantId },
      select: { backupConfig: true },
    });

    const currentConfig = (tenant?.backupConfig as any) || {};
    const newConfig = {
      ...currentConfig,
      googleDriveLink: googleDriveLink || "",
      lastUpdated: new Date().toISOString(),
    };

    await (prisma.tenant as any).update({
      where: { id: tenantId },
      data: {
        backupConfig: newConfig,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Backup settings updated",
      config: newConfig,
    });
  } catch (error) {
    console.error("Failed to update backup settings:", error);
    return NextResponse.json(
      { error: "Failed to update settings" },
      { status: 500 },
    );
  }
}

export async function PATCH(req: NextRequest) {
  return withRateLimit(req, 'write', handlePATCH);
}
