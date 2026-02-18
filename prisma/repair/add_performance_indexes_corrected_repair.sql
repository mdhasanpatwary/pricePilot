-- Idempotent repair for prisma/migrations/add_performance_indexes_corrected
-- Fixes invalid partial index predicate that uses NOW() (volatile).

-- Re-apply the original migration statements safely. Everything uses IF NOT EXISTS.
-- Only change: Session_expires_active_idx is created as a normal index (no NOW() predicate).

-- ============================================================================
-- TENANT
-- ============================================================================
CREATE INDEX IF NOT EXISTS "Tenant_createdAt_desc_idx" ON "Tenant" ("createdAt" DESC);
CREATE INDEX IF NOT EXISTS "Tenant_planType_idx" ON "Tenant" ("planType");
CREATE INDEX IF NOT EXISTS "Tenant_planType_createdAt_idx" ON "Tenant" ("planType", "createdAt" DESC);

-- ============================================================================
-- PRODUCT
-- ============================================================================
CREATE INDEX IF NOT EXISTS "Product_tenantId_siteId_idx" ON "Product" ("tenantId", "siteId");
CREATE INDEX IF NOT EXISTS "Product_tenantId_idx" ON "Product" ("tenantId");
CREATE INDEX IF NOT EXISTS "Product_siteId_idx" ON "Product" ("siteId");
CREATE INDEX IF NOT EXISTS "Product_sku_idx" ON "Product" ("sku") WHERE "sku" IS NOT NULL;
CREATE INDEX IF NOT EXISTS "Product_tenantId_sku_idx" ON "Product" ("tenantId", "sku") WHERE "sku" IS NOT NULL;
CREATE INDEX IF NOT EXISTS "Product_currentPrice_idx" ON "Product" ("currentPrice");
CREATE INDEX IF NOT EXISTS "Product_tenantId_currentPrice_idx" ON "Product" ("tenantId", "currentPrice");
CREATE INDEX IF NOT EXISTS "Product_brand_model_idx" ON "Product" ("brand", "model")
WHERE "brand" IS NOT NULL AND "model" IS NOT NULL;
CREATE INDEX IF NOT EXISTS "Product_tenantId_brand_idx" ON "Product" ("tenantId", "brand") WHERE "brand" IS NOT NULL;
CREATE INDEX IF NOT EXISTS "Product_updatedAt_desc_idx" ON "Product" ("updatedAt" DESC);
CREATE INDEX IF NOT EXISTS "Product_tenantId_updatedAt_idx" ON "Product" ("tenantId", "updatedAt" DESC);
CREATE INDEX IF NOT EXISTS "Product_inStock_idx" ON "Product" ("inStock");
CREATE INDEX IF NOT EXISTS "Product_title_gin_idx" ON "Product" USING gin (to_tsvector('english', "title"));

-- ============================================================================
-- SITE
-- ============================================================================
CREATE INDEX IF NOT EXISTS "Site_tenantId_type_idx" ON "Site" ("tenantId", "type");
CREATE INDEX IF NOT EXISTS "Site_isSyncing_idx" ON "Site" ("isSyncing") WHERE "isSyncing" = true;
CREATE INDEX IF NOT EXISTS "Site_tenantId_isSyncing_idx" ON "Site" ("tenantId", "isSyncing");
CREATE INDEX IF NOT EXISTS "Site_type_idx" ON "Site" ("type");
CREATE INDEX IF NOT EXISTS "Site_lastSyncAt_idx" ON "Site" ("lastSyncAt" DESC) WHERE "lastSyncAt" IS NOT NULL;

-- ============================================================================
-- PRODUCTMATCH
-- ============================================================================
CREATE INDEX IF NOT EXISTS "ProductMatch_userProductId_idx" ON "ProductMatch" ("userProductId");
CREATE INDEX IF NOT EXISTS "ProductMatch_competitorProductId_idx" ON "ProductMatch" ("competitorProductId");
CREATE INDEX IF NOT EXISTS "ProductMatch_userProductId_status_idx" ON "ProductMatch" ("userProductId", "status");
CREATE INDEX IF NOT EXISTS "ProductMatch_status_idx" ON "ProductMatch" ("status");
CREATE INDEX IF NOT EXISTS "ProductMatch_matchType_idx" ON "ProductMatch" ("matchType");

-- ============================================================================
-- PRICEHISTORY
-- ============================================================================
CREATE INDEX IF NOT EXISTS "PriceHistory_productId_recordedAt_idx" ON "PriceHistory" ("productId", "recordedAt" DESC);
CREATE INDEX IF NOT EXISTS "PriceHistory_recordedAt_desc_idx" ON "PriceHistory" ("recordedAt" DESC);

