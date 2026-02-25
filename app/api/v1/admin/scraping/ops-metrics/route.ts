import { NextRequest, NextResponse } from "next/server";

import { getCachedSession } from "@/lib/auth/cached-session";
import { logger } from "@/lib/logger";
import { withRequestContextAndRateLimit } from "@/lib/middleware/with-request-context";
import { prisma } from "@/lib/prisma";
import { getRedisConnection } from "@/lib/queue/connection";
import { getNotificationQueue, getScrapeHighPrioQueue, getScrapeLowPrioQueue, getSyncFullQueue, getSyncDeltaQueue } from "@/lib/queue/client";
import { QUEUE_NAMES } from "@/lib/queue/types";

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
  starvedCount: number; // Waiting > 1 hour
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
  queue: any,
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
    .map((job: any) => Math.max(0, now - (job.timestamp || now)))
    .sort((a: number, b: number) => a - b);

  const sum = ages.reduce((acc: number, v: number) => acc + v, 0);
  const avg = ages.length > 0 ? Math.floor(sum / ages.length) : 0;
  const p95 = Math.floor(percentile(ages, 95));
  const max = ages.length > 0 ? ages[ages.length - 1] || 0 : 0;
  const starvedCount = ages.filter((age: number) => age > 3600 * 1000).length;

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
    starvedCount,
  };
}

