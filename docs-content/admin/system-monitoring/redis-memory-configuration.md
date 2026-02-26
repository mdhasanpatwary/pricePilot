---
title: "Redis Memory Configuration"
description: "Optimizing Redis memory configuration"
category: "system-monitoring"
author: "PricePilot Team"
lastReviewed: "2024-05-20"
tags: ["redis", "memory", "optimization"]
audience: "admin"
---

# Redis Memory Configuration Guide

## Overview

This guide explains how to configure Redis memory limits and eviction policies for PricePilot's caching system. Proper memory configuration ensures optimal cache performance while preventing out-of-memory errors.

## Requirements

- **Memory Limit**: 250MB (Upstash free tier) or 500MB+ (paid plans)
- **Eviction Policy**: allkeys-lru (Least Recently Used)
- **Monitoring Threshold**: Alert when usage exceeds 80%

**Note**: The Upstash free tier currently allows up to 250MB per database. For production deployments with higher traffic, consider upgrading to a paid plan for 500MB or more.

## Configuration Steps

### Step 1: Configure in Upstash Dashboard

Since PricePilot uses Upstash Redis (managed service), memory configuration is done through the Upstash dashboard:

1. **Log in to Upstash Console**
   - Go to: https://console.upstash.com/
   - Select your Redis database

2. **Navigate to Configuration**
   - Click on the "Configuration" or "Settings" tab
   - Look for "Memory" or "Advanced Settings" section

3. **Set Memory Limit**
   ```
   Free Tier: 250 MB (maximum for free tier)
   Paid Plans: 500 MB or higher
   ```
   
   **Memory Limit Recommendations**:
   - **Free Tier (250MB)**: Suitable for development, testing, and small deployments
   - **Paid Plans (500MB+)**: Recommended for production with multiple tenants
   
   **Why these limits?**
   - 250MB is sufficient for caching essential data during development
   - 500MB+ prevents unbounded memory growth in production
   - Can be increased based on monitoring and actual usage patterns

4. **Set Eviction Policy**
   ```
   Eviction Policy: allkeys-lru
   ```
   
   **Why allkeys-lru?**
   - Automatically removes least recently used keys when memory is full
   - Works for all keys, not just those with TTL
   - Ensures cache always has space for new data
   - Best for general-purpose caching with mixed TTL strategies

### Step 2: Configure Environment Variables

Add the memory limit to your `.env` file for monitoring purposes:

```bash
# Redis Memory Configuration
# Set this to match your Upstash plan:
# - Free tier: 250
# - Paid plans: 500 or higher
REDIS_MEMORY_LIMIT_MB=250
REDIS_MEMORY_ALERT_THRESHOLD=0.8  # Alert at 80% usage
```

This allows the monitoring service to track memory usage against your configured limit.

### Step 3: Verify Configuration

Run the verification script to ensure memory limits are properly configured:

```bash
npx tsx scripts/verify-redis-memory-config.ts
```

Expected output:
```
✅ Redis Memory Configuration Verified

Configuration:
  • Memory Limit: 250 MB (Free Tier)
  • Eviction Policy: allkeys-lru
  • Current Usage: 45 MB (18%)
  • Status: Healthy

Recommendations:
  ✓ Memory limit is properly configured
  ✓ Eviction policy is set correctly
  ✓ Current usage is within safe limits
```

## Eviction Policy Options

### allkeys-lru (Recommended)
- **Description**: Evicts least recently used keys from all keys
- **Use Case**: General-purpose caching with mixed TTL strategies
- **Pros**: Works for all keys, automatic cleanup, predictable behavior
- **Cons**: May evict important keys if not accessed recently

### volatile-lru
- **Description**: Evicts least recently used keys with TTL set
- **Use Case**: When you want to preserve keys without TTL
- **Pros**: Protects permanent keys
- **Cons**: May fail if no keys have TTL

### allkeys-lfu
- **Description**: Evicts least frequently used keys from all keys
- **Use Case**: When access frequency matters more than recency
- **Pros**: Better for workloads with hot/cold data
- **Cons**: More complex, may not suit all patterns

### noeviction
- **Description**: Returns errors when memory limit is reached
- **Use Case**: When you want explicit control over eviction
- **Pros**: No data loss without explicit action
- **Cons**: Requires manual intervention, can cause errors

**For PricePilot, we use `allkeys-lru` because:**
- Product prices and comparisons have varying access patterns
- Some data has TTL, some doesn't
- We want automatic cleanup without manual intervention
- Recent data is generally more valuable than old data

## Memory Usage Monitoring

### Automatic Monitoring

The CacheMonitoringService automatically tracks memory usage:

```typescript
import { cacheMonitoringService } from '@/lib/services/cache-monitoring';

// Get current health status
const health = await cacheMonitoringService.getHealthStatus();

console.log({
  memoryUsage: health.redis?.memoryUsage,
  memoryLimit: health.redis?.memoryLimit,
  usagePercent: health.redis?.memoryUsagePercent,
  alerts: health.alerts
});
```

### Alert Thresholds

The system generates alerts at different memory usage levels:

| Usage Level | Alert Level | Action |
|-------------|-------------|--------|
| < 80% | None | Normal operation |
| 80-95% | Warning | Monitor closely, consider optimization |
| > 95% | Error | Immediate action required |

### Alert Examples

**Warning Alert (80% usage):**
```json
{
  "level": "warning",
  "message": "Cache memory usage high: 400MB (80%)",
  "metric": "memoryUsage",
  "value": 419430400,
  "threshold": 419430400
}
```

**Error Alert (95% usage):**
```json
{
  "level": "error",
  "message": "Cache memory usage critical: 475MB (95%)",
  "metric": "memoryUsage",
  "value": 498073600,
  "threshold": 419430400
}
```

## Memory Optimization Strategies

### 1. Review TTL Values

If memory usage is consistently high, review and reduce TTL values:

```typescript
// Before: Long TTL
await cache.set('key', data, 3600); // 1 hour

// After: Shorter TTL
await cache.set('key', data, 900); // 15 minutes
```

### 2. Implement Selective Caching

Don't cache everything - focus on expensive operations:

```typescript
// Cache expensive queries
const expensiveData = await cache.getCachedData(
  'expensive-query',
  () => performExpensiveQuery()
);

// Don't cache cheap queries
const cheapData = await performCheapQuery(); // Direct query
```

### 3. Use Compression for Large Objects

For large cached objects, consider compression:

```typescript
import { gzip, gunzip } from 'zlib';
import { promisify } from 'util';

const gzipAsync = promisify(gzip);
const gunzipAsync = promisify(gunzip);

// Compress before caching
const compressed = await gzipAsync(JSON.stringify(largeObject));
await cache.set('key', compressed.toString('base64'));

// Decompress when retrieving
const cached = await cache.get('key');
const decompressed = await gunzipAsync(Buffer.from(cached, 'base64'));
const data = JSON.parse(decompressed.toString());
```

### 4. Pattern-Based Cleanup

Regularly clean up old or unused cache patterns:

```typescript
// Clean up old comparison caches
await cache.invalidate('*:comparison:*');

// Clean up specific tenant's old data
await cache.invalidate(`tenant:${tenantId}:old:*`);
```

### 5. Monitor Evictions

High eviction rates indicate memory pressure:

```typescript
const stats = await cache.getCacheStats();

if (stats.evictions > 1000) {
  console.warn('High eviction rate detected:', stats.evictions);
  // Consider increasing memory limit or reducing TTLs
}
```

## Troubleshooting

### Problem: Memory Usage Consistently Above 80%

**Symptoms:**
- Frequent warning alerts
- High eviction rate
- Cache hit rate declining

**Solutions:**
1. **Increase Memory Limit**
   - Go to Upstash dashboard
   - Increase max memory to 750MB or 1GB
   - Update `REDIS_MEMORY_LIMIT_MB` in `.env`

2. **Reduce TTL Values**
   - Review current TTL settings
   - Reduce TTLs for less critical data
   - Implement tiered TTL strategy

3. **Optimize Cache Keys**
   - Remove redundant cache keys
   - Implement more aggressive invalidation
   - Use pattern-based cleanup

### Problem: Frequent Evictions

**Symptoms:**
- High eviction count in stats
- Cache hit rate lower than expected
- Important data being evicted

**Solutions:**
1. **Increase Memory Limit**
   - More memory = fewer evictions
   - Monitor after increase

2. **Review Eviction Policy**
   - Consider switching to `allkeys-lfu` if frequency matters
   - Ensure policy matches access patterns

3. **Implement Cache Warming**
   - Pre-load important data
   - Reduce cold cache scenarios

### Problem: Out of Memory Errors

**Symptoms:**
- Redis returns OOM errors
- Cache operations failing
- Application errors

**Solutions:**
1. **Immediate Action**
   - Flush non-critical caches
   - Increase memory limit in Upstash
   - Restart Redis if necessary

2. **Long-term Fix**
   - Review memory configuration
   - Implement better eviction strategy
   - Add memory monitoring alerts

### Problem: Memory Usage Too Low

**Symptoms:**
- Memory usage consistently < 20%
- Cache hit rate lower than expected
- Underutilized cache

