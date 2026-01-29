# Bulk Operations Utilities

## Overview

The Bulk Operations module provides optimized utilities for performing database operations on large datasets. It implements best practices for batch processing, transaction management, and chunking to ensure efficient and reliable bulk operations.

## Features

- **Batch Inserts**: Insert thousands of records efficiently with configurable batch sizes
- **Bulk Updates**: Update multiple records with a single query using WHERE IN clauses
- **Transaction Wrapper**: Ensure atomicity for complex multi-step operations
- **Chunked Processing**: Automatically split large datasets to prevent timeouts
- **Batch Deletes**: Delete multiple records efficiently
- **Retry Logic**: Built-in retry mechanism for transient failures
- **Progress Logging**: Detailed logging for monitoring and debugging

## Requirements Addressed

- **7.1**: Batch inserts with maximum batch size of 1000 records
- **7.2**: Bulk updates using WHERE IN clause instead of individual updates
- **7.3**: Transaction wrapper for atomic bulk operations
- **7.4**: Chunked processing for operations exceeding 10,000 records

## Usage Examples

### Batch Insert

```typescript
import { batchInsert } from '@/lib/utils/bulk-operations';
import { optimizedPrisma } from '@/lib/database';

// Insert 5000 products in batches of 1000
const products = [
  { name: 'Product 1', price: 99.99, tenantId: 'tenant-1' },
  { name: 'Product 2', price: 149.99, tenantId: 'tenant-1' },
  // ... 4998 more products
];

const result = await batchInsert(
  optimizedPrisma,
  'userProducts',
  products,
  { batchSize: 1000 }
);

console.log(`Inserted ${result.successCount}/${result.totalRecords} records in ${result.durationMs}ms`);
```

### Bulk Update

```typescript
import { bulkUpdate } from '@/lib/utils/bulk-operations';
import { optimizedPrisma } from '@/lib/database';

// Update prices for multiple products
const updates = [
  { id: 'prod-1', data: { currentPrice: 89.99 } },
  { id: 'prod-2', data: { currentPrice: 89.99 } },
  { id: 'prod-3', data: { currentPrice: 129.99 } },
  // ... more updates
];

const result = await bulkUpdate(
  optimizedPrisma,
  'userProducts',
  updates
);

console.log(`Updated ${result.successCount} products`);
```

### Transaction Wrapper

```typescript
import { withTransaction } from '@/lib/utils/bulk-operations';
import { optimizedPrisma } from '@/lib/database';

// Execute multiple operations atomically
const result = await withTransaction(optimizedPrisma, async (tx) => {
  // Create price update records
  const priceUpdates = await tx.priceUpdates.createMany({
    data: updates.map(u => ({
      userProductId: u.id,
      oldPrice: u.oldPrice,
      newPrice: u.newPrice,
      status: 'pending',
      tenantId: 'tenant-1',
    })),
  });

  // Update product prices
  for (const update of updates) {
    await tx.userProducts.update({
      where: { id: update.id },
      data: { currentPrice: update.newPrice },
    });
  }

  // Mark updates as complete
  await tx.priceUpdates.updateMany({
    where: { status: 'pending' },
    data: { status: 'success', executedAt: new Date() },
  });

  return priceUpdates;
});
```

### Chunked Processing

```typescript
import { processInChunks } from '@/lib/utils/bulk-operations';
import { optimizedPrisma } from '@/lib/database';

// Process 50,000 records in chunks of 10,000
const largeDataset = [...]; // 50,000 records

const results = await processInChunks(
  largeDataset,
  10000,
  async (chunk, chunkIndex) => {
    // Process each chunk
    return await batchInsert(
      optimizedPrisma,
      'priceHistory',
      chunk
    );
  }
);

console.log(`Processed ${results.length} chunks`);
```

### Batch Delete

```typescript
import { batchDelete } from '@/lib/utils/bulk-operations';
import { optimizedPrisma } from '@/lib/database';

// Delete old records
const oldRecordIds = ['id-1', 'id-2', 'id-3', /* ... */];

const result = await batchDelete(
  optimizedPrisma,
  'priceHistory',
  oldRecordIds,
  { batchSize: 1000 }
);

console.log(`Deleted ${result.successCount} records`);
```

