import { getRedisConnection } from "@/lib/queue/connection";
import { logger } from "@/lib/logger";

export interface TenantConcurrencyPermit {
  tenantId: string;
  key: string;
}

export interface TenantActiveCounter {
  tenantId: string;
  active: number;
}

export interface TenantConcurrencyLimiterConfig {
  maxPerTenant: number;
  leaseTtlMs: number;
}

export class TenantConcurrencyLimiter {
  private readonly config: TenantConcurrencyLimiterConfig;
  private static readonly KEY_PREFIX = "pp:tenant:scrape:active:";

  constructor(config?: Partial<TenantConcurrencyLimiterConfig>) {
    const maxPerTenantRaw = Number(process.env.SCRAPE_MAX_CONCURRENT_PER_TENANT || "2");
    const leaseTtlRaw = Number(process.env.SCRAPE_TENANT_CONCURRENCY_LEASE_TTL_MS || "180000");

    const maxPerTenantDefault =
      Number.isFinite(maxPerTenantRaw) && maxPerTenantRaw > 0 ? Math.floor(maxPerTenantRaw) : 2;
    const leaseTtlDefault =
      Number.isFinite(leaseTtlRaw) && leaseTtlRaw >= 30_000 ? Math.floor(leaseTtlRaw) : 180_000;

    this.config = {
      maxPerTenant: config?.maxPerTenant ?? maxPerTenantDefault,
      leaseTtlMs: config?.leaseTtlMs ?? leaseTtlDefault,
    };
  }

  getMaxPerTenant(): number {
    return this.config.maxPerTenant;
  }

  getLeaseTtlMs(): number {
    return this.config.leaseTtlMs;
  }

  getKey(tenantId: string): string {
    return `${TenantConcurrencyLimiter.KEY_PREFIX}${tenantId}`;
  }

  async getActiveCounters(): Promise<TenantActiveCounter[]> {
    const redis = getRedisConnection();
    const pattern = `${TenantConcurrencyLimiter.KEY_PREFIX}*`;
    let cursor = "0";
    const keys: string[] = [];

    do {
      const result = (await redis.scan(cursor, "MATCH", pattern, "COUNT", 200)) as [string, string[]];
      cursor = result[0];
      keys.push(...result[1]);
    } while (cursor !== "0");

    if (keys.length === 0) {
      return [];
    }

    const values = await redis.mget(...keys);
    const counters: TenantActiveCounter[] = [];

    for (let i = 0; i < keys.length; i++) {
      const key = keys[i];
      const rawValue = values[i];
      const active = Number(rawValue || "0");

      if (!Number.isFinite(active) || active <= 0) {
        continue;
      }

      const tenantId = key.startsWith(TenantConcurrencyLimiter.KEY_PREFIX)
        ? key.slice(TenantConcurrencyLimiter.KEY_PREFIX.length)
        : key;
      counters.push({ tenantId, active: Math.floor(active) });
    }

    counters.sort((a, b) => b.active - a.active);
    return counters;
  }

  async tryAcquire(tenantId: string): Promise<TenantConcurrencyPermit | null> {
    const redis = getRedisConnection();
    const key = this.getKey(tenantId);
    const max = this.config.maxPerTenant;
    const ttlMs = this.config.leaseTtlMs;

    const lua = `
      local key = KEYS[1]
      local max = tonumber(ARGV[1])
      local ttl = tonumber(ARGV[2])
      local current = tonumber(redis.call("GET", key) or "0")
      if current >= max then
        return 0
      end
      local nextValue = redis.call("INCR", key)
      redis.call("PEXPIRE", key, ttl)
      return nextValue
    `;

    const result = (await redis.eval(lua, 1, key, max, ttlMs)) as number;
    if (result <= 0) {
      return null;
    }

    return { tenantId, key };
  }

  async refresh(permit: TenantConcurrencyPermit): Promise<void> {
    const redis = getRedisConnection();
    const ttlMs = this.config.leaseTtlMs;

    const lua = `
      local key = KEYS[1]
      local ttl = tonumber(ARGV[1])
      local current = tonumber(redis.call("GET", key) or "0")
      if current <= 0 then
        return 0
      end
      redis.call("PEXPIRE", key, ttl)
      return 1
    `;

    try {
      await redis.eval(lua, 1, permit.key, ttlMs);
    } catch (error) {
      logger.warn("[TenantConcurrencyLimiter] Failed to refresh tenant lease", {
        tenantId: permit.tenantId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  async release(permit: TenantConcurrencyPermit): Promise<void> {
    const redis = getRedisConnection();
    const ttlMs = this.config.leaseTtlMs;

    const lua = `
      local key = KEYS[1]
      local ttl = tonumber(ARGV[1])
      local current = tonumber(redis.call("GET", key) or "0")
      if current <= 1 then
        redis.call("DEL", key)
        return 0
      end
      local nextValue = redis.call("DECR", key)
      if nextValue <= 0 then
        redis.call("DEL", key)
        return 0
      end
      redis.call("PEXPIRE", key, ttl)
      return nextValue
    `;

    await redis.eval(lua, 1, permit.key, ttlMs);
  }
}
