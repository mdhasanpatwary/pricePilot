-- Add performance indexes for documentation search
-- These indexes optimize search queries and improve response times

-- Full-text search index with GIN (Generalized Inverted Index)
-- This index significantly speeds up full-text search queries
CREATE INDEX IF NOT EXISTS "idx_docs_fulltext_search" ON "DocumentationDocument" USING GIN (
    to_tsvector (
        'english',
        title || ' ' || title || ' ' || content
    )
);

-- Composite index for type + category filtering
-- Optimizes queries that filter by both type and category
CREATE INDEX IF NOT EXISTS "idx_docs_type_category_updated" ON "DocumentationDocument"(type, category, "updatedAt" DESC);

-- Index for search analytics queries
CREATE INDEX IF NOT EXISTS "idx_search_type_date_results" ON "DocumentationSearch"(type, "searchedAt" DESC, "resultsCount");

-- Index for popular pages analytics
CREATE INDEX IF NOT EXISTS "idx_pageviews_doc_count" ON "DocumentationPageView" ("documentId", "viewedAt" DESC);

-- Index for feedback aggregation
CREATE INDEX IF NOT EXISTS "idx_feedback_doc_rating" ON "DocumentationFeedback" (
    "documentId",
    rating,
    "createdAt" DESC
);

-- Partial index for pending suggestions (only indexes pending status)
CREATE INDEX IF NOT EXISTS "idx_suggestions_pending" ON "DocumentationSuggestion" (status, "createdAt" DESC)
WHERE
    status = 'PENDING';

-- Index for version history queries
CREATE INDEX IF NOT EXISTS "idx_versions_doc_created" ON "DocumentationVersion" (
    "documentId",
    "createdAt" DESC
);

-- Optimize PostgreSQL full-text search configuration
-- Set default text search configuration to English
ALTER DATABASE current_database ()
SET
    default_text_search_config = 'pg_catalog.english';

-- Create statistics for query planner optimization
CREATE STATISTICS IF NOT EXISTS "docs_type_category_stats" ON type, category FROM "DocumentationDocument";

CREATE STATISTICS IF NOT EXISTS "search_type_query_stats" ON type, query FROM "DocumentationSearch";