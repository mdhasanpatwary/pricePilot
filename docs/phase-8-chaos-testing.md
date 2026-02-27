# Phase 8 - Chaos & Failure Testing

## Overview

Phase 8 implements comprehensive chaos engineering tests to validate system resilience, failure recovery, and degradation behavior under six failure scenarios:

1. **Redis Unavailability** - System behavior when cache/session store is offline
2. **Worker Crash** - Job recovery when scraper workers crash mid-execution
3. **Browser Crash** - Browser pool recovery when Chromium crashes
4. **Network Timeout Flood** - Circuit breaker and retry logic under network stress
5. **Anti-Bot Protection Spike** - Rate limiting and backoff behavior
6. **High-Scale Tenant** - Memory stability and pagination at 100k product scale

---

## Test Infrastructure

### Core Components

**File:** `lib/testing/chaos-simulator.ts`

Central orchestration framework for chaos injection:

```typescript
// Inject a chaos scenario
await chaosSimulator.injectChaos({
  type: "redis-unavailable",
  durationMs: 10000,
  severity: "high",
  failCriteria: ["recovery-within-60s", "graceful-degradation"],
});

// Monitor state
const isActive = await chaosSimulator.isChaosModeActive();
const scenario = await chaosSimulator.getActiveScenario();

// Record metrics
await chaosSimulator.recordMetrics("redis-unavailable", {
  jobsCompleted: 5,
  jobsFailed: 2,
  recoveryDuration: 3000,
});

// Stop chaos
await chaosSimulator.stopChaos();
```

**File:** `lib/testing/failure-scenarios.ts`

Specific failure implementations:

```typescript
// Each scenario function accepts ChaosScenarioConfig
const result = await simulateRedisUnavailable({
  type: "redis-unavailable",
  durationMs: 10000,
  severity: "high",
});

// Returns detailed ChaosResult
interface ChaosResult {
  scenario: ChaosScenarioType;
  passed: boolean;
  failureReasons: string[];
  metrics: {
    jobsCompleted: number;
    jobsFailed: number;
    jobsTimeout: number;
    recoveryDuration?: number;
  };
}
```

---

## Scenario Details

### 1. Redis Unavailability

**What It Tests:**
- Graceful degradation when Redis is offline
- Fail-closed behavior for critical operations
- Fail-soft behavior for analytics/cleanup jobs
- Recovery time after Redis reconnection

**Implementation:**

```typescript
// Marks Redis as unavailable
await redis.setex("pp:chaos:redis-down", ttlMs, "true");

// System monitors Redis availability
// Critical jobs abort when Redis unavailable
// Analytics jobs skip when Redis unavailable
// Cache reads degrade gracefully
```

**Expected Behavior:**

| Component | Behavior |
|-----------|----------|
| Critical Cron | Abort immediately, retry in next cycle |
| Analytics Cron | Skip this execution, resume next cycle |
| Active Sessions | Fail-closed, require Redis |
| Browse Product List | Serve cached data or error gracefully |
| Rate Limiting | Disabled (all requests allowed during outage) |

**Pass Criteria:**

```typescript
failCriteria: [
  "graceful-degradation",  // System doesn't crash
  "recovery-within-60s",   // Redis becomes responsive < 60s
  "zero-data-loss",        // No jobs silently lost
]
```

**Monitoring Metrics:**

```
redis-unavailable:
  jobsCompleted: 0-5 (acceptable during downtime)
  jobsFailed: 0 (critical jobs should abort, not fail)
  recoveryDuration: < 60000ms
```

---

### 2. Worker Crash Recovery

**What It Tests:**
- Automatic job requeue when worker crashes
- Distributed lock release after crash
- Dead letter queue routing for terminal failures
- Multi-instance coordination

**Implementation:**

```typescript
// Marks a worker node as dead
await redis.setex(`pp:chaos:worker-dead:${nodeId}`, ttlMs, "true");

// Jobs targeted at this node are requeued
// Lock held by this node are released via TTL
// Monitoring detects node death and reallocates work
```

**Expected Behavior:**

| Job State | Action |
|-----------|--------|
| In Progress | Aborted, requeue to main queue |
| Delayed | Move to active queue for retry |
| Already Retried 5x | Route to DLQ |
| Lock Held | Released by Redis TTL expiry |

**Pass Criteria:**