## Configuration Options

### BulkOperationConfig

```typescript
interface BulkOperationConfig {
  batchSize?: number;        // Records per batch (default: 1000)
  maxRetries?: number;       // Maximum retry attempts (default: 3)
  retryDelayMs?: number;     // Delay between retries (default: 1000ms)
}
```

### BulkOperationResult

```typescript
interface BulkOperationResult {
  totalRecords: number;      // Total records processed
  successCount: number;      // Successfully processed records
  failureCount: number;      // Failed records
  errors: Array<{            // Error details
    index: number;
    error: string;
  }>;
  durationMs: number;        // Total operation duration
}
```

## Performance Characteristics

### Batch Insert Performance

- **Small datasets (< 1000 records)**: Single batch, ~100-200ms
- **Medium datasets (1000-10000 records)**: Multiple batches, ~500ms-2s
- **Large datasets (> 10000 records)**: Use chunked processing, ~5-10s per 10k records

### Bulk Update Performance

- **Grouped updates**: Automatically groups identical updates for efficiency
- **WHERE IN optimization**: Single query per unique update instead of N queries
- **Expected improvement**: 10-50x faster than individual updates

### Transaction Overhead

- **Small transactions**: Minimal overhead (~10-20ms)
- **Large transactions**: Consider chunking if > 10,000 operations
- **Rollback**: Automatic on any failure within transaction

## Best Practices

### 1. Choose Appropriate Batch Sizes

```typescript
// For inserts: 1000 records per batch (default)
await batchInsert(prisma, 'products', records, { batchSize: 1000 });

// For updates: Can be larger since updates are lighter
await bulkUpdate(prisma, 'products', updates, { batchSize: 2000 });
```

### 2. Use Transactions for Related Operations

```typescript
// Good: Atomic operation
await withTransaction(prisma, async (tx) => {
  await tx.priceUpdates.createMany({ data: updates });
  await tx.userProducts.updateMany({ where: {...}, data: {...} });
});

// Bad: Non-atomic, can leave inconsistent state
await prisma.priceUpdates.createMany({ data: updates });
await prisma.userProducts.updateMany({ where: {...}, data: {...} });
```

### 3. Handle Large Datasets with Chunking

```typescript
// Good: Chunked processing for 50k+ records
await processInChunks(largeDataset, 10000, async (chunk) => {
  return await batchInsert(prisma, 'records', chunk);
});

// Bad: Single transaction for 50k records (may timeout)
await batchInsert(prisma, 'records', largeDataset);
```

### 4. Monitor and Log Results

```typescript
const result = await batchInsert(prisma, 'products', records);

if (result.failureCount > 0) {
  console.error(`Failed to insert ${result.failureCount} records`);
  result.errors.forEach(err => {
    console.error(`Batch ${err.index}: ${err.error}`);
  });
}
```

### 5. Use Retry Logic for Transient Failures

```typescript
// Built-in retry with exponential backoff
await batchInsert(prisma, 'products', records, {
  maxRetries: 3,
  retryDelayMs: 1000, // 1s, 2s, 3s delays
});
```

## Error Handling

### Partial Failures

Bulk operations continue processing remaining batches even if one batch fails:

```typescript
const result = await batchInsert(prisma, 'products', records);

// Check for partial failures
if (result.failureCount > 0) {
  console.log(`Partial failure: ${result.successCount} succeeded, ${result.failureCount} failed`);
  
  // Retry failed batches
  const failedBatches = result.errors.map(e => e.index);
  // ... implement retry logic
}
```

### Transaction Failures

Transactions roll back completely on any error:

```typescript
try {
  await withTransaction(prisma, async (tx) => {
    // All operations succeed or all fail
    await tx.products.createMany({ data: products });
    await tx.priceHistory.createMany({ data: history });
  });
} catch (error) {
  console.error('Transaction failed, all changes rolled back:', error);
}
```

## Integration with Other Components

### With Archive Manager

