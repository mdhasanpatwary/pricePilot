import { startLockHeartbeat } from "./lock-heartbeat";
import type { LockHandle } from "./distributed-lock";

/**
 * Test suite for lock heartbeat service
 */

async function runTests() {
  console.log("🧪 Testing Lock Heartbeat Service...\n");

  // Test 1: heartbeat can be started and stopped
  console.log("Test 1: startLockHeartbeat returns cancel function");
  const mockHandle: LockHandle = {
    lockKey: "test:lock",
    token: "test-token-123",
    acquiredAt: Date.now(),
    ttlMs: 30000,
  };

  let refreshCalls = 0;
  // Patch the service for testing
  const originalRefresh = (await import("./distributed-lock")).DistributedLockService.refreshLock;
  (await import("./distributed-lock")).DistributedLockService.refreshLock = async () => {
    refreshCalls++;
    return true;
  };

  const cancel = startLockHeartbeat(mockHandle, {
    interval: 100, // 100ms for tests
    abortOnFailure: false,
  });

  // Wait for some heartbeats
  await new Promise((resolve) => setTimeout(resolve, 350));
  await cancel();

  if (refreshCalls < 2) {
    console.error("❌ Expected at least 2 refresh calls, got:", refreshCalls);
    process.exit(1);
  }
  console.log(`✅ Heartbeat executed ${refreshCalls} times before cancel`);

  // Test 2: abort on failure when requested
  console.log("\nTest 2: abortOnFailure throws when refresh fails");
  refreshCalls = 0;
  let failureThrown = false;

  (await import("./distributed-lock")).DistributedLockService.refreshLock = async () => {
    refreshCalls++;
    return false; // simulate failure
  };

  try {
    const cancel2 = startLockHeartbeat(mockHandle, {
      interval: 50,
      abortOnFailure: true,
    });

    // Give it time to fail
    await new Promise((resolve) => setTimeout(resolve, 200));
    await cancel2();
  } catch (e) {
    failureThrown = true;
    console.log("  - Error thrown as expected:", (e as Error).message);
  }

  if (!failureThrown) {
    console.error("❌ Expected error to be thrown on refresh failure");
    process.exit(1);
  }
  console.log("✅ Abort on failure works correctly");

  // Restore original
  (await import("./distributed-lock")).DistributedLockService.refreshLock = originalRefresh;

  console.log("\n✅ All lock heartbeat tests passed!");
}

runTests().catch(console.error);
