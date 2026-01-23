import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { withRateLimit } from "@/lib/middleware/ratelimit";

async function handlePOST(req: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { siteId } = await req.json();

    if (!siteId) {
      return NextResponse.json(
        { error: "Site ID is required" },
        { status: 400 },
      );
    }

    const { getSyncQueue } = await import("@/lib/queue/client");
    const { QUEUE_NAMES } = await import("@/lib/queue/types");

    const queue = getSyncQueue();
    const job = await queue.add(QUEUE_NAMES.SYNC, {
      type: "SOURCE_SYNC",
      siteId,
    });
    console.log(`[API] Queued SOURCE_SYNC job ${job.id} for site ${siteId}`);

    return NextResponse.json({
      message: "Sync started in background",
      success: true,
    });
  } catch (error) {
    const err = error as Error;
    console.error("Sync error:", err);
    return NextResponse.json(
      {
        error: "Failed to complete sync",
        details: err.message,
      },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  return withRateLimit(req, "sync", handlePOST);
}
