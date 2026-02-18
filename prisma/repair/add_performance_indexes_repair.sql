-- Idempotent repair for prisma/migrations/add_performance_indexes
-- The original migration references columns that do not exist in this schema
-- (e.g., Product.status, Site.status, PriceHistory.tenantId, RateLimitBypass.isActive).
-- This repair applies only the indexes that match the current database schema.

-- ============================================================================
-- TENANT TABLE INDEXES
-- ============================================================================
CREATE INDEX IF NOT EXISTS "Tenant_status_idx" ON "Tenant" ("planType");
CREATE INDEX IF NOT EXISTS "Tenant_createdAt_idx" ON "Tenant" ("createdAt" DESC);

-- ============================================================================
-- PRODUCT TABLE INDEXES
-- ============================================================================
CREATE INDEX IF NOT EXISTS "Product_tenantId_updatedAt_idx" ON "Product" ("tenantId", "updatedAt" DESC);
CREATE INDEX IF NOT EXISTS "Product_sku_idx" ON "Product" ("sku") WHERE "sku" IS NOT NULL;
CREATE INDEX IF NOT EXISTS "Product_tenantId_sku_idx" ON "Product" ("tenantId", "sku") WHERE "sku" IS NOT NULL;
CREATE INDEX IF NOT EXISTS "Product_siteId_idx" ON "Product" ("siteId");
CREATE INDEX IF NOT EXISTS "Product_tenantId_siteId_idx" ON "Product" ("tenantId", "siteId");
CREATE INDEX IF NOT EXISTS "Product_currentPrice_idx" ON "Product" ("currentPrice") WHERE "currentPrice" IS NOT NULL;
CREATE INDEX IF NOT EXISTS "Product_title_gin_idx" ON "Product" USING gin (to_tsvector('english', "title"));

-- ============================================================================
-- SITE TABLE INDEXES
-- ============================================================================
CREATE INDEX IF NOT EXISTS "Site_isSyncing_idx" ON "Site" ("isSyncing") WHERE "isSyncing" = true;
CREATE INDEX IF NOT EXISTS "Site_tenantId_isSyncing_idx" ON "Site" ("tenantId", "isSyncing");
CREATE INDEX IF NOT EXISTS "Site_type_idx" ON "Site" ("type");
CREATE INDEX IF NOT EXISTS "Site_tenantId_type_idx" ON "Site" ("tenantId", "type");

-- ============================================================================
-- PRODUCTMATCH TABLE INDEXES
-- ============================================================================
CREATE INDEX IF NOT EXISTS "ProductMatch_userProductId_idx" ON "ProductMatch" ("userProductId");
CREATE INDEX IF NOT EXISTS "ProductMatch_competitorProductId_idx" ON "ProductMatch" ("competitorProductId");
CREATE INDEX IF NOT EXISTS "ProductMatch_userProductId_status_idx" ON "ProductMatch" ("userProductId", "status");

-- ============================================================================
-- PRICINGRULE TABLE INDEXES
-- ============================================================================
CREATE INDEX IF NOT EXISTS "PricingRule_tenantId_isActive_idx" ON "PricingRule" ("tenantId", "isActive");

-- ============================================================================
-- TENANTAUDITLOG TABLE INDEXES
-- ============================================================================
CREATE INDEX IF NOT EXISTS "TenantAuditLog_tenantId_createdAt_idx" ON "TenantAuditLog" ("tenantId", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS "TenantAuditLog_action_idx" ON "TenantAuditLog" ("action");

-- ============================================================================
-- USER TABLE INDEXES
-- ============================================================================
CREATE INDEX IF NOT EXISTS "User_tenantId_role_idx" ON "User" ("tenantId", "role") WHERE "role" IS NOT NULL;

-- ============================================================================
-- SESSION TABLE INDEXES
-- ============================================================================
CREATE INDEX IF NOT EXISTS "Session_sessionToken_idx" ON "Session" ("sessionToken");
CREATE INDEX IF NOT EXISTS "Session_userId_idx" ON "Session" ("userId");
-- NOTE: Partial index predicates cannot use volatile functions like NOW().
CREATE INDEX IF NOT EXISTS "Session_expires_idx" ON "Session" ("expires");

-- ============================================================================
-- NOTIFICATION TABLE INDEXES
-- ============================================================================
CREATE INDEX IF NOT EXISTS "Notification_tenantId_isRead_idx" ON "Notification" ("tenantId", "isRead");
CREATE INDEX IF NOT EXISTS "Notification_tenantId_createdAt_idx" ON "Notification" ("tenantId", "createdAt" DESC);

-- ============================================================================
-- ANALYZE TABLES
-- ============================================================================
ANALYZE "Tenant";
ANALYZE "Product";
ANALYZE "Site";
ANALYZE "ProductMatch";
ANALYZE "PricingRule";
ANALYZE "TenantAuditLog";
ANALYZE "User";
ANALYZE "Session";
ANALYZE "Notification";
