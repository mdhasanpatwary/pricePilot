# Dual Documentation System - Configuration Guide

## Overview

This guide covers all configuration options for the Dual Documentation System, including environment variables, database settings, search configuration, and feature flags.

## Environment Variables

### Required Variables

#### Database Configuration

```bash
# PostgreSQL connection string
DATABASE_URL="postgresql://user:password@host:port/database"

# Example for local development
DATABASE_URL="postgresql://postgres:password@localhost:5432/pricepilot"

# Example for production (with SSL)
DATABASE_URL="postgresql://user:password@host:5432/db?sslmode=require"
```

#### Authentication Configuration

```bash
# NextAuth secret (generate with: openssl rand -base64 32)
NEXTAUTH_SECRET="your-secret-key-minimum-32-characters"

# Application URL
NEXTAUTH_URL="https://yourdomain.com"

# For local development
NEXTAUTH_URL="http://localhost:3000"
```

### Optional Variables

#### Redis Configuration (Caching)

```bash
# Redis connection string
REDIS_URL="redis://localhost:6379"

# Redis with password
REDIS_URL="redis://:password@host:6379"

# Redis with TLS
REDIS_URL="rediss://host:6379"

# Disable Redis (use in-memory caching)
REDIS_ENABLED=false
```

#### Rate Limiting Configuration

```bash
# Enable/disable rate limiting
RATE_LIMIT_ENABLED=true

# Tenant docs rate limit (requests per minute per IP)
RATE_LIMIT_TENANT_DOCS=100

# Admin docs rate limit (requests per hour per token)
RATE_LIMIT_ADMIN_DOCS=1000

# Search rate limit (requests per minute per IP)
RATE_LIMIT_SEARCH=100

# Feedback rate limit (submissions per hour per user)
RATE_LIMIT_FEEDBACK=10
```

#### Search Configuration

```bash
# Enable search caching
SEARCH_CACHE_ENABLED=true

# Search cache TTL in seconds (default: 300 = 5 minutes)
SEARCH_CACHE_TTL=300

# Search index update interval in seconds (default: 60)
SEARCH_INDEX_UPDATE_INTERVAL=60

# Maximum search results per page
SEARCH_MAX_RESULTS=50

# Search relevance threshold (0-1, default: 0.1)
SEARCH_RELEVANCE_THRESHOLD=0.1
```


#### Analytics Configuration

```bash
# Enable/disable analytics tracking
ANALYTICS_ENABLED=true

# Analytics data retention in days (default: 90)
ANALYTICS_RETENTION_DAYS=90

# Enable anonymous tracking (session IDs for non-authenticated users)
ANALYTICS_ANONYMOUS_TRACKING=true

# Aggregate analytics data older than X days
ANALYTICS_AGGREGATION_THRESHOLD=30
```

#### Documentation Configuration

```bash
# Path to documentation content (default: ./docs-content)
DOCS_CONTENT_PATH="./docs-content"

# Enable documentation caching
DOCS_CACHE_ENABLED=true

# Documentation cache TTL in seconds (default: 3600 = 1 hour)
DOCS_CACHE_TTL=3600

# Enable automatic index updates on file changes
DOCS_AUTO_INDEX=true

# Maximum document size in bytes (default: 1MB)
DOCS_MAX_SIZE=1048576
```

#### Feature Flags

```bash
# Enable documentation hook system
FEATURE_DOCUMENTATION_HOOK=true

# Enable version history
FEATURE_VERSION_HISTORY=true

# Enable feedback widget
FEATURE_FEEDBACK_WIDGET=true

# Enable Mermaid diagrams
FEATURE_MERMAID_DIAGRAMS=true

# Enable syntax highlighting
FEATURE_SYNTAX_HIGHLIGHTING=true
```

#### Logging Configuration

```bash
# Log level: debug, info, warn, error
LOG_LEVEL=info

# Enable request logging
LOG_REQUESTS=true

# Enable error logging
LOG_ERRORS=true

# Enable analytics logging
LOG_ANALYTICS=false

# Log format: json, pretty
LOG_FORMAT=json
```

#### Security Configuration

