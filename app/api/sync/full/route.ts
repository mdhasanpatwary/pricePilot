import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { SyncOrchestrator } from "@/lib/services/sync-orchestrator";
import { withRateLimit } from "@/lib/middleware/ratelimit";

/**
 * POST /api/sync/full
 * Trigger a full competitive sync: Scrape -> Rules -> Update Store
 */
async function handleFullSync(_req: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tenantId = session.user.tenantId;

  try {
    const result = await SyncOrchestrator.runFullSync(tenantId);

    return NextResponse.json(result);
  } catch (error) {
    console.error("Full sync failed:", error);
    return NextResponse.json(
      { error: "Full sync orchestration failed" },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  return withRateLimit(req, "sync", handleFullSync);
}
