import { NextRequest, NextResponse } from "next/server";

import { getCachedSession } from "@/lib/auth/cached-session";
import { logger } from "@/lib/logger";
import { withRequestContextAndRateLimit } from "@/lib/middleware/with-request-context";
import { prisma } from "@/lib/prisma";
import { getRedisConnection } from "@/lib/queue/connection";
import { getNotificationQueue, getScrapeQueue, getSyncQueue } from "@/lib/queue/client";
import { QUEUE_NAMES } from "@/lib/queue/types";
import { BrowserPool } from "@/lib/services/browser-pool";
import { OperationalMetricsService } from "@/lib/services/observability/operational-metrics";
import { TenantConcurrencyLimiter } from "@/lib/services/scheduling/tenant-concurrency-limiter";

export const dynamic = "force-dynamic";

type Severity = "info" | "warning" | "critical";

type QueueSnapshot = {
  name: string;
  counts: {
    waiting: number;
    active: number;
    delayed: number;
    completed: number;
    failed: number;
    paused: number;
    prioritized: number;
  };
  depth: number;
  latencyMs: {
    avg: number;
    p95: number;
    max: number;
    sampleSize: number;
  };
};

type AlertItem = {
  id: string;
  severity: Severity;
  metric: string;
  current: number;
  threshold: number;
  message: string;
};

function numEnv(name: string, fallback: number): number {
  const raw = Number(process.env[name] || fallback);
  return Number.isFinite(raw) ? raw : fallback;
}

