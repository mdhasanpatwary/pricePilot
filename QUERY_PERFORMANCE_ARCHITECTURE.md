# Query Performance Measurement - Architecture

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         APPLICATION LAYER                            │
│                                                                      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐             │
│  │  API Routes  │  │ Server Actions│  │ Background   │             │
│  │              │  │               │  │   Workers    │             │
│  └──────┬───────┘  └──────┬────────┘  └──────┬───────┘             │
│         │                 │                   │                      │
│         └─────────────────┴───────────────────┘                      │
│                           │                                          │
└───────────────────────────┼──────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    INSTRUMENTED PRISMA CLIENT                        │
│                  (lib/instrumented-prisma.ts)                        │
│                                                                      │
│  ┌────────────────────────────────────────────────────────────┐    │
│  │  Base Prisma Client + Performance Extension                │    │
│  │  • Connection pooling                                      │    │
│  │  • Encryption middleware                                   │    │
│  │  • Query interception                                      │    │
│  └────────────────────────────────────────────────────────────┘    │
└───────────────────────────┬──────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────────┐
│              QUERY PERFORMANCE EXTENSION                             │
│         (lib/middleware/query-performance-tracker.ts)                │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────┐      │
│  │  Prisma Client Extension (Prisma 5+)                     │      │
│  │                                                           │      │
│  │  1. Intercept Query                                      │      │
│  │     ↓                                                     │      │
│  │  2. Record Start Time                                    │      │
│  │     ↓                                                     │      │
│  │  3. Execute Query ──────────────────────┐                │      │
│  │     ↓                                    │                │      │
│  │  4. Calculate Execution Time            │                │      │
│  │     ↓                                    │                │      │
│  │  5. Update Metrics                      │                │      │
│  │     ↓                                    │                │      │
│  │  6. Check if Slow (>1000ms)             │                │      │
│  │     ↓                                    │                │      │
│  │  7. Log Warning if Slow                 │                │      │
│  │     ↓                                    │                │      │
│  │  8. Return Result ←─────────────────────┘                │      │
│  └──────────────────────────────────────────────────────────┘      │
└───────────────────────────┬──────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      POSTGRESQL DATABASE                             │
│                                                                      │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌────────────┐   │
│  │  Products  │  │   Sites    │  │  Matches   │  │   Prices   │   │
│  └────────────┘  └────────────┘  └────────────┘  └────────────┘   │
└───────────────────────────┬──────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────────┐
│                   PERFORMANCE TRACKER                                │
│                    (In-Memory Storage)                               │
│                                                                      │
│  ┌────────────────────────────────────────────────────────────┐    │
│  │  Map<QueryKey, QueryMetrics>                               │    │
│  │                                                             │    │
│  │  QueryKey: "Model.Operation"                               │    │
│  │  QueryMetrics: {                                           │    │
│  │    count: number                                           │    │
│  │    totalTime: number                                       │    │
│  │    avgTime: number                                         │    │
│  │    minTime: number                                         │    │
│  │    maxTime: number                                         │    │
│  │    lastExecuted: Date                                      │    │
│  │  }                                                          │    │
│  └────────────────────────────────────────────────────────────┘    │
└───────────────────────────┬──────────────────────────────────────────┘
                            │
                ┌───────────┴───────────┬───────────────┐
                │                       │               │
                ▼                       ▼               ▼
    ┌──────────────────┐   ┌──────────────────┐   ┌──────────────────┐
    │   CLI Tool       │   │   API Endpoint   │   │  Programmatic    │
    │                  │   │                  │   │     Access       │
    │  npm run         │   │  GET /api/v1/    │   │                  │
    │  measure-queries │   │  debug/query-    │   │  getPerformance  │
    │                  │   │  performance     │   │  Tracker()       │
    └──────────────────┘   └──────────────────┘   └──────────────────┘
```

## Data Flow Diagram

```
┌─────────────┐
│ Application │
│   Code      │
└──────┬──────┘
       │
       │ prisma.product.findMany({ where: { tenantId } })
       │
       ▼
