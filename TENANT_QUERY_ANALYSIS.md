# Tenant Query Performance Analysis

## Problem Summary

After applying database indexes, the Tenant query performance **degraded** instead of improving:
- **Before:** Tenant.findFirst = 1,442ms
- **After:** Tenant.findMany = 2,226ms (54% WORSE)

## Root Cause Analysis

### 1. Query Pattern Change
```typescript
// BEFORE (1,442ms)
const tenant = await prisma.tenant.findFirst({
    orderBy: { createdAt: 'desc' }
});

// AFTER (2,226ms) 
const tenants = await prisma.tenant.findMany({
    take: 1,
    orderBy: { createdAt: 'desc' }
});
```

**Issue:** `findMany` with `take: 1` is actually SLOWER than `findFirst` in this case because:
- `findMany` prepares for multiple results even with `take: 1`
- `findFirst` is optimized for single-row retrieval
- PostgreSQL query planner treats them differently

### 2. Schema Mismatch in Migration

The migration SQL references columns that **don't exist** in the actual schema:

```sql
-- ❌ WRONG - Tenant has no "status" column
CREATE INDEX "Tenant_status_idx" ON "Tenant" ("planType");

-- ❌ WRONG - Product has no "status" column  
CREATE INDEX "Product_tenantId_status_idx" ON "Product" ("tenantId", "status");

-- ❌ WRONG - PriceHistory has no "tenantId" or "productType" columns
CREATE INDEX "PriceHistory_tenantId_recordedAt_idx" ON "PriceHistory" ("tenantId", "recordedAt");
CREATE INDEX "PriceHistory_productType_idx" ON "PriceHistory" ("productType");

-- ❌ WRONG - TenantAuditLog has no "entityType" column
CREATE INDEX "TenantAuditLog_entityType_entityId_idx" ON "TenantAuditLog" ("entityType", "entityId");

-- ❌ WRONG - User has no "status" column
CREATE INDEX "User_tenantId_status_idx" ON "User" ("tenantId", "status");
```

### 3. Actual Tenant Schema

```prisma
model Tenant {
  id                        String   @id @default(cuid())
  companyName               String
  planType                  PlanType @default(BASIC)  // NOT "status"
  createdAt                 DateTime @default(now())
  updatedAt                 DateTime @updatedAt
  competitorLimit           Int      @default(3)
  storeLimit                Int      @default(1)
  currency                  String   @default("USD")
  // ... relations
}
```

**Key Points:**
- No `status` column (uses `planType` instead)
- Simple structure with few columns
- Primary key is already indexed
- `createdAt` is used for ordering

## Why Tenant Query is Slow

### Hypothesis 1: Table Scan
Without proper indexes, PostgreSQL may be doing a full table scan:
```sql
SELECT * FROM "Tenant" ORDER BY "createdAt" DESC LIMIT 1;
```

**Solution:** Add index on `createdAt DESC`

### Hypothesis 2: Large Table Size
If Tenant table has many rows, sorting becomes expensive.

**Solution:** Use `findFirst` with proper index

### Hypothesis 3: Query Planner Confusion
The query planner may not be using the optimal execution plan.

**Solution:** Run ANALYZE and check execution plan

## Correct Solution

### Step 1: Revert to findFirst
```typescript
// CORRECT - Use findFirst for single row
const tenant = await prisma.tenant.findFirst({
    orderBy: { createdAt: 'desc' }
});
```

### Step 2: Add Correct Index
```sql
-- Index for Tenant ordering by createdAt
CREATE INDEX IF NOT EXISTS "Tenant_createdAt_desc_idx" 
ON "Tenant" ("createdAt" DESC);

-- Analyze table
ANALYZE "Tenant";
```

### Step 3: Fix Migration SQL
Remove all references to non-existent columns:
- Remove `Tenant_status_idx` (column doesn't exist)
- Remove `Product_tenantId_status_idx` (status doesn't exist)
- Remove `PriceHistory_tenantId_recordedAt_idx` (tenantId doesn't exist)
- Remove `PriceHistory_productType_idx` (productType doesn't exist)
- Remove `TenantAuditLog_entityType_entityId_idx` (entityType doesn't exist)
- Remove `User_tenantId_status_idx` (status doesn't exist)

## Performance Expectations

With correct index on `createdAt DESC`:
- **Expected:** <10ms for Tenant.findFirst
- **Reason:** Index allows direct lookup of most recent tenant
- **Benefit:** 99.3% improvement from 1,442ms

## Action Items

1. ✅ Identify schema mismatches
2. ⏳ Create corrected migration SQL
3. ⏳ Revert query pattern to findFirst
4. ⏳ Apply corrected indexes
5. ⏳ Test performance
6. ⏳ Verify <10ms Tenant query

## Lessons Learned

1. **Always verify schema before creating indexes**
2. **findFirst is faster than findMany with take: 1**
3. **Test index application on staging first**
4. **Check PostgreSQL logs for index creation errors**
5. **Run EXPLAIN ANALYZE to verify query plans**