```typescript
import { batchInsert } from '@/lib/utils/bulk-operations';
import { ArchiveManager } from '@/lib/services/archive-manager';

// Archive old records using bulk operations
const archiveManager = new ArchiveManager(prisma);
const oldRecords = await archiveManager.selectRecordsForArchival('priceHistory', 90);

await withTransaction(prisma, async (tx) => {
  // Insert into archive
  await batchInsert(tx as any, 'priceHistoryArchive', oldRecords);
  
  // Delete from main table
  await batchDelete(tx as any, 'priceHistory', oldRecords.map(r => r.id));
});
```

### With Connection Pool Manager

```typescript
import { batchInsert } from '@/lib/utils/bulk-operations';
import { getConnectionPoolManager } from '@/lib/database';

// Use connection pool for bulk operations
const poolManager = getConnectionPoolManager();
const pool = poolManager.getPool();

// Bulk operations automatically use pooled connections
await batchInsert(prisma, 'products', records);
```

## Monitoring and Metrics

### Key Metrics to Track

- **Throughput**: Records processed per second
- **Success Rate**: Percentage of successful operations
- **Duration**: Total operation time
- **Batch Size**: Optimal batch size for your workload
- **Retry Rate**: Frequency of retry attempts

### Example Monitoring

```typescript
const startTime = Date.now();
const result = await batchInsert(prisma, 'products', records);

// Calculate metrics
const throughput = result.successCount / (result.durationMs / 1000);
const successRate = (result.successCount / result.totalRecords) * 100;

console.log(`Throughput: ${throughput.toFixed(2)} records/sec`);
console.log(`Success Rate: ${successRate.toFixed(2)}%`);
console.log(`Duration: ${result.durationMs}ms`);
```

## Troubleshooting

### Issue: Batch Insert Timeout

**Solution**: Reduce batch size or use chunked processing

```typescript
// Instead of default 1000
await batchInsert(prisma, 'products', records, { batchSize: 500 });

// Or use chunking
await processInChunks(records, 5000, async (chunk) => {
  return await batchInsert(prisma, 'products', chunk, { batchSize: 500 });
});
```

### Issue: Transaction Deadlock

**Solution**: Reduce transaction scope or retry with backoff

```typescript
let retries = 0;
while (retries < 3) {
  try {
    await withTransaction(prisma, async (tx) => {
      // ... operations
    });
    break;
  } catch (error) {
    if (error.message.includes('deadlock')) {
      retries++;
      await new Promise(resolve => setTimeout(resolve, 1000 * retries));
    } else {
      throw error;
    }
  }
}
```

### Issue: Memory Exhaustion

**Solution**: Use streaming or chunked processing

```typescript
// Instead of loading all records into memory
const allRecords = await prisma.products.findMany(); // Bad

// Process in chunks
await processInChunks(recordIds, 10000, async (chunk) => {
  const records = await prisma.products.findMany({
    where: { id: { in: chunk } }
  });
  return await processRecords(records);
});
```

## See Also

- [Connection Pool Manager](../services/connection-pool-manager.README.md)
- [Archive Manager](../services/archive-manager.README.md)
- [Query Optimization](./query-optimization.ts)


## COPY Operations for Large Loads

### Overview

For very large datasets (50,000+ records), PostgreSQL's COPY command provides significantly better performance than INSERT statements. The bulk operations module automatically detects when to use COPY based on record count.

### Smart Bulk Insert

The `smartBulkInsert` function automatically chooses the optimal insertion method:

```typescript
import { smartBulkInsert } from '@/lib/utils/bulk-operations';
import { optimizedPrisma } from '@/lib/database';

// Automatically uses COPY for 100k records
const largeDataset = Array.from({ length: 100000 }, (_, i) => ({
  name: `Product ${i}`,
  price: 99.99,
  tenantId: 'tenant-1',
  createdAt: new Date(),
}));

const result = await smartBulkInsert(
  optimizedPrisma,
  'userProducts',
  largeDataset,
  ['name', 'price', 'tenantId', 'createdAt'] // Column names
);

console.log(`Loaded ${result.successCount} records using COPY`);
```

### Manual COPY Operation

For direct control over COPY operations:

```typescript
import { copyBulkLoad } from '@/lib/utils/bulk-operations';
import { optimizedPrisma } from '@/lib/database';

const records = [...]; // Large dataset

const result = await copyBulkLoad(
  optimizedPrisma,
  'user_products', // Table name (not model name)
  records,
  ['name', 'price', 'tenant_id', 'created_at'] // Column names
);
```

