import { getRedisConnection } from "./connection";
import { logger } from "@/lib/logger";

export type CronJobType = "CRITICAL" | "ANALYTICS" | "CLEANUP";

/**
 * Distributed Lock Service (Phase 3)
 *
 * Implements token-based lock acquire and Lua-based safe release for cron jobs.
 * Supports lock refresh/heartbeat for long-running tasks.
 * Implements fail-closed policies based on cron type and Redis availability.
 */

export interface AcquireLockOptions {
  lockKey: string;
  ttlMs: number;
  jobType: CronJobType;
}

export interface LockHandle {
  lockKey: string;
  token: string;
  acquiredAt: number;
  ttlMs: number;
}

export class DistributedLockService {
  /**
   * Token-based lock acquire using SET key value NX PX ttl.
   * Returns a lock handle if successful, or null if lock is held elsewhere.
   */
  static async acquireLock(options: AcquireLockOptions): Promise<LockHandle | null> {
    const { lockKey, ttlMs, jobType } = options;
    const redis = getRedisConnection();

    // Generate a unique token for this lock holder
    const token = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

    try {
      const result = await redis.set(lockKey, token, "PX", ttlMs, "NX");

      if (result === "OK") {
        logger.info("[DistributedLock] Lock acquired", {
          lockKey,
          jobType,
          ttlMs,
        });
        return {
          lockKey,
          token,
          acquiredAt: Date.now(),
          ttlMs,
        };
      } else {
        logger.debug("[DistributedLock] Lock already held", { lockKey, jobType });
        return null;
      }
    } catch (error) {
      logger.error("[DistributedLock] Failed to acquire lock", {
        lockKey,
        jobType,
        error: error instanceof Error ? error.message : String(error),
      });

      // fail-closed for critical jobs, skip for others
      if (jobType === "CRITICAL") {
        throw new Error(`Cannot acquire distributed lock for critical job: ${lockKey}`);
      }
      return null;
    }
  }

  /**
   * Lua-based safe release: compare token first, then delete.
   * Ensures only the lock holder (matching token) can release the lock.
   */
  static async releaseLock(handle: LockHandle): Promise<boolean> {
    const { lockKey, token } = handle;
    const redis = getRedisConnection();

    const luaScript = `
      if redis.call("GET", KEYS[1]) == ARGV[1] then
        return redis.call("DEL", KEYS[1])
      else
        return 0
      end
    `;

    try {
      const result = await redis.eval(luaScript, 1, lockKey, token);
      if (result === 1) {
        logger.info("[DistributedLock] Lock released", { lockKey });
        return true;
      } else {
        logger.warn("[DistributedLock] Lock token mismatch (already expired or held by another)", {
          lockKey,
        });
        return false;
      }
    } catch (error) {
      logger.error("[DistributedLock] Failed to release lock", {
        lockKey,
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  /**
   * Refresh/heartbeat: extend the TTL of the lock if we still hold it.
   * Used for long-running jobs that need to renew their claim periodically.
   */
  static async refreshLock(handle: LockHandle, additionalTtlMs: number): Promise<boolean> {
    const { lockKey, token, ttlMs } = handle;
    const redis = getRedisConnection();

    const luaScript = `
      if redis.call("GET", KEYS[1]) == ARGV[1] then
        return redis.call("PEXPIRE", KEYS[1], ARGV[2])
      else
        return 0
      end
    `;

    try {
      const newTtl = Math.max(ttlMs, additionalTtlMs);
      const result = await redis.eval(luaScript, 1, lockKey, token, newTtl);

      if (result) {
        logger.info("[DistributedLock] Lock refreshed", {
          lockKey,
          newTtlMs: newTtl,
        });
        // update handle's TTL for tracking
        handle.ttlMs = newTtl;
        return true;
      } else {
        logger.warn("[DistributedLock] Lock refresh failed (token mismatch)", { lockKey });
        return false;
      }
    } catch (error) {
      logger.error("[DistributedLock] Failed to refresh lock", {
        lockKey,
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  /**
   * Execute a cron job with automatic locking and failure policy.
   * Determines behaviour (abort, skip) based on job type and Redis availability.
   */
  static async executeWithLock<T>(
    jobType: CronJobType,
    lockKey: string,
    jobFn: (handle: LockHandle) => Promise<T>,
    options: { ttlMs?: number } = {},
  ): Promise<T | null> {
    const ttlMs = options.ttlMs ?? 30 * 60 * 1000; // 30 min default

    // Try to acquire distributed lock
    let handle: LockHandle | null = null;
    try {
      handle = await this.acquireLock({ lockKey, ttlMs, jobType });
    } catch (lockError) {
      // Lock acquisition threw (critical cron in fail-closed mode)
      logger.error("[DistributedLock] Lock acquire error in executeWithLock", {
        jobType,
        lockKey,
        error: lockError instanceof Error ? lockError.message : String(lockError),
      });
      throw lockError;
    }

    // If we couldn't acquire the lock
    if (!handle) {
      const policy = this.getFailurePolicy(jobType);
      logger.warn("[DistributedLock] Could not acquire lock", { jobType, lockKey, policy });

      if (policy === "ABORT") {
        throw new Error(`Lock not available; aborting ${jobType} cron job`);
      } else {
        // SKIP: return null to indicate skipped
        return null;
      }
    }

    // Execute the job with the lock held
    try {
      logger.info("[DistributedLock] Starting job with lock", { jobType, lockKey });
      const result = await jobFn(handle);
      return result;
    } catch (jobError) {
      logger.error("[DistributedLock] Job execution failed", {
        jobType,
        lockKey,
        error: jobError instanceof Error ? jobError.message : String(jobError),
      });
      throw jobError;
    } finally {
      // Always release the lock
      await this.releaseLock(handle);
    }
  }

  /**
   * Determine policy when Redis is unavailable or lock cannot be acquired.
   *
   * - CRITICAL jobs: ABORT (fail-closed)
   * - ANALYTICS jobs: SKIP (fail-soft)
   * - CLEANUP jobs: SKIP (fail-soft)
   */
  private static getFailurePolicy(jobType: CronJobType): "ABORT" | "SKIP" {
    switch (jobType) {
      case "CRITICAL":
        return "ABORT";
      case "ANALYTICS":
      case "CLEANUP":
        return "SKIP";
    }
  }
}
