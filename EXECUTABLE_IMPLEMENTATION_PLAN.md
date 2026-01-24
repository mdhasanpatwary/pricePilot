# PricePilot Tech-Product Ecommerce Implementation Plan

## Overview
This executable plan transforms PricePilot into a tech-product-focused ecommerce platform. Each phase contains specific, actionable tasks with commands, testing, and rollback procedures.

**Timeline:** 20 weeks (AI integration excluded)

---

## Phase 1: Foundation - Database Performance & Data Model

### 1.1 Product Specifications Schema
**Goal:** Add technical specifications storage for tech products

**Prerequisites:**
- Prisma CLI installed
- Database backup completed
- Development environment ready

**Steps:**
```bash
# 1. Create new migration for specifications
cd /Applications/MAMP/htdocs/PricePilot
npx prisma migrate dev --name add-product-specifications

# 2. Update schema.prisma with specifications model
# Add this model to prisma/schema.prisma:
```

**Schema Changes:**
```prisma
model ProductSpecification {
  id          String   @id @default(uuid())
  productId   String
  key         String   // e.g., "processor", "ram", "storage"
  value       String   // e.g., "Intel i7-12700H", "16GB", "512GB SSD"
  unit        String?  // e.g., "GB", "GHz", "inches"
  category    String   // e.g., "processor", "memory", "storage"
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  product Product @relation(fields: [productId], references: [id], onDelete: Cascade)

  @@index([productId])
  @@index([key])
  @@index([category])
}
```

**Commands:**
```bash
# 3. Generate Prisma client
npx prisma generate

# 4. Run migration
npx prisma db push

# 5. Update Product model to include relation
# Add to Product model in schema.prisma:
specifications ProductSpecification[]
```

**Testing:**
```bash
# Run database tests
npm run test:unit

# Verify schema
npx prisma studio
```

**Success Criteria:**
- ✅ Specifications table exists
- ✅ Product model has specifications relation
- ✅ No migration errors
- ✅ Tests pass

**Rollback:**
```bash
# Revert migration
npx prisma migrate reset --force
```

### 1.2 Database Indexing Strategy
**Goal:** 10x faster queries for tech product searches

**Prerequisites:**
- Phase 1.1 completed
- Database performance baseline measured

**Steps:**
```bash
# 1. Analyze current query performance
# Run this in database to check slow queries:
EXPLAIN ANALYZE SELECT * FROM "Product" WHERE "brand" = 'Samsung' AND "model" = 'Galaxy S23';

# 2. Add composite indexes
# Update schema.prisma with these indexes:
```

**Index Additions:**
```prisma
model Product {
  // ... existing fields ...

  // Add these indexes for tech product queries
  @@index([brand, model])
  @@index([category, currentPrice])
  @@index([brand, category])
  @@index([sku])
  @@index([externalId])
  @@index([tenantId, brand])
  @@index([tenantId, category])
}
```

**Commands:**
```bash
# 3. Generate and apply indexes
npx prisma generate
npx prisma db push

# 4. Verify indexes created
# Check in database:
SELECT * FROM pg_indexes WHERE tablename = 'Product';
```

**Testing:**
```bash
# Performance benchmark
# Create test script to measure query times before/after
node scripts/benchmark-queries.js

# Expected improvement: 10x faster for brand+model queries
```

**Success Criteria:**
- ✅ Indexes created successfully
- ✅ Query performance improved by 5-10x
- ✅ No application errors

**Rollback:**
```bash
# Remove indexes manually in database
# Or revert schema and reapply
```

### 1.3 Product Categories & Taxonomy
**Goal:** Hierarchical category system for tech products

**Prerequisites:**
- Phase 1.1 completed
- Category requirements gathered

**Steps:**
```bash
# 1. Add Category model to schema
# Add to prisma/schema.prisma:
```

