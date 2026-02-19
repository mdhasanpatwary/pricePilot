import dotenv from "dotenv";
import { Queue, QueueEvents, Worker } from "bullmq";

dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

import { prisma } from "@/lib/prisma";
import { getRedisConnection } from "@/lib/queue/connection";
import { disconnectRedis } from "@/lib/redis";
import { RetryQueueService } from "@/lib/services/retry-queue";
import { TenantConcurrencyLimiter } from "@/lib/services/scheduling/tenant-concurrency-limiter";
import { ConcurrencyLimiter } from "@/lib/services/concurrency-limiter";
import { checkRateLimit } from "@/lib/ratelimit";

interface CheckResult {
  name: string;
  passed: boolean;
  detail: string;
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  let timeout: NodeJS.Timeout | null = null;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timeout = setTimeout(() => reject(new Error(`${label} timed out after ${timeoutMs}ms`)), timeoutMs);
      }),
    ]);
  } finally {
    if (timeout) {
      clearTimeout(timeout);
    }
  }
}

async function verifyRetryQueueAtomicClaim(runId: string): Promise<CheckResult> {
  const service = RetryQueueService.getInstance();
  const tenantId = `verify-tenant-${runId}`;
  const siteId = `verify-site-${runId}`;
  const now = new Date();

  const rows = Array.from({ length: 12 }).map((_, idx) => ({
    tenantId,
    siteId,
    productId: `verify-product-${runId}-${idx}`,
    url: `https://example.com/p/${runId}/${idx}`,
    retryCount: 0,
    maxRetries: 4,
    nextRetryAt: new Date(now.getTime() - 60_000),
    status: "PENDING",
    lastError: null as string | null,
  }));

  await prisma.retryQueue.createMany({ data: rows });

  try {
    const results = await Promise.all(
      Array.from({ length: 6 }).map(() => service.claimNextRetryBatch(3)),
    );

    const claimedIds = results.flat().map((item) => item.id);
    const uniqueIds = new Set(claimedIds);

    const remainingPending = await prisma.retryQueue.count({
      where: { tenantId, siteId, status: "PENDING" },
    });

    assert(claimedIds.length === uniqueIds.size, "duplicate retry items were claimed by concurrent workers");
    assert(claimedIds.length > 0, "expected at least one claimed retry item");
    assert(
      claimedIds.length + remainingPending === 12,
      `claimed (${claimedIds.length}) + pending (${remainingPending}) must equal seeded (12)`,
    );

    return {
      name: "Atomic retry claim",
      passed: true,
      detail: `claimed=${claimedIds.length}, unique=${uniqueIds.size}, pending=${remainingPending}, no duplicates`,
    };
  } finally {
    await prisma.retryQueue.deleteMany({ where: { tenantId, siteId } });
  }
}

async function verifyTenantLimiter(runId: string): Promise<CheckResult> {
  const limiter = new TenantConcurrencyLimiter({ maxPerTenant: 2, leaseTtlMs: 120_000 });
  const tenantId = `verify-tenant-limit-${runId}`;

  const p1 = await limiter.tryAcquire(tenantId);
  const p2 = await limiter.tryAcquire(tenantId);
  const p3 = await limiter.tryAcquire(tenantId);

  assert(p1 !== null, "first tenant permit should be granted");
  assert(p2 !== null, "second tenant permit should be granted");
  assert(p3 === null, "third tenant permit should be denied at max=2");

  await limiter.release(p1!);

  const p4 = await limiter.tryAcquire(tenantId);
  assert(p4 !== null, "permit should be granted after release");

  await limiter.release(p2!);
  await limiter.release(p4!);

  return {
    name: "Tenant concurrency limiter",
    passed: true,
    detail: "maxPerTenant=2 enforced with Redis counter",
  };
}

