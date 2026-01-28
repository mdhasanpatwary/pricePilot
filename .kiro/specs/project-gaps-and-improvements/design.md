# Project Gaps and Improvements - Design Document

## 1. Design Overview

### 1.1 Purpose
This design document provides technical solutions for all identified gaps and issues in the PricePilot project.

### 1.2 Design Principles
- **Minimal Changes**: Fix issues without major refactoring
- **Backward Compatibility**: Maintain existing functionality
- **Security First**: Address all security vulnerabilities
- **Performance**: Optimize without breaking changes
- **Testability**: Ensure all fixes are testable

### 1.3 Architecture Impact
- No major architectural changes required
- Focus on fixing existing implementations
- Add missing features within current architecture
- Improve error handling and logging throughout

---

## 2. Critical Issues - Design Solutions

### 2.1 Documentation Inconsistencies

**Problem**: Documentation claims 15-minute scraping but implementation uses 24 hours.

**Solution**:
```typescript
// Update all documentation files
// Files to update:
// - DOCUMENTATION.md
// - README.md
// - docs/ARCHITECTURE.md
// - app/dashboard/*/page.tsx (UI text)

// Verify cron configuration matches documentation
// vercel.json:
{
  "crons": [{
    "path": "/api/v1/cron/global-sync",
    "schedule": "0 0 * * *"  // Daily at midnight
  }]
}
```

**Implementation**:
1. Search and replace all "15 minutes" references with "24 hours"
2. Update UI components showing scraping frequency
3. Add configuration option for scraping frequency (future enhancement)
4. Document actual behavior in user-facing help text

---

### 2.2 False Platform Support Claims

**Problem**: Documentation lists unsupported platforms as supported.

**Solution**:
```typescript
// Update DOCUMENTATION.md
### Supported Platforms
- ✅ OpenCart (Fully Supported)
- ✅ Laravel (Fully Supported)
- 🚧 Shopify (In Development)
- 🚧 WooCommerce (In Development)
- 🚧 Magento (In Development)
- ⏳ PrestaShop (Planned)
- ⏳ BigCommerce (Planned)

// Update UI to disable unsupported platforms
// app/dashboard/integrations/page.tsx
const SUPPORTED_PLATFORMS = ['OPENCART', 'LARAVEL'];
const IN_DEVELOPMENT = ['SHOPIFY', 'WOOCOMMERCE', 'MAGENTO'];
const PLANNED = ['PRESTASHOP', 'BIGCOMMERCE'];

// Render with appropriate badges and disabled state
```

**Implementation**:
1. Update all documentation to reflect actual support
2. Add platform status badges (✅ Supported, 🚧 In Development, ⏳ Planned)
3. Disable unsupported platform selection in UI
4. Show "Coming Soon" message for planned platforms
5. Remove or complete partial implementations

---

### 2.3 Mock Data Fallbacks

**Problem**: Production code falls back to mock data, hiding real failures.

**Solution**:
```typescript
// lib/services/sync.ts

// BEFORE (Bad):
catch (error) {
  console.error(`OpenCart API error: ${error}`);
  // Fallback to mock data
  return MOCK_PRODUCTS;
}

// AFTER (Good):
catch (error) {
  logger.error(`OpenCart API error for ${site.baseUrl}`, { 
    error,
    siteId: site.id,
    tenantId: site.tenantId 
  });
  
  // Log to sync logs for user visibility
  await prisma.syncLog.create({
    data: {
      siteId: site.id,
      level: "ERROR",
      message: `Failed to fetch products: ${error.message}`
    }
  });
  
  // Send notification to tenant
  await NotificationService.create({
    tenantId: site.tenantId,
    type: "SYNC_ERROR",
    title: "Product Sync Failed",
    message: `Failed to sync products from ${site.baseUrl}`,
    link: `/dashboard/integrations`
  });
  
  // Throw error instead of returning mock data
  throw new Error(`Sync failed for ${site.baseUrl}: ${error.message}`);
}

// Move mock data to test fixtures
// __tests__/fixtures/mock-products.ts
export const MOCK_OPENCART_PRODUCTS = [...];
```

**Implementation**:
1. Remove all mock data fallbacks from production code
2. Add comprehensive error logging
3. Create user notifications for sync failures
4. Move mock data to test fixtures
5. Add environment variable to enable mock mode for development

---

### 2.4 Incomplete Price Update APIs

**Problem**: OpenCart and Laravel price update APIs are incomplete or placeholder.

**Solution**:
```typescript
// lib/services/sync.ts - Complete OpenCart Implementation

private static async updateOpenCartPrice(site: Site, product: Product): Promise<boolean> {
  const url = `${site.baseUrl}/index.php?route=api/pricepilot/update&api_token=${site.apiToken}`;
  
  try {
    const response = await this.axiosRequestWithRetry({
      method: "POST",
      url,
      data: {
        product_id: product.externalId,
        price: product.currentPrice.toString(),
        // Include additional fields for validation
        sku: product.sku,
        verify: true // Request verification response
      },
      timeout: 10000,
    });
    
    // Verify response
    if (response.data?.success && response.data?.updated_price) {
      const updatedPrice = parseFloat(response.data.updated_price);
      const expectedPrice = parseFloat(product.currentPrice.toString());
      
      if (Math.abs(updatedPrice - expectedPrice) > 0.01) {
        throw new Error(`Price mismatch: expected ${expectedPrice}, got ${updatedPrice}`);
      }
      
      // Log successful update
      await prisma.priceUpdateLog.create({
        data: {
          productId: product.id,
          oldPrice: response.data.old_price || product.currentPrice,
          newPrice: product.currentPrice,
          logicType: "FIXED",
          status: "SUCCESS",
          executedAt: new Date()
        }
      });
      
      return true;
    }
    
    throw new Error(`Invalid response from OpenCart: ${JSON.stringify(response.data)}`);
    
  } catch (error) {
    // Log failed update
    await prisma.priceUpdateLog.create({
      data: {
        productId: product.id,
        oldPrice: product.currentPrice,
        newPrice: product.currentPrice,
        logicType: "FIXED",
        status: "FAILED",
        errorDetails: error instanceof Error ? error.message : String(error),
        executedAt: new Date()
      }
    });
    
    logger.error(`OpenCart price update failed for product ${product.id}`, { error });
    return false;
  }
}

// Similar implementation for Laravel
private static async updateLaravelPrice(site: Site, product: Product): Promise<boolean> {
  // Complete implementation with verification and logging
}
```

