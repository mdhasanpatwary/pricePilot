import { Redis } from "ioredis";

const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";

/**
 * Shared Redis connection for BullMQ
 * Note: BullMQ requires 3 connections: Client, Subscriber, BClient
 * So we don't reuse one single instance for everything, but we reuse configuration.
 */
export const redisConnection = new Redis(REDIS_URL, {
  maxRetriesPerRequest: null, // Required by BullMQ
});
