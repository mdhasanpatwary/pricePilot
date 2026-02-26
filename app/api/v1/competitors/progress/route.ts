import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withErrorHandling } from "@/lib/middleware/global-error-handler";
import { UnauthorizedError } from "@/lib/utils/error-handler";
import { getCachedSession } from "@/lib/auth/cached-session";
import { withRequestContextOnly } from "@/lib/middleware/with-request-context";
import { withDbRetry } from "@/lib/utils/db-retry";

async function handleGET(_req: NextRequest) {
  const session = await getCachedSession();
  if (!session?.user) {
    throw new UnauthorizedError("Authentication required to access sync progress");
  }

  const tenantId = session.user.tenantId;

  const sites = await prisma.site.findMany({
    where: {
      tenantId,
      type: "COMPETITOR",
    },
    select: {
      id: true,
      isSyncing: true,
      syncTotal: true,
      syncProcessed: true,
      syncLastAction: true,
      syncStartedAt: true,
      lastSyncAt: true,
      syncState: true,
    },
    orderBy: { id: "desc" },
  });

  const activeSyncSiteIds = sites
    .filter((site) => Boolean(site.isSyncing))
    .map((site) => site.id);

  const logsBySite = new Map<
    string,
    Array<{ id: string; siteId: string; message: string; level: string; createdAt: Date }>
  >();

  if (activeSyncSiteIds.length > 0) {
    const maxLogsToFetch = Math.min(500, Math.max(50, activeSyncSiteIds.length * 30));
    const syncLogs = await withDbRetry(
      () =>
        prisma.syncLog.findMany({
          where: { siteId: { in: activeSyncSiteIds } },
          orderBy: { createdAt: "desc" },
          take: maxLogsToFetch,
        }),
      { operationName: "FetchCompetitorProgressLogs" }
    );

    for (const log of syncLogs) {
      const bucket = logsBySite.get(log.siteId) || [];
      if (bucket.length < 20) {
        bucket.push({
          id: log.id,
          siteId: log.siteId,
          message: log.message,
          level: log.level,
          createdAt: log.createdAt,
        });
        logsBySite.set(log.siteId, bucket);
      }
    }
  }

  const progress = sites.map((site) => {
    const total = site.syncTotal || 0;
    const processed = site.syncProcessed || 0;
    const progressPercent =
      total > 0 ? Math.min(100, Math.max(0, Math.round((processed / total) * 100))) : 0;
    const siteLogs = logsBySite.get(site.id) || [];

    return {
      id: site.id,
      isSyncing: Boolean(site.isSyncing),
      syncTotal: total,
      syncProcessed: processed,
      syncLastAction: site.syncLastAction,
      syncStartedAt: site.syncStartedAt,
      lastSyncAt: site.lastSyncAt,
      progressPercent,
      latestLogAt: siteLogs[0]?.createdAt || null,
      logs: siteLogs,
    };
  });

  const activeSyncCount = progress.filter((site) => site.isSyncing).length;

  return NextResponse.json({
    sites: progress,
    activeSyncCount,
    timestamp: new Date().toISOString(),
  });
}

export async function GET(req: NextRequest) {
  return withRequestContextOnly(req, withErrorHandling(handleGET));
}
