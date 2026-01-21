import { Redis } from "ioredis";

const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";

let _redisConnection: Redis | undefined;

/**
 * Shared Redis connection for BullMQ
 * Note: BullMQ requires 3 connections: Client, Subscriber, BClient
 * So we don't reuse one single instance for everything, but we reuse configuration.
 *
 * This is now lazy to avoid ECONNREFUSED during Next.js build.
 */
export const getRedisConnection = () => {
  if (!_redisConnection) {
    _redisConnection = new Redis(REDIS_URL, {
      maxRetriesPerRequest: null, // Required by BullMQ
      // Avoid excessive error logging during build if Redis is down
      retryStrategy(times) {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
    });

    _redisConnection.on("error", (err: any) => {
      // Only log errors if not in build phase or if it's not a connection refused
      // (Though it's hard to perfectly detect build phase here without extra env vars)
      if (err.code !== "ECONNREFUSED") {
        console.error("Redis Connection Error:", err);
      }
    });
  }
  return _redisConnection;
};

// For backward compatibility while refactoring
export const redisConnection = null as any;
