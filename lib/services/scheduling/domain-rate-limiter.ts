import { getRedisConnection } from "@/lib/queue/connection";

export class DomainRateLimiter {
  static normalizeDomain(domain: string): string {
    return (domain || "").trim().toLowerCase().replace(/^www\./, "");
  }

  static lastRequestKey(domain: string): string {
    return `pp:domain:last_request_ms:${this.normalizeDomain(domain)}`;
  }

  static inflightKey(domain: string): string {
    return `pp:domain:inflight:${this.normalizeDomain(domain)}`;
  }

  /**
   * Enforce a minimum interval between requests per domain.
   *
   * Returns waitMs (0 if allowed now).
   */
  static async takeIntervalPermit(params: {
    domain: string;
    minIntervalMs: number;
    nowMs?: number;
  }): Promise<number> {
    const redis = getRedisConnection();
    const domain = this.normalizeDomain(params.domain);
    const key = this.lastRequestKey(domain);
    const nowMs = params.nowMs ?? Date.now();
    const minIntervalMs = Math.max(0, Math.floor(params.minIntervalMs));

    // Atomic via Lua: read last, compute wait, optionally set.
    const lua = `
      local key = KEYS[1]
      local now = tonumber(ARGV[1])
      local minInterval = tonumber(ARGV[2])
      local last = redis.call("GET", key)
      if last then
        last = tonumber(last)
        if last and (now - last) < minInterval then
          return minInterval - (now - last)
        end
      end
      redis.call("SET", key, tostring(now), "PX", math.max(1000, minInterval * 10))
      return 0
    `;

    const waitMs = (await redis.eval(lua, 1, key, nowMs, minIntervalMs)) as number;
    return Math.max(0, Math.floor(waitMs || 0));
  }

  /**
   * Per-domain concurrent request semaphore.
   *
   * Returns true if acquired, false otherwise.
   */
  static async tryAcquireConcurrency(params: {
    domain: string;
    maxConcurrent: number;
    ttlMs?: number;
  }): Promise<boolean> {
    const redis = getRedisConnection();
    const domain = this.normalizeDomain(params.domain);
    const key = this.inflightKey(domain);
    const maxConcurrent = Math.max(1, Math.floor(params.maxConcurrent));
    const ttlMs = Math.max(1000, Math.floor(params.ttlMs ?? 60_000));

    const lua = `
      local key = KEYS[1]
      local max = tonumber(ARGV[1])
      local ttl = tonumber(ARGV[2])
      local current = redis.call("GET", key)
      if not current then
        redis.call("SET", key, "1", "PX", ttl)
        return 1
      end
      current = tonumber(current)
      if current < max then
        redis.call("INCR", key)
        redis.call("PEXPIRE", key, ttl)
        return 1
      end
      return 0
    `;

    const ok = (await redis.eval(lua, 1, key, maxConcurrent, ttlMs)) as number;
    return ok === 1;
  }

  static async releaseConcurrency(domain: string): Promise<void> {
    const redis = getRedisConnection();
    const key = this.inflightKey(domain);
    const lua = `
      local key = KEYS[1]
      local current = redis.call("GET", key)
      if not current then return 0 end
      current = tonumber(current)
      if current <= 1 then
        redis.call("DEL", key)
        return 0
      end
      redis.call("DECR", key)
      return 0
    `;
    await redis.eval(lua, 1, key);
  }
}

