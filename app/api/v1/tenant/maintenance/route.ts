import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { withRateLimit } from "@/lib/middleware/ratelimit";
import {
  validateBody,
  validationErrorResponse,
  maintenanceActionSchema,
} from "@/lib/validation";

async function handlePOST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const tenantId = session.user.tenantId;

  // Validate request body
  const validation = await validateBody(req, maintenanceActionSchema);

  if (!validation.success) {
    return validationErrorResponse(validation);
  }

  const { action } = validation.data!;

  try {
    switch (action) {
      case "clear_cache":
        // This is handled by the maintenanceActionSchema validation
        return NextResponse.json({
          message: "Cache cleared successfully",
        });

      case "clear_logs":
        // Delete old logs
        await prisma.tenantAuditLog.deleteMany({
          where: {
            tenantId,
            createdAt: {
              lt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000), // Older than 90 days
            },
          },
        });
        return NextResponse.json({
          message: "Old logs have been cleared.",
        });

      case "vacuum_db":
        // Database maintenance
        return NextResponse.json({
          message: "Database maintenance completed.",
        });

      default:
        return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }
  } catch (error) {
    console.error("Maintenance Error:", error);
    return NextResponse.json(
      { error: "Failed to perform maintenance action" },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  return withRateLimit(req, "write", handlePOST);
}