**OpenCart Extension Requirements**:
```php
// integrations/opencart/catalog/controller/api/pricepilot.php

public function update() {
    // Verify API token
    if (!$this->validateToken()) {
        $this->response->setOutput(json_encode([
            'success' => false,
            'error' => 'Invalid API token'
        ]));
        return;
    }
    
    $product_id = $this->request->post['product_id'];
    $new_price = $this->request->post['price'];
    $sku = $this->request->post['sku'] ?? null;
    
    // Load product model
    $this->load->model('catalog/product');
    
    // Verify product exists
    $product = $this->model_catalog_product->getProduct($product_id);
    if (!$product) {
        $this->response->setOutput(json_encode([
            'success' => false,
            'error' => 'Product not found'
        ]));
        return;
    }
    
    // Verify SKU matches (if provided)
    if ($sku && $product['sku'] !== $sku) {
        $this->response->setOutput(json_encode([
            'success' => false,
            'error' => 'SKU mismatch'
        ]));
        return;
    }
    
    // Store old price for response
    $old_price = $product['price'];
    
    // Update price
    $this->model_catalog_product->editProduct($product_id, [
        'price' => $new_price
    ]);
    
    // Verify update
    $updated_product = $this->model_catalog_product->getProduct($product_id);
    
    $this->response->setOutput(json_encode([
        'success' => true,
        'product_id' => $product_id,
        'old_price' => $old_price,
        'updated_price' => $updated_product['price'],
        'timestamp' => date('Y-m-d H:i:s')
    ]));
}
```

**Implementation**:
1. Complete OpenCart price update API with verification
2. Complete Laravel price update API with verification
3. Add comprehensive error handling
4. Add price update logging
5. Test with real OpenCart/Laravel instances
6. Document API requirements for integrations

---

### 2.5 Security Vulnerabilities

**Problem**: Multiple security issues identified.

**Solution**:

#### 2.5.1 API Token Encryption
```typescript
// lib/security.ts

import crypto from 'crypto';

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY!; // 32-byte key
const ALGORITHM = 'aes-256-gcm';

export function encryptApiToken(token: string): string {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, Buffer.from(ENCRYPTION_KEY, 'hex'), iv);
  
  let encrypted = cipher.update(token, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  const authTag = cipher.getAuthTag();
  
  // Return iv:authTag:encrypted
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

export function decryptApiToken(encryptedToken: string): string {
  const [ivHex, authTagHex, encrypted] = encryptedToken.split(':');
  
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  const decipher = crypto.createDecipheriv(ALGORITHM, Buffer.from(ENCRYPTION_KEY, 'hex'), iv);
  
  decipher.setAuthTag(authTag);
  
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
}

// Update Site model to use encrypted tokens
// prisma/schema.prisma
model Site {
  apiToken String? // Stored encrypted
  // ... other fields
}

// Middleware to encrypt/decrypt
// lib/middleware/encryption.ts
export async function encryptSiteToken(siteData: any) {
  if (siteData.apiToken) {
    siteData.apiToken = encryptApiToken(siteData.apiToken);
  }
  return siteData;
}

export async function decryptSiteToken(site: Site) {
  if (site.apiToken) {
    return {
      ...site,
      apiToken: decryptApiToken(site.apiToken)
    };
  }
  return site;
}
```

#### 2.5.2 Rate Limiting Enhancement
```typescript
// lib/middleware/ratelimit.ts

import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

// Different limits for different user types
export const rateLimiters = {
  api: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(100, "1 h"), // 100 requests per hour
    analytics: true,
  }),
  
  scraping: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(10, "1 m"), // 10 requests per minute
    analytics: true,
  }),
  
  admin: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(1000, "1 h"), // 1000 requests per hour
    analytics: true,
  }),
};

// Middleware
export async function rateLimit(
  identifier: string,
  type: keyof typeof rateLimiters = 'api'
) {
  const { success, limit, reset, remaining } = await rateLimiters[type].limit(identifier);
  
  return {
    success,
    headers: {
      'X-RateLimit-Limit': limit.toString(),
      'X-RateLimit-Remaining': remaining.toString(),
      'X-RateLimit-Reset': reset.toString(),
    }
  };
}
```

#### 2.5.3 Input Validation Enhancement
```typescript
// lib/validation/middleware.ts

import { z } from 'zod';
import { NextRequest, NextResponse } from 'next/server';

export function validateRequest<T extends z.ZodType>(schema: T) {
  return async (req: NextRequest) => {
    try {
      const body = await req.json();
      const validated = schema.parse(body);
      return validated;
    } catch (error) {
      if (error instanceof z.ZodError) {
        return NextResponse.json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid request data',
            details: error.errors
          }
        }, { status: 422 });
      }
      throw error;
    }
  };
}

// Usage in API routes
// app/api/v1/products/route.ts
import { productCreateSchema } from '@/lib/validation/schemas';

export async function POST(req: NextRequest) {
  const validated = await validateRequest(productCreateSchema)(req);
  if (validated instanceof NextResponse) return validated;
  
  // Process validated data
  // ...
}
```

#### 2.5.4 SQL Injection Prevention
```typescript
// Already using Prisma ORM which prevents SQL injection
// Ensure all queries use Prisma, never raw SQL

// BAD (Never do this):
await prisma.$queryRaw`SELECT * FROM products WHERE id = ${userInput}`;

// GOOD (Always do this):
await prisma.product.findUnique({
  where: { id: userInput }
});

// If raw SQL is absolutely necessary, use parameterized queries:
await prisma.$queryRaw`SELECT * FROM products WHERE id = ${Prisma.sql`${userInput}`}`;
```

