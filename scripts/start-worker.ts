import * as dotenv from "dotenv";
dotenv.config();

import { createHash } from "crypto";
import { promises as fs } from "fs";
import net from "net";
import os from "os";
import path from "path";
import { createWorkers } from "../lib/queue/worker";
import { getRedisConnection } from "../lib/queue/connection";
import { GlobalScrapeBudgetService } from "../lib/services/scheduling/global-scrape-budget";

console.log("🚀 Starting PricePilot Background Workers...");

interface WorkerLockPayload {
  pid: number;
  cwd: string;
  repoRoot: string;
  createdAt: string;
}

// Use repo root for lock identity so launching the worker from another CWD
// (but pointing at the same repo) can't accidentally start a second instance.
const repoRoot = path.resolve(__dirname, "..");
const lockSuffix = createHash("sha1").update(repoRoot).digest("hex").slice(0, 12);
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
  const anyErr = error as any;
  const directCode: unknown = anyErr?.code;
  const nestedCode: unknown = anyErr?.error?.code;

  const msg =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : (() => {
          try {
            return JSON.stringify(error);
          } catch {
            return String(error);
          }
        })();

  const codes = new Set([
    "ECONNREFUSED",
    "ENOTFOUND",
    "EAI_AGAIN",
    "ETIMEDOUT",
    "EPERM",
    "WRONGPASS",
    "NOAUTH",
  ]);

  if (typeof directCode === "string" && codes.has(directCode)) return true;
  if (typeof nestedCode === "string" && codes.has(nestedCode)) return true;

  if (msg.includes("Redis connection failed after")) return true;
  if (msg.includes("Redis preflight failed")) return true;
  if (msg.includes("Connection is closed")) return true;

  // Common network/auth/connectivity failures.
  if (
    msg.includes("ECONNREFUSED") ||
    msg.includes("ENOTFOUND") ||
    msg.includes("EAI_AGAIN") ||
    msg.includes("WRONGPASS") ||
    msg.includes("NOAUTH") ||
    msg.includes("EPERM") ||
    msg.includes("Connection is closed") ||
    msg.includes("connect ETIMEDOUT") ||
    msg.includes("read ETIMEDOUT")
  ) {
    return true;
  }

  return false;
}

function resolveRedisUrlForWorker(): string {
  if (process.env.REDIS_URL) return process.env.REDIS_URL;

  const preferLocalInDev = process.env.REDIS_PREFER_LOCAL_IN_DEV !== "false";
  if (process.env.NODE_ENV !== "production" && preferLocalInDev) {
    return "redis://localhost:6379";
  }

  return "redis://localhost:6379";
}

async function canConnectTcp(host: string, port: number, timeoutMs: number): Promise<boolean> {
  return await new Promise((resolve) => {
    const socket = net.createConnection({ host, port });
    const done = (ok: boolean) => {
      socket.removeAllListeners();
      socket.destroy();
      resolve(ok);
    };

    socket.setTimeout(timeoutMs);
    socket.once("connect", () => done(true));
    socket.once("timeout", () => done(false));
    socket.once("error", () => done(false));
  });
}

async function preflightRedisConnectivity(): Promise<void> {
  const url = resolveRedisUrlForWorker();
  let parsed: URL | null = null;
  try {
    parsed = new URL(url);
  } catch {
    // If URL parsing fails, skip preflight and let the worker attempt to connect.
    return;
  }

  const hostname = parsed.hostname;
  const port = parsed.port ? Number.parseInt(parsed.port, 10) : 6379;
  const scheme = parsed.protocol.replace(":", "");

  // Fast path: local redis preflight via TCP so we can degrade instantly (and avoid BullMQ side effects).
  if (
    scheme === "redis" &&
    (hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1")
  ) {
    const timeoutMs = Number.parseInt(process.env.WORKER_REDIS_PREFLIGHT_TIMEOUT_MS || "250", 10);
    const ok = await canConnectTcp(hostname === "localhost" ? "127.0.0.1" : hostname, port, timeoutMs);
    if (!ok) {
      throw new Error(`Redis preflight failed: ${hostname}:${port} is not reachable`);
    }
  }
}

function parsePositiveInt(input: string | undefined, fallback: number, min: number): number {
  const parsed = Number(input);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.floor(parsed));
}

