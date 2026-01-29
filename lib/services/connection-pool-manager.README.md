# Connection Pool Manager

## Overview

The Connection Pool Manager provides efficient database connection pooling with health monitoring, automatic lifecycle management, and exponential backoff retry logic for the PricePilot database optimization system.

## Features

### 1. Connection Pooling
- Configurable min/max connection limits (default: 10-50)
- Efficient connection reuse
- Automatic connection lifecycle management
- Keep-alive for connection health

### 2. Health Monitoring
- Periodic health checks every 30 seconds
- SELECT 1 query validation
- Automatic stale connection detection (>30 minutes)
- Connection replacement on failure

### 3. Utilization Monitoring
- Real-time pool statistics
- High utilization warnings (>80%)
- Detailed connection metrics
- Waiting request tracking

### 4. Retry Logic
- Exponential backoff retry mechanism
- Configurable retry limits (default: 5)
- Delay sequence: 100ms → 200ms → 400ms → 800ms → 1600ms
- Automatic connection cleanup

### 5. Graceful Shutdown
- Connection draining
- Health check cleanup
- Connection tracking cleanup

## Usage

### Basic Usage

```typescript
import { getConnectionPoolManager } from '@/lib/services/connection-pool-manager';

// Get singleton instance
const poolManager = getConnectionPoolManager();

// Get the underlying pool
const pool = poolManager.getPool();

// Execute a query
const client = await pool.connect();
try {
  const result = await client.query('SELECT * FROM users WHERE id = $1', [userId]);
  return result.rows;
} finally {
  client.release();
}
```

### Using Retry Logic

```typescript
import { getConnectionPoolManager } from '@/lib/services/connection-pool-manager';

const poolManager = getConnectionPoolManager();

// Execute with automatic retry
const result = await poolManager.executeWithRetry(async (client) => {
  return await client.query('SELECT * FROM products WHERE tenant_id = $1', [tenantId]);
});

// Custom retry limit
const result = await poolManager.executeWithRetry(
  async (client) => {
    return await client.query('SELECT * FROM orders');
  },
  3 // Max 3 retries
);
```

### Monitoring Pool Health

```typescript
import { getConnectionPoolManager } from '@/lib/services/connection-pool-manager';

const poolManager = getConnectionPoolManager();

// Get pool statistics
const stats = poolManager.getPoolStats();
console.log('Pool Stats:', {
  total: stats.totalConnections,
  active: stats.activeConnections,
  idle: stats.idleConnections,
  waiting: stats.waitingRequests,
  utilization: `${stats.utilizationPercent.toFixed(1)}%`
});

// Perform health check
const health = await poolManager.healthCheck();
console.log('Health Status:', {
  healthy: health.healthy,
  primaryReachable: health.primaryReachable,
  avgResponseTime: `${health.avgResponseTime}ms`
});
```

### Graceful Shutdown

```typescript
import { shutdownConnectionPoolManager } from '@/lib/services/connection-pool-manager';

// On application shutdown
process.on('SIGTERM', async () => {
  console.log('Shutting down connection pool...');
  await shutdownConnectionPoolManager();
  console.log('Connection pool closed');
  process.exit(0);
});
```

## Configuration

### Environment Variables

```bash
# Database connection string
DATABASE_URL=postgresql://user:password@localhost:5432/database

# Pool configuration (optional)
DB_POOL_MIN=10  # Minimum connections (default: 10)
DB_POOL_MAX=50  # Maximum connections (default: 50)
```

### Custom Configuration

```typescript
import { ConnectionPoolManagerImpl } from '@/lib/services/connection-pool-manager';

const poolManager = new ConnectionPoolManagerImpl(
  process.env.DATABASE_URL!,
  {
    min: 5,
    max: 25,
    idleTimeoutMillis: 30000,        // 30 seconds
    connectionTimeoutMillis: 20000,   // 20 seconds
    maxLifetimeMillis: 900000,        // 15 minutes
    healthCheckIntervalMillis: 60000, // 1 minute
  }
);
```

## Pool Statistics

The `getPoolStats()` method returns:

```typescript
interface PoolStats {
  totalConnections: number;      // Total connections in pool
  idleConnections: number;       // Idle connections available
  activeConnections: number;     // Connections currently in use
  waitingRequests: number;       // Requests waiting for connection
  utilizationPercent: number;    // Pool utilization percentage
}
```

