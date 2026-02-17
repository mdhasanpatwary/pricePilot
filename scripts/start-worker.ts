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

    const { syncWorker, notificationWorker } = createWorkers();

    // Schedule internal crons/maintenance only once on worker start
    const { scheduleSystemTasks } = await import("../lib/queue/client");
    await scheduleSystemTasks();

    console.log("✅ Workers active:");
    console.log(
      `   - Sync Queue (Concurrency: ${(syncWorker as any).concurrencyValue})`,
    );
    console.log(
      `   - Notification Queue (Concurrency: ${(notificationWorker as any).concurrencyValue})`,
    );

    // Handle graceful shutdown
    const gracefulShutdown = async () => {
      console.log("🛑 Shutting down workers...");
      await syncWorker.close();
      await notificationWorker.close();
      await releaseWorkerLock?.();
      process.exit(0);
    };

    process.on("SIGTERM", gracefulShutdown);
    process.on("SIGINT", gracefulShutdown);
  } catch (error) {
    await releaseWorkerLock?.().catch(() => undefined);
    console.error("❌ Failed to start workers:", error);
    process.exit(1);
  }
}

start();
