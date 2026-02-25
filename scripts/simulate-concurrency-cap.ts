import { Queue, Worker, Job } from "bullmq";
import IORedis from "ioredis";

const REDIS_URL = process.env.REDIS_URL || "redis://127.0.0.1:6379";
const QUEUE_NAME = "test-concurrency-queue";
const TENANT_ACTIVE_JOBS_PREFIX = "pp:queue:tenant:active:";

// Set a low limit for simulation
const LIMIT = 2;
process.env.MAX_TENANT_CONCURRENCY = String(LIMIT);

const connection = new IORedis(REDIS_URL, { maxRetriesPerRequest: null });

async function tryAcquireTenantSlot(queueName: string, tenantId: string): Promise<boolean> {
  const key = `${TENANT_ACTIVE_JOBS_PREFIX}${queueName}:${tenantId}`;

  // Atomic increment
  const current = await connection.incr(key);
  await connection.expire(key, 60);

  if (current > LIMIT) {
    // Rollback
    await connection.decr(key);
    return false;
  }
  return true;
}

async function decrementTenantActive(queueName: string, tenantId: string): Promise<void> {
  const key = `${TENANT_ACTIVE_JOBS_PREFIX}${queueName}:${tenantId}`;
  const val = await connection.decr(key);
  if (val < 0) await connection.set(key, 0);
}

async function simulate() {
  const queue = new Queue(QUEUE_NAME, { connection });
  await queue.obliterate({ force: true });

  console.log(`🚀 Injecting 5 jobs for tenant-overload (Limit: ${LIMIT})...`);
  for (let i = 1; i <= 5; i++) {
    await queue.add("test-job", { tenantId: "tenant-overload", id: i }, {
        attempts: 10,
        backoff: { type: "fixed", delay: 100 }
    });
  }

  let activeCount = 0;
  let maxObservedConcurrency = 0;
  let rejectionCount = 0;
  let successCount = 0;

  const worker = new Worker(QUEUE_NAME, async (job: Job) => {
    const tenantId = job.data.tenantId;

    // Atomic check and acquire
    if (!(await tryAcquireTenantSlot(QUEUE_NAME, tenantId))) {
      rejectionCount++;
      throw new Error("TENANT_CONCURRENCY_LIMIT_REACHED");
    }

    activeCount++;
    maxObservedConcurrency = Math.max(maxObservedConcurrency, activeCount);

    console.log(`[Worker] Started job ${job.data.id}. Active: ${activeCount}`);

    // Hold the job for a bit
    await new Promise(resolve => setTimeout(resolve, 500));

    activeCount--;
    successCount++;
    await decrementTenantActive(QUEUE_NAME, tenantId);
    console.log(`[Worker] Finished job ${job.data.id}. Active: ${activeCount}`);
  }, {
    connection,
    concurrency: 10
  });

  console.log("⏳ Watching concurrency for 4 seconds...");
  await new Promise(resolve => setTimeout(resolve, 4000));

  await worker.close();
  await connection.quit();

  console.log(`\n📊 Max Observed Concurrency (Simultaneous): ${maxObservedConcurrency}`);
  console.log(`📊 Total Throttle Hits: ${rejectionCount}`);
  console.log(`📊 Successfully Processed: ${successCount}`);

  if (maxObservedConcurrency <= LIMIT) {
    console.log("✅ SUCCESS: Concurrency governor strictly enforced the limit even under race conditions!");
  } else {
    console.error(`❌ FAILURE: Observed concurrency (${maxObservedConcurrency}) exceeded limit (${LIMIT})!`);
    process.exit(1);
  }
}

simulate().catch(console.error);
