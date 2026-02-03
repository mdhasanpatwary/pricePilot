# Monitoring System Deployment Checklist

## Overview

This checklist ensures the monitoring and alerting system is properly configured and tested before production deployment.

## Pre-Deployment Checklist

### 1. Environment Configuration

- [ ] All required environment variables are set
- [ ] Sentry DSN is configured
- [ ] Redis/Upstash connection details are set
- [ ] Email service (Resend) API key is configured
- [ ] Slack webhook URL is configured (if using Slack)
- [ ] Database connection string is set
- [ ] Application URL is configured for dashboard links
- [ ] Environment-specific settings are correct

**Verification**:
```bash
npm run verify:monitoring
```

### 2. Database Setup

- [ ] Database migrations are applied
- [ ] Alert rules table exists
- [ ] Notification channels table exists
- [ ] Alert history table exists
- [ ] Indexes are created
- [ ] Database user has correct permissions

**Verification**:
```sql
-- Check tables exist
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('alert_rules', 'notification_channels', 'alert_history');

-- Check indexes
SELECT indexname FROM pg_indexes 
WHERE tablename IN ('alert_rules', 'notification_channels', 'alert_history');
```

### 3. Sentry Integration

- [ ] Sentry project is created
- [ ] DSN is correct and active
- [ ] Source maps are uploaded (for production)
- [ ] Error quota is sufficient
- [ ] Performance monitoring is enabled
- [ ] Test error is captured successfully

**Verification**:
```typescript
// Trigger test error
import * as Sentry from '@sentry/nextjs';
Sentry.captureException(new Error('Test error for deployment verification'));
```

Check Sentry dashboard for the test error.

### 4. Redis/Upstash Setup

- [ ] Redis instance is created
- [ ] Connection URL and token are correct
- [ ] Memory limit is sufficient (recommend 256MB minimum)
- [ ] Eviction policy is set (recommend allkeys-lru)
- [ ] Connection pool is configured
- [ ] Test connection succeeds

**Verification**:
```bash
npx tsx scripts/verify-redis-simple.ts
```

### 5. Email Service Setup

- [ ] Resend account is created
- [ ] API key is generated
- [ ] Sender domain is verified
- [ ] Sender email is configured
- [ ] Test email sends successfully
- [ ] Email templates are correct

**Verification**:
```bash
# Send test email
curl -X POST https://api.resend.com/emails \
  -H "Authorization: Bearer $RESEND_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "from": "alerts@yourdomain.com",
    "to": "test@yourdomain.com",
    "subject": "Test Email",
    "text": "This is a test email"
  }'
```

### 6. Slack Integration (Optional)

- [ ] Slack app is created
- [ ] Incoming webhook is configured
- [ ] Webhook URL is set in environment
- [ ] Target channel exists
- [ ] Bot has permission to post
- [ ] Test message posts successfully

**Verification**:
```bash
curl -X POST -H 'Content-type: application/json' \
  --data '{"text":"Test message from PricePilot"}' \
  $SLACK_WEBHOOK_URL
```

### 7. Alert Rules Configuration

- [ ] Built-in alert rules are created
- [ ] Thresholds are appropriate for environment
- [ ] Time windows are configured
- [ ] Notification channels are assigned
- [ ] Rules are enabled
- [ ] Test alerts trigger correctly

**Built-in Rules to Create**:
1. High Error Rate (> 1% over 5 minutes)
2. Slow Response Time (> 500ms over 5 minutes)
3. High Block Rate (> 30% over 15 minutes)
4. Price Update Failures (> 10% over 10 minutes)
5. Authentication Failures (> 10 from single IP in 1 minute)
6. Database Connection Issues
7. Redis Connection Issues

**Verification**:
```bash
GET /api/v1/monitoring/alert-rules
```

### 8. Notification Channels Configuration

