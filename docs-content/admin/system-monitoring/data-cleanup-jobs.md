---
title: "Data Cleanup Jobs"
description: "Automated data cleanup and retention policies"
category: "system-monitoring"
author: "PricePilot Team"
lastReviewed: "2024-05-20"
tags: ["data", "cleanup", "automation"]
audience: "admin"
---

# Data Cleanup Jobs

## Overview

PricePilot implements automated data cleanup jobs to maintain database performance and comply with data retention policies. These jobs run on scheduled intervals via Vercel Cron Jobs.

---

## Cleanup Jobs

### 1. Notification Cleanup

**Schedule**: Daily at 1:00 AM UTC  
**Endpoint**: `/api/v1/cron/cleanup-notifications`  
**Cron Expression**: `0 1 * * *`

**Retention Policy**:
- Read notifications: 90 days
- Unread notifications: 180 days
- Critical notifications: 365 days

**Critical Notification Types**:
- `SECURITY_ALERT`
- `SYSTEM_CRITICAL`
- `PAYMENT_FAILED`
- `ACCOUNT_SUSPENDED`

---

### 2. Sync Log Cleanup

**Schedule**: Daily at 1:30 AM UTC  
**Endpoint**: `/api/v1/cron/cleanup-sync-logs`  
**Cron Expression**: `30 1 * * *`

**Retention Policy**:
- Successful syncs (INFO, SUCCESS): 30 days
- Failed syncs (ERROR, WARN): 90 days

---

### 3. Price History Cleanup

**Schedule**: Daily at 2:00 AM UTC  
**Endpoint**: `/api/v1/cron/cleanup-price-history`  
**Cron Expression**: `0 2 * * *`

**Retention Policy**:
- Hot data (fast access): 90 days
- Older data should be archived before deletion

**Note**: This cleanup removes records older than 90 days. Consider implementing archival before enabling this job in production.

---

### 4. Session Cleanup

**Schedule**: Daily at 2:00 AM UTC  
**Endpoint**: `/api/v1/cron/cleanup-sessions`  
**Cron Expression**: `0 2 * * *`

**Retention Policy**:
- Expired sessions: 7 days past expiration

---

### 5. Price Update Log Cleanup

**Schedule**: Daily at 2:30 AM UTC  
**Endpoint**: `/api/v1/cron/cleanup-price-update-logs`  
**Cron Expression**: `30 2 * * *`

**Retention Policy**:
- Successful updates: 180 days
- Failed updates: 365 days

---

### 6. Audit Log Cleanup

**Schedule**: Monthly on the 1st at 3:00 AM UTC  
**Endpoint**: `/api/v1/cron/cleanup-audit-logs`  
**Cron Expression**: `0 3 1 * *`

**Retention Policy**:
- Standard audit logs: 2 years
- Critical security events: 5 years

**Critical Actions** (5-year retention):
- `PASSWORD_CHANGE`
- `ROLE_CHANGE`
- `PERMISSION_CHANGE`
- `API_KEY_CREATE`
- `API_KEY_DELETE`
- `USER_CREATE`
- `USER_DELETE`
- `SECURITY_BREACH`
- `UNAUTHORIZED_ACCESS`

---

### 7. Scraping Metrics Cleanup

**Schedule**: Daily at 4:00 AM UTC  
**Endpoint**: `/api/v1/cron/cleanup-scraping-metrics`  
**Cron Expression**: `0 4 * * *`

**Retention Policy**:
- Raw metrics: 7 days
- Aggregated metrics should be created before deletion

---

### 8. Bulk Snapshot Cleanup

**Schedule**: Weekly on Sundays at 4:00 AM UTC  
**Endpoint**: `/api/v1/cron/cleanup-bulk-snapshots`  
**Cron Expression**: `0 4 * * 0`

**Retention Policy**:
- Normal snapshots: 90 days
- Rolled back snapshots: 180 days

---

## Security

All cron job endpoints are protected by a `CRON_SECRET` environment variable. Requests must include the secret in the Authorization header:

```
Authorization: Bearer <CRON_SECRET>
```

Unauthorized requests are logged and rejected with a 401 status code.

---

## Environment Variables

### Required

- `CRON_SECRET`: Secret token for authenticating cron job requests

### Optional

- `DATABASE_URL`: PostgreSQL connection string (required for database operations)
- `UPSTASH_REDIS_REST_URL`: Redis URL (if using Redis for caching)
- `UPSTASH_REDIS_REST_TOKEN`: Redis token (if using Redis for caching)

---

## Monitoring

All cleanup jobs log their execution:

- **Start**: Job name and timestamp
- **Success**: Records deleted count
- **Error**: Error message and context
- **Unauthorized**: IP address and timestamp

Logs can be viewed in:
- Vercel Dashboard → Logs
- Application logs (if using external logging service)

---

## Manual Execution

### Test All Cleanup Jobs

```bash
npx tsx scripts/test-data-cleanup.ts
```

This script runs all cleanup jobs and reports:
- Records deleted per job
- Total execution time
- Any errors encountered
- Retention policies
- Cron schedules

### Test Individual Jobs

You can test individual cleanup jobs by calling the service methods directly:

```typescript
import { DataCleanupService } from '@/lib/services/data-cleanup';

// Test price history cleanup
const result = await DataCleanupService.cleanupOldPriceHistory();
console.log(`Deleted ${result.deleted} records`);

// Test all jobs
const results = await DataCleanupService.runAllCleanupJobs();
console.log(results);
```