**Schema Changes:**
```prisma
model ProductCategory {
  id          String   @id @default(uuid())
  name        String   // e.g., "Electronics", "Laptops"
  slug        String   @unique
  description String?
  parentId    String?  // For hierarchical structure
  level       Int      @default(1) // 1=root, 2=sub, 3=leaf
  sortOrder   Int      @default(0)
  isActive    Boolean  @default(true)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  parent      ProductCategory? @relation("CategoryHierarchy", fields: [parentId], references: [id])
  children    ProductCategory[] @relation("CategoryHierarchy")
  products    Product[]

  @@index([parentId])
  @@index([level])
  @@index([isActive])
}
```

**Commands:**
```bash
# 2. Update Product model
# Add to Product model:
categoryId String?
category   ProductCategory? @relation(fields: [categoryId], references: [id])

# 3. Generate and migrate
npx prisma generate
npx prisma db push

# 4. Seed initial categories
npx prisma db seed
```

**Testing:**
```bash
# Test category hierarchy
npm run test:integration

# Verify category queries work
# Test in Prisma Studio
npx prisma studio
```

**Success Criteria:**
- ✅ Category hierarchy works
- ✅ Products can be assigned to categories
- ✅ Category-based queries perform well

---

## Phase 2: Core Matching Algorithms (Weeks 5-9)

### 2.1 Weighted Scoring System
**Goal:** Intelligent product link selection instead of first-match

**Prerequisites:**
- Phase 1 completed
- Current matching accuracy measured

**Steps:**
```bash
# 1. Update ScraperService evaluateProductLink method
# Modify lib/services/scraper.ts
```

**Code Changes:**
```typescript
private async evaluateProductLink(page: Page, query?: string): Promise<string | null> {
  return await page.evaluate((q) => {
    const candidates: Array<{
      href: string;
      text: string;
      score: number;
      reasons: string[];
    }> = [];

    // ... existing filtering logic ...

    potentialProducts.forEach(link => {
      let score = 0;
      const reasons: string[] = [];

      // Query Match Score (40% weight)
      if (q) {
        const queryWords = q.toLowerCase().split(/\s+/).filter(w => w.length > 2);
        const matchCount = queryWords.filter(w =>
          link.text.toLowerCase().includes(w) ||
          link.href.toLowerCase().includes(w)
        ).length;
        const matchRatio = matchCount / queryWords.length;
        score += matchRatio * 40;
        reasons.push(`Query match: ${(matchRatio * 100).toFixed(0)}%`);
      }

      // Product Container Bonus (20% weight)
      const productContainer = link.closest('.product-thumb, .product-layout, .card');
      if (productContainer) {
        score += 20;
        reasons.push('In product container');
      }

      // URL Structure Score (20% weight)
      const urlScore = calculateUrlScore(link.href);
      score += urlScore * 20;
      reasons.push(`URL structure: ${urlScore.toFixed(1)}`);

      // Position Score (10% weight)
      const positionScore = 1 - (link.index / potentialProducts.length);
      score += positionScore * 10;
      reasons.push(`Position: ${positionScore.toFixed(1)}`);

      candidates.push({ href: link.href, text: link.text, score, reasons });
    });

    // Return highest scoring candidate
    candidates.sort((a, b) => b.score - a.score);
    return candidates[0]?.href || null;
  }, query);
}

function calculateUrlScore(href: string): number {
  let score = 0;
  if (href.includes('/product/')) score += 0.8;
  if (href.includes('/p/')) score += 0.7;
  if (href.includes('/item/')) score += 0.6;
  const pathSegments = href.split('/').filter(s => s.length > 0);
  score += Math.min(pathSegments.length / 5, 0.3);
  return Math.min(score, 1.0);
}
```

**Commands:**
```bash
# 2. Test the changes
npm run test:unit

# 3. Run integration tests
npm run test:integration
```

**Testing:**
```bash
# Create test for scoring accuracy
# Test with known product URLs
node scripts/test-scoring.js

# Expected: Higher scores for relevant products
```

**Success Criteria:**
- ✅ Scoring system works
- ✅ Better match selection than random
- ✅ No performance degradation

