# Database Maintenance Scheduler

## Overview

The `MaintenanceScheduler` class provides automated database maintenance capabilities including table bloat detection, VACUUM scheduling, and growth monitoring.

## Features

### Table Bloat Detection
- Uses PostgreSQL's `pgstattuple` extension to analyze table bloat
- Calculates bloat percentage and absolute size
- Identifies tables requiring VACUUM operations
- Logs warnings for critical bloat levels (>30%)

### VACUUM Scheduling
- Automatically schedules VACUUM operations for bloated tables
- Uses VACUUM FULL for critical bloat (>30%)
- Uses regular VACUUM for warning-level bloat (>20%)
- Schedules operations during maintenance windows (2-4 AM UTC)
- Estimates operation duration based on table size

### Growth Monitoring
- Tracks table and index size changes over time
- Compares current sizes with historical data (7 days ago)
- Generates alerts for rapid growth (>20% per week)
- Projects future sizes based on growth trends

## Requirements

### PostgreSQL Extensions
The maintenance scheduler requires the `pgstattuple` extension:

```sql
CREATE EXTENSION IF NOT EXISTS pgstattuple;
```

### Database Tables
Requires the `database_statistics_history` table for growth monitoring (created in task 12.4).

## Usage

### Basic Usage

```typescript
import { MaintenanceScheduler } from '@/lib/services/maintenance-scheduler';
import { getPool } from '@/lib/database';

const pool = getPool();
const scheduler = new MaintenanceScheduler(pool);

// Run full maintenance check
const results = await scheduler.runMaintenanceCheck();

console.log('Tables with bloat:', results.bloatInfo.filter(i => i.shouldVacuum).length);
console.log('Scheduled operations:', results.schedules.length);
console.log('Growth alerts:', results.growthAlerts.length);
```

### Detect Table Bloat

```typescript
const bloatInfo = await scheduler.detectTableBloat();

for (const info of bloatInfo) {
    if (info.shouldVacuum) {
        console.log(`Table ${info.tableName} has ${(info.bloatPercent * 100).toFixed(2)}% bloat`);
    }
}
```

### Schedule VACUUM Operations

```typescript
const bloatInfo = await scheduler.detectTableBloat();
const schedules = await scheduler.scheduleVacuum(bloatInfo);

for (const schedule of schedules) {
    console.log(`${schedule.operation} scheduled for ${schedule.tableName} at ${schedule.scheduledTime}`);
}
```

### Execute VACUUM

```typescript
const schedules = await scheduler.scheduleVacuum(bloatInfo);

for (const schedule of schedules) {
    if (schedule.scheduledTime <= new Date()) {
        await scheduler.executeVacuum(schedule);
    }
}
```

### Monitor Growth

```typescript
const alerts = await scheduler.monitorGrowth();

for (const alert of alerts) {
    console.log(`Table ${alert.tableName} grew ${(alert.growthPercent * 100).toFixed(2)}% in the last week`);
}
```

## Configuration

Configuration constants are defined in `lib/database/optimization-constants.ts`:

- `TABLE_BLOAT_WARNING_THRESHOLD`: 0.2 (20%)
- `TABLE_BLOAT_CRITICAL_THRESHOLD`: 0.3 (30%)
- `TABLE_GROWTH_ALERT_THRESHOLD`: 0.2 (20% per week)
- `ARCHIVE_MAINTENANCE_WINDOW_START_HOUR`: 2 (2 AM UTC)
- `ARCHIVE_MAINTENANCE_WINDOW_END_HOUR`: 4 (4 AM UTC)

## Maintenance Windows

Operations are scheduled during maintenance windows to minimize impact:
- **Window**: 2 AM - 4 AM UTC
- **VACUUM**: Scheduled for next available window
- **VACUUM FULL**: Used for critical bloat (>30%)

## Logging

The scheduler logs all operations:
- **Info**: Bloat detection, scheduled operations, completed operations
- **Warn**: High bloat detected, growth alerts
- **Error**: Operation failures

## Error Handling

- Gracefully handles tables that cannot be analyzed
- Logs errors without stopping the maintenance check
- Releases database connections properly
- Throws errors for VACUUM operation failures

## Performance Considerations

- Table bloat detection can be slow for large tables
- VACUUM operations lock tables briefly
- VACUUM FULL requires exclusive lock and more time
- Growth monitoring requires historical data

## Integration

### Cron Job

```typescript
// scripts/run-maintenance-check.ts
import { MaintenanceScheduler } from '@/lib/services/maintenance-scheduler';
import { getPool } from '@/lib/database';

async function main() {
    const pool = getPool();
    const scheduler = new MaintenanceScheduler(pool);
    
    const results = await scheduler.runMaintenanceCheck();
    
    // Execute scheduled operations if in maintenance window
    if (isMaintenanceWindow()) {
        for (const schedule of results.schedules) {
            await scheduler.executeVacuum(schedule);
        }
    }
    
    await pool.end();
}

main().catch(console.error);
```

### API Endpoint

```typescript
// app/api/v1/admin/maintenance/check/route.ts
import { MaintenanceScheduler } from '@/lib/services/maintenance-scheduler';
import { getPool } from '@/lib/database';

export async function GET() {
    const pool = getPool();
    const scheduler = new MaintenanceScheduler(pool);
    
    const results = await scheduler.runMaintenanceCheck();
    
    return Response.json({
        success: true,
        data: results,
    });
}
```

## Related Components

- `lib/database/optimization-constants.ts` - Configuration constants
- `lib/types/database-optimization.ts` - Type definitions
- `lib/services/query-analyzer.ts` - Query performance monitoring
- `lib/services/index-manager.ts` - Index optimization

## Requirements Validation

- ✅ **Requirement 8.3**: Table bloat detection using pgstattuple
- ✅ **Requirement 8.3**: VACUUM scheduling for high bloat tables
- ✅ **Requirement 8.4**: Table/index size monitoring with growth alerts
