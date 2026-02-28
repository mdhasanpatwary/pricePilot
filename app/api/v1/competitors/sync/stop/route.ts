import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCachedSession } from "@/lib/auth/cached-session";
import { withRequestContextAndRateLimit } from "@/lib/middleware/with-request-context";
import { RedisCircuitBreaker } from "@/lib/redis/circuit-breaker";

async function handlePOST(req: NextRequest) {
  const session = await getCachedSession();

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    if (RedisCircuitBreaker.getInstance().isOpen()) {
      return NextResponse.json(
        { error: "Service temporarily degraded. Please try again later." },
        { status: 503 }
      );
    }

    const { siteId } = await req.json();

    if (!siteId) {
      return NextResponse.json(
        { error: "Site ID is required" },
        { status: 400 },
      );
    }

    // To "stop" a sync, we trigger a STOPPING state.
    // The SyncOrchestrator checks this flag on every iteration and will terminate.
    const site = await prisma.site.findUnique({
      where: { id: siteId, tenantId: session.user.tenantId }
    });

    if (!site) {
      return NextResponse.json({ error: "Site not found" }, { status: 404 });
    }

    if (site.syncState === "IDLE" || site.syncState === "STOPPED") {
      return NextResponse.json({
        success: true,
        message: "Sync is already idle",
      });
    }

    if (site.syncState === "STOPPING") {
      // If stuck in STOPPING for more than 2 minutes, force-reset to IDLE
      // We use updatedAt as a proxy for when STOPPING began, since the DB updates
      // the record when syncState changes to STOPPING.
      const stuckThresholdMs = 2 * 60 * 1000;
      const updatedAtTime = site.updatedAt ? new Date(site.updatedAt).getTime() : Date.now();
      const stuckDuration = Date.now() - updatedAtTime;

      if (stuckDuration > stuckThresholdMs || !site.syncStartedAt) {
        await prisma.site.update({
          where: { id: siteId },
          data: { isSyncing: false, syncState: "IDLE", syncLastAction: "Force-stopped (stuck in STOPPING state)" },
        });
        return NextResponse.json({
          success: true,
          message: "Crawler force-stopped (was stuck)",
        });
      }

      return NextResponse.json({
        success: true,
        message: "Stop signal already sent",
      });
    }

    await prisma.site.update({
      where: { id: siteId },
      data: { isSyncing: false, syncState: "STOPPING", syncLastAction: "Stopping sync session..." },
    });

    // Invalidate competitors list cache for this tenant
    const { invalidateCache } = await import("@/lib/middleware/api-cache");
    await invalidateCache(`api:competitors:*:${session.user.tenantId}*`).catch(err =>
      console.error("Cache invalidation error:", err)
    );

    return NextResponse.json({
      success: true,
      message: "Stop signal sent to crawler",
    });
  } catch (error) {
    console.error("Error stopping sync:", error);
    return NextResponse.json({ error: "Failed to stop sync" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  return withRequestContextAndRateLimit(req, "write", handlePOST);
}