async function verifyDistributedConcurrencyLimiter(runId: string): Promise<CheckResult> {
  const site = `verify-site-concurrency-${runId}`;
  const limiterA = new ConcurrencyLimiter({ minConcurrency: 1, maxConcurrency: 2, initialConcurrency: 2 });
  const limiterB = new ConcurrencyLimiter({ minConcurrency: 1, maxConcurrency: 2, initialConcurrency: 2 });
  const limiterC = new ConcurrencyLimiter({ minConcurrency: 1, maxConcurrency: 2, initialConcurrency: 2 });

  await Promise.all([limiterA.acquireSlot(site), limiterB.acquireSlot(site)]);

  let thirdAcquired = false;
  const thirdPromise = limiterC.acquireSlot(site).then(() => {
    thirdAcquired = true;
  });

  await new Promise((resolve) => setTimeout(resolve, 300));
  assert(!thirdAcquired, "third slot acquired before release; distributed cap not enforced");

  limiterA.releaseSlot(site);
  await withTimeout(thirdPromise, 2000, "third distributed slot acquire");

  limiterB.releaseSlot(site);
  limiterC.releaseSlot(site);

  return {
    name: "Distributed site concurrency",
    passed: true,
    detail: "third acquire blocked until one of first two released",
  };
}

async function verifyBullMqDedupe(runId: string): Promise<CheckResult> {
  const redis = getRedisConnection();
  const queueName = `pp-verify-mw-${runId}`;
  const jobId = `verify-job-${runId}`;

  const queue = new Queue(queueName, { connection: redis as any });
  const events = new QueueEvents(queueName, { connection: redis as any });

  let processed = 0;
  const worker = new Worker(
    queueName,
    async () => {
      processed += 1;
      return { ok: true };
    },
    { connection: redis as any, concurrency: 3 },
  );

  await events.waitUntilReady();

  try {
    const job1 = await queue.add("verify", { runId }, { jobId, removeOnComplete: true, removeOnFail: true });

    let dedupeWorked = false;
    try {
      const job2 = await queue.add("verify", { runId, duplicate: true }, { jobId, removeOnComplete: true, removeOnFail: true });
      dedupeWorked = job2.id === job1.id;
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      dedupeWorked = msg.includes("already exists") || msg.includes("Job");
    }

    assert(dedupeWorked, "BullMQ duplicate jobId dedupe failed");

    await withTimeout(job1.waitUntilFinished(events, 5000), 7000, "bullmq job completion");
    assert(processed === 1, `expected exactly 1 processed job, got ${processed}`);

    return {
      name: "BullMQ jobId dedupe",
      passed: true,
      detail: "duplicate add did not execute second copy",
    };
  } finally {
    await worker.close();
    await events.close();
    await queue.drain(true);
    await queue.close();
  }
}

async function verifyGlobalFailOpenKey(): Promise<CheckResult> {
  const redis = getRedisConnection();
  const key = "pp:ratelimit:disable:global";

  await redis.set(key, "1", "EX", 30);

  let limiterCalled = 0;
  const fakeLimiter = {
    async limit(_identifier: string) {
      limiterCalled += 1;
      return {
        success: false,
        limit: 1,
        remaining: 0,
        reset: Date.now() + 1000,
      };
    },
  };

  try {
    const result = await checkRateLimit(fakeLimiter, "verify-user");
    assert(result.success === true, "cluster fail-open key should bypass limiter and return success");
    assert(limiterCalled === 0, "limiter should not be called when global disable key is set");

    return {
      name: "Global fail-open propagation",
      passed: true,
      detail: "Redis disable key bypassed limiter path",
    };
  } finally {
    await redis.del(key);
  }
}

async function main(): Promise<void> {
  const runId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const checks: Array<() => Promise<CheckResult>> = [
    () => verifyRetryQueueAtomicClaim(runId),
    () => verifyTenantLimiter(runId),
    () => verifyDistributedConcurrencyLimiter(runId),
    () => verifyBullMqDedupe(runId),
    () => verifyGlobalFailOpenKey(),
  ];

  const results: CheckResult[] = [];

  for (const check of checks) {
    try {
      const result = await check();
      results.push(result);
      console.log(`✅ ${result.name}: ${result.detail}`);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      const failed: CheckResult = {
        name: check.name || "Unknown check",
        passed: false,
        detail: msg,
      };
      results.push(failed);
      console.error(`❌ ${failed.name}: ${failed.detail}`);
    }
  }

  const failed = results.filter((r) => !r.passed);
  const passed = results.length - failed.length;

  console.log("\n--- Multi-worker Readiness Summary ---");
  console.log(`Total checks: ${results.length}`);
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed.length}`);

  if (failed.length > 0) {
    process.exitCode = 1;
  }

  await prisma.$disconnect();
  await disconnectRedis();
}

main().catch(async (error) => {
  console.error("❌ Fatal verification error:", error);
  await prisma.$disconnect();
  await disconnectRedis();
  process.exit(1);
});
