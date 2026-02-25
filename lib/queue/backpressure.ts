import type { JobsOptions, Queue } from "bullmq";

import { logger } from "@/lib/logger";
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
  depth: number;
  counts: {
    waiting: number;
    active: number;
    prioritized: number;
    waitingChildren: number;
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

function calculateDelayMs(depth: number, threshold: number, minDelayMs: number, maxDelayMs: number): number {
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
  const counts = await queue.getJobCounts("waiting", "active", "prioritized", "waiting-children");
  const waiting = counts.waiting ?? 0;
  const active = counts.active ?? 0;
  const prioritized = counts.prioritized ?? 0;
  const waitingChildren = counts["waiting-children"] ?? 0;
  const depth = waiting + active + prioritized + waitingChildren;

  return {
    depth,
    counts: { waiting, active, prioritized, waitingChildren },
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

export async function enqueueWithBackpressure<TData extends { tenantId?: string }>(
  queue: Queue,
  name: string,
  data: TData,
  jobOptions: JobsOptions = {},
  decision: QueueBackpressureDecision,
) {
  const tenantId = data.tenantId || "system";
  const minDelayMs = parsePositiveInt(String(decision.minDelayMs ?? 1000), 1000);
  const maxDelayMs = parsePositiveInt(String(decision.maxDelayMs ?? 300000), 300000); // 5 min max

  const globalThreshold = getMaxQueueDepth();
  const tenantThreshold = getMaxTenantQueueDepth();

  const globalSnapshot = await getQueueDepthSnapshot(queue);
  const tenantDepth = await getTenantQueueDepth(queue.name, tenantId);

  await recordQueueDepthMetric(queue.name, globalSnapshot.depth);

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

  // Inject groupId for BullMQ fairness
  (jobOptions as any).removeOnComplete = jobOptions.removeOnComplete ?? true;
  const finalOptions: JobsOptions = {
    ...jobOptions,
    groupId: tenantId,
  } as any;

  const job = await queue.add(name, data as any, finalOptions);

  // Track tenant depth (increment on add)
  await incrementTenantQueueDepth(queue.name, tenantId);

  return job;
}

