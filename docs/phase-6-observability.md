# Phase 6 - Observability & Detection

## Overview

Phase 6 implements comprehensive observability metrics and proactive alerting to detect operational anomalies before they impact system performance. The infrastructure combines time-series metrics collection with configurable alert rules to provide visibility into queue health, worker capacity, and data pipeline integrity.

## Metrics Architecture

All Phase 6 metrics use the existing Redis-backed `MetricsCollector` service, which provides:

- **Time-series storage** via Redis sorted sets (7-day detailed retention)
- **Aggregation support** (COUNT, AVG, SUM, MAX, MIN, P95, P99)
- **Multi-tenant isolation** via optional `tenantId` parameter
- **Automatic TTL management** to prevent unbounded growth
- **Graceful degradation** if Redis becomes unavailable

### Metric Recording Interface

```typescript
async recordQueueDepth(queueName: string, depth: number, tenantId?: string): Promise<void>
async recordDelayedActiveRatio(queueName: string, ratio: number, tenantId?: string): Promise<void>
async recordRetry(queueName: string, amount: number, tenantId?: string): Promise<void>
async recordMemorySnapshot(rssMb: number): Promise<void>
async recordBrowserCount(nodeId: string, count: number): Promise<void>
async recordCronDuration(jobKey: string, durationMs: number): Promise<void>
async recordDLQLength(queueName: string, length: number): Promise<void>
```

## Metrics Breakdown

### 1. Queue Depth (per-tenant)

**Purpose:** Track job accumulation in queues to detect backlog buildup.

**Recording Point:** [backpressure.ts](../lib/queue/backpressure.ts) — called during enqueue with backpressure checks.

**Metric Key Pattern:** `metrics:queue_depth:<queueName>:<tenantId>`

**Example:**
```typescript
import { metricsCollector } from '@/lib/services/monitoring/metrics-collector';

// After fetching queue snapshot
const snapshot = await getQueueDepthSnapshot(queue);
await metricsCollector.recordQueueDepth(queue.name, snapshot.depth, tenantId);
```

**Alert Rule:** "Queue Depth Upward Drift"
- Triggers when 1-hour average queue depth > 300 jobs
- Severity: WARNING
- Helps identify slow workers or upstream producer flooding

---

### 2. Delayed vs Active Job Ratio

**Purpose:** Monitor the proportion of delayed jobs relative to active jobs, which can indicate backpressure or retry storms.

**Recording Point:** Worker event handlers — when job status changes.

**Metric Key Pattern:** `metrics:queue_delayed_ratio:<queueName>:<tenantId>`

**Calculation:** `delayed_count / active_count` (clamped to [0, 10])

**Example:**
```typescript
const snapshot = await getQueueDepthSnapshot(queue);
const ratio = snapshot.counts.delayed / Math.max(1, snapshot.counts.active);
await metricsCollector.recordDelayedActiveRatio(queue.name, ratio, tenantId);
```

**Use Case:** Early detection of backpressure conditions before queues become critically backed up.

---

### 3. Retry Rate per Job Type

**Purpose:** Track retry attempts by queue/job type to identify systemic failures.

**Recording Point:** [retry-queue.ts](../lib/services/retry-queue.ts) — already instrumented via `OperationalMetricsService.recordRetryEvent()`.

**Phased Enhancement:** Now also supports per-queue breakdown via `recordRetry()` in MetricsCollector.

**Metric Key Pattern:** `metrics:retry_count:<queueName>`

**Example:**
```typescript
// In retry-queue.ts when claiming batch
await metricsCollector.recordRetry(queue.name, claimed.length, tenantId);
```

**Alert Rule:** "Retry Spike by Job Type"
- Triggers when retries > 50 in 5-minute window
- Severity: WARNING
- Indicates a class of failures (e.g., all scraping jobs failing due to network issue)

---

### 4. Worker Memory (RSS)

**Purpose:** Monitor heap memory growth in worker processes to detect leaks.

**Recording Point:** [unified-browser-pool.ts](../lib/services/browser/unified-browser-pool.ts) — called when acquiring browser context.

**Metric Key Pattern:** `metrics:memory_rss:workers`

**Example:**
```typescript
import { metricsCollector } from '@/lib/services/monitoring/metrics-collector';

const memMb = process.memoryUsage().heapUsed / (1024 * 1024);
await metricsCollector.recordMemorySnapshot(memMb);
```