#### 2.5.5 XSS Prevention
```typescript
// lib/utils/sanitize.ts

import DOMPurify from 'isomorphic-dompurify';

export function sanitizeHtml(dirty: string): string {
  return DOMPurify.sanitize(dirty, {
    ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a', 'p', 'br'],
    ALLOWED_ATTR: ['href', 'target']
  });
}

export function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#x27;',
    '/': '&#x2F;',
  };
  return text.replace(/[&<>"'/]/g, (char) => map[char]);
}

// Use in components
// components/product-detail.tsx
import { sanitizeHtml } from '@/lib/utils/sanitize';

export function ProductDetail({ product }: { product: Product }) {
  return (
    <div 
      dangerouslySetInnerHTML={{ 
        __html: sanitizeHtml(product.description) 
      }} 
    />
  );
}
```

**Implementation**:
1. Implement API token encryption for all sites
2. Add comprehensive rate limiting
3. Enhance input validation on all endpoints
4. Audit all database queries for SQL injection risks
5. Add XSS prevention for user-generated content
6. Implement CORS restrictions
7. Add security headers
8. Conduct security audit

---


## 3. High Priority Issues - Design Solutions

### 3.1 Error Handling Enhancement

**Problem**: Many services lack comprehensive error handling.

**Solution**:
```typescript
// lib/utils/error-handler.ts

export class AppError extends Error {
  constructor(
    public code: string,
    message: string,
    public statusCode: number = 500,
    public details?: any
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: any) {
    super('VALIDATION_ERROR', message, 422, details);
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string) {
    super('NOT_FOUND', `${resource} not found`, 404);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message: string = 'Unauthorized') {
    super('UNAUTHORIZED', message, 401);
  }
}

export class RateLimitError extends AppError {
  constructor() {
    super('RATE_LIMIT_EXCEEDED', 'Too many requests', 429);
  }
}

// Global error handler for API routes
// lib/middleware/error-handler.ts
export function handleApiError(error: unknown) {
  if (error instanceof AppError) {
    return NextResponse.json({
      success: false,
      error: {
        code: error.code,
        message: error.message,
        details: error.details
      }
    }, { status: error.statusCode });
  }
  
  // Log unexpected errors
  logger.error('Unexpected error', { error });
  
  return NextResponse.json({
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred'
    }
  }, { status: 500 });
}

// Usage in services
// lib/services/sync.ts
export class SyncService {
  static async syncSite(siteId: string) {
    try {
      const site = await prisma.site.findUnique({ where: { id: siteId } });
      
      if (!site) {
        throw new NotFoundError('Site');
      }
      
      if (!site.apiToken) {
        throw new ValidationError('Site API token is required');
      }
      
      // ... sync logic
      
    } catch (error) {
      if (error instanceof AppError) {
        throw error; // Re-throw known errors
      }
      
      // Wrap unknown errors
      logger.error('Sync failed', { error, siteId });
      throw new AppError(
        'SYNC_FAILED',
        'Failed to sync site',
        500,
        { siteId, originalError: error instanceof Error ? error.message : String(error) }
      );
    }
  }
}
```

**Implementation**:
1. Create custom error classes
2. Add error handling to all service methods
3. Implement global error handler for API routes
4. Add user-friendly error messages
5. Log all errors with context
6. Add error monitoring (Sentry integration)

---

### 3.2 Performance Optimization

**Problem**: N+1 queries, missing indexes, no caching.

**Solution**:

#### 3.2.1 Database Query Optimization
```typescript
// BEFORE (N+1 Query Problem):
const products = await prisma.product.findMany({
  where: { tenantId }
});

for (const product of products) {
  const matches = await prisma.productMatch.findMany({
    where: { userProductId: product.id }
  });
  // Process matches...
}

// AFTER (Optimized with includes):
const products = await prisma.product.findMany({
  where: { tenantId },
  include: {
    matchesAsUser: {
      include: {
        competitorProduct: true
      }
    },
    site: true,
    priceHistory: {
      take: 10,
      orderBy: { recordedAt: 'desc' }
    }
  }
});

// Process all data in memory
```

#### 3.2.2 Add Missing Indexes
```sql
-- prisma/migrations/add_performance_indexes.sql

-- Product queries
CREATE INDEX IF NOT EXISTS idx_product_tenant_site ON "Product"("tenantId", "siteId");
CREATE INDEX IF NOT EXISTS idx_product_external_id ON "Product"("externalId");
CREATE INDEX IF NOT EXISTS idx_product_updated_at ON "Product"("updatedAt" DESC);

-- ProductMatch queries
CREATE INDEX IF NOT EXISTS idx_match_user_product ON "ProductMatch"("userProductId", "status");
CREATE INDEX IF NOT EXISTS idx_match_competitor_product ON "ProductMatch"("competitorProductId");
CREATE INDEX IF NOT EXISTS idx_match_confidence ON "ProductMatch"("confidenceScore" DESC);

-- PriceHistory queries
CREATE INDEX IF NOT EXISTS idx_price_history_product_date ON "PriceHistory"("productId", "recordedAt" DESC);

-- Site queries
CREATE INDEX IF NOT EXISTS idx_site_tenant_type ON "Site"("tenantId", "type");
CREATE INDEX IF NOT EXISTS idx_site_syncing ON "Site"("isSyncing", "syncStartedAt");

-- Notification queries
CREATE INDEX IF NOT EXISTS idx_notification_tenant_read ON "Notification"("tenantId", "isRead", "createdAt" DESC);

-- Audit log queries
CREATE INDEX IF NOT EXISTS idx_audit_tenant_date ON "TenantAuditLog"("tenantId", "createdAt" DESC);
```

