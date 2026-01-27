-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "public"."AlertCondition" AS ENUM ('GREATER_THAN', 'LESS_THAN', 'DECREASED_BY', 'INCREASED_BY', 'OUT_OF_STOCK', 'BACK_IN_STOCK');

-- CreateEnum
CREATE TYPE "public"."AlertRuleType" AS ENUM ('PRICE_CHANGE', 'STOCK_STATUS');

-- CreateEnum
CREATE TYPE "public"."AlertTarget" AS ENUM ('ALL_PRODUCTS', 'SINGLE_PRODUCT', 'CATEGORY');

-- CreateEnum
CREATE TYPE "public"."LogicType" AS ENUM ('FIXED', 'PERCENTAGE');

-- CreateEnum
CREATE TYPE "public"."MatchStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "public"."MatchType" AS ENUM ('AUTO_SKU', 'AUTO_MODEL', 'MANUAL');

-- CreateEnum
CREATE TYPE "public"."PlanType" AS ENUM ('BASIC', 'PREMIUM', 'PRO');

-- CreateEnum
CREATE TYPE "public"."PlatformType" AS ENUM ('OPENCART', 'LARAVEL', 'GENERIC', 'SHOPIFY', 'WOOCOMMERCE', 'MAGENTO', 'PRESTASHOP', 'BIGCOMMERCE');

-- CreateEnum
CREATE TYPE "public"."Role" AS ENUM ('ADMIN', 'VIEWER', 'EDITOR');

-- CreateEnum
CREATE TYPE "public"."SiteType" AS ENUM ('USER', 'COMPETITOR');

-- CreateEnum
CREATE TYPE "public"."StrategyType" AS ENUM ('UNDERCUT', 'MATCH', 'MARGIN_LOCK', 'THRESHOLD', 'PERCENTAGE', 'INVENTORY_HIKE');

-- CreateEnum
CREATE TYPE "public"."UpdateStatus" AS ENUM ('SUCCESS', 'FAILED');

