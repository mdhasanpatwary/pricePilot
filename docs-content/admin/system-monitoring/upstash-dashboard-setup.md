---
title: "Upstash Dashboard Setup"
description: "Setting up Upstash Redis dashboard"
category: "system-monitoring"
tags: ["upstash", "redis", "setup"]
audience: "admin"
---

# Upstash Dashboard Configuration Guide

## Quick Setup Checklist

Follow these steps in the Upstash dashboard to configure Redis for optimal performance.

## Step 1: Create Database

1. Go to [https://console.upstash.com/](https://console.upstash.com/)
2. Click **"Create Database"**
3. Configure:
   - **Name**: `pricepilot-cache` (or your preferred name)
   - **Region**: Choose closest to your application servers
   - **Type**: Redis
   - **Eviction**: Enable (we'll configure policy next)
4. Click **"Create"**

## Step 2: Configure Memory Settings

1. Select your database from the dashboard
2. Click **"Configuration"** tab
3. Set the following:

### Memory Limit
```
Free Tier: 250 MB (maximum for free tier)
Paid Plans: 500 MB or higher
```

**Memory Limit by Plan**:
- **Free Tier**: 250MB maximum - suitable for development and testing
- **Paid Plans**: 500MB+ - recommended for production deployments

**Why these limits?**
- 250MB (free tier) is sufficient for development and small-scale testing
- 500MB+ (paid) prevents unbounded memory growth in production
- Can be increased based on monitoring and actual usage patterns

### Eviction Policy
```
Eviction Policy: allkeys-lru
```

**Why allkeys-lru?**
- Automatically removes least recently used keys when memory is full
- Works for all key types (not just those with TTL)
- Ensures cache always has space for new data
- Best for general-purpose caching

### Other Settings (Optional)
```
Persistence: Enabled (recommended for production)
TLS: Enabled (default, keep enabled)
```

## Step 3: Get API Credentials

1. In your database dashboard, click **"REST API"** tab
2. Copy the following values:

```
REST URL: https://your-instance.upstash.io
REST TOKEN: AcTIAAIncDE2ZjUyZjU3NGFmMDg0ZjUxYTg0ZWE5OWQxZTI3YTg3Y3AxNTAzNzY
```

3. Add to your `.env` file:

```bash
UPSTASH_REDIS_REST_URL="https://your-instance.upstash.io"
UPSTASH_REDIS_REST_TOKEN="your-token-here"
```

## Step 4: Configure Alerts (Optional but Recommended)

1. Click **"Alerts"** tab
2. Set up the following alerts:

### Memory Usage Alert
```
Condition: Memory usage > 80%
Action: Send email notification
```

### Command Rate Alert
```
Condition: Commands per second > 1000
Action: Send email notification
```

### Error Rate Alert
```
Condition: Error rate > 5%
Action: Send email notification
```

## Step 5: Review Metrics

After configuration, monitor these metrics in the dashboard:

### Key Metrics to Watch

1. **Memory Usage**
   - Target: <80% of max memory
   - Alert if: >80%
   - Action: Review cache TTLs or increase memory

2. **Commands per Second**
   - Target: Varies by usage
   - Alert if: Sudden spikes or drops
   - Action: Investigate application behavior

3. **Hit Rate** (if available)
   - Target: >70%
   - Alert if: <60%
   - Action: Review caching strategy

4. **Latency**
   - Target: <50ms p95
   - Alert if: >100ms p95
   - Action: Check network or consider closer region

## Configuration Summary

Here's what your final configuration should look like:

```yaml
Database Configuration:
  Name: pricepilot-cache
  Region: [Your chosen region]
  Type: Redis
  Plan: Free Tier or Paid
  
Memory Settings:
  Max Memory: 250 MB (Free) or 500 MB+ (Paid)
  Eviction Policy: allkeys-lru
  Persistence: Enabled
  
Security:
  TLS: Enabled
  REST API: Enabled
  
Alerts:
  Memory Usage: >80%
  Command Rate: >1000/s
  Error Rate: >5%
```

## Step 5: Verify Configuration

After configuration, verify everything is working:

```bash
# Run memory configuration verification
npx tsx scripts/verify-redis-memory-config.ts
```

Expected output:
```
✅ Redis Memory Configuration Verified

Configuration:
  • Memory Limit: 500 MB
  • Eviction Policy: allkeys-lru
  • Current Usage: 45 MB (9%)

Checks:
  ✅ Redis Connection: Redis is connected and responsive
  ✅ Memory Limit: Memory limit is properly configured: 500MB
  ✅ Eviction Policy: Eviction policy is correctly set to "allkeys-lru"
  ✅ Memory Usage: Memory usage is healthy: 45MB (9%)
  ✅ Evictions: No evictions detected yet

✅ ALL CHECKS PASSED
```

You can also run the basic connectivity test:

```bash
# Run basic verification script
npx tsx scripts/verify-redis-simple.ts
```

Expected output:
```
✅ ALL CHECKS PASSED

Redis Configuration Summary:
  • Connection: Working
  • Basic Operations: Working
  • Write Performance: ~150ms avg
  • Read Performance: ~150ms avg
```

## Troubleshooting

### Cannot Connect

**Check:**
- REST URL and TOKEN are correct in `.env`
- Database status is "Active" in dashboard
- TLS is enabled
- Your IP is not blocked

### High Memory Usage

**Check:**
- Eviction policy is set to `allkeys-lru`
- TTL values are appropriate
- No cache key leaks
- Memory limit is sufficient

### Slow Performance

**Check:**
- Region is close to your application
- Network latency to Upstash
- Not hitting rate limits
- Database is not overloaded

## Next Steps

After completing this setup:

1. ✅ Verify configuration with verification script
2. ✅ Document credentials in `.env` file
3. ✅ Set up monitoring and alerts
4. ➡️ Proceed to Task 2: Create enhanced cache service

## Support

- **Upstash Documentation**: [https://docs.upstash.com/redis](https://docs.upstash.com/redis)
- **Upstash Support**: [https://upstash.com/support](https://upstash.com/support)
- **PricePilot Redis Guide**: See `docs/REDIS_CONFIGURATION.md`