```typescript
failCriteria: [
  "zero-data-loss",        // All enqueued jobs processed
  "recovery-within-60s",   // Worker replacement < 60s
  "no-hanging-jobs",       // No jobs stuck in limbo
]
```

**Monitoring Metrics:**

```
worker-crash:
  jobsCompleted: High (most jobs requeue and succeed)
  jobsFailed: Low (only terminal failures)
  recoveryDuration: < 30000ms (multi-instance failover)
```

---

### 3. Browser Crash Recovery

**What It Tests:**
- Browser pool reconstruction after Chromium crash
- Scrape job retry on browser failure
- Memory stability after reconnection
- Rate limiting on browser restart

**Implementation:**

```typescript
// Marks browser pool as crashed
await redis.setex("pp:chaos:browser-crashed", ttlMs, JSON.stringify({
  timestamp: Date.now(),
  severity: "high",
}));

// Browser spawn calls fail
// Active scrapes are retried
// Browser pool attempts reconnection with backoff
```

**Expected Behavior:**

| Component | Behavior |
|-----------|----------|
| Scrape Job Request | Queued, waits for browser recovery |
| Browser Pool Spawn | Fails, returns error |
| Existing Pages | Automatically closed |
| Worker Memory | Returns to baseline after recovery |

**Pass Criteria:**

```typescript
failCriteria: [
  "recovery-within-60s",   // Browser pool online < 60s
  "no-hanging-jobs",       // Scrapes don't hang indefinitely
  "sub-second-latency",    // Post-recovery response time < 1s
]
```

**Monitoring Metrics:**

```
browser-crash:
  jobsCompleted: 0 during crash, ramps up post-recovery
  jobsFailed: Temporary spike, then stabilizes
  recoveryDuration: 5000-30000ms (depending on severity)
```

---

### 4. Network Timeout Flood

**What It Tests:**
- Exponential backoff retry logic
- Circuit breaker behavior
- Cache/fallback serving under timeout conditions
- Request timeout handling

**Implementation:**

```typescript
// Marks network as degraded
await redis.setex("pp:chaos:network-timeout", ttlMs, JSON.stringify({
  delayMs: 5000,
  severity: "high",
}));

// All requests incur artificial 5s delay
// Requests exceeding timeout are rejected
// Retries use exponential backoff (100ms, 200ms, 400ms, ...)
```

**Expected Behavior:**

| Request Type | Behavior |
|--------------|----------|
| API Calls | Timeout after 5s, trigger retry |
| Background Jobs | Increment backoff counter |
| Dashboard Loads | Use cached/stale data |
| WebSocket Connections | Reconnect with backoff |

**Pass Criteria:**

```typescript
failCriteria: [
  "graceful-degradation",  // System serves cached data
  "recovery-within-60s",   // Network recovers < 60s
  "sub-second-latency",    // Response time < 1s post-recovery
]
```

**Monitoring Metrics:**

```
network-timeout:
  jobsCompleted: Decreases during flood
  jobsTimeout: Increases, then decreases after recovery
  recoveryDuration: 10000-30000ms
```

---

### 5. Anti-Bot Protection Spike

**What It Tests:**
- Rate limiter enforcement
- Backoff/retry after rate limit hit
- Request prioritization during spike
- Recovery without thundering herd

**Implementation:**

```typescript
// Enables rate limiting
await redis.setex("pp:chaos:antibot-active", ttlMs, JSON.stringify({
  retryAfterSeconds: 60,
  severity: "high",
}));

// First N requests per second succeed
// Remaining requests get 429 Too Many Requests
// Client must backoff per Retry-After header
```

**Expected Behavior:**

| Scenario | Behavior |
|----------|----------|
| Burst Traffic | First burst succeeds, subsequent bursts blocked |
| Single Client Retry | Exponential backoff, respects Retry-After |
| Multiple Clients | Per-tenant limits, per-IP limits enforced |
| Post-Recovery | No thundering herd (staggered recovery) |

**Pass Criteria:**

```typescript
failCriteria: [
  "recovery-within-60s",   // Rate limits normalize < 60s
  "graceful-degradation",  // System doesn't crash under load
  "no-hanging-jobs",       // Queued jobs don't hang
]
```

**Monitoring Metrics:**

```
anti-bot-spike:
  jobsCompleted: Drops to 0 at peak, ramps after recovery
  jobsFailed: Spike in 429 errors
  recoveryDuration: 10000-60000ms (depends on backoff)
```

---

### 6. High-Scale Tenant