-- CreateTable
CREATE TABLE "public"."Account" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Alert" (
    "id" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "site" TEXT,
    "proxyUrl" TEXT,
    "acknowledged" BOOLEAN NOT NULL DEFAULT false,
    "acknowledgedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Alert_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."AlertRule" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "type" "public"."AlertRuleType" NOT NULL DEFAULT 'PRICE_CHANGE',
    "target" "public"."AlertTarget" NOT NULL DEFAULT 'ALL_PRODUCTS',
    "targetId" TEXT,
    "condition" "public"."AlertCondition" NOT NULL DEFAULT 'LESS_THAN',
    "value" DECIMAL(10,2) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AlertRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ApiKey" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "prefix" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "lastUsedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApiKey_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Brand" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "aliases" TEXT[],
    "logoUrl" TEXT,
    "website" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Brand_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."BulkOperationSnapshot" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "operation" TEXT NOT NULL,
    "productCount" INTEGER NOT NULL,
    "snapshot" TEXT NOT NULL,
    "changes" TEXT NOT NULL,
    "rolledBack" BOOLEAN NOT NULL DEFAULT false,
    "idempotencyKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BulkOperationSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."CaptchaSolveAttempt" (
    "id" TEXT NOT NULL,
    "site" TEXT NOT NULL,
    "captchaType" TEXT NOT NULL,
    "success" BOOLEAN NOT NULL,
    "solveTime" INTEGER NOT NULL,
    "cost" DOUBLE PRECISION NOT NULL,
    "errorMessage" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CaptchaSolveAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Category" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "parentId" TEXT,
    "level" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ChallengeAttempt" (
    "id" TEXT NOT NULL,
    "site" TEXT NOT NULL,
    "challengeType" TEXT NOT NULL,
    "solved" BOOLEAN NOT NULL,
    "duration" INTEGER NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChallengeAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ConcurrencyState" (
    "id" TEXT NOT NULL,
    "site" TEXT NOT NULL,
    "currentConcurrency" INTEGER NOT NULL DEFAULT 3,
    "activeRequests" INTEGER NOT NULL DEFAULT 0,
    "lastAdjustedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "adjustmentReason" TEXT,

    CONSTRAINT "ConcurrencyState_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."HumanSimulationConfig" (
    "id" TEXT NOT NULL,
    "typingMinDelay" INTEGER NOT NULL DEFAULT 50,
    "typingMaxDelay" INTEGER NOT NULL DEFAULT 150,
    "actionPauseMin" INTEGER NOT NULL DEFAULT 100,
    "actionPauseMax" INTEGER NOT NULL DEFAULT 2000,
    "mouseMovementEnabled" BOOLEAN NOT NULL DEFAULT true,
    "naturalCurvesEnabled" BOOLEAN NOT NULL DEFAULT true,
    "pauseBetweenFields" INTEGER NOT NULL DEFAULT 500,
    "simulateCorrections" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HumanSimulationConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Notification" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "link" TEXT,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."PasswordHistory" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PasswordHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."PriceHistory" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "price" DECIMAL(10,2) NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PriceHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."PriceUpdateLog" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "oldPrice" DECIMAL(10,2) NOT NULL,
    "newPrice" DECIMAL(10,2) NOT NULL,
    "logicType" "public"."LogicType" NOT NULL,
    "status" "public"."UpdateStatus" NOT NULL DEFAULT 'SUCCESS',
    "errorDetails" TEXT,
    "executedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PriceUpdateLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."PricingRule" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "strategy" "public"."StrategyType" NOT NULL,
    "parameter" DECIMAL(10,2) NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 1,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PricingRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Product" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "externalId" TEXT,
    "sku" TEXT,
    "url" TEXT,
    "title" TEXT NOT NULL,
    "brand" TEXT,
    "model" TEXT,
    "currentPrice" DECIMAL(10,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "lastCrawledAt" TIMESTAMP(3),
    "inStock" BOOLEAN NOT NULL DEFAULT true,
    "stockLevel" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "category" TEXT,
    "imageUrl" TEXT,
    "specifications" JSONB,
    "brandId" TEXT,
    "categoryId" TEXT,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ProductMatch" (
    "id" TEXT NOT NULL,
    "userProductId" TEXT NOT NULL,
    "competitorProductId" TEXT NOT NULL,
    "matchType" "public"."MatchType" NOT NULL DEFAULT 'AUTO_SKU',
    "confidenceScore" DECIMAL(5,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "public"."MatchStatus" NOT NULL DEFAULT 'PENDING',

    CONSTRAINT "ProductMatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ProxyHealth" (
    "id" TEXT NOT NULL,
    "proxyUrl" TEXT NOT NULL,
    "proxyType" TEXT NOT NULL,
    "isHealthy" BOOLEAN NOT NULL DEFAULT true,
    "failureCount" INTEGER NOT NULL DEFAULT 0,
    "successCount" INTEGER NOT NULL DEFAULT 0,
    "avgResponseTime" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "lastChecked" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSuccess" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProxyHealth_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ProxyMetrics" (
    "id" TEXT NOT NULL,
    "proxy" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "totalRequests" INTEGER NOT NULL,
    "successfulRequests" INTEGER NOT NULL,
    "failedRequests" INTEGER NOT NULL,
    "avgResponseTime" DOUBLE PRECISION NOT NULL,
    "successRate" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "ProxyMetrics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."RetryQueue" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "maxRetries" INTEGER NOT NULL DEFAULT 4,
    "nextRetryAt" TIMESTAMP(3) NOT NULL,
    "lastAttemptAt" TIMESTAMP(3),
    "lastError" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RetryQueue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ScrapeRetry" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "userProductId" TEXT NOT NULL,
    "reason" TEXT,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "nextAttemptAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastAttemptAt" TIMESTAMP(3),

    CONSTRAINT "ScrapeRetry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ScrapingMetrics" (
    "id" TEXT NOT NULL,
    "site" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "totalRequests" INTEGER NOT NULL,
    "successfulRequests" INTEGER NOT NULL,
    "blockedRequests" INTEGER NOT NULL,
    "challengedRequests" INTEGER NOT NULL,
    "successRate" DOUBLE PRECISION NOT NULL,
    "blockRate" DOUBLE PRECISION NOT NULL,
    "avgResponseTime" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "ScrapingMetrics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Session" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,
    "userAgent" TEXT,
    "ipAddress" TEXT,
    "lastUsedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Site" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "type" "public"."SiteType" NOT NULL,
    "platform" "public"."PlatformType" NOT NULL DEFAULT 'GENERIC',
    "baseUrl" TEXT NOT NULL,
    "apiToken" TEXT,
    "lastSyncAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "isSyncing" BOOLEAN NOT NULL DEFAULT false,
    "syncProcessed" INTEGER NOT NULL DEFAULT 0,
    "syncStartedAt" TIMESTAMP(3),
    "syncTotal" INTEGER NOT NULL DEFAULT 0,
    "syncLastAction" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "isAdvancedProtected" BOOLEAN NOT NULL DEFAULT false,
    "lastSecurityBlockAt" TIMESTAMP(3),
    "searchQueryPattern" TEXT,

    CONSTRAINT "Site_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."SiteProfile" (
    "id" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "requestsPerMinute" INTEGER NOT NULL DEFAULT 10,
    "concurrentRequests" INTEGER NOT NULL DEFAULT 2,
    "minDelay" INTEGER NOT NULL DEFAULT 1000,
    "maxDelay" INTEGER NOT NULL DEFAULT 3000,
    "delayMultiplier" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "sessionWarmupEnabled" BOOLEAN NOT NULL DEFAULT false,
    "sessionWarmupPaths" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "referrerChainEnabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SiteProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."SyncLog" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "level" TEXT NOT NULL DEFAULT 'INFO',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SyncLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."SystemConfig" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "description" TEXT,
    "type" TEXT NOT NULL DEFAULT 'string',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SystemConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Tenant" (
    "id" TEXT NOT NULL,
    "companyName" TEXT NOT NULL,
    "planType" "public"."PlanType" NOT NULL DEFAULT 'BASIC',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "competitorLimit" INTEGER NOT NULL DEFAULT 3,
    "storeLimit" INTEGER NOT NULL DEFAULT 1,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "backupConfig" JSONB,
    "slackEnabled" BOOLEAN NOT NULL DEFAULT false,
    "slackWebhookUrl" TEXT,

    CONSTRAINT "Tenant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."TenantAuditLog" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "userEmail" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "details" TEXT,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TenantAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "public"."Role" NOT NULL DEFAULT 'ADMIN',
    "tenantId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "isSuperAdmin" BOOLEAN NOT NULL DEFAULT false,
    "emailVerified" TIMESTAMP(3),
    "name" TEXT,
    "passwordUpdatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resetToken" TEXT,
    "resetTokenExpires" TIMESTAMP(3),
    "verificationToken" TEXT,
    "emailNotifications" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Webhook" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "secret" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Webhook_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Account_provider_providerAccountId_key" ON "public"."Account"("provider" ASC, "providerAccountId" ASC);

-- CreateIndex
CREATE INDEX "Alert_acknowledged_createdAt_idx" ON "public"."Alert"("acknowledged" ASC, "createdAt" ASC);

-- CreateIndex
CREATE INDEX "Alert_severity_idx" ON "public"."Alert"("severity" ASC);

-- CreateIndex
CREATE INDEX "AlertRule_tenantId_idx" ON "public"."AlertRule"("tenantId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "ApiKey_key_key" ON "public"."ApiKey"("key" ASC);

-- CreateIndex
CREATE INDEX "ApiKey_tenantId_idx" ON "public"."ApiKey"("tenantId" ASC);

-- CreateIndex
CREATE INDEX "ApiKey_userId_idx" ON "public"."ApiKey"("userId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "Brand_tenantId_slug_key" ON "public"."Brand"("tenantId" ASC, "slug" ASC);

-- CreateIndex
CREATE INDEX "BulkOperationSnapshot_createdAt_idx" ON "public"."BulkOperationSnapshot"("createdAt" ASC);

-- CreateIndex
CREATE INDEX "BulkOperationSnapshot_idempotencyKey_idx" ON "public"."BulkOperationSnapshot"("idempotencyKey" ASC);

-- CreateIndex
CREATE INDEX "BulkOperationSnapshot_tenantId_idx" ON "public"."BulkOperationSnapshot"("tenantId" ASC);

-- CreateIndex
CREATE INDEX "CaptchaSolveAttempt_captchaType_timestamp_idx" ON "public"."CaptchaSolveAttempt"("captchaType" ASC, "timestamp" ASC);

-- CreateIndex
CREATE INDEX "CaptchaSolveAttempt_site_timestamp_idx" ON "public"."CaptchaSolveAttempt"("site" ASC, "timestamp" ASC);

-- CreateIndex
CREATE INDEX "Category_tenantId_parentId_idx" ON "public"."Category"("tenantId" ASC, "parentId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "Category_tenantId_slug_key" ON "public"."Category"("tenantId" ASC, "slug" ASC);

-- CreateIndex
CREATE INDEX "ChallengeAttempt_challengeType_timestamp_idx" ON "public"."ChallengeAttempt"("challengeType" ASC, "timestamp" ASC);

-- CreateIndex
CREATE INDEX "ChallengeAttempt_site_timestamp_idx" ON "public"."ChallengeAttempt"("site" ASC, "timestamp" ASC);

-- CreateIndex
CREATE INDEX "ConcurrencyState_site_idx" ON "public"."ConcurrencyState"("site" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "ConcurrencyState_site_key" ON "public"."ConcurrencyState"("site" ASC);

-- CreateIndex
CREATE INDEX "Notification_isRead_idx" ON "public"."Notification"("isRead" ASC);

-- CreateIndex
CREATE INDEX "Notification_tenantId_idx" ON "public"."Notification"("tenantId" ASC);

-- CreateIndex
CREATE INDEX "PasswordHistory_userId_idx" ON "public"."PasswordHistory"("userId" ASC);

-- CreateIndex
CREATE INDEX "PricingRule_tenantId_idx" ON "public"."PricingRule"("tenantId" ASC);

-- CreateIndex
CREATE INDEX "Product_brandId_idx" ON "public"."Product"("brandId" ASC);

-- CreateIndex
CREATE INDEX "Product_brand_model_idx" ON "public"."Product"("brand" ASC, "model" ASC);

-- CreateIndex
CREATE INDEX "Product_categoryId_idx" ON "public"."Product"("categoryId" ASC);

-- CreateIndex
CREATE INDEX "Product_category_currentPrice_idx" ON "public"."Product"("category" ASC, "currentPrice" ASC);

-- CreateIndex
CREATE INDEX "Product_sku_idx" ON "public"."Product"("sku" ASC);

-- CreateIndex
CREATE INDEX "Product_tenantId_brand_idx" ON "public"."Product"("tenantId" ASC, "brand" ASC);

-- CreateIndex
CREATE INDEX "Product_tenantId_idx" ON "public"."Product"("tenantId" ASC);

-- CreateIndex
CREATE INDEX "ProxyHealth_isHealthy_idx" ON "public"."ProxyHealth"("isHealthy" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "ProxyHealth_proxyUrl_key" ON "public"."ProxyHealth"("proxyUrl" ASC);

-- CreateIndex
CREATE INDEX "ProxyMetrics_proxy_timestamp_idx" ON "public"."ProxyMetrics"("proxy" ASC, "timestamp" ASC);

-- CreateIndex
CREATE INDEX "RetryQueue_status_nextRetryAt_idx" ON "public"."RetryQueue"("status" ASC, "nextRetryAt" ASC);

-- CreateIndex
CREATE INDEX "RetryQueue_tenantId_siteId_idx" ON "public"."RetryQueue"("tenantId" ASC, "siteId" ASC);

-- CreateIndex
CREATE INDEX "ScrapeRetry_siteId_idx" ON "public"."ScrapeRetry"("siteId" ASC);

-- CreateIndex
CREATE INDEX "ScrapeRetry_tenantId_idx" ON "public"."ScrapeRetry"("tenantId" ASC);

-- CreateIndex
CREATE INDEX "ScrapeRetry_userProductId_idx" ON "public"."ScrapeRetry"("userProductId" ASC);

-- CreateIndex
CREATE INDEX "ScrapingMetrics_site_timestamp_idx" ON "public"."ScrapingMetrics"("site" ASC, "timestamp" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "Session_sessionToken_key" ON "public"."Session"("sessionToken" ASC);

-- CreateIndex
CREATE INDEX "SiteProfile_domain_idx" ON "public"."SiteProfile"("domain" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "SiteProfile_domain_key" ON "public"."SiteProfile"("domain" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "SystemConfig_key_key" ON "public"."SystemConfig"("key" ASC);

-- CreateIndex
CREATE INDEX "TenantAuditLog_tenantId_idx" ON "public"."TenantAuditLog"("tenantId" ASC);

-- CreateIndex
CREATE INDEX "TenantAuditLog_userId_idx" ON "public"."TenantAuditLog"("userId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "public"."User"("email" ASC);

-- CreateIndex
CREATE INDEX "Webhook_tenantId_idx" ON "public"."Webhook"("tenantId" ASC);

-- AddForeignKey
ALTER TABLE "public"."Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AlertRule" ADD CONSTRAINT "AlertRule_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ApiKey" ADD CONSTRAINT "ApiKey_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ApiKey" ADD CONSTRAINT "ApiKey_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Brand" ADD CONSTRAINT "Brand_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."BulkOperationSnapshot" ADD CONSTRAINT "BulkOperationSnapshot_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Category" ADD CONSTRAINT "Category_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "public"."Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Category" ADD CONSTRAINT "Category_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Notification" ADD CONSTRAINT "Notification_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PasswordHistory" ADD CONSTRAINT "PasswordHistory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PriceHistory" ADD CONSTRAINT "PriceHistory_productId_fkey" FOREIGN KEY ("productId") REFERENCES "public"."Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PriceUpdateLog" ADD CONSTRAINT "PriceUpdateLog_productId_fkey" FOREIGN KEY ("productId") REFERENCES "public"."Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PricingRule" ADD CONSTRAINT "PricingRule_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Product" ADD CONSTRAINT "Product_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "public"."Brand"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Product" ADD CONSTRAINT "Product_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "public"."Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Product" ADD CONSTRAINT "Product_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "public"."Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Product" ADD CONSTRAINT "Product_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ProductMatch" ADD CONSTRAINT "ProductMatch_competitorProductId_fkey" FOREIGN KEY ("competitorProductId") REFERENCES "public"."Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ProductMatch" ADD CONSTRAINT "ProductMatch_userProductId_fkey" FOREIGN KEY ("userProductId") REFERENCES "public"."Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ScrapeRetry" ADD CONSTRAINT "ScrapeRetry_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "public"."Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ScrapeRetry" ADD CONSTRAINT "ScrapeRetry_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ScrapeRetry" ADD CONSTRAINT "ScrapeRetry_userProductId_fkey" FOREIGN KEY ("userProductId") REFERENCES "public"."Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Site" ADD CONSTRAINT "Site_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SyncLog" ADD CONSTRAINT "SyncLog_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "public"."Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."TenantAuditLog" ADD CONSTRAINT "TenantAuditLog_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."User" ADD CONSTRAINT "User_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Webhook" ADD CONSTRAINT "Webhook_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

