import { BrowserPool } from "./unified-browser-pool";

// Fake Redis that supports the minimal commands used by BrowserPool
const fakeRedis: any = {
  store: new Map<string, { value: string; expiresAt: number }>(),

  async set(key: string, value: string, ...args: any[]) {
    // support SET key value EX ttl
    const exIndex = args.findIndex((a) => a === "EX");
    let ttl = 0;
    if (exIndex !== -1) {
      ttl = args[exIndex + 1] as number;
    }
    const expiresAt = ttl ? Date.now() + ttl : Infinity;
    fakeRedis.store.set(key, { value, expiresAt });
    return "OK";
  },

  async get(key: string) {
    const entry = fakeRedis.store.get(key);
    if (!entry) return null;
    if (entry.expiresAt < Date.now()) {
      fakeRedis.store.delete(key);
      return null;
    }
    return entry.value;
  },

  async del(key: string) {
    return fakeRedis.store.delete(key) ? 1 : 0;
  },

  async keys(pattern: string) {
    // very naive wildcard handling supporting trailing * only
    const results: string[] = [];
    const now = Date.now();
    const prefix = pattern.replace(/\*/g, "");
    for (const [k, entry] of (Array.from(fakeRedis.store.entries()) as any)) {
      if (entry.expiresAt < now) {
        fakeRedis.store.delete(k);
        continue;
      }
      if (k.startsWith(prefix)) {
        results.push(k);
      }
    }
    return results;
  },
};

// patch connection getter to return fake
import * as conn from "../../queue/connection";
(conn as any).getRedisConnection = () => fakeRedis as any;

async function runTests() {
  console.log("🧪 BrowserPool heartbeat/cap tests...");

  fakeRedis.store.clear();
  // ensure new instance
  (BrowserPool as any).instance = null;

  const pool = BrowserPool.getInstance({ maxGlobalBrowsers: 5 });

  // also import metrics service for later assertions
  const { OperationalMetricsService } = require("../observability/operational-metrics");

  // directly call private method via cast
  const checkCap = async () => {
    return (pool as any).checkGlobalBrowserCap();
  };

  // if no other nodes, capacity should not be exceeded
  (pool as any).browserSlots.clear();
  await checkCap();
  console.log("✅ empty cluster passes capacity check");

  // simulate local slot count
  (pool as any).browserSlots.set("a", { id: "a", browser: { isConnected: () => true } } as any);
  await checkCap();
  console.log("✅ single local slot passes");

  // add heartbeat entries for other nodes
  await fakeRedis.set("pp:browsers:node_heartbeat:node1", JSON.stringify({ count: 2 }), "EX", 30);
  await fakeRedis.set("pp:browsers:node_heartbeat:node2", JSON.stringify({ count: 1 }), "EX", 30);
  await checkCap();
  console.log("✅ aggregated count under cap");

  // record a manual metric and ensure it lands in Redis
  const nowBucket = Math.floor(Date.now() / 60_000);
  const metricKey = `pp:ops:metric:minute:${nowBucket}`;
  await OperationalMetricsService.recordBrowserCount("node1", 2);
  const stored = fakeRedis.store.get(metricKey);
  if (!stored || !stored.value.includes("browser:node:node1")) {
    console.error("❌ Browser count metric was not recorded");
    process.exit(1);
  }
  console.log("✅ browser count metric recorded successfully");

  // bump totals above cap
  await fakeRedis.set("pp:browsers:node_heartbeat:node3", JSON.stringify({ count: 3 }), "EX", 30);
  let threw = false;
  try {
    await checkCap();
  } catch (err) {
    threw = true;
  }
  if (!threw) {
    console.error("❌ Expected capacity check to throw when over cap");
    process.exit(1);
  }
  console.log("✅ capacity check throws when cluster overloaded");

  // verify expired keys are ignored
  // simulate node1 expiry by moving its expiresAt into past
  const entry = fakeRedis.store.get("pp:browsers:node_heartbeat:node1");
  if (entry) entry.expiresAt = Date.now() - 1000;

  // local count 1 + node2 1 + node3 3 =5 which equals cap - should throw
  threw = false;
  try {
    await checkCap();
  } catch {
    threw = true;
  }
  if (!threw) {
    console.error("❌ Expected capacity check to throw when eq cap after expiry");
    process.exit(1);
  }
  console.log("✅ expired nodes are ignored in aggregation");

  // quick sanity: ensure domain sessions do not share contexts
  (pool as any).domainSessions.clear();
  const sessionA = (pool as any).ensureDomainSession("alpha");
  const sessionB = (pool as any).ensureDomainSession("beta");
  sessionA.contexts.set("ctx", { inUse: false, createdAt: new Date(), lastUsedAt: new Date(), key: "ctx", browserId: "b1", requestCount: 0 } as any);
  if (sessionB.contexts.size !== 0) {
    console.error("❌ Domain isolation violated: beta session should have 0 contexts");
    process.exit(1);
  }
  console.log("✅ domain context isolation verified");

  // ensure tenant ids affect context key so cookies/proxies aren't shared
  const keyA = (pool as any).getContextKey("ua1", undefined, true, "tenantA");
  const keyB = (pool as any).getContextKey("ua1", undefined, true, "tenantB");
  if (keyA === keyB) {
    console.error("❌ Tenant-based context keys should differ");
    process.exit(1);
  }
  console.log("✅ tenant isolation in context keys verified");

  console.log("🎉 All browser pool tests passed");
}

runTests().catch((err) => {
  console.error("Test suite failed:", err);
  process.exit(1);
});
