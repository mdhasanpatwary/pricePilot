---
title: "Monitoring Troubleshooting"
description: "Troubleshooting monitoring system issues"
category: "system-monitoring"
tags: ["monitoring", "troubleshooting", "issues"]
audience: "admin"
---

# Monitoring System Troubleshooting Guide

## Overview

This guide helps diagnose and resolve common issues with the PricePilot monitoring and alerting system.

## Quick Diagnostics

### System Health Check

1. Navigate to **Dashboard → Monitoring**
2. Check system health status indicator
3. Review active alerts
4. Check component status

### Verification Script

Run the monitoring verification script:

```bash
npm run verify:monitoring
# or
npx tsx scripts/verify-monitoring-setup.ts
```

This checks:
- Database schema
- Sentry configuration
- Redis connection
- Email service
- Alert rules
- Notification channels

## Common Issues

### 1. Alerts Not Triggering

#### Symptoms
- Expected alerts not appearing
- No notifications received
- Dashboard shows no active alerts

#### Diagnosis

**Check Alert Rule Status**:
```bash
GET /api/v1/monitoring/alert-rules
```

Verify:
- Rule is enabled
- Threshold is correct
- Time window is appropriate
- Metric type matches collected metrics

**Check Metric Collection**:
```bash
GET /api/v1/monitoring/metrics?metricType=error_rate&timeRange=1h
```

Verify:
- Metrics are being collected
- Values are within expected range
- Timestamps are recent

**Check Alert Evaluation**:
- Review cron job logs: `/api/v1/cron/evaluate-alerts`
- Check for evaluation errors
- Verify distributed lock is working

#### Solutions

1. **Enable the alert rule**:
   - Navigate to alert configuration
   - Toggle "Enabled" switch

2. **Adjust threshold**:
   - Review metric baseline
   - Lower threshold if too high
   - Increase time window if too short

3. **Verify metric collection**:
   - Check middleware is active
   - Verify Redis connection
   - Review metric collector logs

4. **Check maintenance window**:
   - Verify not in maintenance mode
   - Clear expired maintenance windows

5. **Restart alert evaluation**:
   - Trigger manual evaluation
   - Check cron job schedule
   - Review evaluation logs

### 2. Notifications Not Received

#### Symptoms
- Alerts trigger but no notifications
- Delivery logs show failures
- Some channels work, others don't

#### Diagnosis

**Check Notification Channels**:
```bash
GET /api/v1/monitoring/channels
```

Verify:
- Channels are enabled
- Configuration is correct
- Test delivery succeeds

**Check Delivery Logs**:
```bash
GET /api/v1/monitoring/delivery-stats
```

Review:
- Delivery success rate
- Error messages
- Failed channels

**Check Alert Rule Configuration**:
- Verify notification channels are selected
- Check channel IDs match configured channels

#### Solutions

1. **Email not received**:
   - Verify Resend API key: `RESEND_API_KEY`
   - Check sender domain is verified
   - Test with different recipient
   - Check spam folder
   - Review Resend dashboard for errors

2. **Slack not received**:
   - Verify webhook URL is correct
   - Test webhook with curl:
     ```bash
     curl -X POST -H 'Content-type: application/json' \
       --data '{"text":"Test message"}' \
       YOUR_WEBHOOK_URL
     ```
   - Check Slack channel permissions
   - Verify Slack app is active

3. **All channels failing**:
   - Check network connectivity
   - Review notification router logs
   - Verify rate limiting not exceeded
   - Check Redis connection

4. **Enable fallback**:
   - Configure multiple channels
   - Email fallback for Slack failures
   - Monitor fallback usage

### 3. Dashboard Not Loading

#### Symptoms
- Dashboard page shows error
- Metrics not displaying
- Infinite loading state

#### Diagnosis

**Check Browser Console**:
- Open developer tools
- Review console errors
- Check network requests

**Check API Endpoints**:
```bash
GET /api/v1/monitoring/health
GET /api/v1/monitoring/metrics
GET /api/v1/monitoring/alerts
```

**Check Authentication**:
- Verify user is logged in
- Check user has admin role
- Review session validity

#### Solutions

1. **Authentication error**:
   - Log out and log back in
   - Verify admin role assignment
   - Check session configuration

2. **API errors**:
   - Check server logs
   - Verify database connection
   - Check Redis connection
   - Review API error responses

