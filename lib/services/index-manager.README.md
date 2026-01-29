# Index Manager Component

The Index Manager is a comprehensive database index management system that analyzes query patterns, suggests missing indexes, identifies unused indexes, and maintains index health for optimal database performance.

## Features

- **Automated Index Analysis**: Analyzes `pg_stat_statements` to identify slow queries and suggest appropriate indexes
- **Unused Index Detection**: Identifies indexes with zero scans that consume storage without performance benefit
- **Concurrent Index Creation**: Creates indexes without blocking table operations using `CREATE INDEX CONCURRENTLY`
- **Fragmentation Monitoring**: Monitors index fragmentation using `pgstattuple` extension
- **Automated Maintenance**: Rebuilds fragmented indexes during maintenance windows
- **Usage Statistics**: Tracks comprehensive index usage metrics for monitoring

## Requirements

This component satisfies the following requirements:
- **Requirement 2.2**: Missing index detection
- **Requirement 2.3**: Unused index identification
- **Requirement 2.4**: Concurrent index creation
- **Requirement 2.5**: Index usage statistics
- **Requirement 2.6**: Fragmented index scheduling

## Prerequisites

### PostgreSQL Extensions

The Index Manager requires two PostgreSQL extensions:

1. **pg_stat_statements**: Tracks execution statistics of SQL statements
2. **pgstattuple**: Provides tuple-level statistics for fragmentation analysis

```sql
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;
CREATE EXTENSION IF NOT EXISTS pgstattuple;
```

Run the setup script to enable these extensions:

```bash
npx tsx scripts/setup-optimization-extensions.ts
```

### Database Tables

The component uses the `IndexRecommendation` table to store index suggestions:

```prisma
model IndexRecommendation {
  id              String    @id @default(uuid())
  tableName       String
  columns         String[]
  reason          String
  estimatedImpact String    // 'high', 'medium', 'low'
  createStatement String
  status          String    @default("pending") // 'pending', 'applied', 'rejected'
  createdAt       DateTime  @default(now())
  appliedAt       DateTime?
}
```

## Usage

### Basic Usage

```typescript
import { getIndexManager } from '@/lib/services/index-manager';

const indexManager = getIndexManager();
```

### Suggest Missing Indexes

Analyzes query patterns and suggests indexes for tables with slow queries:

```typescript
const suggestions = await indexManager.suggestIndexes();

console.log(`Found ${suggestions.length} index suggestions`);

suggestions.forEach(suggestion => {
  console.log(`Table: ${suggestion.tableName}`);
  console.log(`Columns: ${suggestion.columns.join(', ')}`);
  console.log(`Impact: ${suggestion.estimatedImpact}`);
  console.log(`Reason: ${suggestion.reason}`);
  console.log(`SQL: ${suggestion.createStatement}`);
});
```

**Output Example:**
```
Table: user_products
Columns: tenantId, status
Impact: high
Reason: Multi-tenant queries frequently filter by tenantId and status
SQL: CREATE INDEX CONCURRENTLY idx_user_products_tenant_status ON user_products(tenantId, status)
```

### Find Unused Indexes

Identifies indexes with zero scans that can be dropped:

```typescript
const unusedIndexes = await indexManager.findUnusedIndexes(30); // 30 days

console.log(`Found ${unusedIndexes.length} unused indexes`);

unusedIndexes.forEach(index => {
  console.log(`Index: ${index.indexName}`);
  console.log(`Table: ${index.tableName}`);
  console.log(`Size: ${(index.sizeBytes / 1024 / 1024).toFixed(2)} MB`);
  console.log(`Drop: ${index.dropStatement}`);
});
```

**Output Example:**
```
Index: idx_old_table_unused
Table: old_table
Size: 50.00 MB
Drop: DROP INDEX CONCURRENTLY IF EXISTS idx_old_table_unused;
```

### Create Index Concurrently

Creates an index without blocking table operations:

```typescript
const indexDef = {
  name: 'idx_user_products_tenant_status',
  tableName: 'user_products',
  columns: ['tenantId', 'status'],
  unique: false,
  where: "status = 'active'" // Optional partial index
};

await indexManager.createIndexConcurrently(indexDef);
```

