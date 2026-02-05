---
title: "Performance Optimization Guide"
description: "Comprehensive guide to optimizing PricePilot performance for large product catalogs, efficient competitor tracking, and database optimization"
category: "advanced"
subcategory: null
tags: ["performance", "optimization", "database", "indexing", "caching", "scalability", "large-catalogs"]
author: "PricePilot Team"
lastReviewed: "2024-02-05"
relatedDocs: ["advanced-troubleshooting-guide", "admin-dashboard-guide"]
---

# Performance Optimization Guide

Comprehensive guide to optimizing PricePilot performance for large-scale operations. This guide covers strategies for managing large product catalogs, efficient competitor tracking, database optimization, and system monitoring.

## Overview

As your e-commerce business grows, optimizing PricePilot's performance becomes crucial for maintaining fast response times and efficient operations. This guide provides proven strategies and best practices for scaling PricePilot to handle thousands of products and competitors.

### When to Use This Guide

Use this performance optimization guide when:

- **Managing 1,000+ products** in your catalog
- **Tracking 10+ competitors** simultaneously
- **Experiencing slow page loads** or timeouts
- **Database queries taking too long** (>2 seconds)
- **Scraping jobs timing out** or failing
- **Planning to scale** your operations
- **Optimizing costs** for large-scale deployments

### What You'll Learn

- **Product Management**: Strategies for large catalogs
- **Competitor Tracking**: Efficient scraping at scale
- **Database Optimization**: Indexing and query tuning
- **Caching Strategies**: Reducing database load
- **Monitoring**: Performance metrics and profiling
- **Scalability**: Horizontal and vertical scaling options



## Product Management Optimization


### Managing Large Product Catalogs

#### Challenge: Slow Product Sync

When managing thousands of products, initial sync and updates can become slow and resource-intensive.

**Symptoms:**
- Product sync takes hours to complete
- API timeouts during bulk operations
- High memory usage during sync
- Database locks during updates

**Optimization Strategies:**

##### 1. Batch Processing

Process products in smaller batches instead of all at once:

```typescript
// Instead of syncing all products at once
const allProducts = await fetchAllProducts(); // ❌ Memory intensive

// Use batch processing
const BATCH_SIZE = 100;
for (let offset = 0; offset < totalProducts; offset += BATCH_SIZE) {
  const batch = await fetchProductsBatch(offset, BATCH_SIZE);
  await processProductBatch(batch);
  // Allow garbage collection between batches
  await new Promise(resolve => setTimeout(resolve, 100));
}
```

**Configuration:**

1. Navigate to **Settings** → **Integrations** → [Your Platform]
2. Set **Batch Size** to 100-200 products
3. Enable **Progressive Sync** for incremental updates
4. Set **Sync Interval** to off-peak hours

##### 2. Selective Syncing

Only sync products that have changed:

```typescript
// Track last sync timestamp
const lastSync = await getLastSyncTimestamp();

// Only fetch products modified since last sync
const updatedProducts = await fetchProductsSince(lastSync);
```

**Implementation:**

1. Enable **Incremental Sync** in integration settings
2. PricePilot tracks `lastSyncAt` timestamp per product
3. Only products modified since last sync are updated
4. Reduces sync time by 80-95% for established catalogs

##### 3. Parallel Processing

Process multiple batches concurrently:

```typescript
// Process multiple batches in parallel
const BATCH_SIZE = 100;
const CONCURRENT_BATCHES = 3;

const batches = chunkArray(productIds, BATCH_SIZE);
const batchGroups = chunkArray(batches, CONCURRENT_BATCHES);

for (const group of batchGroups) {
  await Promise.all(
    group.map(batch => processProductBatch(batch))
  );
}
```

**Configuration:**

- **Concurrent Workers**: 2-4 (based on server resources)
- **Rate Limiting**: Respect API limits
- **Error Handling**: Retry failed batches independently



#### Challenge: Product Matching Performance

Matching thousands of products against competitor catalogs can be computationally expensive.

**Optimization Strategies:**

##### 1. Prioritize Matching Methods

Use faster matching methods first:

```
Priority Order:
1. SKU Exact Match (fastest, O(1) with index)
2. Brand + Model Match (fast, indexed lookup)
3. Fuzzy Title Match (slow, full-text search)
4. Manual Override (instant, pre-matched)
```

**Configuration:**

1. Navigate to **Settings** → **Product Matching**
2. Enable **Early Exit** on successful match
3. Set **Fuzzy Match Threshold** to 85+ (reduces false positives)
4. Disable fuzzy matching for large catalogs if not needed

##### 2. Index Optimization for Matching

Ensure proper indexes exist:

```sql
-- SKU matching index
CREATE INDEX idx_products_sku ON user_products(sku);
CREATE INDEX idx_competitor_products_sku ON competitor_products(sku);

-- Brand + Model matching index
CREATE INDEX idx_products_brand_model ON user_products(brand, model);
CREATE INDEX idx_competitor_products_brand_model ON competitor_products(brand, model);

-- Full-text search index for fuzzy matching
CREATE INDEX idx_products_name_fts ON user_products USING gin(to_tsvector('english', name));
CREATE INDEX idx_competitor_products_name_fts ON competitor_products USING gin(to_tsvector('english', name));
```

##### 3. Cache Match Results

Cache successful matches to avoid re-matching:

```typescript
// Matches are cached in product_matches table
// Only re-match when:
// - Product details change (name, SKU, brand, model)
// - Competitor product details change
// - Match is manually rejected
// - Confidence score is below threshold
```

