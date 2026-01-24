import { NextResponse } from "next/server";
import { getSyncQueue, getNotificationQueue } from "@/lib/queue/client";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Assuming only admins can access this, additional check might be needed depending on role implementation
  // if (session.user.role !== "ADMIN") ...

  try {
    const syncQueue = getSyncQueue();
    const notifQueue = getNotificationQueue();

    const [syncCounts, notifCounts, activeSyncJobs, activeNotifJobs, failedSyncJobs] = await Promise.all([
      syncQueue.getJobCounts(),
      notifQueue.getJobCounts(),
      syncQueue.getJobs(['active', 'waiting']),
      notifQueue.getJobs(['active']),
      syncQueue.getJobs(['failed'], 0, 10, false) // Last 10 failures
    ]);

    const formatJob = (job: any) => ({
      id: job.id,
      name: job.name,
      data: job.data,
      progress: job.progress,
      timestamp: job.timestamp,
      failedReason: job.failedReason,
    });

    return NextResponse.json({
      sync: {
        name: "Sync Queue",
        counts: syncCounts,
        activeJobs: activeSyncJobs.map(formatJob),
        recentFailures: failedSyncJobs.map(formatJob),
      },
      notifications: {
        name: "Notification Queue",
        counts: notifCounts,
        activeJobs: activeNotifJobs.map(formatJob),
      },
    });
  } catch (error) {
    console.error("Queue Monitor Error:", error);
    return NextResponse.json({ error: "Failed to fetch queue stats" }, { status: 500 });
  }
}
