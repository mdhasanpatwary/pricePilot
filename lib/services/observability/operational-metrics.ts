import { getRedisConnection } from "@/lib/queue/connection";
import { logger } from "@/lib/logger";

const METRIC_PREFIX = "pp:ops:metric:minute:";
const DOMAIN_BLOCK_PREFIX = "pp:ops:block:minute:";
const ACTIVE_GAUGE_KEY = "pp:ops:gauge:active";
const RETENTION_SECONDS = 7 * 24 * 60 * 60;

export type QueueLifecycleEvent =
  | "queued"
  | "active"
  | "delayed"
  | "retrying"
  | "completed"
  | "failed"
  | "failed_terminal"
  | "dead_letter"
  | "cooldown";
export type RetryEvent = "enqueued" | "claimed" | "success" | "requeued" | "failed";

interface RetrySummary {
  enqueued: number;
  claimed: number;
  success: number;
  requeued: number;
  failed: number;
  totalOutcomes: number;
  retryRatePct: number;
  failureRatePct: number;
}

interface DomainBlockRate {
  domain: string;
  total: number;
  blocked: number;
  blockRatePct: number;
}

interface OpsAggregation {
  windowMinutes: number;
  retry: RetrySummary;
  block: {
    total: number;
    blocked: number;
    blockRatePct: number;
    domains: DomainBlockRate[];
  };
}

export interface QueueLatencySummary {
  avgMs: number;
  maxMs: number;
  p95ApproxMs: number;
  count: number;
}

export interface ActiveGaugeSnapshot {
  total: number;
  byQueue: Record<string, number>;
  byTenant: Array<{ tenantId: string; activeJobs: number }>;
}

const toNumber = (value: unknown): number => {
  const n = Number(value || 0);
  return Number.isFinite(n) ? n : 0;
};

function bucketNow(): number {
  return Math.floor(Date.now() / 60_000);
}

function metricKey(bucket: number): string {
  return `${METRIC_PREFIX}${bucket}`;
}

function domainBlockKey(bucket: number): string {
  return `${DOMAIN_BLOCK_PREFIX}${bucket}`;
}

function normalizeDomain(domain: string): string {
  return (domain || "").trim().toLowerCase().replace(/^www\./, "");
}

async function incrFields(
  key: string,
  fields: Array<[string, number]>,
): Promise<void> {
  const redis = getRedisConnection();
  const tx = redis.multi();
  for (const [field, amount] of fields) {
    tx.hincrby(key, field, amount);
  }
  tx.expire(key, RETENTION_SECONDS);
  await tx.exec();
}

