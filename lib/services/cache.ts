import { logger } from "../logger";
import type { Redis } from "ioredis";
import { getRedisConnection } from "@/lib/queue/connection";

export class CacheService {
  private redis: Redis | null = null;
  private static instance: CacheService;

  private constructor() {
    // Shared Redis connection (lazyConnect in lib/queue/connection.ts).
    this.redis = getRedisConnection();
  }

  static getInstance(): CacheService {
    if (!CacheService.instance) {
      CacheService.instance = new CacheService();
    }
    return CacheService.instance;
  }

  async get<T>(key: string): Promise<T | null> {
    if (!this.redis) return null;
    try {
      const raw = await this.redis.get(key);
      if (raw == null) return null;
      return JSON.parse(raw) as T;
    } catch (error) {
      // logger.error(`[CacheService] Get Error: ${key}`, { error });
      return null;
    }
  }

  async set(key: string, value: any, ttlSeconds: number = 3600): Promise<void> {
    if (!this.redis) return;
    try {
      await this.redis.set(key, JSON.stringify(value), "EX", ttlSeconds);
    } catch (error) {
      logger.error(`[CacheService] Set Error: ${key}`, { error });
    }
  }

  async del(key: string): Promise<void> {
    if (!this.redis) return;
    try {
        await this.redis.del(key);
    } catch (error) {}
  }
}
