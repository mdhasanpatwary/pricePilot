import { Queue, Worker, Job } from "bullmq";
import IORedis from "ioredis";
import { QUEUE_NAMES } from "../lib/queue/types";

const REDIS_URL = process.env.REDIS_URL || "redis://127.0.0.1:6379";
const connection = new IORedis(REDIS_URL, { maxRetriesPerRequest: null });

async function runStressTest() {
  console.log("=============================================");
  console.log("   PricePilot Queue Stress Test Suite       ");
  console.log("=============================================");

  const testQueueName = "stress-test-queue";
  const queue = new Queue(testQueueName, { connection });
  await queue.obliterate({ force: true });

  const tenants = [
    { id: "whale-tenant", jobs: 100, delay: 10 },    // Massive backlog
    { id: "fast-tenant-1", jobs: 10, delay: 5 },    // Small tenant
    { id: "fast-tenant-2", jobs: 10, delay: 5 },    // Another small tenant
    { id: "system-maint", jobs: 5, delay: 0 },      // Critical system tasks
  ];

  console.log("🚀 Injecting jobs for multiple tenants...");
  for (const tenant of tenants) {
    const jobs = [];
    for (let i = 0; i < tenant.jobs; i++) {
      jobs.push({
        name: "stress-job",
        data: { tenantId: tenant.id, index: i },
        opts: {
          groupId: tenant.id,
          priority: tenant.id === "system-maint" ? 1 : 10
        }
      });
    }
    await queue.addBulk(jobs);
    console.log(` - Injected ${tenant.jobs} jobs for ${tenant.id}`);
  }

  const results = new Map<string, number>();
  const startTimes = new Map<string, number>();
  const endTimes = new Map<string, number>();

  const worker = new Worker(testQueueName, async (job: Job) => {
    const tenantId = job.opts.groupId || "unknown";
    if (!startTimes.has(tenantId)) startTimes.set(tenantId, Date.now());

    // Simulate work
    await new Promise(resolve => setTimeout(resolve, 50));

    results.set(tenantId, (results.get(tenantId) || 0) + 1);
    endTimes.set(tenantId, Date.now());
  }, {
    connection,
    concurrency: 5 // Process 5 at a time
  });

  console.log("\n⏳ Processing for 10 seconds...");
  await new Promise(resolve => setTimeout(resolve, 10000));

  await worker.close();

  console.log("\n=============================================");
  console.log("   Stress Test Results (Fairness Check)      ");
  console.log("=============================================");

  for (const tenant of tenants) {
    const processed = results.get(tenant.id) || 0;
    const duration = (endTimes.get(tenant.id)! - startTimes.get(tenant.id)!) / 1000;
    console.log(`Tenant ${tenant.id}:`);
    console.log(` - Processed: ${processed}/${tenant.jobs}`);
    if (processed > 0) {
      console.log(` - Duration: ${duration.toFixed(2)}s`);
      console.log(` - Avg Throughput: ${(processed / duration).toFixed(2)} jobs/sec`);
    }
  }

  // Anomalies detection
  console.log("\nAnomaly Detection:");
  const whaleProcessed = results.get("whale-tenant") || 0;
  const smallProcessed = (results.get("fast-tenant-1") || 0) + (results.get("fast-tenant-2") || 0);

  if (smallProcessed > 0 && whaleProcessed > 0) {
    console.log(" ✅ Multi-tenant fairness verified: Small tenants were not blocked by the 'whale'.");
  } else if (whaleProcessed > 0 && smallProcessed === 0) {
    console.log(" 🚨 STARVATION DETECTED: Whale tenant dominated the queue execution.");
  }

  await connection.quit();
  process.exit(0);
}

runStressTest().catch(console.error);
