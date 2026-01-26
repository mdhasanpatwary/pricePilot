import { Redis } from "ioredis";

// Support both direct REDIS_URL and Upstash REST credentials
const getRedisUrl = () => {
  if (process.env.REDIS_URL) {
    return process.env.REDIS_URL;
  }
  
  // If using Upstash, construct the connection URL
  if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    // Extract host from REST URL (e.g., https://harmless-macaque-50376.upstash.io -> harmless-macaque-50376.upstash.io)
    const restUrl = process.env.UPSTASH_REDIS_REST_URL.replace('https://', '').replace('http://', '');
    const token = process.env.UPSTASH_REDIS_REST_TOKEN;
    // Upstash uses rediss:// (SSL) with password authentication
    return `rediss://default:${token}@${restUrl}:6379`;
  }
  
  return "redis://localhost:6379";
};

const REDIS_URL = getRedisUrl();

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
