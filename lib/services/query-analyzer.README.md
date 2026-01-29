# Query Analyzer Service

The Query Analyzer monitors database query performance, identifies slow queries, analyzes execution plans, and generates optimization recommendations.

## Features

- **Automatic Slow Query Logging**: Captures queries exceeding 1000ms threshold
- **Query Plan Analysis**: Executes EXPLAIN ANALYZE to understand query execution
- **Optimization Recommendations**: Suggests indexes, query rewrites, and caching strategies
- **Performance Trends**: Tracks query performance over time with daily aggregations
- **Dashboard Integration**: Provides top slow queries for monitoring

## Installation

The Query Analyzer is part of the database optimization module:

```typescript
import { getQueryAnalyzer } from '@/lib/database';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const queryAnalyzer = getQueryAnalyzer(prisma);
```

## Usage

### 1. Logging Slow Queries

Manually log a slow query (typically done via middleware):

```typescript
await queryAnalyzer.logSlowQuery({
    query: 'SELECT * FROM users WHERE email = $1',
    params: ['user@example.com'],
    executionTime: 1500, // milliseconds
    affectedRows: 1,
    tenantId: 'tenant-123',
    timestamp: new Date(),
    executionPlan: 'Seq Scan on users (cost=0.00..35.50 rows=1 width=100)',
});
```

### 2. Getting Top Slow Queries

Retrieve the slowest queries for dashboard display:

```typescript
const slowQueries = await queryAnalyzer.getTopSlowQueries(20, {
    start: new Date('2024-01-01'),
    end: new Date('2024-01-31'),
});

// Returns:
// [
//   {
//     query: 'select * from users where email = ?',
//     avgExecutionTime: 2500.50,
//     maxExecutionTime: 5000,
//     executionCount: 150,
//     lastExecuted: Date
//   },
//   ...
// ]
```

### 3. Analyzing Query Plans

Analyze a specific query's execution plan:

```typescript
const plan = await queryAnalyzer.analyzeQueryPlan(
    'SELECT * FROM products WHERE category_id = $1 AND price > $2',
    [5, 100]
);

console.log('Estimated Cost:', plan.estimatedCost);
console.log('Actual Cost:', plan.actualCost);
console.log('Indexes Used:', plan.indexesUsed);
console.log('Has Sequential Scans:', plan.sequentialScans);
```

### 4. Generating Recommendations

Get optimization suggestions for a query:

```typescript
const recommendations = await queryAnalyzer.generateRecommendations(
    'SELECT * FROM users WHERE email = $1 AND status = $2'
);

recommendations.forEach(rec => {
    console.log(`Type: ${rec.type}`);
    console.log(`Description: ${rec.description}`);
    console.log(`Estimated Improvement: ${rec.estimatedImprovement}`);
    console.log(`Implementation: ${rec.implementation}`);
});

// Example output:
// Type: index
// Description: Query contains WHERE clause that may benefit from an index
// Estimated Improvement: 50-90% faster execution
// Implementation: Analyze query plan and create index on filtered columns
```

### 5. Performance Trends

Track query performance over time:

```typescript
const trends = await queryAnalyzer.getPerformanceTrends({
    start: new Date('2024-01-01'),
    end: new Date('2024-01-31'),
});

trends.forEach(trend => {
    console.log(`Date: ${trend.date.toISOString().split('T')[0]}`);
    console.log(`Avg Execution Time: ${trend.avgExecutionTime}ms`);
    console.log(`Execution Count: ${trend.executionCount}`);
    console.log(`P95 Execution Time: ${trend.p95ExecutionTime}ms`);
});
```

### 6. Daily Aggregation

Run daily aggregation (typically via cron job):

```typescript
// Aggregate yesterday's metrics
const yesterday = new Date();
yesterday.setDate(yesterday.getDate() - 1);

await queryAnalyzer.aggregateDailyMetrics(yesterday);
```

Or use the provided script:

```bash
# Aggregate yesterday
ts-node scripts/aggregate-query-metrics.ts

# Aggregate specific date
ts-node scripts/aggregate-query-metrics.ts 2024-01-15
```

## Middleware Integration

Integrate with Prisma middleware to automatically log slow queries:

```typescript
import { PrismaClient } from '@prisma/client';
import { getQueryAnalyzer } from '@/lib/database';
import { SLOW_QUERY_THRESHOLD_MS } from '@/lib/database/optimization-constants';

const prisma = new PrismaClient();
const queryAnalyzer = getQueryAnalyzer(prisma);

prisma.$use(async (params, next) => {
    const start = Date.now();
    const result = await next(params);
    const duration = Date.now() - start;

    // Log slow queries
    if (duration > SLOW_QUERY_THRESHOLD_MS) {
        const query = `${params.model}.${params.action}`;
        
        // Get execution plan if possible
        let executionPlan = '';
        try {
            const plan = await queryAnalyzer.analyzeQueryPlan(
                query,
                params.args ? [params.args] : []
            );
            executionPlan = plan.planText;
        } catch (error) {
            // Ignore plan errors
        }

        await queryAnalyzer.logSlowQuery({
            query,
            params: params.args ? [params.args] : [],
            executionTime: duration,
            affectedRows: Array.isArray(result) ? result.length : 1,
            tenantId: params.args?.where?.tenantId || 'unknown',
            timestamp: new Date(),
            executionPlan,
        });
    }

    return result;
});
```

