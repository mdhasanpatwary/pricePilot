/**
 * Status Spike Tracker
 *
 * Tracks short-window HTTP 401/403 spikes per competitor website.
 * Used to detect bursts of access denials that suggest a block escalation.
 */
import { getRedisConnection } from "@/lib/queue/connection";

export class StatusSpikeTracker {
  private static readonly KEY_PREFIX = "pp:scrape:status-spike:";

  constructor(
    private readonly config: {
      windowMs: number;
      threshold: number;
    } = { windowMs: 2 * 60 * 1000, threshold: 3 },
  ) {}

  private getKey(competitorWebsiteId: string): string {
    return `${StatusSpikeTracker.KEY_PREFIX}${competitorWebsiteId}`;
  }

  async recordStatus(competitorWebsiteId: string, statusCode: number, at: Date = new Date()): Promise<void> {
    if (statusCode !== 401 && statusCode !== 403) return;

    const redis = getRedisConnection();
    const key = this.getKey(competitorWebsiteId);
    const ts = at.getTime();
    const cutoff = ts - this.config.windowMs;
    const ttlSeconds = Math.max(60, Math.ceil((this.config.windowMs * 3) / 1000));

    // Atomic-ish bounded window:
    // 1) add this event
    // 2) prune old events
    // 3) set TTL for key cleanup
    const tx = redis.multi();
    tx.zadd(key, ts, `${ts}:${Math.random().toString(36).slice(2, 8)}`);
    tx.zremrangebyscore(key, "-inf", cutoff);
    tx.expire(key, ttlSeconds);
    await tx.exec();
  }

  async is403Spike(competitorWebsiteId: string, at: Date = new Date()): Promise<boolean> {
    const redis = getRedisConnection();
    const key = this.getKey(competitorWebsiteId);
    const ts = at.getTime();
    const cutoff = ts - this.config.windowMs;

    const lua = `
      local key = KEYS[1]
      local cutoff = tonumber(ARGV[1])
      local threshold = tonumber(ARGV[2])
      redis.call("ZREMRANGEBYSCORE", key, "-inf", cutoff)
      local count = redis.call("ZCARD", key)
      if count >= threshold then
        return 1
      end
      return 0
    `;

    const result = (await redis.eval(lua, 1, key, cutoff, this.config.threshold)) as number;
    return Number(result) === 1;
  }
}
