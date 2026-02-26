import { DistributedLockService, type LockHandle } from "./distributed-lock";

/**
 * Test suite for distributed lock service
 */

// Fake Redis implementation for testing
const fakeRedis: any = {
  store: new Map<string, { value: string; expiresAt: number }>(),

  async set(key: string, value: string, mode1: string, arg1: number, mode2: string) {
    if (mode2 === "NX") {
      if (this.store.has(key)) {
        return null;
      }
      // mode1 should be "PX", arg1 should be ttl in milliseconds
      const expiresAt = Date.now() + (mode1 === "PX" ? arg1 : 1000);
      this.store.set(key, { value, expiresAt });
      return "OK";
    }
    return null;
  },

  async get(key: string) {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (entry.expiresAt < Date.now()) {
      this.store.delete(key);
      return null;
    }
    return entry.value;
  },

  async del(key: string) {
    if (this.store.has(key)) {
      this.store.delete(key);
      return 1;
    }
    return 0;
  },

  async eval(script: string, _numKeys: number, key: string, token: string, newTtl?: number) {
    // simulate Lua compare-and-delete or refresh
    if (script.includes("DEL")) {
      const current = await this.get(key);
      if (current === token) {
        await this.del(key);
        return 1;
      }
      return 0;
    }
    if (script.includes("PX") && newTtl) {
      const current = await this.get(key);
      if (current === token) {
        const entry = this.store.get(key);
        if (entry) {
          entry.expiresAt = Date.now() + newTtl;
        }
        return "OK";
      }
      return 0;
    }
    return 0;
  },

  clear() {
    this.store.clear();
  },
};

// Patch getRedisConnection
import * as conn from "./connection";
(conn as any).getRedisConnection = () => fakeRedis as any;

async function runTests() {
  console.log("🧪 Testing DistributedLockService...\n");

  // Test 1: acquire lock succeeds
  console.log("Test 1: acquireLock succeeds");
  fakeRedis.clear();
  const lock1 = await DistributedLockService.acquireLock({
    lockKey: "test:job:1",
    ttlMs: 30000,
    jobType: "CRITICAL",
  });
  if (!lock1 || lock1.token.length === 0) {
    console.error("❌ Failed to acquire lock");
    process.exit(1);
  }
  console.log("✅ Lock acquired:", lock1.lockKey);

  // Test 2: duplicate acquire fails
  console.log("\nTest 2: duplicate acquireLock fails");
  const lock2 = await DistributedLockService.acquireLock({
    lockKey: "test:job:1",
    ttlMs: 30000,
    jobType: "CRITICAL",
  });
  if (lock2 !== null) {
    console.error("❌ Should not acquire duplicate lock");
    process.exit(1);
  }
  console.log("✅ Duplicate lock rejected");

  // Test 3: release with correct token succeeds
  console.log("\nTest 3: release with correct token succeeds");
  const released = await DistributedLockService.releaseLock(lock1);
  if (!released) {
    console.error("❌ Failed to release lock");
    process.exit(1);
  }
  console.log("✅ Lock released");

  // Test 4: acquire after release succeeds
  console.log("\nTest 4: acquire after release succeeds");
  const lock3 = await DistributedLockService.acquireLock({
    lockKey: "test:job:1",
    ttlMs: 30000,
    jobType: "CRITICAL",
  });
  if (!lock3) {
    console.error("❌ Should acquire lock after release");
    process.exit(1);
  }
  console.log("✅ Lock reacquired after release");

  // Test 5: refresh lock
  console.log("\nTest 5: refresh lock extends TTL");
  const originalTtl = lock3.ttlMs;
  const refreshed = await DistributedLockService.refreshLock(lock3, 60000);
  if (!refreshed || lock3.ttlMs <= originalTtl) {
    console.error("❌ Failed to refresh lock");
    process.exit(1);
  }
  console.log("✅ Lock refreshed, new TTL:", lock3.ttlMs);

  // Test 6: release with wrong token fails
  console.log("\nTest 6: release with wrong token fails");
  const wrongHandle: LockHandle = {
    ...lock3,
    token: "wrong-token",
  };
  const badRelease = await DistributedLockService.releaseLock(wrongHandle);
  if (badRelease) {
    console.error("❌ Should not release with wrong token");
    process.exit(1);
  }
  console.log("✅ Wrong token rejected");

  // Verify lock still held
  const stillHeld = await fakeRedis.get(lock3.lockKey);
  if (!stillHeld) {
    console.error("❌ Lock should still be held");
    process.exit(1);
  }

  // Cleanup
  await DistributedLockService.releaseLock(lock3);

  // Test 7: executeWithLock with CRITICAL job type
  console.log("\nTest 7: executeWithLock with CRITICAL job succeeds");
  fakeRedis.clear();
  const result = await DistributedLockService.executeWithLock(
    "CRITICAL",
    "test:cron:critical",
    async () => {
      console.log("  - Inside job, lock held");
      return "success";
    },
    { ttlMs: 30000 },
  );
  if (result !== "success") {
    console.error("❌ executeWithLock failed");
    process.exit(1);
  }
  console.log("✅ executeWithLock completed");

  // Test 8: executeWithLock skips when lock unavailable on ANALYTICS
  console.log("\nTest 8: executeWithLock skips ANALYTICS when lock unavailable");
  fakeRedis.clear();
  // pre-acquire lock
  await DistributedLockService.acquireLock({
    lockKey: "test:cron:analytics",
    ttlMs: 30000,
    jobType: "ANALYTICS",
  });
  const resultSkipped = await DistributedLockService.executeWithLock(
    "ANALYTICS",
    "test:cron:analytics",
    async () => "should-not-run",
    { ttlMs: 30000 },
  );
  if (resultSkipped !== null) {
    console.error("❌ Should skip ANALYTICS job when lock unavailable");
    process.exit(1);
  }
  console.log("✅ ANALYTICS job skipped when lock unavailable");

  // Test 9: executeWithLock aborts CRITICAL when lock unavailable
  console.log("\nTest 9: executeWithLock aborts CRITICAL when lock unavailable");
  fakeRedis.clear();
  // pre-acquire lock
  await DistributedLockService.acquireLock({
    lockKey: "test:cron:critical2",
    ttlMs: 30000,
    jobType: "CRITICAL",
  });
  let aborted = false;
  try {
    await DistributedLockService.executeWithLock(
      "CRITICAL",
      "test:cron:critical2",
      async () => "should-not-run",
      { ttlMs: 30000 },
    );
  } catch (e) {
    aborted = true;
    console.log("  - CRITICAL job aborted as expected");
  }
  if (!aborted) {
    console.error("❌ Should abort CRITICAL job when lock unavailable");
    process.exit(1);
  }
  console.log("✅ CRITICAL job aborted when lock unavailable");

  console.log("\n✅ All distributed lock tests passed!");
}

runTests().catch(console.error);