**What It Tests:**
- Memory stability at 100k products
- Pagination correctness under scale
- Queue handling for large result sets
- CPU efficiency during batch operations

**Implementation:**

```typescript
// Enqueues 100,000 test products
for (let i = 0; i < 100000; i++) {
  await redis.lpush(`pp:queue:scraper:${tenantId}`, `product-${i}`);
}

// System processes and paginates through queue
// Memory usage monitored
// Query performance measured
```

**Expected Behavior:**

| Operation | Behavior |
|-----------|----------|
| Enqueue 100k jobs | Complete in < 30s |
| Query first page | Return 1000 items with cursor |
| Query next page | Use cursor, not offset |
| Full iteration | SCAN instead of KEYS (non-blocking) |

**Pass Criteria:**

```typescript
failCriteria: [
  "no-memory-leak",        // Heap growth < 200MB
  "sub-second-latency",    // Pagination response < 1s
  "correct-pagination",    // Cursor pagination works end-to-end
]
```

**Monitoring Metrics:**

```
high-scale-tenant:
  jobsCompleted: 100000 (or complete after timeout)
  jobsTimeout: 0 (no timeout during processing)
  recoveryDuration: N/A
  heapDelta: < 200MB
```

---

## Running Chaos Tests

### Manual Scenario Injection

**Via API:**

```bash
# Inject Redis unavailability for 10 seconds
curl -X POST http://localhost:3000/api/v1/internal/chaos/inject \
  -H "Content-Type: application/json" \
  -H "X-Internal-Mode: true" \
  -d '{
    "type": "redis-unavailable",
    "durationMs": 10000,
    "severity": "high",
    "failCriteria": ["graceful-degradation", "recovery-within-60s"]
  }'

# Response:
# {
#   "chaosId": "chaos-1708963200000",
#   "scenario": "redis-unavailable",
#   "durationMs": 10000,
#   "startedAt": "2026-02-27T12:00:00Z"
# }

# Check status
curl http://localhost:3000/api/v1/internal/chaos/status/chaos-1708963200000 \
  -H "X-Internal-Mode: true"

# Get results
curl http://localhost:3000/api/v1/internal/chaos/results/chaos-1708963200000 \
  -H "X-Internal-Mode: true"
```

### Automated Test Suite

**Run all E2E tests:**

```bash
npm run test:chaos
# or
npx playwright test e2e/chaos-testing.spec.ts
```

**Run specific scenario:**

```bash
npx playwright test e2e/chaos-testing.spec.ts -g "Redis Unavailability"
npx playwright test e2e/chaos-testing.spec.ts -g "Worker Crash"
```

**Run chaos scenario script:**

```bash
bash scripts/run-chaos-tests.sh
```

### Continuous Testing

Add to CI pipeline:

```yaml
# .github/workflows/chaos.yml
name: Chaos Testing

on:
  schedule:
    - cron: "0 2 * * *"  # Daily at 2 AM UTC
  workflow_dispatch:     # Manual trigger

jobs:
  chaos:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        
      - run: npm ci
      - run: npm run build
      - run: npm run dev &
      - run: sleep 5  # Wait for server startup
      
      - run: npm run test:chaos
      
      - uses: actions/upload-artifact@v3
        if: always()
        with:
          name: chaos-results
          path: playwright-report/
```

---

## Pass/Fail Criteria

### Evaluation Matrix

| Scenario | Criteria | Pass | Fail |
|----------|----------|------|------|
| Redis Down | Graceful degradation | System responsive | Crash/502 |
| Redis Down | Recovery < 60s | Recovered | Still down @ 60s |
| Worker Crash | Zero data loss | All jobs processed | Jobs lost |
| Browser Crash | Recovery < 60s | Browser online | Still down @ 60s |
| Network Timeout | Sub-second latency | Response < 1s | Response > 5s |
| Anti-Bot Spike | No hang | Jobs process | Jobs hang/timeout |
| High-Scale | Memory < 200MB Δ | Bounded growth | Unbounded leak |
| High-Scale | Pagination works | Cursor-based paging | Offset-based paging |

### Failure Reasons

Common failure reasons captured in `ChaosResult.failureReasons`:

```
- "Expected zero job failures, but some jobs failed"
- "Hanging jobs detected: jobs did not complete within timeout"
- "No graceful degradation: system appeared completely non-responsive"
- "Recovery took Xms, exceeding 60s threshold"
- "System rate-limited for too long, not backing off requests"
- "Memory usage exceeded 1GB during scale test: XYZmb"
- "Pagination returned fewer items than page size despite available items"
```