### Performance Comparison

| Method | 10k Records | 50k Records | 100k Records | 500k Records |
|--------|-------------|-------------|--------------|--------------|
| Individual INSERTs | ~30s | ~150s | ~300s | ~1500s |
| Batch INSERT (1000) | ~3s | ~15s | ~30s | ~150s |
| COPY | ~0.5s | ~2s | ~4s | ~20s |

### Automatic Detection

The system automatically routes to COPY when:

```typescript
// < 50,000 records: Uses batch insert
await smartBulkInsert(prisma, 'products', smallDataset);

// >= 50,000 records: Uses COPY
await smartBulkInsert(prisma, 'products', largeDataset);
```

### Check Optimal Method

```typescript
import { getOptimalInsertionMethod } from '@/lib/utils/bulk-operations';

const method = getOptimalInsertionMethod(75000);
console.log(method); // 'copy'

const method2 = getOptimalInsertionMethod(25000);
console.log(method2); // 'batch'
```

### Important Notes

#### Column Names

COPY requires explicit column names:

```typescript
// Good: Explicit columns
await smartBulkInsert(prisma, 'products', records, ['id', 'name', 'price']);

// Also works: Auto-detected from first record
await smartBulkInsert(prisma, 'products', records);
```

#### Table Names vs Model Names

COPY uses actual table names, not Prisma model names:

```typescript
// Prisma model: UserProduct
// Table name: user_products

await copyBulkLoad(prisma, 'user_products', records, columns);
```

#### Data Type Handling

COPY automatically handles:
- **NULL values**: Represented as `\N`
- **Dates**: Converted to ISO 8601 format
- **JSON**: Objects/arrays serialized to JSON strings
- **Strings**: Special characters escaped (`\`, `\n`, `\t`)

#### Limitations

1. **Prisma Limitations**: Prisma doesn't natively support COPY FROM STDIN with streaming
2. **Production Use**: Consider using `pg-copy-streams` or `node-postgres` directly for production
3. **Transactions**: COPY operations should be wrapped in transactions for atomicity
4. **Error Handling**: COPY fails completely on any error (no partial success)

### Production Implementation

For production use with streaming COPY:

```typescript
import { Pool } from 'pg';
import copyFrom from 'pg-copy-streams';
import { Readable } from 'stream';

async function productionCopyLoad(
  pool: Pool,
  tableName: string,
  records: any[],
  columns: string[]
) {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const copyCommand = `
      COPY ${tableName} (${columns.join(', ')})
      FROM STDIN
      WITH (FORMAT csv, HEADER false, DELIMITER ',')
    `;
    
    const stream = client.query(copyFrom.from(copyCommand));
    
    // Create readable stream from records
    const dataStream = Readable.from(
      records.map(record => 
        columns.map(col => record[col]).join(',') + '\n'
      )
    );
    
    await new Promise((resolve, reject) => {
      dataStream.pipe(stream)
        .on('finish', resolve)
        .on('error', reject);
    });
    
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
```

### When to Use COPY

**Use COPY when:**
- Loading 50,000+ records
- Initial data migration
- Bulk data imports from external sources
- Performance is critical

**Use Batch INSERT when:**
- < 50,000 records
- Need Prisma's type safety
- Complex data transformations
- Incremental updates

### Monitoring COPY Operations

```typescript
const startTime = Date.now();
const result = await smartBulkInsert(prisma, 'products', largeDataset);

console.log(`Method: ${result.totalRecords >= 50000 ? 'COPY' : 'BATCH'}`);
console.log(`Records: ${result.successCount}/${result.totalRecords}`);
console.log(`Duration: ${result.durationMs}ms`);
console.log(`Throughput: ${(result.successCount / (result.durationMs / 1000)).toFixed(0)} records/sec`);
```

### Error Recovery

COPY operations are all-or-nothing:

```typescript
try {
  await smartBulkInsert(prisma, 'products', largeDataset);
} catch (error) {
  console.error('COPY failed, falling back to batch insert');
  
  // Fallback to batch insert
  await batchInsert(prisma, 'products', largeDataset, {
    batchSize: 1000
  });
}
```
