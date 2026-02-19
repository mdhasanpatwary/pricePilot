import type { JobsOptions, Queue } from "bullmq";

import { logger } from "@/lib/logger";
import { getRedisConnection } from "@/lib/queue/connection";

const QUEUE_DEPTH_METRIC_PREFIX = "pp:queue:depth:rolling:";
const QUEUE_DEPTH_LATEST_KEY = "pp:queue:depth:latest";
const DEFAULT_MAX_QUEUE_DEPTH = 5000;
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

function getMetricWindowMs(): number {
  return parsePositiveInt(process.env.QUEUE_DEPTH_METRIC_WINDOW_MS, DEFAULT_METRIC_WINDOW_MS);
}

function calculateDelayMs(queueDepth: number, threshold: number, minDelayMs: number, maxDelayMs: number): number {
  const overflow = Math.max(1, queueDepth - threshold);
  const linearDelay = minDelayMs + overflow * 250;
  return Math.min(maxDelayMs, linearDelay);
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

export async function enqueueWithBackpressure<TData>(
  queue: Queue,
  name: string,
  data: TData,
  jobOptions: JobsOptions = {},
  decision: QueueBackpressureDecision,
) {
  const strategy = decision.strategy ?? "reject";
  const minDelayMs = parsePositiveInt(String(decision.minDelayMs ?? 5000), 5000);
  const maxDelayMs = parsePositiveInt(String(decision.maxDelayMs ?? 120000), 120000);
  const threshold = getMaxQueueDepth();
  const snapshot = await getQueueDepthSnapshot(queue);

  await recordQueueDepthMetric(queue.name, snapshot.depth);

  if (snapshot.depth > threshold) {
    const context = {
      queue: queue.name,
      producer: decision.producer,
      strategy,
      queueDepth: snapshot.depth,
      threshold,
      ...snapshot.counts,
    };

    logger.warn("[QueueBackpressure] Queue depth exceeded threshold", context);

    if (strategy === "reject") {
      throw new QueueBackpressureError(
        `Queue overloaded (${snapshot.depth}/${threshold}). Please retry shortly.`,
        queue.name,
        snapshot.depth,
        threshold,
      );
    }

    const adaptiveDelayMs = calculateDelayMs(snapshot.depth, threshold, minDelayMs, maxDelayMs);
    const existingDelayMs = Math.max(0, Number(jobOptions.delay ?? 0));
    const delayedOptions: JobsOptions = {
      ...jobOptions,
      delay: existingDelayMs + adaptiveDelayMs,
    };

    logger.info("[QueueBackpressure] Applying enqueue delay due to overload", {
      ...context,
      existingDelayMs,
      adaptiveDelayMs,
      finalDelayMs: delayedOptions.delay,
    });

    return queue.add(name, data as any, delayedOptions);
  }

  return queue.add(name, data as any, jobOptions);
}

