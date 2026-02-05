---
title: "Distributed Cache Invalidation"
description: "Invalidating caches across distributed systems"
category: "performance"
tags: ["cache", "distributed", "invalidation"]
audience: "admin"
---

# Distributed Cache Invalidation

## Overview

PricePilot implements distributed cache invalidation using Redis pub/sub to ensure cache consistency across multiple application instances. When one instance invalidates cached data, all other instances are automatically notified and invalidate their local caches.

## Architecture

```
┌─────────────────┐         ┌─────────────────┐         ┌─────────────────┐
│   Instance 1    │         │   Instance 2    │         │   Instance 3    │
│                 │         │                 │         │                 │
│  ┌───────────┐  │         │  ┌───────────┐  │         │  ┌───────────┐  │
│  │ Cache     │  │         │  │ Cache     │  │         │  │ Cache     │  │
│  │ Layer     │  │         │  │ Layer     │  │         │  │ Layer     │  │
│  └─────┬─────┘  │         │  └─────┬─────┘  │         │  └─────┬─────┘  │
│        │        │         │        │        │         │        │        │
│  ┌─────▼─────┐  │         │  ┌─────▼─────┐  │         │  ┌─────▼─────┐  │
│  │ PubSub    │  │         │  │ PubSub    │  │         │  │ PubSub    │  │
│  │ Service   │  │         │  │ Service   │  │         │  │ Service   │  │
│  └─────┬─────┘  │         │  └─────┬─────┘  │         │  └─────┬─────┘  │
└────────┼────────┘         └────────┼────────┘         └────────┼────────┘
         │                           │                           │
         │                           │                           │
         └───────────────┬───────────┴───────────────┬───────────┘
                         │                           │
                    ┌────▼───────────────────────────▼────┐
                    │                                     │
                    │      Redis Pub/Sub Channel         │
                    │   "cache:invalidation"             │
                    │                                     │
                    └─────────────────────────────────────┘
```

## How It Works

### 1. Initialization

On application startup, each instance:
- Generates a unique instance ID
- Creates dedicated Redis connections for publishing and subscribing
- Subscribes to the `cache:invalidation` channel
- Registers invalidation handlers

```typescript
import { initializeDistributedCache } from '@/lib/services/cache-initialization';

// In instrumentation.ts or app startup
await initializeDistributedCache();
```

### 2. Cache Invalidation Flow

When cache is invalidated on any instance:

1. **Local Invalidation**: The instance deletes matching cache keys from its local Redis cache
2. **Event Publishing**: The instance publishes an invalidation event to the pub/sub channel
3. **Event Propagation**: Redis broadcasts the event to all subscribed instances
4. **Remote Invalidation**: Other instances receive the event and invalidate their caches
5. **Event Filtering**: Each instance ignores events it published itself

```typescript
// Instance 1 invalidates cache
await cacheLayer.invalidate('tenant_123:products:*');

// Event published to Redis pub/sub
{
  pattern: 'tenant_123:products:*',
  tenantId: 'tenant_123',
  timestamp: '2024-01-15T10:30:00Z',
  instanceId: 'instance-12345-1705315800000'
}

// Instance 2 and 3 receive event and invalidate their caches
```

## Components

### CacheInvalidationPubSub

Main service for distributed cache invalidation.

**Location**: `lib/services/cache-invalidation-pubsub.ts`

**Key Methods**:
- `initialize()`: Subscribe to invalidation channel
- `publishInvalidation(pattern, tenantId)`: Publish invalidation event
- `onInvalidation(callback)`: Register invalidation handler
- `isReady()`: Check if pub/sub is ready
- `cleanup()`: Cleanup resources on shutdown

**Example Usage**:
```typescript
import { cacheInvalidationPubSub } from '@/lib/services/cache-invalidation-pubsub';

// Initialize on startup
await cacheInvalidationPubSub.initialize();

// Register handler
cacheInvalidationPubSub.onInvalidation(async (event) => {
  console.log(`Invalidating ${event.pattern} from ${event.instanceId}`);
});

// Publish invalidation
await cacheInvalidationPubSub.publishInvalidation('tenant_123:products:*', 'tenant_123');
```

