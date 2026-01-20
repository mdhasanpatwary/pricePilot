import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { SyncOrchestrator } from "@/lib/services/sync-orchestrator";

export const maxDuration = 300; // 5 minutes max duration for Vercel functions (Pro plan)
export const dynamic = "force-dynamic";

export async function GET() {
  // Optional: Verify Vercel Cron Secret for security
  // const authHeader = req.headers.get("authorization");
  // if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
  //   return new NextResponse("Unauthorized", { status: 401 });
  // }

  console.log("[Cron] Starting Global Price Sync");
  let updatedCount = 0;
  let errorsCount = 0;

  try {
    // 1. Fetch all tenants
    const tenants = await prisma.tenant.findMany({
      select: { id: true, companyName: true },
    });

    console.log(`[Cron] Found ${tenants.length} tenants to sync.`);

    // 2. Iterate and sync each tenant
    for (const tenant of tenants) {
      try {
        console.log(`[Cron] Syncing tenant: ${tenant.companyName}`);
        const result = await SyncOrchestrator.runFullSync(tenant.id);
        if (result.success) {
          updatedCount += result.updated || 0;
        }
      } catch (e) {
        console.error(`[Cron] Failed to sync tenant ${tenant.companyName}:`, e);
        errorsCount++;
      }
    }

    return NextResponse.json({
      success: true,
      message: "Global sync completed",
      stats: {
        tenantsProcessed: tenants.length,
        itemsUpdated: updatedCount,
        errors: errorsCount,
      },
    });
  } catch (error) {
    console.error("[Cron] Critical failure:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
