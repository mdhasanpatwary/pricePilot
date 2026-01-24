import { Redis } from '@upstash/redis';
import { logger } from "../logger";

export class CacheService {
  private redis: Redis | null = null;
  private static instance: CacheService;

  private constructor() {
    // Try to initialize from environment variables automatically
    try {
        // This will look for UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN
        // or KV_REST_API_URL and KV_REST_API_TOKEN
        this.redis = Redis.fromEnv();
    } catch (e) {
        logger.warn("[CacheService] Redis environment variables missing. Caching disabled.");
    }
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
      const data = await this.redis.get<T>(key);
      return data;
    } catch (error) {
      // logger.error(`[CacheService] Get Error: ${key}`, { error });
      return null;
    }
  }

  async set(key: string, value: any, ttlSeconds: number = 3600): Promise<void> {
    if (!this.redis) return;
    try {
      await this.redis.set(key, value, { ex: ttlSeconds });
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