### CacheLayer Integration

The `CacheLayer` automatically integrates with pub/sub for distributed invalidation.

**Location**: `lib/services/cache-layer.ts`

**Automatic Behavior**:
- Initializes pub/sub on startup
- Publishes invalidation events when `invalidate()` is called
- Handles remote invalidation events from other instances
- Maintains tenant isolation

**Example**:
```typescript
import { cacheLayer } from '@/lib/services/cache-layer';

// This automatically publishes to other instances
await cacheLayer.invalidate('tenant_123:comparison:*');
```

## Tenant Isolation

Distributed invalidation maintains strict tenant isolation:

- Cache keys include tenant ID prefix: `tenant_123:service:operation:hash`
- Invalidation patterns are tenant-scoped: `tenant_123:*`
- Events include tenant ID for filtering and logging
- Cross-tenant invalidation is prevented

**Example**:
```typescript
// Invalidate only tenant_123 caches
await cacheLayer.invalidate('tenant_123:products:*');

// Tenant_456 caches remain untouched
const tenant456Data = await cacheLayer.get('tenant_456:products:list:abc123');
// Still cached ✓
```

## Error Handling

The system is designed to fail gracefully:

### Pub/Sub Connection Failures
- Application continues without distributed invalidation
- Local cache invalidation still works
- Warnings logged but no errors thrown

### Message Processing Errors
- Failed callbacks don't block other handlers
- Errors logged for monitoring
- Cache operations continue normally

### Redis Unavailability
- Pub/sub initialization fails gracefully
- Application starts without distributed caching
- Cache operations fall back to database

## Monitoring

### Logs

Distributed cache operations are logged at various levels:

```typescript
// Info: Successful operations
[CacheInvalidationPubSub] Subscribed to invalidation channel
[CacheLayer] Invalidated cache entries (pattern: tenant_123:*, count: 15, distributed: true)

// Debug: Event details
[CacheInvalidationPubSub] Published invalidation (pattern: tenant_123:products:*, subscriberCount: 3)
[CacheLayer] Handled remote invalidation (pattern: tenant_123:products:*, keysInvalidated: 8)

// Error: Failures
[CacheInvalidationPubSub] Failed to publish invalidation
[CacheLayer] Error handling remote invalidation
```

### Metrics

Track these metrics for monitoring:

- **Invalidation Events Published**: Count of events published by this instance
- **Invalidation Events Received**: Count of events received from other instances
- **Keys Invalidated Locally**: Count of keys invalidated by local operations
- **Keys Invalidated Remotely**: Count of keys invalidated by remote events
- **Pub/Sub Connection Status**: Connected/Disconnected
- **Event Processing Latency**: Time to process invalidation events

## Testing

### Unit Tests

Test individual components:

```typescript
describe('CacheInvalidationPubSub', () => {
  it('should publish invalidation events', async () => {
    await pubsub.publishInvalidation('test:*');
    // Verify event published
  });

  it('should handle remote invalidation events', async () => {
    let received = false;
    pubsub.onInvalidation(async () => { received = true; });
    // Trigger event
    expect(received).toBe(true);
  });
});
```

### Integration Tests

Test distributed behavior:

```bash
# Run distributed cache test
npm run test:distributed-cache

# Or with ts-node
npx ts-node scripts/test-distributed-cache.ts
```

### Load Tests

Test under concurrent load:

```typescript
// Simulate multiple instances invalidating simultaneously
const instances = Array.from({ length: 10 }, () => new CacheInvalidationPubSub());
await Promise.all(instances.map(i => i.initialize()));

// Concurrent invalidations
await Promise.all(
  instances.map(i => i.publishInvalidation('tenant_123:products:*'))
);
```

## Performance Considerations

### Pub/Sub Overhead

- **Latency**: ~5-50ms for event propagation
- **Throughput**: Redis pub/sub handles 100k+ messages/sec
- **Memory**: Minimal overhead per subscription

### Optimization Tips

1. **Batch Invalidations**: Invalidate multiple patterns in one operation
2. **Specific Patterns**: Use specific patterns instead of wildcards when possible
3. **TTL Strategy**: Use appropriate TTLs to reduce invalidation frequency
4. **Connection Pooling**: Reuse Redis connections across operations

