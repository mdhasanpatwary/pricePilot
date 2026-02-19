/**
 * Token Bucket Rate Limiter
 * 
 * Implements the token bucket algorithm for rate limiting requests per domain.
 * Tokens are added at a constant rate, and each request consumes one token.
 * If no tokens are available, the request must wait.
 */
import { getRedisConnection } from "@/lib/queue/connection";

export interface RateLimiterConfig {
    requestsPerMinute: number;
    maxBurst?: number; // Maximum tokens that can accumulate (defaults to requestsPerMinute)
}

export class RateLimiter {
    private static readonly KEY_PREFIX = "pp:rate-limit:bucket:";

    private normalizeDomain(domain: string): string {
        return (domain || "").trim().toLowerCase().replace(/^www\./, "");
    }

    private getKey(domain: string): string {
        return `${RateLimiter.KEY_PREFIX}${this.normalizeDomain(domain)}`;
    }

    private computeKeyTtlMs(config: RateLimiterConfig): number {
        const rpm = Math.max(1, config.requestsPerMinute);
        const maxBurst = Math.max(1, config.maxBurst ?? rpm);
        const refillMs = Math.ceil((maxBurst / rpm) * 60_000);
        return Math.max(60_000, refillMs * 5);
    }

    /**
     * Wait for a token to become available for the given domain
     * @param domain The domain to rate limit
     * @param config Rate limit configuration
     * @returns Promise that resolves when a token is available
     */
    async waitForToken(domain: string, config: RateLimiterConfig): Promise<void> {
        const redis = getRedisConnection();
        const rpm = Math.max(1, Math.floor(config.requestsPerMinute));
        const maxBurst = Math.max(1, Math.floor(config.maxBurst ?? rpm));
        const ttlMs = this.computeKeyTtlMs({ requestsPerMinute: rpm, maxBurst });
        const key = this.getKey(domain);

        const consumeLua = `
            local key = KEYS[1]
            local now = tonumber(ARGV[1])
            local rpm = tonumber(ARGV[2])
            local maxBurst = tonumber(ARGV[3])
            local ttl = tonumber(ARGV[4])
            local consume = tonumber(ARGV[5])

            local values = redis.call("HMGET", key, "tokens", "lastRefill", "rpm", "maxBurst")
            local tokens = tonumber(values[1])
            local lastRefill = tonumber(values[2])
            local prevRpm = tonumber(values[3])
            local prevMaxBurst = tonumber(values[4])

            if not tokens or not lastRefill or not prevRpm or not prevMaxBurst then
              tokens = maxBurst
              lastRefill = now
              prevRpm = rpm
              prevMaxBurst = maxBurst
            end

            if prevRpm ~= rpm or prevMaxBurst ~= maxBurst then
              tokens = math.min(maxBurst, tokens)
              prevRpm = rpm
              prevMaxBurst = maxBurst
            end

            if now > lastRefill then
              local elapsed = now - lastRefill
              local refill = elapsed * (rpm / 60000)
              tokens = math.min(maxBurst, tokens + refill)
              lastRefill = now
            end

            local allowed = 0
            local waitMs = 0
            if tokens >= consume then
              tokens = tokens - consume
              allowed = 1
            else
              local needed = consume - tokens
              local tokensPerMs = rpm / 60000
              waitMs = math.ceil(needed / tokensPerMs)
            end

            redis.call("HMSET", key,
              "tokens", tostring(tokens),
              "lastRefill", tostring(lastRefill),
              "rpm", tostring(rpm),
              "maxBurst", tostring(maxBurst)
            )
            redis.call("PEXPIRE", key, ttl)

            return {allowed, waitMs}
        `;

        while (true) {
            const nowMs = Date.now();
            const result = (await redis.eval(
                consumeLua,
                1,
                key,
                nowMs,
                rpm,
                maxBurst,
                ttlMs,
                1,
            )) as [number, number];

            const allowed = Number(result?.[0] ?? 0) === 1;
            const waitMs = Math.max(0, Math.ceil(Number(result?.[1] ?? 0)));

            if (allowed) return;
            await new Promise(resolve => setTimeout(resolve, Math.max(waitMs, 10)));
        }
    }

    /**
     * Check if a token is available without consuming it
     * @param domain The domain to check
     * @param config Rate limit configuration
     * @returns True if a token is available
     */
    async hasToken(domain: string, config: RateLimiterConfig): Promise<boolean> {
        const redis = getRedisConnection();
        const rpm = Math.max(1, Math.floor(config.requestsPerMinute));
        const maxBurst = Math.max(1, Math.floor(config.maxBurst ?? rpm));
        const ttlMs = this.computeKeyTtlMs({ requestsPerMinute: rpm, maxBurst });
        const key = this.getKey(domain);

        const peekLua = `
            local key = KEYS[1]
            local now = tonumber(ARGV[1])
            local rpm = tonumber(ARGV[2])
            local maxBurst = tonumber(ARGV[3])
            local ttl = tonumber(ARGV[4])

            local values = redis.call("HMGET", key, "tokens", "lastRefill", "rpm", "maxBurst")
            local tokens = tonumber(values[1])
            local lastRefill = tonumber(values[2])
            local prevRpm = tonumber(values[3])
            local prevMaxBurst = tonumber(values[4])

            if not tokens or not lastRefill or not prevRpm or not prevMaxBurst then
              tokens = maxBurst
              lastRefill = now
              prevRpm = rpm
              prevMaxBurst = maxBurst
            end

            if prevRpm ~= rpm or prevMaxBurst ~= maxBurst then
              tokens = math.min(maxBurst, tokens)
              prevRpm = rpm
              prevMaxBurst = maxBurst
            end

            if now > lastRefill then
              local elapsed = now - lastRefill
              local refill = elapsed * (rpm / 60000)
              tokens = math.min(maxBurst, tokens + refill)
              lastRefill = now
            end

            redis.call("HMSET", key,
              "tokens", tostring(tokens),
              "lastRefill", tostring(lastRefill),
              "rpm", tostring(rpm),
              "maxBurst", tostring(maxBurst)
            )
            redis.call("PEXPIRE", key, ttl)

            if tokens >= 1 then
              return 1
            end
            return 0
        `;

        const result = (await redis.eval(
            peekLua,
            1,
            key,
            Date.now(),
            rpm,
            maxBurst,
            ttlMs,
        )) as number;

        return Number(result) === 1;
    }

    /**
     * Get or create a token bucket for a domain
     */
    async reset(domain: string): Promise<void> {
        const redis = getRedisConnection();
        await redis.del(this.getKey(domain));
    }

    /**
     * Reset all rate limiters
     */
    async resetAll(): Promise<void> {
        const redis = getRedisConnection();
        const pattern = `${RateLimiter.KEY_PREFIX}*`;
        let cursor = "0";
        do {
            const result = (await redis.scan(cursor, "MATCH", pattern, "COUNT", 200)) as [string, string[]];
            cursor = result[0];
            const keys = result[1] || [];
            if (keys.length > 0) {
                await redis.del(...keys);
            }
        } while (cursor !== "0");
    }

    /**
     * Get current token count for a domain (for debugging/monitoring)
     */
    async getTokenCount(domain: string): Promise<number> {
        const redis = getRedisConnection();
        const values = await redis.hmget(this.getKey(domain), "tokens");
        const tokens = Number(values?.[0] ?? 0);
        return Number.isFinite(tokens) ? tokens : 0;
    }
}
