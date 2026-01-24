import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { withRateLimit } from "@/lib/middleware/ratelimit";

async function handleGET(_req: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session || !session.user.isSuperAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // 1. Get total sites count
    const totalSites = await prisma.site.count();

    // 2. Get active sessions (currently syncing)
    const activeSessions = await prisma.site.count({
      where: { isSyncing: true },
    });

    // 3. Get success/fail counts from SyncLogs in last 24h
    const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const logs = await prisma.syncLog.groupBy({
      by: ["level"],
      where: {
        createdAt: { gte: last24h },
      },
      _count: true,
    });

    const successCount =
      logs.find((l) => l.level === "SUCCESS" || l.level === "INFO")?._count ||
      0;
    const errorCount = logs.find((l) => l.level === "ERROR")?._count || 0;
    const totalRequests = successCount + errorCount;
    const successRate =
      totalRequests > 0 ? (successCount / totalRequests) * 100 : 100;

    // 4. Get top domains being scraped
    const sites = await prisma.site.findMany({
      select: {
        id: true,
        baseUrl: true,
        searchQueryPattern: true,
        type: true,
        lastSyncAt: true,
        isSyncing: true,
        tenant: {
          select: { companyName: true },
        },
      },
      orderBy: { lastSyncAt: "desc" },
      take: 20,
    });

    return NextResponse.json({
      stats: {
        totalSites,
        activeSessions,
        totalRequests24h: totalRequests,
        successRate: successRate.toFixed(1) + "%",
        avgLatency: "450ms", // Mocked as we don't track latency in DB yet
        engineStatus: "Operational",
      },
      scrapers: sites.map((s) => ({
        id: s.id,
        baseUrl: s.baseUrl,
        searchQueryPattern: s.searchQueryPattern,
        domain: new URL(s.baseUrl).hostname,
        type: s.type,
        tenant: s.tenant.companyName,
        lastRun: s.lastSyncAt,
        status: s.isSyncing ? "RUNNING" : "IDLE",
      })),
    });
  } catch (error) {
    console.error("Failed to fetch scraper status:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}

export async function GET(req: NextRequest) {
  return withRateLimit(req, "read", handleGET);
}