async function validateRedisHardening(): Promise<void> {
  const redis = getRedisConnection() as any;

  // Must be reachable in production. In development, warn and continue.
  try {
    if (redis.status !== "ready" && redis.status !== "connecting") {
      await redis.connect();
    }
    await redis.ping();
  } catch (error) {
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        `Redis startup validation failed in production: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
    console.warn("⚠️ Redis ping failed during startup validation (non-production):", error);
    return;
  }

  try {
    const infoMemory = await redis.info("memory");
    const usedMemoryBytes =
      Number((infoMemory.match(/used_memory:(\d+)/) || [])[1] || 0) || 0;
    const usedMemoryHuman =
      (infoMemory.match(/used_memory_human:([^\r\n]+)/) || [])[1] || "unknown";
    const maxMemoryBytes =
      Number((infoMemory.match(/maxmemory:(\d+)/) || [])[1] || 0) || 0;

    console.log("🧠 Redis memory snapshot:");
    console.log(`   - used_memory: ${usedMemoryHuman} (${usedMemoryBytes} bytes)`);
    console.log(
      `   - maxmemory: ${maxMemoryBytes > 0 ? `${maxMemoryBytes} bytes` : "0 (no hard cap configured)"}`,
    );
  } catch (error) {
    console.warn("⚠️ Unable to read Redis INFO memory:", error);
  }

  try {
    const configResult = (await redis.config("GET", "maxmemory-policy")) as string[];
    // Typical Redis returns ["maxmemory-policy", "allkeys-lru"].
    const policy = Array.isArray(configResult) ? configResult[1] : undefined;
    if (!policy) {
      console.warn("⚠️ Redis maxmemory-policy could not be resolved.");
      return;
    }

    if (policy === "noeviction") {
      console.warn(
        "⚠️ Redis maxmemory-policy is 'noeviction'. Queue and limiter writes may fail under memory pressure.",
      );
    } else {
      console.log(`✅ Redis maxmemory-policy: ${policy}`);
    }
  } catch (error) {
    // Some managed Redis plans disable CONFIG GET.
    console.warn("⚠️ Unable to read Redis maxmemory-policy via CONFIG GET:", error);
  }
}

function applyMemoryGuardDefaults(): void {
  if (process.env.NODE_ENV !== "production") {
    return;
  }

  if (!process.env.BROWSER_POOL_MAX_RSS_MB) {
    process.env.BROWSER_POOL_MAX_RSS_MB = "1536";
    console.log("ℹ️ BROWSER_POOL_MAX_RSS_MB not set. Defaulting to 1536MB for production.");
  }

  if (!process.env.WORKER_MAX_RSS_MB) {
    process.env.WORKER_MAX_RSS_MB = "2048";
    console.log("ℹ️ WORKER_MAX_RSS_MB not set. Defaulting to 2048MB for production.");
  }
}

async function acquireWorkerLock(): Promise<(() => Promise<void>) | null> {
  if (!shouldEnforceSingleWorkerInstance()) {
    return async () => {};
  }

  const payload: WorkerLockPayload = {
    pid: process.pid,
    cwd: process.cwd(),
    repoRoot,
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
        (parsed.repoRoot === repoRoot || parsed.cwd === process.cwd()) &&
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
    let scrapeWorker: any = null;
    let notificationWorker: any = null;
    let degraded = false;
    let isShuttingDown = false;
    let workerRssMonitorTimer: NodeJS.Timeout | null = null;
    let globalBudgetCleanupTimer: NodeJS.Timeout | null = null;

    const handleProcessError = (err: unknown) => {
      if (process.env.NODE_ENV !== "production" && isRedisStartupError(err)) {
        if (!degraded) {
          // Once we hit a Redis startup failure, treat subsequent Redis failures as non-fatal.
          degraded = true;
          console.warn("⚠️ Worker running without Redis (non-fatal Redis startup failure).");
        }
        return;
      }

      // Non-Redis error: fail fast (so we don't hide real bugs).
      console.error("❌ Worker crashed due to non-Redis error:", err);
      process.exit(1);
    };

      // Prevent redis startup failures from hard-crashing `yarn dev:full` in dev.
      process.on("unhandledRejection", handleProcessError);
      process.on("uncaughtException", handleProcessError);

    const startWorkersOnce = async (): Promise<void> => {
      applyMemoryGuardDefaults();
      await preflightRedisConnectivity();
      await validateRedisHardening();

      const created = createWorkers();
      syncWorker = created.syncWorker as any;
      scrapeWorker = (created as any).scrapeWorker as any;
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
      if (scrapeWorker) {
        console.log(
          `   - Scrape Queue (Concurrency: ${(scrapeWorker as any).concurrencyValue})`,
        );
      }
      console.log(
        `   - Notification Queue (Concurrency: ${(notificationWorker as any).concurrencyValue})`,
      );

      started = true;
    };

    // Handle graceful shutdown (works both in active + degraded modes).
    const gracefulShutdown = async (exitCode: number = 0) => {
      if (isShuttingDown) return;
      isShuttingDown = true;
      console.log("🛑 Shutting down workers...");
      if (workerRssMonitorTimer) {
        clearInterval(workerRssMonitorTimer);
        workerRssMonitorTimer = null;
      }
      if (globalBudgetCleanupTimer) {
        clearInterval(globalBudgetCleanupTimer);
        globalBudgetCleanupTimer = null;
      }
      try {
        if (syncWorker) await syncWorker.close();
      } catch { }
      try {
        if (scrapeWorker) await scrapeWorker.close();
      } catch { }
      try {
        if (notificationWorker) await notificationWorker.close();
      } catch { }
      // Best-effort: close the shared Playwright pool to avoid lingering Chromium processes.
      try {
        const { BrowserPool } = await import("../lib/services/browser-pool");
        await BrowserPool.shutdown();
      } catch { }
      await releaseWorkerLock?.();
      process.exit(exitCode);
    };

    const startWorkerRssGuard = () => {
      const maxRssMb = parsePositiveInt(process.env.WORKER_MAX_RSS_MB, 0, 0);
      const warnRssMb = parsePositiveInt(process.env.WORKER_RSS_WARN_MB, Math.max(1024, Math.floor(maxRssMb * 0.75)), 256);
      const intervalMs = parsePositiveInt(process.env.WORKER_RSS_MONITOR_INTERVAL_MS, 30000, 5000);

      if (maxRssMb <= 0) {
        return;
      }

      workerRssMonitorTimer = setInterval(() => {
        const rssMb = Math.round(process.memoryUsage().rss / 1024 / 1024);
        if (rssMb >= warnRssMb) {
          console.warn("[WorkerMemoryGuard] RSS spike detected", {
            rssMb,
            warnRssMb,
            maxRssMb,
          });
        }

        if (rssMb > maxRssMb) {
          console.error("[WorkerMemoryGuard] RSS limit exceeded, triggering graceful restart", {
            rssMb,
            maxRssMb,
          });
          void gracefulShutdown(1);
        }
      }, intervalMs);
    };

    const startGlobalBudgetJanitor = () => {
      const leaseTtlMs = GlobalScrapeBudgetService.getInstance().getLeaseTtlMs();
      const intervalMs = Math.max(15_000, Math.floor(leaseTtlMs / 2));
      globalBudgetCleanupTimer = setInterval(() => {
        void GlobalScrapeBudgetService.getInstance().cleanupStaleLeases();
      }, intervalMs);
    };

    process.on("SIGTERM", gracefulShutdown);
    process.on("SIGINT", gracefulShutdown);

    try {
      await startWorkersOnce();
      startWorkerRssGuard();
      startGlobalBudgetJanitor();
    } catch (error) {
      // In development, Redis is often optional. Keep the process alive so `dev:full`
      // doesn't kill Next.js when Redis is unavailable.
      if (process.env.NODE_ENV !== "production" && isRedisStartupError(error)) {
        const retryMs = Number.parseInt(process.env.WORKER_REDIS_RETRY_MS || "30000", 10);
        const intervalMs =
          Number.isFinite(retryMs) && retryMs >= 5000 ? Math.floor(retryMs) : 30000;

        console.warn("⚠️ Workers disabled: Redis unavailable (or quota exceeded).");
        console.warn(`   - Next.js will keep running. Worker will retry in ${Math.round(intervalMs / 1000)}s.`);
        console.warn("   - Fix: start Redis and set REDIS_URL.");

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
            await gracefulShutdown(1);
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
