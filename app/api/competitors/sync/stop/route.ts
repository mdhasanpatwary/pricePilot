import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

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

    // To "stop" a sync, we simply flip the flag. 
    // The SyncOrchestrator check this flag on every iteration and will terminate.
    await prisma.site.update({
      where: { id: siteId, tenantId: session.user.tenantId },
      data: { isSyncing: false }
    });

    return NextResponse.json({ success: true, message: "Stop signal sent to crawler" });
  } catch (error) {
    console.error("Error stopping sync:", error);
    return NextResponse.json({ error: "Failed to stop sync" }, { status: 500 });
  }
}