**Features:**
- Non-blocking index creation
- Automatic recommendation status update
- Support for unique indexes
- Support for partial indexes with WHERE clause

### Rebuild Fragmented Indexes

Rebuilds indexes exceeding the fragmentation threshold:

```typescript
// Rebuild indexes with >30% fragmentation
await indexManager.rebuildFragmentedIndexes(30);
```

**Behavior:**
- Only runs during maintenance windows (2-4 AM UTC)
- Checks fragmentation using `pgstatindex()`
- Rebuilds using `REINDEX INDEX CONCURRENTLY`
- Continues on error for individual indexes
- Only checks indexes larger than 10MB

### Get Index Statistics

Retrieves comprehensive usage statistics for all indexes:

```typescript
const stats = await indexManager.getIndexStats();

stats.forEach(stat => {
  console.log(`Index: ${stat.indexName}`);
  console.log(`Table: ${stat.tableName}`);
  console.log(`Size: ${(stat.sizeBytes / 1024 / 1024).toFixed(2)} MB`);
  console.log(`Scans: ${stat.scans}`);
  console.log(`Tuples Read: ${stat.tuplesRead}`);
  console.log(`Tuples Returned: ${stat.tuplesReturned}`);
  console.log(`Fragmentation: ${stat.fragmentation.toFixed(2)}%`);
});
```

**Output Example:**
```
Index: idx_user_products_tenant
Table: user_products
Size: 50.00 MB
Scans: 15000
Tuples Read: 500000
Tuples Returned: 450000
Fragmentation: 12.50%
```

## Index Suggestion Patterns

The Index Manager suggests indexes based on common multi-tenant patterns:

### 1. Tenant + Status Pattern
```sql
CREATE INDEX CONCURRENTLY idx_{table}_tenant_status 
ON {table}(tenantId, status)
```
**Use Case**: Queries filtering by tenant and status (e.g., active products)

### 2. Tenant + Timestamp Pattern
```sql
CREATE INDEX CONCURRENTLY idx_{table}_tenant_created 
ON {table}(tenantId, createdAt DESC)
```
**Use Case**: Time-based queries within a tenant (e.g., recent orders)

### 3. Updated Timestamp Pattern
```sql
CREATE INDEX CONCURRENTLY idx_{table}_updated 
ON {table}(updatedAt DESC)
```
**Use Case**: Queries sorting or filtering by update time

## Impact Estimation

The Index Manager estimates the impact of creating an index based on:

### High Impact
- 5+ slow queries using the table
- Table size > 100MB
- Low write activity (< 10,000 writes)

### Medium Impact
- 2-4 slow queries
- Moderate table size
- Moderate write activity

### Low Impact
- < 2 slow queries
- High write activity (> 100,000 writes)
- Small table size

## Maintenance Windows

Index rebuilding operations only run during configured maintenance windows:

**Default Window**: 2:00 AM - 4:00 AM UTC

```typescript
import { isMaintenanceWindow } from '@/lib/database/optimization-constants';

if (isMaintenanceWindow()) {
  await indexManager.rebuildFragmentedIndexes(30);
}
```

## API Endpoints

### Get Index Recommendations
```
GET /api/v1/admin/performance/index-recommendations
```

**Response:**
```json
{
  "success": true,
  "data": {
    "recommendations": [
      {
        "tableName": "user_products",
        "columns": ["tenantId", "status"],
        "reason": "Multi-tenant queries frequently filter by tenantId and status",
        "estimatedImpact": "high",
        "createStatement": "CREATE INDEX CONCURRENTLY idx_user_products_tenant_status ON user_products(tenantId, status)",
        "status": "pending"
      }
    ]
  }
}
```

### Get Index Statistics
```
GET /api/v1/admin/performance/index-stats
```

**Response:**
```json
{
  "success": true,
  "data": {
    "stats": [
      {
        "indexName": "idx_user_products_tenant",
        "tableName": "user_products",
        "sizeBytes": 52428800,
        "scans": 15000,
        "tuplesRead": 500000,
        "tuplesReturned": 450000,
        "fragmentation": 12.5
      }
    ]
  }
}
```

## Monitoring

