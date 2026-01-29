# Read Replica Router

## Overview

The Read Replica Router is a database query routing component that intelligently distributes database queries between a primary database and read replicas based on query type, replica health, and replication lag.

## Features

- **Automatic Query Type Detection**: Analyzes SQL statements to determine if they are read or write operations
- **Replica Health Monitoring**: Continuously monitors replica health and replication lag
- **Circuit Breaker Pattern**: Automatically isolates unhealthy replicas to prevent cascading failures
- **Lag-Based Routing**: Routes queries based on replication lag thresholds
- **Automatic Failover**: Falls back to primary database when replicas are unavailable
- **Routing Statistics**: Tracks query distribution and failover metrics

## Architecture

```
┌─────────────────┐
│  Application    │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Read Replica    │
│    Router       │
└────────┬────────┘
         │
    ┌────┴────┐
    │         │
    ▼         ▼
┌────────┐ ┌────────┐
│Primary │ │Replica │
│   DB   │ │   DB   │
└────────┘ └────────┘
```

## Usage

### Basic Setup

```typescript
import { getReadReplicaRouter } from '@/lib/services/read-replica-router';

// Get router instance (singleton)
const router = getReadReplicaRouter();

// Route a query
const query = {
  sql: 'SELECT * FROM products WHERE tenant_id = $1',
  params: ['tenant-123'],
  type: 'read' as const,
  tenantId: 'tenant-123',
};

const pool = await router.route(query);
const result = await pool.query(query.sql, query.params);
```

### Environment Configuration

```bash
# Primary database connection
DATABASE_URL=postgresql://user:pass@primary-host:5432/dbname

# Replica database connections (comma-separated)
DATABASE_REPLICA_URLS=postgresql://user:pass@replica1:5432/dbname,postgresql://user:pass@replica2:5432/dbname
```

### Query Routing Logic

1. **Write Operations** → Always routed to primary
   - INSERT, UPDATE, DELETE
   - CREATE, ALTER, DROP
   - TRUNCATE

2. **Read Operations** → Routed to replicas (with fallback)
   - SELECT queries
   - WITH (CTE) queries that are read-only

3. **Failover Conditions**:
   - No healthy replicas available
   - All replicas have lag > 30 seconds
   - Circuit breaker is open for all replicas

## Replication Lag Monitoring

### Thresholds

- **Warning Threshold**: 5 seconds
  - Logs a warning message
  - Replica remains available

- **Failover Threshold**: 30 seconds
  - Replica marked as unhealthy
  - Queries routed to primary instead

### Monitoring Methods

The router uses two methods to check replication lag:

1. **Primary-Side Monitoring**: Queries `pg_stat_replication` on primary
2. **Replica-Side Monitoring**: Queries `pg_last_xact_replay_timestamp()` on replica

### Lag Check Frequency

- Automatic checks every 30 seconds
- Manual checks via `checkReplicationLag()` method

## Circuit Breaker

### Purpose

Prevents repeated attempts to use unhealthy replicas, reducing latency and error rates.

### Configuration

- **Failure Threshold**: 3 consecutive failures
- **Reset Time**: 60 seconds (1 minute)

### Behavior

1. Replica fails health check
2. Failure count increments
3. After 3 failures, circuit breaker opens
4. Replica is excluded from routing
5. After 60 seconds, circuit breaker resets
6. Replica is retried on next health check

## API Reference

### `route(query: Query): Promise<pg.Pool>`

Routes a query to the appropriate database pool.

**Parameters:**
- `query.sql`: SQL statement
- `query.params`: Query parameters
- `query.type`: 'read' | 'write' (optional, auto-detected)
- `query.tenantId`: Tenant identifier

**Returns:** PostgreSQL connection pool

**Example:**
```typescript
const pool = await router.route({
  sql: 'SELECT * FROM users WHERE id = $1',
  params: [userId],
  type: 'read',
  tenantId: 'tenant-123',
});
```

### `checkReplicationLag(): Promise<ReplicationStatus[]>`

Checks replication lag for all configured replicas.

**Returns:** Array of replication status objects

**Example:**
```typescript
const statuses = await router.checkReplicationLag();
statuses.forEach(status => {
  console.log(`${status.replicaId}: ${status.lagSeconds}s lag`);
});
```

### `markUnhealthy(replicaId: string): Promise<void>`

Manually marks a replica as unhealthy.

**Parameters:**
- `replicaId`: Identifier of the replica

**Example:**
```typescript
await router.markUnhealthy('replica-1');
```

### `getRoutingStats(): Promise<RoutingStats>`

