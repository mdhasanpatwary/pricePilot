# Cache Deployment Checklist

## Overview

This checklist ensures a smooth deployment of PricePilot's caching infrastructure. Follow each step carefully and verify completion before proceeding to the next phase.

## Pre-Deployment

### 1. Upstash Redis Provisioning

- [ ] **Create Upstash Redis database**
  - Go to https://console.upstash.com/
  - Click "Create Database"
  - Name: `pricepilot-cache-production`
  - Region: Select closest to application servers
  - Plan: Select appropriate plan (minimum: 500MB memory)

- [ ] **Configure memory limits**
  - Navigate to database settings
  - Set Max Memory: `500 MB` (or higher based on needs)
  - Set Eviction Policy: `allkeys-lru`
  - Save configuration

- [ ] **Get API credentials**
  - Copy REST URL: `https://your-instance.upstash.io`
  - Copy REST TOKEN: `your-token-here`
  - Store securely (use secrets manager)

- [ ] **Test connectivity**
  ```bash
  # Test from production environment
  curl https://your-instance.upstash.io
  ```

**Verification**:
```bash
npx tsx scripts/verify-redis-simple.ts
npx tsx scripts/verify-redis-memory-config.ts
```

### 2. Environment Variables

- [ ] **Set production environment variables**
  ```bash
  # Redis Configuration
  UPSTASH_REDIS_REST_URL="https://your-instance.upstash.io"
  UPSTASH_REDIS_REST_TOKEN="your-token-here"
  
  # Memory Configuration
  REDIS_MEMORY_LIMIT_MB=500
  REDIS_MEMORY_ALERT_THRESHOLD=0.8
  
  # Cache Configuration
  CACHE_DEFAULT_TTL=300
  CACHE_ENABLED=true
  ```

- [ ] **Verify environment variables are set**
  ```bash
  # On production server
  echo $UPSTASH_REDIS_REST_URL
  echo $UPSTASH_REDIS_REST_TOKEN
  echo $REDIS_MEMORY_LIMIT_MB
  ```

- [ ] **Ensure secrets are not in version control**
  ```bash
  # Check .gitignore includes .env
  grep "\.env" .gitignore
  ```

**Verification**:
```bash
# Test environment variables are accessible
node -e "console.log(process.env.UPSTASH_REDIS_REST_URL ? 'OK' : 'MISSING')"
```

### 3. Code Deployment

- [ ] **Ensure all cache code is deployed**
  - `lib/services/cache.ts`
  - `lib/services/cache-layer.ts`
  - `lib/services/cache-enhanced.ts`
  - `lib/services/cache-invalidation.ts`
  - `lib/services/cache-warming.ts`
  - `lib/services/cache-monitoring.ts`
  - `lib/services/cache-invalidation-pubsub.ts`
  - `lib/services/cache-initialization.ts`

- [ ] **Verify instrumentation is configured**
  ```typescript
  // instrumentation.ts should include:
  import { initializeDistributedCache } from '@/lib/services/cache-initialization';
  
  export async function register() {
    if (process.env.NEXT_RUNTIME === 'nodejs') {
      await initializeDistributedCache();
    }
  }
  ```

- [ ] **Verify API endpoints are deployed**
  - `app/api/v1/admin/performance/cache-stats/route.ts`

- [ ] **Verify scripts are deployed**
  - `scripts/verify-redis-simple.ts`
  - `scripts/verify-redis-memory-config.ts`
  - `scripts/test-cache-stats-endpoint.ts`
  - `scripts/test-distributed-cache.ts`
  - `scripts/warm-cache.ts`

**Verification**:
```bash
# Check files exist
ls -la lib/services/cache*.ts
ls -la app/api/v1/admin/performance/cache-stats/route.ts
```

### 4. Monitoring Setup

- [ ] **Configure cache statistics logging**
  - Set up cron job for periodic logging (every 5 minutes)
  - Configure log aggregation (e.g., CloudWatch, Datadog)
  - Set up log retention policy

- [ ] **Configure alerting**
  - Hit rate below 60% → Warning alert
  - Hit rate below 50% → Critical alert
  - Memory usage above 80% → Warning alert
  - Memory usage above 95% → Critical alert
  - Cache operations over 100ms → Warning alert
  - Redis connectivity failures → Critical alert