**Benefits:**
- 95%+ reduction in matching operations
- Instant price comparisons for matched products
- Lower CPU and database load

##### 4. Background Matching

Run matching jobs during off-peak hours:

1. Navigate to **Settings** → **Product Matching** → **Schedule**
2. Set **Matching Schedule** to low-traffic hours (e.g., 2-4 AM)
3. Enable **Progressive Matching** for new products only
4. Set **Re-matching Interval** to weekly or monthly



#### Challenge: Large Product Lists in UI

Displaying thousands of products in the dashboard can cause slow page loads.

**Optimization Strategies:**

##### 1. Pagination

Always use pagination for large datasets:

```typescript
// API request with pagination
GET /api/v1/products?page=1&limit=50

// Response includes pagination metadata
{
  "data": [...],
  "meta": {
    "page": 1,
    "limit": 50,
    "total": 5000,
    "totalPages": 100
  }
}
```

**Best Practices:**
- **Default Page Size**: 50 items
- **Maximum Page Size**: 100 items
- **Cursor-based Pagination**: For real-time data
- **Offset-based Pagination**: For static reports

##### 2. Virtual Scrolling

For large lists, use virtual scrolling to render only visible items:

```typescript
// Only render items in viewport
// Reduces DOM nodes from 5,000 to ~20
<VirtualList
  items={products}
  itemHeight={60}
  windowHeight={800}
  renderItem={(product) => <ProductRow product={product} />}
/>
```

**Benefits:**
- 90%+ reduction in DOM nodes
- Smooth scrolling with thousands of items
- Lower memory usage
- Faster initial render

##### 3. Lazy Loading

Load product details on-demand:

```typescript
// Load basic product list first
const products = await fetchProductsList(); // Name, SKU, Price only

// Load full details when user clicks
const productDetails = await fetchProductDetails(productId);
```

##### 4. Filtering and Search

Implement server-side filtering:

```typescript
// Filter on server, not client
GET /api/v1/products?status=active&brand=Samsung&minPrice=100

// Returns only matching products
// Reduces data transfer and client-side processing
```

**Recommended Filters:**
- Status (active, inactive)
- Brand
- Price range
- Match status
- Last updated date



## Efficient Competitor Tracking



### Optimizing Scraping Operations

#### Challenge: Slow Scraping Performance

Scraping hundreds or thousands of competitor products can take hours.

**Optimization Strategies:**

##### 1. Concurrent Scraping

Scrape multiple products simultaneously:

```typescript
// Sequential scraping (slow)
for (const product of products) {
  await scrapeProduct(product); // ❌ Takes hours
}

// Concurrent scraping (fast)
const CONCURRENCY = 5; // Scrape 5 products at once
const chunks = chunkArray(products, CONCURRENCY);

for (const chunk of chunks) {
  await Promise.all(
    chunk.map(product => scrapeProduct(product))
  );
}
```

**Configuration:**

1. Navigate to **Competitors** → [Competitor] → **Scraping Settings**
2. Set **Concurrent Requests** to 3-5
3. Monitor for rate limiting or blocking
4. Adjust based on competitor site tolerance

**Recommended Settings by Catalog Size:**

| Products | Concurrent Requests | Estimated Time |
|----------|-------------------|----------------|
| 1-100 | 3 | 5-10 minutes |
| 100-500 | 5 | 15-30 minutes |
| 500-1000 | 5 | 30-60 minutes |
| 1000+ | 5 | 1-3 hours |

##### 2. Smart Scheduling

Distribute scraping across time:

```typescript
// Instead of scraping all products at once
// Distribute across 24-hour period

const totalProducts = 1000;
const scrapingWindow = 24; // hours
const productsPerHour = totalProducts / scrapingWindow; // ~42 per hour

// Schedule products throughout the day
scheduleDistributedScraping(products, scrapingWindow);
```

**Benefits:**
- Reduces server load spikes
- Avoids rate limiting
- Spreads resource usage
- More consistent performance

**Configuration:**

1. Navigate to **Settings** → **Scraping** → **Advanced**
2. Enable **Distributed Scraping**
3. Set **Scraping Window** to 24 hours
4. Products are automatically scheduled throughout the window

##### 3. Prioritize High-Value Products

Scrape important products more frequently:

```typescript
// Priority levels
const priorities = {
  high: { frequency: '12h', products: topSellers },
  medium: { frequency: '24h', products: regularProducts },
  low: { frequency: '48h', products: lowVolume }
};
```

**Implementation:**

1. Navigate to **Products** → Select products
2. Click **Bulk Actions** → **Set Priority**
3. Choose priority level:
   - **High**: Top 20% of products by revenue
   - **Medium**: Middle 60% of products
   - **Low**: Bottom 20% of products



##### 4. Incremental Scraping

Only scrape products that need updates:

```typescript
// Check if product needs scraping
const needsScraping = (product) => {
  const hoursSinceLastScrape = getHoursSince(product.lastScrapedAt);
  const scrapingFrequency = product.scrapingFrequency || 24;
  
  return hoursSinceLastScrape >= scrapingFrequency;
};

// Only scrape products that need it
const productsToScrape = products.filter(needsScraping);
```

**Benefits:**
- 50-70% reduction in scraping operations
- Lower bandwidth usage
- Reduced risk of rate limiting
- Faster overall completion

##### 5. Caching Scraping Results

Cache competitor pages to reduce requests:

