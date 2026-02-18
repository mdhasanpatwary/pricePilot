-- CreateTable
CREATE TABLE "DomainProfile" (
    "id" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "platformType" "PlatformType",
    "protectionLevel" TEXT NOT NULL DEFAULT 'UNKNOWN',
    "avgSuccessRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "blockRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "avgResponseTime" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DomainProfile_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DomainProfile_domain_key" ON "DomainProfile"("domain");

-- CreateIndex
CREATE INDEX "DomainProfile_platformType_idx" ON "DomainProfile"("platformType");

-- CreateIndex
CREATE INDEX "DomainProfile_protectionLevel_idx" ON "DomainProfile"("protectionLevel");

