import { Queue } from "bullmq";
import { getRedisConnection } from "../lib/queue/connection";
import { QUEUE_NAMES } from "../lib/queue/types";

// Connect to Redis
const redis = getRedisConnection();

const QUEUES_TO_ANALYZE = [
  QUEUE_NAMES.SYNC_FULL,
  QUEUE_NAMES.SYNC_DELTA,
  QUEUE_NAMES.SCRAPE_HIGH_PRIO,
  QUEUE_NAMES.SCRAPE_LOW_PRIO,
];

// Configuration for SLA thresholds
const SLA_THRESHOLDS_MS: Record<string, number> = {
  [QUEUE_NAMES.SYNC_FULL]: 60 * 60 * 1000, // 1 hour
  [QUEUE_NAMES.SYNC_DELTA]: 15 * 60 * 1000, // 15 mins
  [QUEUE_NAMES.SCRAPE_HIGH_PRIO]: 5 * 60 * 1000, // 5 mins
  [QUEUE_NAMES.SCRAPE_LOW_PRIO]: 30 * 60 * 1000, // 30 mins
};

// Threshold for starvation detection (if a tenant owns > X% of waiting jobs)
const DOMINANCE_THRESHOLD_PCT = 0.50; // 50%

async function analyzeQueue(queueName: string) {
  const queue = new Queue(queueName, { connection: redis });

  console.log(`\n=== Analyzing Queue: ${queueName} ===`);

  const [waitingCount, activeCount, delayedCount] = await Promise.all([
    queue.getWaitingCount(),
    queue.getActiveCount(),
    queue.getDelayedCount(),
  ]);

  console.log(`State: ${waitingCount} waiting, ${activeCount} active, ${delayedCount} delayed`);

  if (waitingCount === 0 && activeCount === 0) {
    console.log(`Queue is empty. No fairness issues.`);
    return;
  }

  // Get up to 1000 waiting jobs to analyze distribution
  const waitingJobs = await queue.getWaiting(0, 1000);

  const tenantCounts = new Map<string, number>();
  const tenantWaitTimes = new Map<string, number[]>();

  const now = Date.now();

  for (const job of waitingJobs) {
    // Determine tenantId. Prioritize groupId, fallback to data.tenantId
    const tenantId = job.opts.groupId || job.data?.tenantId || "unknown";

    tenantCounts.set(tenantId, (tenantCounts.get(tenantId) || 0) + 1);

    if (job.timestamp) {
      const waitTime = now - job.timestamp;
      const times = tenantWaitTimes.get(tenantId) || [];
      times.push(waitTime);
      tenantWaitTimes.set(tenantId, times);
    }
  }

  // Detect Dominance
  const totalAnalyzed = waitingJobs.length;
  console.log(`\nTenant Distribution (Top 5 of ${totalAnalyzed} analyzed waiting jobs):`);

  const sortedTenants = Array.from(tenantCounts.entries()).sort((a, b) => b[1] - a[1]);

  for (const [tenant, count] of sortedTenants.slice(0, 5)) {
    const pct = count / totalAnalyzed;
    const warning = pct > DOMINANCE_THRESHOLD_PCT ? ` ⚠️ DOMINATING (>${DOMINANCE_THRESHOLD_PCT * 100}%)` : "";
    console.log(` - Tenant ${tenant}: ${count} jobs (${(pct * 100).toFixed(1)}%)${warning}`);
  }

  // Detect SLA Breaches / Starvation
  console.log(`\nSLA Analysis (Threshold: ${SLA_THRESHOLDS_MS[queueName] / 1000}s):`);
  let hasBreaches = false;

  for (const [tenant, times] of tenantWaitTimes.entries()) {
    const maxWait = Math.max(...times);
    if (maxWait > SLA_THRESHOLDS_MS[queueName]) {
      hasBreaches = true;
      console.log(` 🚨 SLA BREACH: Tenant ${tenant} has jobs waiting for ${(maxWait / 1000).toFixed(1)}s`);
    }
  }

  if (!hasBreaches && totalAnalyzed > 0) {
    console.log(` ✅ No SLA breaches detected among waiting jobs.`);
  }
}

async function main() {
  console.log(`🚀 Starting Queue Fairness Analysis...`);
  console.log(`Time: ${new Date().toISOString()}`);

  for (const queueName of QUEUES_TO_ANALYZE) {
    await analyzeQueue(queueName);
  }

  await redis.quit();
  console.log(`\n🏁 Analysis complete.`);
  process.exit(0);
}

main().catch((error) => {
  console.error("Analysis failed:", error);
  process.exit(1);
});
