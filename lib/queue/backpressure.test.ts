import { calculateDelayMs } from "./backpressure";

async function testBackpressure() {
  console.log("🧪 Testing Backpressure Logic...");

  const minDelay = 1000;
  const maxDelay = 300000;
  const threshold = 500;

  const scenarios = [
    { depth: 100, expected: 0 },
    { depth: 501, expected: "> minDelay" },
    { depth: 1000, expected: "> 501 depth delay" },
    { depth: 10000, expected: "maxDelay" },
  ];

  let prevDelay = -1;

  for (const s of scenarios) {
    const delay = calculateDelayMs(s.depth, threshold, minDelay, maxDelay);
    console.log(`- Depth ${String(s.depth).padEnd(5)}: Delay = ${delay}ms`);

    if (s.depth > threshold && delay < minDelay) {
        console.error(`❌ Assertion Failed: Delay ${delay} < minDelay ${minDelay} at depth ${s.depth}`);
        process.exit(1);
    }

    if (prevDelay !== -1 && delay < prevDelay && s.depth > threshold) {
        console.error(`❌ Assertion Failed: Non-monotonic delay growth at depth ${s.depth}`);
        process.exit(1);
    }
    prevDelay = delay;
  }

  console.log("✅ All backpressure delay assertions passed.");
}

// additional sanity tests that were added in hardening phase 2
// simple in‑memory redis stub used in several tests
const fakeRedis: any = {
  store: new Map<string, any>(),
  async incr(key: string) {
    const v = Number(this.store.get(key) || 0) + 1;
    this.store.set(key, v);
    return v;
  },
  async expire(_key: string, _secs: number) {
    return true;
  },
  async set(key: string, val: any, mode?: string, ttl?: number) {
    if (mode === "PX" && typeof ttl === "number") {
      this.store.set(key, Date.now() + ttl);
    } else {
      this.store.set(key, val);
    }
    return "OK";
  },
  async ttl(key: string) {
    const v = this.store.get(key);
    if (v === undefined) return -2;
    if (typeof v === "number" && v > Date.now()) return Math.ceil((v - Date.now()) / 1000);
    return -1;
  },
};

// patch connection helper to return our fake instance
import * as conn from "./connection";
(conn as any).getRedisConnection = () => fakeRedis as any;

async function testEnqueueAssertions() {
  console.log("🧪 Testing enqueueWithBackpressure tenant assertions");

  const dummyQueue = {
    name: "dummy",
    async add(_name: string, _data: any, _opts: any) {
      return { id: "x" };
    },
    async getJobCounts() {
      return { waiting: 0, active: 0, prioritized: 0, "waiting-children": 0, delayed: 0 };
    },
  } as any;

  let thrown = false;
  try {
    await enqueueWithBackpressure(dummyQueue, "job", { /*no tenantId*/ } as any, {}, { producer: "t", strategy: "delay" });
  } catch (e: any) {
    console.log("✔️  expected error received:", e.message);
    thrown = true;
  }
  if (!thrown) {
    console.error("❌ enqueueWithBackpressure did not throw for missing tenantId");
    process.exit(1);
  }

  console.log("✅ Tenant assertion test passed.");
}

// ensure cooldown is respected after a flood event
async function testCooldown() {
  console.log("🧪 Testing cooldown window");
  // queue that signals excessive depth to trigger flood
  const counts = { waiting: 6000, active: 0, prioritized: 0, "waiting-children": 0, delayed: 0 };
  const dummyQueue = {
    name: "q1",
    async add(_name: string, _data: any, opts: any) {
      // reflect delay for verification
      return opts;
    },
    async getJobCounts() {
      return counts;
    },
  } as any;

  // first call with delay strategy should succeed and set cooldown
  const opts1: any = {};
  await enqueueWithBackpressure(dummyQueue, "job", { tenantId: "t1" }, opts1, { producer: "t", strategy: "delay" });
  if (!opts1.delay || opts1.delay <= 0) {
    console.error("❌ expected initial backpressure delay");
    process.exit(1);
  }

  // second call with reject strategy should throw due to cooldown
  let threw = false;
  try {
    await enqueueWithBackpressure(dummyQueue, "job", { tenantId: "t1" }, {}, { producer: "t", strategy: "reject" });
  } catch (err: any) {
    console.log("✔️ cooldown rejection observed", err.message);
    threw = true;
  }
  if (!threw) {
    console.error("❌ expected cooldown rejection");
    process.exit(1);
  }

  console.log("✅ Cooldown logic works");
}

// verify we fail when too many delays occur in short window
async function testRepeatLoop() {
  console.log("🧪 Testing repeat-delay loop detection");
  const counts = { waiting: 6000, active: 0, prioritized: 0, "waiting-children": 0, delayed: 0 };
  const dummyQueue = {
    name: "q2",
    async add(_name: string, _data: any, opts: any) {
      return opts;
    },
    async getJobCounts() {
      return counts;
    },
  } as any;

  // run the default limit (10) times
  for (let i = 0; i < 10; i++) {
    await enqueueWithBackpressure(dummyQueue, "job", { tenantId: "t2" }, {}, { producer: "t", strategy: "delay" });
  }

  let threw2 = false;
  try {
    await enqueueWithBackpressure(dummyQueue, "job", { tenantId: "t2" }, {}, { producer: "t", strategy: "delay" });
  } catch (err: any) {
    console.log("✔️ repeat-loop rejection", err.message);
    threw2 = true;
  }
  if (!threw2) {
    console.error("❌ repeated-delay loop did not trigger error");
    process.exit(1);
  }

  console.log("✅ Repeat-delay guard works");
}


async function testSnapshot() {
  console.log("🧪 Testing getQueueDepthSnapshot");
  const fakeQueue = {
    async getJobCounts() {
      return {
        waiting: 1,
        active: 2,
        prioritized: 3,
        "waiting-children": 4,
        delayed: 5,
      };
    },
    name: "fake",
  } as any;

  const snap = await getQueueDepthSnapshot(fakeQueue);
  console.log("snapshot result", snap);
  if (snap.counts.delayed !== 5) {
    console.error("❌ delayed count wrong", snap);
    process.exit(1);
  }
  if (snap.depth !== 1 + 2 + 3 + 4) {
    console.error("❌ depth calculation wrong", snap);
    process.exit(1);
  }
  console.log("✅ Snapshot test passed.");
}

testBackpressure().catch(console.error);
testEnqueueAssertions().catch(console.error);
testSnapshot().catch(console.error);

testBackpressure().catch(console.error);
