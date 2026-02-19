import assert from "node:assert/strict";

import { BrowserPool as RootPool } from "@/lib/services/browser-pool";
import { BrowserPool as BotPool } from "@/lib/services/bot-protection/browser-pool";
import { BrowserPool as LegacyPool } from "@/lib/services/legacy/browser-pool";

function checkStatsShape(stats: any): void {
  const requiredKeys = [
    "total",
    "inUse",
    "available",
    "maxContexts",
    "domains",
    "maxContextsPerDomain",
    "totalBrowsers",
    "inUseBrowsers",
    "availableBrowsers",
    "maxGlobalBrowsers",
    "memoryRssMb",
    "totalInstances",
    "inUseInstances",
    "availableInstances",
    "maxConcurrent",
  ];

  for (const key of requiredKeys) {
    assert.ok(key in stats, `missing stats key: ${key}`);
  }
}

async function main(): Promise<void> {
  console.log("[Test] Unified BrowserPool export wiring...");

  const root = RootPool.getInstance();
  const bot = BotPool.getInstance();
  const legacy = LegacyPool.getInstance();

  assert.equal(root, bot, "root and bot BrowserPool must resolve to same singleton");
  assert.equal(root, legacy, "root and legacy BrowserPool must resolve to same singleton");

  console.log("[Pass] All BrowserPool exports point to one singleton");

  await root.init(7);
  const stats = root.getStats();
  checkStatsShape(stats);
  assert.equal(stats.maxContexts, 7, "init(maxContexts) should update global context cap");

  console.log("[Pass] init/getStats contract is valid");

  const health = root.healthCheck();
  assert.equal(typeof health.healthy, "boolean", "health.healthy should be boolean");
  assert.ok(Array.isArray(health.reasons), "health.reasons should be array");
  checkStatsShape(health.stats);

  console.log("[Pass] healthCheck contract is valid");

  await RootPool.shutdown();

  const fresh = RootPool.getInstance();
  assert.notEqual(fresh, root, "shutdown should reset singleton instance");

  console.log("[Pass] shutdown lifecycle reset is valid");
  console.log("\nUnified BrowserPool scaffold tests passed.");
}

main().catch((error) => {
  console.error("Unified BrowserPool scaffold tests failed:", error);
  process.exit(1);
});
