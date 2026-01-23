import { prisma } from "../lib/prisma";

async function clearLogs() {
  console.log("🧹 Clearing all sync logs...");
  await prisma.syncLog.deleteMany({});
  await prisma.scrapeRetry.deleteMany({});
  console.log("✨ All logs and retry lists cleared. Your console should now be empty.");
  process.exit(0);
}

clearLogs();
