# Archive Manager

## Overview

The Archive Manager handles data lifecycle management by archiving historical records to separate partitioned tables. This keeps active tables lean and performant while preserving historical data for compliance and analysis.

## Features

- **Age-Based Archival**: Automatically archives records older than configured retention periods
- **Batch Processing**: Processes 10,000 records per transaction to avoid timeouts
- **Partitioned Storage**: Uses PostgreSQL table partitioning by year for efficient data management
- **Referential Integrity**: Maintains foreign key relationships in archive tables
- **Compressed Storage**: Enables TOAST compression to reduce storage costs
- **Read-Only Access**: Provides query API for archived data
- **Maintenance Windows**: Schedules archival during off-peak hours (2-4 AM UTC)

## Architecture

### Archive Tables

Two main archive tables with yearly partitioning:

1. **price_history_archive**
   - Stores price history older than 90 days
   - Partitioned by `recorded_at` date
   - Maintains product relationships

2. **audit_logs_archive**
   - Stores audit logs older than 365 days
   - Partitioned by `created_at` date
   - Maintains tenant relationships

### Partitioning Strategy

```
price_history_archive (parent table)
├── price_history_archive_2023 (2023-01-01 to 2024-01-01)
├── price_history_archive_2024 (2024-01-01 to 2025-01-01)
├── price_history_archive_2025 (2025-01-01 to 2026-01-01)
└── price_history_archive_2026 (2026-01-01 to 2027-01-01)
```

## Usage

### Initialize Archive Manager

```typescript
import { PrismaClient } from '@prisma/client';
import { ArchiveManager } from '@/lib/services/archive-manager';

const prisma = new PrismaClient();
const archiveManager = new ArchiveManager(prisma);
```

### Archive Price History

```typescript
// Archive records older than 90 days (default)
const result = await archiveManager.archivePriceHistory();

console.log(`Archived ${result.recordsArchived} records`);
console.log(`Freed ${result.spaceFreedBytes} bytes`);
console.log(`Completed in ${result.durationMs}ms`);

// Custom retention period
const customResult = await archiveManager.archivePriceHistory(120); // 120 days
```

### Archive Audit Logs

```typescript
// Archive records older than 365 days (default)
const result = await archiveManager.archiveAuditLogs();

// Custom retention period
const customResult = await archiveManager.archiveAuditLogs(180); // 180 days
```

### Query Archived Data

```typescript
// Query archived price history
const priceHistory = await archiveManager.queryPriceHistoryArchive({
  tenantId: 'tenant-123',
  productId: 'product-456',
  startDate: new Date('2023-01-01'),
  endDate: new Date('2023-12-31'),
  limit: 100,
  offset: 0,
});

// Query archived audit logs
const auditLogs = await archiveManager.queryAuditLogsArchive({
  tenantId: 'tenant-123',
  startDate: new Date('2023-01-01'),
  endDate: new Date('2023-12-31'),
  limit: 50,
});
```

### Get Archive Statistics

```typescript
const stats = await archiveManager.getArchiveStats();

console.log(`Price history records: ${stats.priceHistoryArchived}`);
console.log(`Audit log records: ${stats.auditLogsArchived}`);
console.log(`Total size: ${stats.totalArchiveSizeBytes} bytes`);
console.log(`Oldest record: ${stats.oldestArchivedRecord}`);
```

### Run Scheduled Archival

```typescript
// Only runs during maintenance window (2-4 AM UTC)
try {
  const results = await archiveManager.runScheduledArchival();
  console.log('Price history:', results.priceHistory);
  console.log('Audit logs:', results.auditLogs);
} catch (error) {
  console.error('Archival failed:', error.message);
}
```

## Scheduling

### Cron Job Setup

Create a cron job to run archival during maintenance windows:

```typescript
// scripts/run-archival.ts
import { PrismaClient } from '@prisma/client';
import { ArchiveManager } from '@/lib/services/archive-manager';

const prisma = new PrismaClient();
const archiveManager = new ArchiveManager(prisma);

async function main() {
  try {
    const results = await archiveManager.runScheduledArchival();
    console.log('Archival completed successfully');
    process.exit(0);
  } catch (error) {
    console.error('Archival failed:', error);
    process.exit(1);
  }
}

main();
```

### Crontab Entry

```bash
# Run archival daily at 3 AM UTC
0 3 * * * cd /path/to/app && node scripts/run-archival.js
```

### Node-Cron Setup

```typescript
import cron from 'node-cron';

// Schedule for 3 AM UTC daily
cron.schedule('0 3 * * *', async () => {
  try {
    await archiveManager.runScheduledArchival();
  } catch (error) {
    console.error('Scheduled archival failed:', error);
  }
});
```

## Performance Considerations

### Batch Size

- Default: 10,000 records per transaction
- Prevents transaction timeouts
- Balances throughput and memory usage

### Indexing

Archive tables include indexes for:
- Tenant-based queries
- Date range queries
- Product/entity lookups

### Compression

TOAST compression is enabled on archive partitions to reduce storage:
- Reduces storage costs by 50-70%
- Minimal impact on query performance
- Automatic compression by PostgreSQL

## Monitoring

### Key Metrics

Monitor these metrics for archive operations:

- **Records Archived**: Total records moved to archive
- **Duration**: Time taken for archival operation
- **Space Freed**: Bytes freed from active tables
- **Archive Size**: Total size of archive tables
- **Query Performance**: Response time for archive queries

### Logging

All operations are logged with context:

```typescript
logger.info('Price history archival completed', {
  totalArchived: 15000,
  totalDeleted: 15000,
  durationMs: 45000,
  spaceFreedBytes: 1500000,
});
```

## Error Handling

### Transaction Rollback

If archival fails mid-batch:
- Transaction is rolled back
- No data loss occurs
- Operation can be retried

### Maintenance Window Enforcement

```typescript
if (!archiveManager.isMaintenanceWindow()) {
  throw new Error('Archival can only run during maintenance window');
}
```

## Best Practices

1. **Run During Off-Peak Hours**: Use maintenance windows (2-4 AM UTC)
2. **Monitor Archive Size**: Track growth and plan capacity
3. **Test Queries**: Verify archive queries work before production
4. **Backup Before Archival**: Always backup before first archival
5. **Add Partitions Yearly**: Create new partitions for upcoming years
6. **Monitor Performance**: Track archival duration and adjust batch size if needed

## Troubleshooting

### Archival Takes Too Long

- Reduce batch size
- Add more indexes
- Run during lower load periods

### Archive Queries Slow

- Check partition pruning is working
- Verify indexes are being used
- Consider materialized views for common queries

### Partition Not Found

- Ensure partitions exist for date ranges
- Create new partitions before data arrives
- Use default partition for overflow

## Future Enhancements

- [ ] Automatic partition creation
- [ ] Configurable batch sizes
- [ ] Parallel archival processing
- [ ] Archive to cold storage (S3, etc.)
- [ ] Restore from archive functionality
- [ ] Archive compression statistics