## Health Status

The `healthCheck()` method returns:

```typescript
interface HealthStatus {
  healthy: boolean;              // Overall health status
  primaryReachable: boolean;     // Primary database reachable
  replicasReachable: number;     // Number of reachable replicas
  avgResponseTime: number;       // Average response time in ms
}
```

## Automatic Features

### Connection Lifecycle Management
- Connections older than 30 minutes are automatically removed
- Failed connections are automatically replaced
- Idle connections are cleaned up after timeout

### Health Monitoring
- Periodic health checks every 30 seconds
- Automatic detection of stale connections
- Connection replacement on health check failure

### Utilization Warnings
- Warnings logged when pool exceeds 80% capacity
- Includes detailed metrics:
  - Total connections
  - Active connections
  - Idle connections
  - Waiting requests

### Retry Logic
- Automatic retry on connection failures
- Exponential backoff delays
- Maximum retry limit enforcement
- Connection cleanup on all paths

## Error Handling

The Connection Pool Manager handles various error scenarios:

### Connection Failures
- Automatic retry with exponential backoff
- Maximum 5 retry attempts by default
- Detailed error logging

### Health Check Failures
- Graceful degradation
- Automatic connection replacement
- Error logging without blocking

### Pool Exhaustion
- Warning logs at 80% utilization
- Connection timeout after 30 seconds
- Waiting request tracking

## Performance Considerations

### Connection Reuse
- Efficient connection pooling reduces overhead
- Keep-alive prevents connection drops
- Idle timeout prevents resource waste

### Health Monitoring
- Proactive detection prevents query failures
- Minimal overhead (30-second intervals)
- Non-blocking health checks

### Retry Logic
- Automatic recovery from transient failures
- Exponential backoff prevents thundering herd
- Configurable retry limits

## Integration

The Connection Pool Manager integrates with:

1. **Query Analyzer** - Provides connections for slow query logging
2. **Index Manager** - Supplies connections for index operations
3. **Cache Layer** - Provides connections for cache-miss queries
4. **Read Replica Router** - Manages separate pools for primary and replicas
5. **Archive Manager** - Supplies connections for archival operations

## Testing

Comprehensive test suite with 30 test cases covering:
- Pool configuration
- Health monitoring
- Retry logic
- Graceful shutdown
- Pool statistics
- Error handling

Run tests:
```bash
npm test -- __tests__/lib/services/connection-pool-manager.test.ts
```

## Requirements Validation

### Requirement 3.1: Connection Pool Boundaries ✅
- Maintains min=10, max=50 connections
- Configurable limits

### Requirement 3.2: High Utilization Warnings ✅
- Logs warnings when utilization exceeds 80%
- Includes detailed connection metrics

### Requirement 3.3: Connection Health Checks ✅
- Periodic health checks every 30 seconds
- SELECT 1 query validation

### Requirement 3.4: Failed Connection Replacement ✅
- Removes failed connections from pool
- Automatic replacement

### Requirement 3.5: Connection Lifetime Enforcement ✅
- 30-minute maximum lifetime
- Automatic detection and removal

### Requirement 3.6: Exponential Backoff Retry ✅
- Exponential delay calculation
- Maximum 5 retry attempts

## Best Practices

1. **Use Singleton Pattern**: Always use `getConnectionPoolManager()` to get the singleton instance
2. **Release Connections**: Always release connections in a `finally` block
3. **Use Retry Logic**: Use `executeWithRetry()` for resilient query execution
4. **Monitor Health**: Regularly check pool statistics and health status
5. **Graceful Shutdown**: Always call `shutdownConnectionPoolManager()` on application shutdown

## Troubleshooting

### High Utilization Warnings
- Increase max connection limit
- Optimize slow queries
- Check for connection leaks

### Connection Timeouts
- Increase connection timeout
- Check database server health
- Verify network connectivity

### Health Check Failures
- Check database server status
- Verify connection string
- Check network connectivity

### Retry Exhaustion
- Investigate database issues
- Check query syntax
- Verify permissions

## Future Enhancements

- Read replica support (Task 13)
- Connection pooling metrics dashboard
- Advanced retry strategies
- Circuit breaker pattern
- Connection pool auto-scaling