### Key Metrics to Monitor

1. **Index Suggestions**: Number of pending recommendations
2. **Unused Indexes**: Total size of unused indexes
3. **Fragmentation**: Percentage of indexes with >30% fragmentation
4. **Index Scans**: Number of scans per index
5. **Index Efficiency**: Ratio of tuples returned to tuples read

### Alerting Thresholds

- **High**: > 10 pending index recommendations
- **Medium**: > 5 unused indexes consuming > 100MB
- **Low**: > 20% of indexes with >30% fragmentation

## Best Practices

### 1. Regular Analysis
Run index analysis weekly to identify optimization opportunities:

```typescript
// Weekly cron job
const suggestions = await indexManager.suggestIndexes();
if (suggestions.length > 0) {
  // Alert administrators
}
```

### 2. Review Before Creating
Always review index suggestions before creating them:
- Check if the index will actually be used
- Consider write performance impact
- Verify the index doesn't duplicate existing indexes

### 3. Monitor Unused Indexes
Regularly check for unused indexes and drop them:

```typescript
// Monthly cron job
const unusedIndexes = await indexManager.findUnusedIndexes(90);
// Review and drop unused indexes
```

### 4. Schedule Maintenance
Rebuild fragmented indexes during maintenance windows:

```typescript
// Daily cron job at 3 AM UTC
if (isMaintenanceWindow()) {
  await indexManager.rebuildFragmentedIndexes(30);
}
```

### 5. Track Statistics
Monitor index usage statistics to validate effectiveness:

```typescript
// Daily monitoring
const stats = await indexManager.getIndexStats();
const lowUsageIndexes = stats.filter(s => s.scans < 100);
// Alert if indexes are not being used
```

## Error Handling

The Index Manager handles errors gracefully:

### Index Creation Failures
```typescript
try {
  await indexManager.createIndexConcurrently(indexDef);
} catch (error) {
  console.error('Index creation failed:', error);
  // Index creation errors are thrown
}
```

### Fragmentation Check Failures
```typescript
// Fragmentation checks fail gracefully
const stats = await indexManager.getIndexStats();
// Returns fragmentation: 0 if check fails
```

### Rebuild Failures
```typescript
// Continues with other indexes on error
await indexManager.rebuildFragmentedIndexes(30);
// Logs errors but doesn't throw
```

## Performance Considerations

### Index Creation
- Uses `CREATE INDEX CONCURRENTLY` to avoid table locks
- Can take significant time for large tables
- Requires 2x the disk space temporarily

### Fragmentation Checks
- Only checks indexes > 10MB to avoid overhead
- Uses `pgstatindex()` which can be slow for large indexes
- Caches results to avoid repeated checks

### Rebuild Operations
- Only runs during maintenance windows
- Uses `REINDEX INDEX CONCURRENTLY` (PostgreSQL 12+)
- Requires 2x the disk space temporarily

## Troubleshooting

### "Extension does not exist" Error
```
ERROR: extension "pg_stat_statements" does not exist
```

**Solution**: Install the required extensions:
```sql
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;
CREATE EXTENSION IF NOT EXISTS pgstattuple;
```

### "Permission denied" Error
```
ERROR: permission denied to create extension
```

**Solution**: Contact your database administrator to install extensions with superuser privileges.

### "Index already exists" Error
```
ERROR: relation "idx_name" already exists
```

**Solution**: The Index Manager uses `IF NOT EXISTS` to handle this gracefully. This error should not occur.

### High Memory Usage
If index operations consume too much memory:
- Increase `maintenance_work_mem` in PostgreSQL
- Schedule operations during low-traffic periods
- Process indexes in smaller batches

## References

- [PostgreSQL CREATE INDEX CONCURRENTLY](https://www.postgresql.org/docs/current/sql-createindex.html#SQL-CREATEINDEX-CONCURRENTLY)
- [pg_stat_statements Documentation](https://www.postgresql.org/docs/current/pgstatstatements.html)
- [pgstattuple Documentation](https://www.postgresql.org/docs/current/pgstattuple.html)
- [PostgreSQL Index Maintenance](https://www.postgresql.org/docs/current/routine-reindex.html)