### Scaling

The system scales horizontally:

- Add more instances without configuration changes
- Each instance automatically joins the pub/sub network
- No coordination or leader election required
- Linear scaling with number of instances

## Troubleshooting

### Invalidation Not Propagating

**Symptoms**: Cache not invalidated on other instances

**Checks**:
1. Verify Redis pub/sub is working: `redis-cli PUBSUB CHANNELS`
2. Check instance logs for subscription confirmation
3. Verify network connectivity between instances and Redis
4. Check for firewall rules blocking Redis connections

**Solution**:
```bash
# Test pub/sub manually
redis-cli
> SUBSCRIBE cache:invalidation
# In another terminal
redis-cli
> PUBLISH cache:invalidation "test:*"
```

### High Latency

**Symptoms**: Slow cache invalidation propagation

**Checks**:
1. Check Redis server latency: `redis-cli --latency`
2. Monitor network latency between instances and Redis
3. Check Redis memory usage and eviction policy
4. Review invalidation pattern complexity

**Solution**:
- Use more specific invalidation patterns
- Increase Redis memory if evicting frequently
- Consider Redis cluster for better performance

### Memory Leaks

**Symptoms**: Increasing memory usage over time

**Checks**:
1. Monitor Redis memory: `redis-cli INFO memory`
2. Check for unclosed connections: `redis-cli CLIENT LIST`
3. Review callback registrations for leaks

**Solution**:
```typescript
// Ensure cleanup on shutdown
process.on('SIGTERM', async () => {
  await cleanupDistributedCache();
  process.exit(0);
});
```

## Best Practices

### 1. Initialize Early

Initialize distributed cache as early as possible in application startup:

```typescript
// instrumentation.ts
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await initializeDistributedCache();
  }
}
```

### 2. Use Specific Patterns

Prefer specific invalidation patterns over broad wildcards:

```typescript
// Good: Specific pattern
await cacheLayer.invalidate('tenant_123:products:get:abc123');

// Less efficient: Broad wildcard
await cacheLayer.invalidate('tenant_123:*');
```

### 3. Handle Errors Gracefully

Don't let cache failures break application logic:

```typescript
try {
  await cacheLayer.invalidate(pattern);
} catch (error) {
  logger.error('Cache invalidation failed', { error });
  // Continue operation - stale cache is better than broken app
}
```

### 4. Monitor Performance

Track invalidation metrics to identify issues:

```typescript
const startTime = Date.now();
await cacheLayer.invalidate(pattern);
const duration = Date.now() - startTime;

if (duration > 100) {
  logger.warn('Slow cache invalidation', { pattern, duration });
}
```

### 5. Test Distributed Behavior

Always test with multiple instances:

```bash
# Start multiple instances locally
PORT=3000 npm run dev &
PORT=3001 npm run dev &
PORT=3002 npm run dev &

# Test invalidation propagation
curl -X POST http://localhost:3000/api/v1/cache/invalidate
# Verify cache cleared on all instances
```

## Configuration

### Environment Variables

```bash
# Redis connection (required for distributed caching)
REDIS_URL=redis://localhost:6379

# Or Upstash Redis
UPSTASH_REDIS_REST_URL=https://your-redis.upstash.io
UPSTASH_REDIS_REST_TOKEN=your-token

# Optional: Pub/sub channel name (default: cache:invalidation)
CACHE_INVALIDATION_CHANNEL=cache:invalidation
```

### Deployment

For production deployments:

1. **Use Redis Cluster**: For high availability and scalability
2. **Enable Persistence**: Configure Redis AOF or RDB for durability
3. **Monitor Connections**: Track pub/sub connections and subscriptions
4. **Set Timeouts**: Configure connection and operation timeouts
5. **Enable TLS**: Use encrypted connections in production

## References

- [Redis Pub/Sub Documentation](https://redis.io/docs/manual/pubsub/)
- [ioredis Pub/Sub Guide](https://github.com/luin/ioredis#pubsub)
- [Distributed Caching Best Practices](https://redis.io/docs/manual/patterns/distributed-locks/)