function round(n: number, digits: number = 1): number {
  const f = Math.pow(10, digits);
  return Math.round(n * f) / f;
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.max(0, Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[idx] || 0;
}

async function getQueueSnapshot(
  queueName: string,
  queue: ReturnType<typeof getSyncQueue>,
): Promise<QueueSnapshot> {
  const countsRaw = await queue.getJobCounts(
    "waiting",
    "active",
    "delayed",
    "completed",
    "failed",
    "paused",
    "prioritized",
  );

  const counts = {
    waiting: countsRaw.waiting || 0,
    active: countsRaw.active || 0,
    delayed: countsRaw.delayed || 0,
    completed: countsRaw.completed || 0,
    failed: countsRaw.failed || 0,
    paused: countsRaw.paused || 0,
    prioritized: countsRaw.prioritized || 0,
  };

  const waitingJobs = await queue.getJobs(["waiting"], 0, 199, false);
  const now = Date.now();
  const ages = waitingJobs
    .map((job) => Math.max(0, now - (job.timestamp || now)))
    .sort((a, b) => a - b);

  const sum = ages.reduce((acc, v) => acc + v, 0);
  const avg = ages.length > 0 ? Math.floor(sum / ages.length) : 0;
  const p95 = Math.floor(percentile(ages, 95));
  const max = ages.length > 0 ? ages[ages.length - 1] || 0 : 0;

  return {
    name: queueName,
    counts,
    depth: counts.waiting + counts.delayed + counts.prioritized,
    latencyMs: {
      avg,
      p95,
      max,
      sampleSize: ages.length,
    },
  };
}

async function getRedisMemoryUsageMb(): Promise<number> {
  try {
    const redis = getRedisConnection();
    const info = await redis.info("memory");
    const match = info.match(/used_memory:(\d+)/);
    const bytes = match ? Number(match[1]) : 0;
    return round(bytes / 1024 / 1024, 1);
  } catch (error) {
    logger.warn("[OpsMetrics] Failed to fetch Redis memory info", {
      error: error instanceof Error ? error.message : String(error),
    });
    return 0;
  }
}

function computeAlerts(params: {
  activeJobs: number;
  queueDepth: number;
  queueLatencyP95Ms: number;
  browserUtilizationPct: number;
  memoryRssMb: number;
  blockRatePct: number;
  retryRatePct: number;
}): { alerts: AlertItem[]; overload: { overloaded: boolean; reasons: string[] } } {
  const thresholds = {
    activeJobs: numEnv("OPS_ALERT_ACTIVE_JOBS", 40),
    queueDepth: numEnv("OPS_ALERT_QUEUE_DEPTH", 300),
    queueLatencyMs: numEnv("OPS_ALERT_QUEUE_LATENCY_MS", 120000),
    browserUtilizationPct: numEnv("OPS_ALERT_BROWSER_UTILIZATION_PCT", 85),
    memoryRssMb: numEnv("OPS_ALERT_MEMORY_RSS_MB", 1500),
    blockRatePct: numEnv("OPS_ALERT_BLOCK_RATE_PCT", 30),
    retryRatePct: numEnv("OPS_ALERT_RETRY_RATE_PCT", 25),
  };

  const alerts: AlertItem[] = [];
  const reasons: string[] = [];

  const pushAlert = (
    id: string,
    severity: Severity,
    metric: string,
    current: number,
    threshold: number,
    message: string,
    overloadReason?: string,
  ) => {
    alerts.push({ id, severity, metric, current, threshold, message });
    if (overloadReason) reasons.push(overloadReason);
  };

  if (params.activeJobs >= thresholds.activeJobs) {
    pushAlert(
      "active-jobs-high",
      "warning",
      "active_jobs",
      params.activeJobs,
      thresholds.activeJobs,
      `Active jobs (${params.activeJobs}) exceeded threshold (${thresholds.activeJobs})`,
      "active_jobs_high",
    );
  }

  if (params.queueDepth >= thresholds.queueDepth) {
    pushAlert(
      "queue-depth-high",
      "critical",
      "queue_depth",
      params.queueDepth,
      thresholds.queueDepth,
      `Queue depth (${params.queueDepth}) exceeded threshold (${thresholds.queueDepth})`,
      "queue_depth_high",
    );
  }

  if (params.queueLatencyP95Ms >= thresholds.queueLatencyMs) {
    pushAlert(
      "queue-latency-high",
      "critical",
      "queue_latency_p95_ms",
      params.queueLatencyP95Ms,
      thresholds.queueLatencyMs,
      `Queue latency P95 (${params.queueLatencyP95Ms}ms) exceeded threshold (${thresholds.queueLatencyMs}ms)`,
      "queue_latency_high",
    );
  }

  if (params.browserUtilizationPct >= thresholds.browserUtilizationPct) {
    pushAlert(
      "browser-util-high",
      "warning",
      "browser_pool_utilization_pct",
      params.browserUtilizationPct,
      thresholds.browserUtilizationPct,
      `Browser pool utilization (${params.browserUtilizationPct}%) exceeded threshold (${thresholds.browserUtilizationPct}%)`,
      "browser_capacity_pressure",
    );
  }

  if (params.memoryRssMb >= thresholds.memoryRssMb) {
    pushAlert(
      "memory-rss-high",
      "critical",
      "memory_rss_mb",
      params.memoryRssMb,
      thresholds.memoryRssMb,
      `Process RSS (${params.memoryRssMb}MB) exceeded threshold (${thresholds.memoryRssMb}MB)`,
      "memory_pressure",
    );
  }

  if (params.blockRatePct >= thresholds.blockRatePct) {
    pushAlert(
      "block-rate-high",
      "warning",
      "block_rate_pct",
      params.blockRatePct,
      thresholds.blockRatePct,
      `Block rate (${params.blockRatePct}%) exceeded threshold (${thresholds.blockRatePct}%)`,
      "block_rate_high",
    );
  }

  if (params.retryRatePct >= thresholds.retryRatePct) {
    pushAlert(
      "retry-rate-high",
      "warning",
      "retry_rate_pct",
      params.retryRatePct,
      thresholds.retryRatePct,
      `Retry rate (${params.retryRatePct}%) exceeded threshold (${thresholds.retryRatePct}%)`,
      "retry_rate_high",
    );
  }

  const criticalCount = alerts.filter((a) => a.severity === "critical").length;
  const overloaded = criticalCount > 0 || reasons.length >= 3;

  return {
    alerts,
    overload: {
      overloaded,
      reasons,
    },
  };
}

async function handleGET() {
  const session = await getCachedSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = session.user as any;
  const isAdmin = user.role === "ADMIN" || user.isSuperAdmin === true;
  if (!isAdmin) {
    return NextResponse.json({ error: "Unauthorized - Admin access required" }, { status: 401 });
  }

  const [syncQueueSnapshot, scrapeQueueSnapshot, notificationQueueSnapshot, syncLatency, scrapeLatency, notificationLatency, activeGauge, tenantCounters, ops, redisMemoryMb] = await Promise.all([
    getQueueSnapshot(QUEUE_NAMES.SYNC, getSyncQueue()),
    getQueueSnapshot(QUEUE_NAMES.SCRAPE, getScrapeQueue()),
    getQueueSnapshot(QUEUE_NAMES.NOTIFICATIONS, getNotificationQueue()),
    OperationalMetricsService.getQueueLatencySummary(QUEUE_NAMES.SYNC, 60),
    OperationalMetricsService.getQueueLatencySummary(QUEUE_NAMES.SCRAPE, 60),
    OperationalMetricsService.getQueueLatencySummary(QUEUE_NAMES.NOTIFICATIONS, 60),
    OperationalMetricsService.getActiveGauge(50),
    new TenantConcurrencyLimiter().getActiveCounters(),
    OperationalMetricsService.getAggregation(60, 15),
    getRedisMemoryUsageMb(),
  ]);

  const queues = {
    [QUEUE_NAMES.SYNC]: syncQueueSnapshot,
    [QUEUE_NAMES.SCRAPE]: scrapeQueueSnapshot,
    [QUEUE_NAMES.NOTIFICATIONS]: notificationQueueSnapshot,
  };

  const activeJobsLive =
    syncQueueSnapshot.counts.active + scrapeQueueSnapshot.counts.active + notificationQueueSnapshot.counts.active;
  const activeJobs = activeGauge.total > 0 ? activeGauge.total : activeJobsLive;

  const queueDepth =
    syncQueueSnapshot.depth +
    scrapeQueueSnapshot.depth +
    notificationQueueSnapshot.depth;

  const queueLatencyP95MsRedis = Math.max(
    syncLatency.p95ApproxMs,
    scrapeLatency.p95ApproxMs,
    notificationLatency.p95ApproxMs,
  );
  const queueLatencyP95MsLive = Math.max(
    syncQueueSnapshot.latencyMs.p95,
    scrapeQueueSnapshot.latencyMs.p95,
    notificationQueueSnapshot.latencyMs.p95,
  );
  const queueLatencyP95Ms = queueLatencyP95MsRedis > 0 ? queueLatencyP95MsRedis : queueLatencyP95MsLive;

  const tenantIds = tenantCounters.map((c) => c.tenantId);
  const tenants = tenantIds.length
    ? await prisma.tenant.findMany({
      where: { id: { in: tenantIds } },
      select: { id: true, companyName: true },
    })
    : [];
  const tenantNameById = new Map(tenants.map((t) => [t.id, t.companyName]));

  const mergedTenantActive = new Map<string, number>();
  for (const c of tenantCounters) {
    mergedTenantActive.set(c.tenantId, Math.max(mergedTenantActive.get(c.tenantId) || 0, c.active));
  }
  for (const c of activeGauge.byTenant) {
    mergedTenantActive.set(c.tenantId, Math.max(mergedTenantActive.get(c.tenantId) || 0, c.activeJobs));
  }

  const perTenantActive = Array.from(mergedTenantActive.entries())
    .map(([tenantId, activeJobs]) => ({
      tenantId,
      tenantName: tenantNameById.get(tenantId) || "Unknown",
      activeJobs,
    }))
    .sort((a, b) => b.activeJobs - a.activeJobs);

  const pool = BrowserPool.getInstance();
  const poolStats = pool.getStats();
  const health = pool.healthCheck();

  const browserUtilizationPct =
    poolStats.maxGlobalBrowsers > 0
      ? round((poolStats.totalBrowsers / poolStats.maxGlobalBrowsers) * 100, 1)
      : 0;

  const memoryUsage = {
    rssMb: round(process.memoryUsage().rss / 1024 / 1024, 1),
    heapUsedMb: round(process.memoryUsage().heapUsed / 1024 / 1024, 1),
    heapTotalMb: round(process.memoryUsage().heapTotal / 1024 / 1024, 1),
    externalMb: round(process.memoryUsage().external / 1024 / 1024, 1),
    redisUsedMb: redisMemoryMb,
  };

  const { alerts, overload } = computeAlerts({
    activeJobs,
    queueDepth,
    queueLatencyP95Ms,
    browserUtilizationPct,
    memoryRssMb: memoryUsage.rssMb,
    blockRatePct: ops.block.blockRatePct,
    retryRatePct: ops.retry.retryRatePct,
  });

  return NextResponse.json({
    success: true,
    data: {
      schema: {
        queue: {
          activeJobs: "number",
          queueDepth: "number",
          queueLatencyP95Ms: "number",
          queueLatencyByQueue: "Record<queueName, { avgMs, maxMs, p95ApproxMs, count }>",
        },
        tenant: {
          perTenantActiveJobCount: "Array<{ tenantId, tenantName, activeJobs }>",
        },
        browserPool: {
          totalBrowsers: "number",
          inUseBrowsers: "number",
          maxGlobalBrowsers: "number",
          utilizationPct: "number",
        },
        memory: {
          rssMb: "number",
          heapUsedMb: "number",
          heapTotalMb: "number",
          externalMb: "number",
          redisUsedMb: "number",
        },
        blockRate: {
          total: "number",
          blocked: "number",
          blockRatePct: "number",
          perDomain: "Array<{ domain, total, blocked, blockRatePct }>",
        },
        retry: {
          enqueued: "number",
          claimed: "number",
          success: "number",
          requeued: "number",
          failed: "number",
          retryRatePct: "number",
        },
      },
      windowMinutes: ops.windowMinutes,
      metrics: {
        activeJobs,
        queueDepth,
        queueLatencyP95Ms,
        queueLatencyByQueue: {
          [QUEUE_NAMES.SYNC]: syncLatency,
          [QUEUE_NAMES.SCRAPE]: scrapeLatency,
          [QUEUE_NAMES.NOTIFICATIONS]: notificationLatency,
        },
        activeJobsByQueue: activeGauge.byQueue,
        activeJobsLive,
        perTenantActiveJobCount: perTenantActive,
        browserPoolUsage: {
          ...poolStats,
          utilizationPct: browserUtilizationPct,
          healthy: health.healthy,
          healthReasons: health.reasons,
        },
        memoryUsage,
        blockRate: {
          total: ops.block.total,
          blocked: ops.block.blocked,
          blockRatePct: ops.block.blockRatePct,
          perDomain: ops.block.domains,
        },
        retryRate: {
          ...ops.retry,
        },
      },
      queues,
      alerts,
      overload,
    },
  });
}

export async function GET(req: NextRequest) {
  return withRequestContextAndRateLimit(req, "read", handleGET);
}
