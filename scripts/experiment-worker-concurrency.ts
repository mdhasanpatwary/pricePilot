import dotenv from "dotenv";
import { Queue, QueueEvents, Worker, Job, DelayedError } from "bullmq";
import { getRedisConnection } from "@/lib/queue/connection";
import { disconnectRedis } from "@/lib/redis";
import { TenantConcurrencyLimiter } from "@/lib/services/scheduling/tenant-concurrency-limiter";
import { GlobalScrapeBudgetService } from "@/lib/services/scheduling/global-scrape-budget";

dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

const runId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const queueName = `pp-exp-concurrency-${runId}`;

interface ExpJobData {
  tenantId: string;
  productId: string;
  enqueuedAt: number;
}

const metrics = {
  waitTimes: [] as number[],
  denials: 0,
  completed: 0,
  peakRss: 0,
};

async function processor(job: Job<ExpJobData>) {
  const waitTime = Date.now() - job.data.enqueuedAt;

  // Track wait time on first attempt
  if (job.attemptsMade === 0) {
    metrics.waitTimes.push(waitTime);
  }

  // Update memory usage
  const rssMb = Math.round(process.memoryUsage().rss / 1024 / 1024);
  metrics.peakRss = Math.max(metrics.peakRss, rssMb);

  const tenantLimiter = new TenantConcurrencyLimiter();
  const globalBudget = GlobalScrapeBudgetService.getInstance();

  const tenantPermit = await tenantLimiter.tryAcquire(job.data.tenantId);
  if (!tenantPermit) {
    metrics.denials++;
    await job.moveToDelayed(Date.now() + 1000, job.token);
    throw new DelayedError();
  }

  try {
    const globalPermitResult = await globalBudget.acquire(job.data.productId);
    if (!globalPermitResult.acquired || !globalPermitResult.permit) {
      metrics.denials++;
      await job.moveToDelayed(Date.now() + 1000, job.token);
      throw new DelayedError();
    }

    try {
      // Simulate real scrape work duration (e.g. network + parsing)
      await new Promise(resolve => setTimeout(resolve, 800));
      metrics.completed++;
    } finally {
      await globalBudget.release(globalPermitResult.permit);
    }
  } finally {
    await tenantLimiter.release(tenantPermit);
  }
}

function calculatePercentile(values: number[], pct: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.max(0, Math.floor(sorted.length * (pct / 100)) - 1);
  return sorted[index];
}

async function runExperiment(concurrency: number, totalJobs: number, numTenants: number) {
  process.env.GLOBAL_MAX_ACTIVE = "10";
  console.log(`\n--- Running Experiment: Concurrency ${concurrency} ---`);

  // Reset metrics
  metrics.waitTimes = [];
  metrics.denials = 0;
  metrics.completed = 0;
  metrics.peakRss = 0;

  const redis = getRedisConnection();
  const queue = new Queue<ExpJobData>(queueName, { connection: redis as any });
  const events = new QueueEvents(queueName, { connection: redis as any });

  await events.waitUntilReady();

  // Enqueue jobs
  const tenants = Array.from({ length: numTenants }, (_, i) => `tenant-${i}`);
  for (let i = 0; i < totalJobs; i++) {
    const tenantId = tenants[i % numTenants];
    await queue.add(
      "scrape-mock",
      { tenantId, productId: `prod-${i}`, enqueuedAt: Date.now() },
      { removeOnComplete: true, removeOnFail: true }
    );
  }

  const startTime = Date.now();

  const worker = new Worker<ExpJobData>(
    queueName,
    processor,
    {
      connection: redis as any,
      concurrency
    }
  );

  // Wait until all jobs complete
  await new Promise<void>((resolve) => {
    const checkInterval = setInterval(async () => {
      const waiting = await queue.getWaitingCount();
      const active = await queue.getActiveCount();
      const delayed = await queue.getDelayedCount();

      if (waiting === 0 && active === 0 && delayed === 0 && metrics.completed === totalJobs) {
        clearInterval(checkInterval);
        resolve();
      }
    }, 500);
  });

  const durationSec = (Date.now() - startTime) / 1000;
  const throughput = totalJobs / durationSec;

  console.log(`Results for Concurrency ${concurrency}:`);
  console.log(`  Duration: ${durationSec.toFixed(2)}s`);
  console.log(`  Throughput: ${throughput.toFixed(2)} jobs/sec`);
  console.log(`  Denials (reques): ${metrics.denials}`);
  console.log(`  Peak RSS: ${metrics.peakRss} MB`);
  console.log(`  Wait p50: ${calculatePercentile(metrics.waitTimes, 50)} ms`);
  console.log(`  Wait p95: ${calculatePercentile(metrics.waitTimes, 95)} ms`);

  await worker.close();
  await events.close();
  await queue.drain(true);
  await queue.close();
}

async function main() {
  const totalJobs = 50;
  const numTenants = 10;

  // Run with different concurrency levels
  await runExperiment(10, totalJobs, numTenants); // 1.0x
  await runExperiment(15, totalJobs, numTenants); // 1.5x
  await runExperiment(20, totalJobs, numTenants); // 2.0x

  await disconnectRedis();
}

main().catch(console.error);
