-- Add documentation logging table for monitoring and auditing

CREATE TABLE IF NOT EXISTS "DocumentationLog" (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid (),
    level VARCHAR(10) NOT NULL,
    category VARCHAR(50) NOT NULL,
    message TEXT NOT NULL,
    metadata JSONB DEFAULT '{}',
    "userId" VARCHAR(255),
    "documentId" UUID,
    "errorStack" TEXT,
    "createdAt" TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Indexes for efficient log queries
CREATE INDEX IF NOT EXISTS "idx_doclog_category_created" ON "DocumentationLog" (category, "createdAt" DESC);

CREATE INDEX IF NOT EXISTS "idx_doclog_level_created" ON "DocumentationLog" (level, "createdAt" DESC);

CREATE INDEX IF NOT EXISTS "idx_doclog_user" ON "DocumentationLog" ("userId", "createdAt" DESC);

CREATE INDEX IF NOT EXISTS "idx_doclog_document" ON "DocumentationLog" (
    "documentId",
    "createdAt" DESC
);

CREATE INDEX IF NOT EXISTS "idx_doclog_created" ON "DocumentationLog" ("createdAt" DESC);

-- Partial index for errors only (most important for monitoring)
CREATE INDEX IF NOT EXISTS "idx_doclog_errors" ON "DocumentationLog" (category, "createdAt" DESC)
WHERE
    level = 'ERROR';

-- Add comment for documentation
COMMENT ON
TABLE "DocumentationLog" IS 'Comprehensive logging for documentation system operations, modifications, and errors';