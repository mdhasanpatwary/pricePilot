# Database Optimization Cron Jobs

This document describes the cron jobs required for database optimization features.

## Overview

The database optimization system requires several scheduled jobs to maintain performance:

1. **Daily ANALYZE** - Updates query planner statistics
2. **Weekly VACUUM** - Reclaims storage and prevents bloat
3. **Daily Archival** - Moves old data to archive tables
4. **Materialized View Refresh** - Updates aggregated data views
5. **Query Metrics Aggregation** - Aggregates slow query data
6. **Cache Warming** - Pre-loads frequently accessed data

## Cron Schedule

### Production Cron Configuration

Add these entries to your crontab or use a job scheduler like node-cron:

```cron
# Daily ANALYZE at 3 AM UTC
0 3 * * * cd /path/to/app && npx tsx scripts/run-maintenance-check.ts --analyze

# Weekly VACUUM on Sunday at 2 AM UTC
0 2 * * 0 cd /path/to/app && npx tsx scripts/run-maintenance-check.ts --vacuum

# Daily archival at 2:30 AM UTC
30 2 * * * cd /path/to/app && npx tsx scripts/run-archival.ts

# Materialized view refresh every 15 minutes
*/15 * * * * cd /path/to/app && npx tsx scripts/refresh-materialized-views.ts

# Query metrics aggregation daily at 3:30 AM UTC
30 3 * * * cd /path/to/app && npx tsx scripts/aggregate-query-metrics.ts

# Cache warming daily at 2 AM UTC
0 2 * * * cd /path/to/app && npx tsx scripts/warm-cache.ts

# Replication lag monitoring every 5 minutes (optional)
*/5 * * * * cd /path/to/app && npx tsx scripts/monitor-replication-lag.ts >> /var/log/replication-lag.log 2>&1
```

## Job Details

### 1. Daily ANALYZE (3 AM UTC)

**Purpose:** Updates PostgreSQL query planner statistics for optimal query plans.

**Command:**
```bash
npx tsx scripts/run-maintenance-check.ts --analyze
```

**Frequency:** Daily at 3 AM UTC

**Duration:** 5-15 minutes depending on database size

**Requirements:** 8.1

### 2. Weekly VACUUM (Sunday 2 AM UTC)

**Purpose:** Reclaims storage from deleted/updated rows and prevents table bloat.

**Command:**
```bash
npx tsx scripts/run-maintenance-check.ts --vacuum
```

**Frequency:** Weekly on Sunday at 2 AM UTC

**Duration:** 30-60 minutes depending on database size

**Requirements:** 8.2

**Notes:**
- Runs during maintenance window to minimize impact
- VACUUM FULL is scheduled automatically for tables with >20% bloat
- Monitor table bloat using the maintenance dashboard

### 3. Daily Archival (2:30 AM UTC)

**Purpose:** Moves old data to archive tables to keep active tables performant.

**Command:**
```bash
npx tsx scripts/run-archival.ts
```

**Frequency:** Daily at 2:30 AM UTC

**Duration:** 10-30 minutes depending on data volume

**Requirements:** 6.4

**Archival Rules:**
- Price history: 90+ days old
- Audit logs: 365+ days old
- Processes in 10,000 record batches
- Maintains referential integrity

### 4. Materialized View Refresh (Every 15 minutes)

**Purpose:** Updates materialized views used for analytics and reporting.

**Command:**
```bash
npx tsx scripts/refresh-materialized-views.ts
```

**Frequency:** Every 15 minutes

**Duration:** 1-5 minutes

**Requirements:** 5.6

**Views Refreshed:**
- `daily_price_comparison_summary`
- Other analytics views as configured

### 5. Query Metrics Aggregation (3:30 AM UTC)

**Purpose:** Aggregates slow query logs into daily performance metrics.

**Command:**
```bash
npx tsx scripts/aggregate-query-metrics.ts
```

**Frequency:** Daily at 3:30 AM UTC

**Duration:** 2-5 minutes

**Requirements:** 1.5

**Output:**
- Daily query performance metrics
- Top 10 slowest queries report
- Performance trend data

### 6. Cache Warming (2 AM UTC)

**Purpose:** Pre-loads frequently accessed data into Redis cache.

