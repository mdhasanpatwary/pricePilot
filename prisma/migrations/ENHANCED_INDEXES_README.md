# Enhanced Database Indexes

## Overview

This document describes the enhanced indexes created for database optimization as part of Task 15. These indexes are designed to improve query performance across the PricePilot platform, particularly for multi-tenant queries, price comparisons, and audit logging.

## Requirements

**Task 15: Create enhanced indexes for existing tables**
- Requirements: 2.1 (Index Optimization)

## Index Strategy

All indexes are created using `CREATE INDEX CONCURRENTLY` to avoid blocking table access during index creation. This is critical for production deployments where downtime must be minimized.

## Index Categories

### 1. User Products Indexes

#### idx_product_tenant_status_price
- **Columns:** `tenantId`, `siteId`, `currentPrice`
- **Purpose:** Optimize queries filtering user products by tenant and site with price sorting
- **Use Cases:** Product listing, price comparison dashboards
- **Partial Index:** Filters for USER site type only

#### idx_product_last_crawled
- **Columns:** `tenantId`, `lastCrawledAt DESC`
- **Purpose:** Optimize sync status queries and stale product detection
- **Use Cases:** Sync monitoring, data freshness checks

### 2. Competitor Products Indexes

#### idx_product_competitor_scraped
- **Columns:** `tenantId`, `siteId`, `lastCrawledAt DESC`
- **Purpose:** Optimize competitor product queries with scraping timestamp
- **Use Cases:** Scraping status monitoring, competitor data freshness
- **Partial Index:** Filters for COMPETITOR site type only

#### idx_product_competitor_sku
- **Columns:** `tenantId`, `sku`
- **Purpose:** Fast SKU lookups for product matching
- **Use Cases:** Product matching engine, SKU-based searches
- **Partial Index:** Only indexes products with non-null SKU

### 3. Product Matches Indexes

#### idx_product_match_user_status
- **Columns:** `userProductId`, `status`
- **Purpose:** Optimize queries finding matches for a user product
- **Use Cases:** Product comparison, match approval workflows

#### idx_product_match_competitor_status
- **Columns:** `competitorProductId`, `status`
- **Purpose:** Optimize reverse lookups from competitor to user products
- **Use Cases:** Competitor product analysis, match validation

#### idx_product_match_active
- **Columns:** `status`
- **Purpose:** Fast filtering of active/approved matches
- **Use Cases:** Active match counting, comparison table generation
- **Partial Index:** Only indexes APPROVED matches

### 4. Price History Indexes

#### idx_price_history_product_recorded
- **Columns:** `productId`, `recordedAt DESC`
- **Purpose:** Optimize price history queries for individual products
- **Use Cases:** Price trend charts, historical analysis

#### idx_price_history_tenant_recorded
- **Columns:** `productId`, `recordedAt DESC`
- **Purpose:** Tenant-wide price history queries
- **Use Cases:** Bulk price history exports, analytics

### 5. Audit Logs Indexes

#### idx_audit_log_tenant_created
- **Columns:** `tenantId`, `createdAt DESC`
- **Purpose:** Optimize audit log queries by tenant with time ordering
- **Use Cases:** Audit log viewer, compliance reporting

#### idx_audit_log_entity
- **Columns:** `tenantId`, `entityId`, `action`
- **Purpose:** Fast lookups of audit logs for specific entities
- **Use Cases:** Entity history tracking, change auditing

#### idx_audit_log_user_created
- **Columns:** `userId`, `createdAt DESC`
- **Purpose:** User activity tracking and reporting
- **Use Cases:** User activity logs, security auditing

### 6. Price Updates Indexes

#### idx_price_update_product_executed
- **Columns:** `productId`, `executedAt DESC`
- **Purpose:** Optimize price update history queries
- **Use Cases:** Update history, rollback operations

#### idx_price_update_status_executed
- **Columns:** `status`, `executedAt DESC`
- **Purpose:** Filter updates by status with time ordering
- **Use Cases:** Failed update monitoring, success rate tracking

### 7. Additional Performance Indexes

#### idx_site_tenant_type_sync
- **Columns:** `tenantId`, `type`, `lastSyncAt DESC`
- **Purpose:** Optimize site queries with sync status
- **Use Cases:** Site management, sync scheduling

#### idx_product_brand_model_tenant
- **Columns:** `tenantId`, `brand`, `model`
- **Purpose:** Fast brand/model lookups for product matching
- **Use Cases:** Product matching engine, brand filtering
- **Partial Index:** Only indexes products with non-null brand and model

#### idx_product_category_price_tenant
- **Columns:** `tenantId`, `category`, `currentPrice`
- **Purpose:** Category-based product filtering with price sorting
- **Use Cases:** Category analytics, price range filtering
- **Partial Index:** Only indexes products with non-null category

#### idx_notification_tenant_read_created
- **Columns:** `tenantId`, `isRead`, `createdAt DESC`
- **Purpose:** Optimize notification queries with read status
- **Use Cases:** Notification center, unread count badges