#### 3.2.3 Implement Caching
```typescript
// lib/services/cache-enhanced.ts

import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

export class CacheService {
  private static instance: CacheService;
  
  static getInstance() {
    if (!this.instance) {
      this.instance = new CacheService();
    }
    return this.instance;
  }
  
  async get<T>(key: string): Promise<T | null> {
    try {
      const data = await redis.get(key);
      return data as T | null;
    } catch (error) {
      logger.error('Cache get error', { error, key });
      return null;
    }
  }
  
  async set<T>(key: string, value: T, ttlSeconds: number = 3600): Promise<void> {
    try {
      await redis.setex(key, ttlSeconds, JSON.stringify(value));
    } catch (error) {
      logger.error('Cache set error', { error, key });
    }
  }
  
  async invalidate(pattern: string): Promise<void> {
    try {
      const keys = await redis.keys(pattern);
      if (keys.length > 0) {
        await redis.del(...keys);
      }
    } catch (error) {
      logger.error('Cache invalidate error', { error, pattern });
    }
  }
  
  // Cache wrapper for expensive operations
  async wrap<T>(
    key: string,
    fn: () => Promise<T>,
    ttlSeconds: number = 3600
  ): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached !== null) {
      return cached;
    }
    
    const result = await fn();
    await this.set(key, result, ttlSeconds);
    return result;
  }
}

// Usage in services
// lib/services/matching.ts
export class MatchingService {
  static async runMatching(tenantId: string) {
    const cache = CacheService.getInstance();
    
    // Cache competitor products for 1 hour
    const competitorProducts = await cache.wrap(
      `competitors:${tenantId}`,
      async () => {
        return await prisma.product.findMany({
          where: { tenantId, site: { type: "COMPETITOR" } }
        });
      },
      3600
    );
    
    // ... matching logic
  }
}
```

#### 3.2.4 Pagination Implementation
```typescript
// lib/utils/pagination.ts

export interface PaginationParams {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

export async function paginate<T>(
  model: any,
  where: any,
  params: PaginationParams,
  include?: any
): Promise<PaginatedResponse<T>> {
  const page = Math.max(1, params.page || 1);
  const limit = Math.min(100, Math.max(1, params.limit || 20));
  const skip = (page - 1) * limit;
  
  const [data, total] = await Promise.all([
    model.findMany({
      where,
      include,
      skip,
      take: limit,
      orderBy: params.sortBy ? {
        [params.sortBy]: params.sortOrder || 'desc'
      } : undefined
    }),
    model.count({ where })
  ]);
  
  const totalPages = Math.ceil(total / limit);
  
  return {
    data,
    pagination: {
      page,
      limit,
      total,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1
    }
  };
}

// Usage in API routes
// app/api/v1/products/route.ts
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const tenantId = await getTenantId(req);
  
  const result = await paginate(
    prisma.product,
    { tenantId },
    {
      page: parseInt(searchParams.get('page') || '1'),
      limit: parseInt(searchParams.get('limit') || '20'),
      sortBy: searchParams.get('sortBy') || 'createdAt',
      sortOrder: (searchParams.get('sortOrder') as 'asc' | 'desc') || 'desc'
    },
    {
      site: true,
      matchesAsUser: {
        include: { competitorProduct: true }
      }
    }
  );
  
  return NextResponse.json(result);
}
```

**Implementation**:
1. Audit all database queries for N+1 problems
2. Add missing database indexes
3. Implement Redis caching for expensive operations
4. Add pagination to all list endpoints
5. Optimize Prisma queries with proper includes
6. Add query performance monitoring

---

### 3.3 Rollback Mechanism

**Problem**: Cannot undo incorrect price changes.

**Solution**:
```typescript
// lib/services/rollback.ts

export class RollbackService {
  /**
   * Rollback a single price change
   */
  static async rollbackPriceChange(updateLogId: string, userId: string): Promise<void> {
    const updateLog = await prisma.priceUpdateLog.findUnique({
      where: { id: updateLogId },
      include: { product: { include: { site: true } } }
    });
    
    if (!updateLog) {
      throw new NotFoundError('Price update log');
    }
    
    const product = updateLog.product;
    const oldPrice = updateLog.oldPrice;
    
    // Create rollback transaction
    await prisma.$transaction(async (tx) => {
      // Revert product price
      await tx.product.update({
        where: { id: product.id },
        data: { currentPrice: oldPrice }
      });
      
      // Record price history
      await tx.priceHistory.create({
        data: {
          productId: product.id,
          price: oldPrice
        }
      });
      
      // Create rollback log
      await tx.priceUpdateLog.create({
        data: {
          productId: product.id,
          oldPrice: updateLog.newPrice,
          newPrice: oldPrice,
          logicType: 'FIXED',
          status: 'SUCCESS',
          executedAt: new Date()
        }
      });
      
      // Create audit log
      await tx.tenantAuditLog.create({
        data: {
          tenantId: product.tenantId,
          userId,
          userEmail: 'system',
          action: 'ROLLBACK_PRICE',
          entityId: updateLogId,
          details: JSON.stringify({
            productId: product.id,
            oldPrice: updateLog.newPrice.toString(),
            newPrice: oldPrice.toString()
          })
        }
      });
    });
    
    // Push rollback to store
    await SyncService.syncProductsToStore(product.siteId);
    
    // Send notification
    await NotificationService.create({
      tenantId: product.tenantId,
      type: 'PRICE_ROLLBACK',
      title: 'Price Rolled Back',
      message: `Price for "${product.title}" was rolled back to ${oldPrice}`,
      link: `/dashboard/products/${product.id}`
    });
  }
  
  /**
   * Rollback bulk operation
   */
  static async rollbackBulkOperation(snapshotId: string, userId: string): Promise<void> {
    const snapshot = await prisma.bulkOperationSnapshot.findUnique({
      where: { id: snapshotId }
    });
    
    if (!snapshot) {
      throw new NotFoundError('Bulk operation snapshot');
    }
    
    if (snapshot.rolledBack) {
      throw new ValidationError('Operation already rolled back');
    }
    
    const snapshotData = JSON.parse(snapshot.snapshot);
    const changes = JSON.parse(snapshot.changes);
    
    // Rollback each product
    await prisma.$transaction(async (tx) => {
      for (const change of changes) {
        await tx.product.update({
          where: { id: change.productId },
          data: { currentPrice: change.oldPrice }
        });
        
        await tx.priceHistory.create({
          data: {
            productId: change.productId,
            price: change.oldPrice
          }
        });
      }
      
      // Mark snapshot as rolled back
      await tx.bulkOperationSnapshot.update({
        where: { id: snapshotId },
        data: { rolledBack: true }
      });
      
      // Create audit log
      await tx.tenantAuditLog.create({
        data: {
          tenantId: snapshot.tenantId,
          userId,
          userEmail: 'system',
          action: 'ROLLBACK_BULK_OPERATION',
          entityId: snapshotId,
          details: JSON.stringify({
            operation: snapshot.operation,
            productCount: snapshot.productCount
          })
        }
      });
    });
    
    // Send notification
    await NotificationService.create({
      tenantId: snapshot.tenantId,
      type: 'BULK_ROLLBACK',
      title: 'Bulk Operation Rolled Back',
      message: `${snapshot.productCount} products were rolled back`,
      link: `/dashboard/activity`
    });
  }
}

// API endpoint
// app/api/v1/price-update/rollback/route.ts
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  const { updateLogId, snapshotId } = await req.json();
  
  try {
    if (updateLogId) {
      await RollbackService.rollbackPriceChange(updateLogId, session.user.id);
    } else if (snapshotId) {
      await RollbackService.rollbackBulkOperation(snapshotId, session.user.id);
    } else {
      throw new ValidationError('Either updateLogId or snapshotId is required');
    }
    
    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
```

