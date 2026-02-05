-- CreateEnum
CREATE TYPE "DocumentationType" AS ENUM ('TENANT', 'ADMIN');

-- CreateEnum
CREATE TYPE "DocumentationSuggestionStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "DocumentationDocument" (
    "id" TEXT NOT NULL,
    "type" "DocumentationType" NOT NULL,
    "slug" TEXT NOT NULL,
    "title" VARCHAR(500) NOT NULL,
    "content" TEXT NOT NULL,
    "htmlContent" TEXT NOT NULL,
    "category" VARCHAR(100) NOT NULL,
    "subcategory" VARCHAR(100),
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" TEXT,
    CONSTRAINT "DocumentationDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentationVersion" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "changeDescription" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DocumentationVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentationSuggestion" (
    "id" TEXT NOT NULL,
    "documentId" TEXT,
    "suggestedTitle" VARCHAR(500),
    "suggestedContent" TEXT NOT NULL,
    "targetType" "DocumentationType" NOT NULL,
    "category" VARCHAR(100) NOT NULL,
    "status" "DocumentationSuggestionStatus" NOT NULL DEFAULT 'PENDING',
    "taskId" VARCHAR(255),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    CONSTRAINT "DocumentationSuggestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentationPageView" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "type" "DocumentationType" NOT NULL,
    "userId" TEXT,
    "sessionId" VARCHAR(255),
    "viewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "timeOnPage" INTEGER,
    CONSTRAINT "DocumentationPageView_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentationSearch" (
    "id" TEXT NOT NULL,
    "query" TEXT NOT NULL,
    "type" "DocumentationType" NOT NULL,
    "resultsCount" INTEGER NOT NULL,
    "clickedResultId" TEXT,
    "searchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DocumentationSearch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentationFeedback" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DocumentationFeedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentationRedirect" (
    "id" TEXT NOT NULL,
    "oldPath" VARCHAR(500) NOT NULL,
    "newPath" VARCHAR(500) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DocumentationRedirect_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DocumentationDocument_type_slug_key" ON "DocumentationDocument" ("type", "slug");

-- CreateIndex
CREATE INDEX "DocumentationDocument_type_category_idx" ON "DocumentationDocument" ("type", "category");

-- CreateIndex
CREATE INDEX "DocumentationDocument_slug_idx" ON "DocumentationDocument" ("slug");

-- CreateIndex
CREATE INDEX "DocumentationDocument_updatedAt_idx" ON "DocumentationDocument" ("updatedAt" DESC);

-- CreateIndex
CREATE INDEX "DocumentationVersion_documentId_createdAt_idx" ON "DocumentationVersion" (
    "documentId",
    "createdAt" DESC
);

-- CreateIndex
CREATE INDEX "DocumentationSuggestion_status_createdAt_idx" ON "DocumentationSuggestion" ("status", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "DocumentationSuggestion_documentId_idx" ON "DocumentationSuggestion" ("documentId");

-- CreateIndex
CREATE INDEX "DocumentationPageView_documentId_viewedAt_idx" ON "DocumentationPageView" ("documentId", "viewedAt" DESC);

-- CreateIndex
CREATE INDEX "DocumentationPageView_type_viewedAt_idx" ON "DocumentationPageView" ("type", "viewedAt" DESC);

-- CreateIndex
CREATE INDEX "DocumentationSearch_type_searchedAt_idx" ON "DocumentationSearch" ("type", "searchedAt" DESC);

-- CreateIndex
CREATE INDEX "DocumentationSearch_query_idx" ON "DocumentationSearch" ("query");

-- CreateIndex
CREATE INDEX "DocumentationFeedback_documentId_createdAt_idx" ON "DocumentationFeedback" (
    "documentId",
    "createdAt" DESC
);

-- CreateIndex
CREATE INDEX "DocumentationFeedback_rating_idx" ON "DocumentationFeedback" ("rating");

-- CreateIndex
CREATE UNIQUE INDEX "DocumentationRedirect_oldPath_key" ON "DocumentationRedirect" ("oldPath");

-- CreateIndex
CREATE INDEX "DocumentationRedirect_oldPath_idx" ON "DocumentationRedirect" ("oldPath");

-- AddForeignKey
ALTER TABLE "DocumentationVersion"
ADD CONSTRAINT "DocumentationVersion_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "DocumentationDocument" ("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentationSuggestion"
ADD CONSTRAINT "DocumentationSuggestion_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "DocumentationDocument" ("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentationPageView"
ADD CONSTRAINT "DocumentationPageView_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "DocumentationDocument" ("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentationFeedback"
ADD CONSTRAINT "DocumentationFeedback_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "DocumentationDocument" ("id") ON DELETE CASCADE ON UPDATE CASCADE;