```typescript
// Cache competitor product pages
const cacheKey = `competitor:${competitorId}:product:${productId}`;
const cachedData = await cache.get(cacheKey);

if (cachedData && !isStale(cachedData)) {
  return cachedData; // Use cached data
}

// Scrape and cache
const freshData = await scrapeProduct(url);
await cache.set(cacheKey, freshData, { ttl: 3600 }); // Cache for 1 hour
```

**Configuration:**

1. Navigate to **Settings** → **Scraping** → **Caching**
2. Enable **Response Caching**
3. Set **Cache TTL** to 1-6 hours
4. Useful for products scraped multiple times per day

#### Challenge: Bot Protection and Rate Limiting

Aggressive scraping can trigger bot protection.

**Optimization Strategies:**

##### 1. Respect Rate Limits

Implement intelligent rate limiting:

```typescript
// Rate limiter configuration
const rateLimiter = {
  maxRequests: 10,      // Max requests per window
  windowMs: 60000,      // 1 minute window
  delayBetween: 2000,   // 2 second delay between requests
  backoffMultiplier: 2  // Exponential backoff on errors
};
```

**Best Practices:**
- Start conservative (5-10 requests/minute)
- Monitor success rate
- Increase gradually if no issues
- Back off immediately on errors

##### 2. Proxy Rotation (Premium)

Distribute requests across multiple IPs:

```typescript
// Rotate through proxy pool
const proxies = getProxyPool();
const proxy = selectProxy(proxies, 'round-robin');

await scrapeProduct(url, { proxy });
```

**Benefits:**
- Avoid IP-based rate limiting
- Reduce CAPTCHA encounters
- Higher success rates
- Faster scraping

**Configuration:**

1. Navigate to **Settings** → **Scraping** → **Proxies**
2. Enable **Proxy Rotation**
3. Select proxy provider (residential recommended)
4. Set **Rotation Strategy** to round-robin or least-used



##### 3. Request Randomization

Make scraping appear more human-like:

```typescript
// Randomize request timing
const delay = randomBetween(2000, 5000); // 2-5 seconds
await sleep(delay);

// Randomize user agents
const userAgent = selectRandomUserAgent();

// Randomize request order
const shuffledProducts = shuffle(products);
```

**Configuration:**

1. Navigate to **Competitors** → [Competitor] → **Scraping Settings**
2. Enable **Request Randomization**
3. Set **Delay Range** to 2-5 seconds
4. Enable **Random User-Agent**
5. Enable **Random Request Order**

##### 4. Adaptive Scraping

Automatically adjust based on success rate:

```typescript
// Monitor success rate
const successRate = calculateSuccessRate(last100Requests);

if (successRate < 0.8) {
  // Reduce concurrency and increase delays
  concurrency = Math.max(1, concurrency - 1);
  delay = delay * 1.5;
} else if (successRate > 0.95) {
  // Gradually increase performance
  concurrency = Math.min(10, concurrency + 1);
  delay = delay * 0.9;
}
```

**Benefits:**
- Automatic optimization
- Self-healing on errors
- Maximizes performance while avoiding blocks
- No manual intervention needed



## Database Performance Optimization

### Query Optimization

#### Challenge: Slow Database Queries

Complex queries can take seconds to execute, slowing down the entire application.

**Optimization Strategies:**

##### 1. Identify Slow Queries

Monitor query performance:

```sql
-- Enable query logging (PostgreSQL)
ALTER DATABASE pricepilot SET log_min_duration_statement = 1000; -- Log queries > 1s

-- View slow queries
SELECT 
  query,
  calls,
  total_time,
  mean_time,
  max_time
FROM pg_stat_statements
ORDER BY mean_time DESC
LIMIT 20;
```

**Common Slow Query Patterns:**
- Missing indexes on WHERE clauses
- N+1 query problems
- Unoptimized JOINs
- Full table scans
- Suboptimal aggregations

##### 2. Add Strategic Indexes

Create indexes for frequently queried columns:

```sql
-- Tenant isolation (critical for multi-tenant)
CREATE INDEX idx_user_products_tenant ON user_products(tenantId);
CREATE INDEX idx_competitor_products_tenant ON competitor_products(tenantId);

-- Status filtering
CREATE INDEX idx_user_products_status ON user_products(tenantId, status);
CREATE INDEX idx_product_matches_status ON product_matches(tenantId, status);

-- Date range queries
CREATE INDEX idx_price_history_recorded ON price_history(productId, recordedAt DESC);
CREATE INDEX idx_competitor_products_scraped ON competitor_products(competitorWebsiteId, lastScrapedAt);

-- Product matching
CREATE INDEX idx_products_sku ON user_products(tenantId, sku);
CREATE INDEX idx_products_brand_model ON user_products(tenantId, brand, model);

-- Composite indexes for common queries
CREATE INDEX idx_user_products_tenant_status_updated 
  ON user_products(tenantId, status, updatedAt DESC);
```



##### 3. Optimize JOIN Operations

Reduce JOIN complexity:

```sql
-- Inefficient: Multiple JOINs
SELECT 
  up.id,
  up.name,
  cp.price,
  cw.name as competitor_name,
  pm.confidence
FROM user_products up
LEFT JOIN product_matches pm ON pm.userProductId = up.id
LEFT JOIN competitor_products cp ON cp.id = pm.competitorProductId
LEFT JOIN competitor_websites cw ON cw.id = cp.competitorWebsiteId
WHERE up.tenantId = $1;

-- Optimized: Selective JOINs with indexes
SELECT 
  up.id,
  up.name,
  cp.price,
  cp.competitorWebsiteId,
  pm.confidence
FROM user_products up
INNER JOIN product_matches pm ON pm.userProductId = up.id AND pm.status = 'active'
INNER JOIN competitor_products cp ON cp.id = pm.competitorProductId
WHERE up.tenantId = $1 
  AND up.status = 'active'
  AND cp.lastScrapedAt > NOW() - INTERVAL '48 hours';
```

