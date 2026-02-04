# Bot Protection Handling Migration

## Overview

This migration adds comprehensive database schema support for the bot protection handling feature. It introduces tables for proxy management, scraping configuration, session management, attempt logging, protection detection, metrics collection, and alerting.

## New Tables

### 1. Proxy
Stores proxy server configurations for IP rotation.

**Fields:**
- `id`: Unique identifier
- `provider`: Proxy service provider name
- `host`: Proxy server hostname
- `port`: Proxy server port
- `protocol`: Connection protocol (http, https, socks5)
- `username`: Optional authentication username
- `passwordEncrypted`: Encrypted password for proxy authentication
- `region`: Geographic region of proxy
- `status`: Proxy status (active, disabled)
- `globalSuccessCount`: Total successful requests across all sites
- `globalFailureCount`: Total failed requests across all sites
- `createdAt`: Creation timestamp
- `updatedAt`: Last update timestamp

**Indexes:**
- Unique constraint on (host, port)
- Index on status for filtering active proxies

### 2. ProxySiteHealth
Tracks proxy performance per competitor website.

**Fields:**
- `id`: Unique identifier
- `proxyId`: Reference to Proxy
- `competitorWebsiteId`: Reference to Site (competitor)
- `successCount`: Successful requests for this proxy-site combination
- `failureCount`: Failed requests for this proxy-site combination
- `lastSuccessAt`: Timestamp of last successful request
- `lastFailureAt`: Timestamp of last failed request
- `cooldownUntil`: Timestamp when proxy can be used again for this site
- `createdAt`: Creation timestamp
- `updatedAt`: Last update timestamp

**Indexes:**
- Unique constraint on (proxyId, competitorWebsiteId)
- Index on proxyId for proxy lookups
- Index on competitorWebsiteId for site lookups
- Index on cooldownUntil for filtering available proxies

### 3. ScrapingConfig
Per-site scraping configuration and strategy settings.

**Fields:**
- `id`: Unique identifier
- `tenantId`: Reference to Tenant
- `competitorWebsiteId`: Reference to Site (competitor) - unique
- `preferredStrategy`: Default scraping strategy (http_client, headless_browser, etc.)
- `requiresJavascript`: Whether site requires JavaScript execution
- `proxyRequired`: Whether proxy is required for this site
- `baseDelayMs`: Base delay between requests in milliseconds
- `maxDelayMs`: Maximum delay for exponential backoff
- `backoffMultiplier`: Multiplier for exponential backoff calculation
- `maxRetries`: Maximum retry attempts per scrape
- `timeoutMs`: Request timeout in milliseconds
- `priceSelectors`: JSON array of CSS selectors for price extraction
- `currencySelector`: CSS selector for currency extraction
- `fallbackRegex`: Regex pattern for fallback price extraction
- `createdAt`: Creation timestamp
- `updatedAt`: Last update timestamp

**Indexes:**
- Unique constraint on competitorWebsiteId
- Index on tenantId for tenant filtering
- Index on competitorWebsiteId for site lookups

### 4. ScrapingCookieJar
Stores cookies and session state per competitor website.

**Fields:**
- `id`: Unique identifier
- `competitorWebsiteId`: Reference to Site (competitor) - unique
- `cookies`: JSON array of cookie objects
- `expiresAt`: Session expiration timestamp
- `createdAt`: Creation timestamp
- `updatedAt`: Last update timestamp

**Indexes:**
- Unique constraint on competitorWebsiteId
- Index on competitorWebsiteId for site lookups
- Index on expiresAt for cleanup jobs

### 5. ScrapeAttempt
Logs every scraping attempt with detailed information.

**Fields:**
- `id`: Unique identifier
- `tenantId`: Reference to Tenant
- `competitorProductId`: Reference to Product (competitor)
- `competitorWebsiteId`: Reference to Site (competitor)
- `url`: Target URL (TEXT for long URLs)
- `strategy`: Scraping strategy used
- `proxyId`: Reference to Proxy (nullable)
- `userAgent`: User agent string used (TEXT)
- `success`: Whether scrape was successful
- `protectionDetected`: Whether bot protection was detected
- `protectionType`: Type of protection detected (nullable)
- `statusCode`: HTTP status code (nullable)
- `responseTimeMs`: Response time in milliseconds (nullable)
- `responseSizeBytes`: Response size in bytes (nullable)
- `responseSample`: First 1KB of response (TEXT, nullable)
- `screenshotUrl`: URL to screenshot if captured (nullable)
- `errorMessage`: Error message if failed (TEXT, nullable)
- `attemptNumber`: Attempt number in retry sequence
- `createdAt`: Creation timestamp

**Indexes:**
- Index on tenantId for tenant filtering
- Index on competitorProductId for product lookups
- Index on competitorWebsiteId for site lookups
- Index on createdAt for time-based queries
- Index on success for filtering by outcome
- Composite index on (protectionDetected, protectionType) for protection analysis

### 6. ProtectionDetection
Stores detailed bot protection detection results.

**Fields:**
- `id`: Unique identifier
- `scrapeAttemptId`: Reference to ScrapeAttempt
- `protectionType`: Type of protection detected
- `confidence`: Confidence score (0-100)
- `indicators`: JSON array of detection indicators
- `reasoning`: Explanation of detection (TEXT, nullable)
- `createdAt`: Creation timestamp