### 2.2 Brand Recognition Logic
**Goal:** Prioritize products from known tech brands

**Prerequisites:**
- Phase 2.1 completed
- Brand list compiled

**Steps:**
```bash
# 1. Create brand data file
# Create lib/data/brands.ts
```

**Code Changes:**
```typescript
// lib/data/brands.ts
export const TECH_BRANDS = {
  'samsung': { aliases: ['samsung', 'samsung electronics'], category: 'electronics' },
  'apple': { aliases: ['apple', 'apple inc'], category: 'electronics' },
  'dell': { aliases: ['dell', 'dell technologies'], category: 'computers' },
  'hp': { aliases: ['hp', 'hewlett packard'], category: 'computers' },
  'lenovo': { aliases: ['lenovo', 'lenovo group'], category: 'computers' },
  'asus': { aliases: ['asus', 'asustek'], category: 'computers' },
  // Add more brands...
};

export function normalizeBrand(brand: string): string {
  const normalized = brand.toLowerCase().trim();
  for (const [canonical, data] of Object.entries(TECH_BRANDS)) {
    if (data.aliases.includes(normalized)) {
      return canonical;
    }
  }
  return normalized;
}
```

**Commands:**
```bash
# 2. Update scoring system to include brand bonus
# Modify evaluateProductLink in scraper.ts
```

**Update Scoring:**
```typescript
// Add to scoring logic in evaluateProductLink
// Brand Match Bonus (10% weight)
const brandMatch = detectBrandMatch(link.text, q);
if (brandMatch) {
  score += 10;
  reasons.push(`Brand match: ${brandMatch}`);
}

function detectBrandMatch(text: string, query?: string): string | null {
  if (!query) return null;
  const queryLower = query.toLowerCase();

  for (const [brand, data] of Object.entries(TECH_BRANDS)) {
    if (data.aliases.some(alias => queryLower.includes(alias))) {
      if (data.aliases.some(alias => text.toLowerCase().includes(alias))) {
        return brand;
      }
    }
  }
  return null;
}
```

**Testing:**
```bash
# Test brand recognition
node scripts/test-brand-recognition.js

# Verify scoring includes brand bonus
```

**Success Criteria:**
- ✅ Brand recognition works
- ✅ Known brands get scoring bonus
- ✅ Brand normalization functions

---

## Phase 3: Performance Optimizations (Weeks 10-13)

### 3.1 Redis Caching Layer
**Goal:** Sub-second response times for product data

**Prerequisites:**
- Redis server running
- Current response times measured

**Steps:**
```bash
# 1. Install Redis client (already in package.json)
# Verify Redis connection
node scripts/check-redis.js

# 2. Create caching service
# Create lib/services/cache.ts
```

**Code Changes:**
```typescript
// lib/services/cache.ts
import { Redis } from '@upstash/redis';

export class CacheService {
  private redis: Redis;

  constructor() {
    this.redis = new Redis({
      url: process.env.REDIS_URL!,
      token: process.env.REDIS_TOKEN!,
    });
  }

  async getProductData(productId: string): Promise<any | null> {
    const key = `product:${productId}`;
    const cached = await this.redis.get(key);
    return cached;
  }

  async setProductData(productId: string, data: any, ttl = 3600): Promise<void> {
    const key = `product:${productId}`;
    await this.redis.set(key, JSON.stringify(data), { ex: ttl });
  }

  async getSearchResults(query: string, siteId: string): Promise<any | null> {
    const key = `search:${siteId}:${query}`;
    const cached = await this.redis.get(key);
    return cached ? JSON.parse(cached) : null;
  }

  async setSearchResults(query: string, siteId: string, results: any, ttl = 1800): Promise<void> {
    const key = `search:${siteId}:${query}`;
    await this.redis.set(key, JSON.stringify(results), { ex: ttl });
  }

  async invalidateSiteCache(siteId: string): Promise<void> {
    // Invalidate all keys for a site
    const keys = await this.redis.keys(`search:${siteId}:*`);
    if (keys.length > 0) {
      await this.redis.del(...keys);
    }
  }
}
```

