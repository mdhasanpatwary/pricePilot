// This script starts the background worker process
// Run with: npm run worker

import { createWorkers } from "../lib/queue/worker";

console.log("🚀 Starting PricePilot Background Workers...");

try {
  const { syncWorker, notificationWorker } = createWorkers();

  console.log("✅ Workers active:");
  console.log("   - Sync Queue (Concurrency: 2)");
  console.log("   - Notification Queue (Concurrency: 5)");

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
