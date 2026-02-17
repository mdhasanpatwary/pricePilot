import { Redis } from "ioredis";

// Support both direct REDIS_URL and Upstash REST credentials
const getRedisUrl = () => {
  if (process.env.REDIS_URL) {
    return process.env.REDIS_URL;
  }

  // In local development, prefer a local Redis if the user hasn't explicitly set REDIS_URL.
  // This avoids burning Upstash free-tier request quotas during dev sessions.
  // Set REDIS_PREFER_LOCAL_IN_DEV=false to force the Upstash connection in development.
  const preferLocalInDev = process.env.REDIS_PREFER_LOCAL_IN_DEV !== "false";
  if (process.env.NODE_ENV !== "production" && preferLocalInDev) {
    return "redis://localhost:6379";
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
const SHOULD_LOG_REDIS_CONNECT = process.env.REDIS_LOG_CONNECTIONS === "true";

type RedisGlobalState = {
  __ppRedisConnection?: Redis;
  __ppRedisConnectionAttempts?: number;
  __ppRedisHasLoggedConnect?: boolean;
};

const redisGlobal = globalThis as typeof globalThis & RedisGlobalState;
let _redisConnection: Redis | undefined = redisGlobal.__ppRedisConnection;
let _connectionAttempts = redisGlobal.__ppRedisConnectionAttempts ?? 0;
const MAX_RETRY_ATTEMPTS = process.env.NODE_ENV === "test" ? 3 : 10;

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
      connectTimeout: 5000, // 5s connection timeout (reduced from 10s)
      lazyConnect: true, // Don't connect immediately - only connect when needed
      keepAlive: 30000, // Keep connection alive
      family: 4, // Force IPv4
      // Connection pool settings
      enableAutoPipelining: true,
      // Retry strategy with exponential backoff and max attempts
      retryStrategy(times) {
        _connectionAttempts = times;
        redisGlobal.__ppRedisConnectionAttempts = times;

        // In test mode, don't retry at all to avoid hanging
        if (process.env.NODE_ENV === "test") {
          return null;
        }

        // Stop retrying after max attempts
        if (times > MAX_RETRY_ATTEMPTS) {
          console.error(`❌ Redis connection failed after ${MAX_RETRY_ATTEMPTS} attempts. Giving up.`);
          return null; // Stop retrying
        }

        const delay = Math.min(times * 100, 3000); // Max 3s delay
        console.log(`🔄 Redis retry attempt ${times}/${MAX_RETRY_ATTEMPTS} in ${delay}ms...`);
        return delay;
      },
      // Reconnect on failure
      reconnectOnError(err) {
        const targetError = "READONLY";
        return err.message.includes(targetError);
      },
    });

    _redisConnection.on("error", (err: any) => {
      // Suppress errors in test mode to avoid noise
      if (process.env.NODE_ENV === "test") {
        return;
      }

      // Log connection errors clearly
      if (err.code === "ECONNREFUSED") {
        console.error("❌ Redis connection refused. Is Redis running?");
      } else if (err.code === "ENOTFOUND") {
        console.error("❌ Redis host not found. Check REDIS_URL or UPSTASH_REDIS_REST_URL.");
      } else if (err.message.includes("WRONGPASS") || err.message.includes("NOAUTH")) {
        console.error("❌ Redis authentication failed. Check UPSTASH_REDIS_REST_TOKEN.");
      } else {
        console.error("❌ Redis error:", err.message);
      }
    });

    _redisConnection.on("connect", () => {
      _connectionAttempts = 0; // Reset counter on successful connection
      redisGlobal.__ppRedisConnectionAttempts = 0;
      if (process.env.NODE_ENV !== "test" && SHOULD_LOG_REDIS_CONNECT) {
        if (!redisGlobal.__ppRedisHasLoggedConnect) {
          console.log("✅ Redis connected successfully");
          redisGlobal.__ppRedisHasLoggedConnect = true;
        }
      }
    });

    _redisConnection.on("reconnecting", () => {
      if (process.env.NODE_ENV !== "test") {
        console.log("🔄 Redis reconnecting...");
      }
    });

    _redisConnection.on("end", () => {
      if (_connectionAttempts >= MAX_RETRY_ATTEMPTS && process.env.NODE_ENV !== "test") {
        console.error("❌ Redis connection ended after max retry attempts");
      }
    });

    redisGlobal.__ppRedisConnection = _redisConnection;
  }
  return _redisConnection;
};

/**
 * Disconnect and cleanup Redis connection
 * Should be called in test teardown
 */
export const disconnectRedis = async (): Promise<void> => {
  if (_redisConnection) {
    try {
      await _redisConnection.quit();
      _redisConnection = undefined;
      redisGlobal.__ppRedisConnection = undefined;
    } catch (error) {
      // Ignore errors during cleanup
    }
  }
};

// For backward compatibility while refactoring
export const redisConnection = null as any;
