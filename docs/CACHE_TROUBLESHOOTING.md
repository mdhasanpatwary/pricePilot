# Cache Troubleshooting Guide

## Overview

This guide provides solutions to common caching issues in PricePilot. Follow the diagnostic steps and solutions to resolve cache-related problems quickly.

## Quick Diagnostics

### Health Check Checklist

Run these checks first to identify the issue:

```bash
# 1. Check Redis connectivity
npx tsx scripts/verify-redis-simple.ts

# 2. Check cache statistics
curl http://localhost:3000/api/v1/admin/performance/cache-stats

# 3. Check memory configuration
npx tsx scripts/verify-redis-memory-config.ts

# 4. Check distributed invalidation
npx tsx scripts/test-distributed-cache.ts

# 5. Check application logs
grep "Cache" logs/app.log | tail -100
```

## Common Issues

### Issue 1: Cache Not Working

**Symptoms**:
- All requests hitting database
- Cache hit rate 0%
- No cached data found

**Diagnostic Steps**:

1. **Check Redis connection**:
```bash
redis-cli PING
# Expected: PONG
```

2. **Check environment variables**:
```bash
echo $UPSTASH_REDIS_REST_URL
echo $UPSTASH_REDIS_REST_TOKEN
```

3. **Check cache service initialization**:
```typescript
import { cacheLayer } from '@/lib/services/cache-layer';

const isReady = await cacheLayer.ping();
console.log('Cache ready:', isReady);
```

**Solutions**:

**A. Redis Not Connected**:
```bash
# Verify credentials in .env
UPSTASH_REDIS_REST_URL="https://your-instance.upstash.io"
UPSTASH_REDIS_REST_TOKEN="your-token"

# Restart application
npm run dev
```

**B. Cache Service Not Initialized**:
```typescript
// Ensure initialization in instrumentation.ts
import { initializeDistributedCache } from '@/lib/services/cache-initialization';

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await initializeDistributedCache();
  }
}
```

**C. Network/Firewall Issues**:
```bash
# Test connectivity
curl https://your-instance.upstash.io

# Check firewall rules
# Ensure outbound HTTPS (443) is allowed
```

### Issue 2: Low Cache Hit Rate

**Symptoms**:
- Hit rate <60%
- Frequent database queries
- Slow response times

**Diagnostic Steps**:

1. **Check current hit rate**:
```typescript
const health = await cacheMonitoringService.getHealthStatus();
console.log(`Hit rate: ${(health.performance.hitRate * 100).toFixed(1)}%`);
```

2. **Check TTL values**:
```bash
# Check TTL of cached keys
redis-cli TTL "tenant:123:products:get:456"
```

3. **Check cache warming**:
```bash
# Verify warming is running
grep "Cache warming" logs/app.log
```

**Solutions**:

**A. TTLs Too Short**:
```typescript
// Increase TTL values
await cache.set(key, data, 600); // 10 minutes instead of 5
```

**B. No Cache Warming**:
```typescript
// Implement cache warming on login
app.post('/api/auth/login', async (req, res) => {
  const user = await authenticate(req.body);
  
  // Warm cache
  cacheWarmingService.warmOnLogin(user.tenantId).catch(err => 
    logger.error('Warming failed', { err })
  );
  
  res.json({ user });
});
```

**C. Over-Invalidation**:
```typescript
// Use specific patterns instead of wildcards
// Bad
await cache.invalidate('tenant:123:*');

// Good
await cache.invalidate('tenant:123:products:get:456');
```

**D. Access Patterns Not Cacheable**:
```typescript
// Identify uncacheable patterns
const patterns = await analyzeAccessPatterns(tenantId);
console.log('Uncacheable patterns:', patterns.filter(p => p.hitRate < 0.5));
```

### Issue 3: High Memory Usage

**Symptoms**:
- Memory usage >80%
- Frequent evictions
- Cache performance degrading

**Diagnostic Steps**:

1. **Check memory usage**:
```bash
redis-cli INFO memory | grep used_memory_human
```

2. **Check eviction count**:
```bash
redis-cli INFO stats | grep evicted_keys
```

