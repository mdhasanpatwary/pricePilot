# Dual Documentation System - Architecture

## Overview

The Dual Documentation System provides separate, role-appropriate documentation portals for PricePilot tenants and system administrators. The architecture follows a layered approach with clear separation of concerns.

## System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Frontend Layer                          │
├─────────────────────────────────────────────────────────────┤
│  Tenant Portal (/docs)    │    Admin Portal (/admin-docs)   │
│  - Public access          │    - Admin auth required        │
│  - User guides            │    - Technical docs             │
│  - Search (tenant only)   │    - Search (admin only)        │
│  - Feedback widget        │    - Analytics dashboard        │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      API Layer                              │
├─────────────────────────────────────────────────────────────┤
│  /api/v1/documentation/:type/:slug  - Get document          │
│  /api/v1/documentation/:type        - List documents        │
│  /api/v1/documentation/search       - Search docs           │
│  /api/v1/documentation/analytics/*  - Track & retrieve      │
│  /api/v1/documentation/suggestions  - Manage suggestions    │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    Service Layer                            │
├─────────────────────────────────────────────────────────────┤
│  DocumentationService  │  SearchService  │  AnalyticsService│
│  - Load & parse docs   │  - Index docs   │  - Track events  │
│  - Manage versions     │  - Execute      │  - Aggregate     │
│  - Handle updates      │    queries      │    metrics       │
│                        │  - Rank results │  - Generate      │
│  DocumentationHook     │                 │    reports       │
│  - Monitor tasks       │                 │                  │
│  - Generate suggestions│                 │                  │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                     Data Layer                              │
├─────────────────────────────────────────────────────────────┤
│  PostgreSQL Database    │    File System                    │
│  - Metadata             │    /docs-content/                 │
│  - Versions             │    ├── tenant/                    │
│  - Analytics            │    │   ├── getting-started/       │
│  - Suggestions          │    │   ├── products/              │
│  - Feedback             │    │   └── ...                    │
│  - Search index         │    └── admin/                     │
│                         │        ├── system-monitoring/     │
│                         │        └── ...                    │
└─────────────────────────────────────────────────────────────┘
```

## Technology Stack

### Frontend
- **Framework:** Next.js 14 with App Router
- **Styling:** Tailwind CSS
- **UI Components:** Shadcn/ui
- **Markdown Rendering:** unified, remark, rehype
- **Syntax Highlighting:** Shiki
- **Diagrams:** Mermaid
- **Theme:** Light/Dark mode support

### Backend
- **Runtime:** Node.js
- **API:** Next.js API Routes
- **Database:** PostgreSQL with Prisma ORM
- **Search:** PostgreSQL full-text search (tsvector)
- **Caching:** Redis (optional, for search results)

### Storage
- **Content:** File system (Markdown files)
- **Metadata:** PostgreSQL database
- **Assets:** Public directory


## Core Components

### 1. Documentation Service

**Location:** `lib/documentation/service.ts`

**Responsibilities:**
- Load and parse Markdown files
- Manage document metadata
- Handle version history
- Process content updates
- Generate table of contents
- Build breadcrumb navigation

**Key Methods:**
```typescript
getDocument(type, slug)      // Retrieve single document
listDocuments(type, category) // List documents by category
getTableOfContents(type)     // Build hierarchical TOC
createDocument(data)         // Create new document
updateDocument(id, content)  // Update existing document
getDocumentHistory(id)       // Retrieve version history
revertDocument(id, versionId) // Revert to previous version
```

### 2. Search Service

**Location:** `lib/documentation/search.ts`

**Responsibilities:**
- Index documentation content
- Execute full-text search queries
- Rank results by relevance
- Maintain search isolation (tenant vs admin)
- Generate search suggestions

**Key Methods:**
```typescript
indexDocument(document)      // Add to search index
search(query, type, options) // Execute search
suggest(query, type)         // Generate suggestions
recordSearch(query, type)    // Log search for analytics
```

**Search Implementation:**
- PostgreSQL full-text search with `tsvector`
- Separate indexes for title, headings, content
- Relevance ranking: title > heading > content
- Type-based filtering for isolation

### 3. Analytics Service

**Location:** `lib/documentation/analytics.ts`

**Responsibilities:**
- Track page views
- Record search queries
- Collect user feedback
- Aggregate usage metrics
- Generate analytics reports

**Key Methods:**
```typescript
trackPageView(documentId, type, userId)
trackSearch(query, type, resultsCount)
trackFeedback(documentId, rating, comment)
getPopularPages(type, timeRange)
getSearchMetrics(type, timeRange)
getFeedbackSummary(documentId)
```

**Privacy:**
- No PII stored (only user IDs)
- Session IDs for anonymous tracking
- Aggregated metrics only

### 4. Documentation Hook

**Location:** `lib/documentation/hook.ts`

**Responsibilities:**
- Monitor task completion events
- Analyze documentation impact
- Generate update suggestions
- Classify target audience (tenant/admin)
- Identify affected documents

**Key Methods:**
```typescript
onTaskCompleted(task)
analyzeDocumentationImpact(task)
classifyDocumentationType(task)
generateUpdateSuggestion(impact)
findAffectedDocuments(impact)
```

**Classification Logic:**
- UI/feature tasks → tenant docs
- Database/system tasks → admin docs
- API tasks → both docs
- Bug fixes → check affected area

### 5. Markdown Parser

**Location:** `lib/documentation/parser.ts`

**Responsibilities:**
- Parse Markdown with frontmatter
- Generate HTML output
- Apply syntax highlighting
- Render Mermaid diagrams
- Validate internal links
- Extract metadata

**Processing Pipeline:**
```
Markdown → Parse Frontmatter → Remark (AST) → Rehype (HTML) → Output
                                    ↓
                            Syntax Highlighting
                            Mermaid Rendering
                            Link Validation
```


## Data Models

### Database Schema

#### documentation_documents
Stores document metadata and content.

```sql
CREATE TABLE documentation_documents (
  id UUID PRIMARY KEY,
  type VARCHAR(10) NOT NULL,  -- 'tenant' or 'admin'
  slug VARCHAR(255) NOT NULL,
  title VARCHAR(500) NOT NULL,
  content TEXT NOT NULL,      -- Raw Markdown
  html_content TEXT NOT NULL, -- Rendered HTML
  category VARCHAR(100) NOT NULL,
  subcategory VARCHAR(100),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP NOT NULL,
  updated_at TIMESTAMP NOT NULL,
  updated_by UUID REFERENCES users(id),
  UNIQUE(type, slug)
);
```

#### documentation_versions
Tracks document version history.

```sql
CREATE TABLE documentation_versions (
  id UUID PRIMARY KEY,
  document_id UUID REFERENCES documentation_documents(id),
  content TEXT NOT NULL,
  change_description TEXT,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP NOT NULL
);
```

#### documentation_suggestions
Stores automated documentation suggestions.

```sql
CREATE TABLE documentation_suggestions (
  id UUID PRIMARY KEY,
  document_id UUID REFERENCES documentation_documents(id),
  suggested_title VARCHAR(500),
  suggested_content TEXT NOT NULL,
  target_type VARCHAR(10) NOT NULL,
  category VARCHAR(100) NOT NULL,
  status VARCHAR(20) DEFAULT 'pending',
  task_id VARCHAR(255),
  created_at TIMESTAMP NOT NULL,
  reviewed_by UUID REFERENCES users(id),
  reviewed_at TIMESTAMP
);
```

#### documentation_page_views
Tracks page view analytics.

```sql
CREATE TABLE documentation_page_views (
  id UUID PRIMARY KEY,
  document_id UUID REFERENCES documentation_documents(id),
  type VARCHAR(10) NOT NULL,
  user_id UUID REFERENCES users(id),
  session_id VARCHAR(255),
  viewed_at TIMESTAMP NOT NULL,
  time_on_page INTEGER
);
```

#### documentation_searches
Tracks search analytics.

```sql
CREATE TABLE documentation_searches (
  id UUID PRIMARY KEY,
  query TEXT NOT NULL,
  type VARCHAR(10) NOT NULL,
  results_count INTEGER NOT NULL,
  clicked_result_id UUID REFERENCES documentation_documents(id),
  searched_at TIMESTAMP NOT NULL
);
```

#### documentation_feedback
Stores user feedback.

```sql
CREATE TABLE documentation_feedback (
  id UUID PRIMARY KEY,
  document_id UUID REFERENCES documentation_documents(id),
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  user_id UUID REFERENCES users(id),
  created_at TIMESTAMP NOT NULL
);
```

#### documentation_redirects
Manages URL redirects for migrated content.

```sql
CREATE TABLE documentation_redirects (
  id UUID PRIMARY KEY,
  old_path VARCHAR(500) NOT NULL UNIQUE,
  new_path VARCHAR(500) NOT NULL,
  created_at TIMESTAMP NOT NULL
);
```

### File System Structure

```
/docs-content/
├── tenant/
│   ├── getting-started/
│   │   ├── introduction.md
│   │   └── quick-start.md
│   ├── products/
│   │   ├── product-setup.md
│   │   └── product-matching.md
│   ├── competitors/
│   ├── pricing/
│   ├── integrations/
│   └── troubleshooting/
└── admin/
    ├── system-monitoring/
    ├── tenant-management/
    ├── database/
    ├── security/
    ├── performance/
    └── alerting/
```

### Frontmatter Format

```yaml
---
title: "Document Title"
description: "Brief description"
category: "category-name"
subcategory: "subcategory-name"
tags: ["tag1", "tag2"]
author: "Author Name"
lastReviewed: "2024-02-05"
relatedDocs: ["slug1", "slug2"]
---
```


## Request Flow

### Tenant Documentation Request

```
User → /docs/getting-started/quick-start
  ↓
Next.js App Router
  ↓
/app/docs/[...slug]/page.tsx
  ↓
DocumentationService.getDocument('tenant', 'getting-started/quick-start')
  ↓
1. Check database for metadata
2. Read Markdown file from /docs-content/tenant/
3. Parse frontmatter
4. Render Markdown to HTML
5. Apply syntax highlighting
6. Render Mermaid diagrams
  ↓
Return Document object
  ↓
Render page with:
- Navigation sidebar
- Breadcrumbs
- Table of contents
- Document content
- Feedback widget
  ↓
Track page view (async)
```

### Admin Documentation Request

```
Admin → /admin-docs/system-monitoring/health-checks
  ↓
Next.js App Router
  ↓
Middleware: Check authentication
  ↓
  ├─ Not authenticated → Redirect to /auth/login
  ├─ Not admin → Return 403 Forbidden
  └─ Admin → Continue
  ↓
/app/admin-docs/[...slug]/page.tsx
  ↓
DocumentationService.getDocument('admin', 'system-monitoring/health-checks')
  ↓
[Same processing as tenant docs]
  ↓
Render admin portal with:
- Admin navigation
- Analytics dashboard link
- Document content
- Version history
```

### Search Request

```
User → Search "price update"
  ↓
/api/v1/documentation/search?q=price+update&type=tenant
  ↓
SearchService.search('price update', 'tenant', options)
  ↓
1. Parse query
2. Execute PostgreSQL full-text search
3. Filter by type (tenant/admin)
4. Rank results by relevance
5. Generate excerpts
6. Build breadcrumbs
  ↓
Return SearchResults
  ↓
Track search (async)
  ↓
Display results with:
- Title
- Excerpt with highlighted terms
- Breadcrumbs
- Relevance score
```

### Documentation Hook Flow

```
Task Completed Event
  ↓
DocumentationHook.onTaskCompleted(task)
  ↓
1. Analyze task description
2. Determine documentation impact
3. Classify target type (tenant/admin/both)
4. Identify affected documents
  ↓
Has impact?
  ├─ No → Skip
  └─ Yes → Generate suggestion
      ↓
      Create documentation_suggestions record
      ↓
      Status: 'pending'
      ↓
      Admin reviews in dashboard
      ↓
      Approve or Reject
      ↓
      If approved:
        1. Update document
        2. Create version record
        3. Update search index
        4. Mark suggestion as 'approved'
```


## Security Architecture

### Access Control

#### Tenant Portal
- **Public access** - No authentication required
- **Read-only** - Users cannot modify content
- **Rate limiting** - 100 requests/minute per IP
- **Search isolation** - Only tenant docs in results

#### Admin Portal
- **Authentication required** - Must be logged in
- **Admin role required** - Role-based access control
- **Full access** - Read, write, analytics
- **Rate limiting** - 1000 requests/hour per token
- **Search isolation** - Only admin docs in results

### Data Security

#### Content Security
- **Input sanitization** - All user inputs sanitized
- **XSS prevention** - HTML escaped in rendered content
- **CSP headers** - Content Security Policy enforced
- **HTTPS only** - All traffic encrypted

#### Privacy
- **No PII in analytics** - Only user IDs stored
- **Anonymous tracking** - Session IDs for non-authenticated users
- **Aggregated metrics** - Individual data not exposed
- **GDPR compliant** - Data retention policies

### API Security

#### Authentication
```typescript
// Admin endpoints require authentication
Authorization: Bearer <admin-token>

// Tenant endpoints are public
// No authentication required
```

#### Rate Limiting
```typescript
// Tenant docs: 100 req/min per IP
// Admin docs: 1000 req/hour per token
// Search: 100 req/min per IP
// Feedback: 10 submissions/hour per user
```

#### Input Validation
- All inputs validated with Zod schemas
- Type checking enforced
- Length limits applied
- Malicious content rejected

## Performance Optimization

### Caching Strategy

#### Content Caching
- **Static generation** - Pre-render documentation pages
- **Incremental regeneration** - Update on content changes
- **CDN caching** - Cache static assets
- **Browser caching** - Cache-Control headers

#### Search Caching
- **Query result caching** - Cache popular searches (Redis)
- **Index caching** - Cache search index in memory
- **TTL: 5 minutes** - Balance freshness and performance

#### Database Optimization
- **Indexes** - Full-text search indexes
- **Connection pooling** - Reuse database connections
- **Query optimization** - Efficient queries with proper joins

### Performance Targets

- **Page load:** < 1 second
- **Search response:** < 200ms
- **API response:** < 100ms
- **Index update:** < 5 seconds

### Monitoring

#### Metrics Tracked
- Page load times
- Search query performance
- API response times
- Error rates
- Cache hit rates

#### Alerts
- High error rates (> 5%)
- Slow queries (> 1s)
- High memory usage (> 80%)
- Failed index updates


## Scalability Considerations

### Horizontal Scaling
- **Stateless API** - No server-side sessions
- **Load balancing** - Distribute requests across instances
- **Database read replicas** - Scale read operations
- **CDN distribution** - Serve static content globally

### Vertical Scaling
- **Database optimization** - Proper indexing and query optimization
- **Memory caching** - Redis for frequently accessed data
- **Connection pooling** - Efficient database connections

### Content Scaling
- **File system** - Efficient for 1000s of documents
- **Database** - Metadata only, not full content
- **Search index** - PostgreSQL full-text search scales well
- **Future:** Consider Elasticsearch for 10,000+ documents

## Deployment Architecture

### Production Environment

```
┌─────────────────────────────────────────────────────────┐
│                    Load Balancer                        │
└─────────────────────────────────────────────────────────┘
                         │
        ┌────────────────┼────────────────┐
        ▼                ▼                ▼
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│  Next.js     │  │  Next.js     │  │  Next.js     │
│  Instance 1  │  │  Instance 2  │  │  Instance 3  │
└──────────────┘  └──────────────┘  └──────────────┘
        │                │                │
        └────────────────┼────────────────┘
                         ▼
        ┌────────────────────────────────┐
        │     PostgreSQL Database        │
        │     (Primary + Replicas)       │
        └────────────────────────────────┘
                         │
                         ▼
        ┌────────────────────────────────┐
        │      Redis Cache (Optional)    │
        └────────────────────────────────┘
```

### Deployment Process

1. **Build** - `npm run build`
2. **Test** - Run integration tests
3. **Deploy** - Deploy to staging
4. **Verify** - Smoke tests on staging
5. **Promote** - Deploy to production
6. **Monitor** - Watch metrics and logs

### Environment Variables

```bash
# Database
DATABASE_URL=postgresql://...

# Redis (optional)
REDIS_URL=redis://...

# Authentication
NEXTAUTH_SECRET=...
NEXTAUTH_URL=...

# Rate Limiting
RATE_LIMIT_ENABLED=true

# Search
SEARCH_CACHE_TTL=300

# Analytics
ANALYTICS_ENABLED=true
```

## Migration Strategy

### Existing Documentation Migration

1. **Analyze** - Scan /docs folder
2. **Classify** - Determine tenant/admin/both
3. **Split** - Create separate versions if needed
4. **Move** - Copy to /docs-content/
5. **Frontmatter** - Add metadata
6. **Links** - Update internal links
7. **Redirects** - Create redirect records
8. **Validate** - Check all links work
9. **Index** - Add to search index

### Zero-Downtime Migration

1. Deploy new system alongside old
2. Create redirects from old URLs
3. Gradually migrate content
4. Monitor traffic and errors
5. Switch DNS when ready
6. Keep old system for rollback

## Maintenance and Operations

### Regular Tasks

#### Daily
- Monitor error rates
- Check search performance
- Review analytics

#### Weekly
- Review documentation suggestions
- Update popular pages
- Check broken links

#### Monthly
- Analyze usage patterns
- Update outdated content
- Review feedback

### Backup Strategy

- **Database backups** - Daily automated backups
- **Content backups** - Git repository for /docs-content/
- **Retention** - 30 days of backups
- **Recovery** - Tested quarterly

### Monitoring and Alerting

#### Metrics
- Request rates
- Response times
- Error rates
- Cache hit rates
- Search performance

#### Alerts
- Error rate > 5%
- Response time > 1s
- Search failures
- High memory usage
- Database connection issues

## Future Enhancements

### Planned Features
- **Multi-language support** - i18n for documentation
- **PDF export** - Generate PDF versions
- **Offline mode** - Progressive Web App
- **AI-powered search** - Semantic search
- **Collaborative editing** - Real-time collaboration
- **Version comparison** - Visual diff viewer

### Scalability Improvements
- **Elasticsearch** - For larger document sets
- **CDN integration** - Global content delivery
- **Edge caching** - Cache at edge locations
- **GraphQL API** - More flexible queries

## References

- [Next.js Documentation](https://nextjs.org/docs)
- [Prisma Documentation](https://www.prisma.io/docs)
- [PostgreSQL Full-Text Search](https://www.postgresql.org/docs/current/textsearch.html)
- [Markdown Specification](https://commonmark.org/)
- [Mermaid Documentation](https://mermaid.js.org/)