**Command:**
```bash
npx tsx scripts/warm-cache.ts
```

**Frequency:** Daily at 2 AM UTC

**Duration:** 5-10 minutes

**Requirements:** 4.4

**Data Warmed:**
- Product comparison data (top 100 products per tenant)
- Competitor products (top 10 sites per tenant)
- Analytics summaries
- Frequently accessed categories

### 7. Replication Lag Monitoring (Every 5 minutes - Optional)

**Purpose:** Monitors read replica health and replication lag.

**Command:**
```bash
npx tsx scripts/monitor-replication-lag.ts
```

**Frequency:** Every 5 minutes (optional)

**Duration:** <1 minute

**Requirements:** 9.4

**Notes:**
- Only needed if read replicas are configured
- Logs to file for historical tracking
- Alerts on lag >5 seconds

## Node.js Cron Implementation

If you prefer to manage cron jobs within Node.js, use the `node-cron` package:

```typescript
// scripts/scheduler.ts
import cron from 'node-cron';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// Daily ANALYZE at 3 AM UTC
cron.schedule('0 3 * * *', async () => {
  console.log('[Scheduler] Running daily ANALYZE...');
  await execAsync('npx tsx scripts/run-maintenance-check.ts --analyze');
});

// Weekly VACUUM on Sunday at 2 AM UTC
cron.schedule('0 2 * * 0', async () => {
  console.log('[Scheduler] Running weekly VACUUM...');
  await execAsync('npx tsx scripts/run-maintenance-check.ts --vacuum');
});

// Daily archival at 2:30 AM UTC
cron.schedule('30 2 * * *', async () => {
  console.log('[Scheduler] Running daily archival...');
  await execAsync('npx tsx scripts/run-archival.ts');
});

// Materialized view refresh every 15 minutes
cron.schedule('*/15 * * * *', async () => {
  console.log('[Scheduler] Refreshing materialized views...');
  await execAsync('npx tsx scripts/refresh-materialized-views.ts');
});

// Query metrics aggregation daily at 3:30 AM UTC
cron.schedule('30 3 * * *', async () => {
  console.log('[Scheduler] Aggregating query metrics...');
  await execAsync('npx tsx scripts/aggregate-query-metrics.ts');
});

// Cache warming daily at 2 AM UTC
cron.schedule('0 2 * * *', async () => {
  console.log('[Scheduler] Warming cache...');
  await execAsync('npx tsx scripts/warm-cache.ts');
});

console.log('[Scheduler] All cron jobs scheduled');
```

## Monitoring

Monitor cron job execution:

1. **Check logs:** Each script logs to stdout/stderr
2. **Database metrics:** View performance dashboard at `/api/v1/admin/performance`
3. **Cache stats:** Monitor cache hit rates
4. **Replication lag:** Check replica health dashboard

## Troubleshooting

### Job Not Running

1. Check cron service is running: `systemctl status cron`
2. Verify crontab entries: `crontab -l`
3. Check script permissions: `chmod +x scripts/*.ts`
4. Review cron logs: `/var/log/cron` or `/var/log/syslog`

### Job Failing

1. Run script manually to see errors
2. Check database connectivity
3. Verify environment variables are set
4. Review script logs for error messages

### Performance Issues

1. Adjust job timing to avoid overlap
2. Increase maintenance window duration
3. Optimize archival batch sizes
4. Monitor database load during jobs

## Environment Variables

Ensure these are set in your environment:

```bash
DATABASE_URL=postgresql://user:pass@host:5432/db
REDIS_URL=redis://host:6379
NODE_ENV=production

# Optional: Read replicas
READ_REPLICA_1_URL=postgresql://user:pass@replica1:5432/db
READ_REPLICA_2_URL=postgresql://user:pass@replica2:5432/db
```

## Best Practices

1. **Timing:** Schedule heavy jobs during off-peak hours (2-4 AM UTC)
2. **Monitoring:** Set up alerts for job failures
3. **Logging:** Rotate logs to prevent disk space issues
4. **Testing:** Test jobs in staging before production
5. **Backups:** Ensure backups run before maintenance jobs
6. **Documentation:** Keep this document updated with any changes