Gets routing statistics and metrics.

**Returns:** Routing statistics object

**Example:**
```typescript
const stats = await router.getRoutingStats();
console.log(`Primary queries: ${stats.primaryQueries}`);
console.log(`Replica queries: ${stats.replicaQueries}`);
console.log(`Failover count: ${stats.failoverCount}`);
console.log(`Avg lag: ${stats.avgReplicationLag}s`);
```

## Monitoring and Alerting

### Key Metrics

1. **Query Distribution**
   - Primary queries count
   - Replica queries count
   - Failover count

2. **Replication Health**
   - Average replication lag
   - Replica health status
   - Circuit breaker status

3. **Performance**
   - Query routing latency
   - Connection pool utilization

### Recommended Alerts

- Replication lag > 5 seconds (warning)
- Replication lag > 30 seconds (critical)
- All replicas unhealthy (critical)
- Failover rate > 10% (warning)
- Circuit breaker open (warning)

## Best Practices

### 1. Connection String Configuration

- Use connection pooling for all database connections
- Configure appropriate pool sizes for replicas
- Use SSL/TLS for replica connections

### 2. Query Design

- Explicitly mark query type when known
- Use read replicas for reporting and analytics
- Keep write operations on primary

### 3. Monitoring

- Monitor replication lag continuously
- Set up alerts for lag thresholds
- Track failover rates

### 4. Capacity Planning

- Size replicas appropriately for read load
- Consider multiple replicas for high availability
- Monitor replica CPU and memory usage

## Troubleshooting

### High Replication Lag

**Symptoms:**
- Queries routed to primary instead of replicas
- Lag warnings in logs

**Solutions:**
1. Check network connectivity between primary and replica
2. Verify replica has sufficient resources (CPU, memory, disk I/O)
3. Check for long-running transactions on primary
4. Consider increasing `max_wal_senders` on primary

### Circuit Breaker Frequently Opening

**Symptoms:**
- Repeated circuit breaker open/reset messages
- Inconsistent replica availability

**Solutions:**
1. Investigate replica health issues
2. Check network stability
3. Verify replica configuration
4. Consider increasing circuit breaker threshold

### All Queries Going to Primary

**Symptoms:**
- `replicaQueries` count is 0
- High failover count

**Solutions:**
1. Verify replica connection strings are configured
2. Check replica health status
3. Verify replicas are in recovery mode
4. Check replication lag values

## Performance Considerations

### Query Routing Overhead

- Query type detection: ~0.1ms
- Replica selection: ~0.1ms
- Total overhead: ~0.2ms per query

### Connection Pool Management

- Each replica maintains its own connection pool
- Pool configuration inherited from ConnectionPoolManager
- Recommended: 10-50 connections per replica

### Lag Monitoring Impact

- Lag checks run every 30 seconds
- Minimal impact on primary and replicas
- Uses lightweight queries

## Integration Examples

### With Prisma

```typescript
import { PrismaClient } from '@prisma/client';
import { getReadReplicaRouter } from '@/lib/services/read-replica-router';

const router = getReadReplicaRouter();

// Custom Prisma client with replica routing
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
});

// Wrap queries with routing logic
async function queryWithRouting(sql: string, params: any[]) {
  const pool = await router.route({
    sql,
    params,
    type: 'read',
    tenantId: 'tenant-123',
  });
  
  return pool.query(sql, params);
}
```

### With Express Middleware

```typescript
import { Router } from 'express';
import { getReadReplicaRouter } from '@/lib/services/read-replica-router';

const router = Router();
const dbRouter = getReadReplicaRouter();

router.get('/products', async (req, res) => {
  const pool = await dbRouter.route({
    sql: 'SELECT * FROM products WHERE tenant_id = $1',
    params: [req.user.tenantId],
    type: 'read',
    tenantId: req.user.tenantId,
  });
  
  const result = await pool.query(
    'SELECT * FROM products WHERE tenant_id = $1',
    [req.user.tenantId]
  );
  
  res.json(result.rows);
});
```

## Related Components

- **Connection Pool Manager**: Manages connection pools for primary and replicas
- **Query Analyzer**: Analyzes query performance across all databases
- **Cache Layer**: Reduces database load by caching query results

## References

- [PostgreSQL Replication Documentation](https://www.postgresql.org/docs/current/high-availability.html)
- [pg_stat_replication View](https://www.postgresql.org/docs/current/monitoring-stats.html#MONITORING-PG-STAT-REPLICATION-VIEW)
- [Circuit Breaker Pattern](https://martinfowler.com/bliki/CircuitBreaker.html)
