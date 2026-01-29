-- Enhanced Indexes for Database Optimization
-- Task 15: Create enhanced indexes for existing tables
-- Requirements: 2.1

-- Note: Using CREATE INDEX CONCURRENTLY to avoid blocking table access
-- These indexes must be created outside of a transaction block

-- User Products Optimizations
-- Composite index for tenant filtering with status and price
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_product_tenant_status_price 
  ON "Product"("tenantId", "siteId", "currentPrice") 
  WHERE "siteId" IN (SELECT id FROM "Site" WHERE type = 'USER');

-- Index for last crawled timestamp (useful for sync operations)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_product_last_crawled ON "Product" (
    "tenantId",
    "lastCrawledAt" DESC NULLS LAST
);

-- Competitor Products Optimizations
-- Composite index for tenant, competitor site, and last scraped timestamp
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_product_competitor_scraped 
  ON "Product"("tenantId", "siteId", "lastCrawledAt" DESC NULLS LAST)
  WHERE "siteId" IN (SELECT id FROM "Site" WHERE type = 'COMPETITOR');

-- Index for SKU lookups on competitor products
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_product_competitor_sku 
  ON "Product"("tenantId", "sku") 
  WHERE "sku" IS NOT NULL AND "siteId" IN (SELECT id FROM "Site" WHERE type = 'COMPETITOR');

-- Product Matches Optimizations
-- Index for user product lookups with status
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_product_match_user_status ON "ProductMatch" ("userProductId", "status");

-- Index for competitor product lookups with status
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_product_match_competitor_status ON "ProductMatch" (
    "competitorProductId",
    "status"
);

-- Index for finding active matches
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_product_match_active ON "ProductMatch" ("status")
WHERE
    "status" = 'APPROVED';

-- Price History Optimizations
-- Composite index for product and recorded timestamp
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_price_history_product_recorded ON "PriceHistory" (
    "productId",
    "recordedAt" DESC
);

-- Index for tenant-wide price history queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_price_history_tenant_recorded ON "PriceHistory" (
    "productId",
    "recordedAt" DESC
)
WHERE
    "productId" IN (
        SELECT id
        FROM "Product"
    );

-- Audit Logs Optimizations
-- Composite index for tenant and created timestamp
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_log_tenant_created ON "TenantAuditLog" ("tenantId", "createdAt" DESC);

-- Index for entity lookups
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_log_entity ON "TenantAuditLog" (
    "tenantId",
    "entityId",
    "action"
);

-- Index for user activity tracking
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_log_user_created ON "TenantAuditLog" ("userId", "createdAt" DESC);

-- Price Updates Optimizations (using PriceUpdateLog table)
-- Composite index for tenant filtering (via product relationship)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_price_update_product_executed ON "PriceUpdateLog" (
    "productId",
    "executedAt" DESC
);

-- Index for status filtering
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_price_update_status_executed ON "PriceUpdateLog" ("status", "executedAt" DESC);

-- Additional Performance Indexes

-- Site table optimization for sync operations
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_site_tenant_type_sync ON "Site" (
    "tenantId",
    "type",
    "lastSyncAt" DESC NULLS LAST
);

-- Product brand and model lookups
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_product_brand_model_tenant ON "Product" ("tenantId", "brand", "model")
WHERE
    "brand" IS NOT NULL
    AND "model" IS NOT NULL;

-- Product category and price for filtering
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_product_category_price_tenant ON "Product" (
    "tenantId",
    "category",
    "currentPrice"
)
WHERE
    "category" IS NOT NULL;

-- Notification queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_notification_tenant_read_created ON "Notification" (
    "tenantId",
    "isRead",
    "createdAt" DESC
);

-- Session queries for active sessions
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_session_expires ON "Session" ("expires")
WHERE
    "expires" > NOW();