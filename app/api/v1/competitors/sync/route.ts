import { NextRequest, NextResponse } from "next/server";
import { SyncOrchestrator } from "@/lib/services/sync-orchestrator";
import { getCachedSession } from "@/lib/auth/cached-session";
import { withRequestContextAndRateLimit } from "@/lib/middleware/with-request-context";
import {
  validateBody,
  validationErrorResponse,
  syncSiteSchema,
} from "@/lib/validation";
import { withDbRetry } from "@/lib/utils/db-retry";

/**
 * POST /api/competitors/sync
 * Trigger a sync for a specific competitor site
 */
async function handleSync(req: NextRequest) {
  const session = await getCachedSession();

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Validate request body
    const validation = await validateBody(req, syncSiteSchema);

    if (!validation.success) {
      return validationErrorResponse(validation);
    }

    const { siteId, force } = validation.data!;

    // Check if site is already syncing
    const { prisma } = await import("@/lib/prisma");
    const site = await withDbRetry(() => prisma.site.findUnique({
      where: { id: siteId, tenantId: session.user.tenantId },
      select: { isSyncing: true },
    }), { operationName: 'CheckSyncStatus' });

    if (!site) {
      return NextResponse.json({ error: "Site not found" }, { status: 404 });
    }

    if (site.isSyncing && !force) {
      return NextResponse.json(
        {
          error: "Sync is already in progress for this site",
          success: false,
          isSyncing: true,
        },
        { status: 409 },
      );
    }

    const now = new Date();
    // Check if we should resume a recent unfinished sync or start fresh
    const currentSiteStatus = await withDbRetry(() => prisma.site.findUnique({
      where: { id: siteId },
      select: {
        syncStartedAt: true,
        syncProcessed: true,
        syncTotal: true
      }
    }), { operationName: 'FetchCurrentSyncStatus' });

    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const isResume = currentSiteStatus?.syncStartedAt &&
                     currentSiteStatus.syncStartedAt > yesterday &&
                     currentSiteStatus.syncProcessed > 0 &&
                     currentSiteStatus.syncProcessed < currentSiteStatus.syncTotal;

    // Mark site as syncing immediately to provide instant feedback to the frontend
    await withDbRetry(() => prisma.site.update({
      where: { id: siteId },
      data: {
        isSyncing: true,
        syncStartedAt: isResume ? currentSiteStatus!.syncStartedAt : now,
        syncLastAction: isResume ? "Resuming sync session..." : "Queuing sync job...",
        syncProcessed: isResume ? currentSiteStatus!.syncProcessed : 0
      },
    }), { operationName: 'MarkSiteAsSyncing' });

    // Invalidate competitors list cache for this tenant so UI reflects sync state immediately
    const { invalidateCache } = await import("@/lib/middleware/api-cache");
    await invalidateCache(`api:competitors:*:${session.user.tenantId}*`).catch(err =>
      console.error("Cache invalidation error:", err)
    );

    // Run sync in background (don't await)
    SyncOrchestrator.dispatchSiteSync(siteId, force).catch((error) => {
      console.error(`[API] Background sync failed for site ${siteId}:`, error);
    });

    // Return immediately so the frontend can start polling
    return NextResponse.json({
      success: true,
      message: "Sync started successfully",
      siteId,
    });
  } catch (error) {
    const err = error as Error;
    console.error("Site sync failed:", err);
    return NextResponse.json(
      { error: err.message || "Site sync failed" },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  return withRequestContextAndRateLimit(req, "sync", handleSync);
}
