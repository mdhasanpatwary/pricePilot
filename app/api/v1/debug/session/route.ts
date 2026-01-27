import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json({ 
        error: "Not logged in",
        session: null 
      });
    }

    const tenantId = session.user.tenantId;

    // Count products for this tenant
    const totalProducts = await prisma.product.count({
      where: { tenantId }
    });

    const userProducts = await prisma.product.count({
      where: { 
        tenantId,
        site: { type: "USER" }
      }
    });

    const competitorProducts = await prisma.product.count({
      where: { 
        tenantId,
        site: { type: "COMPETITOR" }
      }
    });

    const sites = await prisma.site.findMany({
      where: { tenantId },
      select: {
        id: true,
        baseUrl: true,
        type: true,
        _count: {
          select: { products: true }
        }
      }
    });

    return NextResponse.json({
      session: {
        user: session.user,
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
