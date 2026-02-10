import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { withRateLimit } from "@/lib/middleware/ratelimit";
import {
  validateBody,
  validationErrorResponse,
  syncSiteSchema,
} from "@/lib/validation";

async function handlePOST(req: NextRequest) {
  const session = await getServerSession(authOptions);

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
