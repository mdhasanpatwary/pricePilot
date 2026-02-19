import { getRedisConnection } from "@/lib/queue/connection";
import { logger } from "@/lib/logger";

export interface GlobalScrapePermit {
  token: string;
  leaseTtlMs: number;
}

export interface GlobalAcquireResult {
  acquired: boolean;
  currentActive: number;
  retryAfterMs?: number;
  permit?: GlobalScrapePermit;
}

export interface GlobalQpsResult {
  allowed: boolean;
  remainingTokens: number;
  retryAfterMs: number;
}

export class GlobalScrapeBudgetService {
  private static instance: GlobalScrapeBudgetService;

  private static readonly ACTIVE_KEY = "global:scrape:active";
  private static readonly LEASES_KEY = "global:scrape:leases";
  private static readonly QPS_KEY = "global:scrape:qps";

  private constructor() {}

  static getInstance(): GlobalScrapeBudgetService {
    if (!GlobalScrapeBudgetService.instance) {
      GlobalScrapeBudgetService.instance = new GlobalScrapeBudgetService();
    }
    return GlobalScrapeBudgetService.instance;
  }

  getMaxActive(): number {
    const raw = Number(process.env.GLOBAL_MAX_ACTIVE || "10");
    return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : 10;
  }

  getLeaseTtlMs(): number {
    const raw = Number(process.env.GLOBAL_SCRAPE_LEASE_TTL_MS || "180000");
    return Number.isFinite(raw) && raw >= 30_000 ? Math.floor(raw) : 180_000;
  }

  getRequeueDelayMs(): number {
    const raw = Number(process.env.GLOBAL_SCRAPE_REQUEUE_DELAY_MS || "2000");
    return Number.isFinite(raw) && raw >= 500 ? Math.floor(raw) : 2000;
  }

  getQpsLimit(): number {
    const raw = Number(process.env.GLOBAL_SCRAPE_MAX_QPS || "0");
    if (!Number.isFinite(raw) || raw <= 0) return 0;
    return raw;
  }

  getQpsBurst(): number {
    const qps = this.getQpsLimit();
    const raw = Number(process.env.GLOBAL_SCRAPE_QPS_BURST || String(Math.max(1, Math.ceil(qps))));
    if (!Number.isFinite(raw) || raw <= 0) return Math.max(1, Math.ceil(qps || 1));
    return raw;
  }

  private buildToken(productId?: string): string {
    const suffix = Math.random().toString(36).slice(2, 10);
    return `${process.pid}:${Date.now()}:${productId || "unknown"}:${suffix}`;
  }

  async acquire(productId?: string): Promise<GlobalAcquireResult> {
    const redis = getRedisConnection();
    const maxActive = this.getMaxActive();
    const leaseTtlMs = this.getLeaseTtlMs();
    const nowMs = Date.now();
    const expiresAtMs = nowMs + leaseTtlMs;
    const token = this.buildToken(productId);
    const activeTtlMs = Math.max(leaseTtlMs * 3, 60_000);

    const lua = `
      local activeKey = KEYS[1]
      local leasesKey = KEYS[2]
      local nowMs = tonumber(ARGV[1])
      local expiresAtMs = tonumber(ARGV[2])
      local maxActive = tonumber(ARGV[3])
      local token = ARGV[4]
      local activeTtlMs = tonumber(ARGV[5])

      local expiredTokens = redis.call("ZRANGEBYSCORE", leasesKey, 0, nowMs)
      local expiredCount = #expiredTokens

      if expiredCount > 0 then
        redis.call("ZREMRANGEBYSCORE", leasesKey, 0, nowMs)
        local currentActive = tonumber(redis.call("GET", activeKey) or "0")
        local nextActive = currentActive - expiredCount
        if nextActive < 0 then
          nextActive = 0
        end
        if nextActive == 0 then
          redis.call("DEL", activeKey)
        else
          redis.call("SET", activeKey, tostring(nextActive), "PX", activeTtlMs)
        end
      end

      local active = tonumber(redis.call("GET", activeKey) or "0")
      if active >= maxActive then
        return {0, active}
      end

      active = redis.call("INCR", activeKey)
      redis.call("PEXPIRE", activeKey, activeTtlMs)
      redis.call("ZADD", leasesKey, expiresAtMs, token)
      redis.call("PEXPIRE", leasesKey, activeTtlMs)

      return {1, active}
    `;

    const raw = (await redis.eval(
      lua,
      2,
      GlobalScrapeBudgetService.ACTIVE_KEY,
      GlobalScrapeBudgetService.LEASES_KEY,
      nowMs,
      expiresAtMs,
      maxActive,
      token,
      activeTtlMs,
    )) as unknown;

    const arr = Array.isArray(raw) ? raw : [];
    const acquired = Number(arr[0] || 0) === 1;
    const currentActive = Number(arr[1] || 0);

    if (!acquired) {
      return {
        acquired: false,
        currentActive,
        retryAfterMs: this.getRequeueDelayMs(),
      };
    }

    return {
      acquired: true,
      currentActive,
      permit: {
        token,
        leaseTtlMs,
      },
    };
  }

