# Implementation Plan: Dual Documentation System

## Overview

This implementation plan breaks down the dual documentation system into discrete, incremental coding tasks. Each task builds on previous work, with early validation through code and testing. The system will be implemented in TypeScript using Next.js 14 with the App Router, following the project's existing architecture and design principles.

**Important Context**: PricePilot already has 100+ documentation files in the `/docs` folder covering various topics. This implementation will:
1. Create a new dual-portal system with separate tenant and admin documentation
2. Migrate existing documentation to the new structure (not create from scratch)
3. Add database-backed versioning, search, and analytics capabilities
4. Implement automated documentation maintenance via hooks

## Tasks

- [x] 1. Set up database schema and migrations
  - Create Prisma schema for documentation tables (documents, versions, suggestions, analytics, feedback, redirects)
  - Add indexes for performance (type+category, slug, full-text search)
  - Generate and test migration files
  - Verify multi-tenancy support (tenantId columns where applicable)
  - _Requirements: 3.1, 6.1, 7.1, 9.1_

- [x] 2. Create documentation file system structure
  - Create `/docs-content/tenant/` directory with category subdirectories
  - Create `/docs-content/admin/` directory with category subdirectories
  - Set up initial documentation files with frontmatter examples
  - Create utility to validate directory structure
  - _Requirements: 3.1, 3.2_

- [x] 3. Implement Markdown parser and processor
  - [x] 3.1 Create Markdown parser with frontmatter support
    - Use unified/remark/rehype ecosystem
    - Parse frontmatter metadata (title, description, category, tags)
    - Generate HTML from Markdown
    - _Requirements: 3.3_
  
  - [x] 3.2 Add syntax highlighting for code blocks
    - Integrate Shiki for syntax highlighting
    - Support multiple programming languages
    - Add language detection for unlabeled code blocks
    - _Requirements: 3.4_
  
  - [x] 3.3 Add Mermaid diagram support
    - Integrate Mermaid for diagram rendering
    - Handle diagram parsing errors gracefully
    - Support common diagram types (flowchart, sequence, class)
    - _Requirements: 3.5_
  
  - [x] 3.4 Implement internal link validation
    - Parse internal links from Markdown content
    - Validate that target documents exist
    - Generate warnings for broken links
    - _Requirements: 3.6_

- [x] 4. Build Documentation Service
  - [x] 4.1 Implement core document retrieval methods
    - `getDocument(type, slug)` - fetch single document
    - `listDocuments(type, category)` - list documents by category
    - `getTableOfContents(type)` - build hierarchical TOC
    - `getBreadcrumbs(type, slug)` - generate breadcrumb trail
    - _Requirements: 1.2, 1.7, 2.4_
  
  - [x] 4.2 Implement document management methods
    - `createDocument()` - create new documentation
    - `updateDocument()` - update existing documentation
    - Store previous version before updating
    - Record user, timestamp, and change description
    - _Requirements: 7.1, 7.2_
  
  - [x] 4.3 Implement version history methods
    - `getDocumentHistory()` - retrieve version history
    - `revertDocument()` - revert to previous version
    - Generate diffs between versions
    - Create new version entry on revert
    - _Requirements: 7.3, 7.4, 7.5, 7.6_

- [x] 5. Implement Search Service
  - [x] 5.1 Create search indexing functionality
    - `indexDocument()` - add document to search index
    - Use PostgreSQL full-text search with tsvector
    - Index title, headings, and content separately
    - Support incremental index updates
    - _Requirements: 4.5_
  
  - [x] 5.2 Implement search query execution
    - `search(query, type, options)` - execute search
    - Rank results by relevance (title > heading > content)
    - Filter by type (tenant/admin) for isolation
    - Support pagination and filtering
    - _Requirements: 1.4, 2.6, 4.3_
  
  - [x] 5.3 Add search suggestions and analytics
    - `suggest()` - generate search suggestions
    - `recordSearch()` - log search queries
    - Handle zero-results case with suggestions
    - _Requirements: 4.6, 9.2_