**Implementation**:
1. Implement single price change rollback
2. Implement bulk operation rollback
3. Add rollback UI in dashboard
4. Test rollback with real stores
5. Add rollback history tracking
6. Document rollback procedures

---


## 4. Medium Priority Issues - Design Solutions

### 4.1 Test Coverage Enhancement

**Problem**: Only 46 tests for 39 service files, need to retain only 20 essential tests.

**Solution**:

#### 4.1.1 Essential Tests to Retain (20 Core Tests)
```typescript
// __tests__/lib/services/core-business-logic.test.ts

/**
 * ESSENTIAL TEST #1: Product Matching - SKU Match
 * Tests core matching algorithm with exact SKU
 */
describe('MatchingService - SKU Matching', () => {
  it('should match products by exact SKU', async () => {
    // Test implementation
  });
});

/**
 * ESSENTIAL TEST #2: Product Matching - Brand/Model Match
 * Tests secondary matching strategy
 */
describe('MatchingService - Brand/Model Matching', () => {
  it('should match products by brand and model', async () => {
    // Test implementation
  });
});

/**
 * ESSENTIAL TEST #3: Pricing Rules - Undercut Strategy
 * Tests most common pricing rule
 */
describe('RulesEngine - Undercut Strategy', () => {
  it('should calculate undercut price correctly', async () => {
    // Test implementation
  });
});

/**
 * ESSENTIAL TEST #4: Pricing Rules - Margin Lock
 * Tests critical safety feature
 */
describe('RulesEngine - Margin Lock', () => {
  it('should maintain minimum margin', async () => {
    // Test implementation
  });
});

/**
 * ESSENTIAL TEST #5: Price Updates - OpenCart
 * Tests critical price update functionality
 */
describe('SyncService - OpenCart Price Update', () => {
  it('should update price in OpenCart store', async () => {
    // Test implementation
  });
});

/**
 * ESSENTIAL TEST #6: Price Updates - Laravel
 * Tests critical price update functionality
 */
describe('SyncService - Laravel Price Update', () => {
  it('should update price in Laravel store', async () => {
    // Test implementation
  });
});

/**
 * ESSENTIAL TEST #7: Product Sync - OpenCart
 * Tests product import from OpenCart
 */
describe('SyncService - OpenCart Sync', () => {
  it('should sync products from OpenCart', async () => {
    // Test implementation
  });
});

/**
 * ESSENTIAL TEST #8: Product Sync - Laravel
 * Tests product import from Laravel
 */
describe('SyncService - Laravel Sync', () => {
  it('should sync products from Laravel', async () => {
    // Test implementation
  });
});

/**
 * ESSENTIAL TEST #9: Scraper - Product Extraction
 * Tests core scraping functionality
 */
describe('ScraperService - Product Extraction', () => {
  it('should extract product data from competitor site', async () => {
    // Test implementation
  });
});

/**
 * ESSENTIAL TEST #10: Scraper - Challenge Detection
 * Tests anti-bot challenge handling
 */
describe('ScraperService - Challenge Detection', () => {
  it('should detect and handle Cloudflare challenge', async () => {
    // Test implementation
  });
});

/**
 * ESSENTIAL TEST #11: Price Approval - Create Pending Change
 * Tests approval workflow
 */
describe('RulesEngine - Price Approval', () => {
  it('should create pending price change', async () => {
    // Test implementation
  });
});

/**
 * ESSENTIAL TEST #12: Price Approval - Approve Change
 * Tests approval execution
 */
describe('RulesEngine - Approve Change', () => {
  it('should apply approved price change', async () => {
    // Test implementation
  });
});

/**
 * ESSENTIAL TEST #13: Rollback - Single Price Change
 * Tests rollback functionality
 */
describe('RollbackService - Single Rollback', () => {
  it('should rollback single price change', async () => {
    // Test implementation
  });
});

/**
 * ESSENTIAL TEST #14: Rollback - Bulk Operation
 * Tests bulk rollback
 */
describe('RollbackService - Bulk Rollback', () => {
  it('should rollback bulk operation', async () => {
    // Test implementation
  });
});

/**
 * ESSENTIAL TEST #15: Authentication - Login
 * Tests user authentication
 */
describe('Auth - Login', () => {
  it('should authenticate user with valid credentials', async () => {
    // Test implementation
  });
});

/**
 * ESSENTIAL TEST #16: Authorization - Tenant Isolation
 * Tests multi-tenant security
 */
describe('Auth - Tenant Isolation', () => {
  it('should prevent cross-tenant data access', async () => {
    // Test implementation
  });
});

/**
 * ESSENTIAL TEST #17: Rate Limiting
 * Tests API rate limiting
 */
describe('RateLimit - API Protection', () => {
  it('should enforce rate limits', async () => {
    // Test implementation
  });
});

/**
 * ESSENTIAL TEST #18: Input Validation
 * Tests input sanitization
 */
describe('Validation - Input Sanitization', () => {
  it('should reject invalid input', async () => {
    // Test implementation
  });
});

/**
 * ESSENTIAL TEST #19: Error Handling
 * Tests error handling
 */
describe('ErrorHandler - API Errors', () => {
  it('should handle errors gracefully', async () => {
    // Test implementation
  });
});

/**
 * ESSENTIAL TEST #20: Caching
 * Tests caching functionality
 */
describe('Cache - Redis Caching', () => {
  it('should cache and retrieve data', async () => {
    // Test implementation
  });
});
```

