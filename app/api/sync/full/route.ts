import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { SyncOrchestrator } from "@/lib/services/sync-orchestrator";

/**
 * POST /api/sync/full
 * Trigger a full competitive sync: Scrape -> Rules -> Update Store
 */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tenantId = (session.user as any).tenantId;

  try {
    const result = await SyncOrchestrator.runFullSync(tenantId);

    return NextResponse.json(result);
  } catch (error) {
    console.error("Full sync failed:", error);
    return NextResponse.json(
      { error: "Full sync orchestration failed" },
      { status: 500 }
    );
  }
}