**Alert Rule:** "Memory Slope Increase"
- Triggers when 1-hour average RSS > 1GB
- Severity: WARNING
- Helps identify memory leaks before OOM killer activates

---

### 5. Browser Count per Node

**Purpose:** Track browser instance allocation across worker nodes for capacity planning.

**Recording Point:** Node heartbeat interval or browser acquisition — per worker.

**Metric Key Pattern:** `metrics:browser_count:<nodeId>`

**Example:**
```typescript
import { metricsCollector } from '@/lib/services/monitoring/metrics-collector';

// Called periodically (e.g., every 30 seconds)
const activeBrowsers = this.getActiveBrowserCount();
await metricsCollector.recordBrowserCount(nodeId, activeBrowsers);
```

**Use Case:** Visibility into browser pool utilization; helps identify under-utilized nodes or capacity bottlenecks.

---

### 6. Cron Job Execution Duration

**Purpose:** Monitor cron job performance to detect slowdowns.

**Recording Point:** Cron endpoints — wrap handler with timer and call after completion.

**Metric Key Pattern:** `metrics:cron_duration:<jobKey>`

**Integration Example:**
```typescript
import { metricsCollector } from '@/lib/services/monitoring/metrics-collector';

async function POST(req: NextRequest) {
    const startMs = Date.now();
    try {
        await jobLogic();
    } finally {
        const durationMs = Date.now() - startMs;
        await metricsCollector.recordCronDuration('cleanup-sessions', durationMs);
    }
}
```

**Use Case:** Identify which cron jobs are taking longer than expected, potentially blocking others.

---

### 7. DLQ (Dead-Letter Queue) Length

**Purpose:** Track jobs that permanently failed and moved to DLQ.

**Recording Point:** Existing [monitor-dlq.ts](../scripts/monitor-dlq.ts) script — call periodically via cron.

**Metric Key Pattern:** `metrics:dlq_length:<queueName>`

**Existing Integration:**
```typescript
// scripts/monitor-dlq.ts
await OperationalMetricsService.recordDLQLength(dlq.name, total);
```

**Alert Rule:** "DLQ Threshold Breach"
- Triggers when DLQ ever exceeds 100 messages (MAX aggregation)
- Severity: CRITICAL
- Indicates persistent failures requiring investigation

---

## Alert Rules

All Phase 6 alert rules are registered via `initializeBuiltInAlertRules()` which is called at application startup.

### Alert Configuration

Each alert rule in the database (`MonitoringAlertRule`) includes:

- **metricType**: Metric to evaluate (e.g., `queue_depth`)
- **condition**: Operator (GT, LT, EQ) + aggregation type (AVG, SUM, MAX, etc.)
- **timeWindow**: Evaluation window in seconds
- **threshold**: Numeric comparison value
- **severity**: CRITICAL, WARNING, INFO
- **notificationChannels**: List of channels to notify (Slack, email, etc.)

### Example: Queue Depth Alert

```typescript
{
    name: 'Queue Depth Upward Drift',
    description: 'Triggers when queue depth shows sustained increases within 1 hour',
    severity: 'WARNING',
    enabled: true,
    metricType: 'queue_depth',
    condition: {
        operator: 'GT',
        aggregation: 'AVG',
    },
    timeWindow: 60 * 60, // 1 hour window
    threshold: 300, // Alert if average depth > 300 jobs
    notificationChannels: [],
    tenantId: null,
}
```

### Alert Evaluation Flow

1. Cron job `/api/v1/cron/evaluate-alerts` runs every 1-5 minutes
2. For each enabled alert rule:
   - Fetch metrics from Redis for the time window
   - Calculate aggregation (AVG, SUM, etc.)
   - Compare against threshold with operator (GT, LT, EQ)
   - If triggered, record in alert history
3. Deduplication layer prevents duplicate notifications within cooldown period
4. Route alerts to registered notification channels

---

## Integration Points

### Recording Metrics in Services

#### Queue Backpressure