#### 4.1.2 Tests to Remove
```bash
# Remove all non-essential tests
rm -rf __tests__/components/admin/*.test.tsx
rm -rf __tests__/lib/accessibility-*.test.tsx
rm -rf __tests__/lib/drawer-*.test.tsx
rm -rf __tests__/lib/form-*.test.tsx
rm -rf __tests__/lib/navigation-*.test.tsx
rm -rf __tests__/lib/new-component-*.test.tsx
rm -rf __tests__/lib/simple-*.test.tsx
rm -rf __tests__/lib/services/evasion.test.ts
rm -rf __tests__/lib/services/metrics-integration.test.ts
rm -rf __tests__/lib/services/performance.test.ts
rm -rf __tests__/lib/services/scraper-backward-compatibility.test.ts
rm -rf __tests__/lib/services/scraper-e2e-integration.test.ts
rm -rf __tests__/lib/services/session-log-clearing.test.ts
rm -rf __tests__/lib/utils/*.test.ts

# Keep only essential tests
# - core-business-logic.test.ts (20 tests)
```

**Implementation**:
1. Create single test file with 20 essential tests
2. Remove all other test files
3. Ensure 100% coverage of critical paths
4. Document test strategy
5. Set up CI/CD to run essential tests only

---

### 4.2 Price Approval Enhancements

**Problem**: Missing auto-approval rules, email notifications, and delegation.

**Solution**:

#### 4.2.1 Auto-Approval Rules
```typescript
// lib/services/auto-approval.ts

export interface AutoApprovalRule {
  id: string;
  tenantId: string;
  name: string;
  enabled: boolean;
  conditions: {
    maxPriceChange?: number; // Max change in currency
    maxPercentageChange?: number; // Max change in %
    minConfidenceScore?: number; // Min match confidence
    allowedStrategies?: string[]; // Allowed pricing strategies
    productCategories?: string[]; // Specific categories
    priceRange?: { min: number; max: number }; // Price range
  };
  createdAt: Date;
  updatedAt: Date;
}

export class AutoApprovalService {
  /**
   * Check if price change should be auto-approved
   */
  static async shouldAutoApprove(
    change: PendingPriceChange,
    tenantId: string
  ): Promise<{ approved: boolean; reason: string }> {
    // Get active auto-approval rules
    const rules = await prisma.autoApprovalRule.findMany({
      where: { tenantId, enabled: true },
      orderBy: { priority: 'asc' }
    });
    
    if (rules.length === 0) {
      return { approved: false, reason: 'No auto-approval rules configured' };
    }
    
    const product = await prisma.product.findUnique({
      where: { id: change.productId },
      include: {
        matchesAsUser: {
          include: { competitorProduct: true }
        }
      }
    });
    
    if (!product) {
      return { approved: false, reason: 'Product not found' };
    }
    
    // Check each rule
    for (const rule of rules) {
      const conditions = rule.conditions as any;
      
      // Check price change amount
      if (conditions.maxPriceChange) {
        const priceChange = Math.abs(
          parseFloat(change.recommendedPrice.toString()) - 
          parseFloat(change.currentPrice.toString())
        );
        if (priceChange > conditions.maxPriceChange) {
          continue; // Rule not satisfied
        }
      }
      
      // Check percentage change
      if (conditions.maxPercentageChange) {
        const percentageChange = Math.abs(
          (parseFloat(change.recommendedPrice.toString()) - 
           parseFloat(change.currentPrice.toString())) /
          parseFloat(change.currentPrice.toString()) * 100
        );
        if (percentageChange > conditions.maxPercentageChange) {
          continue; // Rule not satisfied
        }
      }
      
      // Check match confidence
      if (conditions.minConfidenceScore && product.matchesAsUser[0]) {
        const confidence = parseFloat(
          product.matchesAsUser[0].confidenceScore.toString()
        );
        if (confidence < conditions.minConfidenceScore) {
          continue; // Rule not satisfied
        }
      }
      
      // Check pricing strategy
      if (conditions.allowedStrategies && change.appliedRule) {
        if (!conditions.allowedStrategies.includes(change.appliedRule)) {
          continue; // Rule not satisfied
        }
      }
      
      // Check product category
      if (conditions.productCategories && product.category) {
        if (!conditions.productCategories.includes(product.category)) {
          continue; // Rule not satisfied
        }
      }
      
      // Check price range
      if (conditions.priceRange) {
        const newPrice = parseFloat(change.recommendedPrice.toString());
        if (newPrice < conditions.priceRange.min || 
            newPrice > conditions.priceRange.max) {
          continue; // Rule not satisfied
        }
      }
      
      // All conditions satisfied
      return { 
        approved: true, 
        reason: `Auto-approved by rule: ${rule.name}` 
      };
    }
    
    return { 
      approved: false, 
      reason: 'No auto-approval rules matched' 
    };
  }
  
  /**
   * Process pending changes with auto-approval
   */
  static async processAutoApprovals(tenantId: string): Promise<number> {
    const pendingChanges = await prisma.pendingPriceChange.findMany({
      where: { tenantId, status: 'PENDING' }
    });
    
    let autoApprovedCount = 0;
    
    for (const change of pendingChanges) {
      const { approved, reason } = await this.shouldAutoApprove(change, tenantId);
      
      if (approved) {
        // Auto-approve the change
        await RulesEngine.applyApprovedChanges([change.id], 'system:auto-approval');
        
        // Log auto-approval
        await prisma.tenantAuditLog.create({
          data: {
            tenantId,
            userId: 'system',
            userEmail: 'system',
            action: 'AUTO_APPROVE_PRICE',
            entityId: change.id,
            details: JSON.stringify({ reason })
          }
        });
        
        autoApprovedCount++;
      }
    }
    
    return autoApprovedCount;
  }
}

// Add to Prisma schema
// prisma/schema.prisma
model AutoApprovalRule {
  id          String   @id @default(uuid())
  tenantId    String
  name        String
  enabled     Boolean  @default(true)
  priority    Int      @default(1)
  conditions  Json
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  tenant      Tenant   @relation(fields: [tenantId], references: [id])
  
  @@index([tenantId, enabled])
}
```