**Optimization Tips:**
- Use INNER JOIN instead of LEFT JOIN when possible
- Filter early in WHERE clause
- Only SELECT needed columns
- Use indexes on JOIN columns

##### 4. Avoid N+1 Queries

Load related data in bulk:

```typescript
// ❌ N+1 Problem: 1 query + N queries
const products = await db.userProduct.findMany({
  where: { tenantId }
});

for (const product of products) {
  // Separate query for each product
  const matches = await db.productMatch.findMany({
    where: { userProductId: product.id }
  });
}

// ✅ Solution: Single query with JOIN
const products = await db.userProduct.findMany({
  where: { tenantId },
  include: {
    matches: {
      include: {
        competitorProduct: true
      }
    }
  }
});
```

**Prisma Optimization:**

```typescript
// Use select to limit fields
const products = await prisma.userProduct.findMany({
  where: { tenantId },
  select: {
    id: true,
    name: true,
    sku: true,
    currentPrice: true,
    matches: {
      where: { status: 'active' },
      select: {
        id: true,
        confidence: true,
        competitorProduct: {
          select: {
            id: true,
            name: true,
            currentPrice: true
          }
        }
      }
    }
  }
});
```

##### 5. Use Database Views for Complex Queries

Create materialized views for expensive aggregations:

```sql
-- Create materialized view for product comparison summary
CREATE MATERIALIZED VIEW product_comparison_summary AS
SELECT 
  up.id as user_product_id,
  up.tenantId,
  up.name,
  up.currentPrice as user_price,
  COUNT(pm.id) as match_count,
  MIN(cp.currentPrice) as min_competitor_price,
  AVG(cp.currentPrice) as avg_competitor_price,
  MAX(cp.currentPrice) as max_competitor_price
FROM user_products up
LEFT JOIN product_matches pm ON pm.userProductId = up.id AND pm.status = 'active'
LEFT JOIN competitor_products cp ON cp.id = pm.competitorProductId
WHERE up.status = 'active'
GROUP BY up.id, up.tenantId, up.name, up.currentPrice;

-- Create index on materialized view
CREATE INDEX idx_product_comparison_tenant ON product_comparison_summary(tenantId);

-- Refresh periodically (e.g., hourly via cron)
REFRESH MATERIALIZED VIEW CONCURRENTLY product_comparison_summary;
```

**Benefits:**
- Pre-computed aggregations
- Instant query results
- Reduced database load
- Better user experience



### Indexing Best Practices

#### Index Strategy

**When to Add Indexes:**

1. **WHERE Clauses**: Columns frequently used in WHERE conditions
2. **JOIN Columns**: Foreign key columns used in JOINs
3. **ORDER BY**: Columns used for sorting
4. **GROUP BY**: Columns used in aggregations
5. **UNIQUE Constraints**: Natural keys and unique identifiers

**When NOT to Add Indexes:**

1. **Small Tables**: Tables with < 1,000 rows
2. **High Write Frequency**: Indexes slow down INSERT/UPDATE
3. **Low Selectivity**: Columns with few distinct values (e.g., boolean)
4. **Rarely Queried**: Columns not used in queries

#### Composite Indexes

Use composite indexes for multi-column queries:

```sql
-- Query pattern
SELECT * FROM user_products 
WHERE tenantId = $1 AND status = 'active' 
ORDER BY updatedAt DESC;

-- Optimal composite index (order matters!)
CREATE INDEX idx_user_products_tenant_status_updated 
  ON user_products(tenantId, status, updatedAt DESC);

-- Index column order rules:
-- 1. Equality conditions first (tenantId, status)
-- 2. Range/sort conditions last (updatedAt)
-- 3. Most selective columns first
```

#### Partial Indexes

Create indexes for specific subsets:

```sql
-- Only index active products (reduces index size)
CREATE INDEX idx_active_products 
  ON user_products(tenantId, updatedAt) 
  WHERE status = 'active';

-- Only index recent price history (last 90 days)
CREATE INDEX idx_recent_price_history 
  ON price_history(productId, recordedAt DESC) 
  WHERE recordedAt > NOW() - INTERVAL '90 days';
```

**Benefits:**
- Smaller index size
- Faster index updates
- Lower storage costs
- Better cache hit rates

#### Index Maintenance

Monitor and maintain indexes:

```sql
-- Check index usage
SELECT 
  schemaname,
  tablename,
  indexname,
  idx_scan as index_scans,
  idx_tup_read as tuples_read,
  idx_tup_fetch as tuples_fetched
FROM pg_stat_user_indexes
ORDER BY idx_scan ASC;

-- Find unused indexes (idx_scan = 0)
SELECT 
  schemaname,
  tablename,
  indexname,
  pg_size_pretty(pg_relation_size(indexrelid)) as index_size
FROM pg_stat_user_indexes
WHERE idx_scan = 0
  AND indexrelname NOT LIKE 'pg_toast%';

-- Rebuild bloated indexes
REINDEX INDEX CONCURRENTLY idx_user_products_tenant;

-- Analyze tables after bulk operations
ANALYZE user_products;
```

**Maintenance Schedule:**
- **Daily**: Monitor slow queries
- **Weekly**: Check index usage statistics
- **Monthly**: Identify and remove unused indexes
- **Quarterly**: Rebuild heavily-used indexes



