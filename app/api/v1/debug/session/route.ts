import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withInternalGate } from "@/lib/middleware/internal-gate";
import { withRequestContextAndRateLimit } from "@/lib/middleware/with-request-context";
import { getCachedSession } from "@/lib/auth/cached-session";

async function handleGET() {
  try {
    const session = await getCachedSession();
    const tenantId = session!.user.tenantId;

    // Count products for this tenant
    const totalProducts = await prisma.product.count({
      where: { tenantId }
    });

    const userProducts = await prisma.product.count({
      where: {
        tenantId,
        Site: { type: "USER" }
      }
    });

    const competitorProducts = await prisma.product.count({
      where: {
        tenantId,
        Site: { type: "COMPETITOR" }
      }
    });

    const sites = await prisma.site.findMany({
      where: { tenantId },
      select: {
        id: true,
        baseUrl: true,
        type: true,
        _count: {
          select: { Product: true }
        }
      }
    });

    return NextResponse.json({
      session: {
        user: session!.user,
        tenantId
      },
      database: {
        totalProducts,
        userProducts,
        competitorProducts,
        sites
      }
    });
  } catch (error: any) {
    return NextResponse.json({
      error: error.message,
      stack: error.stack
    }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  return withInternalGate(req, (r) => withRequestContextAndRateLimit(r, "auth", handleGET));
}