- [x] 6. Build Analytics Service
  - [x] 6.1 Implement event tracking
    - `trackPageView()` - record page views
    - `trackSearch()` - record search queries
    - `trackFeedback()` - record user feedback
    - Ensure no PII is stored (only user IDs)
    - _Requirements: 9.1, 9.2, 9.5, 9.7_
  
  - [x] 6.2 Implement metrics aggregation
    - `getPopularPages()` - calculate page view metrics
    - `getSearchMetrics()` - analyze search patterns
    - `getBounceRates()` - calculate bounce rates
    - `getRelatedPages()` - identify co-occurrence patterns
    - `getFeedbackSummary()` - aggregate feedback scores
    - fix lint & build errors
    - _Requirements: 9.3, 9.4, 9.5_

- [x] 7. Create tenant documentation portal UI
  - [x] 7.1 Build documentation layout component
    - Create `/src/app/docs/layout.tsx`
    - Implement responsive sidebar navigation
    - Add breadcrumb navigation
    - Include search bar in header
    - Follow project UI design principles (clean, simple)
    - _Requirements: 1.1, 1.2, 1.5, 1.7_
  
  - [x] 7.2 Build documentation page component
    - Create `/src/app/docs/[...slug]/page.tsx`
    - Render parsed Markdown as HTML
    - Display table of contents
    - Add code block copy buttons
    - Include feedback widget
    - Support light/dark themes
    - _Requirements: 1.2, 8.2, 8.4, 8.5_
  
  - [x] 7.3 Implement search UI component
    - Create search input with autocomplete
    - Display search results with excerpts
    - Show breadcrumbs for each result
    - Handle zero-results state
    - _Requirements: 1.4, 4.4, 4.6_

- [x] 8. Create admin documentation portal UI
  - [x] 8.1 Build admin documentation layout
    - Create `/src/app/admin-docs/layout.tsx`
    - Add authentication check middleware
    - Verify admin role before rendering
    - Redirect unauthenticated users to login
    - Return 403 for non-admin authenticated users
    - _Requirements: 2.1, 2.2, 2.3_
  
  - [x] 8.2 Build admin documentation page component
    - Create `/src/app/admin-docs/[...slug]/page.tsx`
    - Reuse tenant portal components with admin styling
    - Display technical documentation content
    - Include admin-specific navigation
    - _Requirements: 2.4, 2.5, 2.7_
  
  - [x] 8.3 Create analytics dashboard
    - Build admin analytics page
    - Display popular pages metrics
    - Show search analytics
    - Display feedback summaries
    - Include bounce rate charts
    - _Requirements: 9.6_

- [x] 9. Implement Documentation API endpoints
  - [x] 9.1 Create document retrieval endpoints
    - `GET /api/v1/documentation/:type/:slug` - get single document
    - `GET /api/v1/documentation/:type` - list documents
    - Return both Markdown and HTML formats
    - Include metadata (author, updated date, tags)
    - No auth required for tenant docs
    - Admin auth required for admin docs
    - _Requirements: 10.1, 10.2, 10.3, 10.5, 10.6_
  
  - [x] 9.2 Create search API endpoint
    - `GET /api/v1/documentation/search` - search documents
    - Support query parameters (q, type, category, tags)
    - Implement pagination (page, limit)
    - Return results with relevance scores
    - _Requirements: 10.4, 10.7_
  
  - [x] 9.3 Create analytics API endpoints
    - `POST /api/v1/documentation/analytics/view` - track page view
    - `POST /api/v1/documentation/analytics/search` - track search
    - `POST /api/v1/documentation/analytics/feedback` - submit feedback
    - `GET /api/v1/documentation/analytics/metrics` - get metrics (admin only)
    - _Requirements: 9.1, 9.2, 9.5_

- [x] 10. Checkpoint - Test core functionality
  - Verify tenant portal accessible at `/docs`
  - Verify admin portal requires authentication
  - Test search isolation (tenant vs admin)
  - Test Markdown rendering with code and diagrams
  - Ensure all tests pass, ask the user if questions arise
  - fix lint & build errors
  - make short commit & push

