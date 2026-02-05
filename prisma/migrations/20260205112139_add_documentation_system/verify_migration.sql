-- Verification Script for Documentation System Migration
-- Run this after applying the migration to verify everything is set up correctly

-- 1. Verify all tables exist
SELECT table_name, table_type
FROM information_schema.tables
WHERE
    table_schema = 'public'
    AND table_name LIKE 'Documentation%'
ORDER BY table_name;

-- Expected output: 7 tables
-- DocumentationDocument, DocumentationVersion, DocumentationSuggestion,
-- DocumentationPageView, DocumentationSearch, DocumentationFeedback, DocumentationRedirect

-- 2. Verify enums exist
SELECT t.typname as enum_name, e.enumlabel as enum_value
FROM pg_type t
    JOIN pg_enum e ON t.oid = e.enumtypid
WHERE
    t.typname LIKE 'Documentation%'
ORDER BY t.typname, e.enumsortorder;

-- Expected output:
-- DocumentationType: TENANT, ADMIN
-- DocumentationSuggestionStatus: PENDING, APPROVED, REJECTED

-- 3. Verify indexes exist
SELECT
    schemaname,
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE
    tablename LIKE 'Documentation%'
ORDER BY tablename, indexname;

-- Expected output: Multiple indexes per table as defined in migration

-- 4. Verify foreign key constraints
SELECT
    tc.table_name,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name,
    tc.constraint_name
FROM
    information_schema.table_constraints AS tc
    JOIN information_schema.key_column_usage AS kcu ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage AS ccu ON ccu.constraint_name = tc.constraint_name
    AND ccu.table_schema = tc.table_schema
WHERE
    tc.constraint_type = 'FOREIGN KEY'
    AND tc.table_name LIKE 'Documentation%'
ORDER BY tc.table_name;

-- Expected output: Foreign keys for documentId references

-- 5. Verify unique constraints
SELECT tc.table_name, tc.constraint_name, kcu.column_name
FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
WHERE
    tc.constraint_type = 'UNIQUE'
    AND tc.table_name LIKE 'Documentation%'
ORDER BY tc.table_name, tc.constraint_name;

-- Expected output: Unique constraints on (type, slug) and oldPath

-- 6. Test insert and query (optional - comment out if not needed)
-- Insert a test document
INSERT INTO "DocumentationDocument" (
    id, type, slug, title, content, "htmlContent", category, metadata, "updatedAt"
) VALUES (
    gen_random_uuid(),
    'TENANT',
    'test-document',
    'Test Document',
    '# Test\n\nThis is a test document.',
    '<h1>Test</h1><p>This is a test document.</p>',
    'getting-started',
    '{"tags": ["test"], "author": "System"}'::jsonb,
    NOW()
);

-- Verify the insert
SELECT id, type, slug, title, category
FROM "DocumentationDocument"
WHERE
    slug = 'test-document';

-- Clean up test data
DELETE FROM "DocumentationDocument" WHERE slug = 'test-document';

-- 7. Verify table sizes (should be 0 for new migration)
SELECT
    schemaname,
    tablename,
    pg_size_pretty (
        pg_total_relation_size (
            schemaname || '.' || tablename
        )
    ) AS size,
    pg_total_relation_size (
        schemaname || '.' || tablename
    ) AS size_bytes
FROM pg_tables
WHERE
    schemaname = 'public'
    AND tablename LIKE 'Documentation%'
ORDER BY size_bytes DESC;

-- 8. Check for any errors in the migration
SELECT 'Migration verification complete' as status, COUNT(*) as table_count
FROM information_schema.tables
WHERE
    table_schema = 'public'
    AND table_name LIKE 'Documentation%';

-- Expected: status = 'Migration verification complete', table_count = 7