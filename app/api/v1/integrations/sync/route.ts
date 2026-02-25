import { NextRequest, NextResponse } from "next/server";
import { getCachedSession } from "@/lib/auth/cached-session";
import { withRequestContextAndRateLimit } from "@/lib/middleware/with-request-context";
import { QueueBackpressureError, enqueueWithBackpressure } from "@/lib/queue/backpressure";
import {
  validateBody,
  validationErrorResponse,
  syncSiteSchema,
} from "@/lib/validation";

async function handlePOST(req: NextRequest) {
  const session = await getCachedSession();

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Validate request body
    const validation = await validateBody(req, syncSiteSchema);

    if (!validation.success) {
      console.error('[Sync API] Validation failed:', validation.error, validation.errors);
      return validationErrorResponse(validation);
    }

    const { siteId } = validation.data!;
    console.log('[Sync API] Validated siteId:', siteId);

    const { getSyncFullQueue } = await import("@/lib/queue/client");
    const { QUEUE_NAMES } = await import("@/lib/queue/types");

    const queue = getSyncFullQueue();
    const job = await enqueueWithBackpressure(
      queue,
      QUEUE_NAMES.SYNC_FULL,
      {
        type: "SOURCE_SYNC",
        siteId,
        tenantId: session.user.id, // Mandatory for fairness
      },
      {},
      { producer: "api:v1/integrations/sync", strategy: "delay" },
    );
    console.log(`[API] Queued SOURCE_SYNC job ${job.id} for site ${siteId}`);

    return NextResponse.json({
      message: "Sync started in background",
      success: true,
    });
  } catch (error) {
    if (error instanceof QueueBackpressureError) {
      return NextResponse.json(
        {
          error: "Queue overloaded. Please retry shortly.",
          details: error.message,
          queueDepth: error.queueDepth,
          threshold: error.threshold,
        },
        { status: 429 },
      );
    }

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
  return withRequestContextAndRateLimit(req, "sync", handlePOST);
}
