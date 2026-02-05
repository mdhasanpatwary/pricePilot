-- Full-Text Search Indexes for Documentation System
-- Run this after the main migration to enable optimized full-text search

-- Enable pg_trgm extension for fuzzy text search (if not already enabled)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Add GIN index for full-text search on DocumentationDocument
-- This index supports fast full-text queries on title and content
CREATE INDEX IF NOT EXISTS idx_documentation_document_fulltext ON "DocumentationDocument" USING GIN (
    to_tsvector (
        'english',
        title || ' ' || content
    )
);

-- Add GIN index for trigram similarity search on title
-- This supports fuzzy matching and typo tolerance
CREATE INDEX IF NOT EXISTS idx_documentation_document_title_trgm ON "DocumentationDocument" USING GIN (title gin_trgm_ops);

-- Add GIN index for trigram similarity search on content
-- This supports fuzzy matching in content
CREATE INDEX IF NOT EXISTS idx_documentation_document_content_trgm ON "DocumentationDocument" USING GIN (content gin_trgm_ops);

-- Add index for search query analysis
-- This helps identify popular search terms
CREATE INDEX IF NOT EXISTS idx_documentation_search_query_trgm ON "DocumentationSearch" USING GIN (query gin_trgm_ops);

-- Verify indexes were created
SELECT
    schemaname,
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE
    tablename LIKE 'Documentation%'
    AND indexname LIKE '%fulltext%'
    OR indexname LIKE '%trgm%'
ORDER BY tablename, indexname;