```bash
# Enable HTTPS redirect
FORCE_HTTPS=true

# Enable CORS (for API access)
CORS_ENABLED=true

# Allowed CORS origins (comma-separated)
CORS_ORIGINS="https://yourdomain.com,https://app.yourdomain.com"

# Enable CSP headers
CSP_ENABLED=true

# Admin IP whitelist (comma-separated, optional)
ADMIN_IP_WHITELIST=""
```

## Database Configuration

### Connection Pooling

Configure in `prisma/schema.prisma`:

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
  
  // Connection pool settings
  connectionLimit = 10
  poolTimeout     = 30
}
```

### Full-Text Search Configuration

```sql
-- Configure text search dictionary
ALTER TEXT SEARCH CONFIGURATION english
  ALTER MAPPING FOR hword, hword_part, word
  WITH english_stem;

-- Update search index weights
UPDATE documentation_documents
SET search_vector = 
  setweight(to_tsvector('english', title), 'A') ||
  setweight(to_tsvector('english', coalesce(metadata->>'description', '')), 'B') ||
  setweight(to_tsvector('english', content), 'C');
```

### Indexes Configuration

```sql
-- Performance indexes
CREATE INDEX CONCURRENTLY idx_docs_type_category 
  ON documentation_documents(type, category);

CREATE INDEX CONCURRENTLY idx_docs_slug 
  ON documentation_documents(slug);

CREATE INDEX CONCURRENTLY idx_docs_updated_at 
  ON documentation_documents(updated_at DESC);

-- Full-text search index
CREATE INDEX CONCURRENTLY idx_docs_search 
  ON documentation_documents 
  USING GIN(to_tsvector('english', title || ' ' || content));

-- Analytics indexes
CREATE INDEX CONCURRENTLY idx_page_views_document_date 
  ON documentation_page_views(document_id, viewed_at DESC);

CREATE INDEX CONCURRENTLY idx_searches_type_date 
  ON documentation_searches(type, searched_at DESC);
```


## Redis Configuration

### Connection Settings

```bash
# Basic connection
REDIS_URL="redis://localhost:6379"

# With authentication
REDIS_URL="redis://:password@localhost:6379"

# With database selection
REDIS_URL="redis://localhost:6379/0"