export class OperationalMetricsService {
  static async recordQueueLifecycle(
    queueName: string,
    event: QueueLifecycleEvent,
    tenantId?: string,
    queueLatencyMs?: number,
  ): Promise<void> {
    try {
      const bucket = bucketNow();
      const key = metricKey(bucket);
      const fields: Array<[string, number]> = [
        ["queue:lifecycle:total", 1],
        [`queue:${queueName}:${event}`, 1],
      ];

      if (tenantId) {
        fields.push([`queue:${queueName}:tenant:${tenantId}:${event}`, 1]);
      }

      if (event === "active" && Number.isFinite(queueLatencyMs) && (queueLatencyMs || 0) >= 0) {
        // Track latency
        if (queueLatencyMs !== undefined) {
          const latency = Math.floor(queueLatencyMs);
          fields.push([`queue:${queueName}:latency:count`, 1]);
          fields.push([`queue:${queueName}:latency:sumMs`, latency]);

          if (latency <= 1000) fields.push([`queue:${queueName}:latency:le:1000`, 1]);
          else if (latency <= 5000) fields.push([`queue:${queueName}:latency:le:5000`, 1]);
          else if (latency <= 15000) fields.push([`queue:${queueName}:latency:le:15000`, 1]);
          else if (latency <= 60000) fields.push([`queue:${queueName}:latency:le:60000`, 1]);
          else fields.push([`queue:${queueName}:latency:gt:60000`, 1]);

          if (tenantId) {
            fields.push([`tenant:${tenantId}:latency:count`, 1]);
            fields.push([`tenant:${tenantId}:latency:sumMs`, latency]);
          }
        }
      }

      await incrFields(key, fields);
      // only certain events should affect the active‑job gauge
      if (["active", "completed", "failed", "failed_terminal", "dead_letter"].includes(event)) {
        await this.adjustActiveGauge(queueName, event, tenantId);
      }
    } catch (error) {
      logger.debug("[OperationalMetrics] Failed to record queue lifecycle", {
        queueName,
        event,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private static async adjustActiveGauge(
    queueName: string,
    event: QueueLifecycleEvent,
    tenantId?: string,
  ): Promise<void> {
    // delta only increments for active; all other tracked lifecycle transitions that
    // reach this helper are effectively a job leaving the active state
    const delta = event === "active" ? 1 : -1;
    const redis = getRedisConnection();
    const lua = `
      local key = KEYS[1]
      local totalField = ARGV[1]
      local queueField = ARGV[2]
      local tenantField = ARGV[3]
      local delta = tonumber(ARGV[4])
      local ttl = tonumber(ARGV[5])

      local function adjust(field)
        if field == "" then return end
        local current = tonumber(redis.call("HGET", key, field) or "0")
        local nextValue = current + delta
        if nextValue < 0 then nextValue = 0 end
        redis.call("HSET", key, field, nextValue)
      end

      adjust(totalField)
      adjust(queueField)
      adjust(tenantField)
      redis.call("EXPIRE", key, ttl)
      return 1
    `;

    await redis.eval(
      lua,
      1,
      ACTIVE_GAUGE_KEY,
      "total",
      `queue:${queueName}`,
      tenantId ? `tenant:${tenantId}` : "",
      delta,
      RETENTION_SECONDS,
    );
  }

  static async recordRetryEvent(event: RetryEvent, amount: number = 1): Promise<void> {
    try {
      if (!Number.isFinite(amount) || amount <= 0) return;
      const bucket = bucketNow();
      const key = metricKey(bucket);
      await incrFields(key, [[`retry:${event}`, Math.floor(amount)]]);
    } catch (error) {
      logger.debug("[OperationalMetrics] Failed to record retry metric", {
        event,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Record the current length of a queue that is being used as a DLQ.
   */
  static async recordDLQLength(queueName: string, length: number): Promise<void> {
    try {
      const bucket = bucketNow();
      const key = metricKey(bucket);
      await incrFields(key, [[`dlq:${queueName}:length`, length]]);
    } catch (error) {
      logger.debug("[OperationalMetrics] Failed to record DLQ length", {
        queueName,
        length,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  static async recordDomainAttempt(domain: string, blocked: boolean): Promise<void> {
    try {
      const normalized = normalizeDomain(domain);
      if (!normalized) return;

      const bucket = bucketNow();
      const key = metricKey(bucket);
      const domainKeyName = domainBlockKey(bucket);
      const totalField = `d|${normalized}|t`;
      const blockedField = `d|${normalized}|b`;

      const redis = getRedisConnection();
      const tx = redis.multi();

      tx.hincrby(key, "block:total", 1);
      if (blocked) {
        tx.hincrby(key, "block:blocked", 1);
      }
      tx.expire(key, RETENTION_SECONDS);

      tx.hincrby(domainKeyName, totalField, 1);
      if (blocked) {
        tx.hincrby(domainKeyName, blockedField, 1);
      }
      tx.expire(domainKeyName, RETENTION_SECONDS);

      await tx.exec();
    } catch (error) {
      logger.debug("[OperationalMetrics] Failed to record domain block metric", {
        domain,
        blocked,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  static async getAggregation(windowMinutes: number = 60, topDomains: number = 10): Promise<OpsAggregation> {
    const minutes = Math.max(1, Math.min(24 * 60, Math.floor(windowMinutes)));
    const nowBucket = bucketNow();
    const redis = getRedisConnection();

    const metricKeys: string[] = [];
    const domainKeys: string[] = [];
    const pipeline = redis.pipeline();

    for (let offset = 0; offset < minutes; offset += 1) {
      const bucket = nowBucket - offset;
      const mKey = metricKey(bucket);
      const dKey = domainBlockKey(bucket);
      metricKeys.push(mKey);
      domainKeys.push(dKey);
      pipeline.hgetall(mKey);
      pipeline.hgetall(dKey);
    }

    const results = await pipeline.exec();

    let blockTotal = 0;
    let blockBlocked = 0;
    let retryEnqueued = 0;
    let retryClaimed = 0;
    let retrySuccess = 0;
    let retryRequeued = 0;
    let retryFailed = 0;

    const domainTotals = new Map<string, { total: number; blocked: number }>();

    for (let i = 0; i < minutes; i += 1) {
      const metricRow = results?.[i * 2];
      const domainRow = results?.[i * 2 + 1];

      if (metricRow && !metricRow[0] && metricRow[1] && typeof metricRow[1] === "object") {
        const hash = metricRow[1] as Record<string, string>;
        blockTotal += toNumber(hash["block:total"]);
        blockBlocked += toNumber(hash["block:blocked"]);

        retryEnqueued += toNumber(hash["retry:enqueued"]);
        retryClaimed += toNumber(hash["retry:claimed"]);
        retrySuccess += toNumber(hash["retry:success"]);
        retryRequeued += toNumber(hash["retry:requeued"]);
        retryFailed += toNumber(hash["retry:failed"]);
      }

      if (domainRow && !domainRow[0] && domainRow[1] && typeof domainRow[1] === "object") {
        const hash = domainRow[1] as Record<string, string>;
        for (const [field, raw] of Object.entries(hash)) {
          if (!field.startsWith("d|")) continue;
          const parts = field.split("|");
          if (parts.length !== 3) continue;
          const domain = parts[1];
          const kind = parts[2];
          const value = toNumber(raw);

          const current = domainTotals.get(domain) || { total: 0, blocked: 0 };
          if (kind === "t") current.total += value;
          if (kind === "b") current.blocked += value;
          domainTotals.set(domain, current);
        }
      }
    }

    const retryTotalOutcomes = retrySuccess + retryFailed + retryRequeued;

    const retry: RetrySummary = {
      enqueued: retryEnqueued,
      claimed: retryClaimed,
      success: retrySuccess,
      requeued: retryRequeued,
      failed: retryFailed,
      totalOutcomes: retryTotalOutcomes,
      retryRatePct:
        retryTotalOutcomes > 0 ? Math.round((retryRequeued / retryTotalOutcomes) * 1000) / 10 : 0,
      failureRatePct:
        retryTotalOutcomes > 0 ? Math.round((retryFailed / retryTotalOutcomes) * 1000) / 10 : 0,
    };

    const domains: DomainBlockRate[] = Array.from(domainTotals.entries())
      .map(([domain, counts]) => ({
        domain,
        total: counts.total,
        blocked: counts.blocked,
        blockRatePct: counts.total > 0 ? Math.round((counts.blocked / counts.total) * 1000) / 10 : 0,
      }))
      .filter((row) => row.total > 0)
      .sort((a, b) => b.blockRatePct - a.blockRatePct)
      .slice(0, Math.max(1, topDomains));

    return {
      windowMinutes: minutes,
      retry,
      block: {
        total: blockTotal,
        blocked: blockBlocked,
        blockRatePct: blockTotal > 0 ? Math.round((blockBlocked / blockTotal) * 1000) / 10 : 0,
        domains,
      },
    };
  }

  static async getQueueLatencySummary(queueName: string, windowMinutes: number = 60): Promise<QueueLatencySummary> {
    const minutes = Math.max(1, Math.min(24 * 60, Math.floor(windowMinutes)));
    const nowBucket = bucketNow();
    const redis = getRedisConnection();
    const pipeline = redis.pipeline();

    for (let offset = 0; offset < minutes; offset += 1) {
      pipeline.hgetall(metricKey(nowBucket - offset));
    }

    const results = await pipeline.exec();

    let count = 0;
    let sumMs = 0;
    let le1000 = 0;
    let le5000 = 0;
    let le15000 = 0;
    let le60000 = 0;
    let gt60000 = 0;

    for (const row of results || []) {
      if (!row || row[0] || !row[1] || typeof row[1] !== "object") continue;
      const hash = row[1] as Record<string, string>;
      count += toNumber(hash[`queue:${queueName}:latency:count`]);
      sumMs += toNumber(hash[`queue:${queueName}:latency:sumMs`]);

      le1000 += toNumber(hash[`queue:${queueName}:latency:le:1000`]);
      le5000 += toNumber(hash[`queue:${queueName}:latency:le:5000`]);
      le15000 += toNumber(hash[`queue:${queueName}:latency:le:15000`]);
      le60000 += toNumber(hash[`queue:${queueName}:latency:le:60000`]);
      gt60000 += toNumber(hash[`queue:${queueName}:latency:gt:60000`]);
    }

    const avgMs = count > 0 ? Math.floor(sumMs / count) : 0;
    const maxMs =
      gt60000 > 0 ? 60001 : le60000 > 0 ? 60000 : le15000 > 0 ? 15000 : le5000 > 0 ? 5000 : le1000 > 0 ? 1000 : 0;

    const c1 = le1000;
    const c2 = c1 + le5000;
    const c3 = c2 + le15000;
    const c4 = c3 + le60000;
    const c5 = c4 + gt60000;
    const target = Math.ceil(c5 * 0.95);

    let p95ApproxMs = 0;
    if (target <= c1) p95ApproxMs = 1000;
    else if (target <= c2) p95ApproxMs = 5000;
    else if (target <= c3) p95ApproxMs = 15000;
    else if (target <= c4) p95ApproxMs = 60000;
    else if (target <= c5) p95ApproxMs = 60001;

    return {
      avgMs,
      maxMs,
      p95ApproxMs,
      count,
    };
  }

  static async getTenantLatencySummary(tenantId: string, windowMinutes: number = 60): Promise<{ avgMs: number; count: number }> {
    const minutes = Math.max(1, Math.min(24 * 60, Math.floor(windowMinutes)));
    const nowBucket = bucketNow();
    const redis = getRedisConnection();
    const pipeline = redis.pipeline();

    for (let offset = 0; offset < minutes; offset += 1) {
      pipeline.hgetall(metricKey(nowBucket - offset));
    }

    const results = await pipeline.exec();
    let count = 0;
    let sumMs = 0;

    for (const row of results || []) {
      if (!row || row[0] || !row[1] || typeof row[1] !== "object") continue;
      const hash = row[1] as Record<string, string>;
      count += toNumber(hash[`tenant:${tenantId}:latency:count`]);
      sumMs += toNumber(hash[`tenant:${tenantId}:latency:sumMs`]);
    }

    const avgMs = count > 0 ? Math.floor(sumMs / count) : 0;

    return { avgMs, count };
  }

  static async getActiveGauge(topTenants: number = 20): Promise<ActiveGaugeSnapshot> {
    const redis = getRedisConnection();
    const hash = await redis.hgetall(ACTIVE_GAUGE_KEY);

    const byQueue: Record<string, number> = {};
    const byTenantRaw: Array<{ tenantId: string; activeJobs: number }> = [];
    let total = toNumber((hash as Record<string, string>)["total"]);

    for (const [field, raw] of Object.entries(hash as Record<string, string>)) {
      if (field.startsWith("queue:")) {
        byQueue[field.slice("queue:".length)] = toNumber(raw);
      } else if (field.startsWith("tenant:")) {
        byTenantRaw.push({
          tenantId: field.slice("tenant:".length),
          activeJobs: toNumber(raw),
        });
      }
    }

    if (!Number.isFinite(total) || total < 0) {
      total = Object.values(byQueue).reduce((acc, n) => acc + toNumber(n), 0);
    }

    const byTenant = byTenantRaw
      .filter((row) => row.activeJobs > 0)
      .sort((a, b) => b.activeJobs - a.activeJobs)
      .slice(0, Math.max(1, topTenants));

    return {
      total,
      byQueue,
      byTenant,
    };
  }
}