- [ ] **Set up monitoring dashboard**
  - Cache hit rate over time
  - Memory usage over time
  - Response time distribution
  - Eviction rate
  - Alert history

- [ ] **Configure alert destinations**
  - Email: ops@pricepilot.com
  - Slack: #alerts channel
  - PagerDuty: For critical alerts

**Verification**:
```bash
# Test monitoring endpoint
curl -H "Authorization: Bearer <admin-token>" \
  http://localhost:3000/api/v1/admin/performance/cache-stats
```

### 5. Testing

- [ ] **Run unit tests**
  ```bash
  npm test -- cache
  ```

- [ ] **Run integration tests**
  ```bash
  npm test -- integration
  ```

- [ ] **Run distributed cache tests**
  ```bash
  npx tsx scripts/test-distributed-cache.ts
  ```

- [ ] **Run load tests**
  ```bash
  npm run test:load
  ```

- [ ] **Verify cache warming**
  ```bash
  npx tsx scripts/warm-cache.ts
  ```

**Verification**:
- All tests pass
- No errors in logs
- Cache operations complete successfully

## Deployment Phases

### Phase 1: Staging Deployment (10% Traffic)

**Objective**: Validate cache functionality in production-like environment

- [ ] **Deploy to staging environment**
  ```bash
  # Deploy code
  git checkout main
  git pull origin main
  npm run build
  npm run deploy:staging
  ```

- [ ] **Verify staging deployment**
  - [ ] Application starts successfully
  - [ ] Redis connection established
  - [ ] Distributed cache initialized
  - [ ] No errors in logs

- [ ] **Run smoke tests**
  ```bash
  # Test cache operations
  npx tsx scripts/verify-redis-simple.ts
  
  # Test cache stats endpoint
  npx tsx scripts/test-cache-stats-endpoint.ts
  
  # Test distributed invalidation
  npx tsx scripts/test-distributed-cache.ts
  ```

- [ ] **Monitor staging for 24 hours**
  - [ ] Check cache hit rate (target: >70%)
  - [ ] Check memory usage (target: <80%)
  - [ ] Check response times (target: <50ms)
  - [ ] Check for errors in logs
  - [ ] Verify invalidation working
  - [ ] Verify warming working

- [ ] **Performance validation**
  - [ ] Measure database query reduction
  - [ ] Measure API response time improvement
  - [ ] Verify cache hit rate meets target
  - [ ] Verify memory usage within limits

**Success Criteria**:
- Cache hit rate >70%
- Memory usage <80%
- Response time <50ms for cached queries
- No critical errors
- Database load reduced by >60%

**Rollback Plan**:
```bash
# If issues detected, disable caching
export CACHE_ENABLED=false
npm run deploy:staging
```

### Phase 2: Production Deployment (10% Traffic)

**Objective**: Validate cache in production with limited traffic

- [ ] **Enable feature flag for 10% of users**
  ```typescript
  // In feature flag service
  await featureFlags.enable('cache-enabled', { percentage: 10 });
  ```

- [ ] **Deploy to production**
  ```bash
  # Deploy code
  git checkout main
  git pull origin main
  npm run build
  npm run deploy:production
  ```

- [ ] **Verify production deployment**
  - [ ] Application starts successfully
  - [ ] Redis connection established
  - [ ] Distributed cache initialized
  - [ ] No errors in logs

- [ ] **Monitor for 24 hours**
  - [ ] Check cache hit rate
  - [ ] Check memory usage
  - [ ] Check response times
  - [ ] Check error rates
  - [ ] Monitor user feedback
  - [ ] Compare with non-cached users

- [ ] **Validate metrics**
  - [ ] Cache hit rate >70%
  - [ ] Memory usage <80%
  - [ ] Response time improvement >40%
  - [ ] Database load reduction >60%
  - [ ] No increase in error rate

**Success Criteria**:
- All metrics meet targets
- No user complaints
- No critical errors
- Performance improvement confirmed

**Rollback Plan**:
```bash
# If issues detected, reduce to 0%
await featureFlags.enable('cache-enabled', { percentage: 0 });
```