**Commands:**
```bash
# 3. Integrate caching into services
# Update lib/services/matching.ts to use cache
# Update lib/services/scraper.ts to cache results

# 4. Test caching
npm run test:integration
```

**Testing:**
```bash
# Performance test with/without cache
node scripts/cache-performance-test.js

# Verify cache hit rates > 70%
```

**Success Criteria:**
- ✅ Cache layer functional
- ✅ Response times < 500ms
- ✅ Cache hit rate > 70%

### 3.2 Site-Specific Optimization Profiles
**Goal:** Tailored performance for each ecommerce site

**Prerequisites:**
- Phase 3.1 completed
- Site performance data collected

**Steps:**
```bash
# 1. Create site profiles
# Create lib/config/site-profiles.ts
```

**Code Changes:**
```typescript
// lib/config/site-profiles.ts
export interface SiteProfile {
  strategy: 'light-js' | 'full-js' | 'html-only';
  selectors: Record<string, string>;
  waitTime: number;
  cacheTime: number;
  successRate: number;
  retryCount: number;
  userAgent?: string;
}

export const SITE_PROFILES: Record<string, SiteProfile> = {
  'startech.com.bd': {
    strategy: 'light-js',
    selectors: {
      title: 'h1',
      price: '.p-item-price',
      image: '.product-image img',
      stock: '.stock-status'
    },
    waitTime: 2000,
    cacheTime: 1800000, // 30 minutes
    successRate: 0.92,
    retryCount: 2
  },
  'ryans.com': {
    strategy: 'full-js',
    selectors: {
      title: 'h1.product-name',
      price: '.special-price',
      image: '.product-gallery img',
      stock: '.availability'
    },
    waitTime: 4000,
    cacheTime: 900000, // 15 minutes
    successRate: 0.88,
    retryCount: 3
  },
  'techlandbd.com': {
    strategy: 'html-only',
    selectors: {
      title: 'h1.product-title',
      price: '.product-price',
      image: '.main-image img',
      stock: '.stock-info'
    },
    waitTime: 1000,
    cacheTime: 3600000, // 1 hour
    successRate: 0.85,
    retryCount: 1
  }
};

export function getSiteProfile(hostname: string): SiteProfile {
  // Try exact match first
  if (SITE_PROFILES[hostname]) {
    return SITE_PROFILES[hostname];
  }

  // Try domain match
  for (const [domain, profile] of Object.entries(SITE_PROFILES)) {
    if (hostname.includes(domain.replace('www.', ''))) {
      return profile;
    }
  }

  // Default profile
  return {
    strategy: 'full-js',
    selectors: {},
    waitTime: 3000,
    cacheTime: 1800000,
    successRate: 0.7,
    retryCount: 2
  };
}
```

**Commands:**
```bash
# 2. Update scraper to use profiles
# Modify lib/services/scraper.ts searchAndScrape method
```

**Integration:**
```typescript
// Add to searchAndScrape method
const hostname = new URL(baseUrl).hostname;
const profile = getSiteProfile(hostname);

// Use profile settings
const waitTime = profile.waitTime;
const selectors = profile.selectors;
const strategy = profile.strategy;

// Adjust scraping based on strategy
if (strategy === 'html-only') {
  // Skip JS execution
} else if (strategy === 'light-js') {
  // Minimal JS wait
} else {
  // Full JS execution
}
```

**Testing:**
```bash
# Test site-specific performance
node scripts/test-site-profiles.js

# Verify profile selection works
```

**Success Criteria:**
- ✅ Profiles load correctly
- ✅ Site-specific optimizations apply
- ✅ Performance improvements per site

---

## Phase 4: User-Facing Features (Weeks 14-18)

### 4.1 Advanced Search Filters
**Goal:** Tech-specific search and filtering capabilities

**Prerequisites:**
- Phase 3 completed
- UI requirements gathered

