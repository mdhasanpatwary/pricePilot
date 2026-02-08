import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withRateLimit } from "@/lib/middleware/ratelimit";

export const dynamic = "force-dynamic";

async function handleGET() {
  try {
    // Fetch sites that are currently syncing or have synced recently (last 24 hours)
    // We prioritize syncing sites, then recently finished ones.
    const activeSyncs = await prisma.site.findMany({
      where: {
        OR: [
          { isSyncing: true },
          { lastSyncAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } }, // Last 24 hours
        ],
      },
      select: {
        id: true,
        baseUrl: true,
        type: true,
        platform: true,
        isSyncing: true,
        syncTotal: true,
        syncProcessed: true,
        syncLastAction: true,
        syncStartedAt: true,
        lastSyncAt: true,
        Tenant: {
          select: {
            companyName: true,
          },
        },
        SyncLog: {
          orderBy: { createdAt: "desc" },
          take: 50, // Get last 50 logs
          select: {
            id: true,
            message: true,
            level: true,
            createdAt: true,
          },
        },
      },
      orderBy: [
        { isSyncing: "desc" }, // Running syncs first
        { lastSyncAt: "desc" }, // Then most recent
      ],
      take: 20, // Limit to 20 sessions for performance
    });

    return NextResponse.json(activeSyncs);
  } catch (error) {
    console.error("[SyncMonitor] Failed to fetch sync stats:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}

export async function GET(req: NextRequest) {
  return withRateLimit(req, 'read', handleGET);
}
