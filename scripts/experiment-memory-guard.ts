import dotenv from "dotenv";
import { Queue, QueueEvents, Worker, Job } from "bullmq";
import { getRedisConnection } from "@/lib/queue/connection";
import { disconnectRedis } from "@/lib/redis";

dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

const runId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const queueName = `pp-exp-memory-${runId}`;

interface MemoryJobData {
  id: string;
}

// Keep a reference to large objects to artificially inflate RSS
const memoryHogs: Buffer[] = [];

async function processor(job: Job<MemoryJobData>) {
  // Allocate 50MB per job execution to quickly hit RSS limits
  const chunk = Buffer.alloc(50 * 1024 * 1024);
  chunk.fill(Math.random().toString());
  memoryHogs.push(chunk);

  const rssMb = Math.round(process.memoryUsage().rss / 1024 / 1024);
  console.log(`[Job ${job.data.id}] Executed. Current RSS: ${rssMb} MB`);

  await new Promise(resolve => setTimeout(resolve, 500));
}

let workerRssMonitorTimer: NodeJS.Timeout | null = null;
let maxSeenRss = 0;

function startFakeWorkerGuard(worker: Worker) {
  // We mimic start-worker.ts's guard but lower thresholds for testing
  const maxRssMb = 300; // Trigger shutdown if > 300MB
  const warnRssMb = 200;

  workerRssMonitorTimer = setInterval(() => {
    const rssMb = Math.round(process.memoryUsage().rss / 1024 / 1024);
    maxSeenRss = Math.max(maxSeenRss, rssMb);

    if (rssMb >= warnRssMb && rssMb <= maxRssMb) {
      console.warn(`[WorkerMemoryGuard] RSS spike detected: ${rssMb}MB (Warn threshold: ${warnRssMb}MB)`);
    } else if (rssMb > maxRssMb) {
      console.error(`[WorkerMemoryGuard] RSS limit exceeded (${rssMb}MB > ${maxRssMb}MB), triggering graceful restart!`);

      if (workerRssMonitorTimer) clearInterval(workerRssMonitorTimer);

      // Simulate graceful restart by closing worker
      worker.close(false).then(() => {
        console.log("Worker gracefully closed due to memory guard.");
      });
    }
  }, 500);
}

async function runMemoryGuard() {
  console.log("--- Starting Worker Memory Guard Experiment ---");
  console.log("Goal: Verify that artificially inflating memory triggers warnings and graceful restarts.");

  const redis = getRedisConnection();
  const queue = new Queue<MemoryJobData>(queueName, { connection: redis as any });
  const events = new QueueEvents(queueName, { connection: redis as any });

  await events.waitUntilReady();

  // Enqueue 20 jobs
  const totalJobs = 20;
  for (let i = 0; i < totalJobs; i++) {
    await queue.add("mem-mock", { id: String(i) }, { removeOnComplete: true, removeOnFail: true });
  }

  const worker = new Worker<MemoryJobData>(
    queueName,
    processor,
    {
      connection: redis as any,
      concurrency: 5
    }
  );

  console.log("Worker started. Pumping memory allocations...");
  startFakeWorkerGuard(worker);

  // Wait for queue to drain or worker to be killed
  await new Promise<void>((resolve) => {
    const checkInterval = setInterval(async () => {
      if (worker.isClosed) {
        clearInterval(checkInterval);
        resolve();
      }

      const waiting = await queue.getWaitingCount();
      const active = await queue.getActiveCount();

      // If we somehow finished all jobs without triggering the limit (unlikely with 20*50MB > 300MB)
      if (waiting === 0 && active === 0) {
        clearInterval(checkInterval);
        resolve();
      }
    }, 1000);
  });

  console.log("\n--- Experiment Results ---");
  console.log(`Peak RSS reached: ${maxSeenRss} MB`);

  if (worker.isClosed) {
    console.log("✅ Memory guard successfully triggered a graceful restart before OOM.");
  } else {
    console.log("❌ Worker finished all jobs without triggering proxy memory guard (or test failed).");
    await worker.close();
  }

  if (workerRssMonitorTimer) clearInterval(workerRssMonitorTimer);

  await events.close();
  await queue.drain(true);
  await queue.close();
}

async function main() {
  await runMemoryGuard();
  await disconnectRedis();
}

main().catch(console.error);
