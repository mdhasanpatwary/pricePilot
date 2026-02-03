-- Performance Indexes Migration
-- Task 8.2: Add database indexes for performance optimization
-- Requirements: 2.9.1
-- Created: 2026-02-02

-- This migration adds critical indexes to improve query performance
-- across the application, particularly for multi-tenant queries and
-- common filtering operations.

-- ============================================================================
-- PRODUCT TABLE INDEXES
-- ============================================================================

-- Composite index for tenant + site queries (most common query pattern)
-- Used by: Product listing, filtering, and sync operations
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_product_tenant_site ON "Product" ("tenantId", "siteId");

-- Index for external ID lookups (used during sync operations)
-- Used by: Product sync, matching external products
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_product_external_id ON "Product" ("externalId")
WHERE
    "externalId" IS NOT NULL;

-- Index for updated timestamp (used for incremental sync and sorting)
-- Used by: Recently updated products, sync operations
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_product_updated_at ON "Product" ("updatedAt" DESC);

-- Composite index for tenant + updated timestamp
-- Used by: Tenant-specific recently updated products
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_product_tenant_updated ON "Product" ("tenantId", "updatedAt" DESC);

-- ============================================================================
-- PRODUCT MATCH TABLE INDEXES
-- ============================================================================

-- Composite index for user product + status (primary query pattern)
-- Used by: Finding matches for a user product, filtering by status
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_product_match_user_status ON "ProductMatch" ("userProductId", "status");

-- Index for competitor product lookups
-- Used by: Finding which user products match a competitor product
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_product_match_competitor ON "ProductMatch" ("competitorProductId");

-- Index for confidence score (used for sorting and filtering)
-- Used by: Finding high-confidence matches, sorting by confidence
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_product_match_confidence ON "ProductMatch" ("confidenceScore" DESC);

-- Composite index for status + confidence (common filtering pattern)
-- Used by: Finding approved matches sorted by confidence
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_product_match_status_confidence ON "ProductMatch" (
    "status",
    "confidenceScore" DESC
);

-- ============================================================================
-- PRICE HISTORY TABLE INDEXES
-- ============================================================================

-- Composite index for product + recorded timestamp (primary query pattern)
-- Used by: Price history charts, trend analysis
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_price_history_product_date ON "PriceHistory" (
    "productId",
    "recordedAt" DESC
);

-- Index for recorded timestamp only (used for cleanup operations)
-- Used by: Data retention, archival operations
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_price_history_recorded_at ON "PriceHistory" ("recordedAt" DESC);

-- ============================================================================
-- SITE TABLE INDEXES
-- ============================================================================

-- Composite index for tenant + type (common filtering pattern)
-- Used by: Listing user sites vs competitor sites
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_site_tenant_type ON "Site" ("tenantId", "type");

-- Composite index for syncing status (used by sync operations)
-- Used by: Finding sites currently syncing, sync queue management
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_site_syncing_started ON "Site" ("isSyncing", "syncStartedAt")
WHERE
    "isSyncing" = true;

-- Index for last sync timestamp
-- Used by: Finding sites that need syncing, sync scheduling
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_site_last_sync ON "Site" ("lastSyncAt" DESC NULLS LAST);

-- Composite index for tenant + last sync
-- Used by: Tenant-specific sync status
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_site_tenant_last_sync ON "Site" (
    "tenantId",
    "lastSyncAt" DESC NULLS LAST
);

-- ============================================================================
-- NOTIFICATION TABLE INDEXES
-- ============================================================================

-- Composite index for tenant + read status + created timestamp
-- Used by: Unread notifications, notification feed
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_notification_tenant_read_created ON "Notification" (
    "tenantId",
    "isRead",
    "createdAt" DESC
);

-- Index for notification type (used for filtering)
-- Used by: Filtering notifications by type
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_notification_type ON "Notification" ("type");

-- Composite index for tenant + type + created
-- Used by: Tenant-specific notification type filtering
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_notification_tenant_type_created ON "Notification" (
    "tenantId",
    "type",
    "createdAt" DESC
);

-- ============================================================================
-- TENANT AUDIT LOG TABLE INDEXES
-- ============================================================================

-- Composite index for tenant + created timestamp (primary query pattern)
-- Used by: Audit log viewing, filtering by tenant
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_tenant_created ON "TenantAuditLog" ("tenantId", "createdAt" DESC);

-- Index for user ID (used for user activity tracking)
-- Used by: Finding all actions by a specific user
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_user_id ON "TenantAuditLog" ("userId");

-- Composite index for tenant + user + created
-- Used by: User-specific audit logs within a tenant
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_tenant_user_created ON "TenantAuditLog" (
    "tenantId",
    "userId",
    "createdAt" DESC
);

-- Index for action type (used for filtering)
-- Used by: Finding specific types of actions
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_action ON "TenantAuditLog" ("action");