## API Endpoints

Example API endpoints for dashboard integration:

```typescript
// GET /api/v1/admin/performance/slow-queries
export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '20');
    const start = new Date(searchParams.get('start') || Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = new Date(searchParams.get('end') || Date.now());

    const queryAnalyzer = getQueryAnalyzer(prisma);
    const slowQueries = await queryAnalyzer.getTopSlowQueries(limit, { start, end });

    return Response.json({
        success: true,
        data: slowQueries,
    });
}

// GET /api/v1/admin/performance/trends
export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const start = new Date(searchParams.get('start') || Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = new Date(searchParams.get('end') || Date.now());

    const queryAnalyzer = getQueryAnalyzer(prisma);
    const trends = await queryAnalyzer.getPerformanceTrends({ start, end });

    return Response.json({
        success: true,
        data: trends,
    });
}

// POST /api/v1/admin/performance/analyze
export async function POST(request: Request) {
    const { query, params } = await request.json();

    const queryAnalyzer = getQueryAnalyzer(prisma);
    const plan = await queryAnalyzer.analyzeQueryPlan(query, params || []);
    const recommendations = await queryAnalyzer.generateRecommendations(query);

    return Response.json({
        success: true,
        data: {
            plan,
            recommendations,
        },
    });
}
```

## Cron Job Setup

Set up daily aggregation via cron:

```bash
# Add to crontab (runs at 3 AM UTC daily)
0 3 * * * cd /path/to/app && ts-node scripts/aggregate-query-metrics.ts >> /var/log/query-metrics.log 2>&1
```

Or use a Node.js scheduler:

```typescript
import cron from 'node-cron';
import { getQueryAnalyzer } from '@/lib/database';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const queryAnalyzer = getQueryAnalyzer(prisma);

// Run daily at 3 AM UTC
cron.schedule('0 3 * * *', async () => {
    console.log('Running daily query metrics aggregation...');
    
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    
    try {
        await queryAnalyzer.aggregateDailyMetrics(yesterday);
        console.log('✓ Aggregation completed successfully');
    } catch (error) {
        console.error('✗ Aggregation failed:', error);
    }
});
```

## Configuration

Key configuration constants (from `optimization-constants.ts`):

```typescript
SLOW_QUERY_THRESHOLD_MS = 1000        // Log queries slower than 1 second
TOP_SLOW_QUERIES_LIMIT = 20           // Default number of slow queries to return
VERY_SLOW_QUERY_THRESHOLD_MS = 5000   // Alert threshold for very slow queries
```

## Database Schema

The Query Analyzer uses two Prisma models:

### SlowQuery
Stores individual slow query executions:
- `queryFingerprint`: Normalized query for grouping
- `queryText`: Original query text
- `executionTimeMs`: Execution time in milliseconds
- `affectedRows`: Number of rows affected
- `tenantId`: Multi-tenant isolation
- `executionPlan`: EXPLAIN ANALYZE output
- `params`: Query parameters (JSON)
- `createdAt`: Timestamp

### QueryPerformanceMetric
Stores daily aggregated metrics:
- `queryFingerprint`: Normalized query
- `date`: Aggregation date
- `executionCount`: Number of executions
- `avgExecutionTimeMs`: Average execution time
- `maxExecutionTimeMs`: Maximum execution time
- `minExecutionTimeMs`: Minimum execution time
- `p95ExecutionTimeMs`: 95th percentile
- `totalRowsAffected`: Total rows affected

## Recommendation Types

The analyzer generates five types of recommendations:

1. **Index**: Missing indexes on WHERE clauses
2. **Rewrite**: Query structure improvements (SELECT *, LIMIT, subqueries)
3. **Partition**: Table partitioning suggestions
4. **Cache**: Caching opportunities for frequently accessed data

Each recommendation includes:
- Description of the issue
- Estimated performance improvement
- Implementation steps

## Performance Considerations

- Query fingerprinting normalizes queries for efficient grouping
- Indexes on `queryFingerprint`, `executionTimeMs`, and `createdAt` for fast retrieval
- Aggregation runs during off-peak hours (3 AM UTC)
- EXPLAIN ANALYZE failures handled gracefully
- Singleton pattern prevents multiple analyzer instances

## Testing

Run the test suite:

```bash
npm test -- __tests__/lib/services/query-analyzer.test.ts
```

22 tests covering:
- Slow query logging
- Top slow queries retrieval
- Query plan analysis
- Recommendation generation
- Performance trends
- Daily aggregation
- Singleton pattern

## Requirements

Implements the following requirements from the database optimization spec:

- **1.1**: Log queries exceeding 1000ms with execution details
- **1.2**: Capture query parameters, affected rows, and execution context
- **1.3**: Provide dashboard with top 20 slowest queries
- **1.4**: Generate optimization recommendations for slow queries
- **1.5**: Track query performance trends with daily aggregations

## Next Steps

1. Integrate with Prisma middleware for automatic logging
2. Create admin dashboard UI components
3. Set up cron job for daily aggregation
4. Implement alerting for very slow queries (>5 seconds)
5. Add query performance regression detection
