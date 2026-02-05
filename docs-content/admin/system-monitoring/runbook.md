---
title: "Operations Runbook"
description: "Operational procedures and runbook"
category: "system-monitoring"
tags: ["operations", "runbook", "procedures"]
audience: "admin"
---

# PricePilot Operations Runbook

**Version**: 1.5  
**Last Updated**: February 3, 2026

## Overview

This runbook provides step-by-step procedures for common operational tasks, incident response, and system maintenance for PricePilot.

## Table of Contents

1. [Daily Operations](#daily-operations)
2. [Monitoring & Alerts](#monitoring--alerts)
3. [Incident Response](#incident-response)
4. [Database Operations](#database-operations)
5. [Cache Operations](#cache-operations)
6. [User Management](#user-management)
7. [Data Management](#data-management)
8. [Performance Tuning](#performance-tuning)
9. [Security Operations](#security-operations)
10. [Backup & Recovery](#backup--recovery)

---

## Daily Operations

### Morning Health Check

**Frequency**: Daily at 9:00 AM  
**Duration**: 5-10 minutes  
**Owner**: DevOps Team

#### Procedure

1. **Check System Health**
   ```bash
   # Access admin dashboard
   https://your-domain.com/admin/monitoring
   
   # Or use API
   curl https://your-domain.com/api/v1/admin/health
   ```

2. **Review Key Metrics**
   - Active sessions: Should be > 0 during business hours
   - Error rate: Should be < 1%
   - Response time (P95): Should be < 500ms
   - Database connections: Should be < 80% of pool size
   - Redis memory: Should be < 80% of limit

3. **Check Overnight Cron Jobs**
   ```bash
   # View cron execution logs
   vercel logs --since=24h | grep cron
   
   # Check specific cron job
   curl https://your-domain.com/api/v1/admin/cron-status
   ```

4. **Review Alerts**
   ```bash
   # Check unacknowledged alerts
   https://your-domain.com/admin/alerts?status=unacknowledged
   ```

5. **Check Email Queue**
   ```bash
   # View pending emails
   curl https://your-domain.com/api/v1/admin/email-queue
   ```

#### Expected Results

- All services: ✅ Healthy
- Error rate: < 1%
- All cron jobs: ✅ Completed
- No critical alerts
- Email queue: < 100 pending

#### Escalation

If any check fails:
1. Review detailed logs
2. Check #ops-alerts Slack channel
3. Follow incident response procedures
4. Escalate to on-call engineer if critical

---

### Weekly Maintenance

**Frequency**: Every Sunday at 2:00 AM  
**Duration**: 30-60 minutes  
**Owner**: DevOps Team

#### Procedure

1. **Database Maintenance**
   ```bash
   # Run VACUUM ANALYZE
   npm run db:vacuum
   
   # Update statistics
   npm run db:analyze
   
   # Check for bloat
   npm run db:check-bloat
   ```

2. **Cache Cleanup**
   ```bash
   # Clear expired cache entries
   npm run cache:cleanup
   
   # Check cache hit rate
   npm run cache:stats
   ```

3. **Log Rotation**
   ```bash
   # Archive old logs
   npm run logs:archive
   
   # Clean up old archives (> 90 days)
   npm run logs:cleanup
   ```

4. **Security Scan**
   ```bash
   # Run dependency audit
   npm audit
   
   # Check for outdated packages
   npm outdated
   
   # Run security scan
   npm run security:scan
   ```

5. **Performance Review**
   ```bash
   # Generate performance report
   npm run performance:report
   
   # Check slow queries
   npm run db:slow-queries
   ```

#### Expected Results

- Database: Optimized and healthy
- Cache: Clean and efficient
- Logs: Archived and rotated
- Security: No critical vulnerabilities
- Performance: Within acceptable ranges

---

## Monitoring & Alerts

### Alert Response Procedures

#### Critical Alerts

**Response Time**: Immediate (< 5 minutes)  
**Severity**: P0 - System Down

##### Database Connection Failure

**Symptoms**:
- "Can't reach database server" errors
- 500 errors on all endpoints
- Dashboard not loading

**Response**:
```bash
# 1. Check database status
psql $DATABASE_URL -c "SELECT 1"

# 2. Check connection pool
npm run db:pool-status

# 3. Restart application (if needed)
vercel redeploy --prod

# 4. Check database logs
npm run db:logs

# 5. Verify recovery
curl https://your-domain.com/api/health
```

**Escalation**: If not resolved in 15 minutes, page database admin

##### Redis Connection Failure

**Symptoms**:
- Rate limiting not working
- Cache misses at 100%
- Slow response times

**Response**:
```bash
# 1. Check Redis status
redis-cli ping
# or for Upstash
curl $UPSTASH_REDIS_REST_URL/ping \
  -H "Authorization: Bearer $UPSTASH_REDIS_REST_TOKEN"

# 2. Check Redis memory
redis-cli info memory

# 3. Restart Redis (if self-hosted)
sudo systemctl restart redis

# 4. Clear cache (if corrupted)
npm run cache:flush

# 5. Verify recovery
npm run verify:redis
```

**Escalation**: If not resolved in 10 minutes, page infrastructure team

##### High Error Rate (> 5%)

**Symptoms**:
- Error rate spike in monitoring
- Multiple user reports
- Sentry alert

**Response**:
```bash
# 1. Check error logs
vercel logs --follow | grep ERROR

# 2. Identify error pattern
npm run errors:analyze

# 3. Check recent deployments
vercel ls --prod

# 4. Rollback if needed
vercel promote <previous-deployment-url>

# 5. Verify recovery
npm run test:smoke
```

**Escalation**: If error rate doesn't decrease in 10 minutes, rollback immediately

#### Warning Alerts

**Response Time**: < 30 minutes  
**Severity**: P1 - Degraded Performance

##### High Response Time (P95 > 1s)

**Response**:
```bash
# 1. Check database performance
npm run db:slow-queries

# 2. Check cache hit rate
npm run cache:stats

# 3. Check active connections
npm run db:connections

# 4. Analyze slow endpoints
npm run performance:analyze

# 5. Optimize if needed
npm run db:optimize
```

##### Low Cache Hit Rate (< 50%)

**Response**:
```bash
# 1. Check cache configuration
npm run cache:config

# 2. Warm cache
npm run cache:warm

# 3. Check cache memory
redis-cli info memory

# 4. Adjust TTL if needed
npm run cache:adjust-ttl

# 5. Monitor improvement
npm run cache:monitor
```

##### Disk Space Warning (> 80%)

**Response**:
```bash
# 1. Check disk usage
df -h

# 2. Find large files
du -sh /* | sort -h

# 3. Clean up old logs
npm run logs:cleanup

# 4. Archive old data
npm run data:archive

# 5. Verify space freed
df -h
```

---

## Incident Response

### Incident Response Process

#### 1. Detection

**Sources**:
- Monitoring alerts
- User reports
- Error tracking (Sentry)
- Health check failures

#### 2. Assessment

**Questions to Answer**:
- What is the impact? (users affected, features down)
- What is the severity? (P0-P3)
- What is the root cause? (if known)
- Is this a known issue?

**Severity Levels**:
- **P0 (Critical)**: System down, data loss, security breach
- **P1 (High)**: Major feature broken, significant user impact
- **P2 (Medium)**: Minor feature broken, limited user impact
- **P3 (Low)**: Cosmetic issue, no user impact

#### 3. Response

**P0 Response**:
1. Page on-call engineer immediately
2. Create incident channel (#incident-YYYY-MM-DD)
3. Start incident log
4. Implement immediate mitigation
5. Communicate to stakeholders every 15 minutes

**P1 Response**:
1. Notify on-call engineer
2. Create incident ticket
3. Start investigation
4. Implement fix within 1 hour
5. Communicate to stakeholders every 30 minutes

**P2 Response**:
1. Create ticket
2. Assign to appropriate team
3. Fix within 24 hours
4. Communicate to affected users

**P3 Response**:
1. Create ticket
2. Add to backlog
3. Fix in next sprint

#### 4. Resolution

**Steps**:
1. Implement fix
2. Deploy to staging
3. Test thoroughly
4. Deploy to production
5. Verify resolution
6. Monitor for 1 hour

#### 5. Post-Mortem

**Required for P0 and P1 incidents**:
1. Schedule post-mortem meeting (within 48 hours)
2. Document timeline
3. Identify root cause
4. List action items
5. Assign owners
6. Set deadlines
7. Share with team

**Template**: See `docs/POST_MORTEM_TEMPLATE.md`

---

## Database Operations

### Common Database Tasks

#### Run Database Backup

**Frequency**: Daily at 2:00 AM (automated)  
**Manual Backup**:

```bash
# Create backup
npm run db:backup

# Backup to specific location
npm run db:backup -- --output=/backups/manual-backup-$(date +%Y%m%d).sql

# Verify backup
npm run db:verify-backup -- --file=/backups/manual-backup-20260203.sql
```

#### Restore Database

**⚠️ WARNING**: This will overwrite current data

```bash
# 1. Create backup of current state
npm run db:backup -- --output=/backups/pre-restore-$(date +%Y%m%d).sql

# 2. Stop application
vercel env rm DATABASE_URL production

# 3. Restore from backup
npm run db:restore -- --file=/backups/backup-20260203.sql

# 4. Verify restoration
npm run db:verify

# 5. Restart application
vercel env add DATABASE_URL production
vercel redeploy --prod
```

#### Run Database Migration

```bash
# 1. Create migration
npx prisma migrate dev --name migration_name

# 2. Test on staging
DATABASE_URL=$STAGING_DATABASE_URL npx prisma migrate deploy

# 3. Verify on staging
npm run test:integration

# 4. Deploy to production
npx prisma migrate deploy

# 5. Verify on production
npm run verify:database
```

#### Rollback Database Migration

```bash
# 1. Identify migration to rollback
npx prisma migrate status

# 2. Mark as rolled back
npx prisma migrate resolve --rolled-back <migration-name>

# 3. Restore from backup (if needed)
npm run db:restore -- --file=/backups/pre-migration.sql

# 4. Verify state
npx prisma migrate status
```

#### Optimize Database Performance

```bash
# 1. Analyze query performance
npm run db:analyze

# 2. Identify slow queries
npm run db:slow-queries

# 3. Check missing indexes
npm run db:check-indexes

# 4. Run VACUUM
npm run db:vacuum

# 5. Update statistics
npm run db:update-stats

# 6. Verify improvement
npm run performance:test
```

---

## Cache Operations

### Common Cache Tasks

#### Clear All Cache

**⚠️ WARNING**: This will cause temporary performance degradation

```bash
# 1. Clear all cache
npm run cache:flush

# 2. Warm critical cache
npm run cache:warm

# 3. Monitor cache hit rate
npm run cache:monitor
```

#### Clear Specific Cache

```bash
# Clear product cache
npm run cache:clear -- --pattern="products:*"

# Clear competitor cache
npm run cache:clear -- --pattern="competitors:*"

# Clear user session cache
npm run cache:clear -- --pattern="session:*"
```

#### Warm Cache

```bash
# Warm all cache
npm run cache:warm

# Warm specific cache
npm run cache:warm -- --type=products
npm run cache:warm -- --type=competitors
npm run cache:warm -- --type=rules
```

#### Monitor Cache Performance

```bash
# Get cache statistics
npm run cache:stats

# Monitor cache in real-time
npm run cache:monitor

# Generate cache report
npm run cache:report
```

#### Adjust Cache TTL

```bash
# View current TTL settings
npm run cache:config

# Adjust TTL for specific cache type
npm run cache:set-ttl -- --type=products --ttl=3600

# Verify changes
npm run cache:config
```

---

## User Management

### Common User Tasks

#### Create Admin User

```bash
# Create admin user
npm run user:create-admin -- \
  --email=admin@example.com \
  --name="Admin User" \
  --password="SecurePassword123!"

# Verify creation
npm run user:verify -- --email=admin@example.com
```

#### Reset User Password

```bash
# Generate password reset token
npm run user:reset-password -- --email=user@example.com

# Or set password directly
npm run user:set-password -- \
  --email=user@example.com \
  --password="NewSecurePassword123!"
```

#### Disable User Account

```bash
# Disable user
npm run user:disable -- --email=user@example.com

# Enable user
npm run user:enable -- --email=user@example.com
```

#### View User Activity

```bash
# View user audit log
npm run user:audit-log -- --email=user@example.com

# View user sessions
npm run user:sessions -- --email=user@example.com

# View user API usage
npm run user:api-usage -- --email=user@example.com
```

#### Delete User Account (GDPR)

```bash
# 1. Export user data
npm run user:export -- --email=user@example.com --output=/exports/

# 2. Anonymize user data
npm run user:anonymize -- --email=user@example.com

# 3. Verify deletion
npm run user:verify-deletion -- --email=user@example.com
```

---

## Data Management

### Data Retention

#### Run Manual Cleanup

```bash
# Clean up old price history (> 90 days)
npm run cleanup:price-history

# Clean up old audit logs (> 1 year)
npm run cleanup:audit-logs

# Clean up old notifications (> 30 days)
npm run cleanup:notifications

# Clean up old sync logs (> 30 days)
npm run cleanup:sync-logs
```

#### Archive Old Data

```bash
# Archive price history
npm run data:archive -- --type=price-history --days=90

# Archive audit logs
npm run data:archive -- --type=audit-logs --days=365

# Verify archive
npm run data:verify-archive
```

#### Export Data

```bash
# Export tenant data
npm run data:export -- --tenant-id=<tenant-id> --output=/exports/

# Export specific data type
npm run data:export -- \
  --tenant-id=<tenant-id> \
  --type=products \
  --output=/exports/products.json

# Export date range
npm run data:export -- \
  --tenant-id=<tenant-id> \
  --start-date=2026-01-01 \
  --end-date=2026-02-01 \
  --output=/exports/
```

---

## Performance Tuning

### Database Performance

#### Identify Slow Queries

```bash
# Enable slow query logging
npm run db:enable-slow-query-log

# View slow queries
npm run db:slow-queries

# Analyze specific query
npm run db:explain -- --query="SELECT * FROM Product WHERE tenantId = '...'"
```

#### Add Missing Indexes

```bash
# Check for missing indexes
npm run db:check-indexes

# Add recommended indexes
npm run db:add-indexes

# Verify index usage
npm run db:index-usage
```

#### Optimize Query Plans

```bash
# Analyze query plans
npm run db:analyze-plans

# Update statistics
npm run db:update-stats

# Verify improvements
npm run performance:test
```

### Application Performance

#### Profile API Endpoints

```bash
# Profile all endpoints
npm run performance:profile

# Profile specific endpoint
npm run performance:profile -- --endpoint=/api/v1/products

# Generate flame graph
npm run performance:flamegraph
```

#### Optimize Cache Usage

```bash
# Analyze cache patterns
npm run cache:analyze

# Identify cache misses
npm run cache:misses

# Optimize cache strategy
npm run cache:optimize
```

---

## Security Operations

### Security Audit

#### Run Security Scan

```bash
# Run full security audit
npm run security:audit

# Check dependencies
npm audit

# Check for outdated packages
npm outdated

# Run OWASP dependency check
npm run security:owasp
```

#### Review Access Logs

```bash
# View failed login attempts
npm run security:failed-logins

# View suspicious activity
npm run security:suspicious-activity

# View API token usage
npm run security:token-usage
```

#### Rotate Encryption Keys

**⚠️ WARNING**: This requires careful planning

```bash
# 1. Generate new encryption key
openssl rand -hex 32

# 2. Add new key to environment
vercel env add ENCRYPTION_KEY_NEW production

# 3. Run key rotation script
npm run security:rotate-keys

# 4. Verify all tokens decryptable
npm run security:verify-encryption

# 5. Remove old key
vercel env rm ENCRYPTION_KEY_OLD production
```

#### Revoke API Tokens

```bash
# Revoke specific token
npm run security:revoke-token -- --token-id=<token-id>

# Revoke all tokens for user
npm run security:revoke-user-tokens -- --user-id=<user-id>

# Revoke all tokens for tenant
npm run security:revoke-tenant-tokens -- --tenant-id=<tenant-id>
```

---

## Backup & Recovery

### Backup Procedures

#### Full System Backup

```bash
# 1. Backup database
npm run backup:database

# 2. Backup Redis data
npm run backup:redis

# 3. Backup configuration
npm run backup:config

# 4. Backup uploaded files
npm run backup:files

# 5. Create backup manifest
npm run backup:manifest

# 6. Verify backup integrity
npm run backup:verify
```

#### Incremental Backup

```bash
# Backup changes since last backup
npm run backup:incremental

# Verify incremental backup
npm run backup:verify-incremental
```

### Recovery Procedures

#### Full System Recovery

**⚠️ WARNING**: This will restore entire system to backup state

```bash
# 1. Stop application
vercel env rm DATABASE_URL production

# 2. Restore database
npm run restore:database -- --file=/backups/db-20260203.sql

# 3. Restore Redis data
npm run restore:redis -- --file=/backups/redis-20260203.rdb

# 4. Restore configuration
npm run restore:config -- --file=/backups/config-20260203.json

# 5. Restore files
npm run restore:files -- --dir=/backups/files-20260203/

# 6. Verify restoration
npm run restore:verify

# 7. Restart application
vercel env add DATABASE_URL production
vercel redeploy --prod

# 8. Run smoke tests
npm run test:smoke
```

#### Point-in-Time Recovery

```bash
# Restore to specific timestamp
npm run restore:point-in-time -- --timestamp="2026-02-03 10:00:00"

# Verify restoration
npm run restore:verify
```

---

## Emergency Contacts

### On-Call Rotation

| Role | Primary | Secondary |
|------|---------|-----------|
| DevOps Engineer | John Doe | Jane Smith |
| Database Admin | Bob Johnson | Alice Williams |
| Security Lead | Charlie Brown | Diana Prince |
| Product Owner | Eve Davis | Frank Miller |

### Escalation Path

1. **Level 1**: On-call engineer
2. **Level 2**: Team lead
3. **Level 3**: Engineering manager
4. **Level 4**: CTO

### External Contacts

- **Vercel Support**: support@vercel.com
- **Upstash Support**: support@upstash.com
- **Database Provider**: support@provider.com

---

## Useful Commands Reference

### Quick Reference

```bash
# Health checks
npm run health:check
npm run health:database
npm run health:redis
npm run health:email

# Monitoring
npm run monitor:errors
npm run monitor:performance
npm run monitor:cache
npm run monitor:database

# Maintenance
npm run maintenance:daily
npm run maintenance:weekly
npm run maintenance:monthly

# Troubleshooting
npm run troubleshoot:database
npm run troubleshoot:redis
npm run troubleshoot:email
npm run troubleshoot:performance

# Emergency
npm run emergency:rollback
npm run emergency:disable-feature
npm run emergency:clear-cache
npm run emergency:restart
```

---

**Last Updated**: February 3, 2026  
**Version**: 1.5  
**Maintained By**: DevOps Team  
**Review Schedule**: Monthly