-- ============================================================================
-- PRICEUPDATELOG
-- ============================================================================
CREATE INDEX IF NOT EXISTS "PriceUpdateLog_productId_idx" ON "PriceUpdateLog" ("productId");
CREATE INDEX IF NOT EXISTS "PriceUpdateLog_productId_executedAt_idx" ON "PriceUpdateLog" ("productId", "executedAt" DESC);
CREATE INDEX IF NOT EXISTS "PriceUpdateLog_status_idx" ON "PriceUpdateLog" ("status");
CREATE INDEX IF NOT EXISTS "PriceUpdateLog_logicType_idx" ON "PriceUpdateLog" ("logicType");

-- ============================================================================
-- PRICINGRULE
-- ============================================================================
CREATE INDEX IF NOT EXISTS "PricingRule_tenantId_isActive_idx" ON "PricingRule" ("tenantId", "isActive");
CREATE INDEX IF NOT EXISTS "PricingRule_priority_idx" ON "PricingRule" ("priority");
CREATE INDEX IF NOT EXISTS "PricingRule_tenantId_priority_idx" ON "PricingRule" ("tenantId", "priority");

-- ============================================================================
-- TENANTAUDITLOG
-- ============================================================================
CREATE INDEX IF NOT EXISTS "TenantAuditLog_tenantId_createdAt_idx" ON "TenantAuditLog" ("tenantId", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS "TenantAuditLog_userId_createdAt_idx" ON "TenantAuditLog" ("userId", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS "TenantAuditLog_action_idx" ON "TenantAuditLog" ("action");
CREATE INDEX IF NOT EXISTS "TenantAuditLog_entityId_createdAt_idx" ON "TenantAuditLog" ("entityId", "createdAt" DESC);

-- ============================================================================
-- USER
-- ============================================================================
CREATE INDEX IF NOT EXISTS "User_tenantId_role_idx" ON "User" ("tenantId", "role");
CREATE INDEX IF NOT EXISTS "User_emailVerified_idx" ON "User" ("emailVerified") WHERE "emailVerified" IS NOT NULL;
CREATE INDEX IF NOT EXISTS "User_isSuperAdmin_idx" ON "User" ("isSuperAdmin") WHERE "isSuperAdmin" = true;

-- ============================================================================
-- SESSION
-- ============================================================================
CREATE INDEX IF NOT EXISTS "Session_sessionToken_idx" ON "Session" ("sessionToken");
CREATE INDEX IF NOT EXISTS "Session_userId_idx" ON "Session" ("userId");
-- NOTE: Cannot use NOW() in partial index predicate (volatile). Use a normal index instead.
CREATE INDEX IF NOT EXISTS "Session_expires_active_idx" ON "Session" ("expires");

-- ============================================================================
-- NOTIFICATION
-- ============================================================================
CREATE INDEX IF NOT EXISTS "Notification_tenantId_isRead_idx" ON "Notification" ("tenantId", "isRead");
CREATE INDEX IF NOT EXISTS "Notification_tenantId_createdAt_idx" ON "Notification" ("tenantId", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS "Notification_isRead_false_idx" ON "Notification" ("tenantId", "createdAt" DESC) WHERE "isRead" = false;

-- ============================================================================
-- PENDINGPRICECHANGE
-- ============================================================================
CREATE INDEX IF NOT EXISTS "PendingPriceChange_tenantId_status_idx" ON "PendingPriceChange" ("tenantId", "status");
CREATE INDEX IF NOT EXISTS "PendingPriceChange_productId_idx" ON "PendingPriceChange" ("productId");
CREATE INDEX IF NOT EXISTS "PendingPriceChange_expiresAt_idx" ON "PendingPriceChange" ("expiresAt");
CREATE INDEX IF NOT EXISTS "PendingPriceChange_pending_idx" ON "PendingPriceChange" ("tenantId", "expiresAt") WHERE "status" = 'PENDING';

-- ============================================================================
-- BRAND
-- ============================================================================
CREATE INDEX IF NOT EXISTS "Brand_tenantId_slug_idx" ON "Brand" ("tenantId", "slug");
CREATE INDEX IF NOT EXISTS "Brand_name_idx" ON "Brand" ("name");

-- ============================================================================
-- CATEGORY
-- ============================================================================
CREATE INDEX IF NOT EXISTS "Category_tenantId_parentId_idx" ON "Category" ("tenantId", "parentId");
CREATE INDEX IF NOT EXISTS "Category_level_idx" ON "Category" ("level");

-- ============================================================================
-- SCRAPEATTEMPT
-- ============================================================================
CREATE INDEX IF NOT EXISTS "ScrapeAttempt_tenantId_createdAt_idx" ON "ScrapeAttempt" ("tenantId", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS "ScrapeAttempt_success_idx" ON "ScrapeAttempt" ("success");
CREATE INDEX IF NOT EXISTS "ScrapeAttempt_competitorWebsiteId_createdAt_idx" ON "ScrapeAttempt" ("competitorWebsiteId", "createdAt" DESC);