### Phase 3: Production Deployment (50% Traffic)

**Objective**: Scale cache to half of production traffic

- [ ] **Increase feature flag to 50%**
  ```typescript
  await featureFlags.enable('cache-enabled', { percentage: 50 });
  ```

- [ ] **Monitor for 48 hours**
  - [ ] Check cache hit rate
  - [ ] Check memory usage
  - [ ] Check response times
  - [ ] Check error rates
  - [ ] Monitor Redis performance
  - [ ] Check for memory pressure

- [ ] **Validate scaling**
  - [ ] Cache hit rate maintained >70%
  - [ ] Memory usage <80%
  - [ ] Response times consistent
  - [ ] No performance degradation
  - [ ] Distributed invalidation working

- [ ] **Load testing**
  ```bash
  # Run load tests with 50% traffic
  npm run test:load -- --percentage=50
  ```

**Success Criteria**:
- Metrics maintained at target levels
- No performance degradation
- No memory issues
- Distributed caching working correctly

**Rollback Plan**:
```bash
# If issues detected, reduce to 10%
await featureFlags.enable('cache-enabled', { percentage: 10 });
```

### Phase 4: Production Deployment (100% Traffic)

**Objective**: Enable cache for all users

- [ ] **Increase feature flag to 100%**
  ```typescript
  await featureFlags.enable('cache-enabled', { percentage: 100 });
  ```

- [ ] **Monitor for 1 week**
  - [ ] Check cache hit rate daily
  - [ ] Check memory usage daily
  - [ ] Check response times daily
  - [ ] Monitor error rates
  - [ ] Review user feedback
  - [ ] Check database load reduction

- [ ] **Final validation**
  - [ ] Cache hit rate >70%
  - [ ] Memory usage <80%
  - [ ] Response time improvement >40%
  - [ ] Database load reduction >60%
  - [ ] No increase in errors
  - [ ] Positive user feedback

- [ ] **Remove feature flag**
  ```typescript
  // Cache is now permanently enabled
  // Remove feature flag code
  ```

**Success Criteria**:
- All performance targets met
- No critical issues
- User satisfaction maintained
- System stable

**Rollback Plan**:
```bash
# If critical issues, reduce to 50%
await featureFlags.enable('cache-enabled', { percentage: 50 });

# If severe issues, disable completely
await featureFlags.enable('cache-enabled', { percentage: 0 });
```

## Post-Deployment

### 1. Monitoring

- [ ] **Set up continuous monitoring**
  - [ ] Cache hit rate tracking
  - [ ] Memory usage tracking
  - [ ] Response time tracking
  - [ ] Error rate tracking
  - [ ] Alert configuration verified

- [ ] **Configure automated reports**
  - [ ] Daily cache performance report
  - [ ] Weekly cache optimization report
  - [ ] Monthly cache cost analysis

- [ ] **Set up dashboards**
  - [ ] Real-time cache metrics
  - [ ] Historical trends
  - [ ] Alert history
  - [ ] Performance comparisons

### 2. Optimization

- [ ] **Review cache performance**
  - [ ] Analyze hit rate by service
  - [ ] Identify low-performing caches
  - [ ] Review TTL effectiveness
  - [ ] Check warming effectiveness

- [ ] **Optimize TTLs**
  - [ ] Adjust based on access patterns
  - [ ] Increase for stable data
  - [ ] Decrease for volatile data

- [ ] **Optimize warming**
  - [ ] Review warming effectiveness
  - [ ] Adjust warming schedule
  - [ ] Add/remove warming targets

- [ ] **Optimize invalidation**
  - [ ] Review invalidation patterns
  - [ ] Make patterns more specific
  - [ ] Reduce over-invalidation

### 3. Documentation

- [ ] **Update runbook**
  - [ ] Add cache troubleshooting steps
  - [ ] Document common issues
  - [ ] Add escalation procedures

- [ ] **Train team**
  - [ ] Cache architecture overview
  - [ ] Monitoring and alerting
  - [ ] Troubleshooting procedures
  - [ ] Optimization techniques

- [ ] **Document lessons learned**
  - [ ] What went well
  - [ ] What could be improved
  - [ ] Recommendations for future

