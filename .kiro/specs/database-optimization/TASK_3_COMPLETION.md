# Task 3 Completion: Index Manager Component

## Overview

Successfully implemented the Index Manager component for database optimization. The component provides comprehensive index management capabilities including automated analysis, suggestion generation, unused index detection, concurrent index creation, fragmentation monitoring, and maintenance.

## Completed Sub-Tasks

### ✅ Task 3.1: Create IndexManager class with index analysis
- Implemented `suggestIndexes()` method using pg_stat_statements analysis
- Implemented `findUnusedIndexes()` method using pg_stat_user_indexes
- Integrated with IndexRecommendation table for storing suggestions
- Added intelligent index suggestion patterns for multi-tenant architecture

### ✅ Task 3.4: Implement index creation and maintenance
- Implemented `createIndexConcurrently()` with proper SQL generation
- Implemented `rebuildFragmentedIndexes()` using pgstattuple
- Implemented `getIndexStats()` for comprehensive monitoring
- Added maintenance window checking for rebuild operations

## Implementation Details

### Files Created

1. **lib/services/index-manager.ts** (470 lines)
   - IndexManager class implementation
   - All required methods per design specification
   - Singleton pattern with getIndexManager() factory
   - Comprehensive error handling

2. **__tests__/lib/services/index-manager.test.ts** (550 lines)
   - 17 unit tests covering all functionality
   - Tests for index suggestion generation
   - Tests for unused index detection
   - Tests for concurrent index creation
   - Tests for fragmentation monitoring
   - Tests for statistics collection
   - All tests passing ✅

3. **lib/services/index-manager.README.md** (450 lines)
   - Comprehensive documentation
   - Usage examples for all methods
   - API endpoint specifications
   - Best practices and troubleshooting
   - Performance considerations

### Key Features Implemented

#### 1. Automated Index Analysis
- Analyzes pg_stat_statements for slow queries
- Identifies tables with sequential scans
- Generates index suggestions based on query patterns
- Estimates impact (high/medium/low) based on:
  - Number of slow queries
  - Table size
  - Write activity

#### 2. Index Suggestion Patterns
Implements three common multi-tenant patterns:
- **Tenant + Status**: `(tenantId, status)`
- **Tenant + Timestamp**: `(tenantId, createdAt DESC)`
- **Updated Timestamp**: `(updatedAt DESC)`

#### 3. Unused Index Detection
- Identifies indexes with zero scans
- Excludes primary keys and unique constraints
- Orders by size (largest first)
- Generates DROP statements

#### 4. Concurrent Index Creation
- Uses `CREATE INDEX CONCURRENTLY` to avoid table locks
- Supports unique indexes
- Supports partial indexes with WHERE clause
- Updates recommendation status automatically

#### 5. Fragmentation Monitoring
- Uses pgstatindex() for fragmentation analysis
- Only checks indexes > 10MB (performance optimization)
- Rebuilds indexes exceeding threshold
- Only runs during maintenance windows (2-4 AM UTC)

#### 6. Usage Statistics
- Comprehensive metrics per index:
  - Size in bytes
  - Number of scans
  - Tuples read/returned
  - Fragmentation percentage
- Ordered by size for prioritization

## Requirements Satisfied

✅ **Requirement 2.2**: Missing index detection
- Analyzes pg_stat_statements to identify missing indexes
- Suggests composite indexes for frequently queried columns

✅ **Requirement 2.3**: Unused index identification
- Uses pg_stat_user_indexes to find indexes with zero scans
- Provides drop statements for cleanup

✅ **Requirement 2.4**: Concurrent index creation
- Implements CREATE INDEX CONCURRENTLY
- Avoids table locking during index creation

✅ **Requirement 2.5**: Index usage statistics
- Maintains comprehensive statistics for all indexes
- Tracks scans, tuples, size, and fragmentation

✅ **Requirement 2.6**: Fragmented index scheduling
- Detects fragmentation using pgstattuple
- Schedules rebuilds during maintenance windows
- Rebuilds indexes exceeding 30% fragmentation

## Test Results

All 17 unit tests passing:

```
IndexManager
  suggestIndexes
    ✓ should suggest indexes for tables with slow queries
    ✓ should not suggest indexes that already exist
    ✓ should estimate high impact for large tables with many slow queries
  findUnusedIndexes
    ✓ should identify indexes with zero scans
    ✓ should not include primary key or unique indexes
    ✓ should order unused indexes by size descending
  createIndexConcurrently
    ✓ should generate correct CREATE INDEX CONCURRENTLY SQL
    ✓ should generate UNIQUE index when specified
    ✓ should include WHERE clause when provided
    ✓ should update recommendation status after creation
    ✓ should throw error if index creation fails
  rebuildFragmentedIndexes
    ✓ should rebuild indexes exceeding fragmentation threshold
    ✓ should skip indexes below fragmentation threshold
    ✓ should continue on error for individual indexes
  getIndexStats
    ✓ should return comprehensive index statistics
    ✓ should handle fragmentation check failures gracefully
    ✓ should order indexes by size descending

Test Suites: 1 passed, 1 total
Tests:       17 passed, 17 total
```

## Usage Example

```typescript
import { getIndexManager } from '@/lib/services/index-manager';

const indexManager = getIndexManager();

// Suggest missing indexes
const suggestions = await indexManager.suggestIndexes();
console.log(`Found ${suggestions.length} index suggestions`);

// Find unused indexes
const unusedIndexes = await indexManager.findUnusedIndexes(30);
console.log(`Found ${unusedIndexes.length} unused indexes`);

// Create an index concurrently
await indexManager.createIndexConcurrently({
  name: 'idx_user_products_tenant_status',
  tableName: 'user_products',
  columns: ['tenantId', 'status'],
  unique: false
});

// Rebuild fragmented indexes (during maintenance window)
await indexManager.rebuildFragmentedIndexes(30);

// Get index statistics
const stats = await indexManager.getIndexStats();
console.log(`Monitoring ${stats.length} indexes`);
```

## Integration Points

### Database
- Uses optimized Prisma client for database access
- Executes raw SQL queries via connection pool
- Stores recommendations in IndexRecommendation table

### Connection Pool
- Leverages ConnectionPoolManager for database connections
- Ensures efficient connection usage
- Handles connection failures gracefully

### Maintenance Windows
- Checks maintenance window before rebuild operations
- Default window: 2-4 AM UTC
- Configurable via optimization constants

## API Endpoints (Ready for Implementation)

The following endpoints can be implemented using the IndexManager:

1. **GET /api/v1/admin/performance/index-recommendations**
   - Returns pending index suggestions
   - Includes impact estimation and SQL statements

2. **GET /api/v1/admin/performance/index-stats**
   - Returns comprehensive index statistics
   - Includes usage metrics and fragmentation data

3. **POST /api/v1/admin/performance/indexes**
   - Creates an index concurrently
   - Accepts IndexDefinition in request body

4. **GET /api/v1/admin/performance/unused-indexes**
   - Returns list of unused indexes
   - Includes size and drop statements

## Performance Considerations

### Optimizations Implemented
- Only checks fragmentation for indexes > 10MB
- Uses concurrent operations to avoid table locks
- Caches index statistics to reduce overhead
- Limits analysis to top 50 slow queries

### Resource Usage
- Index creation requires 2x disk space temporarily
- Fragmentation checks can be slow for large indexes
- Rebuild operations should run during maintenance windows

## Error Handling

The implementation includes comprehensive error handling:

1. **Index Creation Failures**: Throws error with details
2. **Fragmentation Check Failures**: Returns 0% fragmentation
3. **Rebuild Failures**: Logs error and continues with other indexes
4. **Query Failures**: Propagates error to caller

## Next Steps

With Task 3 complete, the following tasks are ready:

1. **Task 4**: Checkpoint - Ensure monitoring components work
2. **Task 5**: Implement Connection Pool Manager (already done)
3. **Task 6**: Implement Cache Layer component
4. **Task 8**: Implement query optimization utilities
5. **Task 15**: Create enhanced indexes for existing tables

## Optional Property-Based Tests

The following optional PBT tasks were not implemented (marked with * in tasks.md):
- Task 3.2: Property test for missing index detection
- Task 3.3: Property test for unused index identification
- Task 3.5: Property test for index statistics completeness
- Task 3.6: Property test for fragmented index scheduling
- Task 3.7: Unit test for concurrent index creation SQL (covered by existing tests)

These can be implemented later if needed for additional validation.

## Conclusion

Task 3 is complete with all required functionality implemented, tested, and documented. The Index Manager component is production-ready and provides comprehensive index management capabilities for the PricePilot database optimization feature.

**Status**: ✅ Complete
**Tests**: ✅ 17/17 passing
**Documentation**: ✅ Complete
**Requirements**: ✅ All satisfied (2.2, 2.3, 2.4, 2.5, 2.6)
