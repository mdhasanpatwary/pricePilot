# Performance Test Guide

## Quick Start

```bash
# Run all performance tests
npm test -- __tests__/lib/services/performance.test.ts

# Run with coverage
npm test -- __tests__/lib/services/performance.test.ts --coverage
```

## Test Suites

### 1. Dashboard Load Time
Tests the time it takes to load dashboard metrics.

**Targets:**
- Initial load: < 2 seconds
- Cached load: < 100ms
- Tenant metrics: < 1 second

**What it tests:**
- Database query performance
- Cache effectiveness
- Data aggregation speed

### 2. Real-Time Update Latency
Tests the latency of real-time session updates.

**Targets:**
- Session update: < 2 seconds
- Session retrieval: < 500ms
- Session completion: < 1 second

**What it tests:**
- Redis performance
- Database write speed
- Dual-write consistency

### 3. Metrics Calculation Time
Tests the time to calculate various metrics.

**Targets:**
- Dashboard metrics: < 500ms
- Time-series data: < 500ms
- Top failures: < 500ms

**What it tests:**
- Aggregation query performance
- Database index effectiveness
- Cache hit rates

### 4. Concurrent User Load
Tests system performance under concurrent load.

**Targets:**
- 50 concurrent dashboard requests
- 50 concurrent session retrievals
- 50 concurrent session updates

**What it tests:**
- Connection pool handling
- Database concurrency
- System scalability

### 5. Bulk Operations Performance
Tests bulk operation efficiency.

**Targets:**
- Bulk pause: < 5 seconds for 20 sessions
- Bulk cancel: < 5 seconds for 20 sessions

**What it tests:**
- Parallel processing
- Transaction handling
- Resource cleanup

### 6. Cache Performance
Tests caching effectiveness.

**Targets:**
- Cache improvement: 5x faster
- Cache invalidation: < 10ms

**What it tests:**
- Cache hit rates
- Cache TTL effectiveness
- Invalidation speed

### 7. Database Query Performance
Tests database query efficiency.

**Targets:**
- Session history: < 1 second
- Session counts: < 500ms

**What it tests:**
- Query optimization
- Index effectiveness
- Pagination performance

## Interpreting Results

### Passing Tests ✅
```
✓ should load dashboard metrics in less than 2 seconds (650ms)
```
- Test passed
- Performance is within target
- No action needed

### Failing Tests ❌
```
✗ should calculate dashboard metrics in less than 500ms (620ms)
```
- Test failed
- Performance exceeds target
- Optimization needed

### Common Issues

#### Slow Database Queries
**Symptoms:**
- Dashboard load time > 2 seconds
- Metrics calculation > 500ms

**Solutions:**
1. Apply recommended database indexes
2. Optimize aggregation queries
3. Implement materialized views
4. Add query result caching

#### Cache Misses
**Symptoms:**
- Cached load time > 100ms
- Cache improvement < 5x

**Solutions:**
1. Increase cache TTL
2. Implement cache warming
3. Review cache invalidation logic
4. Monitor cache hit rates

#### Concurrent Load Issues
**Symptoms:**
- Tests timeout under load
- Connection pool errors
- Slow response times

**Solutions:**
1. Increase connection pool size
2. Implement request queuing
3. Add rate limiting
4. Scale database resources

#### Redis Connection Issues
**Symptoms:**
- Session retrieval failures
- Real-time update delays
- Redis connection errors

**Solutions:**
1. Check Redis connection settings
2. Increase Redis memory
3. Implement Redis cluster
4. Add connection retry logic

## Performance Benchmarks

### Expected Performance (Development)
- Dashboard load: 600-800ms
- Cached load: 10-50ms
- Session update: 50-100ms
- Session retrieval: 100-200ms
- Metrics calculation: 400-600ms

### Expected Performance (Production)
- Dashboard load: 400-600ms
- Cached load: 5-20ms
- Session update: 30-50ms
- Session retrieval: 50-100ms
- Metrics calculation: 200-400ms

## Optimization Tips

### Database
1. **Apply indexes** from `prisma/migrations/performance_indexes.sql`
2. **Use EXPLAIN ANALYZE** to identify slow queries
3. **Implement connection pooling** with appropriate pool size
4. **Consider read replicas** for read-heavy workloads

### Caching
1. **Increase cache TTL** for stable data
2. **Implement cache warming** for frequently accessed data
3. **Use cache tags** for efficient invalidation
4. **Monitor cache hit rates** and adjust strategy

### Application
1. **Use parallel processing** for bulk operations
2. **Implement pagination** for large result sets
3. **Avoid N+1 queries** by using proper joins
4. **Use database-level aggregations** instead of application-level

### Redis
1. **Configure appropriate memory limits**
2. **Use Redis persistence** for important data
3. **Implement Redis cluster** for high availability
4. **Monitor Redis memory usage** and eviction rates

## Monitoring in Production

### Key Metrics to Track
1. **Response Times** (p50, p95, p99)
2. **Error Rates**
3. **Cache Hit Rates**
4. **Database Connection Pool Usage**
5. **Redis Memory Usage**

### Alerting Thresholds
- Dashboard load time > 2s (p95)
- API response time > 1s (p95)
- Error rate > 1%
- Cache hit rate < 70%
- Connection pool > 80%

### Tools
- **Grafana**: Real-time dashboards
- **Prometheus**: Metrics collection
- **New Relic/DataDog**: APM monitoring
- **PgHero**: PostgreSQL monitoring
- **Redis Commander**: Redis monitoring

## Troubleshooting

### Test Failures

#### "Session not found" errors
**Cause**: Timing issues with async operations
**Solution**: Increase delays between operations or use proper async/await

#### "Connection pool exhausted" errors
**Cause**: Too many concurrent database connections
**Solution**: Increase pool size or reduce concurrent operations

#### "Redis connection timeout" errors
**Cause**: Redis server not running or connection issues
**Solution**: Start Redis server or check connection settings

#### "Database query timeout" errors
**Cause**: Slow queries or missing indexes
**Solution**: Apply performance indexes and optimize queries

### Performance Degradation

#### Gradual Slowdown
**Cause**: Database growth, cache misses, or resource exhaustion
**Solution**: 
1. Analyze slow query logs
2. Review cache hit rates
3. Check resource utilization
4. Implement data retention policies

#### Sudden Slowdown
**Cause**: Configuration changes, deployment issues, or infrastructure problems
**Solution**:
1. Review recent changes
2. Check error logs
3. Verify infrastructure health
4. Rollback if necessary

## Best Practices

1. **Run tests regularly** to catch performance regressions early
2. **Baseline performance** before making changes
3. **Test in production-like environment** for accurate results
4. **Monitor trends** over time, not just absolute values
5. **Document optimizations** and their impact
6. **Set up automated alerts** for performance degradation
7. **Review and update targets** as system evolves

## Additional Resources

- [Performance Test Results](../../../PERFORMANCE_TEST_RESULTS.md)
- [Performance Testing Summary](.kiro/specs/admin-dashboard-enhancement/PERFORMANCE_TESTING_SUMMARY.md)
- [Database Indexes](../../../prisma/migrations/performance_indexes.sql)
- [Design Document](.kiro/specs/admin-dashboard-enhancement/design.md)

## Support

For questions or issues with performance testing:
1. Review this guide and related documentation
2. Check test output for specific error messages
3. Review application logs for additional context
4. Consult with the development team