- [ ] Email channel is configured
- [ ] Slack channel is configured (if using)
- [ ] Recipients are correct
- [ ] Channels are enabled
- [ ] Test notifications succeed

**Verification**:
```bash
POST /api/v1/monitoring/channels/:id/test
```

### 9. Monitoring Dashboard

- [ ] Dashboard is accessible
- [ ] Requires admin role
- [ ] Metrics are displaying
- [ ] Charts are rendering
- [ ] Auto-refresh is working
- [ ] Alert list is populated

**Verification**:
1. Navigate to `/dashboard/monitoring`
2. Verify system health status
3. Check metrics display
4. Verify auto-refresh (30 seconds)

### 10. Security Configuration

- [ ] Sensitive data sanitization is enabled
- [ ] API endpoints require authentication
- [ ] Admin role is required for dashboard
- [ ] Rate limiting is configured
- [ ] Audit logging is enabled
- [ ] CORS is properly configured

**Verification**:
```bash
# Test unauthenticated access (should fail)
curl -X GET https://api.pricepilot.com/api/v1/monitoring/health

# Test authenticated access (should succeed)
curl -X GET https://api.pricepilot.com/api/v1/monitoring/health \
  -H "Authorization: Bearer $API_TOKEN"
```

## Deployment Steps

### Step 1: Deploy Infrastructure

1. **Deploy Database Changes**:
   ```bash
   npm run db:migrate:deploy
   ```

2. **Verify Database**:
   ```bash
   npm run db:verify
   ```

3. **Deploy Redis Configuration**:
   - Verify Upstash instance is running
   - Check memory limits
   - Verify eviction policy

### Step 2: Deploy Application

1. **Build Application**:
   ```bash
   npm run build
   ```

2. **Run Tests**:
   ```bash
   npm run test
   npm run test:integration
   ```

3. **Deploy to Staging**:
   ```bash
   vercel --prod --env staging
   ```

4. **Verify Staging**:
   - Run verification script
   - Test alert triggering
   - Test notification delivery
   - Check dashboard functionality

5. **Deploy to Production**:
   ```bash
   vercel --prod
   ```

### Step 3: Post-Deployment Verification

1. **Verify Monitoring System**:
   ```bash
   npm run verify:monitoring
   ```

2. **Check System Health**:
   - Navigate to monitoring dashboard
   - Verify all components are healthy
   - Check for any errors

3. **Test Alert Flow**:
   ```bash
   POST /api/v1/monitoring/alert-rules/:id/test
   ```

4. **Verify Notifications**:
   - Check email delivery
   - Check Slack delivery
   - Verify notification content

5. **Monitor Initial Period**:
   - Watch for errors in Sentry
   - Monitor alert triggering
   - Check notification delivery rates
   - Review dashboard metrics

## Post-Deployment Checklist

### Immediate (First Hour)

- [ ] System health is "healthy"
- [ ] No critical errors in Sentry
- [ ] Metrics are being collected
- [ ] Dashboard is accessible
- [ ] No deployment-related alerts

### First Day

- [ ] Alert rules are triggering appropriately
- [ ] Notifications are being delivered
- [ ] No false positives
- [ ] Performance overhead is acceptable (< 5ms)
- [ ] No memory leaks in Redis

### First Week

- [ ] Review alert history
- [ ] Adjust thresholds if needed
- [ ] Monitor notification delivery rates
- [ ] Check for any issues or errors
- [ ] Gather feedback from operations team

### First Month

- [ ] Analyze alert patterns
- [ ] Tune alert rules based on data
- [ ] Review and update documentation
- [ ] Train team on monitoring system
- [ ] Establish alert response procedures

## Rollback Plan

### If Issues Occur

1. **Identify Issue**:
   - Check Sentry for errors
   - Review application logs
   - Check monitoring dashboard

2. **Assess Impact**:
   - Is monitoring system causing issues?
   - Is application functionality affected?
   - Are users impacted?

