import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/[...nextauth]/route";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const tenantId = session.user.tenantId;
  const { action } = await req.json();

  try {
    switch (action) {
      case "RESET_ALL":
        // Delete all products (Includes matches and history due to Cascade)
        await prisma.product.deleteMany({
          where: { tenantId },
        });
        return NextResponse.json({
          message: "All product data has been cleared.",
        });

      case "CLEAN_MARKET_DATA":
        // Delete only competitor products
        await prisma.product.deleteMany({
          where: {
            tenantId,
            site: { type: "COMPETITOR" },
          },
        });
        return NextResponse.json({
          message: "Competitor data and matches have been cleared.",
        });

      case "CLEAR_SYNC_LOCKS":
        // Reset syncing status for all sites
        await prisma.site.updateMany({
          where: { tenantId },
          data: {
            isSyncing: false,
            syncLastAction: "System Reset",
          },
        });
        return NextResponse.json({
          message: "Site synchronization locks have been cleared.",
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
