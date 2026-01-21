import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { MaintenanceService } from "@/lib/services/maintenance";
import { withRateLimit } from "@/lib/middleware/ratelimit";

async function handlePOST(_req: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session || !session.user.isSuperAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await MaintenanceService.runDataRetention();
    return NextResponse.json({
      success: true,
      message: "Maintenance tasks completed",
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Maintenance failed",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  return withRateLimit(req, "write", handlePOST);
}