# With TLS
REDIS_URL="rediss://localhost:6379"
```

### Cache Configuration

```typescript
// lib/documentation/cache-config.ts
export const cacheConfig = {
  // Search results cache
  search: {
    ttl: 300, // 5 minutes
    prefix: 'search:',
  },
  
  // Document cache
  documents: {
    ttl: 3600, // 1 hour
    prefix: 'doc:',
  },
  
  // Table of contents cache
  toc: {
    ttl: 7200, // 2 hours
    prefix: 'toc:',
  },
  
  // Analytics cache
  analytics: {
    ttl: 600, // 10 minutes
    prefix: 'analytics:',
  },
};
```

## Search Configuration

### Search Ranking Weights

Configure in `lib/documentation/search.ts`:

```typescript
export const searchConfig = {
  // Relevance weights
  weights: {
    title: 1.0,      // Highest priority
    heading: 0.7,    // Medium priority
    content: 0.3,    // Lower priority
  },
  
  // Minimum relevance score
  minRelevance: 0.1,
  
  // Maximum results per page
  maxResults: 50,
  
  // Default results per page
  defaultLimit: 20,
  
  // Search suggestions count
  suggestionsCount: 5,
};
```

### Search Index Update Strategy

```typescript
export const indexConfig = {
  // Update strategy: 'immediate', 'batch', 'scheduled'
  updateStrategy: 'immediate',
  
  // Batch size for batch updates
  batchSize: 100,
  
  // Update interval for scheduled updates (seconds)
  updateInterval: 60,
  
  // Rebuild index on startup
  rebuildOnStartup: false,
};
```

## Analytics Configuration

### Tracking Settings

```typescript
// lib/documentation/analytics-config.ts
export const analyticsConfig = {
  // Enable tracking
  enabled: true,
  
  // Track anonymous users
  trackAnonymous: true,
  
  // Session timeout (minutes)
  sessionTimeout: 30,
  
  // Minimum time on page to count as view (seconds)
  minTimeOnPage: 5,
  
  // Data retention (days)
  retentionDays: 90,
  
  // Aggregate data older than (days)
  aggregationThreshold: 30,
};
```

### Privacy Settings

```typescript
export const privacyConfig = {
  // Store user IDs (pseudonymous)
  storeUserIds: true,
  
  // Store IP addresses (hashed)
  storeIpAddresses: false,
  
  // Store user agents
  storeUserAgents: false,
  
  // Anonymize data after (days)
  anonymizeAfter: 90,
};
```

## Rate Limiting Configuration

### Rate Limit Rules

```typescript
// lib/documentation/rate-limit-config.ts
export const rateLimitConfig = {
  // Tenant documentation
  tenantDocs: {
    points: 100,        // Number of requests
    duration: 60,       // Per 60 seconds
    blockDuration: 300, // Block for 5 minutes if exceeded
  },
  
  // Admin documentation
  adminDocs: {
    points: 1000,
    duration: 3600,     // Per hour
    blockDuration: 3600,
  },
  
  // Search
  search: {
    points: 100,
    duration: 60,
    blockDuration: 300,
  },
  
  // Feedback submissions
  feedback: {
    points: 10,
    duration: 3600,     // Per hour
    blockDuration: 7200,
  },
};
```


## Documentation Hook Configuration

### Hook Settings

```typescript
// lib/documentation/hook-config.ts
export const hookConfig = {
  // Enable hook system
  enabled: true,
  
  // Task patterns to monitor
  taskPatterns: {
    feature: /^(feat|feature):/i,
    bugfix: /^(fix|bugfix):/i,
    api: /api|endpoint/i,
    ui: /ui|interface|component/i,
    database: /database|schema|migration/i,
  },
  
  // Classification rules
  classification: {
    tenant: ['ui', 'feature', 'user-facing'],
    admin: ['database', 'system', 'monitoring', 'deployment'],
    both: ['api', 'authentication', 'security'],
  },
  
  // Auto-approve suggestions (not recommended)
  autoApprove: false,
  
  // Notification settings
  notifications: {
    enabled: true,
    channels: ['email', 'slack'],
  },
};
```

### Impact Analysis Configuration

```typescript
export const impactAnalysisConfig = {
  // Keywords for tenant documentation
  tenantKeywords: [
    'user', 'product', 'price', 'competitor',
    'dashboard', 'report', 'export', 'integration',
  ],
  
  // Keywords for admin documentation
  adminKeywords: [
    'admin', 'system', 'database', 'deployment',
    'monitoring', 'security', 'performance', 'backup',
  ],
  
  // Confidence threshold (0-1)
  confidenceThreshold: 0.7,
  
  // Minimum description length for analysis
  minDescriptionLength: 50,
};
```

## Content Configuration

### Markdown Processing

```typescript
// lib/documentation/markdown-config.ts
export const markdownConfig = {
  // Enable GitHub Flavored Markdown
  gfm: true,
  
  // Enable tables
  tables: true,
  
  // Enable task lists
  taskLists: true,
  
  // Enable strikethrough
  strikethrough: true,
  
  // Enable autolinks
  autolinks: true,
  
  // Syntax highlighting theme
  syntaxTheme: 'github-dark',
  
  // Mermaid theme
  mermaidTheme: 'default',
  
  // Code block options
  codeBlock: {
    showLineNumbers: true,
    showLanguage: true,
    copyButton: true,
  },
};
```

### Frontmatter Schema

```typescript
export const frontmatterSchema = {
  required: ['title', 'category'],
  optional: [
    'description',
    'subcategory',
    'tags',
    'author',
    'lastReviewed',
    'relatedDocs',
  ],
  
  validation: {
    title: { maxLength: 500 },
    description: { maxLength: 1000 },
    category: { pattern: /^[a-z0-9-]+$/ },
    tags: { maxItems: 10 },
  },
};
```

## UI Configuration

### Theme Configuration

```typescript
// lib/documentation/theme-config.ts
export const themeConfig = {
  // Default theme
  defaultTheme: 'light',
  
  // Available themes
  themes: ['light', 'dark'],
  
  // Theme persistence
  persistTheme: true,
  
  // Colors
  colors: {
    light: {
      background: '#ffffff',
      foreground: '#000000',
      primary: '#0070f3',
      secondary: '#666666',
    },
    dark: {
      background: '#000000',
      foreground: '#ffffff',
      primary: '#0070f3',
      secondary: '#999999',
    },
  },
};
```

### Navigation Configuration

```typescript
export const navigationConfig = {
  // Show breadcrumbs
  showBreadcrumbs: true,
  
  // Show table of contents
  showToc: true,
  
  // TOC depth (1-6)
  tocDepth: 3,
  
  // Sticky navigation
  stickyNav: true,
  
  // Mobile menu breakpoint
  mobileBreakpoint: 768,
  
  // Sidebar width
  sidebarWidth: 280,
};
```

## Performance Configuration

### Caching Strategy

```typescript
// lib/documentation/performance-config.ts
export const performanceConfig = {
  // Static generation
  staticGeneration: {
    enabled: true,
    revalidate: 3600, // 1 hour
  },
  
  // Image optimization
  images: {
    enabled: true,
    formats: ['webp', 'avif'],
    quality: 80,
  },
  
  // Lazy loading
  lazyLoading: {
    enabled: true,
    threshold: 0.1,
  },
  
  // Prefetching
  prefetch: {
    enabled: true,
    strategy: 'viewport',
  },
};
```

### Database Optimization

```typescript
export const dbOptimizationConfig = {
  // Connection pool size
  poolSize: 10,
  
  // Query timeout (ms)
  queryTimeout: 5000,
  
  // Enable query caching
  queryCache: true,
  
  // Cache TTL (seconds)
  cacheTtl: 300,
  
  // Enable prepared statements
  preparedStatements: true,
};
```


## Security Configuration

### Authentication Settings

```typescript
// lib/documentation/auth-config.ts
export const authConfig = {
  // Session duration (seconds)
  sessionDuration: 86400, // 24 hours
  
  // Session refresh threshold (seconds)
  refreshThreshold: 3600, // 1 hour
  
  // Admin role name
  adminRole: 'admin',
  
  // Allowed admin roles
  adminRoles: ['admin', 'superadmin'],
  
  // Login redirect
  loginRedirect: '/auth/login',
  
  // Unauthorized redirect
  unauthorizedRedirect: '/403',
};
```

### Content Security Policy

```typescript
export const cspConfig = {
  enabled: true,
  
  directives: {
    defaultSrc: ["'self'"],
    scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
    styleSrc: ["'self'", "'unsafe-inline'"],
    imgSrc: ["'self'", 'data:', 'https:'],
    fontSrc: ["'self'", 'data:'],
    connectSrc: ["'self'"],
    frameSrc: ["'none'"],
    objectSrc: ["'none'"],
  },
};
```

### CORS Configuration

```typescript
export const corsConfig = {
  enabled: true,
  
  // Allowed origins
  origins: [
    'https://yourdomain.com',
    'https://app.yourdomain.com',
  ],
  
  // Allowed methods
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  
  // Allowed headers
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Requested-With',
  ],
  
  // Expose headers
  exposedHeaders: [
    'X-RateLimit-Limit',
    'X-RateLimit-Remaining',
    'X-RateLimit-Reset',
  ],
  
  // Credentials
  credentials: true,
  
  // Max age (seconds)
  maxAge: 86400,
};
```

## Monitoring Configuration

### Logging Settings

```typescript
// lib/documentation/logging-config.ts
export const loggingConfig = {
  // Log level
  level: process.env.LOG_LEVEL || 'info',
  
  // Log format
  format: process.env.LOG_FORMAT || 'json',
  
  // Log destinations
  destinations: {
    console: true,
    file: true,
    sentry: true,
  },
  
  // File logging
  file: {
    path: './logs',
    maxSize: '10m',
    maxFiles: 10,
  },
  
  // Sentry configuration
  sentry: {
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV,
    tracesSampleRate: 0.1,
  },
};
```

### Metrics Configuration

```typescript
export const metricsConfig = {
  // Enable metrics collection
  enabled: true,
  
  // Metrics to track
  metrics: [
    'request_duration',
    'request_count',
    'error_count',
    'cache_hit_rate',
    'search_performance',
    'database_query_time',
  ],
  
  // Aggregation interval (seconds)
  aggregationInterval: 60,
  
  // Retention period (days)
  retentionDays: 30,
};
```

## Environment-Specific Configuration

### Development Environment

```bash
# .env.development
NODE_ENV=development
DATABASE_URL="postgresql://postgres:password@localhost:5432/pricepilot_dev"
NEXTAUTH_URL="http://localhost:3000"
LOG_LEVEL=debug
DOCS_CACHE_ENABLED=false
SEARCH_CACHE_ENABLED=false
ANALYTICS_ENABLED=false
```

### Staging Environment

```bash
# .env.staging
NODE_ENV=staging
DATABASE_URL="postgresql://user:password@staging-db:5432/pricepilot_staging"
NEXTAUTH_URL="https://staging.pricepilot.com"
LOG_LEVEL=info
DOCS_CACHE_ENABLED=true
SEARCH_CACHE_ENABLED=true
ANALYTICS_ENABLED=true
RATE_LIMIT_ENABLED=true
```

### Production Environment

```bash
# .env.production
NODE_ENV=production
DATABASE_URL="postgresql://user:password@prod-db:5432/pricepilot"
NEXTAUTH_URL="https://pricepilot.com"
LOG_LEVEL=warn
DOCS_CACHE_ENABLED=true
SEARCH_CACHE_ENABLED=true
ANALYTICS_ENABLED=true
RATE_LIMIT_ENABLED=true
FORCE_HTTPS=true
CSP_ENABLED=true
```

## Configuration Validation

### Startup Validation

```typescript
// lib/documentation/config-validator.ts
export function validateConfig() {
  const required = [
    'DATABASE_URL',
    'NEXTAUTH_SECRET',
    'NEXTAUTH_URL',
  ];
  
  const missing = required.filter(key => !process.env[key]);
  
  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(', ')}`
    );
  }
  
  // Validate DATABASE_URL format
  if (!process.env.DATABASE_URL?.startsWith('postgresql://')) {
    throw new Error('DATABASE_URL must be a PostgreSQL connection string');
  }
  
  // Validate NEXTAUTH_SECRET length
  if (process.env.NEXTAUTH_SECRET!.length < 32) {
    throw new Error('NEXTAUTH_SECRET must be at least 32 characters');
  }
  
  console.log('✓ Configuration validated successfully');
}
```