**Indexes:**
- Index on scrapeAttemptId for attempt lookups
- Index on protectionType for protection analysis

### 7. ScrapingMetric
Aggregated hourly metrics per competitor website.

**Fields:**
- `id`: Unique identifier
- `tenantId`: Reference to Tenant
- `competitorWebsiteId`: Reference to Site (competitor)
- `hourTimestamp`: Hour bucket for aggregation
- `totalAttempts`: Total scrape attempts in this hour
- `successfulAttempts`: Successful scrape attempts
- `failedAttempts`: Failed scrape attempts
- `avgResponseTimeMs`: Average response time (nullable)
- `protectionTypeCounts`: JSON object with protection type counts (nullable)
- `strategyCounts`: JSON object with strategy counts (nullable)
- `createdAt`: Creation timestamp

**Indexes:**
- Unique constraint on (tenantId, competitorWebsiteId, hourTimestamp)
- Composite index on (tenantId, hourTimestamp) for tenant metrics
- Composite index on (competitorWebsiteId, hourTimestamp) for site metrics

### 8. ScrapingAlert
Stores alerts for scraping issues and threshold breaches.

**Fields:**
- `id`: Unique identifier
- `tenantId`: Reference to Tenant
- `competitorWebsiteId`: Reference to Site (competitor, nullable)
- `severity`: Alert severity (info, warning, critical)
- `type`: Alert type (success_rate_drop, captcha_detected, etc.)
- `title`: Alert title
- `message`: Alert message (TEXT)
- `metadata`: JSON object with additional context (nullable)
- `acknowledged`: Whether alert has been acknowledged
- `acknowledgedAt`: Acknowledgment timestamp (nullable)
- `acknowledgedBy`: User who acknowledged (nullable)
- `createdAt`: Creation timestamp

**Indexes:**
- Index on tenantId for tenant filtering
- Index on competitorWebsiteId for site filtering
- Index on acknowledged for filtering unacknowledged alerts
- Index on createdAt for time-based queries

## Relations

### Site Model Updates
Added relations to:
- `proxySiteHealth`: ProxySiteHealth[]
- `scrapingConfigs`: ScrapingConfig[]
- `scrapingCookieJars`: ScrapingCookieJar[]
- `scrapeAttempts`: ScrapeAttempt[]
- `scrapingMetrics`: ScrapingMetric[]
- `scrapingAlerts`: ScrapingAlert[]

### Product Model Updates
Added relation to:
- `scrapeAttempts`: ScrapeAttempt[]

## Performance Considerations

### Indexes
All tables include appropriate indexes for:
- Foreign key lookups
- Time-based queries
- Status filtering
- Composite queries

### Data Types
- TEXT fields for potentially long content (URLs, user agents, error messages, response samples)
- JSONB for flexible structured data (cookies, selectors, indicators, metadata)
- DECIMAL for precise numeric values (confidence scores, backoff multipliers)
- INTEGER for counts and metrics

### Cascading Deletes
- ProxySiteHealth cascades on Proxy deletion
- All site-related tables cascade on Site deletion
- ScrapeAttempt cascades on Product deletion
- ProtectionDetection cascades on ScrapeAttempt deletion

## Migration Notes

### Prerequisites
- Existing Site table must be present
- Existing Product table must be present
- Existing Tenant table must be present

### Data Migration
No data migration required - all new tables start empty.

### Rollback
To rollback this migration, drop all new tables in reverse order:
1. ScrapingAlert
2. ScrapingMetric
3. ProtectionDetection
4. ScrapeAttempt
5. ScrapingCookieJar
6. ScrapingConfig
7. ProxySiteHealth
8. Proxy

### Post-Migration Steps
1. Generate Prisma Client: `npx prisma generate`
2. Verify schema: `npx prisma validate`
3. Seed initial proxy configurations if needed
4. Configure default scraping configs for existing competitor sites

## Requirements Mapping

This migration supports the following requirements from the design document:

- **Requirement 1.7**: Detection and classification storage (ScrapeAttempt, ProtectionDetection)
- **Requirement 2.4**: Proxy health tracking (Proxy, ProxySiteHealth)
- **Requirement 5.1**: Session and cookie management (ScrapingCookieJar)
- **Requirement 8.1**: Logging and debugging (ScrapeAttempt, ProtectionDetection)
- **Requirement 9.2**: Success rate tracking (ScrapingMetric)
- **Requirement 12.1**: Alert system (ScrapingAlert)
- **Requirement 15.1**: Configuration management (ScrapingConfig)

## Testing

After applying this migration:
1. Verify all tables are created: `\dt` in psql
2. Check indexes: `\di` in psql
3. Verify foreign key constraints
4. Test Prisma Client generation
5. Run integration tests for new models

## Security Considerations

- `passwordEncrypted` field stores encrypted proxy passwords
- Sensitive data in `responseSample` should be truncated to 1KB
- `metadata` JSON fields should not contain PII
- Access to scraping logs should be restricted by tenant

## Maintenance

### Cleanup Jobs
Consider implementing:
- Daily cleanup of old ScrapeAttempt records (retention: 30 days)
- Weekly cleanup of old ScrapingMetric records (retention: 90 days)
- Cleanup of expired ScrapingCookieJar entries
- Archival of acknowledged ScrapingAlert records

### Monitoring
Monitor:
- Table sizes and growth rates
- Index usage and performance
- Query performance on time-based queries
- JSONB field sizes