### Caching Strategies

#### Application-Level Caching

Implement Redis caching for frequently accessed data:

```typescript
import { Redis } from 'ioredis';

const redis = new Redis(process.env.REDIS_URL);

// Cache product data
async function getProduct(productId: string) {
  const cacheKey = `product:${productId}`;
  
  // Try cache first
  const cached = await redis.get(cacheKey);
  if (cached) {
    return JSON.parse(cached);
  }
  
  // Fetch from database
  const product = await db.userProduct.findUnique({
    where: { id: productId }
  });
  
  // Cache for 1 hour
  await redis.setex(cacheKey, 3600, JSON.stringify(product));
  
  return product;
}
```



**What to Cache:**

| Data Type | TTL | Invalidation Strategy |
|-----------|-----|----------------------|
| Product details | 1 hour | On product update |
| Competitor prices | 6 hours | On scraping completion |
| Product matches | 24 hours | On match update |
| User settings | 1 hour | On settings change |
| Dashboard stats | 5 minutes | Time-based |
| API responses | 1-5 minutes | Time-based |

**Cache Invalidation:**

```typescript
// Invalidate on update
async function updateProduct(productId: string, data: any) {
  // Update database
  const product = await db.userProduct.update({
    where: { id: productId },
    data
  });
  
  // Invalidate cache
  await redis.del(`product:${productId}`);
  
  // Invalidate related caches
  await redis.del(`product:${productId}:matches`);
  await redis.del(`tenant:${product.tenantId}:products`);
  
  return product;
}
```

#### Query Result Caching

Cache expensive query results:

```typescript
// Cache dashboard statistics
async function getDashboardStats(tenantId: string) {
  const cacheKey = `dashboard:stats:${tenantId}`;
  
  const cached = await redis.get(cacheKey);
  if (cached) return JSON.parse(cached);
  
  // Expensive aggregation query
  const stats = await db.$queryRaw`
    SELECT 
      COUNT(*) as total_products,
      COUNT(CASE WHEN status = 'active' THEN 1 END) as active_products,
      AVG(currentPrice) as avg_price
    FROM user_products
    WHERE tenantId = ${tenantId}
  `;
  
  // Cache for 5 minutes
  await redis.setex(cacheKey, 300, JSON.stringify(stats));
  
  return stats;
}
```

#### HTTP Response Caching

Cache API responses:

```typescript
// Next.js API route with caching
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const tenantId = searchParams.get('tenantId');
  
  // Generate cache key from request
  const cacheKey = `api:products:${tenantId}:${searchParams.toString()}`;
  
  // Check cache
  const cached = await redis.get(cacheKey);
  if (cached) {
    return new Response(cached, {
      headers: {
        'Content-Type': 'application/json',
        'X-Cache': 'HIT'
      }
    });
  }
  
  // Fetch data
  const products = await fetchProducts(tenantId, searchParams);
  const response = JSON.stringify(products);
  
  // Cache for 1 minute
  await redis.setex(cacheKey, 60, response);
  
  return new Response(response, {
    headers: {
      'Content-Type': 'application/json',
      'X-Cache': 'MISS'
    }
  });
}
```

#### Cache Warming

Pre-populate cache for common queries:

```typescript
// Warm cache on application startup or schedule
async function warmCache() {
  const tenants = await db.tenant.findMany({
    where: { status: 'active' }
  });
  
  for (const tenant of tenants) {
    // Pre-cache dashboard stats
    await getDashboardStats(tenant.id);
    
    // Pre-cache active products
    await getActiveProducts(tenant.id);
    
    // Pre-cache recent price updates
    await getRecentPriceUpdates(tenant.id);
  }
}

// Schedule cache warming
cron.schedule('0 * * * *', warmCache); // Every hour
```



## Monitoring and Profiling



### Performance Metrics

#### Key Performance Indicators (KPIs)

Monitor these critical metrics:

**Application Performance:**

| Metric | Target | Warning | Critical |
|--------|--------|---------|----------|
| API Response Time (p95) | < 200ms | > 500ms | > 1000ms |
| Page Load Time | < 2s | > 3s | > 5s |
| Database Query Time (avg) | < 50ms | > 200ms | > 500ms |
| Cache Hit Rate | > 80% | < 60% | < 40% |
| Error Rate | < 0.1% | > 1% | > 5% |

**Scraping Performance:**

| Metric | Target | Warning | Critical |
|--------|--------|---------|----------|
| Scraping Success Rate | > 95% | < 85% | < 70% |
| Scraping Duration | < 1 hour | > 2 hours | > 4 hours |
| CAPTCHA Encounter Rate | < 5% | > 15% | > 30% |
| Products Scraped/Hour | > 100 | < 50 | < 20 |

**Database Performance:**

| Metric | Target | Warning | Critical |
|--------|--------|---------|----------|
| Connection Pool Usage | < 70% | > 85% | > 95% |
| Slow Query Count | < 10/hour | > 50/hour | > 100/hour |
| Table Bloat | < 20% | > 40% | > 60% |
| Index Hit Rate | > 99% | < 95% | < 90% |

#### Monitoring Tools

**1. Application Performance Monitoring (APM)**

Use Sentry or similar APM tools:

```typescript
import * as Sentry from '@sentry/nextjs';

// Track performance
Sentry.startTransaction({
  name: 'scrape-competitor-products',
  op: 'scraping'
});

// Track slow queries
Sentry.addBreadcrumb({
  category: 'query',
  message: 'Slow query detected',
  level: 'warning',
  data: {
    query: 'SELECT * FROM user_products...',
    duration: 2500
  }
});
```