┌─────────────────────────────────────────────────────────┐
│ Prisma Client Extension                                 │
│                                                          │
│  const startTime = performance.now()                    │
│                                                          │
│  try {                                                   │
│    const result = await query(args) ──────┐             │
│    const executionTime = now() - startTime│             │
│                                            │             │
│    tracker.recordQuery(                   │             │
│      model: "Product",                    │             │
│      operation: "findMany",               │             │
│      executionTime: 245.67ms              │             │
│    )                                       │             │
│                                            │             │
│    if (executionTime > 1000ms) {          │             │
│      console.warn("SLOW QUERY")           │             │
│    }                                       │             │
│                                            │             │
│    return result ←─────────────────────────┘             │
│  }                                                       │
└─────────────────────────────────────────────────────────┘
       │
       │ result
       │
       ▼
┌─────────────┐
│ Application │
│   Code      │
└─────────────┘
```

## Metrics Storage Structure

```
Performance Tracker (In-Memory)
│
├── metrics: Map<string, QueryMetrics>
│   │
│   ├── "Product.findMany" → {
│   │     model: "Product",
│   │     operation: "findMany",
│   │     count: 12,
│   │     totalTime: 2948.04,
│   │     avgTime: 245.67,
│   │     minTime: 189.23,
│   │     maxTime: 312.45,
│   │     lastExecuted: 2026-02-10T10:30:45.123Z
│   │   }
│   │
│   ├── "Site.findMany" → {
│   │     model: "Site",
│   │     operation: "findMany",
│   │     count: 10,
│   │     totalTime: 452.30,
│   │     avgTime: 45.23,
│   │     minTime: 38.91,
│   │     maxTime: 52.34,
│   │     lastExecuted: 2026-02-10T10:30:42.456Z
│   │   }
│   │
│   └── ... (more queries)
│
└── enabled: boolean
```

## Component Interaction

```
┌──────────────────────────────────────────────────────────────┐
│                    Measurement Script                         │
│              (scripts/measure-query-performance.ts)           │
│                                                               │
│  1. Reset tracker                                            │
│  2. Run workflow simulations                                 │
│     ├── Dashboard load                                       │
│     ├── Product comparison                                   │
│     ├── Price history                                        │
│     ├── Competitor analysis                                  │
│     └── ... (10 workflows)                                   │
│  3. Get performance report                                   │
│  4. Identify slowest query                                   │
│  5. Generate recommendations                                 │
│  6. Export JSON report                                       │
│  7. Print to console                                         │
└──────────────────────────────────────────────────────────────┘
                            │
                            │ uses
                            ▼
┌──────────────────────────────────────────────────────────────┐
│                  Instrumented Prisma Client                   │
│                (lib/instrumented-prisma.ts)                   │
│                                                               │
│  • Executes all queries                                      │
│  • Automatically tracks performance                          │
│  • Returns results                                           │
└──────────────────────────────────────────────────────────────┘
                            │
                            │ extends
                            ▼
┌──────────────────────────────────────────────────────────────┐
│                Performance Tracker Extension                  │
│         (lib/middleware/query-performance-tracker.ts)         │
│                                                               │
│  • Intercepts queries                                        │
│  • Measures execution time                                   │
│  • Stores metrics                                            │
│  • Detects slow queries                                      │
└──────────────────────────────────────────────────────────────┘
                            │
                            │ stores in
                            ▼
┌──────────────────────────────────────────────────────────────┐
│                    Performance Tracker                        │
│                      (Singleton Instance)                     │
│                                                               │
│  • In-memory metrics storage                                 │
│  • Provides report generation                                │
│  • Supports reset                                            │
│  • Exports for monitoring                                    │
└──────────────────────────────────────────────────────────────┘
                            │
                            │ accessed by
                            ▼