**Solutions:**
1. **Increase TTL Values**
   - Cache data longer
   - Reduce database load

2. **Implement Cache Warming**
   - Pre-load frequently accessed data
   - Warm cache on application startup

3. **Cache More Data**
   - Identify additional cacheable operations
   - Expand caching strategy

## Performance Impact

### Memory Limit Effects

| Memory Limit | Expected Hit Rate | Eviction Rate | Recommendation |
|--------------|-------------------|---------------|----------------|
| 250MB (Free) | 60-70% | Medium | Good for development/testing |
| 500MB | 70-80% | Low | Optimal for production |
| 1GB | 80-90% | Very Low | Good for high traffic |
| 2GB+ | 90%+ | Minimal | Enterprise scale |

**Note**: Free tier (250MB) is suitable for development and small deployments. For production with multiple tenants, consider upgrading to a paid plan with 500MB or more.

### Eviction Policy Effects

| Policy | Hit Rate Impact | Memory Efficiency | Complexity |
|--------|----------------|-------------------|------------|
| allkeys-lru | Good | High | Low |
| volatile-lru | Medium | Medium | Medium |
| allkeys-lfu | Better | High | High |
| noeviction | N/A | Low | High |

## Best Practices

### 1. Set Appropriate Memory Limit
- Free tier: Use 250MB (maximum available)
- Paid plans: Start with 500MB
- Monitor usage for 1-2 weeks
- Adjust based on actual usage patterns
- Consider upgrading plan if consistently hitting limits

### 2. Use allkeys-lru Policy
- Best for general-purpose caching
- Automatic cleanup
- Predictable behavior

### 3. Monitor Memory Usage
- Set up alerts at 80% threshold
- Review memory trends weekly
- Adjust limits proactively

### 4. Implement Tiered TTL Strategy
- Hot data: Short TTL (5-15 minutes)
- Warm data: Medium TTL (30-60 minutes)
- Cold data: Long TTL (1-24 hours)

### 5. Regular Cleanup
- Schedule pattern-based cleanup
- Remove stale cache keys
- Monitor eviction rates

### 6. Test Memory Limits
- Load test with production-like data
- Verify eviction behavior
- Ensure no OOM errors

## Monitoring Dashboard

### Key Metrics to Track

1. **Memory Usage**
   - Current usage in MB
   - Usage percentage
   - Trend over time

2. **Eviction Rate**
   - Evictions per hour
   - Eviction trend
   - Impact on hit rate

3. **Cache Hit Rate**
   - Overall hit rate
   - Hit rate by service
   - Correlation with memory usage

4. **Alert History**
   - Memory alerts triggered
   - Alert frequency
   - Resolution time

### Example Monitoring Query

```typescript
// Get comprehensive memory status
const health = await cacheMonitoringService.getHealthStatus();

const memoryStatus = {
  current: health.redis?.memoryUsage,
  limit: health.redis?.memoryLimit,
  percent: health.redis?.memoryUsagePercent,
  evictions: health.performance?.evictions,
  hitRate: health.performance?.hitRate,
  alerts: health.alerts?.filter(a => a.metric === 'memoryUsage')
};

console.log('Memory Status:', memoryStatus);
```

## Configuration Checklist

Before deploying to production:

- [ ] Memory limit set in Upstash dashboard (250MB free tier or 500MB+ paid)
- [ ] Eviction policy set to allkeys-lru
- [ ] Environment variables configured (`REDIS_MEMORY_LIMIT_MB` matching your plan)
- [ ] Monitoring alerts configured (80% threshold)
- [ ] Verification script run successfully
- [ ] Memory usage monitored for 1 week in staging
- [ ] Eviction rates reviewed and acceptable
- [ ] Cache hit rate meets target (>60% for free tier, >70% for paid)
- [ ] Documentation reviewed and updated
- [ ] Team trained on memory monitoring
- [ ] Plan upgrade path identified if needed

## Additional Resources

- [Upstash Redis Documentation](https://docs.upstash.com/redis)
- [Redis Eviction Policies](https://redis.io/docs/manual/eviction/)
- [Redis Memory Optimization](https://redis.io/docs/manual/optimization/memory-optimization/)
- [PricePilot Cache Configuration](./REDIS_CONFIGURATION.md)
- [PricePilot Cache Monitoring](./CACHE_MONITORING.md)

## Support

For issues related to memory configuration:
- **Upstash Issues**: Contact Upstash support
- **Configuration Help**: Review this guide
- **Monitoring Issues**: Check CacheMonitoringService logs
- **Performance Issues**: Review memory optimization strategies

