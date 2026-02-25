import type { Redis } from "ioredis";

export type RateLimitResult = {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number; // unix ms timestamp
};

export type RateLimiterLike = {
  limit: (identifier: string) => Promise<RateLimitResult>;
};

// Atomic sliding-window rate limit implemented with a sorted set of timestamps.
// We keep only events within the window and compute reset from the oldest event.
const SLIDING_WINDOW_LUA = `
local key = KEYS[1]
local now = tonumber(ARGV[1])
local windowMs = tonumber(ARGV[2])
local maxReq = tonumber(ARGV[3])
local member = ARGV[4]

-- Trim anything older than the current window.
redis.call('ZREMRANGEBYSCORE', key, 0, now - windowMs)

local count = redis.call('ZCARD', key)
local oldest = redis.call('ZRANGE', key, 0, 0, 'WITHSCORES')

local reset = now + windowMs
if oldest[2] then
  reset = tonumber(oldest[2]) + windowMs
end

-- Refresh TTL (ms) so idle keys are cleaned up.
redis.call('PEXPIRE', key, windowMs)

if count >= maxReq then
  return {0, maxReq, 0, reset}
end

redis.call('ZADD', key, now, member)
count = count + 1

oldest = redis.call('ZRANGE', key, 0, 0, 'WITHSCORES')
reset = now + windowMs
if oldest[2] then
  reset = tonumber(oldest[2]) + windowMs
end

local remaining = maxReq - count
if remaining < 0 then remaining = 0 end

return {1, maxReq, remaining, reset}
`;

function toNumber(v: unknown): number {
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

export function createSlidingWindowRateLimiter(opts: {
  redis: Redis | (() => Redis);
  prefix: string;
  limit: number;
  windowMs: number;
}): RateLimiterLike {
  const { redis, prefix, limit, windowMs } = opts;

  return {
    async limit(identifier: string): Promise<RateLimitResult> {
      const client = typeof redis === 'function' ? redis() : redis;
      const key = `${prefix}:${identifier}`;
      const now = Date.now();
      const member = `${now}-${Math.random().toString(36).slice(2)}`;

      // ioredis eval returns (string|number)[] depending on parser.
      const raw = (await (client as any).eval(
        SLIDING_WINDOW_LUA,
        1,
        key,
        now,
        windowMs,
        limit,
        member,
      )) as unknown;

      const arr = Array.isArray(raw) ? raw : [];
      const ok = toNumber(arr[0]);
      const lim = toNumber(arr[1]) || limit;
      const remaining = toNumber(arr[2]);
      const reset = toNumber(arr[3]) || now + windowMs;

      return { success: ok === 1, limit: lim, remaining, reset };
    },
  };
}

