# Database Optimization Infrastructure

This directory contains the infrastructure for database optimization, including connection pooling, query monitoring, and performance tracking.

## Setup Instructions

### 1. Database Extensions

The database optimization feature requires two PostgreSQL extensions:

#### pg_stat_statements
Tracks execution statistics of all SQL statements executed by the server.

```sql
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;
```

#### pgstattuple
Provides functions to obtain tuple-level statistics for tables and indexes.

```sql
CREATE EXTENSION IF NOT EXISTS pgstattuple;
```

#### Setup Script

Run the setup script to enable these extensions:

```bash
npx tsx scripts/setup-optimization-extensions.ts
```

**Note:** You need superuser privileges to create extensions. If you don't have them, ask your database administrator to run the SQL commands above.

### 2. Database Schema

The optimization tables have been created via Prisma migration:

- `SlowQuery` - Stores slow query logs
- `QueryPerformanceMetric` - Stores aggregated query performance metrics
- `IndexRecommendation` - Stores index recommendations

These tables were created by the migration: `20260129081216_add_database_optimization_tables`

### 3. Connection Pool Configuration

The connection pool can be configured via environment variables:

```env
# Database connection
DATABASE_URL="postgresql://user:password@host:port/database"

# Connection pool settings (optional)
DB_POOL_MIN=10          # Minimum connections (default: 10)
DB_POOL_MAX=50          # Maximum connections (default: 50)
```

### 4. PostgreSQL Configuration (Optional)

For optimal performance, configure pg_stat_statements in your PostgreSQL configuration:

```sql
-- Track up to 10,000 distinct queries
ALTER SYSTEM SET pg_stat_statements.max = 10000;

-- Track all queries (not just top-level)
ALTER SYSTEM SET pg_stat_statements.track = 'all';

-- Save query text
ALTER SYSTEM SET pg_stat_statements.save = true;

-- Reload configuration
SELECT pg_reload_conf();
```

**Note:** These settings require superuser privileges and may require a database restart.

## Components

### Connection Pool Manager

Located in `lib/services/connection-pool-manager.ts`

Features:
- Configurable min/max connection limits (10-50 by default)
- Connection health checks every 30 seconds
- Automatic connection lifecycle management (30-minute max lifetime)
- Utilization monitoring with warnings at 80%
- Exponential backoff retry logic (5 attempts max)
- Graceful shutdown support

Usage:

```typescript
import { getConnectionPoolManager } from '@/lib/services/connection-pool-manager';

const poolManager = getConnectionPoolManager();
const stats = poolManager.getPoolStats();
console.log(`Pool utilization: ${stats.utilizationPercent}%`);
```

### Optimized Prisma Client

Located in `lib/database/optimized-prisma.ts`

Provides a Prisma client instance that uses the enhanced connection pool manager:

```typescript
import { optimizedPrisma } from '@/lib/database/optimized-prisma';

const users = await optimizedPrisma.user.findMany();
```

### Type Definitions

Located in `lib/types/database-optimization.ts`

Contains all TypeScript interfaces and types for:
- Query Analyzer
- Index Manager
- Connection Pool Manager
- Cache Layer
- Archive Manager
- Read Replica Router
- Performance Testing
- Bulk Operations
- Maintenance

### Constants and Utilities

Located in `lib/database/optimization-constants.ts`

Provides:
- Configuration constants for all optimization features
- Query fingerprinting utilities
- Query type detection
- Maintenance window checking
- Exponential backoff calculation
- Byte formatting
- Percentile calculation

## Verification

### Check Extensions

Verify that the extensions are installed:

```sql
SELECT extname, extversion 
FROM pg_extension 
WHERE extname IN ('pg_stat_statements', 'pgstattuple');
```

### Check Tables

Verify that the optimization tables exist:

```sql
SELECT tablename 
FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename IN ('SlowQuery', 'QueryPerformanceMetric', 'IndexRecommendation');
```

### Test Connection Pool

Test the connection pool:

```typescript
import { getConnectionPoolManager } from '@/lib/services/connection-pool-manager';

const poolManager = getConnectionPoolManager();
const health = await poolManager.healthCheck();
console.log('Database health:', health);
```

## Next Steps

After completing this infrastructure setup, you can proceed with:

1. **Task 2**: Implement Query Analyzer component
2. **Task 3**: Implement Index Manager component
3. **Task 5**: Implement Connection Pool Manager (already done as part of infrastructure)
4. **Task 6**: Implement Cache Layer component

## Troubleshooting

### Permission Denied Errors

If you get permission denied errors when creating extensions:

1. Contact your database administrator
2. Provide them with the SQL commands from the setup section
3. They need to run these commands with superuser privileges

### Connection Pool Issues

If you experience connection pool issues:

1. Check the `DB_POOL_MIN` and `DB_POOL_MAX` environment variables
2. Monitor pool utilization with `poolManager.getPoolStats()`
3. Check database connection limits: `SHOW max_connections;`
4. Ensure your database plan supports the configured connection count

### Extension Not Available

If extensions are not available:

1. Check PostgreSQL version (requires 9.2+ for pg_stat_statements)
2. Verify extensions are installed: `SELECT * FROM pg_available_extensions;`
3. Contact your hosting provider if extensions are not available

## References

- [pg_stat_statements Documentation](https://www.postgresql.org/docs/current/pgstatstatements.html)
- [pgstattuple Documentation](https://www.postgresql.org/docs/current/pgstattuple.html)
- [node-postgres Pool Documentation](https://node-postgres.com/apis/pool)
- [Prisma Connection Pooling](https://www.prisma.io/docs/guides/performance-and-optimization/connection-management)