-- Composite index for tenant + action + created
-- Used by: Tenant-specific action filtering
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_tenant_action_created ON "TenantAuditLog" (
    "tenantId",
    "action",
    "createdAt" DESC
);

-- Index for entity ID (used for entity-specific audit trails)
-- Used by: Finding all actions on a specific entity
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_entity_id ON "TenantAuditLog" ("entityId");

-- ============================================================================
-- ADDITIONAL PERFORMANCE INDEXES
-- ============================================================================

-- Price Update Log indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_price_update_product_executed ON "PriceUpdateLog" (
    "productId",
    "executedAt" DESC
);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_price_update_status ON "PriceUpdateLog" ("status", "executedAt" DESC);

-- Pending Price Change indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_pending_price_tenant_status_created ON "PendingPriceChange" (
    "tenantId",
    "status",
    "createdAt" DESC
);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_pending_price_expires ON "PendingPriceChange" ("expiresAt")
WHERE
    "status" = 'PENDING';

-- User indexes for authentication
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_tenant_role ON "User" ("tenantId", "role");

-- Session indexes for active session queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_session_expires_active ON "Session" ("expires")
WHERE
    "expires" > NOW();

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

-- To verify indexes were created successfully, run:
-- SELECT schemaname, tablename, indexname, indexdef
-- FROM pg_indexes
-- WHERE schemaname = 'public'
-- AND indexname LIKE 'idx_%'
-- ORDER BY tablename, indexname;

-- To check index usage statistics, run:
-- SELECT schemaname, tablename, indexname, idx_scan, idx_tup_read, idx_tup_fetch
-- FROM pg_stat_user_indexes
-- WHERE schemaname = 'public'
-- ORDER BY idx_scan DESC;

-- ============================================================================
-- NOTES
-- ============================================================================

-- 1. All indexes use CREATE INDEX CONCURRENTLY to avoid blocking table access
-- 2. Indexes are created with IF NOT EXISTS to allow safe re-running
-- 3. Partial indexes (WHERE clauses) are used where appropriate to reduce index size
-- 4. DESC ordering is used for timestamp columns to optimize recent-first queries
-- 5. NULLS LAST is used for nullable timestamp columns to handle NULL values properly

-- ============================================================================
-- ROLLBACK
-- ============================================================================

-- To rollback this migration, run:
-- DROP INDEX CONCURRENTLY IF EXISTS idx_product_tenant_site;
-- DROP INDEX CONCURRENTLY IF EXISTS idx_product_external_id;
-- DROP INDEX CONCURRENTLY IF EXISTS idx_product_updated_at;
-- DROP INDEX CONCURRENTLY IF EXISTS idx_product_tenant_updated;
-- DROP INDEX CONCURRENTLY IF EXISTS idx_product_match_user_status;
-- DROP INDEX CONCURRENTLY IF EXISTS idx_product_match_competitor;
-- DROP INDEX CONCURRENTLY IF EXISTS idx_product_match_confidence;
-- DROP INDEX CONCURRENTLY IF EXISTS idx_product_match_status_confidence;
-- DROP INDEX CONCURRENTLY IF EXISTS idx_price_history_product_date;
-- DROP INDEX CONCURRENTLY IF EXISTS idx_price_history_recorded_at;
-- DROP INDEX CONCURRENTLY IF EXISTS idx_site_tenant_type;
-- DROP INDEX CONCURRENTLY IF EXISTS idx_site_syncing_started;
-- DROP INDEX CONCURRENTLY IF EXISTS idx_site_last_sync;
-- DROP INDEX CONCURRENTLY IF EXISTS idx_site_tenant_last_sync;
-- DROP INDEX CONCURRENTLY IF EXISTS idx_notification_tenant_read_created;
-- DROP INDEX CONCURRENTLY IF EXISTS idx_notification_type;
-- DROP INDEX CONCURRENTLY IF EXISTS idx_notification_tenant_type_created;
-- DROP INDEX CONCURRENTLY IF EXISTS idx_audit_tenant_created;
-- DROP INDEX CONCURRENTLY IF EXISTS idx_audit_user_id;
-- DROP INDEX CONCURRENTLY IF EXISTS idx_audit_tenant_user_created;
-- DROP INDEX CONCURRENTLY IF EXISTS idx_audit_action;
-- DROP INDEX CONCURRENTLY IF EXISTS idx_audit_tenant_action_created;
-- DROP INDEX CONCURRENTLY IF EXISTS idx_audit_entity_id;
-- DROP INDEX CONCURRENTLY IF EXISTS idx_price_update_product_executed;
-- DROP INDEX CONCURRENTLY IF EXISTS idx_price_update_status;
-- DROP INDEX CONCURRENTLY IF EXISTS idx_pending_price_tenant_status_created;
-- DROP INDEX CONCURRENTLY IF EXISTS idx_pending_price_expires;
-- DROP INDEX CONCURRENTLY IF EXISTS idx_user_tenant_role;
-- DROP INDEX CONCURRENTLY IF EXISTS idx_session_expires_active;