### 4. Maintenance

- [ ] **Schedule regular reviews**
  - [ ] Weekly: Review metrics and alerts
  - [ ] Monthly: Optimize configuration
  - [ ] Quarterly: Capacity planning

- [ ] **Set up automated tasks**
  - [ ] Daily cache warming (2 AM)
  - [ ] Weekly cache cleanup
  - [ ] Monthly performance reports

- [ ] **Plan for scaling**
  - [ ] Monitor growth trends
  - [ ] Plan memory increases
  - [ ] Consider Redis cluster

## Rollback Procedures

### Emergency Rollback

If critical issues are detected:

1. **Disable caching immediately**
   ```bash
   # Set environment variable
   export CACHE_ENABLED=false
   
   # Restart application
   pm2 restart all
   ```

2. **Verify rollback**
   ```bash
   # Check cache is disabled
   curl http://localhost:3000/api/v1/admin/performance/cache-stats
   # Should show cache disabled
   ```

3. **Monitor recovery**
   - Check error rates decrease
   - Verify application stability
   - Monitor database load

4. **Investigate issue**
   - Review logs
   - Identify root cause
   - Plan fix

5. **Re-deploy when ready**
   - Fix issue
   - Test in staging
   - Deploy to production

### Partial Rollback

If issues affect only some users:

1. **Reduce feature flag percentage**
   ```typescript
   // Reduce from 100% to 50%
   await featureFlags.enable('cache-enabled', { percentage: 50 });
   ```

2. **Monitor affected users**
   - Identify patterns
   - Check for common factors
   - Isolate issue

3. **Fix and re-enable**
   - Deploy fix
   - Gradually increase percentage
   - Monitor closely

## Success Metrics

### Performance Metrics

| Metric | Baseline | Target | Actual | Status |
|--------|----------|--------|--------|--------|
| Cache Hit Rate | 0% | >70% | ___% | ☐ |
| Response Time (p95) | 500ms | <300ms | ___ms | ☐ |
| Database Load | 100% | <40% | ___% | ☐ |
| Memory Usage | 0MB | <400MB | ___MB | ☐ |
| Error Rate | ___% | No increase | ___% | ☐ |

### Business Metrics

| Metric | Baseline | Target | Actual | Status |
|--------|----------|--------|--------|--------|
| User Satisfaction | ___% | Maintained | ___% | ☐ |
| Page Load Time | ___s | -40% | ___s | ☐ |
| Server Costs | $___/mo | -30% | $___/mo | ☐ |
| Uptime | ___% | Maintained | ___% | ☐ |

## Sign-Off

### Phase 1: Staging (10%)
- [ ] Technical Lead: _________________ Date: _______
- [ ] DevOps Lead: _________________ Date: _______

### Phase 2: Production (10%)
- [ ] Technical Lead: _________________ Date: _______
- [ ] Product Manager: _________________ Date: _______
- [ ] DevOps Lead: _________________ Date: _______

### Phase 3: Production (50%)
- [ ] Technical Lead: _________________ Date: _______
- [ ] Product Manager: _________________ Date: _______
- [ ] DevOps Lead: _________________ Date: _______

### Phase 4: Production (100%)
- [ ] Technical Lead: _________________ Date: _______
- [ ] Product Manager: _________________ Date: _______
- [ ] DevOps Lead: _________________ Date: _______
- [ ] CTO: _________________ Date: _______

## Related Documentation

- [Cache Configuration Guide](./CACHE_CONFIGURATION.md)
- [Cache Monitoring Guide](./CACHE_MONITORING.md)
- [Cache Troubleshooting Guide](./CACHE_TROUBLESHOOTING.md)
- [Redis Configuration](./REDIS_CONFIGURATION.md)
- [Redis Memory Configuration](./REDIS_MEMORY_CONFIGURATION.md)
- [Distributed Cache Invalidation](./DISTRIBUTED_CACHE_INVALIDATION.md)

## Support Contacts

- **Technical Issues**: tech-lead@pricepilot.com
- **Upstash Support**: support@upstash.com
- **Emergency**: +1-XXX-XXX-XXXX (On-call engineer)
