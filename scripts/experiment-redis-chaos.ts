import dotenv from "dotenv";
import { Queue, QueueEvents, Worker, Job } from "bullmq";
import { getRedisConnection } from "@/lib/queue/connection";
import { disconnectRedis } from "@/lib/redis";
import { GlobalScrapeBudgetService } from "@/lib/services/scheduling/global-scrape-budget";
import Redis from "ioredis";

dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

const runId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const queueName = `pp-exp-chaos-${runId}`;

interface ChaosJobData {
  id: string;
}

const metrics = {
  completed: 0,
  failed: 0,
};

async function processor(job: Job<ChaosJobData>) {
  const globalBudget = GlobalScrapeBudgetService.getInstance();
  const permitResult = await globalBudget.acquire(`prod-${job.data.id}`);

  if (!permitResult.acquired || !permitResult.permit) {
    throw new Error("Failed to acquire global budget");
  }

  try {
    // Simulate long-running work that spans across the Chaos event
    await new Promise(resolve => setTimeout(resolve, 3000));
    metrics.completed++;
  } finally {
    // We explicitly DO NOT release the permit here to simulate a worker crashing mid-job
    // without executing its finally blocks.
  }
}

async function runChaos() {
  console.log("--- Starting Redis Chaos Experiment ---");
  // Override getLeaseTtlMs on the prototype so it returns 5000 bypassing the minimum constraint
  const origGetLeaseTtlMs = GlobalScrapeBudgetService.prototype.getLeaseTtlMs;
  GlobalScrapeBudgetService.prototype.getLeaseTtlMs = function() {
    return 5000;
  };

  process.env.GLOBAL_MAX_ACTIVE = "10";

  const redis = getRedisConnection();
  await redis.del("global:scrape:active", "global:scrape:leases");

  const rawRedisClientUrl = process.env.REDIS_URL || "redis://localhost:6379";

  const queue = new Queue<ChaosJobData>(queueName, { connection: redis as any });
  const events = new QueueEvents(queueName, { connection: redis as any });

  await events.waitUntilReady();

  // Enqueue 8 jobs
  const totalJobs = 8;
  for (let i = 0; i < totalJobs; i++) {
    await queue.add("chaos-mock", { id: String(i) }, { removeOnComplete: true, removeOnFail: true });
  }

  console.log(`Enqueued ${totalJobs} jobs.`);

  let workerRedisClient: Redis | null = new Redis(rawRedisClientUrl, {
    maxRetriesPerRequest: null,
  });

  const worker = new Worker<ChaosJobData>(
    queueName,
    processor,
    {
      connection: workerRedisClient as any,
      concurrency: 10
    }
  );

  console.log("Worker started. Waiting for jobs to begin execution...");

  // Wait a bit so jobs are acquired and permits are taken
  await new Promise(resolve => setTimeout(resolve, 1000));

  const globalBudget = GlobalScrapeBudgetService.getInstance();

  // Use primary redis to check active keys before chaos
  let initialActive = Number(await redis.get("global:scrape:active"));
  console.log(`Initial active global permits (pre-chaos): ${initialActive}`);

  console.log("🔥 SIMULATING WORKER CRASH: Stopping worker and abandoning permits!");
  await worker.close(true); // violently close without waiting for jobs

  // Stale global permits should exist now
  let midChaosActive = Number(await redis.get("global:scrape:active"));
  console.log(`Active permits immediately after crash (expected positive since they were abandoned): ${midChaosActive}`);

  // Wait for lease TTL to pass
  console.log("Waiting for leases to expire (5500ms)...");
  await new Promise(resolve => setTimeout(resolve, 5500));

  const cleaned = await globalBudget.cleanupStaleLeases();
  console.log(`Cleanup run manually. Stale permits cleaned: ${cleaned}`);

  let finalActive = Number(await redis.get("global:scrape:active"));
  console.log(`Final active global permits: ${finalActive}`);

  console.log(`Jobs completed during/after chaos: ${metrics.completed}`);

  if (finalActive === 0 && midChaosActive > 0 && cleaned > 0) {
    console.log("✅ Chaos resiliency verified: stale permits were successfully cleaned after outage.");
  } else if (finalActive === 0 && midChaosActive === 0) {
    console.log("ℹ️ No stale permits detected (maybe worker didn't acquire them or Redis was not disconnected gracefully).");
  } else {
    console.log("❌ Chaos test failed to recover stale permits.");
  }

  await events.close();
  await queue.drain(true);
  await queue.close();
  workerRedisClient.disconnect();
}

async function main() {
  await runChaos();
  await disconnectRedis();
}

main().catch(console.error);
