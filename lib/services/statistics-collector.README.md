# Database Statistics Collector

## Overview

The `StatisticsCollector` class collects and stores database statistics for historical tracking and capacity planning. It maintains a 90+ day history of table and index statistics for trend analysis.

## Features

### Table Statistics Collection
- Collects size, row count, and index size for all tables
- Tracks last VACUUM and ANALYZE timestamps
- Stores historical data for trend analysis
- Excludes system tables (pg_catalog, information_schema)

### Index Statistics Collection
- Collects size and usage statistics for all indexes
- Tracks scan counts and tuple access patterns
- Identifies unused or underutilized indexes
- Stores historical data for performance analysis

### Data Retention
- Maintains 90+ days of historical statistics
- Automatic cleanup of old data
- Configurable retention period
- Efficient storage with indexed queries

### Trend Analysis
- Growth trends over time
- Size projections
- Usage pattern analysis
- Capacity planning support

## Requirements

### Database Tables
The statistics collector requires two tables:

```sql
-- Created by prisma/migrations/create_statistics_history_table.sql
database_statistics_history
index_statistics_history
```

Run the migration:
```bash
psql -d your_database -f prisma/migrations/create_statistics_history_table.sql
```

## Usage

### Basic Usage

```typescript
import { StatisticsCollector } from '@/lib/services/statistics-collector';
import { getPool } from '@/lib/database';

const pool = getPool();
const collector = new StatisticsCollector(pool);

// Collect all statistics
const stats = await collector.collectAllStatistics();

console.log('Tables collected:', stats.tables.length);
console.log('Indexes collected:', stats.indexes.length);
```

### Collect Table Statistics

```typescript
const tableStats = await collector.collectTableStatistics();

for (const stat of tableStats) {
    console.log(`${stat.tableName}: ${stat.sizeBytes} bytes, ${stat.rowCount} rows`);
}
```

### Collect Index Statistics

```typescript
const indexStats = await collector.collectIndexStatistics();

for (const stat of indexStats) {
    console.log(`${stat.indexName}: ${stat.scans} scans, ${stat.sizeBytes} bytes`);
}
```

### Get Historical Data

```typescript
// Get 30 days of history for a specific table
const history = await collector.getTableHistory('public.user_products', 30);

for (const stat of history) {
    console.log(`${stat.collectedAt}: ${stat.sizeBytes} bytes`);
}

// Get index history
const indexHistory = await collector.getIndexHistory('public.idx_user_products_tenant', 30);
```

### Analyze Growth Trends

```typescript
const trends = await collector.getGrowthTrends(30);

for (const trend of trends) {
    console.log(`${trend.tableName}:`);
    console.log(`  Growth: ${trend.growthBytes} bytes (${(trend.growthPercent * 100).toFixed(2)}%)`);
    console.log(`  Start: ${trend.startSize} bytes`);
    console.log(`  End: ${trend.endSize} bytes`);
}
```

### Cleanup Old Statistics

```typescript
const result = await collector.cleanupOldStatistics();

console.log(`Deleted ${result.tablesDeleted} table statistics`);
console.log(`Deleted ${result.indexesDeleted} index statistics`);
```

## Configuration

Configuration constants are defined in `lib/database/optimization-constants.ts`:

- `STATISTICS_HISTORY_RETENTION_DAYS`: 90 days

## Scheduling

### Daily Collection (Recommended)

```typescript
// scripts/collect-statistics.ts
import { StatisticsCollector } from '@/lib/services/statistics-collector';
import { getPool } from '@/lib/database';

async function main() {
    const pool = getPool();
    const collector = new StatisticsCollector(pool);
    
    // Collect statistics
    await collector.collectAllStatistics();
    
    // Cleanup old data
    await collector.cleanupOldStatistics();
    
    await pool.end();
}

main().catch(console.error);
```

### Cron Schedule

```bash
# Run daily at 3 AM UTC
0 3 * * * node scripts/collect-statistics.js
```

## API Integration

### Statistics Endpoint

```typescript
// app/api/v1/admin/statistics/collect/route.ts
import { StatisticsCollector } from '@/lib/services/statistics-collector';
import { getPool } from '@/lib/database';

export async function POST() {
    const pool = getPool();
    const collector = new StatisticsCollector(pool);
    
    const stats = await collector.collectAllStatistics();
    
    return Response.json({
        success: true,
        data: {
            tables: stats.tables.length,
            indexes: stats.indexes.length,
        },
    });
}
```

### History Endpoint

```typescript
// app/api/v1/admin/statistics/history/route.ts
import { StatisticsCollector } from '@/lib/services/statistics-collector';
import { getPool } from '@/lib/database';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const tableName = searchParams.get('table');
    const days = parseInt(searchParams.get('days') || '30');
    
    const pool = getPool();
    const collector = new StatisticsCollector(pool);
    
    const history = await collector.getTableHistory(tableName!, days);
    
    return Response.json({
        success: true,
        data: history,
    });
}
```

### Growth Trends Endpoint

```typescript
// app/api/v1/admin/statistics/trends/route.ts
import { StatisticsCollector } from '@/lib/services/statistics-collector';
import { getPool } from '@/lib/database';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const days = parseInt(searchParams.get('days') || '30');
    
    const pool = getPool();
    const collector = new StatisticsCollector(pool);
    
    const trends = await collector.getGrowthTrends(days);
    
    return Response.json({
        success: true,
        data: trends,
    });
}
```

## Data Structure

### Table Statistics

```typescript
interface TableStatistics {
    tableName: string;
    sizeBytes: number;
    rowCount: number;
    indexSizeBytes: number;
    bloatPercent: number | null;
    lastVacuum: Date | null;
    lastAnalyze: Date | null;
    collectedAt: Date;
}
```

### Index Statistics

```typescript
interface IndexStatistics {
    indexName: string;
    tableName: string;
    sizeBytes: number;
    scans: number;
    tuplesRead: number;
    tuplesFetched: number;
    collectedAt: Date;
}
```

## Logging

The collector logs all operations:
- **Info**: Collection start/completion, cleanup results
- **Error**: Collection failures, cleanup errors

## Error Handling

- Gracefully handles collection failures
- Logs errors without stopping the process
- Releases database connections properly
- Throws errors for critical failures

## Performance Considerations

- Collection can be slow for databases with many tables
- Runs during off-peak hours (3 AM UTC recommended)
- Uses efficient queries with proper indexes
- Cleanup is fast with indexed date columns

## Capacity Planning

Use historical data for:
- **Growth Projections**: Predict future storage needs
- **Trend Analysis**: Identify unusual growth patterns
- **Optimization Opportunities**: Find tables needing attention
- **Budget Planning**: Estimate infrastructure costs

## Integration with Maintenance

Works with `MaintenanceScheduler` for complete monitoring:

```typescript
import { MaintenanceScheduler } from '@/lib/services/maintenance-scheduler';
import { StatisticsCollector } from '@/lib/services/statistics-collector';

const scheduler = new MaintenanceScheduler(pool);
const collector = new StatisticsCollector(pool);

// Collect statistics first
await collector.collectAllStatistics();

// Then run maintenance check (uses historical data)
await scheduler.runMaintenanceCheck();
```

## Related Components

- `lib/services/maintenance-scheduler.ts` - Uses historical data for growth monitoring
- `lib/database/optimization-constants.ts` - Configuration constants
- `lib/types/database-optimization.ts` - Type definitions

## Requirements Validation

- ✅ **Requirement 8.5**: Database statistics history table created
- ✅ **Requirement 8.5**: Daily statistics collection implemented
- ✅ **Requirement 8.5**: 90+ day retention policy enforced
