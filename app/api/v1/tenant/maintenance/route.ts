import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { withRateLimit } from "@/lib/middleware/ratelimit";

async function handlePOST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const tenantId = session.user.tenantId;
  const { action } = await req.json();

  try {
    switch (action) {
      case "RESET_ALL":
        // Delete EVERYTHING for this tenant (except users/tenant itself)
        await prisma.$transaction([
          // 1. Delete Products (cascades to matches, history, updateLogs)
          prisma.product.deleteMany({ where: { tenantId } }),
          // 2. Delete Sites (integrations/competitors, cascades to syncLogs)
          prisma.site.deleteMany({ where: { tenantId } }),
          // 3. Delete Rules
          prisma.pricingRule.deleteMany({ where: { tenantId } }),
          prisma.alertRule.deleteMany({ where: { tenantId } }),
          // 4. Delete Communications & Logs
          prisma.notification.deleteMany({ where: { tenantId } }),
          prisma.tenantAuditLog.deleteMany({ where: { tenantId } }),
          prisma.bulkOperationSnapshot.deleteMany({ where: { tenantId } }),
          // 5. Delete Webhooks & API Keys
          prisma.webhook.deleteMany({ where: { tenantId } }),
          prisma.apiKey.deleteMany({ where: { tenantId } }),
          // 6. Reset Tenant settings
          prisma.tenant.update({
            where: { id: tenantId },
            data: {
              slackEnabled: false,
              slackWebhookUrl: null,
              currency: "USD",
              backupConfig: null as any,
            },
          }),
        ]);

        return NextResponse.json({
          message: "Account has been fully reset. All integrations, products, and configuration have been cleared.",
        });

      case "CLEAN_MARKET_DATA":
        // Delete only competitor products
        await prisma.product.deleteMany({
          where: {
            tenantId,
            site: { type: "COMPETITOR" },
          },
        });
        return NextResponse.json({
          message: "Competitor data and matches have been cleared.",
        });

      case "CLEAR_SYNC_LOCKS":
        // Reset syncing status for all sites
        await prisma.site.updateMany({
          where: { tenantId },
          data: {
            isSyncing: false,
            syncLastAction: "System Reset",
          },
        });
        return NextResponse.json({
          message: "Site synchronization locks have been cleared.",
        });

      default:
        return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }
  } catch (error) {
    console.error("Maintenance Error:", error);
    return NextResponse.json(
      { error: "Failed to perform maintenance action" },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  return withRateLimit(req, "write", handlePOST);
}