3. **Check key count**:
```bash
redis-cli DBSIZE
```

**Solutions**:

**A. Increase Memory Limit**:
```bash
# In Upstash dashboard:
# 1. Go to database settings
# 2. Increase max memory to 750MB or 1GB
# 3. Update .env
REDIS_MEMORY_LIMIT_MB=750
```

**B. Reduce TTLs**:
```typescript
// Reduce TTL for less critical data
await cache.set(key, data, 300); // 5 minutes instead of 1 hour
```

**C. Clean Up Stale Keys**:
```typescript
// Implement periodic cleanup
async function cleanupStaleKeys(tenantId: string) {
  // Remove old comparison caches
  await cache.invalidate(`${tenantId}:comparison:*`);
  
  // Remove old analytics
  await cache.invalidate(`${tenantId}:analytics:old:*`);
}
```

**D. Optimize Cache Keys**:
```typescript
// Use smaller cache values
// Bad: Cache entire object
await cache.set(key, largeObject);

// Good: Cache only needed fields
await cache.set(key, { id: obj.id, name: obj.name, price: obj.price });
```

### Issue 4: Slow Cache Operations

**Symptoms**:
- Cache operations >100ms
- Timeouts on cache requests
- Degraded performance

**Diagnostic Steps**:

1. **Measure cache latency**:
```typescript
const startTime = Date.now();
await cache.get(key);
const duration = Date.now() - startTime;
console.log(`Cache latency: ${duration}ms`);
```

2. **Check Redis latency**:
```bash
redis-cli --latency
```

3. **Check network latency**:
```bash
ping your-instance.upstash.io
```

**Solutions**:

**A. Network Latency**:
```bash
# Use Upstash region closer to your servers
# In Upstash dashboard, create new database in closer region
```

**B. Large Cache Values**:
```typescript
// Compress large values
import { gzip, gunzip } from 'zlib';
import { promisify } from 'util';

const gzipAsync = promisify(gzip);
const gunzipAsync = promisify(gunzip);

// Compress before caching
const compressed = await gzipAsync(JSON.stringify(largeObject));
await cache.set(key, compressed.toString('base64'));

// Decompress when retrieving
const cached = await cache.get(key);
const decompressed = await gunzipAsync(Buffer.from(cached, 'base64'));
const data = JSON.parse(decompressed.toString());
```

**C. Redis Performance**:
```bash
# Check Redis performance in Upstash dashboard
# Consider upgrading plan for better performance
```

**D. Batch Operations**:
```typescript
// Use batch operations instead of sequential
// Bad
for (const key of keys) {
  await cache.get(key);
}

// Good
await Promise.all(keys.map(k => cache.get(k)));
```

### Issue 5: Cache Invalidation Not Working

**Symptoms**:
- Stale data served after updates
- Invalidation not propagating
- Data inconsistency

**Diagnostic Steps**:

1. **Check invalidation is called**:
```bash
grep "Invalidat" logs/app.log
```

2. **Check distributed invalidation**:
```bash
# Test pub/sub
redis-cli PUBSUB CHANNELS
```

3. **Verify pattern matching**:
```bash
# Check if pattern matches keys
redis-cli KEYS "tenant:123:products:*"
```

**Solutions**:

**A. Invalidation Not Called**:
```typescript
// Ensure invalidation is triggered
async function updatePrice(productId: string, newPrice: number) {
  await db.product.update({ where: { id: productId }, data: { price: newPrice } });
  
  // Add invalidation
  await cacheInvalidationService.onPriceUpdate(tenantId, [productId]);
}
```

**B. Wrong Pattern**:
```typescript
// Verify pattern matches cache keys
// Cache key: tenant:123:products:get:456
// Pattern should be: tenant:123:products:*

await cache.invalidate('tenant:123:products:*'); // Correct
await cache.invalidate('tenant:123:product:*');  // Wrong (missing 's')
```

**C. Distributed Invalidation Not Working**:
```typescript
// Check pub/sub initialization
import { cacheInvalidationPubSub } from '@/lib/services/cache-invalidation-pubsub';

const isReady = cacheInvalidationPubSub.isReady();
console.log('Pub/sub ready:', isReady);

// Reinitialize if needed
await cacheInvalidationPubSub.initialize();
```