**2. Database Monitoring**

Monitor PostgreSQL performance:

```sql
-- Active queries
SELECT 
  pid,
  now() - query_start as duration,
  state,
  query
FROM pg_stat_activity
WHERE state != 'idle'
ORDER BY duration DESC;

-- Database size
SELECT 
  pg_database.datname,
  pg_size_pretty(pg_database_size(pg_database.datname)) as size
FROM pg_database
ORDER BY pg_database_size(pg_database.datname) DESC;

-- Table sizes
SELECT 
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size,
  pg_size_pretty(pg_relation_size(schemaname||'.'||tablename)) as table_size,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename) - pg_relation_size(schemaname||'.'||tablename)) as index_size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

**3. Redis Monitoring**

Monitor cache performance:

```bash
# Redis CLI
redis-cli INFO stats

# Key metrics:
# - keyspace_hits: Cache hits
# - keyspace_misses: Cache misses
# - used_memory: Memory usage
# - connected_clients: Active connections
```

```typescript
// Application-level cache monitoring
async function getCacheStats() {
  const info = await redis.info('stats');
  const hits = parseInt(info.match(/keyspace_hits:(\d+)/)?.[1] || '0');
  const misses = parseInt(info.match(/keyspace_misses:(\d+)/)?.[1] || '0');
  
  const hitRate = hits / (hits + misses);
  
  return {
    hits,
    misses,
    hitRate: (hitRate * 100).toFixed(2) + '%'
  };
}
```



### Profiling Techniques

#### Application Profiling

**1. Node.js Profiling**

Profile CPU usage:

```bash
# Start application with profiling
node --prof app.js

# Generate readable report
node --prof-process isolate-0x*.log > profile.txt

# Analyze profile.txt for hot spots
```

**2. Next.js Performance Profiling**

Use React DevTools Profiler:

```typescript
import { Profiler } from 'react';

function onRenderCallback(
  id: string,
  phase: 'mount' | 'update',
  actualDuration: number,
  baseDuration: number,
  startTime: number,
  commitTime: number
) {
  console.log(`${id} (${phase}) took ${actualDuration}ms`);
}

export default function ProductList() {
  return (
    <Profiler id="ProductList" onRender={onRenderCallback}>
      {/* Component tree */}
    </Profiler>
  );
}
```

**3. Database Query Profiling**

Profile slow queries:

```sql
-- Enable query timing
\timing on

-- Explain query execution plan
EXPLAIN ANALYZE
SELECT * FROM user_products 
WHERE tenantId = 'tenant-123' 
  AND status = 'active'
ORDER BY updatedAt DESC
LIMIT 50;

-- Look for:
-- - Seq Scan (bad, should use index)
-- - Index Scan (good)
-- - Execution time
-- - Planning time
```

**4. Memory Profiling**

Detect memory leaks:

```typescript
// Monitor memory usage
setInterval(() => {
  const usage = process.memoryUsage();
  console.log({
    rss: `${Math.round(usage.rss / 1024 / 1024)}MB`,
    heapTotal: `${Math.round(usage.heapTotal / 1024 / 1024)}MB`,
    heapUsed: `${Math.round(usage.heapUsed / 1024 / 1024)}MB`,
    external: `${Math.round(usage.external / 1024 / 1024)}MB`
  });
}, 60000); // Every minute
```

#### Performance Testing

**1. Load Testing**

Test application under load:

```bash
# Install k6
brew install k6

# Create load test script (load-test.js)
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '2m', target: 100 }, // Ramp up to 100 users
    { duration: '5m', target: 100 }, // Stay at 100 users
    { duration: '2m', target: 0 },   // Ramp down
  ],
};

export default function () {
  const res = http.get('https://yourapp.com/api/v1/products');
  check(res, {
    'status is 200': (r) => r.status === 200,
    'response time < 500ms': (r) => r.timings.duration < 500,
  });
  sleep(1);
}

# Run load test
k6 run load-test.js
```

**2. Database Load Testing**

Test database performance:

```bash
# Install pgbench
sudo apt-get install postgresql-contrib

# Initialize test database
pgbench -i -s 50 pricepilot_test

# Run benchmark
pgbench -c 10 -j 2 -t 1000 pricepilot_test

# Results show:
# - Transactions per second (TPS)
# - Average latency
# - Connection overhead
```

**3. Scraping Performance Testing**

Test scraping at scale:

```typescript
// Test concurrent scraping
async function testScrapingPerformance() {
  const products = await getTestProducts(100);
  const concurrencyLevels = [1, 3, 5, 10];
  
  for (const concurrency of concurrencyLevels) {
    const startTime = Date.now();
    
    await scrapeProductsConcurrently(products, concurrency);
    
    const duration = Date.now() - startTime;
    const productsPerSecond = (products.length / duration) * 1000;
    
    console.log({
      concurrency,
      duration: `${duration}ms`,
      productsPerSecond: productsPerSecond.toFixed(2),
      successRate: calculateSuccessRate()
    });
  }
}
```



## Scalability Strategies



### Vertical Scaling

Increase resources on existing servers:

**When to Scale Vertically:**
- Single tenant with growing needs
- Database performance bottleneck
- Memory-intensive operations
- Simpler than horizontal scaling

**Resource Recommendations:**

| Catalog Size | CPU | RAM | Storage |
|--------------|-----|-----|---------|
| < 1,000 products | 2 cores | 4 GB | 50 GB |
| 1,000-5,000 products | 4 cores | 8 GB | 100 GB |
| 5,000-10,000 products | 8 cores | 16 GB | 200 GB |
| 10,000+ products | 16+ cores | 32+ GB | 500+ GB |

**Database Scaling:**

```sql
-- Increase connection pool
ALTER SYSTEM SET max_connections = 200;