#### 4.2.2 Email Notifications
```typescript
// lib/services/email.ts

import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});

export class EmailService {
  /**
   * Send pending approval notification
   */
  static async sendPendingApprovalNotification(
    tenantId: string,
    pendingCount: number
  ): Promise<void> {
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      include: { users: { where: { emailNotifications: true } } }
    });
    
    if (!tenant || tenant.users.length === 0) {
      return;
    }
    
    const recipients = tenant.users.map(u => u.email);
    
    await transporter.sendMail({
      from: process.env.SMTP_FROM || 'noreply@pricepilot.com',
      to: recipients.join(', '),
      subject: `${pendingCount} Price Changes Awaiting Approval`,
      html: `
        <h2>Price Changes Pending Approval</h2>
        <p>You have ${pendingCount} price changes waiting for your review.</p>
        <p><a href="${process.env.NEXTAUTH_URL}/dashboard/price-approvals">Review Now</a></p>
        <hr>
        <p><small>To stop receiving these emails, update your notification preferences in settings.</small></p>
      `
    });
  }
  
  /**
   * Send daily approval summary
   */
  static async sendDailyApprovalSummary(tenantId: string): Promise<void> {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    
    const [approved, rejected, pending] = await Promise.all([
      prisma.pendingPriceChange.count({
        where: {
          tenantId,
          status: 'APPROVED',
          reviewedAt: { gte: yesterday }
        }
      }),
      prisma.pendingPriceChange.count({
        where: {
          tenantId,
          status: 'REJECTED',
          reviewedAt: { gte: yesterday }
        }
      }),
      prisma.pendingPriceChange.count({
        where: { tenantId, status: 'PENDING' }
      })
    ]);
    
    if (approved === 0 && rejected === 0 && pending === 0) {
      return; // No activity, skip email
    }
    
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      include: { users: { where: { emailNotifications: true } } }
    });
    
    if (!tenant || tenant.users.length === 0) {
      return;
    }
    
    const recipients = tenant.users.map(u => u.email);
    
    await transporter.sendMail({
      from: process.env.SMTP_FROM || 'noreply@pricepilot.com',
      to: recipients.join(', '),
      subject: 'Daily Price Approval Summary',
      html: `
        <h2>Daily Price Approval Summary</h2>
        <ul>
          <li><strong>Approved:</strong> ${approved}</li>
          <li><strong>Rejected:</strong> ${rejected}</li>
          <li><strong>Pending:</strong> ${pending}</li>
        </ul>
        ${pending > 0 ? `<p><a href="${process.env.NEXTAUTH_URL}/dashboard/price-approvals">Review Pending Changes</a></p>` : ''}
      `
    });
  }
}

// Cron job for daily summary
// app/api/v1/cron/daily-approval-summary/route.ts
export async function GET(req: NextRequest) {
  // Verify cron secret
  if (req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  const tenants = await prisma.tenant.findMany();
  
  for (const tenant of tenants) {
    await EmailService.sendDailyApprovalSummary(tenant.id);
  }
  
  return NextResponse.json({ success: true });
}
```

#### 4.2.3 Approval Delegation
```typescript
// Add to Prisma schema
model ApprovalDelegation {
  id          String   @id @default(uuid())
  tenantId    String
  fromUserId  String
  toUserId    String
  startDate   DateTime
  endDate     DateTime
  isActive    Boolean  @default(true)
  createdAt   DateTime @default(now())
  
  tenant      Tenant   @relation(fields: [tenantId], references: [id])
  fromUser    User     @relation("DelegationFrom", fields: [fromUserId], references: [id])
  toUser      User     @relation("DelegationTo", fields: [toUserId], references: [id])
  
  @@index([tenantId, toUserId, isActive])
}

// lib/services/approval-delegation.ts
export class ApprovalDelegationService {
  /**
   * Check if user can approve on behalf of another user
   */
  static async canApprove(userId: string, tenantId: string): Promise<boolean> {
    const now = new Date();
    
    // Check if user has active delegation
    const delegation = await prisma.approvalDelegation.findFirst({
      where: {
        tenantId,
        toUserId: userId,
        isActive: true,
        startDate: { lte: now },
        endDate: { gte: now }
      }
    });
    
    return !!delegation;
  }
  
  /**
   * Create delegation
   */
  static async createDelegation(
    tenantId: string,
    fromUserId: string,
    toUserId: string,
    startDate: Date,
    endDate: Date
  ): Promise<void> {
    await prisma.approvalDelegation.create({
      data: {
        tenantId,
        fromUserId,
        toUserId,
        startDate,
        endDate
      }
    });
    
    // Send notification
    const toUser = await prisma.user.findUnique({ where: { id: toUserId } });
    if (toUser?.emailNotifications) {
      await EmailService.sendDelegationNotification(toUser.email, startDate, endDate);
    }
  }
}
```

**Implementation**:
1. Implement auto-approval rules engine
2. Add email notification system
3. Implement approval delegation
4. Add UI for managing auto-approval rules
5. Add UI for delegation management
6. Test all approval workflows

---


## 5. Correctness Properties

### 5.1 Data Integrity Properties

**Property 1.1: Price Update Atomicity**
```typescript
// For all price updates, either all changes succeed or all fail
∀ priceUpdate: PriceUpdate {
  (productUpdated ∧ historyRecorded ∧ logCreated) ∨
  (¬productUpdated ∧ ¬historyRecorded ∧ ¬logCreated)
}
```

**Property 1.2: Tenant Isolation**
```typescript
// Users can only access data from their own tenant
∀ user: User, data: Data {
  user.canAccess(data) → data.tenantId === user.tenantId
}
```

