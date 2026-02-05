# Documentation System Migration

## Overview

This migration adds the database schema for the dual documentation system, which provides separate documentation portals for tenant users (`/docs`) and system administrators (`/admin-docs`).

## Tables Created

### DocumentationDocument
Main table storing documentation content with the following features:
- **Type-based separation**: TENANT or ADMIN documentation
- **Slug-based routing**: Unique slugs per type for URL generation
- **Rich content**: Stores both raw Markdown and processed HTML
- **Categorization**: Hierarchical organization with category and subcategory
- **Metadata**: Flexible JSON field for tags, author, related docs, etc.
- **Version tracking**: Links to version history

**Indexes:**
- Unique index on `(type, slug)` for fast lookups
- Composite index on `(type, category)` for category browsing
- Index on `slug` for redirect handling
- Index on `updatedAt` for recent changes queries

### DocumentationVersion
Version history table for tracking all changes to documentation:
- Stores previous content before updates
- Records who made the change and when
- Supports change descriptions for audit trail
- Enables revert functionality

**Indexes:**
- Composite index on `(documentId, createdAt DESC)` for version history queries

### DocumentationSuggestion
Automated documentation update suggestions from the documentation hook:
- Links to existing documents or suggests new ones
- Stores suggested content for review
- Tracks approval workflow (PENDING, APPROVED, REJECTED)
- Links to task IDs that triggered the suggestion

**Indexes:**
- Composite index on `(status, createdAt DESC)` for pending review queries
- Index on `documentId` for finding suggestions per document

### DocumentationPageView
Analytics table for tracking page views:
- Records document views with timestamps
- Tracks user IDs (if authenticated) and session IDs
- Measures time spent on page
- Separates tenant vs admin portal views

**Indexes:**
- Composite index on `(documentId, viewedAt DESC)` for per-document analytics
- Composite index on `(type, viewedAt DESC)` for portal-wide analytics

### DocumentationSearch
Search analytics table:
- Logs all search queries
- Tracks result counts
- Records clicked results for relevance tuning
- Separates tenant vs admin searches

**Indexes:**
- Composite index on `(type, searchedAt DESC)` for search analytics
- Index on `query` for popular search terms

### DocumentationFeedback
User feedback on documentation quality:
- 1-5 star ratings
- Optional comments
- Links to user (if authenticated)
- Helps identify documentation gaps

**Indexes:**
- Composite index on `(documentId, createdAt DESC)` for per-document feedback
- Index on `rating` for low-rated content identification

### DocumentationRedirect
URL redirects for migrated documentation:
- Maps old paths to new paths
- Supports documentation reorganization
- Prevents broken links after migration

**Indexes:**
- Unique index on `oldPath` for fast redirect lookups

## Enums Created

### DocumentationType
- `TENANT`: Documentation for regular users at `/docs`
- `ADMIN`: Documentation for administrators at `/admin-docs`

### DocumentationSuggestionStatus
- `PENDING`: Awaiting review
- `APPROVED`: Accepted and published
- `REJECTED`: Declined

## Multi-Tenancy Considerations

**Note:** The documentation tables do NOT include `tenantId` columns because:
1. Documentation content is system-wide, not tenant-specific
2. Tenant docs are accessible to all users (public)
3. Admin docs are role-restricted, not tenant-restricted
4. This follows the design principle that documentation is about the PricePilot system itself, not tenant data

## Full-Text Search Support

The migration includes indexes to support PostgreSQL full-text search:
- The application will use `to_tsvector()` on title and content fields
- Search queries will use `to_tsquery()` for ranking
- Future enhancement: Add GIN indexes for better full-text search performance

Example query pattern:
```sql
SELECT * FROM "DocumentationDocument"
WHERE type = 'TENANT'
AND to_tsvector('english', title || ' ' || content) @@ to_tsquery('english', 'price & update')
ORDER BY ts_rank(to_tsvector('english', title || ' ' || content), to_tsquery('english', 'price & update')) DESC;
```

## Performance Considerations

### Index Strategy
- All foreign keys are indexed automatically
- Composite indexes support common query patterns
- DESC indexes on timestamps for recent-first queries
- Unique constraints prevent duplicate slugs per type

### Expected Query Patterns
1. **Document retrieval**: `WHERE type = ? AND slug = ?` (uses unique index)
2. **Category browsing**: `WHERE type = ? AND category = ?` (uses composite index)
3. **Version history**: `WHERE documentId = ? ORDER BY createdAt DESC` (uses composite index)
4. **Analytics queries**: Time-range queries on viewedAt/searchedAt (uses DESC indexes)
5. **Feedback aggregation**: `WHERE documentId = ?` (uses composite index)

## Migration Safety

This migration is **safe to run** because:
- Creates new tables only (no modifications to existing tables)
- No data migration required
- No foreign key constraints to existing tables
- Can be rolled back cleanly if needed

## Rollback

To rollback this migration:
```sql
DROP TABLE IF EXISTS "DocumentationFeedback" CASCADE;
DROP TABLE IF EXISTS "DocumentationPageView" CASCADE;
DROP TABLE IF EXISTS "DocumentationSearch" CASCADE;
DROP TABLE IF EXISTS "DocumentationSuggestion" CASCADE;
DROP TABLE IF EXISTS "DocumentationVersion" CASCADE;
DROP TABLE IF EXISTS "DocumentationRedirect" CASCADE;
DROP TABLE IF EXISTS "DocumentationDocument" CASCADE;
DROP TYPE IF EXISTS "DocumentationSuggestionStatus";
DROP TYPE IF EXISTS "DocumentationType";
```

## Next Steps

After applying this migration:
1. Generate Prisma Client: `npx prisma generate`
2. Verify tables created: `npx prisma db pull`
3. Create initial documentation content in `/docs-content/` directories
4. Implement documentation service layer
5. Build frontend components for `/docs` and `/admin-docs` routes

## Requirements Validated

This migration satisfies the following requirements from the spec:
- **Requirement 3.1**: Documentation content organization (via type, category, subcategory)
- **Requirement 6.1**: Migration support (via DocumentationRedirect table)
- **Requirement 7.1**: Version history tracking (via DocumentationVersion table)
- **Requirement 9.1**: Analytics tracking (via DocumentationPageView, DocumentationSearch, DocumentationFeedback tables)

## Related Files

- Schema definition: `prisma/schema.prisma`
- Design document: `.kiro/specs/dual-documentation-system/design.md`
- Requirements: `.kiro/specs/dual-documentation-system/requirements.md`
- Tasks: `.kiro/specs/dual-documentation-system/tasks.md`
