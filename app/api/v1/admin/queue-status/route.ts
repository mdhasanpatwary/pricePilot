import { NextRequest, NextResponse } from "next/server";
import { getCachedSession } from "@/lib/auth/cached-session";
import { withRequestContextAndRateLimit } from "@/lib/middleware/with-request-context";

export const dynamic = 'force-dynamic';

async function handleGET() {
  const session = await getCachedSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Assuming only admins can access this, additional check might be needed depending on role implementation
  // if (session.user.role !== "ADMIN") ...

  try {
    const { getSyncFullQueue, getSyncDeltaQueue, getScrapeQueue, getNotificationQueue } = await import("@/lib/queue/client");

    const syncFullQueue = getSyncFullQueue();
    const syncDeltaQueue = getSyncDeltaQueue();
    const scrapeQueue = getScrapeQueue();
    const notifQueue = getNotificationQueue();

    const [fullCounts, deltaCounts, scrapeCounts, notifCounts] = await Promise.all([
      syncFullQueue.getJobCounts(),
      syncDeltaQueue.getJobCounts(),
      scrapeQueue.getJobCounts(),
      notifQueue.getJobCounts(),
    ]);

    const activeJobs = await Promise.all([
      syncFullQueue.getJobs(['active', 'waiting'], 0, 5),
      syncDeltaQueue.getJobs(['active', 'waiting'], 0, 5),
      scrapeQueue.getJobs(['active', 'waiting'], 0, 5),
    ]);

    const formatJob = (job: any) => ({
      id: job.id,
      name: job.name,
      tenantId: job.data.tenantId,
      progress: job.progress,
      timestamp: job.timestamp,
    });

    return NextResponse.json({
      queues: {
        syncFull: { name: "Sync FULL", counts: fullCounts, recent: activeJobs[0].map(formatJob) },
        syncDelta: { name: "Sync DELTA", counts: deltaCounts, recent: activeJobs[1].map(formatJob) },
        scrape: { name: "Scrape", counts: scrapeCounts, recent: activeJobs[2].map(formatJob) },
        notifications: { name: "Notifications", counts: notifCounts },
      }
    });
  } catch (error) {
    console.error("Queue Monitor Error:", error);
    return NextResponse.json({ error: "Failed to fetch queue stats" }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  return withRequestContextAndRateLimit(req, 'read', handleGET);
}
