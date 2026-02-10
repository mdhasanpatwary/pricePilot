-- Corrected Performance Indexes Migration
-- Created: 2026-02-10
-- Purpose: Add critical indexes based on ACTUAL schema columns

-- ============================================================================
-- TENANT TABLE INDEXES
-- ============================================================================
-- Index for ordering by createdAt (most common query pattern)
CREATE INDEX IF NOT EXISTS "Tenant_createdAt_desc_idx" ON "Tenant" ("createdAt" DESC);

-- Index for filtering by plan type
CREATE INDEX IF NOT EXISTS "Tenant_planType_idx" ON "Tenant" ("planType");

-- Composite index for plan type + created date
CREATE INDEX IF NOT EXISTS "Tenant_planType_createdAt_idx" ON "Tenant" ("planType", "createdAt" DESC);

-- ============================================================================
-- PRODUCT TABLE INDEXES
-- ============================================================================
-- Composite index for tenant + site queries (most common)
CREATE INDEX IF NOT EXISTS "Product_tenantId_siteId_idx" ON "Product" ("tenantId", "siteId");

-- Index for tenant queries
CREATE INDEX IF NOT EXISTS "Product_tenantId_idx" ON "Product" ("tenantId");

-- Index for site queries
CREATE INDEX IF NOT EXISTS "Product_siteId_idx" ON "Product" ("siteId");

-- Index for SKU lookups
CREATE INDEX IF NOT EXISTS "Product_sku_idx" ON "Product" ("sku")
WHERE
    "sku" IS NOT NULL;

-- Composite index for tenant + SKU
CREATE INDEX IF NOT EXISTS "Product_tenantId_sku_idx" ON "Product" ("tenantId", "sku")
WHERE
    "sku" IS NOT NULL;

-- Index for price range queries
CREATE INDEX IF NOT EXISTS "Product_currentPrice_idx" ON "Product" ("currentPrice");

-- Composite index for tenant + price
CREATE INDEX IF NOT EXISTS "Product_tenantId_currentPrice_idx" ON "Product" ("tenantId", "currentPrice");

-- Index for brand + model matching
CREATE INDEX IF NOT EXISTS "Product_brand_model_idx" ON "Product" ("brand", "model")
WHERE
    "brand" IS NOT NULL
    AND "model" IS NOT NULL;

-- Index for tenant + brand
CREATE INDEX IF NOT EXISTS "Product_tenantId_brand_idx" ON "Product" ("tenantId", "brand")
WHERE
    "brand" IS NOT NULL;

-- Index for updated timestamp
CREATE INDEX IF NOT EXISTS "Product_updatedAt_desc_idx" ON "Product" ("updatedAt" DESC);

-- Composite index for tenant + updated
CREATE INDEX IF NOT EXISTS "Product_tenantId_updatedAt_idx" ON "Product" ("tenantId", "updatedAt" DESC);

-- Index for stock status
CREATE INDEX IF NOT EXISTS "Product_inStock_idx" ON "Product" ("inStock");

-- Full-text search index for title
CREATE INDEX IF NOT EXISTS "Product_title_gin_idx" ON "Product" USING gin (
    to_tsvector ('english', "title")
);

-- ============================================================================
-- SITE TABLE INDEXES
-- ============================================================================
-- Composite index for tenant + type (user vs competitor)
CREATE INDEX IF NOT EXISTS "Site_tenantId_type_idx" ON "Site" ("tenantId", "type");

-- Index for syncing status
CREATE INDEX IF NOT EXISTS "Site_isSyncing_idx" ON "Site" ("isSyncing")
WHERE
    "isSyncing" = true;

-- Composite index for tenant + syncing
CREATE INDEX IF NOT EXISTS "Site_tenantId_isSyncing_idx" ON "Site" ("tenantId", "isSyncing");

-- Index for type
CREATE INDEX IF NOT EXISTS "Site_type_idx" ON "Site" ("type");

-- Index for last sync timestamp
CREATE INDEX IF NOT EXISTS "Site_lastSyncAt_idx" ON "Site" ("lastSyncAt" DESC)
WHERE
    "lastSyncAt" IS NOT NULL;

-- ============================================================================
-- PRODUCTMATCH TABLE INDEXES
-- ============================================================================
-- Index for user product lookups
CREATE INDEX IF NOT EXISTS "ProductMatch_userProductId_idx" ON "ProductMatch" ("userProductId");