  async refresh(permit: GlobalScrapePermit): Promise<void> {
    const redis = getRedisConnection();
    const nowMs = Date.now();
    const newExpiresAtMs = nowMs + permit.leaseTtlMs;
    const activeTtlMs = Math.max(permit.leaseTtlMs * 3, 60_000);

    const lua = `
      local activeKey = KEYS[1]
      local leasesKey = KEYS[2]
      local token = ARGV[1]
      local newExpiresAtMs = tonumber(ARGV[2])
      local activeTtlMs = tonumber(ARGV[3])

      local exists = redis.call("ZSCORE", leasesKey, token)
      if not exists then
        return 0
      end

      redis.call("ZADD", leasesKey, newExpiresAtMs, token)
      redis.call("PEXPIRE", leasesKey, activeTtlMs)

      local active = tonumber(redis.call("GET", activeKey) or "0")
      if active > 0 then
        redis.call("PEXPIRE", activeKey, activeTtlMs)
      end

      return 1
    `;

    await redis
      .eval(
        lua,
        2,
        GlobalScrapeBudgetService.ACTIVE_KEY,
        GlobalScrapeBudgetService.LEASES_KEY,
        permit.token,
        newExpiresAtMs,
        activeTtlMs,
      )
      .catch((error) => {
        logger.warn("[GlobalScrapeBudget] Failed to refresh global permit lease", {
          token: permit.token,
          error: error instanceof Error ? error.message : String(error),
        });
      });
  }

  async release(permit: GlobalScrapePermit): Promise<void> {
    const redis = getRedisConnection();
    const activeTtlMs = Math.max(permit.leaseTtlMs * 3, 60_000);

    const lua = `
      local activeKey = KEYS[1]
      local leasesKey = KEYS[2]
      local token = ARGV[1]
      local activeTtlMs = tonumber(ARGV[2])

      local removed = redis.call("ZREM", leasesKey, token)
      if removed == 1 then
        local active = tonumber(redis.call("GET", activeKey) or "0")
        if active <= 1 then
          redis.call("DEL", activeKey)
          return 0
        end

        local nextActive = redis.call("DECR", activeKey)
        if tonumber(nextActive) <= 0 then
          redis.call("DEL", activeKey)
          return 0
        end
        redis.call("PEXPIRE", activeKey, activeTtlMs)
        return tonumber(nextActive)
      end

      return tonumber(redis.call("GET", activeKey) or "0")
    `;

    await redis
      .eval(
        lua,
        2,
        GlobalScrapeBudgetService.ACTIVE_KEY,
        GlobalScrapeBudgetService.LEASES_KEY,
        permit.token,
        activeTtlMs,
      )
      .catch((error) => {
        logger.warn("[GlobalScrapeBudget] Failed to release global permit", {
          token: permit.token,
          error: error instanceof Error ? error.message : String(error),
        });
      });
  }

