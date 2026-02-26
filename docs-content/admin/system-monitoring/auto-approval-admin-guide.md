---
title: "Auto Approval Admin Guide"
description: "Administrative guide for auto-approval system configuration"
category: "system-monitoring"
author: "PricePilot Team"
lastReviewed: "2024-05-20"
tags: ["auto-approval", "admin", "configuration"]
audience: "admin"
---

# Auto-Approval Rules - Administrator Guide

**Version:** 1.0  
**Last Updated:** January 2026  
**Audience:** System Administrators, DevOps Engineers

---

## Table of Contents

1. [Overview](#overview)
2. [System Architecture](#system-architecture)
3. [Deployment Setup](#deployment-setup)
4. [Environment Variables](#environment-variables)
5. [Cron Job Configuration](#cron-job-configuration)
6. [Monitoring & Alerting](#monitoring--alerting)
7. [Database Management](#database-management)
8. [Performance Tuning](#performance-tuning)
9. [Security Considerations](#security-considerations)
10. [Troubleshooting](#troubleshooting)
11. [Maintenance Procedures](#maintenance-procedures)

---

## Overview

The Auto-Approval Rules feature automates the price approval workflow by evaluating pending price changes against tenant-defined rules. This guide covers the technical setup, configuration, and maintenance required for system administrators.

### Key Components

- **Auto-Approval Service**: Core business logic for rule evaluation
- **Cron Job**: Scheduled processing of pending changes
- **Database**: PostgreSQL with Prisma ORM
- **API Endpoints**: RESTful API for rule management
- **Email Service**: Notification delivery system

### System Requirements

- Node.js 18+ or 20+
- PostgreSQL 14+
- Redis (optional, for caching)
- SMTP server for email notifications
- Vercel (or compatible platform) for cron jobs

---

## System Architecture

### Component Diagram

```
┌─────────────────────────────────────────────────────────┐
│                   Vercel Cron Job                        │
│              (Runs every hour: 0 * * * *)                │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│          /api/v1/cron/auto-approval                      │
│         (Authenticated with CRON_SECRET)                 │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│              AutoApprovalService                         │
│         (lib/services/auto-approval.ts)                  │
└────────────────────┬────────────────────────────────────┘
                     │
        ┌────────────┼────────────┐
        │            │            │
        ▼            ▼            ▼
┌──────────┐  ┌──────────┐  ┌──────────┐
│ Database │  │  Rules   │  │  Email   │
│  Prisma  │  │  Engine  │  │ Service  │
└──────────┘  └──────────┘  └──────────┘

```

### Data Flow

1. **Cron Trigger**: Vercel cron job triggers hourly
2. **Authentication**: CRON_SECRET validates the request
3. **Tenant Loading**: All tenants with enabled rules are loaded
4. **Rule Evaluation**: For each tenant:
   - Load enabled rules (ordered by priority)
   - Load PENDING price changes
   - Evaluate each change against rules
   - First matching rule triggers auto-approval
5. **Execution**: Auto-approved changes are:
   - Updated in database (status = APPROVED)
   - Pushed to user's store via API
   - Logged in audit trail
   - Recorded in price history
6. **Notification**: Email summary sent to users with notifications enabled

---

## Deployment Setup

### Prerequisites

1. **Database Migration**

Run the Prisma migration to add the AutoApprovalRule model:

```bash
npx prisma migrate deploy
```

This creates:
- `AutoApprovalRule` table
- Indexes for efficient querying
- Foreign key relationships
- Updates to `PendingPriceChange` table

2. **Environment Variables**

Ensure all required environment variables are set (see next section).

3. **Vercel Configuration**

The `vercel.json` file must include the cron job configuration:

```json
{
  "crons": [
    {
      "path": "/api/v1/cron/auto-approval",
      "schedule": "0 * * * *"
    }
  ]
}
```

### Deployment Steps

1. **Deploy to Vercel**

```bash
vercel --prod
```

2. **Verify Cron Job**

Check Vercel dashboard:
- Go to Project → Settings → Cron Jobs
- Verify "auto-approval" job is listed
- Check schedule: "0 * * * *" (every hour)

3. **Test Cron Endpoint**

```bash
curl -X GET https://your-domain.com/api/v1/cron/auto-approval \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

Expected response:
```json
{
  "success": true,
  "data": {
    "tenantsProcessed": 5,
    "totalAutoApprovals": 12
  }
}
```

---

## Environment Variables

### Required Variables


#### 1. CRON_SECRET

**Purpose**: Authenticates cron job requests to prevent unauthorized access.

**Format**: Secure random string (minimum 32 characters)

**Generation**:
```bash
# Option 1: OpenSSL
openssl rand -base64 32

# Option 2: Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"

# Option 3: Python
python -c "import secrets; print(secrets.token_urlsafe(32))"
```

**Configuration**:
```bash
# .env or Vercel Environment Variables
CRON_SECRET=your-secure-random-string-here
```

**Security Notes**:
- Never commit to version control
- Rotate periodically (every 90 days recommended)
- Use different secrets for staging and production
- Store securely in environment variable management system

#### 2. DATABASE_URL

**Purpose**: PostgreSQL connection string for Prisma.

**Format**:
```
postgresql://USER:PASSWORD@HOST:PORT/DATABASE?schema=public
```

**Example**:
```bash
DATABASE_URL="postgresql://pricepilot:secure_password@db.example.com:5432/pricepilot_prod?schema=public"
```

#### 3. Email Configuration

**Purpose**: SMTP settings for sending auto-approval notifications.

**Required Variables**:
```bash
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=noreply@pricepilot.com
SMTP_PASS=secure_smtp_password
SMTP_FROM=noreply@pricepilot.com
```

**Supported Providers**:
- SendGrid
- AWS SES
- Mailgun
- Postmark
- Custom SMTP server

### Optional Variables

#### 1. AUTO_APPROVAL_BATCH_SIZE

**Purpose**: Number of pending changes to process per batch.

**Default**: 100

**Configuration**:
```bash
AUTO_APPROVAL_BATCH_SIZE=100
```

**Tuning**:
- Increase for better performance (up to 500)
- Decrease if experiencing memory issues (down to 50)

#### 2. AUTO_APPROVAL_TIMEOUT

**Purpose**: Maximum execution time for auto-approval processing (milliseconds).

**Default**: 300000 (5 minutes)

**Configuration**:
```bash
AUTO_APPROVAL_TIMEOUT=300000
```

#### 3. LOG_LEVEL

**Purpose**: Logging verbosity for auto-approval operations.

**Options**: `error`, `warn`, `info`, `debug`

**Default**: `info`

**Configuration**:
```bash
LOG_LEVEL=info
```

---

## Cron Job Configuration

### Vercel Cron Jobs

#### Configuration File

The `vercel.json` file defines the cron schedule:

```json
{
  "crons": [
    {
      "path": "/api/v1/cron/auto-approval",
      "schedule": "0 * * * *"
    }
  ]
}
```

#### Schedule Format

Uses standard cron syntax: `minute hour day month weekday`

**Examples**:

```
0 * * * *     - Every hour at minute 0
*/30 * * * *  - Every 30 minutes
0 */2 * * *   - Every 2 hours
0 0 * * *     - Daily at midnight
0 9-17 * * *  - Every hour from 9 AM to 5 PM
```

**Recommended Schedule**: `0 * * * *` (hourly)

**Considerations**:
- More frequent = faster response to price changes
- Less frequent = lower resource usage
- Balance based on business needs

#### Monitoring Cron Execution

**Vercel Dashboard**:
1. Go to Project → Deployments
2. Click on latest deployment
3. View "Functions" tab
4. Check cron execution logs

**Logs to Monitor**:
- Execution start/end times
- Number of tenants processed
- Number of auto-approvals
- Any errors or failures

### Alternative Platforms

#### AWS Lambda + EventBridge

```yaml
# serverless.yml
functions:
  autoApproval:
    handler: api/v1/cron/auto-approval.handler
    events:
      - schedule: rate(1 hour)
    environment:
      CRON_SECRET: ${env:CRON_SECRET}
```

#### Google Cloud Scheduler

```bash
gcloud scheduler jobs create http auto-approval \
  --schedule="0 * * * *" \
  --uri="https://your-domain.com/api/v1/cron/auto-approval" \
  --http-method=GET \
  --headers="Authorization=Bearer ${CRON_SECRET}"
```

#### Self-Hosted Cron

```bash
# /etc/crontab
0 * * * * curl -X GET https://your-domain.com/api/v1/cron/auto-approval \
  -H "Authorization: Bearer ${CRON_SECRET}" >> /var/log/auto-approval.log 2>&1
```

---

## Monitoring & Alerting

### Key Metrics to Track


#### 1. Execution Metrics

- **Cron Job Success Rate**: Percentage of successful executions
- **Processing Time**: Average time to process all tenants
- **Tenants Processed**: Number of tenants processed per run
- **Auto-Approvals Count**: Total changes auto-approved per run

#### 2. Performance Metrics

- **Rule Evaluation Time**: Average time to evaluate rules (p50, p95, p99)
- **Database Query Time**: Time spent on database operations
- **Store API Response Time**: Time for store updates
- **Email Delivery Time**: Time to send notifications

#### 3. Error Metrics

- **Failed Executions**: Count of cron job failures
- **Store Update Failures**: Count of failed store API calls
- **Email Delivery Failures**: Count of failed email sends
- **Database Errors**: Count of database operation failures

### Logging Strategy

#### Log Levels

**ERROR**: Critical failures requiring immediate attention
```
- Cron job authentication failure
- Database connection failure
- Unhandled exceptions
```

**WARN**: Issues that don't stop execution but need attention
```
- Store API update failure (with rollback)
- Email delivery failure
- Tenant processing timeout
```

**INFO**: Normal operational events
```
- Cron job start/end
- Tenants processed count
- Auto-approvals count
- Rule evaluation results
```

**DEBUG**: Detailed information for troubleshooting
```
- Individual rule evaluation
- Database query details
- API request/response details
```

#### Log Format

```json
{
  "timestamp": "2026-01-15T10:00:00.000Z",
  "level": "INFO",
  "service": "auto-approval",
  "event": "cron_execution_complete",
  "data": {
    "tenantsProcessed": 5,
    "totalAutoApprovals": 12,
    "executionTimeMs": 2500,
    "errors": []
  }
}
```

### Alerting Rules

#### Critical Alerts (Immediate Response)

**1. Cron Job Failure**
- **Condition**: Cron job fails to execute
- **Threshold**: 2 consecutive failures
- **Action**: Page on-call engineer
- **Channels**: PagerDuty, SMS, Email

**2. Database Connection Failure**
- **Condition**: Cannot connect to database
- **Threshold**: 1 failure
- **Action**: Page on-call engineer
- **Channels**: PagerDuty, SMS, Email

**3. High Error Rate**
- **Condition**: Error rate > 50%
- **Threshold**: 3 consecutive runs
- **Action**: Alert engineering team
- **Channels**: Slack, Email

#### Warning Alerts (Review Within 24 Hours)

**1. Store Update Failure Rate**
- **Condition**: Store update failures > 10%
- **Threshold**: 5 consecutive runs
- **Action**: Notify engineering team
- **Channels**: Slack, Email

**2. Email Delivery Failure Rate**
- **Condition**: Email failures > 20%
- **Threshold**: 3 consecutive runs
- **Action**: Notify engineering team
- **Channels**: Slack, Email

**3. Processing Time Increase**
- **Condition**: Processing time > 5 minutes
- **Threshold**: 3 consecutive runs
- **Action**: Notify engineering team
- **Channels**: Slack

#### Info Alerts (Monitoring Only)

**1. New Rule Created**
- **Condition**: Tenant creates new rule
- **Action**: Log for analytics
- **Channels**: Analytics dashboard

**2. Rule Disabled**
- **Condition**: Tenant disables rule
- **Action**: Log for analytics
- **Channels**: Analytics dashboard

### Monitoring Tools

#### Recommended Stack

**1. Application Monitoring**
- **Tool**: Datadog, New Relic, or Sentry
- **Purpose**: Track errors, performance, and metrics
- **Setup**: Install SDK and configure environment

**2. Log Aggregation**
- **Tool**: Logtail, Papertrail, or CloudWatch Logs
- **Purpose**: Centralized log storage and search
- **Setup**: Configure log shipping from Vercel

**3. Uptime Monitoring**
- **Tool**: UptimeRobot, Pingdom, or StatusCake
- **Purpose**: Monitor cron endpoint availability
- **Setup**: Create HTTP monitor for cron endpoint

**4. Database Monitoring**
- **Tool**: pganalyze, Datadog, or native PostgreSQL monitoring
- **Purpose**: Track query performance and database health
- **Setup**: Connect to PostgreSQL instance

#### Dashboard Setup

**Key Widgets**:
1. Cron job success rate (last 24 hours)
2. Auto-approvals count (last 7 days)
3. Processing time trend (last 30 days)
4. Error rate by type (last 24 hours)
5. Top 5 most triggered rules
6. Store update failure rate
7. Email delivery success rate

---

## Database Management

### Schema Overview

#### AutoApprovalRule Table

```sql
CREATE TABLE "AutoApprovalRule" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "priority" INTEGER NOT NULL DEFAULT 1,
  "conditions" JSONB NOT NULL,
  "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP NOT NULL,
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE
);

CREATE INDEX "AutoApprovalRule_tenantId_enabled_priority_idx" 
  ON "AutoApprovalRule"("tenantId", "enabled", "priority");
CREATE INDEX "AutoApprovalRule_tenantId_idx" 
  ON "AutoApprovalRule"("tenantId");
```

#### PendingPriceChange Updates

```sql
ALTER TABLE "PendingPriceChange" 
  ADD COLUMN "autoApprovedBy" TEXT,
  ADD COLUMN "autoApprovedAt" TIMESTAMP;
```

### Indexes

**Purpose**: Optimize query performance for rule evaluation.

**Key Indexes**:
1. `(tenantId, enabled, priority)` - Rule loading
2. `(tenantId)` - Tenant isolation
3. `(autoApprovedBy)` - Metrics queries

**Monitoring**:
```sql
-- Check index usage
SELECT 
  schemaname,
  tablename,
  indexname,
  idx_scan,
  idx_tup_read,
  idx_tup_fetch
FROM pg_stat_user_indexes
WHERE tablename = 'AutoApprovalRule';
```

### Backup Strategy

**Frequency**: Daily automated backups

**Retention**: 
- Daily backups: 7 days
- Weekly backups: 4 weeks
- Monthly backups: 12 months

**Backup Command**:
```bash
pg_dump -h localhost -U pricepilot -d pricepilot_prod \
  -t AutoApprovalRule \
  -t PendingPriceChange \
  > auto_approval_backup_$(date +%Y%m%d).sql
```

**Restore Command**:
```bash
psql -h localhost -U pricepilot -d pricepilot_prod \
  < auto_approval_backup_20260115.sql
```

### Data Retention

**Auto-Approval Audit Logs**:
- Retention: 1 year
- Archive: After 1 year, move to cold storage
- Cleanup: Automated monthly job

**Cleanup Script**:
```sql
-- Archive audit logs older than 1 year
DELETE FROM "TenantAuditLog"
WHERE action = 'AUTO_APPROVE_PRICE'
  AND "createdAt" < NOW() - INTERVAL '1 year';
```

---

## Performance Tuning


### Database Optimization

#### 1. Connection Pooling

**Configuration**:
```bash
# .env
DATABASE_URL="postgresql://user:pass@host:5432/db?schema=public&connection_limit=10&pool_timeout=20"
```

**Recommended Settings**:
- Connection limit: 10-20 per instance
- Pool timeout: 20 seconds
- Idle timeout: 30 seconds

#### 2. Query Optimization

**Use Prisma's Query Optimization**:
```typescript
// Load rules with single query
const rules = await prisma.autoApprovalRule.findMany({
  where: { tenantId, enabled: true },
  orderBy: { priority: 'asc' },
  select: {
    id: true,
    name: true,
    priority: true,
    conditions: true
  }
});
```

**Avoid N+1 Queries**:
```typescript
// Good: Load with includes
const changes = await prisma.pendingPriceChange.findMany({
  where: { tenantId, status: 'PENDING' },
  include: {
    product: {
      include: {
        matchesAsUser: {
          include: { competitorProduct: true }
        }
      }
    }
  }
});

// Bad: Separate queries for each change
for (const change of changes) {
  const product = await prisma.product.findUnique({ where: { id: change.productId } });
}
```

#### 3. Batch Processing

**Process in Batches**:
```typescript
const BATCH_SIZE = 100;

for (let i = 0; i < pendingChanges.length; i += BATCH_SIZE) {
  const batch = pendingChanges.slice(i, i + BATCH_SIZE);
  await processBatch(batch, rules);
}
```

**Benefits**:
- Reduced memory usage
- Better error isolation
- Improved progress tracking

### Caching Strategy

#### 1. Rule Caching

**Cache rules per tenant**:
```typescript
const ruleCache = new Map<string, AutoApprovalRule[]>();

async function getRulesForTenant(tenantId: string) {
  if (!ruleCache.has(tenantId)) {
    const rules = await loadRules(tenantId);
    ruleCache.set(tenantId, rules);
  }
  return ruleCache.get(tenantId)!;
}
```

**Cache Invalidation**:
- On rule create/update/delete
- On cron job start (clear all)
- TTL: 1 hour

#### 2. Redis Caching (Optional)

**Configuration**:
```bash
REDIS_URL=redis://localhost:6379
```

**Usage**:
```typescript
import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.REDIS_URL!,
  token: process.env.REDIS_TOKEN!
});

// Cache rules
await redis.set(`rules:${tenantId}`, JSON.stringify(rules), { ex: 3600 });

// Get cached rules
const cached = await redis.get(`rules:${tenantId}`);
```

### Concurrency Control

#### 1. Prevent Duplicate Processing

**Use Database Locks**:
```typescript
await prisma.$transaction(async (tx) => {
  const change = await tx.pendingPriceChange.findUnique({
    where: { id: changeId },
    select: { status: true }
  });

  if (change?.status !== 'PENDING') {
    return; // Already processed
  }

  // Process auto-approval
  await tx.pendingPriceChange.update({
    where: { id: changeId },
    data: { status: 'APPROVED', autoApprovedBy: ruleId }
  });
});
```

#### 2. Parallel Tenant Processing

**Process tenants in parallel**:
```typescript
const tenants = await loadTenants();

await Promise.allSettled(
  tenants.map(tenant => 
    processAutoApprovals(tenant.id)
      .catch(err => logger.error('Tenant processing failed', { tenantId: tenant.id, err }))
  )
);
```

**Benefits**:
- Faster overall execution
- Error isolation per tenant
- Better resource utilization

### Resource Limits

#### 1. Memory Management

**Monitor Memory Usage**:
```typescript
const used = process.memoryUsage();
logger.info('Memory usage', {
  heapUsed: Math.round(used.heapUsed / 1024 / 1024) + ' MB',
  heapTotal: Math.round(used.heapTotal / 1024 / 1024) + ' MB'
});
```

**Limits**:
- Vercel Function: 1024 MB (Pro plan)
- Recommended: Keep under 512 MB
- Alert threshold: 768 MB

#### 2. Execution Time

**Timeout Configuration**:
```typescript
const TIMEOUT = 300000; // 5 minutes

const timeoutPromise = new Promise((_, reject) => 
  setTimeout(() => reject(new Error('Timeout')), TIMEOUT)
);

await Promise.race([
  processAutoApprovals(tenantId),
  timeoutPromise
]);
```

**Limits**:
- Vercel Function: 300 seconds (Pro plan)
- Recommended: Complete within 240 seconds
- Alert threshold: 270 seconds

---

## Security Considerations

### Authentication & Authorization

#### 1. Cron Secret Validation

**Implementation**:
```typescript
const cronSecret = req.headers.get('authorization')?.replace('Bearer ', '');

if (cronSecret !== process.env.CRON_SECRET) {
  return NextResponse.json(
    { success: false, error: 'Unauthorized' },
    { status: 401 }
  );
}
```

**Best Practices**:
- Use strong random secrets (32+ characters)
- Rotate secrets every 90 days
- Never log the secret
- Use different secrets per environment

#### 2. Tenant Isolation

**Enforce at Database Level**:
```typescript
// Always filter by tenantId
const rules = await prisma.autoApprovalRule.findMany({
  where: { tenantId: session.user.tenantId }
});
```

**Validation**:
```typescript
// Verify rule belongs to tenant before update
const rule = await prisma.autoApprovalRule.findUnique({
  where: { id: ruleId }
});

if (rule.tenantId !== session.user.tenantId) {
  throw new Error('Forbidden');
}
```

### Data Protection

#### 1. Sensitive Data Handling

**Never Log**:
- API tokens
- Store credentials
- User passwords
- CRON_SECRET

**Encryption**:
- API tokens encrypted at rest (AES-256)
- Database connections use TLS
- HTTPS for all API calls

#### 2. Audit Trail

**Log All Actions**:
```typescript
await prisma.tenantAuditLog.create({
  data: {
    tenantId,
    userId: 'system',
    action: 'AUTO_APPROVE_PRICE',
    entityType: 'PendingPriceChange',
    entityId: change.id,
    details: JSON.stringify({
      ruleId: rule.id,
      ruleName: rule.name,
      oldPrice: change.currentPrice,
      newPrice: change.recommendedPrice
    })
  }
});
```

### Rate Limiting

#### 1. API Endpoints

**Configuration**:
```typescript
import { Ratelimit } from '@upstash/ratelimit';

const ratelimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(100, '1 h')
});

const { success } = await ratelimit.limit(tenantId);
if (!success) {
  return NextResponse.json(
    { error: 'Rate limit exceeded' },
    { status: 429 }
  );
}
```

**Limits**:
- Rule management: 100 requests/hour per tenant
- Metrics endpoint: 1000 requests/hour per tenant
- Cron endpoint: No limit (internal only)

#### 2. Store API Calls

**Throttling**:
```typescript
// Delay between store API calls
const DELAY_MS = 100;

for (const change of changes) {
  await updateStore(change);
  await new Promise(resolve => setTimeout(resolve, DELAY_MS));
}
```

---

## Troubleshooting


### Common Issues

#### 1. Cron Job Not Running

**Symptoms**:
- No auto-approvals happening
- No logs in Vercel dashboard
- Metrics show 0 executions

**Diagnosis**:
```bash
# Check Vercel cron configuration
vercel crons ls

# Test cron endpoint manually
curl -X GET https://your-domain.com/api/v1/cron/auto-approval \
  -H "Authorization: Bearer ${CRON_SECRET}"
```

**Solutions**:
1. Verify `vercel.json` has cron configuration
2. Redeploy to Vercel: `vercel --prod`
3. Check CRON_SECRET is set in environment variables
4. Verify cron job is enabled in Vercel dashboard

#### 2. Rules Not Matching

**Symptoms**:
- Changes stay PENDING
- Metrics show 0 auto-approvals
- Audit logs show no rule evaluations

**Diagnosis**:
```typescript
// Add debug logging
logger.debug('Evaluating rule', {
  ruleId: rule.id,
  ruleName: rule.name,
  conditions: rule.conditions,
  change: {
    currentPrice: change.currentPrice,
    recommendedPrice: change.recommendedPrice,
    priceChange: Math.abs(change.recommendedPrice - change.currentPrice)
  }
});
```

**Solutions**:
1. Check rule conditions are correct
2. Verify rule is enabled
3. Check priority order (lower = higher priority)
4. Review condition logic (all must match)
5. Test with simpler conditions first

#### 3. Store Update Failures

**Symptoms**:
- Changes auto-approved but not updated in store
- Audit logs show "Store update failed"
- Status reverts to PENDING

**Diagnosis**:
```bash
# Check store API connectivity
curl -X GET https://user-store.com/api/pricepilot/health \
  -H "X-PricePilot-Token: ${API_TOKEN}"

# Check store API logs
tail -f /var/log/store-api.log
```

**Solutions**:
1. Verify store API token is valid
2. Check store is accessible from Vercel
3. Review store API error logs
4. Test store API manually
5. Check rate limiting on store API

#### 4. Email Delivery Failures

**Symptoms**:
- No notification emails received
- Logs show "Email send failed"
- SMTP errors in logs

**Diagnosis**:
```bash
# Test SMTP connection
telnet smtp.example.com 587

# Check SMTP credentials
echo "SMTP_HOST: $SMTP_HOST"
echo "SMTP_PORT: $SMTP_PORT"
echo "SMTP_USER: $SMTP_USER"
```

**Solutions**:
1. Verify SMTP credentials are correct
2. Check SMTP server is accessible
3. Review SMTP provider logs
4. Test with different SMTP provider
5. Check email address format

#### 5. High Memory Usage

**Symptoms**:
- Function crashes with OOM error
- Slow processing times
- Vercel function timeout

**Diagnosis**:
```typescript
// Monitor memory usage
const used = process.memoryUsage();
logger.info('Memory usage', {
  heapUsed: Math.round(used.heapUsed / 1024 / 1024) + ' MB',
  heapTotal: Math.round(used.heapTotal / 1024 / 1024) + ' MB',
  external: Math.round(used.external / 1024 / 1024) + ' MB'
});
```

**Solutions**:
1. Reduce batch size (AUTO_APPROVAL_BATCH_SIZE)
2. Process fewer tenants per run
3. Clear caches more frequently
4. Upgrade Vercel plan for more memory
5. Optimize database queries

#### 6. Database Connection Errors

**Symptoms**:
- "Too many connections" error
- "Connection timeout" error
- Slow query performance

**Diagnosis**:
```sql
-- Check active connections
SELECT count(*) FROM pg_stat_activity;

-- Check connection limits
SHOW max_connections;

-- Check slow queries
SELECT query, state, wait_event_type, wait_event
FROM pg_stat_activity
WHERE state != 'idle'
  AND query NOT LIKE '%pg_stat_activity%';
```

**Solutions**:
1. Reduce connection pool size
2. Close connections properly
3. Use connection pooling (PgBouncer)
4. Upgrade database plan
5. Optimize slow queries

### Debug Mode

**Enable Debug Logging**:
```bash
# .env
LOG_LEVEL=debug
```

**Debug Output**:
```
[DEBUG] Loading rules for tenant: abc123
[DEBUG] Found 3 enabled rules
[DEBUG] Evaluating rule: Small Price Changes (priority: 1)
[DEBUG] Condition check: maxPriceChange=20, actual=15 ✓
[DEBUG] Condition check: minConfidenceScore=85, actual=90 ✓
[DEBUG] Rule matched! Auto-approving change: xyz789
[DEBUG] Updating store via API...
[DEBUG] Store update successful
[DEBUG] Creating audit log entry...
[DEBUG] Sending email notification...
```

### Health Checks

**Endpoint**: `/api/v1/health`

**Response**:
```json
{
  "status": "healthy",
  "checks": {
    "database": "ok",
    "redis": "ok",
    "smtp": "ok"
  },
  "timestamp": "2026-01-15T10:00:00.000Z"
}
```

**Monitoring**:
```bash
# Check health every 5 minutes
*/5 * * * * curl -f https://your-domain.com/api/v1/health || alert
```

---

## Maintenance Procedures

### Routine Maintenance

#### Daily Tasks

1. **Review Logs**
   - Check for errors or warnings
   - Review auto-approval counts
   - Monitor processing times

2. **Check Metrics**
   - Verify cron job executed successfully
   - Review auto-approval rates
   - Check store update success rates

#### Weekly Tasks

1. **Performance Review**
   - Analyze processing time trends
   - Review database query performance
   - Check memory usage patterns

2. **Security Audit**
   - Review audit logs for anomalies
   - Check for unauthorized access attempts
   - Verify CRON_SECRET hasn't been exposed

#### Monthly Tasks

1. **Database Maintenance**
   - Run VACUUM ANALYZE on tables
   - Review and optimize indexes
   - Archive old audit logs

2. **Capacity Planning**
   - Review tenant growth
   - Estimate future resource needs
   - Plan for scaling

### Emergency Procedures

#### Disable Auto-Approval Globally

**Option 1: Disable Cron Job**
```bash
# Remove cron from vercel.json temporarily
# Redeploy
vercel --prod
```

**Option 2: Disable All Rules via SQL**
```sql
UPDATE "AutoApprovalRule"
SET enabled = false
WHERE enabled = true;
```

**Option 3: Block Cron Endpoint**
```typescript
// Add to cron endpoint
if (process.env.AUTO_APPROVAL_DISABLED === 'true') {
  return NextResponse.json({ 
    success: false, 
    error: 'Auto-approval temporarily disabled' 
  });
}
```

#### Rollback Procedure

**1. Identify Affected Changes**
```sql
SELECT * FROM "PendingPriceChange"
WHERE "autoApprovedAt" > '2026-01-15 10:00:00'
  AND status = 'APPROVED';
```

**2. Revert to PENDING**
```sql
UPDATE "PendingPriceChange"
SET status = 'PENDING',
    "autoApprovedBy" = NULL,
    "autoApprovedAt" = NULL
WHERE "autoApprovedAt" > '2026-01-15 10:00:00'
  AND status = 'APPROVED';
```

**3. Notify Affected Tenants**
```typescript
// Send email to affected tenants
await sendEmail({
  to: tenant.email,
  subject: 'Auto-Approval Rollback Notice',
  body: 'Some auto-approved changes have been reverted...'
});
```

### Upgrade Procedures

#### Database Migration

**1. Backup Database**
```bash
pg_dump -h localhost -U pricepilot -d pricepilot_prod > backup_pre_upgrade.sql
```

**2. Run Migration**
```bash
npx prisma migrate deploy
```

**3. Verify Migration**
```sql
-- Check new columns exist
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'AutoApprovalRule';
```

**4. Test Functionality**
```bash
# Run test suite
npm test

# Test cron endpoint
curl -X GET https://staging.your-domain.com/api/v1/cron/auto-approval \
  -H "Authorization: Bearer ${CRON_SECRET}"
```

#### Code Deployment

**1. Deploy to Staging**
```bash
vercel --env=staging
```

**2. Run Smoke Tests**
```bash
npm run test:e2e
```

**3. Deploy to Production**
```bash
vercel --prod
```

**4. Monitor Deployment**
- Watch error rates
- Check processing times
- Verify auto-approvals working

---

## Appendix

### Useful SQL Queries

#### Auto-Approval Statistics

```sql
-- Auto-approval rate by tenant
SELECT 
  t.name AS tenant_name,
  COUNT(*) FILTER (WHERE pc."autoApprovedBy" IS NOT NULL) AS auto_approved,
  COUNT(*) AS total_changes,
  ROUND(
    COUNT(*) FILTER (WHERE pc."autoApprovedBy" IS NOT NULL)::numeric / 
    NULLIF(COUNT(*), 0) * 100, 
    2
  ) AS approval_rate
FROM "PendingPriceChange" pc
JOIN "Tenant" t ON pc."tenantId" = t.id
WHERE pc."createdAt" > NOW() - INTERVAL '30 days'
GROUP BY t.id, t.name
ORDER BY approval_rate DESC;
```

#### Top Rules by Trigger Count

```sql
-- Most frequently triggered rules
SELECT 
  ar.name AS rule_name,
  COUNT(pc.id) AS trigger_count,
  t.name AS tenant_name
FROM "AutoApprovalRule" ar
JOIN "PendingPriceChange" pc ON pc."autoApprovedBy" = ar.id
JOIN "Tenant" t ON ar."tenantId" = t.id
WHERE pc."autoApprovedAt" > NOW() - INTERVAL '30 days'
GROUP BY ar.id, ar.name, t.name
ORDER BY trigger_count DESC
LIMIT 10;
```

#### Failed Store Updates

```sql
-- Changes that failed to update store
SELECT 
  pc.id,
  pc."productId",
  pc."currentPrice",
  pc."recommendedPrice",
  pc."autoApprovedAt",
  tal.details
FROM "PendingPriceChange" pc
JOIN "TenantAuditLog" tal ON tal."entityId" = pc.id
WHERE pc.status = 'PENDING'
  AND pc."autoApprovedBy" IS NOT NULL
  AND tal.action = 'AUTO_APPROVE_PRICE'
  AND tal.details::jsonb->>'error' IS NOT NULL;
```

### Environment Variable Checklist

```bash
# Required
✓ CRON_SECRET
✓ DATABASE_URL
✓ SMTP_HOST
✓ SMTP_PORT
✓ SMTP_USER
✓ SMTP_PASS
✓ SMTP_FROM

# Optional
○ AUTO_APPROVAL_BATCH_SIZE
○ AUTO_APPROVAL_TIMEOUT
○ LOG_LEVEL
○ REDIS_URL
○ REDIS_TOKEN
```

### Support Contacts

**Engineering Team**: engineering@pricepilot.com  
**DevOps Team**: devops@pricepilot.com  
**On-Call**: +1-555-0100 (PagerDuty)

---

**Document Version**: 1.0  
**Last Updated**: January 2026  
**Next Review**: April 2026