- [x] 11. Implement Documentation Hook system
  - [x] 11.1 Create task completion event listener
    - Monitor task completion events
    - Extract task metadata (title, description, category)
    - Trigger documentation impact analysis
    - _Requirements: 5.1_
  
  - [x] 11.2 Build documentation impact analyzer
    - `analyzeDocumentationImpact()` - analyze task for doc impact
    - Identify impact type (feature, bugfix, config, api, ui)
    - Determine affected documentation areas
    - Classify target audience (tenant, admin, both)
    - _Requirements: 5.2, 5.3_
  
  - [x] 11.3 Implement suggestion generator
    - `generateUpdateSuggestion()` - create doc suggestions
    - `findAffectedDocuments()` - identify related docs
    - Create suggestions in pending status
    - Store in documentation_suggestions table
    - Maintain audit log of all suggestions
    - _Requirements: 5.4, 5.5, 5.6, 5.7_

- [x] 12. Build migration tool for existing documentation (100+ files in /docs)
  - [x] 12.1 Create document analyzer
    - Scan `/docs` folder for all 100+ existing documentation files
    - Parse each document and extract content
    - Analyze content to classify as tenant/admin/both using:
      - Keyword matching (e.g., "admin", "system", "deployment" → admin)
      - Audience indicators (e.g., "merchant", "user", "tenant" → tenant)
      - Technical depth (architecture, database → admin; guides, tutorials → tenant)
    - Generate classification report with confidence scores
    - _Requirements: 6.1, 6.2_
  
  - [x] 12.2 Implement document migration logic
    - Move documents to appropriate directories (/docs-content/tenant/ or /docs-content/admin/)
    - Split documents classified as "both" (e.g., API_DOCUMENTATION_INDEX.md)
    - Create separate tenant and admin versions with appropriate content
    - Add frontmatter metadata (title, description, category, tags)
    - Preserve all original content (no data loss)
    - Handle special cases (images, diagrams, code examples)
    - _Requirements: 6.3, 6.4_
  
  - [x] 12.3 Create redirect system
    - Generate redirects for moved documents (old /docs/FILE.md → new /docs/category/file)
    - Store redirects in documentation_redirects table
    - Implement redirect middleware for old URLs (301 permanent redirects)
    - Update all internal links to new URLs
    - Handle anchor links and fragments
    - _Requirements: 6.5, 6.7_
  
  - [x] 12.4 Generate migration report
    - Count total documents processed (~100+)
    - Count tenant vs admin vs split documents
    - List all redirects created
    - Report any errors or warnings (broken links, missing metadata)
    - Validate all links after migration
    - Generate summary statistics (coverage, gaps, issues)
    - _Requirements: 6.6, 6.7_

- [x] 13. Implement UI components and interactions
  - [x] 13.1 Create reusable documentation components
    - CodeBlock component with copy button
    - FeedbackWidget component
    - VersionHistory component with diff viewer
    - NavigationSidebar with active state highlighting
    - _Requirements: 8.4, 8.5, 8.6_
  
  - [x] 13.2 Add theme support
    - Implement light/dark theme toggle
    - Apply theme to all documentation pages
    - Persist theme preference
    - Ensure proper contrast ratios
    - _Requirements: 8.2_
  
  - [x] 13.3 Implement responsive design
    - Mobile-friendly navigation (hamburger menu)
    - Responsive table of contents
    - Touch-friendly interactive elements
    - Test across mobile, tablet, desktop
    - _Requirements: 8.3_

- [x] 14. Add error handling and validation
  - [x] 14.1 Implement content validation
    - Validate Markdown syntax
    - Check required frontmatter fields
    - Validate Mermaid diagram syntax
    - Detect and report broken internal links
    - _Requirements: 3.6_
  
  - [x] 14.2 Add access control error handling
    - Handle unauthorized admin access (redirect to login)
    - Handle forbidden access (403 for non-admins)
    - Display user-friendly error messages
    - _Requirements: 2.2, 2.3_
  
  - [x] 14.3 Implement search error handling
    - Handle search index unavailable
    - Implement retry logic with exponential backoff
    - Show graceful degradation (popular pages)
    - _Requirements: 4.6_