-- Index for competitor product lookups
CREATE INDEX IF NOT EXISTS "ProductMatch_competitorProductId_idx" ON "ProductMatch" ("competitorProductId");

-- Composite index for user product + status
CREATE INDEX IF NOT EXISTS "ProductMatch_userProductId_status_idx" ON "ProductMatch" ("userProductId", "status");

-- Index for match status
CREATE INDEX IF NOT EXISTS "ProductMatch_status_idx" ON "ProductMatch" ("status");

-- Index for match type
CREATE INDEX IF NOT EXISTS "ProductMatch_matchType_idx" ON "ProductMatch" ("matchType");

-- ============================================================================
-- PRICEHISTORY TABLE INDEXES
-- ============================================================================
-- Composite index for product + recorded date (most common query)
CREATE INDEX IF NOT EXISTS "PriceHistory_productId_recordedAt_idx" ON "PriceHistory" (
    "productId",
    "recordedAt" DESC
);

-- Index for recorded date
CREATE INDEX IF NOT EXISTS "PriceHistory_recordedAt_desc_idx" ON "PriceHistory" ("recordedAt" DESC);

-- ============================================================================
-- PRICINGUPDATELOG TABLE INDEXES
-- ============================================================================
-- Index for product lookups
CREATE INDEX IF NOT EXISTS "PriceUpdateLog_productId_idx" ON "PriceUpdateLog" ("productId");

-- Composite index for product + executed date
CREATE INDEX IF NOT EXISTS "PriceUpdateLog_productId_executedAt_idx" ON "PriceUpdateLog" (
    "productId",
    "executedAt" DESC
);

-- Index for status
CREATE INDEX IF NOT EXISTS "PriceUpdateLog_status_idx" ON "PriceUpdateLog" ("status");

-- Index for logic type
CREATE INDEX IF NOT EXISTS "PriceUpdateLog_logicType_idx" ON "PriceUpdateLog" ("logicType");

-- ============================================================================
-- PRICINGRULE TABLE INDEXES
-- ============================================================================
-- Composite index for tenant + active status
CREATE INDEX IF NOT EXISTS "PricingRule_tenantId_isActive_idx" ON "PricingRule" ("tenantId", "isActive");

-- Index for priority ordering
CREATE INDEX IF NOT EXISTS "PricingRule_priority_idx" ON "PricingRule" ("priority");

-- Composite index for tenant + priority
CREATE INDEX IF NOT EXISTS "PricingRule_tenantId_priority_idx" ON "PricingRule" ("tenantId", "priority");

-- ============================================================================
-- TENANTAUDITLOG TABLE INDEXES
-- ============================================================================
-- Composite index for tenant + created date
CREATE INDEX IF NOT EXISTS "TenantAuditLog_tenantId_createdAt_idx" ON "TenantAuditLog" ("tenantId", "createdAt" DESC);

-- Index for user lookups
CREATE INDEX IF NOT EXISTS "TenantAuditLog_userId_createdAt_idx" ON "TenantAuditLog" ("userId", "createdAt" DESC);

-- Index for action filtering
CREATE INDEX IF NOT EXISTS "TenantAuditLog_action_idx" ON "TenantAuditLog" ("action");

-- Composite index for entity lookups
CREATE INDEX IF NOT EXISTS "TenantAuditLog_entityId_createdAt_idx" ON "TenantAuditLog" ("entityId", "createdAt" DESC);

-- ============================================================================
-- USER TABLE INDEXES
-- ============================================================================
-- Composite index for tenant + role
CREATE INDEX IF NOT EXISTS "User_tenantId_role_idx" ON "User" ("tenantId", "role");

-- Index for email verification
CREATE INDEX IF NOT EXISTS "User_emailVerified_idx" ON "User" ("emailVerified")
WHERE
    "emailVerified" IS NOT NULL;

-- Index for super admin flag
CREATE INDEX IF NOT EXISTS "User_isSuperAdmin_idx" ON "User" ("isSuperAdmin")
WHERE
    "isSuperAdmin" = true;

-- ============================================================================
-- SESSION TABLE INDEXES
-- ============================================================================
-- Index for session token lookups (critical for auth)
CREATE INDEX IF NOT EXISTS "Session_sessionToken_idx" ON "Session" ("sessionToken");

-- Index for user lookups
CREATE INDEX IF NOT EXISTS "Session_userId_idx" ON "Session" ("userId");

