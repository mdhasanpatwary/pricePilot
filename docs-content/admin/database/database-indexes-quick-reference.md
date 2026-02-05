---
title: "Database Indexes Quick Reference"
description: "Quick reference for database indexes"
category: "database"
tags: ["database", "indexes", "quick-reference"]
audience: "admin"
---

# Database Indexes - Quick Reference Guide

**Last Updated:** 2026-02-02  
**Task:** 8.2 Add database indexes  
**Status:** ✅ Ready for Staging

## Quick Start

### Apply Migration (Staging)
```bash
# Run the migration script
npm run tsx scripts/apply-performance-indexes.ts
```

### Verify Migration
```bash
# Run verification tests
npm run tsx scripts/verify-index-performance.ts
```

### Check Index Status
```bash
# List all performance indexes
psql $DATABASE_URL -c "SELECT tablename, indexname FROM pg_indexes WHERE indexname LIKE 'idx_%' ORDER BY tablename;"
```

## Index Summary

| Table | Indexes | Purpose |
|-------|---------|---------|
| Product | 8 | Tenant filtering, sync operations, sorting |
| ProductMatch | 4 | Matching queries, confidence sorting |
| PriceHistory | 2 | Time-series queries, cleanup |
| Site | 4 | Sync operations, tenant filtering |
| Notification | 3 | Unread notifications, type filtering |
| TenantAuditLog | 6 | Audit trails, user activity |
| Other | 6 | Price updates, sessions, users |
| **Total** | **33** | **All critical query patterns** |

## Most Important Indexes

### 1. Product Queries
```sql
-- Tenant + site filtering (most common)
idx_product_tenant_site

-- External ID lookups (sync operations)
idx_product_external_id

-- Recently updated products
idx_product_updated_at
```

### 2. Matching Queries
```sql
-- User product + status (primary matching query)
idx_product_match_user_status

-- Confidence score sorting
idx_product_match_confidence
```

### 3. Price History
```sql
-- Product + date range (charts)
idx_price_history_product_date
```

### 4. Notifications
```sql
-- Unread notifications by tenant
idx_notification_tenant_read_created
```

### 5. Audit Logs
```sql
-- Tenant + created timestamp
idx_audit_tenant_created

-- User activity tracking
idx_audit_user_id
```

## Performance Expectations

| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| Product Listing | 200ms | 40ms | 80% faster |
| Matching Queries | 500ms | 50ms | 90% faster |
| Price History | 1000ms | 50ms | 95% faster |
| Audit Logs | 300ms | 90ms | 70% faster |
| Notifications | 150ms | 30ms | 80% faster |

## Common Queries Optimized

### 1. Dashboard Product Listing
```sql
-- Before: Sequential scan
-- After: Index scan on idx_product_tenant_site
SELECT * FROM "Product" 
WHERE "tenantId" = ? AND "siteId" = ?
ORDER BY "updatedAt" DESC;
```

### 2. Product Matching
```sql
-- Before: Sequential scan
-- After: Index scan on idx_product_match_user_status
SELECT * FROM "ProductMatch" 
WHERE "userProductId" = ? AND "status" = 'APPROVED';
```

### 3. Price History Chart
```sql
-- Before: Sequential scan + sort
-- After: Index scan on idx_price_history_product_date
SELECT * FROM "PriceHistory" 
WHERE "productId" = ?
ORDER BY "recordedAt" DESC
LIMIT 100;
```

### 4. Unread Notifications
```sql
-- Before: Sequential scan + filter + sort
-- After: Index scan on idx_notification_tenant_read_created
SELECT * FROM "Notification" 
WHERE "tenantId" = ? AND "isRead" = false
ORDER BY "createdAt" DESC;
```

### 5. User Activity Audit
```sql
-- Before: Sequential scan + sort
-- After: Index scan on idx_audit_user_id
SELECT * FROM "TenantAuditLog" 
WHERE "userId" = ?
ORDER BY "createdAt" DESC;
```

## Monitoring Commands

### Check Index Usage
```sql
-- Top 10 most used indexes
SELECT 
  tablename, 
  indexname, 
  idx_scan as scans
FROM pg_stat_user_indexes
WHERE indexname LIKE 'idx_%'
ORDER BY idx_scan DESC
LIMIT 10;
```

### Check Index Sizes
```sql
-- Largest indexes
SELECT 
  tablename,
  indexname,
  pg_size_pretty(pg_relation_size(indexrelid)) as size
FROM pg_stat_user_indexes
WHERE indexname LIKE 'idx_%'
ORDER BY pg_relation_size(indexrelid) DESC
LIMIT 10;
```

### Find Unused Indexes
```sql
-- Indexes with zero scans
SELECT 
  tablename, 
  indexname
FROM pg_stat_user_indexes
WHERE indexname LIKE 'idx_%'
AND idx_scan = 0;
```

### Check Query Performance
```sql
-- Explain a query
EXPLAIN ANALYZE
SELECT * FROM "Product" 
WHERE "tenantId" = 'xxx' AND "siteId" = 'yyy';
```

## Troubleshooting

### Index Not Being Used
```sql
-- Update table statistics
ANALYZE "Product";

-- Check if index exists
SELECT indexname FROM pg_indexes 
WHERE tablename = 'Product' 
AND indexname = 'idx_product_tenant_site';

-- Force index usage (testing only)
SET enable_seqscan = off;
```

### Slow Queries After Migration
```sql
-- Rebuild index
REINDEX INDEX CONCURRENTLY idx_product_tenant_site;

-- Update statistics
ANALYZE "Product";

-- Check for bloat
SELECT 
  schemaname, 
  tablename, 
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

### Index Creation Failed
```bash
# Check PostgreSQL logs
tail -f /var/log/postgresql/postgresql.log

