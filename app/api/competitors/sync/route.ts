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

    const result = await SyncOrchestrator.syncSite(siteId);

    return NextResponse.json(result);
  } catch (error: any) {
    console.error("Site sync failed:", error);
    return NextResponse.json(
      { error: error.message || "Site sync failed" },
      { status: 500 }
    );
  }
}