3. **Data loading issues**:
   - Clear browser cache
   - Disable browser extensions
   - Try different browser
   - Check network connectivity

4. **Performance issues**:
   - Reduce time range
   - Limit number of metrics
   - Check Redis performance
   - Review database query performance

### 4. Sentry Integration Issues

#### Symptoms
- Errors not appearing in Sentry
- Incomplete error context
- Sentry connection errors

#### Diagnosis

**Check Sentry Configuration**:
```bash
# Verify environment variables
echo $SENTRY_DSN
echo $SENTRY_ENVIRONMENT
```

**Check Sentry Dashboard**:
- Log into Sentry
- Verify project exists
- Check error quota
- Review project settings

**Test Error Capture**:
```typescript
// Trigger test error
throw new Error('Test error for Sentry');
```

#### Solutions

1. **Missing DSN**:
   - Add `SENTRY_DSN` to `.env`
   - Restart application
   - Verify DSN is correct

2. **Quota exceeded**:
   - Check Sentry quota usage
   - Upgrade Sentry plan
   - Adjust sample rate
   - Filter noisy errors

3. **Context missing**:
   - Verify middleware is active
   - Check context extraction logic
   - Review error capture service

4. **Connection errors**:
   - Check network connectivity
   - Verify Sentry service status
   - Review firewall rules
   - Check proxy configuration

### 5. Redis Connection Issues

#### Symptoms
- Metrics not being stored
- Alert state not persisting
- Connection timeout errors

#### Diagnosis

**Check Redis Connection**:
```bash
# Test Redis connection
npx tsx scripts/verify-redis-simple.ts
```

**Check Environment Variables**:
```bash
echo $UPSTASH_REDIS_REST_URL
echo $UPSTASH_REDIS_REST_TOKEN
```

**Check Redis Dashboard**:
- Log into Upstash
- Verify database is active
- Check connection limits
- Review memory usage

#### Solutions

1. **Connection timeout**:
   - Verify Redis URL is correct
   - Check network connectivity
   - Increase timeout settings
   - Review firewall rules

2. **Authentication failed**:
   - Verify Redis token is correct
   - Regenerate token if needed
   - Update environment variables
   - Restart application

3. **Memory limit exceeded**:
   - Check Redis memory usage
   - Increase memory limit
   - Adjust TTL settings
   - Clean up old data

4. **Connection pool exhausted**:
   - Increase pool size
   - Check for connection leaks
   - Review connection usage
   - Implement connection retry

### 6. High False Positive Rate

#### Symptoms
- Too many alerts triggered
- Alerts for non-issues
- Alert fatigue

#### Diagnosis

**Review Alert History**:
```bash
GET /api/v1/monitoring/alerts/history?limit=100
```

**Analyze Metrics**:
- Check metric baseline
- Review threshold values
- Analyze time windows
- Compare with actual issues

**Check Alert Rules**:
- Review rule configurations
- Verify thresholds are appropriate
- Check aggregation methods

#### Solutions

1. **Adjust thresholds**:
   - Increase threshold values
   - Use percentiles instead of averages
   - Extend time windows
   - Add buffer to thresholds

2. **Refine conditions**:
   - Use more specific metric types
   - Add tenant-specific rules
   - Combine multiple conditions
   - Use different aggregations

3. **Implement deduplication**:
   - Verify deduplication is active
   - Adjust deduplication window
   - Group related alerts
   - Use maintenance windows

4. **Tune alert rules**:
   - Disable noisy rules
   - Create tenant-specific rules
   - Use different severities
   - Document baseline metrics

### 7. Performance Issues

#### Symptoms
- Slow dashboard loading
- High request latency
- Timeout errors

#### Diagnosis

**Check Monitoring Overhead**:
```bash
# Run performance test
npm run test:performance
```

**Check Database Performance**:
```sql
-- Check slow queries
SELECT * FROM pg_stat_statements 
ORDER BY mean_exec_time DESC 
LIMIT 10;
```

**Check Redis Performance**:
- Review Redis latency
- Check memory usage
- Monitor connection count

#### Solutions

1. **Reduce monitoring overhead**:
   - Optimize metric collection
   - Batch Redis operations
   - Use sampling for high-volume metrics
   - Cache dashboard data

