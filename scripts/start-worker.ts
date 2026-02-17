import * as dotenv from "dotenv";
dotenv.config();

import { createHash } from "crypto";
import { promises as fs } from "fs";
import os from "os";
import path from "path";
import { createWorkers } from "../lib/queue/worker";

console.log("🚀 Starting PricePilot Background Workers...");

interface WorkerLockPayload {
  pid: number;
  cwd: string;
  createdAt: string;
}

const lockSuffix = createHash("sha1").update(process.cwd()).digest("hex").slice(0, 12);
const workerLockPath = path.join(os.tmpdir(), `pricepilot-worker-${lockSuffix}.lock`);

function shouldEnforceSingleWorkerInstance(): boolean {
  if (process.env.WORKER_SINGLE_INSTANCE === "false") return false;
  return process.env.NODE_ENV !== "production";
}

function isErrnoException(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}

function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function isRedisStartupError(error: unknown): boolean {
  const msg =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : JSON.stringify(error);

  // Upstash free-tier / quota related.
  if (msg.includes("max requests limit exceeded")) return true;

  // Common network/auth/connectivity failures.
  if (
    msg.includes("ECONNREFUSED") ||
    msg.includes("ENOTFOUND") ||
    msg.includes("WRONGPASS") ||
    msg.includes("NOAUTH") ||
    msg.includes("Connection is closed") ||
    msg.includes("connect ETIMEDOUT") ||
    msg.includes("read ETIMEDOUT")
  ) {
    return true;
  }

  return false;
}

async function acquireWorkerLock(): Promise<(() => Promise<void>) | null> {
  if (!shouldEnforceSingleWorkerInstance()) {
    return async () => {};
  }

  const payload: WorkerLockPayload = {
    pid: process.pid,
    cwd: process.cwd(),
    createdAt: new Date().toISOString(),
  };

  try {
    await fs.writeFile(workerLockPath, JSON.stringify(payload), { flag: "wx" });
    return async () => {
      try {
        await fs.unlink(workerLockPath);
      } catch (error) {
        if (isErrnoException(error) && error.code === "ENOENT") return;
      }
    };
  } catch (error) {
    if (!isErrnoException(error) || error.code !== "EEXIST") {
      throw error;
    }

    try {
      const rawLock = await fs.readFile(workerLockPath, "utf8");
      const parsed = JSON.parse(rawLock) as Partial<WorkerLockPayload>;
      const existingPid =
        typeof parsed.pid === "number" && Number.isFinite(parsed.pid)
          ? Math.floor(parsed.pid)
          : null;

      if (
        existingPid &&
        existingPid !== process.pid &&
        parsed.cwd === process.cwd() &&
        isProcessAlive(existingPid)
      ) {
        console.log(`⚠️ Worker already running (pid: ${existingPid}). Skipping duplicate worker start.`);
        return null;
      }
    } catch (lockReadError) {
      if (!(isErrnoException(lockReadError) && lockReadError.code === "ENOENT")) {
        console.warn("⚠️ Failed to inspect existing worker lock, attempting recovery:", lockReadError);
      }
    }

    // Stale lock recovery path
    await fs.unlink(workerLockPath).catch(() => undefined);
    await fs.writeFile(workerLockPath, JSON.stringify(payload), { flag: "wx" });

    return async () => {
      try {
        await fs.unlink(workerLockPath);
      } catch (unlinkError) {
        if (isErrnoException(unlinkError) && unlinkError.code === "ENOENT") return;
      }
    };
  }
}

async function start() {
  let releaseWorkerLock: (() => Promise<void>) | null = null;

  try {
    releaseWorkerLock = await acquireWorkerLock();
    if (!releaseWorkerLock) {
      process.exit(0);
      return;
    }

    let started = false;
    let syncWorker: any = null;
    let notificationWorker: any = null;

    const startWorkersOnce = async (): Promise<void> => {
      const created = createWorkers();
      syncWorker = created.syncWorker as any;
      notificationWorker = created.notificationWorker as any;

      // Schedule internal crons/maintenance only once on worker start.
      // If Redis is unavailable, don't crash the whole dev session.
      try {
        const { scheduleSystemTasks } = await import("../lib/queue/client");
        await scheduleSystemTasks();
      } catch (e) {
        if (process.env.NODE_ENV !== "production" && isRedisStartupError(e)) {
          console.warn("⚠️ Failed to schedule system tasks (Redis unavailable). Continuing without cron scheduling.");
        } else {
          throw e;
        }
      }

      console.log("✅ Workers active:");
      console.log(
        `   - Sync Queue (Concurrency: ${(syncWorker as any).concurrencyValue})`,
      );
      console.log(
        `   - Notification Queue (Concurrency: ${(notificationWorker as any).concurrencyValue})`,
      );

      started = true;
    };

    // Handle graceful shutdown (works both in active + degraded modes).
    const gracefulShutdown = async () => {
      console.log("🛑 Shutting down workers...");
      try {
        if (syncWorker) await syncWorker.close();
      } catch { }
      try {
        if (notificationWorker) await notificationWorker.close();
      } catch { }
      await releaseWorkerLock?.();
      process.exit(0);
    };

    process.on("SIGTERM", gracefulShutdown);
    process.on("SIGINT", gracefulShutdown);

    try {
      await startWorkersOnce();
    } catch (error) {
      // In development, Redis is often optional. Keep the process alive so `dev:full`
      // doesn't kill Next.js when Redis/Upstash is unavailable or quota-limited.
      if (process.env.NODE_ENV !== "production" && isRedisStartupError(error)) {
        const retryMs = Number.parseInt(process.env.WORKER_REDIS_RETRY_MS || "30000", 10);
        const intervalMs =
          Number.isFinite(retryMs) && retryMs >= 5000 ? Math.floor(retryMs) : 30000;

        console.warn("⚠️ Workers disabled: Redis unavailable (or quota exceeded).");
        console.warn(`   - Next.js will keep running. Worker will retry in ${Math.round(intervalMs / 1000)}s.`);
        console.warn("   - Fix: start local Redis and set REDIS_URL, or wait for Upstash quota reset.");

        // Retry in background with a quiet, single interval.
        const timer = setInterval(async () => {
          if (started) return;
          try {
            await startWorkersOnce();
            clearInterval(timer);
          } catch (e) {
            if (isRedisStartupError(e)) return;
            console.error("❌ Worker startup failed with a non-Redis error:", e);
            clearInterval(timer);
            await gracefulShutdown();
          }
        }, intervalMs);

        // Keep process alive in degraded mode.
        return;
      }

      throw error;
    }
  } catch (error) {
    await releaseWorkerLock?.().catch(() => undefined);
    console.error("❌ Failed to start workers:", error);
    process.exit(1);
  }
}

start();