┌──────────────────────────────────────────────────────────────┐
│                      API Endpoint                             │
│         (app/api/v1/debug/query-performance/route.ts)         │
│                                                               │
│  GET /api/v1/debug/query-performance                         │
│  • Returns current metrics                                   │
│  • Supports JSON/text format                                 │
│  • Allows reset                                              │
└──────────────────────────────────────────────────────────────┘
```

## Execution Timeline

```
Time →

0ms     Application starts query
        │
        ▼
1ms     Extension intercepts
        │
        ├─ Record start time
        │
        ▼
2ms     Query sent to database
        │
        │ (Database processing...)
        │
245ms   Database returns result
        │
        ▼
246ms   Extension receives result
        │
        ├─ Calculate execution time (244ms)
        ├─ Update metrics in tracker
        ├─ Check if slow (244ms < 1000ms, OK)
        │
        ▼
247ms   Return result to application
```

## Metrics Calculation

```
For each query execution:

1. Record execution time: 245.67ms

2. Update metrics:
   count = count + 1                    (11 → 12)
   totalTime = totalTime + 245.67       (2702.37 → 2948.04)
   avgTime = totalTime / count          (2948.04 / 12 = 245.67)
   minTime = min(minTime, 245.67)       (189.23)
   maxTime = max(maxTime, 245.67)       (312.45)
   lastExecuted = now()                 (2026-02-10T10:30:45.123Z)

3. Store updated metrics in Map
```

## Report Generation Flow

```
┌─────────────────────────────────────────────────────────────┐
│  getReport()                                                 │
│                                                              │
│  1. Collect all metrics from Map                            │
│     ↓                                                        │
│  2. Calculate summary statistics                            │
│     • totalQueries = sum of all counts                      │
│     • totalTime = sum of all totalTimes                     │
│     • avgQueryTime = totalTime / totalQueries               │
│     ↓                                                        │
│  3. Sort queries by avgTime (descending)                    │
│     ↓                                                        │
│  4. Take top 20 slowest                                     │
│     ↓                                                        │
│  5. Return report object                                    │
│     {                                                        │
│       totalQueries,                                         │
│       totalTime,                                            │
│       avgQueryTime,                                         │
│       slowestQueries,                                       │
│       queryBreakdown                                        │
│     }                                                        │
└─────────────────────────────────────────────────────────────┘
```

## Integration Points

```
┌─────────────────────────────────────────────────────────────┐
│                    Your Application                          │
└─────────────────────────────────────────────────────────────┘
                            │
        ┌───────────────────┼───────────────────┐
        │                   │                   │
        ▼                   ▼                   ▼
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│ Development  │  │  Production  │  │   Testing    │
│              │  │              │  │              │
│ • Use        │  │ • Optional   │  │ • CI/CD      │
│   instrumented│  │   tracking   │  │   checks     │
│   client     │  │ • Export to  │  │ • Performance│
│ • Print      │  │   monitoring │  │   regression │
│   reports    │  │ • Set alerts │  │   detection  │
└──────────────┘  └──────────────┘  └──────────────┘
```

## Technology Stack

```
┌─────────────────────────────────────────────────────────────┐
│  Language: TypeScript                                        │
│  Runtime: Node.js                                            │
│  Database: PostgreSQL                                        │
│  ORM: Prisma 5+                                              │
│  Extension API: Prisma Client Extensions                     │
│  Storage: In-Memory (Map)                                    │
│  Export: JSON, Text, Prometheus                              │
└─────────────────────────────────────────────────────────────┘
```

## Performance Impact

```
Overhead per query:
├── Extension interception: ~0.1ms
├── Time measurement: ~0.05ms
├── Metrics update: ~0.1ms
└── Total overhead: ~0.25ms (negligible)

Memory usage:
├── Per query type: ~200 bytes
├── 100 unique queries: ~20KB
└── Negligible impact on application
```

## Scalability

```
Metrics Storage:
├── In-memory Map
├── One entry per unique Model.Operation
├── Typical app: 50-200 unique queries
├── Memory: < 50KB
└── No database overhead

Performance:
├── O(1) lookup and update
├── No blocking operations
├── Async logging for slow queries
└── Minimal impact on query execution
```
