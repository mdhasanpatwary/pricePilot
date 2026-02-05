---
title: "Redis Free Tier Guide"
description: "Using Redis free tier for development"
category: "system-monitoring"
tags: ["redis", "free-tier", "development"]
audience: "admin"
---

# Redis Free Tier Configuration Guide

## Overview

This guide provides specific recommendations for using Upstash Redis free tier with PricePilot's caching system.

## Free Tier Limits

**Upstash Free Tier**:
- **Memory**: 250 MB maximum
- **Commands**: 10,000 per day
- **Bandwidth**: Limited
- **Databases**: 1 database

## Recommended Configuration for Free Tier

### 1. Memory Limit
```
Max Memory: 250 MB (maximum available)
```

### 2. Eviction Policy
```
Eviction Policy: allkeys-lru
```

### 3. Environment Variables
```bash
REDIS_MEMORY_LIMIT_MB=250
REDIS_MEMORY_ALERT_THRESHOLD=0.8
```

## Performance Expectations

With 250MB memory limit, expect:
- **Cache hit rate**: 60-70% (vs 70-80% with 500MB)
- **Eviction rate**: Medium (more frequent than paid plans)
- **Suitable for**: Development, testing, small deployments (1-3 tenants)

## Optimization Strategies for Free Tier

### 1. Reduce TTL Values

Use shorter TTLs to keep memory usage low:

```typescript
// Instead of:
await cache.set('key', data, 1800); // 30 minutes

// Use:
await cache.set('key', data, 600); // 10 minutes
```

### 2. Cache Only Essential Data

Be selective about what you cache:

```typescript
// Cache expensive operations only
const expensiveData = await cache.getCachedData(
  'expensive-query',
  () => performExpensiveQuery()
);

// Don't cache cheap queries
const cheapData = await performCheapQuery(); // Direct query
```

### 3. Implement Aggressive Invalidation

Clean up old cache entries more frequently:

```typescript
// Schedule cleanup every hour instead of daily
cron.schedule('0 * * * *', async () => {
  await cache.invalidate('*:old:*');
});
```

### 4. Prioritize Cache Usage

Focus caching on:
1. **Product comparisons** (most expensive queries)
2. **Matching results** (computationally intensive)
3. **Dashboard analytics** (frequently accessed)

Avoid caching:
- Simple product lookups
- Single-record queries
- Rarely accessed data

### 5. Monitor Memory Usage Closely

Set up alerts at lower thresholds:

```bash
REDIS_MEMORY_ALERT_THRESHOLD=0.7  # Alert at 70% instead of 80%
```

## When to Upgrade to Paid Plan

Consider upgrading when:
- Memory usage consistently exceeds 200MB (80% of limit)
- Eviction rate is high (>1000 evictions per hour)
- Cache hit rate drops below 60%
- Supporting more than 3 active tenants
- Daily command count approaches 10,000

## Free Tier vs Paid Plan Comparison

| Feature | Free Tier | Paid Plan (Pro) |
|---------|-----------|-----------------|
| Memory | 250 MB | 500 MB - 10 GB |
| Commands/day | 10,000 | Unlimited |
| Databases | 1 | Multiple |
| Expected Hit Rate | 60-70% | 70-80%+ |
| Suitable For | Dev/Testing | Production |
| Cost | $0 | Starting at $10/month |

## Migration Path

### From Free to Paid

1. **Upgrade Plan in Upstash Dashboard**
   - Go to your database settings
   - Click "Upgrade Plan"
   - Select appropriate tier

2. **Update Memory Configuration**
   - Set Max Memory to 500MB or higher
   - Keep Eviction Policy as allkeys-lru

3. **Update Environment Variables**
   ```bash
   REDIS_MEMORY_LIMIT_MB=500  # Update from 250
   ```

4. **Adjust TTL Values**
   - Increase TTLs for better hit rates
   - Reduce invalidation frequency

5. **Monitor Performance**
   - Watch for improved hit rates
   - Verify reduced eviction rates
   - Confirm better response times

## Cost Optimization Tips

### Maximize Free Tier Usage

1. **Use for Development Only**
   - Keep production on paid plan
   - Use free tier for local development and testing

2. **Optimize Cache Keys**
   - Use shorter key names to save memory
   - Implement key compression if needed

3. **Batch Operations**
   - Reduce command count by batching
   - Use pipelining where possible

4. **Monitor Command Usage**
   - Track daily command count
   - Optimize queries to reduce commands

## Example Configuration

### Free Tier Setup

```typescript
// lib/config/cache-config.ts
export const cacheConfig = {
  ttl: {
    products: 300,           // 5 min (reduced from 10)
    comparisons: 300,        // 5 min (same)
    matches: 600,            // 10 min (reduced from 15)
    competitorProducts: 900, // 15 min (reduced from 30)
    priceHistory: 1800,      // 30 min (reduced from 60)
    analytics: 600,          // 10 min (same)
  },
  limits: {
    maxMemory: 250 * 1024 * 1024, // 250MB
    evictionPolicy: 'allkeys-lru',
  },
  warming: {
    enabled: false, // Disable to save memory
    topProductsCount: 20, // Reduced from 100
  },
};
```

## Troubleshooting Free Tier Issues

### High Memory Usage

**Problem**: Memory consistently above 200MB

**Solutions**:
1. Reduce TTL values by 50%
2. Disable cache warming
3. Implement more aggressive invalidation
4. Cache fewer data types
5. Consider upgrading to paid plan

### High Eviction Rate

**Problem**: Frequent evictions affecting hit rate

**Solutions**:
1. Reduce cache key size
2. Cache only essential data
3. Implement tiered caching (hot/cold data)
4. Upgrade to paid plan for more memory

### Command Limit Approaching

**Problem**: Nearing 10,000 commands per day

**Solutions**:
1. Batch cache operations
2. Use pipelining
3. Reduce cache warming frequency
4. Optimize query patterns
5. Upgrade to paid plan for unlimited commands

## Monitoring Free Tier Usage

### Key Metrics to Track

1. **Memory Usage**
   - Target: <200MB (80% of limit)
   - Alert: >210MB (84%)

2. **Daily Commands**
   - Target: <8,000 (80% of limit)
   - Alert: >9,000 (90%)

3. **Eviction Rate**
   - Target: <500 per hour
   - Alert: >1,000 per hour

4. **Cache Hit Rate**
   - Target: >60%
   - Alert: <50%

### Monitoring Script

```bash
# Check free tier usage
npx tsx scripts/verify-redis-memory-config.ts

# Expected output for free tier:
# Memory Limit: 250 MB (Free Tier)
# Current Usage: 180 MB (72%)
# Status: Healthy
```

## Conclusion

The Upstash free tier (250MB) is suitable for:
- Development and testing
- Small deployments (1-3 tenants)
- Low-traffic applications
- Proof of concept projects

For production deployments with multiple tenants or high traffic, upgrading to a paid plan with 500MB+ memory is recommended for optimal performance and reliability.

## Additional Resources

- [Redis Memory Configuration Guide](./REDIS_MEMORY_CONFIGURATION.md)
- [Upstash Dashboard Setup](./UPSTASH_DASHBOARD_SETUP.md)
- [Upstash Pricing](https://upstash.com/pricing)
- [Cache Optimization Strategies](./CACHE_CONFIGURATION.md)

