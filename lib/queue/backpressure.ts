import type { JobsOptions, Queue } from "bullmq";

import { logger } from "@/lib/logger";
import { OperationalMetricsService } from "@/lib/services/observability/operational-metrics";
import { getRedisConnection } from "@/lib/queue/connection";

const QUEUE_DEPTH_METRIC_PREFIX = "pp:queue:depth:rolling:";
const QUEUE_DEPTH_LATEST_KEY = "pp:queue:depth:latest";
const TENANT_QUEUE_DEPTH_KEY_PREFIX = "pp:queue:tenant:depth:";
const DEFAULT_MAX_QUEUE_DEPTH = 5000;
const DEFAULT_MAX_TENANT_DEPTH = 500;
const DEFAULT_METRIC_WINDOW_MS = 15 * 60 * 1000;

export type QueueBackpressureStrategy = "reject" | "delay";

export interface QueueBackpressureDecision {
  strategy?: QueueBackpressureStrategy;
  producer: string;
  minDelayMs?: number;
  maxDelayMs?: number;
}

export interface QueueDepthSnapshot {
  depth: number; // total jobs *excluding* delayed entries
  counts: {
    waiting: number;
    active: number;
    prioritized: number;
    waitingChildren: number;
    delayed: number; // newly tracked state for debugging/alerts
  };
}

export class QueueBackpressureError extends Error {
  readonly queueName: string;
  readonly queueDepth: number;
  readonly threshold: number;

  constructor(message: string, queueName: string, queueDepth: number, threshold: number) {
    super(message);
    this.name = "QueueBackpressureError";
    this.queueName = queueName;
    this.queueDepth = queueDepth;
    this.threshold = threshold;
  }
}

