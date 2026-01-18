import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { SyncOrchestrator } from "@/lib/services/sync-orchestrator";

/**
 * POST /api/competitors/sync
 * Trigger a sync for a specific competitor site
 */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { siteId } = await req.json();

    if (!siteId) {
      return NextResponse.json({ error: "Site ID is required" }, { status: 400 });
    }

    // Run sync in background (don't await)
    // This prevents API timeout and allows the frontend to poll for progress
    SyncOrchestrator.syncSite(siteId).catch((error) => {
      console.error(`[API] Background sync failed for site ${siteId}:`, error);
    });

    // Return immediately so the frontend can start polling
    return NextResponse.json({
      success: true,
      message: "Sync started successfully",
      siteId
    });
  } catch (error) {
    const err = error as Error;
    console.error("Site sync failed:", err);
    return NextResponse.json(
      { error: err.message || "Site sync failed" },
      { status: 500 }
    );
  }
}
