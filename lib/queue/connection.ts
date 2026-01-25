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
      connectTimeout: 10000, // 10s connection timeout
      lazyConnect: true, // Don't connect immediately
      keepAlive: 30000, // Keep connection alive
      family: 4, // Force IPv4
      // Connection pool settings
      enableAutoPipelining: true,
      // Retry strategy with exponential backoff
      retryStrategy(times) {
        const delay = Math.min(times * 100, 3000); // Max 3s delay
        return delay;
      },
      // Reconnect on failure
      reconnectOnError(err) {
        const targetError = "READONLY";
        return err.message.includes(targetError);
      },
    });

    _redisConnection.on("error", (err: any) => {
      // Only log errors if not in build phase or if it's not a connection refused
      if (err.code !== "ECONNREFUSED" && process.env.NODE_ENV !== "test") {
        console.error("Redis Connection Error:", err.message);
      }
    });

    _redisConnection.on("connect", () => {
      if (process.env.NODE_ENV !== "test") {
        console.log("✅ Redis connected successfully");
      }
    });

    _redisConnection.on("reconnecting", () => {
      if (process.env.NODE_ENV !== "test") {
        console.log("🔄 Redis reconnecting...");
      }
    });
  }
  return _redisConnection;
};

// For backward compatibility while refactoring
export const redisConnection = null as any;