-- Partial index for active sessions
CREATE INDEX IF NOT EXISTS "Session_expires_active_idx" ON "Session" ("expires")
WHERE
    "expires" > NOW();

-- ============================================================================
-- NOTIFICATION TABLE INDEXES
-- ============================================================================
-- Composite index for tenant + read status
CREATE INDEX IF NOT EXISTS "Notification_tenantId_isRead_idx" ON "Notification" ("tenantId", "isRead");

-- Composite index for tenant + created date
CREATE INDEX IF NOT EXISTS "Notification_tenantId_createdAt_idx" ON "Notification" ("tenantId", "createdAt" DESC);

-- Partial index for unread notifications
CREATE INDEX IF NOT EXISTS "Notification_isRead_false_idx" ON "Notification" ("tenantId", "createdAt" DESC)
WHERE
    "isRead" = false;

-- ============================================================================
-- PENDINGPRICECHANGE TABLE INDEXES
-- ============================================================================
-- Composite index for tenant + status
CREATE INDEX IF NOT EXISTS "PendingPriceChange_tenantId_status_idx" ON "PendingPriceChange" ("tenantId", "status");

-- Index for product lookups
CREATE INDEX IF NOT EXISTS "PendingPriceChange_productId_idx" ON "PendingPriceChange" ("productId");

-- Index for expiration
CREATE INDEX IF NOT EXISTS "PendingPriceChange_expiresAt_idx" ON "PendingPriceChange" ("expiresAt");

-- Partial index for pending changes
CREATE INDEX IF NOT EXISTS "PendingPriceChange_pending_idx" ON "PendingPriceChange" ("tenantId", "expiresAt")
WHERE
    "status" = 'PENDING';

-- ============================================================================
-- BRAND TABLE INDEXES
-- ============================================================================
-- Composite index for tenant + slug
CREATE INDEX IF NOT EXISTS "Brand_tenantId_slug_idx" ON "Brand" ("tenantId", "slug");

-- Index for name search
CREATE INDEX IF NOT EXISTS "Brand_name_idx" ON "Brand" ("name");

-- ============================================================================
-- CATEGORY TABLE INDEXES
-- ============================================================================
-- Composite index for tenant + parent
CREATE INDEX IF NOT EXISTS "Category_tenantId_parentId_idx" ON "Category" ("tenantId", "parentId");

-- Index for level
CREATE INDEX IF NOT EXISTS "Category_level_idx" ON "Category" ("level");

-- ============================================================================
-- SCRAPEATTEMPT TABLE INDEXES
-- ============================================================================
-- Composite index for tenant + created date
CREATE INDEX IF NOT EXISTS "ScrapeAttempt_tenantId_createdAt_idx" ON "ScrapeAttempt" ("tenantId", "createdAt" DESC);

-- Index for success status
CREATE INDEX IF NOT EXISTS "ScrapeAttempt_success_idx" ON "ScrapeAttempt" ("success");

-- Composite index for competitor website + created
CREATE INDEX IF NOT EXISTS "ScrapeAttempt_competitorWebsiteId_createdAt_idx" ON "ScrapeAttempt" (
    "competitorWebsiteId",
    "createdAt" DESC
);

-- ============================================================================
-- RATELIMITBYPASS TABLE INDEXES
-- ============================================================================
-- Composite index for tenant + active + expires
CREATE INDEX IF NOT EXISTS "RateLimitBypass_tenantId_isActive_expiresAt_idx" ON "RateLimitBypass" (
    "tenantId",
    "isActive",
    "expiresAt"
);

-- Partial index for active bypasses
CREATE INDEX IF NOT EXISTS "RateLimitBypass_active_idx" ON "RateLimitBypass" ("tenantId", "expiresAt")
WHERE
    "isActive" = true;

-- ============================================================================
-- ANALYZE TABLES
-- ============================================================================
-- Update table statistics for query planner
ANALYZE "Tenant";

ANALYZE "Product";

ANALYZE "Site";

ANALYZE "ProductMatch";

ANALYZE "PriceHistory";

ANALYZE "PriceUpdateLog";

ANALYZE "PricingRule";

ANALYZE "TenantAuditLog";

ANALYZE "User";

ANALYZE "Session";

ANALYZE "Notification";

ANALYZE "PendingPriceChange";

ANALYZE "Brand";

ANALYZE "Category";

ANALYZE "ScrapeAttempt";

ANALYZE "RateLimitBypass";