-- Increase shared buffers (25% of RAM)
ALTER SYSTEM SET shared_buffers = '4GB';

-- Increase work memory
ALTER SYSTEM SET work_mem = '64MB';

-- Increase maintenance work memory
ALTER SYSTEM SET maintenance_work_mem = '512MB';

-- Reload configuration
SELECT pg_reload_conf();
```

### Horizontal Scaling

Distribute load across multiple servers:

**When to Scale Horizontally:**
- Multiple tenants
- High traffic volume
- Geographic distribution
- High availability requirements

**Architecture Components:**

```
┌─────────────────┐
│  Load Balancer  │
└────────┬────────┘
         │
    ┌────┴────┐
    │         │
┌───▼───┐ ┌──▼────┐
│ App 1 │ │ App 2 │
└───┬───┘ └──┬────┘
    │         │
    └────┬────┘
         │
┌────────▼────────┐
│   Database      │
│   (Primary)     │
└────────┬────────┘
         │
    ┌────┴────┐
    │         │
┌───▼───┐ ┌──▼────┐
│Read 1 │ │Read 2 │
└───────┘ └───────┘
```

**Implementation:**

1. **Load Balancer**: Distribute requests (Nginx, HAProxy, AWS ALB)
2. **Application Servers**: Multiple Next.js instances
3. **Database Replication**: Primary for writes, replicas for reads
4. **Shared Cache**: Redis cluster for session/cache sharing
5. **Queue System**: Background job processing (BullMQ, RabbitMQ)

### Read Replicas

Offload read queries to replicas:

```typescript
// Database connection configuration
const dbConfig = {
  primary: {
    host: process.env.DB_PRIMARY_HOST,
    // Used for writes
  },
  replicas: [
    { host: process.env.DB_REPLICA_1_HOST },
    { host: process.env.DB_REPLICA_2_HOST }
  ]
};

// Route reads to replicas
async function getProducts(tenantId: string) {
  return await db.replica.userProduct.findMany({
    where: { tenantId }
  });
}

// Route writes to primary
async function updateProduct(id: string, data: any) {
  return await db.primary.userProduct.update({
    where: { id },
    data
  });
}
```

**Benefits:**
- 3-5x read capacity increase
- Reduced primary database load
- Better query performance
- Geographic distribution

### Queue-Based Processing

Offload heavy operations to background workers:

```typescript
import { Queue, Worker } from 'bullmq';

// Create queue
const scrapingQueue = new Queue('scraping', {
  connection: redis
});

// Add jobs to queue
async function scheduleScraping(competitorId: string) {
  await scrapingQueue.add('scrape-competitor', {
    competitorId,
    priority: 'normal'
  }, {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000
    }
  });
}

