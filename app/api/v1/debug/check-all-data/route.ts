import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withInternalGate } from "@/lib/middleware/internal-gate";
import { withRequestContextAndRateLimit } from "@/lib/middleware/with-request-context";

async function handleGET() {
  try {
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
  return withInternalGate(req, (r) => withRequestContextAndRateLimit(r, "auth", handleGET));
}