```typescript
// lib/queue/backpressure.ts
export async function enqueueWithBackpressure<TData extends { tenantId: string }>(
    queue: Queue,
    name: string,
    data: TData,
    jobOptions: JobsOptions = {},
    decision: QueueBackpressureDecision,
) {
    const globalSnapshot = await getQueueDepthSnapshot(queue);
    const tenantDepth = await getTenantQueueDepth(queue.name, tenantId);

    // Record metrics
    await recordQueueDepthMetric(queue.name, globalSnapshot.depth);
    
    // NEW: Record per-tenant depth
    await metricsCollector.recordQueueDepth(queue.name, globalSnapshot.depth, tenantId);
    
    // NEW: Record delayed/active ratio
    const ratio = globalSnapshot.counts.delayed / Math.max(1, globalSnapshot.counts.active);
    await metricsCollector.recordDelayedActiveRatio(queue.name, ratio, tenantId);
    
    // ... rest of backpressure logic
}
```

#### Worker Event Handlers

```typescript
// lib/queue/worker.ts
worker.on('completed', async (job) => {
    await OperationalMetricsService.recordQueueLifecycle(
        queueName,
        'completed',
        tenantId,
        latencyMs
    );
    
    // NEW: Record snapshot for observability
    const snapshot = await getQueueDepthSnapshot(queue);
    await metricsCollector.recordDelayedActiveRatio(
        queueName,
        snapshot.counts.delayed / Math.max(1, snapshot.counts.active),
        tenantId
    );
});
```

#### Cron Jobs

```typescript
// app/api/v1/cron/cleanup-sessions/route.ts
export async function POST(req: NextRequest) {
    const startMs = Date.now();
    
    try {
        await withCronLock(
            req,
            'CLEANUP',
            'pp:cron:cleanup-sessions',
            async () => {
                // Job logic here
                const deleted = await prisma.scrapingSession.deleteMany({
                    where: { /* filters */ }
                });
                
                return NextResponse.json({ success: true, deleted });
            }
        );
    } finally {
        const durationMs = Date.now() - startMs;
        await metricsCollector.recordCronDuration(
            'cleanup-sessions',
            durationMs
        );
    }
}
```

#### Browser Pool

```typescript
// lib/services/browser/unified-browser-pool.ts
async getContext(tenantId: string) {
    // ... context acquisition logic
    
    // NEW: Record memory snapshot and browser count
    await metricsCollector.recordMemorySnapshot(this.getRssMb());
    await metricsCollector.recordBrowserCount(
        this.nodeId,
        this.getActiveBrowserCount()
    );
    
    return context;
}
```

---

## Querying Metrics

### Via MetricsCollector

```typescript
import { metricsCollector } from '@/lib/services/monitoring/metrics-collector';

const metrics = await metricsCollector.getMetrics(
    'queue_depth',      // metric type
    3600,               // time window in seconds (1 hour)
    'tenant-123'        // optional tenant ID
);

console.log(metrics.aggregates);
// {
//   count: 60,       // 60 samples
//   avg: 250,        // average queue depth
//   min: 100,        // minimum
//   max: 450,        // maximum
//   p95: 420,        // 95th percentile
//   p99: 440,        // 99th percentile
//   sum: 15000,
// }
```

### Via Alert Evaluation

The `evaluateRules()` method automatically aggregates metrics matching each rule's time window and criteria:

```typescript
const alerts = await alertRulesEvaluator.evaluateRules();
// Returns array of triggered alerts with context
```

---

## Alerts Dashboard Integration

The `/admin/alerts` dashboard displays:

- Active alerts grouped by severity
- Alert history with trend visualization
- Manual acknowledge/dismiss actions
- Custom alert rule configuration UI
- Notification channel settings

---

## Next Steps

### Implementation Checklist

- [ ] Integrate `recordQueueDepth()` into backpressure enqueue logic
- [ ] Integrate `recordDelayedActiveRatio()` into worker event handlers
- [ ] Integrate `recordMemorySnapshot()` into browser context acquisition
- [ ] Integrate `recordBrowserCount()` into node heartbeat
- [ ] Wrap cron endpoints with `recordCronDuration()`
- [ ] Schedule `monitor-dlq.ts` script as cron job (every 5 min)
- [ ] Test alert rule evaluation with sample data
- [ ] Configure notification channels (Slack, email, PagerDuty)
- [ ] Deploy to staging and validate metric collection

### Related Documentation

- [Alert Configuration](./alert-configuration.md)
- [Alert Rules Evaluator](../lib/services/monitoring/alert-rules-evaluator.ts)
- [Metrics Collector](../lib/services/monitoring/metrics-collector.ts)
- [Queue Backpressure](../lib/queue/backpressure.ts)