**D. Race Condition**:
```typescript
// Ensure invalidation completes before returning
async function updatePrice(productId: string, newPrice: number) {
  await db.product.update({ where: { id: productId }, data: { price: newPrice } });
  
  // Wait for invalidation
  await cacheInvalidationService.onPriceUpdate(tenantId, [productId]);
  
  // Small delay for distributed propagation
  await new Promise(resolve => setTimeout(resolve, 100));
}
```

### Issue 6: Distributed Caching Issues

**Symptoms**:
- Invalidation not propagating to all instances
- Inconsistent cache across instances
- Stale data on some instances

**Diagnostic Steps**:

1. **Check pub/sub status**:
```bash
redis-cli PUBSUB CHANNELS
redis-cli PUBSUB NUMSUB cache:invalidation
```

2. **Check instance logs**:
```bash
# On each instance
grep "CacheInvalidationPubSub" logs/app.log
```

3. **Test distributed invalidation**:
```bash
npx tsx scripts/test-distributed-cache.ts
```

**Solutions**:

**A. Pub/Sub Not Initialized**:
```typescript
// Ensure initialization on all instances
// In instrumentation.ts
import { initializeDistributedCache } from '@/lib/services/cache-initialization';

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await initializeDistributedCache();
  }
}
```

**B. Network Issues**:
```bash
# Check connectivity from all instances
# On each instance:
redis-cli PING
```

**C. Different Redis Instances**:
```bash
# Ensure all instances use same Redis
# Check REDIS_URL on all instances
echo $UPSTASH_REDIS_REST_URL
```

**D. Subscription Failures**:
```typescript
// Add retry logic for subscription
async function initializeWithRetry(maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      await cacheInvalidationPubSub.initialize();
      return;
    } catch (error) {
      logger.error(`Pub/sub init failed (attempt ${i + 1})`, { error });
      await sleep(1000 * (i + 1));
    }
  }
  throw new Error('Failed to initialize pub/sub after retries');
}
```

### Issue 7: Memory Leaks

**Symptoms**:
- Memory usage continuously growing
- No evictions despite high usage
- Application slowdown over time

**Diagnostic Steps**:

1. **Monitor memory trend**:
```bash
# Check memory over time
watch -n 60 'redis-cli INFO memory | grep used_memory_human'
```

2. **Check for key leaks**:
```bash
# Check key count trend
watch -n 60 'redis-cli DBSIZE'
```

3. **Identify growing patterns**:
```bash
# Sample keys
redis-cli --scan --pattern "*" | head -100
```

**Solutions**:

**A. Missing TTLs**:
```typescript
// Always set TTL
// Bad
await cache.set(key, data); // No TTL = never expires

// Good
await cache.set(key, data, 300); // 5 minute TTL
```

**B. Callback Leaks**:
```typescript
// Ensure callbacks are cleaned up
class CacheService {
  private callbacks: Set<Function> = new Set();
  
  onInvalidation(callback: Function) {
    this.callbacks.add(callback);
    
    // Return cleanup function
    return () => {
      this.callbacks.delete(callback);
    };
  }
  
  cleanup() {
    this.callbacks.clear();
  }
}
```

**C. Unclosed Connections**:
```typescript
// Ensure connections are closed
process.on('SIGTERM', async () => {
  await cleanupDistributedCache();
  process.exit(0);
});
```

**D. Large Objects**:
```typescript
// Avoid caching very large objects
const MAX_CACHE_SIZE = 1024 * 1024; // 1MB

async function cacheWithSizeCheck(key: string, data: any, ttl: number) {
  const size = JSON.stringify(data).length;
  
  if (size > MAX_CACHE_SIZE) {
    logger.warn('Object too large to cache', { key, size });
    return;
  }
  
  await cache.set(key, data, ttl);
}
```

## Error Messages

### "Redis connection failed"

**Cause**: Cannot connect to Redis

**Solution**:
1. Check environment variables
2. Verify Upstash credentials
3. Check network connectivity
4. Verify firewall rules