2. **Optimize database queries**:
   - Add missing indexes
   - Optimize query patterns
   - Use connection pooling
   - Implement query caching

3. **Optimize Redis usage**:
   - Reduce TTL for old data
   - Use pipeline for batch operations
   - Implement data compression
   - Monitor memory usage

4. **Scale infrastructure**:
   - Increase Redis memory
   - Upgrade database instance
   - Add read replicas
   - Implement caching layer

### 8. Alert Deduplication Issues

#### Symptoms
- Duplicate alerts received
- Missing resolution notifications
- Alert state inconsistencies

#### Diagnosis

**Check Deduplication Logic**:
- Review alert fingerprints
- Check Redis TTL settings
- Verify deduplication window

**Check Alert State**:
```bash
# Check Redis for alert state
redis-cli GET "alert:state:rule123:fingerprint456"
```

#### Solutions

1. **Duplicate alerts**:
   - Verify deduplication is enabled
   - Check fingerprint generation
   - Adjust deduplication window
   - Review alert grouping logic

2. **Missing resolutions**:
   - Verify resolution detection
   - Check alert state tracking
   - Review notification logic
   - Test resolution flow

3. **State inconsistencies**:
   - Clear stale alert state
   - Verify Redis TTL
   - Check distributed locking
   - Review state transitions

## Diagnostic Commands

### Check System Status

```bash
# Verify monitoring setup
npm run verify:monitoring

# Check Redis connection
npx tsx scripts/verify-redis-simple.ts

# Test email service
npx tsx scripts/test-email-notification.ts

# Test Slack integration
npx tsx scripts/test-slack-notification.ts
```

### View Logs

```bash
# Application logs
tail -f logs/application.log

# Alert evaluation logs
tail -f logs/alert-evaluation.log

# Notification logs
tail -f logs/notifications.log

# Error logs
tail -f logs/errors.log
```

### Database Queries

```sql
-- Check alert rules
SELECT * FROM alert_rules WHERE enabled = true;

-- Check recent alerts
SELECT * FROM alert_history 
ORDER BY triggered_at DESC 
LIMIT 10;

-- Check notification channels
SELECT * FROM notification_channels WHERE enabled = true;

-- Check delivery statistics
SELECT 
  channel,
  COUNT(*) as total,
  SUM(CASE WHEN success THEN 1 ELSE 0 END) as successful
FROM alert_history
GROUP BY channel;
```

### Redis Commands

```bash
# Check metric keys
redis-cli KEYS "metrics:*"

# Check alert state
redis-cli KEYS "alert:state:*"

# Check maintenance window
redis-cli GET "maintenance:window"

# Check TTL
redis-cli TTL "metrics:error_rate:tenant123:5m"
```

## Getting Help

### Before Contacting Support

1. Run verification script
2. Check system health dashboard
3. Review relevant logs
4. Test with simple configuration
5. Document error messages

### Information to Provide

- System health status
- Error messages and stack traces
- Alert rule configuration
- Notification channel configuration
- Recent changes or deployments
- Verification script output
- Relevant log excerpts

### Support Channels

1. **Documentation**: Review all monitoring docs
2. **Dashboard**: Check delivery statistics and logs
3. **Sentry**: Review error details and context
4. **Platform Support**: Contact with diagnostic information

## Preventive Measures

### Regular Maintenance

- Review alert rules monthly
- Update thresholds based on baselines
- Clean up unused channels
- Test notification delivery
- Monitor delivery statistics

### Monitoring the Monitoring

- Set up alerts for monitoring system itself
- Monitor Sentry quota usage
- Track Redis memory usage
- Monitor notification delivery rates
- Review alert false positive rates

### Documentation

- Document alert response procedures
- Maintain runbook for common issues
- Document baseline metrics
- Keep configuration up to date
- Document recent changes

### Testing

- Test alert rules after changes
- Verify notification delivery regularly
- Test failover scenarios
- Validate dashboard functionality
- Run performance tests

## Related Documentation

- [Monitoring System Overview](./MONITORING_SYSTEM.md)
- [Alert Configuration](./MONITORING_ALERT_CONFIGURATION.md)
- [Notification Setup](./MONITORING_NOTIFICATION_SETUP.md)
- [Dashboard Usage](./MONITORING_UI.md)
- [API Monitoring](./API_MONITORING.md)
