import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * GET /api/v1/admin/debug
 * Centrally fetches system-wide diagnostics, logs, and inconsistencies.
 */
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.isSuperAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const searchParams = req.nextUrl.searchParams;
    const timeframe = parseInt(searchParams.get("timeframe") || "24"); // Hours
    const limit = parseInt(searchParams.get("limit") || "50");
    const cutoff = new Date(Date.now() - timeframe * 3600 * 1000);

    // 1. Fetch Errors and Warnings from different logs
    const [syncErrors, updateErrors, scrapeFailures, recentAudit] = await Promise.all([
      // Sync Logs (High Level)
      prisma.syncLog.findMany({
        where: { level: { in: ["ERROR", "WARN"] }, createdAt: { gte: cutoff } },
        orderBy: { createdAt: "desc" },
        take: limit,
        include: { site: { select: { baseUrl: true, tenant: { select: { companyName: true } } } } }
      }),
      // Price Update Logs
      prisma.priceUpdateLog.findMany({
        where: { status: "FAILED", executedAt: { gte: cutoff } },
        orderBy: { executedAt: "desc" },
        take: limit,
        include: { product: { select: { title: true, tenant: { select: { companyName: true } } } } }
      }),
      // Scrape Retries / Hard Failures
      prisma.scrapeRetry.findMany({
        where: { status: "FAILED", updatedAt: { gte: cutoff } },
        orderBy: { updatedAt: "desc" },
        take: limit,
        include: { 
            site: { select: { baseUrl: true } },
            userProduct: { select: { title: true } },
            tenant: { select: { companyName: true } }
        }
      }),
      // Significant Audit Logs (e.g. system configs, massive deletions)
      prisma.tenantAuditLog.findMany({
          where: { createdAt: { gte: cutoff } },
          orderBy: { createdAt: "desc" },
          take: limit,
          include: { tenant: { select: { companyName: true } } }
      })
    ]);

    // 2. Identify Data Inconsistencies (Heuristic)
    const inconsistencies = [];

    // Check for products with 0 price (if they are active/in stock)
    const zeroPriceProducts = await prisma.product.count({
        where: { currentPrice: 0, inStock: true }
    });
    if (zeroPriceProducts > 0) {
        inconsistencies.push({
            type: "PRICING_ANOMALY",
            severity: "MAJOR",
            message: `${zeroPriceProducts} active products have a price of ৳0`,
            impact: "Revenue loss / Display error"
        });
    }

    // Check for user products without SKU (critical for matching)
    const missingSkus = await prisma.product.count({
        where: { site: { type: "USER" }, sku: null }
    });
    if (missingSkus > 0) {
        inconsistencies.push({
            type: "DATA_GAP",
            severity: "WARN",
            message: `${missingSkus} user products are missing SKUs`,
            impact: "Matching accuracy degraded"
        });
    }

    // Check for sites that haven't synced in 48h
    const stalledSites = await prisma.site.findMany({
        where: { 
            lastSyncAt: { lt: new Date(Date.now() - 48 * 3600 * 1000) },
            type: "COMPETITOR"
        },
        select: { baseUrl: true, tenant: { select: { companyName: true } } }
    });
    if (stalledSites.length > 0) {
        inconsistencies.push({
            type: "STALE_SOURCE",
            severity: "CRITICAL",
            message: `${stalledSites.length} competitor trackers haven't updated in 48h+`,
            impact: "Stale pricing intelligence",
            details: stalledSites.map(s => `${s.tenant.companyName}: ${s.baseUrl}`).join(", ")
        });
    }

    return NextResponse.json({
      summary: {
          errorCount: syncErrors.length + updateErrors.length + scrapeFailures.length,
          inconsistencyCount: inconsistencies.length
      },
      logs: {
        sync: syncErrors,
        updates: updateErrors,
        scraping: scrapeFailures,
        audit: recentAudit
      },
      inconsistencies,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error("[DEBUG_API] Error:", error);
    return NextResponse.json({ error: "Failed to collect debug data" }, { status: 500 });
  }
}