**Steps:**
```bash
# 1. Create filter components
# Create components/dashboard/advanced-filters.tsx
```

**Code Changes:**
```typescript
// components/dashboard/advanced-filters.tsx
'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';

interface TechFilters {
  brand?: string;
  category?: string;
  priceMin?: number;
  priceMax?: number;
  ram?: string;
  storage?: string;
  processor?: string;
  screenSize?: string;
}

export function AdvancedFilters({ onFilterChange }: { onFilterChange: (filters: TechFilters) => void }) {
  const [filters, setFilters] = useState<TechFilters>({});

  const updateFilter = (key: keyof TechFilters, value: any) => {
    const newFilters = { ...filters, [key]: value };
    setFilters(newFilters);
    onFilterChange(newFilters);
  };

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 border rounded-lg">
      <Select
        placeholder="Brand"
        onValueChange={(value) => updateFilter('brand', value)}
      >
        <option value="samsung">Samsung</option>
        <option value="apple">Apple</option>
        <option value="dell">Dell</option>
        {/* Add more brands */}
      </Select>

      <Select
        placeholder="RAM"
        onValueChange={(value) => updateFilter('ram', value)}
      >
        <option value="8GB">8GB</option>
        <option value="16GB">16GB</option>
        <option value="32GB">32GB</option>
      </Select>

      <Select
        placeholder="Storage"
        onValueChange={(value) => updateFilter('storage', value)}
      >
        <option value="256GB">256GB</option>
        <option value="512GB">512GB</option>
        <option value="1TB">1TB</option>
      </Select>

      <div className="flex gap-2">
        <Input
          type="number"
          placeholder="Min Price"
          onChange={(e) => updateFilter('priceMin', Number(e.target.value))}
        />
        <Input
          type="number"
          placeholder="Max Price"
          onChange={(e) => updateFilter('priceMax', Number(e.target.value))}
        />
      </div>

      <Button onClick={() => onFilterChange({})} variant="outline">
        Clear Filters
      </Button>
    </div>
  );
}
```

**Commands:**
```bash
# 2. Update API to handle filters
# Modify app/api/v1/products/route.ts
```

**API Updates:**
```typescript
// Add to products API
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const filters = {
    brand: searchParams.get('brand'),
    ram: searchParams.get('ram'),
    storage: searchParams.get('storage'),
    priceMin: searchParams.get('priceMin'),
    priceMax: searchParams.get('priceMax'),
  };

  // Build Prisma query with filters
  const where: any = {};
  if (filters.brand) where.brand = filters.brand;
  if (filters.ram) where.specifications.some = { key: 'ram', value: filters.ram };
  if (filters.storage) where.specifications.some = { key: 'storage', value: filters.storage };
  if (filters.priceMin || filters.priceMax) {
    where.currentPrice = {};
    if (filters.priceMin) where.currentPrice.gte = Number(filters.priceMin);
    if (filters.priceMax) where.currentPrice.lte = Number(filters.priceMax);
  }

  const products = await prisma.product.findMany({ where });
  return Response.json(products);
}
```

**Testing:**
```bash
# Test filter functionality
npm run test:e2e

# Verify API returns filtered results
```

**Success Criteria:**
- ✅ Filters work in UI
- ✅ API returns filtered results
- ✅ Performance acceptable with filters

---

## Phase 5: Data Quality & Validation (Weeks 19-20)

### 5.1 Tech Product Validation
**Goal:** Ensure data accuracy for technical specifications

**Prerequisites:**
- All previous phases completed
- Validation rules defined

**Steps:**
```bash
# 1. Create validation service
# Create lib/services/validation.ts
```

