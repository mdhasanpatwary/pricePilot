// This script starts the background worker process
// Run with: npm run worker

import { createWorkers } from "../lib/queue/worker";

console.log("🚀 Starting PricePilot Background Workers...");

async function start() {
  try {
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
      process.exit(0);
    };

    process.on("SIGTERM", gracefulShutdown);
    process.on("SIGINT", gracefulShutdown);
  } catch (error) {
    console.error("❌ Failed to start workers:", error);
    process.exit(1);
  }
}

start();