3. **Rollback Steps**:

   **Option 1: Disable Monitoring**:
   ```bash
   # Set environment variable
   MONITORING_ENABLED=false
   
   # Redeploy
   vercel --prod
   ```

   **Option 2: Rollback Deployment**:
   ```bash
   # Rollback to previous version
   vercel rollback
   ```

   **Option 3: Disable Specific Features**:
   - Disable alert evaluation cron
   - Disable notification delivery
   - Disable specific alert rules

4. **Investigate and Fix**:
   - Identify root cause
   - Fix issue in staging
   - Test thoroughly
   - Redeploy to production

## Monitoring the Monitoring System

### Key Metrics to Track

1. **System Health**:
   - Overall health status
   - Component status
   - Error rates

2. **Alert Performance**:
   - Alert triggering rate
   - False positive rate
   - Alert resolution time

3. **Notification Delivery**:
   - Delivery success rate
   - Delivery latency
   - Failed deliveries

4. **Performance**:
   - Monitoring overhead
   - Alert evaluation time
   - Dashboard load time

5. **Resource Usage**:
   - Redis memory usage
   - Database connection pool
   - API request rates

### Alerts for Monitoring System

Create alerts for the monitoring system itself:

1. **Monitoring System Down**:
   - Trigger: No metrics collected for 5 minutes
   - Severity: Critical

2. **High Notification Failure Rate**:
   - Trigger: > 10% notification failures
   - Severity: Warning

3. **Alert Evaluation Failures**:
   - Trigger: Alert evaluation errors
   - Severity: Critical

4. **High Redis Memory Usage**:
   - Trigger: > 80% memory used
   - Severity: Warning

5. **Sentry Quota Exceeded**:
   - Trigger: Approaching quota limit
   - Severity: Warning

## Documentation Updates

### Update Documentation

- [ ] Update environment variables documentation
- [ ] Document alert response procedures
- [ ] Update troubleshooting guide
- [ ] Document baseline metrics
- [ ] Update API documentation

### Team Training

- [ ] Train operations team on dashboard
- [ ] Document alert response procedures
- [ ] Create runbook for common issues
- [ ] Schedule training sessions
- [ ] Provide access to documentation

## Success Criteria

### Deployment is Successful When:

1. **All checks pass**:
   - Verification script succeeds
   - All tests pass
   - No critical errors

2. **System is operational**:
   - Metrics are being collected
   - Alerts are triggering appropriately
   - Notifications are being delivered
   - Dashboard is accessible

3. **Performance is acceptable**:
   - Monitoring overhead < 5ms
   - Alert evaluation < 1 second
   - Notification delivery < 5 seconds

4. **Team is ready**:
   - Operations team trained
   - Documentation complete
   - Response procedures documented
   - Support channels established

## Support and Escalation

### Support Contacts

- **Platform Team**: platform@yourdomain.com
- **Operations Team**: ops@yourdomain.com
- **On-Call**: oncall@yourdomain.com

### Escalation Path

1. **Level 1**: Check documentation and troubleshooting guide
2. **Level 2**: Contact platform team
3. **Level 3**: Escalate to on-call engineer
4. **Level 4**: Emergency rollback

### Emergency Contacts

- **Platform Lead**: [Name] - [Phone]
- **Operations Lead**: [Name] - [Phone]
- **CTO**: [Name] - [Phone]

## Related Documentation

- [Monitoring System Overview](./MONITORING_SYSTEM.md)
- [Environment Variables](./MONITORING_ENVIRONMENT_VARIABLES.md)
- [Infrastructure Setup](./MONITORING_INFRASTRUCTURE_SETUP.md)
- [Troubleshooting Guide](./MONITORING_TROUBLESHOOTING.md)
- [Alert Configuration](./MONITORING_ALERT_CONFIGURATION.md)
- [Notification Setup](./MONITORING_NOTIFICATION_SETUP.md)