---

## Metrics & Observability

### Chaos Metrics Collected

```typescript
interface ChaosMetrics {
  timestamp: number;
  scenario: ChaosScenarioType;
  jobsCompleted: number;        // Jobs that finished successfully
  jobsFailed: number;            // Jobs that failed/errored
  jobsTimeout: number;           // Jobs that exceeded timeout
  errorsEncountered: string[];   // Unique error messages
  recoveryDuration?: number;     // Time to recover (ms)
  heapDelta?: number;            // Memory change during test
}
```

### Querying Results

```bash
# Get all Redis scenarios
curl http://localhost:3000/api/v1/internal/chaos/metrics/redis-unavailable \
  -H "X-Internal-Mode: true"

# Get high-scale metrics
curl http://localhost:3000/api/v1/internal/chaos/metrics/high-scale-tenant \
  -H "X-Internal-Mode: true"

# Clear metrics
curl -X DELETE http://localhost:3000/api/v1/internal/chaos/metrics/redis-unavailable \
  -H "X-Internal-Mode: true"
```

### Integration with Phase 6 Observability

Chaos events are recorded as metrics:

```typescript
// Phase 6 metrics collection
await metricsCollector.recordCustomMetric({
  name: "chaos.scenario.executed",
  value: 1,
  tags: {
    scenario: "redis-unavailable",
    passed: true,
    recoveryDuration: "3000",
  },
});

// Alert on repeated failures
await alertRulesEvaluator.evaluateRule({
  id: "chaos-repeated-failure",
  query: 'chaos.scenario.executed{passed=false}',
  threshold: 3,
  window: "1h",
  severity: "CRITICAL",
});
```

---

## Troubleshooting

### Chaos Won't Inject

**Issue:** Chaos injection returns 409 Conflict

**Solution:** Stop currently active chaos:

```bash
curl -X POST http://localhost:3000/api/v1/internal/chaos/stop \
  -H "X-Internal-Mode: true"
```

### Tests Timeout

**Issue:** E2E tests hang on chaos scenario

**Solution:** Increase timeout in `playwright.config.ts`:

```typescript
use: {
  timeout: 60000,  // 60s per test
}
```

### Memory Not Bounded

**Issue:** High-scale test doesn't complete due to memory

**Analysis:**
1. Check for memory leaks: `node --inspect app.js`
2. Verify pagination uses SCAN, not KEYS
3. Confirm job dequeue cleans up references

### Recovery Takes Too Long

**Issue:** System takes > 60s to recover from chaos

**Debug with:**

```bash
# Check Redis connectivity
npm run redis:cli PING

# Check queue depth
npm run redis:cli LLEN pp:queue:scraper

# Check DLQ size
npm run redis:cli LLEN pp:dlq:scraper

# Check worker status
curl http://localhost:3000/api/v1/internal/workers \
  -H "X-Internal-Mode: true"
```

---

## Expected Outcomes

After Phase 8 implementation, the system should:

✅ **Demonstrate resilience** across all 6 failure scenarios  
✅ **Recover automatically** from transient failures (< 60s)  
✅ **Prevent data loss** with confirmed zero job loss  
✅ **Handle scale** with 100k products without memory leaks  
✅ **Gracefully degrade** when non-critical systems fail  
✅ **Report failures** with detailed metrics and root causes  

### Target Scores (Phase 8 Validation)

```
Security Hardening:        >= 8.5  ✓ (Phase 7 hardened)
Queue Stability:           >= 8.0  ✓ (Retries, DLQ, locks)
Scraper Stability:         >= 8.0  ✓ (Browser recovery, memory)
Scalability:               >= 7.5  ✓ (100k products handles)
Observability & Chaos:     >= 8.0  ✓ (Phase 8 metrics)
Overall System Hardening: >= 8.0  ✓ (All phases pass)
```

---

## Related Files

- [Chaos Simulator](../lib/testing/chaos-simulator.ts)
- [Failure Scenarios](../lib/testing/failure-scenarios.ts)
- [E2E Tests](../e2e/chaos-testing.spec.ts)
- [Chaos API Routes](../app/api/v1/internal/chaos)
- [Test Runner Script](../scripts/run-chaos-tests.sh)
- [Phase 6 Observability](./phase-6-observability.md)
- [Phase 7 Security](./phase-7-security.md)
