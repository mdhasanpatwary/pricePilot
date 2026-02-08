import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { withRateLimit } from "@/lib/middleware/ratelimit";

async function handleGET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json({ error: "Not logged in" }, { status: 401 });
    }

    // Get ALL data across all tenants
    const allTenants = await prisma.tenant.findMany({
      select: { id: true, companyName: true }
    });

    const allSites = await prisma.site.findMany({
      select: {
        id: true,
        baseUrl: true,
        type: true,
        tenantId: true,
        _count: { select: { Product: true } }
      }
    });

    const allProducts = await prisma.product.findMany({
      select: {
        id: true,
        title: true,
        sku: true,
        tenantId: true,
        siteId: true,
        Site: {
          select: { baseUrl: true, type: true }
        }
      },
      take: 20 // Just first 20 to see what's there
    });

    const productsByTenant = await prisma.product.groupBy({
      by: ['tenantId'],
      _count: true
    });

    const sitesByTenant = await prisma.site.groupBy({
      by: ['tenantId', 'type'],
      _count: true
    });

    return NextResponse.json({
      currentUser: {
        email: session.user.email,
        tenantId: session.user.tenantId
      },
      summary: {
        totalTenants: allTenants.length,
        totalSites: allSites.length,
        totalProducts: await prisma.product.count()
      },
      tenants: allTenants,
      sites: allSites,
      sampleProducts: allProducts,
      productsByTenant,
      sitesByTenant
    });
  } catch (error: any) {
    return NextResponse.json({
      error: error.message,
      stack: error.stack
    }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  return withRateLimit(req, "auth", handleGET);
}
