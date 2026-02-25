import { Queue, Worker, Job } from "bullmq";
import IORedis from "ioredis";
import { calculateJobPriority } from "../lib/queue/priority";

const REDIS_URL = process.env.REDIS_URL || "redis://127.0.0.1:6379";
const QUEUE_NAME = "test-fairness-queue";

async function simulate() {
  const connection = new IORedis(REDIS_URL, { maxRetriesPerRequest: null });
  const queue = new Queue(QUEUE_NAME, { connection });

  console.log("🧹 Cleaning up test queue...");
  await queue.obliterate({ force: true });

  console.log("🚀 Injecting jobs with Priority Engine...");

  // Tenant A: 20 jobs (Large batch, FREE tier) -> Lower priority (Higher score)
  const priorityA = calculateJobPriority({ tenantTier: "FREE", jobSize: 1000 });
  for (let i = 1; i <= 20; i++) {
    await queue.add("job-a", { tenantId: "tenant-a", id: i }, { groupId: "tenant-a", priority: priorityA });
  }

  // Tenant B: 5 jobs (Small update, ENTERPRISE tier) -> Higher priority (Lower score)
  const priorityB = calculateJobPriority({ tenantTier: "ENTERPRISE", jobSize: 1 });
  for (let i = 1; i <= 5; i++) {
    await queue.add("job-b", { tenantId: "tenant-b", id: i }, { groupId: "tenant-b", priority: priorityB });
  }

  console.log(`- Tenant A Priority: ${priorityA}`);
  console.log(`- Tenant B Priority: ${priorityB}`);

  console.log("👷 Starting worker (concurrency: 1)...");

  const completionOrder: string[] = [];

  const worker = new Worker(QUEUE_NAME, async (job: Job) => {
    // Simulate short processing time
    await new Promise(resolve => setTimeout(resolve, 50));
    completionOrder.push(job.data.tenantId);
    return { success: true };
  }, { connection, concurrency: 1 });

  // Wait for all jobs to complete
  console.log("⏳ Waiting for processing...");
  await new Promise(resolve => setTimeout(resolve, 3000));

  await worker.close();
  await connection.quit();

  console.log("\n📊 Completion Order (First 10):", completionOrder.slice(0, 10).join(" -> "));

  const firstFive = completionOrder.slice(0, 5);
  const allBFirst = firstFive.every(t => t === "tenant-b");

  if (allBFirst) {
    console.log("✅ SUCCESS: Tenant B (Small/Premium) jumped ahead of Tenant A (Large/Free)! Priority is enforced.");
  } else {
    console.error("❌ FAILURE: Tenant B was NOT prioritized.");
    process.exit(1);
  }
}

simulate().catch(console.error);