function parsePositiveInt(input: string | undefined, fallback: number): number {
  const parsed = Number(input);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

function getMaxQueueDepth(): number {
  return parsePositiveInt(process.env.MAX_QUEUE_DEPTH, DEFAULT_MAX_QUEUE_DEPTH);
}

function getMaxTenantQueueDepth(): number {
  return parsePositiveInt(process.env.MAX_TENANT_QUEUE_DEPTH, DEFAULT_MAX_TENANT_DEPTH);
}

function getMetricWindowMs(): number {
  return parsePositiveInt(process.env.QUEUE_DEPTH_METRIC_WINDOW_MS, DEFAULT_METRIC_WINDOW_MS);
}

function getCooldownWindowMs(): number {
  // how long a tenant stays in protected cooldown after a flood incident
  // default 5 minutes
  return parsePositiveInt(process.env.QUEUE_COOLDOWN_WINDOW_MS, 5 * 60 * 1000);
}

function getMaxRepeatDelayCount(): number {
  // number of backpressure-induced delays allowed in the rolling window before
  // we assume an enqueue loop and reject the job.
  return parsePositiveInt(process.env.QUEUE_MAX_REPEAT_DELAY_COUNT, 10);
}

export function calculateDelayMs(depth: number, threshold: number, minDelayMs: number, maxDelayMs: number): number {
  const overflow = Math.max(1, depth - threshold);
  // Exponential backoff for queue depth overflow
  const exponent = Math.min(10, Math.floor(overflow / (threshold / 5)));
  const adaptiveDelay = minDelayMs * Math.pow(1.5, exponent);
  return Math.min(maxDelayMs, adaptiveDelay);
}

async function recordQueueDepthMetric(queueName: string, depth: number): Promise<void> {
  const redis = getRedisConnection();
  const now = Date.now();
  const metricWindowMs = getMetricWindowMs();
  const key = `${QUEUE_DEPTH_METRIC_PREFIX}${queueName}`;
  const member = `${now}:${depth}:${Math.random().toString(36).slice(2, 10)}`;

  await redis
    .multi()
    .zadd(key, now, member)
    .zremrangebyscore(key, 0, now - metricWindowMs)
    .expire(key, Math.max(60, Math.ceil((metricWindowMs * 2) / 1000)))
    .hset(QUEUE_DEPTH_LATEST_KEY, queueName, `${now}:${depth}`)
    .exec();
}

export async function getQueueDepthSnapshot(queue: Queue): Promise<QueueDepthSnapshot> {
  const counts = await queue.getJobCounts(
    "waiting",
    "active",
    "prioritized",
    "waiting-children",
    "delayed",
  );
  const waiting = counts.waiting ?? 0;
  const active = counts.active ?? 0;
  const prioritized = counts.prioritized ?? 0;
  const waitingChildren = counts["waiting-children"] ?? 0;
  const delayed = counts.delayed ?? 0;
  const depth = waiting + active + prioritized + waitingChildren; // intentionally excludes delayed jobs

  return {
    depth,
    counts: { waiting, active, prioritized, waitingChildren, delayed },
  };
}

export async function getTenantQueueDepth(queueName: string, tenantId: string): Promise<number> {
  const redis = getRedisConnection();
  const key = `${TENANT_QUEUE_DEPTH_KEY_PREFIX}${queueName}:${tenantId}`;
  const depth = await redis.get(key);
  return depth ? parseInt(depth, 10) : 0;
}

export async function incrementTenantQueueDepth(queueName: string, tenantId: string): Promise<void> {
  const redis = getRedisConnection();
  const key = `${TENANT_QUEUE_DEPTH_KEY_PREFIX}${queueName}:${tenantId}`;
  await redis.incr(key);
  await redis.expire(key, 3600 * 24); // 24h safety expiry
}

export async function decrementTenantQueueDepth(queueName: string, tenantId: string): Promise<void> {
  const redis = getRedisConnection();
  const key = `${TENANT_QUEUE_DEPTH_KEY_PREFIX}${queueName}:${tenantId}`;
  const val = await redis.decr(key);
  if (val < 0) await redis.set(key, 0); // Correct drift
}

export async function enqueueWithBackpressure<TData extends { tenantId: string }>(
  queue: Queue,
  name: string,
  data: TData,
  jobOptions: JobsOptions = {},
  decision: QueueBackpressureDecision,
) {
  // phase‑2 hardening: require an explicit tenantId, no fallbacks allowed
  if (!data || typeof data.tenantId !== "string" || data.tenantId.trim() === "") {
    throw new Error("enqueueWithBackpressure requires a valid tenantId on job data");
  }
  const tenantId = data.tenantId;
  const minDelayMs = parsePositiveInt(String(decision.minDelayMs ?? 1000), 1000);
  const maxDelayMs = parsePositiveInt(String(decision.maxDelayMs ?? 300000), 300000); // 5 min max

  const globalThreshold = getMaxQueueDepth();
  const tenantThreshold = getMaxTenantQueueDepth();

  const globalSnapshot = await getQueueDepthSnapshot(queue);
  const tenantDepth = await getTenantQueueDepth(queue.name, tenantId);

  await recordQueueDepthMetric(queue.name, globalSnapshot.depth);

  // phase‑2 enhancement: enforce cooldown window if previously flooded
  const redis = getRedisConnection();
  const cooldownKey = `pp:queue:cooldown:${queue.name}:${tenantId}`;
  const inCooldown = await redis.ttl(cooldownKey);
  if (inCooldown > 0) {
    logger.warn("[QueueBackpressure] Tenant in cooldown", {
      queue: queue.name,
      tenantId,
      remainingMs: inCooldown * 1000,
    });
    void OperationalMetricsService.recordQueueLifecycle(queue.name, "cooldown", tenantId);
    if (decision.strategy === "reject") {
      throw new QueueBackpressureError(
        `Tenant ${tenantId} is in cooldown`,
        queue.name,
        globalSnapshot.depth,
        globalThreshold,
      );
    } else {
      jobOptions.delay = (jobOptions.delay || 0) + maxDelayMs;
    }
  }

  // 1. Global Backpressure
  if (globalSnapshot.depth > globalThreshold) {
    logger.warn("[QueueBackpressure] Global queue depth exceeded", {
      queue: queue.name,
      depth: globalSnapshot.depth,
      threshold: globalThreshold,
    });
    // Global overflow always uses delay to avoid dropping data
    const delay = calculateDelayMs(globalSnapshot.depth, globalThreshold, minDelayMs, maxDelayMs);
    jobOptions.delay = (jobOptions.delay || 0) + delay;
  }

  // 2. Tenant FAIR-SHARE Backpressure
  if (tenantDepth > tenantThreshold) {
    logger.info("[QueueBackpressure] Tenant fair-share depth exceeded", {
      queue: queue.name,
      tenantId,
      depth: tenantDepth,
      threshold: tenantThreshold,
    });

    // Apply exponential delay for the specific tenant
    const tenantDelay = calculateDelayMs(tenantDepth, tenantThreshold, minDelayMs * 2, maxDelayMs);
    jobOptions.delay = (jobOptions.delay || 0) + tenantDelay;
  }

  // 3. Flood Detection (Phase 8)
  const isCriticalDepth = globalSnapshot.depth > globalThreshold * 0.8;
  const isDominating = tenantDepth > Math.max(10, globalSnapshot.depth * 0.5);

  if (isCriticalDepth && isDominating) {
    logger.warn(`[QueueBackpressure] Flood detected for tenant ${tenantId} on queue ${queue.name}`);

    // Lazy import to avoid circular dependency
    void import("@/lib/services/monitoring/monitoring-service").then(({ MonitoringService }) => {
       MonitoringService.recordTenantFlood(queue.name, tenantId, tenantDepth);
    });

    // place tenant into cooldown window
    await redis.set(cooldownKey, "1", "PX", getCooldownWindowMs());

    if (decision.strategy === "reject") {
       throw new QueueBackpressureError(
         `Queue flooded by tenant ${tenantId}`,
         queue.name,
         globalSnapshot.depth,
         globalThreshold
       );
    } else {
       // Extreme delay to force tenant to back off
       jobOptions.delay = (jobOptions.delay || 0) + maxDelayMs;
    }
  }

  // 4. repeated-delay guard: if this job has been delayed too often in a short
  // window we assume the producer is stuck in a loop and reject it.
  if (jobOptions.delay && jobOptions.delay > 0) {
    const delayKey = `pp:queue:delays:${queue.name}:${tenantId}`;
    const repeat = await redis.incr(delayKey);
    await redis.expire(delayKey, 60); // 1-minute window
    if (repeat > getMaxRepeatDelayCount()) {
      logger.warn("[QueueBackpressure] Repeated backpressure loop detected", {
        queue: queue.name,
        tenantId,
        count: repeat,
      });
      throw new QueueBackpressureError(
        `Repeated delay loop for tenant ${tenantId}`,
        queue.name,
        globalSnapshot.depth,
        globalThreshold,
      );
    }
  }

  // Inject groupId for BullMQ fairness
  (jobOptions as any).removeOnComplete = jobOptions.removeOnComplete ?? true;
  const finalOptions: JobsOptions = {
    ...jobOptions,
    groupId: tenantId,
  } as any;

  const job = await queue.add(name, data as any, finalOptions);

  // record lifecycle events: queued and possibly delayed
  void OperationalMetricsService.recordQueueLifecycle(queue.name, "queued", tenantId);
  if (finalOptions.delay && finalOptions.delay > 0) {
    void OperationalMetricsService.recordQueueLifecycle(queue.name, "delayed", tenantId);
  }

  // Track tenant depth (increment on add)
  await incrementTenantQueueDepth(queue.name, tenantId);

  return job;
}