  async cleanupStaleLeases(): Promise<number> {
    const redis = getRedisConnection();
    const nowMs = Date.now();
    const activeTtlMs = Math.max(this.getLeaseTtlMs() * 3, 60_000);

    const lua = `
      local activeKey = KEYS[1]
      local leasesKey = KEYS[2]
      local nowMs = tonumber(ARGV[1])
      local activeTtlMs = tonumber(ARGV[2])

      local expiredTokens = redis.call("ZRANGEBYSCORE", leasesKey, 0, nowMs)
      local expiredCount = #expiredTokens

      if expiredCount <= 0 then
        return 0
      end

      redis.call("ZREMRANGEBYSCORE", leasesKey, 0, nowMs)
      local currentActive = tonumber(redis.call("GET", activeKey) or "0")
      local nextActive = currentActive - expiredCount
      if nextActive < 0 then
        nextActive = 0
      end
      if nextActive == 0 then
        redis.call("DEL", activeKey)
      else
        redis.call("SET", activeKey, tostring(nextActive), "PX", activeTtlMs)
      end

      return expiredCount
    `;

    const cleaned = Number(
      (await redis.eval(
        lua,
        2,
        GlobalScrapeBudgetService.ACTIVE_KEY,
        GlobalScrapeBudgetService.LEASES_KEY,
        nowMs,
        activeTtlMs,
      )) || 0,
    );

    if (cleaned > 0) {
      logger.warn("[GlobalScrapeBudget] Cleaned stale global scrape permits", { cleaned });
    }

    return cleaned;
  }

  async consumeQpsToken(): Promise<GlobalQpsResult> {
    const qps = this.getQpsLimit();
    if (qps <= 0) {
      return {
        allowed: true,
        remainingTokens: Number.POSITIVE_INFINITY,
        retryAfterMs: 0,
      };
    }

    const burst = Math.max(1, this.getQpsBurst());
    const nowMs = Date.now();
    const ttlMs = Math.max(5000, Math.ceil((burst / qps) * 4000));
    const redis = getRedisConnection();

    const lua = `
      local key = KEYS[1]
      local nowMs = tonumber(ARGV[1])
      local refillPerSec = tonumber(ARGV[2])
      local capacity = tonumber(ARGV[3])
      local ttlMs = tonumber(ARGV[4])

      local tokens = tonumber(redis.call("HGET", key, "tokens"))
      local lastMs = tonumber(redis.call("HGET", key, "lastMs"))

      if not tokens then
        tokens = capacity
        lastMs = nowMs
      end

      local elapsedMs = math.max(0, nowMs - lastMs)
      local refill = (elapsedMs / 1000.0) * refillPerSec
      tokens = math.min(capacity, tokens + refill)

      local allowed = 0
      local waitMs = 0

      if tokens >= 1 then
        tokens = tokens - 1
        allowed = 1
      else
        waitMs = math.ceil(((1 - tokens) / refillPerSec) * 1000)
      end

      redis.call("HSET", key, "tokens", tokens, "lastMs", nowMs)
      redis.call("PEXPIRE", key, ttlMs)

      return {allowed, math.floor(tokens), waitMs}
    `;

    const raw = (await redis.eval(
      lua,
      1,
      GlobalScrapeBudgetService.QPS_KEY,
      nowMs,
      qps,
      burst,
      ttlMs,
    )) as unknown;

    const arr = Array.isArray(raw) ? raw : [];
    return {
      allowed: Number(arr[0] || 0) === 1,
      remainingTokens: Number(arr[1] || 0),
      retryAfterMs: Math.max(0, Number(arr[2] || 0)),
    };
  }
}
