-- Add Performance Indexes Migration
-- Created: 2026-02-10
-- Purpose: Add critical indexes to improve query performance

-- ============================================================================
-- TENANT TABLE INDEXES
-- ============================================================================
-- Note: id is already the primary key, but we add status index for filtering
CREATE INDEX IF NOT EXISTS "Tenant_status_idx" ON "Tenant" ("planType");

CREATE INDEX IF NOT EXISTS "Tenant_createdAt_idx" ON "Tenant" ("createdAt" DESC);

-- ============================================================================
-- PRODUCT TABLE INDEXES
-- ============================================================================
-- Composite index for tenant + status queries (most common)
CREATE INDEX IF NOT EXISTS "Product_tenantId_status_idx" ON "Product" ("tenantId", "status")
WHERE
    "status" IS NOT NULL;

-- Composite index for tenant + updated queries
CREATE INDEX IF NOT EXISTS "Product_tenantId_updatedAt_idx" ON "Product" ("tenantId", "updatedAt" DESC);

-- Index for SKU lookups
CREATE INDEX IF NOT EXISTS "Product_sku_idx" ON "Product" ("sku")
WHERE
    "sku" IS NOT NULL;

-- Composite index for tenant + SKU (unique product identification)
CREATE INDEX IF NOT EXISTS "Product_tenantId_sku_idx" ON "Product" ("tenantId", "sku")
WHERE
    "sku" IS NOT NULL;

-- Index for site-based queries
CREATE INDEX IF NOT EXISTS "Product_siteId_idx" ON "Product" ("siteId");

-- Composite index for tenant + site queries
CREATE INDEX IF NOT EXISTS "Product_tenantId_siteId_idx" ON "Product" ("tenantId", "siteId");

-- Index for price range queries
CREATE INDEX IF NOT EXISTS "Product_currentPrice_idx" ON "Product" ("currentPrice")
WHERE
    "currentPrice" IS NOT NULL;

-- Index for title search (using GIN for text search)
CREATE INDEX IF NOT EXISTS "Product_title_gin_idx" ON "Product" USING gin (
    to_tsvector ('english', "title")
);

-- ============================================================================
-- SITE TABLE INDEXES
-- ============================================================================
-- Composite index for tenant + status
CREATE INDEX IF NOT EXISTS "Site_tenantId_status_idx" ON "Site" ("tenantId", "status")
WHERE
    "status" IS NOT NULL;

-- Partial index for syncing sites (frequently queried)
CREATE INDEX IF NOT EXISTS "Site_isSyncing_idx" ON "Site" ("isSyncing")
WHERE
    "isSyncing" = true;

-- Composite index for tenant + syncing
CREATE INDEX IF NOT EXISTS "Site_tenantId_isSyncing_idx" ON "Site" ("tenantId", "isSyncing");

-- Index for type-based queries
CREATE INDEX IF NOT EXISTS "Site_type_idx" ON "Site" ("type");

-- Composite index for tenant + type (user vs competitor sites)
CREATE INDEX IF NOT EXISTS "Site_tenantId_type_idx" ON "Site" ("tenantId", "type");

-- ============================================================================
-- PRODUCTMATCH TABLE INDEXES
-- ============================================================================
-- Composite index for tenant + status
CREATE INDEX IF NOT EXISTS "ProductMatch_tenantId_status_idx" ON "ProductMatch" ("tenantId", "status")
WHERE
    "status" IS NOT NULL;

-- Index for user product lookups
CREATE INDEX IF NOT EXISTS "ProductMatch_userProductId_idx" ON "ProductMatch" ("userProductId");

-- Index for competitor product lookups
CREATE INDEX IF NOT EXISTS "ProductMatch_competitorProductId_idx" ON "ProductMatch" ("competitorProductId");

-- Composite index for user product + status
CREATE INDEX IF NOT EXISTS "ProductMatch_userProductId_status_idx" ON "ProductMatch" ("userProductId", "status");

-- ============================================================================
-- PRICEHISTORY TABLE INDEXES
-- ============================================================================
-- Composite index for tenant + recorded date
CREATE INDEX IF NOT EXISTS "PriceHistory_tenantId_recordedAt_idx" ON "PriceHistory" ("tenantId", "recordedAt" DESC);

