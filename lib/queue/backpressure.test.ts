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

testBackpressure().catch(console.error);
