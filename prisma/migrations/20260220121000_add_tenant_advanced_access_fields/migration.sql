-- Add tenant-managed advanced anti-bot access fields to Site
ALTER TABLE "Site"
  ADD COLUMN "advancedAccessStatus" TEXT NOT NULL DEFAULT 'NOT_REQUIRED',
  ADD COLUMN "advancedAccessRequiredAt" TIMESTAMP(3),
  ADD COLUMN "advancedAccessReason" TEXT,
  ADD COLUMN "tenantProxyEnabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "tenantProxyProtocol" TEXT,
  ADD COLUMN "tenantProxyHost" TEXT,
  ADD COLUMN "tenantProxyPort" INTEGER,
  ADD COLUMN "tenantProxyUsername" TEXT,
  ADD COLUMN "tenantProxyPasswordEncrypted" TEXT,
  ADD COLUMN "tenantCaptchaEnabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "tenantCaptchaProvider" TEXT,
  ADD COLUMN "tenantCaptchaApiKeyEncrypted" TEXT;

CREATE INDEX IF NOT EXISTS "Site_tenantId_type_advancedAccessStatus_idx"
  ON "Site"("tenantId", "type", "advancedAccessStatus");
