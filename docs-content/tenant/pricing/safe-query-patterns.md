---
title: "Safe Query Patterns"
description: "Patterns for safely querying and filtering price data"
category: "pricing"
tags: ["queries", "best-practices", "safety"]
audience: "tenant"
author: "PricePilot Team"
lastReviewed: "2024-05-20"
---

# Safe Query Patterns Guide

**Purpose**: Document safe database query patterns to prevent SQL injection vulnerabilities  
**Audience**: All developers working with database queries  
**Last Updated**: February 2, 2026

---

## Table of Contents

1. [Quick Reference](#quick-reference)
2. [Prisma ORM Queries (Recommended)](#prisma-orm-queries-recommended)
3. [Raw SQL Queries (When Necessary)](#raw-sql-queries-when-necessary)
4. [Dangerous Patterns to Avoid](#dangerous-patterns-to-avoid)
5. [Special Cases](#special-cases)
6. [Code Review Checklist](#code-review-checklist)

---

## Quick Reference

### ✅ SAFE Patterns

```typescript
// 1. Prisma ORM (BEST)
await prisma.product.findMany({ where: { tenantId } });

// 2. Tagged Template (SAFE)
await prisma.$queryRaw`SELECT * FROM "Product" WHERE "tenantId" = ${tenantId}`;

// 3. Parameterized Unsafe (ACCEPTABLE)
await prisma.$queryRawUnsafe('SELECT * FROM "Product" WHERE "tenantId" = $1', tenantId);
```

### ❌ UNSAFE Patterns

```typescript
// 1. String Concatenation (NEVER)
await prisma.$queryRawUnsafe(`SELECT * FROM products WHERE id = ${userInput}`);

// 2. Template Literal with Unsafe (NEVER)
await prisma.$queryRawUnsafe(`SELECT * FROM ${tableName}`);

// 3. Dynamic Identifiers from User Input (NEVER)
const column = req.query.sortBy; // User input
await prisma.$queryRawUnsafe(`SELECT * FROM products ORDER BY ${column}`);
```

---

## Prisma ORM Queries (Recommended)

### Why Use Prisma ORM?

- ✅ Type-safe queries
- ✅ Automatic SQL injection prevention
- ✅ Better IDE support and autocomplete
- ✅ Easier to maintain and refactor
- ✅ Built-in query optimization

### Basic CRUD Operations

#### Create
```typescript
// ✅ SAFE: Prisma handles all escaping
const product = await prisma.product.create({
  data: {
    title: userInput.title,
    currentPrice: userInput.price,
    tenantId: session.user.tenantId,
  }
});
```

#### Read
```typescript
// ✅ SAFE: All filters are parameterized
const products = await prisma.product.findMany({
  where: {
    tenantId: tenantId,
    currentPrice: {
      gte: minPrice,
      lte: maxPrice,
    },
    title: {
      contains: searchTerm,
      mode: 'insensitive',
    }
  },
  orderBy: {
    currentPrice: 'desc',
  },
  take: 20,
  skip: (page - 1) * 20,
});
```

#### Update
```typescript
// ✅ SAFE: Prisma handles all escaping
const updated = await prisma.product.update({
  where: { id: productId },
  data: {
    currentPrice: newPrice,
    updatedAt: new Date(),
  }
});
```

#### Delete
```typescript
// ✅ SAFE: Prisma handles all escaping
await prisma.product.delete({
  where: { id: productId }
});
```

### Complex Queries

#### Joins with Include
```typescript
// ✅ SAFE: Prisma handles all joins
const products = await prisma.product.findMany({
  where: { tenantId },
  include: {
    site: true,
    matchesAsUser: {
      include: {
        competitorProduct: true,
      }
    },
    priceHistory: {
      take: 10,
      orderBy: { recordedAt: 'desc' }
    }
  }
});
```

#### Aggregations
```typescript
// ✅ SAFE: Prisma handles all aggregations
const stats = await prisma.product.aggregate({
  where: { tenantId },
  _count: true,
  _avg: { currentPrice: true },
  _min: { currentPrice: true },
  _max: { currentPrice: true },
});
```

#### Transactions
```typescript
// ✅ SAFE: Prisma handles transaction safety
await prisma.$transaction(async (tx) => {
  const product = await tx.product.update({
    where: { id: productId },
    data: { currentPrice: newPrice }
  });
  
  await tx.priceHistory.create({
    data: {
      productId: product.id,
      price: newPrice,
      recordedAt: new Date(),
    }
  });
});
```

---

## Raw SQL Queries (When Necessary)

### When to Use Raw SQL

Use raw SQL only when:
- Prisma ORM doesn't support the operation (e.g., DDL, complex analytics)
- Performance optimization requires specific SQL features
- Working with database-specific features (e.g., materialized views)

### Pattern 1: Tagged Template Literals (RECOMMENDED)

```typescript
// ✅ SAFE: Prisma automatically parameterizes all ${} values
const products = await prisma.$queryRaw<Product[]>`
  SELECT * FROM "Product"
  WHERE "tenantId" = ${tenantId}
  AND "currentPrice" > ${minPrice}
  AND "title" ILIKE ${`%${searchTerm}%`}
`;
```

**How it works**:
- Prisma converts `${value}` to parameterized queries
- Equivalent to: `SELECT * FROM "Product" WHERE "tenantId" = $1 AND "currentPrice" > $2`
- All values are safely escaped

### Pattern 2: Parameterized $queryRawUnsafe (ACCEPTABLE)

```typescript
// ⚠️ ACCEPTABLE: Manual parameterization with $1, $2, etc.
const query = `
  SELECT * FROM "Product"
  WHERE "tenantId" = $1
  AND "currentPrice" > $2
  AND "title" ILIKE $3
`;

const products = await prisma.$queryRawUnsafe<Product[]>(
  query,
  tenantId,
  minPrice,
  `%${searchTerm}%`
);
```

**When to use**:
- Building dynamic queries with conditional clauses
- Need more control over query structure
- Working with complex SQL that's hard to express in tagged templates

**Important**: Always use `$1`, `$2`, etc. placeholders, never string concatenation

### Pattern 3: Dynamic WHERE Clauses

```typescript
// ✅ SAFE: Build parameterized queries dynamically
function buildProductQuery(filters: {
  tenantId: string;
  minPrice?: number;
  maxPrice?: number;
  searchTerm?: string;
}) {
  const conditions: string[] = ['tenant_id = $1'];
  const params: any[] = [filters.tenantId];
  let paramIndex = 2;

  if (filters.minPrice !== undefined) {
    conditions.push(`current_price >= $${paramIndex++}`);
    params.push(filters.minPrice);
  }

  if (filters.maxPrice !== undefined) {
    conditions.push(`current_price <= $${paramIndex++}`);
    params.push(filters.maxPrice);
  }

  if (filters.searchTerm) {
    conditions.push(`title ILIKE $${paramIndex++}`);
    params.push(`%${filters.searchTerm}%`);
  }

  const query = `
    SELECT * FROM products
    WHERE ${conditions.join(' AND ')}
    ORDER BY current_price DESC
  `;

  return prisma.$queryRawUnsafe(query, ...params);
}
```

---

## Dangerous Patterns to Avoid

### ❌ Pattern 1: String Concatenation

```typescript
// ❌ CRITICAL VULNERABILITY
const userInput = req.query.id; // Could be: "1 OR 1=1"
const query = `SELECT * FROM products WHERE id = ${userInput}`;
await prisma.$queryRawUnsafe(query);

// Result: SELECT * FROM products WHERE id = 1 OR 1=1
// Returns ALL products!
```

**Why Dangerous**: User can inject arbitrary SQL

**Fix**:
```typescript
// ✅ SAFE
await prisma.$queryRaw`SELECT * FROM products WHERE id = ${userInput}`;
```

### ❌ Pattern 2: Dynamic Table Names from User Input

```typescript
// ❌ CRITICAL VULNERABILITY
const tableName = req.query.table; // User input
await prisma.$queryRawUnsafe(`SELECT * FROM ${tableName}`);

// User could input: "products; DROP TABLE users; --"
```

**Why Dangerous**: User controls SQL structure

**Fix**:
```typescript
// ✅ SAFE: Use whitelist
const ALLOWED_TABLES = ['products', 'sites', 'users'];

function queryTable(tableName: string) {
  if (!ALLOWED_TABLES.includes(tableName)) {
    throw new Error('Invalid table name');
  }
  
  // Still use parameterized queries for data
  return prisma.$queryRawUnsafe(`SELECT * FROM ${tableName} WHERE tenant_id = $1`, tenantId);
}
```

### ❌ Pattern 3: Dynamic Column Names from User Input

```typescript
// ❌ CRITICAL VULNERABILITY
const sortBy = req.query.sortBy; // User input
await prisma.$queryRawUnsafe(`SELECT * FROM products ORDER BY ${sortBy}`);
```

**Why Dangerous**: User can inject SQL in ORDER BY clause

**Fix**:
```typescript
// ✅ SAFE: Use whitelist and mapping
const ALLOWED_SORT_COLUMNS: Record<string, string> = {
  'price': 'current_price',
  'name': 'title',
  'date': 'created_at',
};

function queryProducts(sortBy: string) {
  const column = ALLOWED_SORT_COLUMNS[sortBy] || 'created_at';
  
  // Use Prisma ORM for safety
  return prisma.product.findMany({
    orderBy: { [column]: 'desc' }
  });
}
```

### ❌ Pattern 4: Template Literals with $queryRawUnsafe

```typescript
// ❌ CRITICAL VULNERABILITY
await prisma.$queryRawUnsafe(`
  SELECT * FROM products
  WHERE title = '${userInput}'
`);
```

**Why Dangerous**: No parameterization, direct injection

**Fix**:
```typescript
// ✅ SAFE: Use tagged template
await prisma.$queryRaw`
  SELECT * FROM products
  WHERE title = ${userInput}
`;
```

---

## Special Cases

### Case 1: DDL Operations (CREATE, ALTER, DROP)

```typescript
// ⚠️ ACCEPTABLE: DDL requires $executeRawUnsafe
// BUT: Use whitelisted identifiers only

const ALLOWED_INDEXES = [
  'idx_product_tenant',
  'idx_product_price',
  'idx_site_tenant',
];

async function createIndex(indexName: string) {
  if (!ALLOWED_INDEXES.includes(indexName)) {
    throw new Error('Invalid index name');
  }
  
  // Safe because indexName is whitelisted
  await prisma.$executeRawUnsafe(`
    CREATE INDEX CONCURRENTLY ${indexName}
    ON products(tenant_id, current_price)
  `);
}
```

### Case 2: Materialized Views

```typescript
// ⚠️ ACCEPTABLE: View management requires raw SQL
const ALLOWED_VIEWS = [
  'daily_price_comparison_summary',
  'monthly_sales_summary',
];

async function refreshView(viewName: string) {
  if (!ALLOWED_VIEWS.includes(viewName)) {
    throw new Error('Invalid view name');
  }
  
  // Safe because viewName is whitelisted
  await prisma.$executeRawUnsafe(
    `REFRESH MATERIALIZED VIEW CONCURRENTLY ${viewName}`
  );
}
```

### Case 3: Full-Text Search

```typescript
// ✅ SAFE: Use Prisma's search features
const products = await prisma.product.findMany({
  where: {
    title: {
      search: searchTerm, // Prisma handles escaping
    }
  }
});

// Or with raw SQL (if needed)
// ✅ SAFE: Parameterized search
const products = await prisma.$queryRaw`
  SELECT * FROM products
  WHERE to_tsvector('english', title) @@ plainto_tsquery('english', ${searchTerm})
`;
```

### Case 4: JSON Queries

```typescript
// ✅ SAFE: Prisma supports JSON operations
const products = await prisma.product.findMany({
  where: {
    metadata: {
      path: ['category'],
      equals: 'electronics',
    }
  }
});

// Or with raw SQL
// ✅ SAFE: Parameterized JSON query
const products = await prisma.$queryRaw`
  SELECT * FROM products
  WHERE metadata->>'category' = ${category}
`;
```

---

## Code Review Checklist

### For All Database Queries

- [ ] Is Prisma ORM used instead of raw SQL? (Preferred)
- [ ] If raw SQL is used, is it absolutely necessary?
- [ ] Are all user inputs parameterized?
- [ ] Are there any string concatenations in SQL?
- [ ] Are dynamic identifiers (tables/columns) whitelisted?

### For $queryRaw Usage

- [ ] Uses tagged template literals (backticks)?
- [ ] All `${values}` are data, not SQL structure?
- [ ] No string concatenation before passing to $queryRaw?

### For $queryRawUnsafe Usage

- [ ] Uses `$1`, `$2`, etc. parameter placeholders?
- [ ] All parameters passed as separate arguments?
- [ ] No template literals used?
- [ ] Documented why unsafe method is necessary?

### For $executeRawUnsafe Usage

- [ ] Used only for DDL operations?
- [ ] All identifiers are whitelisted?
- [ ] No user input in SQL structure?
- [ ] Documented why unsafe method is necessary?

---

## Testing for SQL Injection

### Test Cases to Include

```typescript
describe('SQL Injection Prevention', () => {
  it('should prevent SQL injection in search', async () => {
    const maliciousInput = "'; DROP TABLE products; --";
    
    // Should not throw or execute DROP
    const result = await prisma.product.findMany({
      where: {
        title: {
          contains: maliciousInput,
        }
      }
    });
    
    // Should return empty array, not error
    expect(result).toEqual([]);
  });

  it('should prevent SQL injection in raw queries', async () => {
    const maliciousInput = "1 OR 1=1";
    
    // Should not return all products
    const result = await prisma.$queryRaw`
      SELECT * FROM products WHERE id = ${maliciousInput}
    `;
    
    expect(result).toEqual([]);
  });
});
```

---

## Additional Resources

### Internal Documentation
- [SQL Injection Audit Report](./SQL_INJECTION_AUDIT_REPORT.md)
- [Security Requirements](./security-requirements.md)
- [Database Schema Guidelines](./database-schema-guidelines.md)

### External Resources
- [Prisma Security Best Practices](https://www.prisma.io/docs/concepts/components/prisma-client/raw-database-access#security)
- [OWASP SQL Injection Prevention](https://cheatsheetseries.owasp.org/cheatsheets/SQL_Injection_Prevention_Cheat_Sheet.html)
- [PostgreSQL Security](https://www.postgresql.org/docs/current/sql-syntax-lexical.html#SQL-SYNTAX-IDENTIFIERS)

---

## Questions?

If you're unsure whether a query pattern is safe:

1. **Ask in code review** - Flag it for security review
2. **Prefer Prisma ORM** - When in doubt, use Prisma ORM
3. **Test with malicious input** - Try SQL injection payloads
4. **Consult security team** - Better safe than sorry

---

**Remember**: The safest query is one that uses Prisma ORM. Only use raw SQL when absolutely necessary, and always parameterize user inputs.
