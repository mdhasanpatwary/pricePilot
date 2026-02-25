import dotenv from "dotenv";
import { Queue, QueueEvents, Worker, Job, DelayedError } from "bullmq";
import { getRedisConnection } from "@/lib/queue/connection";
import { disconnectRedis } from "@/lib/redis";
import { TenantConcurrencyLimiter } from "@/lib/services/scheduling/tenant-concurrency-limiter";
import { GlobalScrapeBudgetService } from "@/lib/services/scheduling/global-scrape-budget";

dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

const runId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const queueName = `pp-exp-capacity-${runId}`;

interface CapJobData {
  tenantId: string;
  productId: string;
  enqueuedAt: number;
}

const metrics = {
  waitTimes: [] as number[],
  denials: 0,
  peakRss: 0,
};

async function processor(job: Job<CapJobData>) {
  const waitTime = Date.now() - job.data.enqueuedAt;

  if (job.attemptsMade === 0) {
    metrics.waitTimes.push(waitTime);
  }

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
      await new Promise(resolve => setTimeout(resolve, 500));
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

async function runCapacityScenario(tenantsCount: number, fixedConcurrency: number = 15) {
  process.env.GLOBAL_MAX_ACTIVE = String(fixedConcurrency);

  metrics.waitTimes = [];
  metrics.denials = 0;
  metrics.peakRss = 0;

  const redis = getRedisConnection();
  const queue = new Queue<CapJobData>(queueName, { connection: redis as any });
  const events = new QueueEvents(queueName, { connection: redis as any });

  await events.waitUntilReady();

  // Create jobs: 5 jobs per tenant to simulate a burst
  const jobsPerTenant = 5;
  const totalJobs = tenantsCount * jobsPerTenant;
  const tenants = Array.from({ length: tenantsCount }, (_, i) => `tenant-${i}`);

  for (let i = 0; i < totalJobs; i++) {
    const tenantId = tenants[i % tenantsCount];
    await queue.add(
      "scrape-mock",
      { tenantId, productId: `prod-${i}`, enqueuedAt: Date.now() },
      { removeOnComplete: true, removeOnFail: true }
    );
  }

  const worker = new Worker<CapJobData>(
    queueName,
    processor,
    {
      connection: redis as any,
      concurrency: fixedConcurrency
    }
  );

  await new Promise<void>((resolve) => {
    let completedCount = 0;
    worker.on("completed", () => {
      completedCount++;
      process.stdout.write(`\r[${completedCount}/${totalJobs}] completed`);
      if (completedCount === totalJobs) {
        console.log("");
        resolve();
      }
    });
    worker.on("failed", (job, err) => {
      console.error(`\nJob failed: ${err.message}`);
    });
  });

  const p50Wait = calculatePercentile(metrics.waitTimes, 50);
  const p95Wait = calculatePercentile(metrics.waitTimes, 95);

  await worker.close();
  await events.close();
  await queue.drain(true);
  await queue.close();

  return {
    tenantsCount,
    p50Wait,
    p95Wait,
    maxRss: metrics.peakRss,
    denials: metrics.denials,
  };
}

async function runCapacityPlanning() {
  console.log("--- Distributed Capacity Planning ---");
  const scenarios = [10, 30, 50];
  const results = [];

  for (const tenants of scenarios) {
    console.log(`Running scenario with ${tenants} tenants...`);
    const res = await runCapacityScenario(tenants, 15);
    results.push(res);
  }

  console.log("\n--- Capacity Report ---");
  console.log("| Tenants | p50 Wait (ms) | p95 Wait (ms) | Max RSS (MB) | Denials |");
  console.log("|---------|---------------|---------------|--------------|---------|");

  for (const r of results) {
    console.log(`| ${r.tenantsCount.toString().padStart(7)} | ${r.p50Wait.toString().padStart(13)} | ${r.p95Wait.toString().padStart(13)} | ${r.maxRss.toString().padStart(12)} | ${r.denials.toString().padStart(7)} |`);
  }
}

async function main() {
  await runCapacityPlanning();
  await disconnectRedis();
}

main().catch(console.error);
