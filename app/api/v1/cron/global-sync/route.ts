import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { SyncOrchestrator } from "@/lib/services/sync-orchestrator";

export const maxDuration = 300; // 5 minutes max duration for Vercel functions (Pro plan)
export const dynamic = "force-dynamic";

async function handleGET(req: NextRequest) {
  // Verify Vercel Cron Secret for security
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  console.log("[Cron] Starting Global Price Sync");
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
        await SyncOrchestrator.dispatchFullSync(tenant.id);
      } catch (e) {
        console.error(`[Cron] Failed to sync tenant ${tenant.companyName}:`, e);
        errorsCount++;
      }
    }

    return NextResponse.json({
      success: true,
      message: "Global sync dispatched to workers",
      stats: {
        tenantsQueued: tenants.length,
        errors: errorsCount,
      },
    });
  } catch (error) {
    console.error("[Cron] Critical failure:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}

export async function GET(req: NextRequest) {
  // Cron jobs don't need rate limiting as they're authenticated via CRON_SECRET
  // and called by Vercel's cron scheduler, not by users
  return handleGET(req);
}
