import { DistributedLockService, type LockHandle } from "./distributed-lock";
import { logger } from "@/lib/logger";

/**
 * Lock Heartbeat Service (Phase 3)
 *
 * Provides utilities for long-running cron jobs to refresh their locks periodically.
 * Implements abort-on-refresh-fail for critical jobs.
 */

export interface HeartbeatOptions {
  interval: number; // ms between refresh attempts
  abortOnFailure?: boolean; // if true, throw on refresh failure
}

/**
 * Start periodic lock refresh in the background.
 * Returns an async function that cancels the heartbeat.
 */
export function startLockHeartbeat(
  handle: LockHandle,
  options: HeartbeatOptions,
): () => Promise<void> {
  const { interval, abortOnFailure = false } = options;
  let active = true;
  let refreshErrors = 0;

  const heartbeatLoop = async () => {
    while (active) {
      await new Promise((resolve) => setTimeout(resolve, interval));

      if (!active) break;

      try {
        const refreshed = await DistributedLockService.refreshLock(handle, handle.ttlMs);
        if (!refreshed) {
          refreshErrors++;
          logger.warn("[LockHeartbeat] Lock refresh failed (token mismatch?)", {
            lockKey: handle.lockKey,
            errors: refreshErrors,
          });

          if (abortOnFailure) {
            throw new Error(`Lock heartbeat failed for ${handle.lockKey} (token mismatch)`);
          }
        } else {
          // Reset error count on success
          if (refreshErrors > 0) {
            logger.info("[LockHeartbeat] Lock refresh recovered", {
              lockKey: handle.lockKey,
              priorErrors: refreshErrors,
            });
            refreshErrors = 0;
          }
        }
      } catch (error) {
        logger.error("[LockHeartbeat] Unexpected error during refresh", {
          lockKey: handle.lockKey,
          error: error instanceof Error ? error.message : String(error),
        });

        if (abortOnFailure) {
          active = false;
          throw error;
        }
      }
    }
  };

  // Start heartbeat in the background (not awaited)
  heartbeatLoop().catch((e) => {
    logger.error("[LockHeartbeat] Heartbeat loop failed", {
      lockKey: handle.lockKey,
      error: e instanceof Error ? e.message : String(e),
    });
  });

  // Return cancel function
  const cancel = async () => {
    active = false;
  };

  return cancel;
}
