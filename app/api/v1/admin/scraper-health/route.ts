import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withRateLimit } from "@/lib/middleware/ratelimit";

export const dynamic = "force-dynamic";

async function handleGET() {
  try {
    // Fetch all competitor sites
    const sites = await prisma.site.findMany({
      where: { type: "COMPETITOR" },
      select: {
        id: true,
        baseUrl: true,
        lastSyncAt: true,
        isSyncing: true,
        tenant: {
          select: { companyName: true },
        },
        syncLogs: {
          select: {
            level: true,
            message: true,
            createdAt: true,
          },
        },
      },
      orderBy: { lastSyncAt: "desc" },
    });

    const healthData = sites.map((site) => {
      const logs = site.syncLogs;
      if (logs.length === 0) {
        return {
          id: site.id,
          baseUrl: site.baseUrl,
          tenant: site.tenant.companyName,
          status: "unknown",
          successRate: 0,
          total: 0,
          failed: 0,
          lastSync: site.lastSyncAt,
          isSyncing: site.isSyncing,
          issues: [],
        };
      }

      // Analyze logs for success/failure patterns
      const totalProductLogs = logs.filter(
        (l) => l.message.includes("[") && l.message.includes("]"),
      ).length; // Filter identifying product processing logs e.g. [1/50]

      // If we can't find standard processing logs, fallback to log levels
      let successCount = 0;
      let failCount = 0;
      const errorTypes = new Map<string, number>();

      if (totalProductLogs > 0) {
        // Count based on message content markers set in SyncOrchestrator
        successCount = logs.filter(
          (l) => l.level === "INFO" && l.message.includes("→ ৳"),
        ).length;

        const failLogs = logs.filter(
          (l) => l.level === "WARN" || l.level === "ERROR",
        );
        failCount = failLogs.length;

        failLogs.forEach((log) => {
          let type = "Unknown Error";
          if (log.message.includes("Timeout")) type = "Timeout";
          else if (log.message.includes("No data"))
            type = "Selector Mismatch / Layout Change";
          else if (
            log.message.includes("403") ||
            log.message.includes("Access Denied")
          )
            type = "Bot Detection (403)";
          else if (log.message.includes("429")) type = "Rate Limited (429)";
          else if (log.message.includes("Network")) type = "Network Error";

          errorTypes.set(type, (errorTypes.get(type) || 0) + 1);
        });
      } else {
        // Fallback for sessions that crashed early or custom logs
        successCount = logs.filter((l) => l.level === "SUCCESS").length;
        failCount = logs.filter(
          (l) => l.level === "ERROR" || l.level === "WARN",
        ).length;
      }

      // Calculate pseudo-total if logs are weird
      const effectiveTotal = Math.max(
        totalProductLogs,
        successCount + failCount,
      );
      const successRate =
        effectiveTotal === 0
          ? 0
          : Math.round((successCount / effectiveTotal) * 100);

      // Determine Status
      let status = "healthy";
      if (site.isSyncing) status = "syncing";
      else if (effectiveTotal > 0) {
        if (successRate < 50) status = "critical";
        else if (successRate < 90) status = "degraded";
      } else if (
        site.lastSyncAt &&
        Date.now() - new Date(site.lastSyncAt).getTime() >
          7 * 24 * 60 * 60 * 1000
      ) {
        status = "stale"; // No sync in 7 days
      }

      // Convert Map to Array for JSON
      const issues = Array.from(errorTypes.entries()).map(([issue, count]) => ({
        issue,
        count,
      }));

      return {
        id: site.id,
        baseUrl: site.baseUrl,
        tenant: site.tenant.companyName,
        status,
        successRate,
        total: effectiveTotal,
        failed: failCount,
        lastSync: site.lastSyncAt,
        isSyncing: site.isSyncing,
        issues,
      };
    });

    // Sort: Critical first, then Degraded, then Stale, then Healthy
    const priorityMap: Record<string, number> = {
      critical: 0,
      degraded: 1,
      stale: 2,
      syncing: 3,
      healthy: 4,
      unknown: 5,
    };

    healthData.sort((a, b) => priorityMap[a.status] - priorityMap[b.status]);

    return NextResponse.json(healthData);
  } catch (error) {
    console.error("Health Check Error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}

export async function GET(req: NextRequest) {
  return withRateLimit(req, 'read', handleGET);
}