async function getRedisMetrics(): Promise<{ memoryMb: number, clients: number }> {
  try {
    const redis = getRedisConnection();
    const infoMemory = await redis.info("memory");
    const infoClients = await redis.info("clients");

    const matchMem = infoMemory.match(/used_memory:(\d+)/);
    const bytes = matchMem ? Number(matchMem[1]) : 0;

    const matchClients = infoClients.match(/connected_clients:(\d+)/);
    const clients = matchClients ? Number(matchClients[1]) : 0;

    return {
      memoryMb: round(bytes / 1024 / 1024, 1),
      clients
    };
  } catch (error) {
    logger.warn("[OpsMetrics] Failed to fetch Redis metrics info", {
      error: error instanceof Error ? error.message : String(error),
    });
    return { memoryMb: 0, clients: 0 };
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
  redisClients: number;
}): { alerts: AlertItem[]; overload: { overloaded: boolean; reasons: string[] } } {
  const thresholds = {
    activeJobs: numEnv("OPS_ALERT_ACTIVE_JOBS", 40),
    queueDepth: numEnv("OPS_ALERT_QUEUE_DEPTH", 300),
    queueLatencyMs: numEnv("OPS_ALERT_QUEUE_LATENCY_MS", 120000),
    browserUtilizationPct: numEnv("OPS_ALERT_BROWSER_UTILIZATION_PCT", 85),
    memoryRssMb: numEnv("OPS_ALERT_MEMORY_RSS_MB", 1500),
    blockRatePct: numEnv("OPS_ALERT_BLOCK_RATE_PCT", 30),
    retryRatePct: numEnv("OPS_ALERT_RETRY_RATE_PCT", 25),
    redisClients: numEnv("OPS_ALERT_REDIS_CLIENTS", 5000), // e.g. Neon/Redis bounds
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

  if (params.redisClients >= thresholds.redisClients) {
    pushAlert(
      "redis-clients-high",
      "warning",
      "redis_clients",
      params.redisClients,
      thresholds.redisClients,
      `Redis clients (${params.redisClients}) exceeded threshold (${thresholds.redisClients})`,
      "redis_connection_pressure",
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

  const { OperationalMetricsService } = await import("@/lib/services/observability/operational-metrics");
  const { TenantConcurrencyLimiter } = await import("@/lib/services/scheduling/tenant-concurrency-limiter");
  const { BrowserPool } = await import("@/lib/services/browser-pool");

  const [syncFullSnapshot, syncDeltaSnapshot, scrapeHighSnapshot, scrapeLowSnapshot, notificationQueueSnapshot, syncFullLatency, syncDeltaLatency, scrapeHighLatency, scrapeLowLatency, notificationLatency, activeGauge, tenantCounters, ops, redisMetrics] = await Promise.all([
    getQueueSnapshot(QUEUE_NAMES.SYNC_FULL, getSyncFullQueue()),
    getQueueSnapshot(QUEUE_NAMES.SYNC_DELTA, getSyncDeltaQueue()),
    getQueueSnapshot(QUEUE_NAMES.SCRAPE_HIGH_PRIO, getScrapeHighPrioQueue()),
    getQueueSnapshot(QUEUE_NAMES.SCRAPE_LOW_PRIO, getScrapeLowPrioQueue()),
    getQueueSnapshot(QUEUE_NAMES.NOTIFICATIONS, getNotificationQueue()),
    OperationalMetricsService.getQueueLatencySummary(QUEUE_NAMES.SYNC_FULL, 60),
    OperationalMetricsService.getQueueLatencySummary(QUEUE_NAMES.SYNC_DELTA, 60),
    OperationalMetricsService.getQueueLatencySummary(QUEUE_NAMES.SCRAPE_HIGH_PRIO, 60),
    OperationalMetricsService.getQueueLatencySummary(QUEUE_NAMES.SCRAPE_LOW_PRIO, 60),
    OperationalMetricsService.getQueueLatencySummary(QUEUE_NAMES.NOTIFICATIONS, 60),
    OperationalMetricsService.getActiveGauge(50),
    new TenantConcurrencyLimiter().getActiveCounters(),
    OperationalMetricsService.getAggregation(60, 15),
    getRedisMetrics(),
  ]);

  const queues = {
    [QUEUE_NAMES.SYNC_FULL]: syncFullSnapshot,
    [QUEUE_NAMES.SYNC_DELTA]: syncDeltaSnapshot,
    [QUEUE_NAMES.SCRAPE_HIGH_PRIO]: scrapeHighSnapshot,
    [QUEUE_NAMES.SCRAPE_LOW_PRIO]: scrapeLowSnapshot,
    [QUEUE_NAMES.NOTIFICATIONS]: notificationQueueSnapshot,
  };

  const activeJobsLive =
    syncFullSnapshot.counts.active +
    syncDeltaSnapshot.counts.active +
    scrapeHighSnapshot.counts.active +
    scrapeLowSnapshot.counts.active +
    notificationQueueSnapshot.counts.active;
  const activeJobs = activeGauge.total > 0 ? activeGauge.total : activeJobsLive;

  const totalScrapeDepth = scrapeHighSnapshot.depth + scrapeLowSnapshot.depth;

  const queueDepth =
    syncFullSnapshot.depth +
    syncDeltaSnapshot.depth +
    totalScrapeDepth +
    notificationQueueSnapshot.depth;

  const queueLatencyP95MsRedis = Math.max(
    syncFullLatency.p95ApproxMs,
    syncDeltaLatency.p95ApproxMs,
    scrapeHighLatency.p95ApproxMs,
    scrapeLowLatency.p95ApproxMs,
    notificationLatency.p95ApproxMs,
  );
  const queueLatencyP95MsLive = Math.max(
    syncFullSnapshot.latencyMs.p95,
    syncDeltaSnapshot.latencyMs.p95,
    scrapeHighSnapshot.latencyMs.p95,
    scrapeLowSnapshot.latencyMs.p95,
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

  const perTenantActive = await Promise.all(
    Array.from(mergedTenantActive.entries())
      .map(async ([tenantId, activeJobs]) => {
        const latency = await OperationalMetricsService.getTenantLatencySummary(tenantId, 60);
        return {
          tenantId,
          tenantName: tenantNameById.get(tenantId) || "Unknown",
          activeJobs,
          avgLatencyMs: latency.avgMs,
        };
      })
  );

  perTenantActive.sort((a, b) => b.activeJobs - a.activeJobs);

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
    redisUsedMb: redisMetrics.memoryMb,
    redisClients: redisMetrics.clients,
  };

  const { alerts, overload } = computeAlerts({
    activeJobs,
    queueDepth,
    queueLatencyP95Ms,
    browserUtilizationPct,
    memoryRssMb: memoryUsage.rssMb,
    blockRatePct: ops.block.blockRatePct,
    retryRatePct: ops.retry.retryRatePct,
    redisClients: redisMetrics.clients,
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
          perTenantActiveJobCount: "Array<{ tenantId, tenantName, activeJobs, avgLatencyMs }>",
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
          redisClients: "number",
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
          [QUEUE_NAMES.SYNC_FULL]: syncFullLatency,
          [QUEUE_NAMES.SYNC_DELTA]: syncDeltaLatency,
          [QUEUE_NAMES.SCRAPE_HIGH_PRIO]: scrapeHighLatency,
          [QUEUE_NAMES.SCRAPE_LOW_PRIO]: scrapeLowLatency,
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