---

## Vercel Cron Configuration

The cron jobs are configured in `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/v1/cron/cleanup-notifications",
      "schedule": "0 1 * * *"
    },
    {
      "path": "/api/v1/cron/cleanup-sync-logs",
      "schedule": "30 1 * * *"
    },
    {
      "path": "/api/v1/cron/cleanup-price-history",
      "schedule": "0 2 * * *"
    },
    {
      "path": "/api/v1/cron/cleanup-sessions",
      "schedule": "0 2 * * *"
    },
    {
      "path": "/api/v1/cron/cleanup-price-update-logs",
      "schedule": "30 2 * * *"
    },
    {
      "path": "/api/v1/cron/cleanup-audit-logs",
      "schedule": "0 3 1 * *"
    },
    {
      "path": "/api/v1/cron/cleanup-scraping-metrics",
      "schedule": "0 4 * * *"
    },
    {
      "path": "/api/v1/cron/cleanup-bulk-snapshots",
      "schedule": "0 4 * * 0"
    }
  ]
}
```

---

## Cron Expression Reference

| Expression | Description |
|------------|-------------|
| `0 1 * * *` | Daily at 1:00 AM UTC |
| `30 1 * * *` | Daily at 1:30 AM UTC |
| `0 2 * * *` | Daily at 2:00 AM UTC |
| `30 2 * * *` | Daily at 2:30 AM UTC |
| `0 3 1 * *` | Monthly on 1st at 3:00 AM UTC |
| `0 4 * * *` | Daily at 4:00 AM UTC |
| `0 4 * * 0` | Weekly on Sundays at 4:00 AM UTC |

---

## Performance Impact

Cleanup jobs are scheduled during low-traffic hours (1:00 AM - 4:00 AM UTC) to minimize impact on production systems.

**Expected Performance**:
- Small databases (<10k records): <1 second per job
- Medium databases (10k-100k records): 1-5 seconds per job
- Large databases (>100k records): 5-30 seconds per job

**Database Load**:
- Cleanup operations use `DELETE` queries with date filters
- Indexes on date columns ensure efficient deletion
- Jobs run sequentially to avoid database contention

---

## Troubleshooting

### Job Not Running

1. **Check Vercel Cron Configuration**:
   - Verify `vercel.json` is deployed
   - Check Vercel Dashboard → Cron Jobs

2. **Check CRON_SECRET**:
   - Verify environment variable is set
   - Check secret matches in request

3. **Check Logs**:
   - Vercel Dashboard → Logs
   - Look for cron job execution logs

### Job Failing

1. **Check Database Connection**:
   - Verify `DATABASE_URL` is correct
   - Test database connectivity

2. **Check Permissions**:
   - Verify database user has DELETE permissions
   - Check table access

3. **Check Logs**:
   - Look for error messages
   - Check stack traces

### Too Many Records Deleted

1. **Review Retention Policies**:
   - Verify cutoff dates are correct
   - Check if policies match requirements

2. **Test Before Production**:
   - Run `test-data-cleanup.ts` on staging
   - Review deletion counts

3. **Implement Archival**:
   - Archive data before deletion
   - Keep backups of critical data

---

## Best Practices

### 1. Test Before Production

Always test cleanup jobs on staging environment before enabling in production:

```bash
# On staging
npx tsx scripts/test-data-cleanup.ts
```

### 2. Monitor Execution

Set up monitoring for cleanup jobs:
- Track execution time
- Alert on failures
- Monitor deletion counts

### 3. Implement Archival

For critical data, implement archival before deletion:
- Price history → Archive table
- Audit logs → Archive table
- Bulk snapshots → Archive storage

### 4. Regular Backups

Maintain regular database backups:
- Daily full backups
- Hourly incremental backups
- 30-day retention

### 5. Review Retention Policies

Regularly review and update retention policies:
- Quarterly policy review
- Compliance requirement changes
- Business need changes

---

## Compliance

### GDPR

Cleanup jobs support GDPR compliance:
- **Right to Erasure**: Automated deletion of old data
- **Data Minimization**: Only retain necessary data
- **Storage Limitation**: Defined retention periods

### SOC 2

Cleanup jobs support SOC 2 compliance:
- **Audit Trail**: 2-year audit log retention
- **Security Events**: 5-year critical event retention
- **Monitoring**: Comprehensive logging

### Industry Standards

Retention periods follow industry best practices:
- Financial data: 7 years (not applicable)
- Audit logs: 2-5 years
- Operational data: 30-365 days
- Temporary data: 7-30 days

---

## Future Enhancements

### Planned Features

1. **Archival System**:
   - Automatic archival before deletion
   - Archive table creation
   - Archive access interface

2. **Configurable Retention**:
   - Per-tenant retention policies
   - Admin configuration UI
   - Policy override capability

3. **Cleanup Analytics**:
   - Deletion statistics dashboard
   - Storage savings metrics
   - Performance impact tracking

4. **Smart Cleanup**:
   - Adaptive retention based on usage
   - Predictive cleanup scheduling
   - Intelligent archival decisions

---

## Support

For issues or questions about data cleanup jobs:

1. **Check Documentation**: Review this guide and retention policies
2. **Check Logs**: Review Vercel logs for errors
3. **Test Locally**: Run test script to reproduce issues
4. **Contact Support**: Provide logs and error details

---

**Last Updated**: February 3, 2026  
**Version**: 1.0