## Configuration Best Practices

### Security
1. Never commit `.env` files to Git
2. Use strong secrets (minimum 32 characters)
3. Rotate secrets regularly
4. Use environment-specific configurations
5. Enable rate limiting in production
6. Enable HTTPS in production

### Performance
1. Enable caching in production
2. Use Redis for distributed caching
3. Configure appropriate cache TTLs
4. Enable database connection pooling
5. Use CDN for static assets

### Monitoring
1. Enable logging in all environments
2. Use appropriate log levels
3. Configure error tracking (Sentry)
4. Set up performance monitoring
5. Configure alerts for critical issues

### Maintenance
1. Document all configuration changes
2. Test configuration in staging first
3. Keep configuration DRY (use defaults)
4. Version control configuration files
5. Regular configuration audits

## Troubleshooting Configuration Issues

### Common Issues

#### 1. Database Connection Fails
```bash
# Check DATABASE_URL format
echo $DATABASE_URL

# Test connection
psql $DATABASE_URL -c "SELECT 1"
```

#### 2. Redis Connection Fails
```bash
# Check REDIS_URL format
echo $REDIS_URL

# Test connection
redis-cli -u $REDIS_URL ping
```

#### 3. Authentication Not Working
```bash
# Check NEXTAUTH_SECRET is set
echo $NEXTAUTH_SECRET | wc -c  # Should be >= 32

# Check NEXTAUTH_URL matches deployment
echo $NEXTAUTH_URL
```

#### 4. Rate Limiting Too Strict
```bash
# Adjust rate limits
export RATE_LIMIT_TENANT_DOCS=200
export RATE_LIMIT_SEARCH=200
```

#### 5. Search Not Working
```bash
# Enable search logging
export LOG_LEVEL=debug

# Check search index
npm run check:search-index
```

## Configuration Reference

For complete configuration options, see:
- Environment Variables: `.env.example`
- Database Schema: `prisma/schema.prisma`
- API Configuration: `lib/documentation/config.ts`
- UI Configuration: `components/docs/config.ts`

## Support

For configuration help:
- Documentation: `/docs/configuration`
- Admin Guide: `/admin-docs/configuration`
- Email: support@pricepilot.com
