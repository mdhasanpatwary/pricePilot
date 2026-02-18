-- CreateTable
CREATE TABLE "DomainFingerprint" (
    "id" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "fingerprintHash" TEXT NOT NULL,
    "fingerprint" JSONB NOT NULL,
    "changeCount" INTEGER NOT NULL DEFAULT 0,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastChangedAt" TIMESTAMP(3),
    "lastAlertAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DomainFingerprint_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DomainFingerprint_domain_key" ON "DomainFingerprint"("domain");

-- CreateIndex
CREATE INDEX "DomainFingerprint_domain_idx" ON "DomainFingerprint"("domain");

-- CreateIndex
CREATE INDEX "DomainFingerprint_fingerprintHash_idx" ON "DomainFingerprint"("fingerprintHash");

-- CreateIndex
CREATE INDEX "DomainFingerprint_lastChangedAt_idx" ON "DomainFingerprint"("lastChangedAt");