# Check disk space
df -h

# Retry with manual SQL
psql $DATABASE_URL -f prisma/migrations/add_performance_indexes.sql
```

## Rollback

### Remove All Indexes
```bash
# Quick rollback script
psql $DATABASE_URL << 'EOF'
DROP INDEX CONCURRENTLY IF EXISTS idx_product_tenant_site;
DROP INDEX CONCURRENTLY IF EXISTS idx_product_external_id;
DROP INDEX CONCURRENTLY IF EXISTS idx_product_updated_at;
DROP INDEX CONCURRENTLY IF EXISTS idx_product_tenant_updated;
DROP INDEX CONCURRENTLY IF EXISTS idx_product_match_user_status;
DROP INDEX CONCURRENTLY IF EXISTS idx_product_match_competitor;
DROP INDEX CONCURRENTLY IF EXISTS idx_product_match_confidence;
DROP INDEX CONCURRENTLY IF EXISTS idx_product_match_status_confidence;
DROP INDEX CONCURRENTLY IF EXISTS idx_price_history_product_date;
DROP INDEX CONCURRENTLY IF EXISTS idx_price_history_recorded_at;
DROP INDEX CONCURRENTLY IF EXISTS idx_site_tenant_type;
DROP INDEX CONCURRENTLY IF EXISTS idx_site_syncing_started;
DROP INDEX CONCURRENTLY IF EXISTS idx_site_last_sync;
DROP INDEX CONCURRENTLY IF EXISTS idx_site_tenant_last_sync;
DROP INDEX CONCURRENTLY IF EXISTS idx_notification_tenant_read_created;
DROP INDEX CONCURRENTLY IF EXISTS idx_notification_type;
DROP INDEX CONCURRENTLY IF EXISTS idx_notification_tenant_type_created;
DROP INDEX CONCURRENTLY IF EXISTS idx_audit_tenant_created;
DROP INDEX CONCURRENTLY IF EXISTS idx_audit_user_id;
DROP INDEX CONCURRENTLY IF EXISTS idx_audit_tenant_user_created;
DROP INDEX CONCURRENTLY IF EXISTS idx_audit_action;
DROP INDEX CONCURRENTLY IF EXISTS idx_audit_tenant_action_created;
DROP INDEX CONCURRENTLY IF EXISTS idx_audit_entity_id;
DROP INDEX CONCURRENTLY IF EXISTS idx_price_update_product_executed;
DROP INDEX CONCURRENTLY IF EXISTS idx_price_update_status;
DROP INDEX CONCURRENTLY IF EXISTS idx_pending_price_tenant_status_created;
DROP INDEX CONCURRENTLY IF EXISTS idx_pending_price_expires;
DROP INDEX CONCURRENTLY IF EXISTS idx_user_tenant_role;
DROP INDEX CONCURRENTLY IF EXISTS idx_session_expires_active;
EOF
```

## Maintenance Schedule

### Daily
- Monitor index usage statistics
- Check for slow queries
- Review error logs

### Weekly
- Run ANALYZE on all tables
- Check index sizes
- Review unused indexes

### Monthly
- Check for index bloat
- Rebuild bloated indexes if needed
- Review and optimize based on usage patterns

## Best Practices

### DO
✅ Run ANALYZE after creating indexes  
✅ Monitor index usage regularly  
✅ Test on staging first  
✅ Use EXPLAIN ANALYZE to verify  
✅ Keep statistics up to date  

### DON'T
❌ Create indexes without testing  
❌ Ignore unused indexes  
❌ Skip ANALYZE after changes  
❌ Deploy to production without staging test  
❌ Create duplicate indexes  

## Support

### Documentation
- Full guide: `prisma/migrations/ADD_PERFORMANCE_INDEXES_README.md`
- Implementation summary: `TASK_8_2_DATABASE_INDEXES_SUMMARY.md`
- Migration file: `prisma/migrations/add_performance_indexes.sql`

### Scripts
- Apply migration: `scripts/apply-performance-indexes.ts`
- Verify performance: `scripts/verify-index-performance.ts`

### Contact
- Database issues: Check PostgreSQL logs
- Performance issues: Run verification script
- Questions: Review full documentation

## Checklist

### Before Deployment
- [ ] Review migration file
- [ ] Test on staging environment
- [ ] Verify disk space available
- [ ] Backup database
- [ ] Schedule during low-traffic period

### During Deployment
- [ ] Apply migration
- [ ] Monitor for errors
- [ ] Verify indexes created
- [ ] Run ANALYZE
- [ ] Check initial performance

### After Deployment
- [ ] Run verification script
- [ ] Monitor for 24 hours
- [ ] Check index usage
- [ ] Review performance metrics
- [ ] Document any issues

## Quick Commands Reference

```bash
# Apply migration
npm run tsx scripts/apply-performance-indexes.ts

# Verify migration
npm run tsx scripts/verify-index-performance.ts

# List indexes
psql $DATABASE_URL -c "\di idx_*"

# Check index usage
psql $DATABASE_URL -c "SELECT tablename, indexname, idx_scan FROM pg_stat_user_indexes WHERE indexname LIKE 'idx_%' ORDER BY idx_scan DESC LIMIT 10;"

# Update statistics
psql $DATABASE_URL -c "ANALYZE;"

# Check query plan
psql $DATABASE_URL -c "EXPLAIN ANALYZE SELECT * FROM \"Product\" WHERE \"tenantId\" = 'xxx';"
```

---

**Remember:** Always test on staging first! 🚀