// Process jobs in worker
const worker = new Worker('scraping', async (job) => {
  const { competitorId } = job.data;
  await scrapeCompetitor(competitorId);
}, {
  connection: redis,
  concurrency: 5
});
```

**Benefits:**
- Non-blocking operations
- Automatic retries
- Rate limiting
- Scalable workers
- Job prioritization



## Performance Optimization Checklist



### Initial Setup

- [ ] **Database Indexes**: Create indexes for all foreign keys and frequently queried columns
- [ ] **Connection Pooling**: Configure appropriate connection pool size
- [ ] **Redis Cache**: Set up Redis for application caching
- [ ] **Query Monitoring**: Enable slow query logging
- [ ] **APM Tool**: Install and configure Sentry or similar
- [ ] **Resource Limits**: Set appropriate memory and CPU limits

### Product Management

- [ ] **Batch Processing**: Implement batch processing for product sync
- [ ] **Incremental Sync**: Enable incremental sync for established catalogs
- [ ] **Pagination**: Use pagination for all product lists
- [ ] **Lazy Loading**: Implement lazy loading for product details
- [ ] **Virtual Scrolling**: Use virtual scrolling for large lists

### Competitor Tracking

- [ ] **Concurrent Scraping**: Configure optimal concurrency level
- [ ] **Distributed Scraping**: Spread scraping across 24-hour window
- [ ] **Priority Levels**: Set priority levels for products
- [ ] **Incremental Scraping**: Only scrape products that need updates
- [ ] **Rate Limiting**: Implement intelligent rate limiting
- [ ] **Proxy Rotation**: Enable proxy rotation if needed

### Database Optimization

- [ ] **Index Strategy**: Review and optimize indexes
- [ ] **Query Optimization**: Identify and fix slow queries
- [ ] **N+1 Prevention**: Eliminate N+1 query patterns
- [ ] **Materialized Views**: Create views for complex aggregations
- [ ] **Partial Indexes**: Use partial indexes where appropriate
- [ ] **Index Maintenance**: Schedule regular index maintenance

### Caching

- [ ] **Application Cache**: Implement Redis caching for hot data
- [ ] **Query Cache**: Cache expensive query results
- [ ] **API Cache**: Cache API responses
- [ ] **Cache Warming**: Pre-populate cache for common queries
- [ ] **Cache Invalidation**: Implement proper invalidation strategy

### Monitoring

- [ ] **Performance Metrics**: Track key performance indicators
- [ ] **Database Monitoring**: Monitor database performance
- [ ] **Cache Monitoring**: Track cache hit rates
- [ ] **Error Tracking**: Monitor error rates and types
- [ ] **Alerting**: Set up alerts for performance degradation
- [ ] **Regular Reviews**: Schedule monthly performance reviews

### Scalability

- [ ] **Resource Planning**: Plan for growth
- [ ] **Load Testing**: Perform regular load tests
- [ ] **Scaling Strategy**: Document vertical/horizontal scaling plan
- [ ] **Read Replicas**: Consider read replicas for high traffic
- [ ] **Queue System**: Implement background job processing
- [ ] **CDN**: Use CDN for static assets



## Common Performance Issues and Solutions

### Issue: Dashboard Loading Slowly

**Symptoms:**
- Dashboard takes 5+ seconds to load
- Multiple database queries on page load
- High CPU usage during render

**Solutions:**

1. **Implement Server-Side Caching:**
   ```typescript
   // Cache dashboard data
   const cacheKey = `dashboard:${tenantId}`;
   const cached = await redis.get(cacheKey);
   if (cached) return JSON.parse(cached);
   
   const data = await fetchDashboardData(tenantId);
   await redis.setex(cacheKey, 300, JSON.stringify(data)); // 5 min cache
   ```

2. **Optimize Database Queries:**
   - Use single query with JOINs instead of multiple queries
   - Add indexes on filtered columns
   - Use materialized views for aggregations

3. **Lazy Load Widgets:**
   - Load critical data first
   - Load secondary widgets asynchronously
   - Show loading skeletons

### Issue: Product Sync Taking Hours

**Symptoms:**
- Initial sync takes 4+ hours
- High memory usage during sync
- API timeouts

**Solutions:**

1. **Reduce Batch Size:**
   - Change from 500 to 100 products per batch
   - Allows garbage collection between batches
   - Reduces memory pressure

2. **Enable Parallel Processing:**
   - Process 2-3 batches concurrently
   - Monitor API rate limits
   - Adjust based on performance

3. **Use Incremental Sync:**
   - Only sync changed products
   - Reduces sync time by 90%+
   - Enable in integration settings

### Issue: Scraping Success Rate Below 80%

**Symptoms:**
- Many scraping failures
- CAPTCHA encounters
- Timeout errors

**Solutions:**

1. **Reduce Scraping Frequency:**
   - Change from 12 hours to 24 hours
   - Reduces bot detection risk
   - Improves success rate

2. **Enable Request Randomization:**
   - Random delays between requests
   - Random user agents
   - Random request order

3. **Use Proxy Rotation:**
   - Distribute requests across IPs
   - Reduces IP-based blocking
   - Premium feature

### Issue: Database Queries Timing Out

**Symptoms:**
- Queries taking 10+ seconds
- Database CPU at 100%
- Connection pool exhausted

**Solutions:**

1. **Add Missing Indexes:**
   ```sql
   -- Identify missing indexes
   SELECT * FROM pg_stat_user_tables WHERE idx_scan = 0;
   
   -- Add indexes for slow queries
   CREATE INDEX idx_products_tenant_status 
     ON user_products(tenantId, status);
   ```

2. **Optimize Query:**
   - Remove unnecessary JOINs
   - Add WHERE clause filters
   - Use LIMIT for large result sets

3. **Increase Database Resources:**
   - Upgrade to larger instance
   - Increase connection pool
   - Add read replicas



## Best Practices Summary

### Do's

✅ **Monitor Performance Regularly**: Track metrics and set up alerts
✅ **Use Indexes Strategically**: Index frequently queried columns
✅ **Implement Caching**: Cache hot data and expensive queries
✅ **Batch Operations**: Process data in manageable batches
✅ **Optimize Queries**: Use EXPLAIN to analyze query plans
✅ **Load Test**: Test performance under realistic load
✅ **Plan for Scale**: Design for growth from the start
✅ **Document Changes**: Keep performance optimization log

### Don'ts

❌ **Don't Over-Index**: Too many indexes slow down writes
❌ **Don't Cache Everything**: Cache strategically, not blindly
❌ **Don't Ignore Monitoring**: Performance issues compound over time
❌ **Don't Skip Load Testing**: Production surprises are expensive
❌ **Don't Optimize Prematurely**: Measure first, optimize second
❌ **Don't Forget Maintenance**: Regular maintenance prevents issues
❌ **Don't Ignore Errors**: Error rates indicate underlying problems



## Next Steps

After implementing these optimizations:

1. **Measure Impact**: Compare before/after metrics
2. **Monitor Continuously**: Set up ongoing monitoring
3. **Iterate**: Performance optimization is continuous
4. **Document**: Keep records of what works
5. **Share Knowledge**: Help other team members optimize

### Related Documentation

- [Advanced Troubleshooting Guide](../troubleshooting/advanced-troubleshooting-guide) - Diagnostic techniques
- [Admin Dashboard Guide](../../admin/tenant-management/admin-dashboard-guide) - System monitoring
- [Database Schema Guidelines](.kiro/steering/database-schema-guidelines.md) - Database design

### Need Help?

If you're experiencing performance issues not covered in this guide:

1. Check the [Advanced Troubleshooting Guide](../troubleshooting/advanced-troubleshooting-guide)
2. Review your monitoring dashboards
3. Contact support with performance metrics
4. Consider a performance audit consultation

---

**Last Updated**: February 5, 2024  
**Applies To**: PricePilot v2.0+  
**Difficulty Level**: Advanced