#### idx_session_expires
- **Columns:** `expires`
- **Purpose:** Fast cleanup of expired sessions
- **Use Cases:** Session cleanup jobs, active session counting
- **Partial Index:** Only indexes non-expired sessions

## Performance Impact

### Expected Improvements

1. **Multi-tenant queries:** 50-80% faster with tenant-specific indexes
2. **Price history queries:** 60-90% faster with composite indexes
3. **Audit log queries:** 70-85% faster with time-ordered indexes
4. **Product matching:** 40-60% faster with SKU and brand/model indexes
5. **Dashboard queries:** 30-50% faster with composite indexes

### Index Maintenance

- **Automatic:** PostgreSQL automatically maintains indexes
- **Monitoring:** Use `pg_stat_user_indexes` to track index usage
- **Rebuilding:** Indexes with >30% fragmentation should be rebuilt
- **Cleanup:** Unused indexes should be dropped to save space

## Usage

### Creating Indexes

```bash
# Run the index creation script
npm run tsx scripts/create-enhanced-indexes.ts

# Or apply the SQL migration directly
psql -d pricepilot -f prisma/migrations/create_enhanced_indexes.sql
```

### Verifying Indexes

```bash
# Run the verification script
npm run tsx scripts/verify-enhanced-indexes.ts
```

### Testing Indexes

```bash
# Run the test suite
npm test __tests__/database/enhanced-indexes.test.ts
```

## Monitoring

### Check Index Usage

```sql
SELECT 
  schemaname,
  tablename,
  indexname,
  idx_scan,
  idx_tup_read,
  idx_tup_fetch,
  pg_size_pretty(pg_relation_size(indexrelid)) as size
FROM pg_stat_user_indexes
WHERE indexrelname LIKE 'idx_%'
ORDER BY idx_scan DESC;
```

### Check Index Sizes

```sql
SELECT 
  indexrelname as index_name,
  pg_size_pretty(pg_relation_size(indexrelid)) as size
FROM pg_stat_user_indexes
WHERE indexrelname LIKE 'idx_%'
ORDER BY pg_relation_size(indexrelid) DESC;
```

### Check Unused Indexes

```sql
SELECT 
  schemaname,
  tablename,
  indexname,
  idx_scan,
  pg_size_pretty(pg_relation_size(indexrelid)) as size
FROM pg_stat_user_indexes
WHERE indexrelname LIKE 'idx_%'
AND idx_scan = 0
ORDER BY pg_relation_size(indexrelid) DESC;
```

## Rollback

If indexes need to be removed:

```sql
-- Drop all enhanced indexes
DROP INDEX CONCURRENTLY IF EXISTS idx_product_tenant_status_price;
DROP INDEX CONCURRENTLY IF EXISTS idx_product_last_crawled;
DROP INDEX CONCURRENTLY IF EXISTS idx_product_competitor_scraped;
DROP INDEX CONCURRENTLY IF EXISTS idx_product_competitor_sku;
DROP INDEX CONCURRENTLY IF EXISTS idx_product_match_user_status;
DROP INDEX CONCURRENTLY IF EXISTS idx_product_match_competitor_status;
DROP INDEX CONCURRENTLY IF EXISTS idx_product_match_active;
DROP INDEX CONCURRENTLY IF EXISTS idx_price_history_product_recorded;
DROP INDEX CONCURRENTLY IF EXISTS idx_price_history_tenant_recorded;
DROP INDEX CONCURRENTLY IF EXISTS idx_audit_log_tenant_created;
DROP INDEX CONCURRENTLY IF EXISTS idx_audit_log_entity;
DROP INDEX CONCURRENTLY IF EXISTS idx_audit_log_user_created;
DROP INDEX CONCURRENTLY IF EXISTS idx_price_update_product_executed;
DROP INDEX CONCURRENTLY IF EXISTS idx_price_update_status_executed;
DROP INDEX CONCURRENTLY IF EXISTS idx_site_tenant_type_sync;
DROP INDEX CONCURRENTLY IF EXISTS idx_product_brand_model_tenant;
DROP INDEX CONCURRENTLY IF EXISTS idx_product_category_price_tenant;
DROP INDEX CONCURRENTLY IF EXISTS idx_notification_tenant_read_created;
DROP INDEX CONCURRENTLY IF EXISTS idx_session_expires;
```

## Best Practices

1. **Always use CONCURRENTLY:** Prevents table locking during index creation
2. **Monitor index usage:** Drop unused indexes to save space
3. **Rebuild fragmented indexes:** Maintain query performance
4. **Test query plans:** Verify indexes are being used with EXPLAIN
5. **Consider partial indexes:** Reduce index size for filtered queries

## References

- PostgreSQL Documentation: [Indexes](https://www.postgresql.org/docs/current/indexes.html)
- PostgreSQL Documentation: [CREATE INDEX CONCURRENTLY](https://www.postgresql.org/docs/current/sql-createindex.html#SQL-CREATEINDEX-CONCURRENTLY)
- Design Document: `.kiro/specs/database-optimization/design.md`
- Requirements Document: `.kiro/specs/database-optimization/requirements.md`