### "Cache operation timeout"

**Cause**: Redis operation took too long

**Solution**:
1. Check network latency
2. Check Redis performance
3. Reduce cache value size
4. Increase timeout setting

### "Memory limit exceeded"

**Cause**: Redis memory full

**Solution**:
1. Increase memory limit
2. Reduce TTLs
3. Clean up stale keys
4. Implement better eviction

### "Pattern invalidation failed"

**Cause**: Cannot invalidate by pattern

**Solution**:
1. Check pattern syntax
2. Verify keys exist
3. Check Redis connectivity
4. Review error logs

## Performance Optimization

### Optimize Cache Keys

```typescript
// Use efficient key structure
// Bad: Long, redundant keys
const key = `tenant_${tenantId}_products_get_product_${productId}_with_details`;

// Good: Short, structured keys
const key = `${tenantId}:p:g:${productId}`;
```

### Batch Operations

```typescript
// Batch cache operations
async function cacheMultipleProducts(products: Product[]) {
  await Promise.all(
    products.map(p => 
      cache.set(`${tenantId}:p:${p.id}`, p, 300)
    )
  );
}
```

### Lazy Loading

```typescript
// Load cache lazily
async function getProduct(id: string) {
  let product = await cache.get(`${tenantId}:p:${id}`);
  
  if (!product) {
    product = await db.product.findUnique({ where: { id } });
    cache.set(`${tenantId}:p:${id}`, product, 300).catch(err => 
      logger.error('Cache set failed', { err })
    );
  }
  
  return product;
}
```

## Monitoring and Alerts

### Set Up Monitoring

```typescript
// Monitor cache health
setInterval(async () => {
  const health = await cacheMonitoringService.getHealthStatus();
  
  if (health.status !== 'healthy') {
    await alerting.send({
      level: 'error',
      message: 'Cache unhealthy',
      details: health
    });
  }
}, 60000); // Every minute
```

### Log Cache Operations

```typescript
// Log important cache operations
async function cacheWithLogging(key: string, data: any, ttl: number) {
  const startTime = Date.now();
  
  try {
    await cache.set(key, data, ttl);
    const duration = Date.now() - startTime;
    
    logger.info('Cache set', { key, ttl, duration });
  } catch (error) {
    logger.error('Cache set failed', { key, error });
    throw error;
  }
}
```

## Testing

### Test Cache Operations

```typescript
describe('Cache Operations', () => {
  it('should cache and retrieve data', async () => {
    await cache.set('test-key', { data: 'value' }, 300);
    const cached = await cache.get('test-key');
    expect(cached).toEqual({ data: 'value' });
  });
  
  it('should handle cache failures gracefully', async () => {
    // Mock Redis failure
    jest.spyOn(cache, 'get').mockRejectedValue(new Error('Redis error'));
    
    // Should not throw
    const result = await getCachedData('key', () => Promise.resolve('fallback'));
    expect(result).toBe('fallback');
  });
});
```

## Getting Help

### Collect Diagnostic Information

```bash
# Run all diagnostics
./scripts/cache-diagnostics.sh > cache-diagnostics.txt

# Include in support request:
# 1. cache-diagnostics.txt
# 2. Recent logs (last 1000 lines)
# 3. Environment variables (redacted)
# 4. Steps to reproduce
```

### Support Channels

- **Upstash Issues**: support@upstash.com
- **Application Issues**: Check logs and this guide
- **Performance Issues**: Review monitoring dashboard
- **Configuration Issues**: Review configuration guides

## Related Documentation

- [Cache Configuration Guide](./CACHE_CONFIGURATION.md)
- [Cache Monitoring Guide](./CACHE_MONITORING.md)
- [Redis Configuration](./REDIS_CONFIGURATION.md)
- [Redis Memory Configuration](./REDIS_MEMORY_CONFIGURATION.md)
- [Distributed Cache Invalidation](./DISTRIBUTED_CACHE_INVALIDATION.md)
- [Cache Invalidation Patterns](./CACHE_INVALIDATION_PATTERNS.md)
- [Cache Warming Strategies](./CACHE_WARMING_STRATEGIES.md)