**Property 1.3: Price History Completeness**
```typescript
// Every price change must have a history record
∀ product: Product {
  product.currentPrice changed →
  ∃ history: PriceHistory {
    history.productId === product.id ∧
    history.price === product.currentPrice ∧
    history.recordedAt === changeTime
  }
}
```

### 5.2 Business Logic Properties

**Property 2.1: Margin Lock Enforcement**
```typescript
// Margin lock rules must never be violated
∀ rule: PricingRule, product: Product {
  rule.strategy === "MARGIN_LOCK" ∧ rule.isActive →
  product.currentPrice >= calculateMinPrice(product, rule.parameter)
}
```

**Property 2.2: Approval Workflow Integrity**
```typescript
// Price changes must be approved before application
∀ priceChange: PendingPriceChange {
  priceChange.applied →
  priceChange.status === "APPROVED" ∧
  priceChange.reviewedBy !== null
}
```

**Property 2.3: Rollback Correctness**
```typescript
// Rollback must restore exact previous state
∀ rollback: Rollback {
  rollback.executed →
  product.currentPrice === rollback.previousPrice ∧
  ∃ history: PriceHistory {
    history.price === rollback.previousPrice ∧
    history.recordedAt === rollback.executedAt
  }
}
```

### 5.3 Security Properties

**Property 3.1: Authentication Required**
```typescript
// All API endpoints require authentication
∀ endpoint: APIEndpoint {
  endpoint.public === false →
  ∀ request: Request {
    request.authenticated === true ∨ request.rejected
  }
}
```

**Property 3.2: Rate Limiting Enforcement**
```typescript
// Rate limits must be enforced
∀ user: User, timeWindow: TimeWindow {
  user.requestCount(timeWindow) > user.rateLimit →
  user.nextRequest.rejected
}
```

**Property 3.3: Token Encryption**
```typescript
// API tokens must be encrypted at rest
∀ site: Site {
  site.apiToken !== null →
  site.apiToken.encrypted === true
}
```

### 5.4 Performance Properties

**Property 4.1: Query Performance**
```typescript
// Database queries must complete within time limit
∀ query: DatabaseQuery {
  query.executionTime < 100ms (95th percentile)
}
```

**Property 4.2: Cache Consistency**
```typescript
// Cached data must be consistent with database
∀ cacheKey: string, data: Data {
  cache.get(cacheKey) !== null →
  cache.get(cacheKey) === database.get(cacheKey) ∨
  cache.age(cacheKey) < cache.ttl(cacheKey)
}
```

---

## 6. Implementation Strategy

### 6.1 Phase 1: Critical Fixes (Week 1)

**Day 1-2: Documentation & Platform Support**
- Update all documentation for 24-hour scraping
- Remove false platform support claims
- Update UI to reflect actual support

**Day 3-4: Mock Data & API Implementation**
- Remove mock data fallbacks
- Complete OpenCart price update API
- Complete Laravel price update API

**Day 5: Security Basics**
- Implement API token encryption
- Add rate limiting
- Add input validation

### 6.2 Phase 2: Core Functionality (Week 2)

**Day 1-2: Error Handling**
- Implement custom error classes
- Add error handling to all services
- Add user-friendly error messages

**Day 3-4: Performance**
- Add database indexes
- Implement caching
- Add pagination
- Optimize queries

**Day 5: Rollback**
- Implement rollback mechanism
- Add rollback UI
- Test rollback functionality

### 6.3 Phase 3: Enhancements (Week 3)

**Day 1-2: Price Approval**
- Implement auto-approval rules
- Add email notifications
- Implement delegation

**Day 3-4: Testing**
- Create 20 essential tests
- Remove non-essential tests
- Ensure critical path coverage

**Day 5: API Documentation**
- Update OpenAPI spec
- Add request/response examples
- Test interactive documentation

### 6.4 Phase 4: Polish & Deploy (Week 4)

**Day 1-2: Bug Fixes**
- Fix remaining bugs
- Address edge cases
- Improve error messages

**Day 3: Documentation**
- Update all documentation
- Add troubleshooting guides
- Update FAQ

**Day 4: Staging Deployment**
- Deploy to staging
- Run integration tests
- User acceptance testing

**Day 5: Production Deployment**
- Deploy to production
- Monitor for issues
- Communicate changes to users

---

## 7. Testing Strategy

### 7.1 Unit Tests (20 Essential Tests)
- Core business logic (matching, pricing, sync)
- Authentication and authorization
- Error handling
- Caching

### 7.2 Integration Tests
- API endpoints
- Database operations
- External API calls
- Price update workflows

### 7.3 E2E Tests
- Complete user workflows
- Price approval process
- Rollback operations
- Multi-tenant scenarios

### 7.4 Security Tests
- Authentication bypass attempts
- SQL injection attempts
- XSS attempts
- Rate limit enforcement
- Tenant isolation

### 7.5 Performance Tests
- Database query performance
- API response times
- Concurrent user load
- Memory usage

---

## 8. Rollback Plan

### 8.1 Database Migrations
- All migrations must be reversible
- Test rollback before deployment
- Keep backup of production data

### 8.2 Code Deployment
- Use feature flags for new features
- Deploy incrementally
- Monitor error rates
- Have rollback script ready

### 8.3 Data Changes
- Backup before bulk operations
- Test on staging first
- Have data restoration procedure

---

## 9. Monitoring & Alerting

### 9.1 Application Metrics
- API response times
- Error rates
- Request counts
- Cache hit rates

### 9.2 Business Metrics
- Price update success rate
- Scraping success rate
- User activity
- System uptime

### 9.3 Alerts
- High error rate (>1%)
- Slow response time (>500ms)
- High block rate (>30%)
- Failed price updates
- Security incidents

---

## 10. Documentation Updates

### 10.1 User Documentation
- Update DOCUMENTATION.md
- Update README.md
- Update FAQ
- Add troubleshooting guides

### 10.2 Technical Documentation
- Update ARCHITECTURE.md
- Update API documentation
- Add deployment guide
- Add runbook

### 10.3 Code Documentation
- Add JSDoc comments
- Document complex algorithms
- Add inline comments for tricky code
- Update type definitions

---

**Design Version**: 1.0
**Last Updated**: January 28, 2026
**Status**: Ready for Implementation
