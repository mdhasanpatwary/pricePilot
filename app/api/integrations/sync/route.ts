import { NextRequest, NextResponse } from "next/server";
import { SyncService } from "@/lib/services/sync";
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

    const result = await SyncService.syncSite(siteId);

    return NextResponse.json({
      message: "Sync completed successfully",
      ...result,
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