-- Composite index for product + recorded date (most common query)
CREATE INDEX IF NOT EXISTS "PriceHistory_productId_recordedAt_idx" ON "PriceHistory" (
    "productId",
    "recordedAt" DESC
);

-- Index for product type filtering
CREATE INDEX IF NOT EXISTS "PriceHistory_productType_idx" ON "PriceHistory" ("productType");

-- ============================================================================
-- PRICINGRULE TABLE INDEXES
-- ============================================================================
-- Composite index for tenant + active status
CREATE INDEX IF NOT EXISTS "PricingRule_tenantId_isActive_idx" ON "PricingRule" ("tenantId", "isActive");

-- ============================================================================
-- TENANTAUDITLOG TABLE INDEXES
-- ============================================================================
-- Composite index for tenant + created date
CREATE INDEX IF NOT EXISTS "TenantAuditLog_tenantId_createdAt_idx" ON "TenantAuditLog" ("tenantId", "createdAt" DESC);

-- Composite index for entity lookups
CREATE INDEX IF NOT EXISTS "TenantAuditLog_entityType_entityId_idx" ON "TenantAuditLog" ("entityType", "entityId");

-- Index for action filtering
CREATE INDEX IF NOT EXISTS "TenantAuditLog_action_idx" ON "TenantAuditLog" ("action");

-- ============================================================================
-- USER TABLE INDEXES
-- ============================================================================
-- Composite index for tenant + role
CREATE INDEX IF NOT EXISTS "User_tenantId_role_idx" ON "User" ("tenantId", "role")
WHERE
    "role" IS NOT NULL;

-- Composite index for tenant + status
CREATE INDEX IF NOT EXISTS "User_tenantId_status_idx" ON "User" ("tenantId", "status")
WHERE
    "status" IS NOT NULL;

-- ============================================================================
-- SESSION TABLE INDEXES (if exists)
-- ============================================================================
-- Index for session token lookups (critical for auth)
CREATE INDEX IF NOT EXISTS "Session_sessionToken_idx" ON "Session" ("sessionToken");

-- Index for user lookups
CREATE INDEX IF NOT EXISTS "Session_userId_idx" ON "Session" ("userId");

-- Partial index for active sessions
CREATE INDEX IF NOT EXISTS "Session_expires_idx" ON "Session" ("expires")
WHERE
    "expires" > NOW();

-- ============================================================================
-- RATELIMITBYPASS TABLE INDEXES
-- ============================================================================
-- Composite index for tenant + active status
CREATE INDEX IF NOT EXISTS "RateLimitBypass_tenantId_isActive_idx" ON "RateLimitBypass" ("tenantId", "isActive");

-- Partial index for active bypasses
CREATE INDEX IF NOT EXISTS "RateLimitBypass_isActive_expiresAt_idx" ON "RateLimitBypass" ("isActive", "expiresAt")
WHERE
    "isActive" = true
    AND (
        "expiresAt" IS NULL
        OR "expiresAt" > NOW()
    );

-- ============================================================================
-- NOTIFICATION TABLE INDEXES
-- ============================================================================
-- Composite index for tenant + read status
CREATE INDEX IF NOT EXISTS "Notification_tenantId_isRead_idx" ON "Notification" ("tenantId", "isRead");

-- Composite index for tenant + created date
CREATE INDEX IF NOT EXISTS "Notification_tenantId_createdAt_idx" ON "Notification" ("tenantId", "createdAt" DESC);

-- ============================================================================
-- PENDINGPRICECHANGE TABLE INDEXES
-- ============================================================================
-- Composite index for tenant + status
CREATE INDEX IF NOT EXISTS "PendingPriceChange_tenantId_status_idx" ON "PendingPriceChange" ("tenantId", "status");

-- Index for product lookups
CREATE INDEX IF NOT EXISTS "PendingPriceChange_productId_idx" ON "PendingPriceChange" ("productId");

-- ============================================================================
-- ANALYZE TABLES
-- ============================================================================
-- Update table statistics for query planner
ANALYZE "Tenant";

ANALYZE "Product";

ANALYZE "Site";

ANALYZE "ProductMatch";

ANALYZE "PriceHistory";

ANALYZE "PricingRule";

ANALYZE "TenantAuditLog";

ANALYZE "User";

ANALYZE "Session";

ANALYZE "RateLimitBypass";

ANALYZE "Notification";

ANALYZE "PendingPriceChange";