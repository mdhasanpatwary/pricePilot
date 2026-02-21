import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCachedSession } from "@/lib/auth/cached-session";
import { withRequestContextAndRateLimit } from "@/lib/middleware/with-request-context";

async function handlePOST(req: NextRequest) {
  const session = await getCachedSession();

  if (!session?.user) {
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

    // To "stop" a sync, we simply flip the flag.
    // The SyncOrchestrator check this flag on every iteration and will terminate.
    const stopped = await prisma.site.updateMany({
      where: { id: siteId, tenantId: session.user.tenantId },
      data: { isSyncing: false },
    });

    if (stopped.count === 0) {
      return NextResponse.json({ error: "Site not found" }, { status: 404 });
    }

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
