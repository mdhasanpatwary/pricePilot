# N+1 Query Audit Report

## Overview
This document identifies N+1 query problems in the PricePilot codebase and provides solutions.

## Identified N+1 Query Problems

### 1. **execution.ts - Bulk Price Updates**
**Location**: `lib/services/execution.ts:20-25`

**Problem**:
```typescript
for (const pid of productIds) {
  const product = await prisma.product.findUnique({
    where: { id: pid },
    include: {
      site: true,
      matchesAsUser: {
        include: { competitorProduct: true },
        take: 1,
      },
    },
  });
  // ... process product
}
```

**Issue**: Fetches products one by one in a loop (N queries for N products)

**Solution**: Use `findMany` with `where: { id: { in: productIds } }`

---

### 2. **discovery.ts - Product Matching Check**
**Location**: `lib/services/discovery.ts:101-104`

**Problem**:
```typescript
const existingMatch = await prisma.productMatch.findFirst({
   where: { userProductId: up.id, competitorProduct: { siteId: site.id } }
});
```

**Issue**: Inside a loop checking for existing matches one by one

**Solution**: Fetch all existing matches upfront with `findMany`

---

### 3. **matching.ts - User Products Without Matches**
**Location**: `lib/services/matching.ts:95-101`

**Problem**:
```typescript
const userProducts = await prisma.product.findMany({
  where: {
    tenantId,
    site: { type: "USER" },
    matchesAsUser: { none: {} },
  },
});

// Then later in loop:
for (const up of userProducts) {
  const match = await this.findBestMatch(up, competitorProducts, tenantId);
  if (match) {
    await this.createMatch(...);
  }
}
```

**Issue**: While the initial query is good, the `createMatch` calls are sequential

**Solution**: Batch match creation operations

---

### 4. **sync.ts - Product Sync Loop**
**Location**: `lib/services/sync.ts:212-290`

**Problem**:
```typescript
for (const extProd of externalProducts) {
  const currentSite = await prisma.site.findUnique({
    where: { id: siteId },
    select: { isSyncing: true },
  });
  
  const product = await prisma.$transaction(async (tx) => {
    const existingProduct = await tx.product.findFirst({
      where: {
        siteId: site.id,
        externalId: extProd.external_id,
      },
    });
    // ... update or create
  });
}
```

**Issue**: 
- Checks site status on every iteration
- Checks for existing product one by one

**Solution**: 
- Check site status once before loop or periodically (every 10 items)
- Fetch all existing products upfront and use a Map for lookups

---

### 5. **approval-delegation.ts - User Lookups**
**Location**: `lib/services/approval-delegation.ts:98-105`

**Problem**:
```typescript
const [fromUser, toUser] = await Promise.all([
  prisma.user.findUnique({
    where: { id: fromUserId },
    select: { id: true, name: true, email: true, tenantId: true, role: true }
  }),
  prisma.user.findUnique({
    where: { id: toUserId },
    select: { id: true, name: true, email: true, tenantId: true }
  })
]);
```

**Issue**: While using Promise.all is good, if this is called in a loop it becomes N+1

**Solution**: If called in bulk operations, fetch all users upfront

---

## Performance Impact

### High Impact (Fix Immediately)
1. ✅ **execution.ts** - Affects bulk price updates (could be 100s of products)
2. ✅ **sync.ts** - Affects product sync (could be 1000s of products)
3. ✅ **discovery.ts** - Affects product discovery (could be 100s of products)

### Medium Impact (Fix Soon)
4. ⚠️ **matching.ts** - Affects matching operations (typically 10-50 products)

### Low Impact (Monitor)
5. ℹ️ **approval-delegation.ts** - Typically single operations

## Recommendations

### Immediate Actions
1. Fix execution.ts bulk update query
2. Optimize sync.ts product upsert loop
3. Optimize discovery.ts match checking

### Best Practices Going Forward
1. Always use `findMany` with `where: { id: { in: ids } }` for bulk operations
2. Use `include` to fetch related data in single query
3. Fetch lookup data upfront and use Maps for O(1) lookups
4. Use `Promise.all` for parallel operations when possible
5. Consider using database transactions for bulk operations

### Query Optimization Patterns

#### Pattern 1: Bulk Fetch with Map Lookup
```typescript
// BAD
for (const id of ids) {
  const item = await prisma.model.findUnique({ where: { id } });
}

// GOOD
const items = await prisma.model.findMany({
  where: { id: { in: ids } }
});
const itemMap = new Map(items.map(item => [item.id, item]));
for (const id of ids) {
  const item = itemMap.get(id);
}
```

#### Pattern 2: Include Relations
```typescript
// BAD
const products = await prisma.product.findMany({ where: { tenantId } });
for (const product of products) {
  const site = await prisma.site.findUnique({ where: { id: product.siteId } });
}

// GOOD
const products = await prisma.product.findMany({
  where: { tenantId },
  include: { site: true }
});
```

#### Pattern 3: Batch Operations
```typescript
// BAD
for (const data of dataArray) {
  await prisma.model.create({ data });
}

// GOOD
await prisma.model.createMany({
  data: dataArray
});
```

## Testing Strategy

After fixes:
1. Test with large datasets (1000+ products)
2. Monitor query count in logs
3. Measure execution time improvements
4. Verify data integrity

## Expected Improvements

- **execution.ts**: 100 queries → 1 query (100x improvement)
- **sync.ts**: 1000 queries → ~10 queries (100x improvement)
- **discovery.ts**: 500 queries → 2 queries (250x improvement)

Total estimated performance improvement: **50-100x faster** for bulk operations