- [x] 15. Implement rate limiting and security
  - [x] 15.1 Add rate limiting to API endpoints
    - Tenant docs: 100 requests/minute per IP
    - Admin docs: 1000 requests/hour per token
    - Search: 100 requests/minute per IP
    - Feedback: 10 submissions/hour per user
    - _Requirements: 10.2, 10.3_
  
  - [x] 15.2 Add content security measures
    - Sanitize user-generated content (feedback)
    - Escape HTML in rendered Markdown
    - Implement CSP headers
    - Validate all API inputs
    - fix lint & build errors
    - make short commit & push
    - _Requirements: 9.5_

- [x] 16. Migrate and organize existing documentation content
  - [x] 16.1 Audit existing /docs folder
    - Catalog all 100+ existing documentation files
    - Classify each document as tenant, admin, or both
    - Identify gaps in coverage
    - Map existing docs to new category structure
    - _Requirements: 1.3, 2.5, 6.1_
  
  - [x] 16.2 Migrate tenant documentation
    - Move tenant-facing guides to /docs-content/tenant/
    - Organize by category (getting-started, products, competitors, pricing, integrations, troubleshooting)
    - Add frontmatter metadata to each file
    - Update internal links to new structure
    - Examples: TENANT_GUIDE.md, PRICE_APPROVAL_GUIDE.md, BOT_PROTECTION_USER_GUIDE.md
    - _Requirements: 1.3, 6.3, 6.4_
  
  - [x] 16.3 Migrate admin documentation
    - Move admin-facing guides to /docs-content/admin/
    - Organize by category (system-monitoring, tenant-management, database, security, performance, alerting)
    - Add frontmatter metadata to each file
    - Update internal links to new structure
    - Examples: ADMIN_GUIDE.md, ARCHITECTURE.md, DEPLOYMENT.md, MONITORING_SYSTEM.md
    - _Requirements: 2.5, 6.3, 6.4_
  
  - [x] 16.4 Handle mixed-audience documentation
    - Identify docs that serve both audiences (e.g., API_DOCUMENTATION_INDEX.md)
    - Split into separate tenant and admin versions where appropriate
    - Create cross-references between related docs
    - Ensure no content loss during split
    - _Requirements: 6.3, 6.4_
  
  - [x] 16.5 Create missing documentation
    - Identify gaps from audit (16.1)
    - Write new docs only where needed
    - Focus on critical missing topics
    - Follow established patterns from existing docs
    - _Requirements: 1.3, 2.5_

- [x] 17. Final checkpoint - Integration testing
  - Test complete user flows (tenant and admin)
  - Verify search isolation works correctly
  - Test documentation hook with sample tasks
  - Run migration tool on test data
  - Test version control (create, revert)
  - Verify analytics tracking
  - Test API endpoints with various scenarios
  - Ensure all tests pass, ask the user if questions arise

- [x] 18. Performance optimization and monitoring
  - [x] 18.1 Optimize search performance
    - Add database indexes for search queries
    - Implement query result caching
    - Optimize full-text search configuration
    - Target <200ms search response time
    - _Requirements: 4.3, 4.5_
  
  - [x] 18.2 Add monitoring and logging
    - Log all documentation modifications
    - Log all suggestion generations
    - Log access control denials
    - Track error rates by category
    - Set up alerts for high error rates
    - _Requirements: 5.7_

- [x] 19. Documentation and deployment preparation
  - [x] 19.1 Write technical documentation
    - API documentation (OpenAPI/Swagger)
    - Architecture documentation
    - Deployment guide
    - Configuration guide
    - _Requirements: 10.1_
  
  - [x] 19.2 Create user guides
    - Guide for content authors
    - Guide for reviewing documentation suggestions
    - Guide for using analytics dashboard
    - Migration tool usage guide
    - fix lint & build errors
    - make short commit & push
    - _Requirements: 6.1_

## Notes

- Each task builds incrementally on previous work
- Core infrastructure (database, services) is implemented first
- UI components are built after backend services are ready
- Migration tool is implemented after core system is stable
- Testing checkpoints ensure quality at key milestones
- All tasks reference specific requirements for traceability
- Follow project's existing patterns for Next.js, TypeScript, and PostgreSQL
- Adhere to security requirements (no PII, proper access control)
- Follow API design standards for all endpoints
- Use Prisma for database operations
- Follow UI design principles (clean, simple, documentation-friendly)