**Code Changes:**
```typescript
// lib/services/validation.ts
export class TechProductValidator {
  static validateProduct(product: any): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Brand validation
    if (!product.brand || product.brand.length < 2) {
      errors.push('Brand is required and must be valid');
    }

    // Model validation
    if (!product.model || product.model.length < 3) {
      errors.push('Model is required and must be descriptive');
    }

    // Price validation
    if (!product.currentPrice || product.currentPrice <= 0) {
      errors.push('Valid price is required');
    }

    // Tech specs validation
    if (product.category === 'laptop' || product.category === 'computer') {
      const specs = product.specifications || [];

      const hasProcessor = specs.some((s: any) => s.key === 'processor');
      const hasRam = specs.some((s: any) => s.key === 'ram');
      const hasStorage = specs.some((s: any) => s.key === 'storage');

      if (!hasProcessor) warnings.push('Processor specification recommended');
      if (!hasRam) warnings.push('RAM specification recommended');
      if (!hasStorage) warnings.push('Storage specification recommended');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      score: Math.max(0, 100 - (errors.length * 20) - (warnings.length * 5))
    };
  }

  static validateSpecification(key: string, value: string): boolean {
    const patterns: Record<string, RegExp> = {
      ram: /^(4|8|16|32|64)GB$/i,
      storage: /^(128|256|512|1024|2048)GB (SSD|HDD)$/i,
      processor: /(Intel|AMD|Apple|M1|M2|Ryzen|Core i\d)/i,
      screen_size: /^\d{1,2}(\.\d)? inches?$/i,
    };

    const pattern = patterns[key.toLowerCase()];
    return pattern ? pattern.test(value) : true; // Allow unknown specs
  }
}

interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  score: number;
}
```

**Commands:**
```bash
# 2. Integrate validation into product creation/update
# Update product API routes

# 3. Add validation to scraper
# Update lib/services/scraper.ts
```

**Integration:**
```typescript
// Add to product creation API
const validation = TechProductValidator.validateProduct(productData);
if (!validation.isValid) {
  return Response.json({ errors: validation.errors }, { status: 400 });
}

// Add quality score to product
productData.qualityScore = validation.score;
```

**Testing:**
```bash
# Test validation rules
node scripts/test-validation.js

# Verify error handling
```

**Success Criteria:**
- ✅ Validation prevents invalid data
- ✅ Quality scores assigned
- ✅ Clear error messages for users

---

## Rollback Procedures

### Emergency Rollback (All Phases)
```bash
# 1. Stop all services
npm run stop:all

# 2. Restore database from backup
# Use latest backup from backups/ directory

# 3. Revert code to previous commit
git checkout <previous-commit-hash>

# 4. Restart services
npm run start:all

# 5. Verify system health
curl http://localhost:3000/api/health
```

### Phase-Specific Rollback
- **Database Changes:** `npx prisma migrate reset`
- **Code Changes:** `git revert <commit-hash>`
- **Cache Issues:** Flush Redis - `redis-cli FLUSHALL`
- **API Changes:** Feature flags to disable new endpoints

---

## Monitoring & Success Metrics

### Daily Checks
```bash
# System health
npm run health-check

# Performance metrics
npm run performance-monitor

# Error rates
npm run error-monitor
```

### Weekly Reports
- Database query performance
- Cache hit rates
- Matching accuracy
- User engagement metrics

### Success Criteria Summary
- ✅ Database queries < 100ms (10x improvement)
- ✅ Product matching accuracy > 90%
- ✅ Scraping speed 60% faster
- ✅ Cache hit rate > 70%
- ✅ System uptime > 99.9%
- ✅ User satisfaction scores > 4/5

---

## Support Resources

### Documentation
- API docs: `/dashboard/developers/docs`
- Troubleshooting: `docs/TROUBLESHOOTING.md`
- Performance guide: `docs/PERFORMANCE.md`

### Emergency Contacts
- DevOps: For infrastructure issues
- Backend Lead: For database/API issues
- QA Lead: For testing/deployment issues

---

**End of Executable Plan**

Each phase includes specific commands, testing procedures, and rollback plans. Follow sequentially and validate at each step. Report any issues immediately for resolution.</content>
<parameter name="filePath">/Applications/MAMP/htdocs/PricePilot/EXECUTABLE_IMPLEMENTATION_PLAN.md