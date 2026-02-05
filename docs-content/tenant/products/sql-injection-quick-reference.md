---
title: "SQL Injection Prevention Quick Reference"
description: "Quick reference for preventing SQL injection in product queries"
category: "products"
tags: ["security", "sql-injection", "quick-reference"]
audience: "tenant"
---

# SQL Injection Prevention - Quick Reference Card

**Keep this handy when writing database queries!**

---

## 🚦 Traffic Light System

### 🟢 GREEN - Use These (Safe)

```typescript
// 1. Prisma ORM (BEST CHOICE)
await prisma.product.findMany({
  where: { tenantId, price: { gt: 100 } }
});

// 2. Tagged Template (SAFE)
await prisma.$queryRaw`
  SELECT * FROM "Product"
  WHERE "tenantId" = ${tenantId}
`;
```

### 🟡 YELLOW - Use With Caution (Acceptable)

```typescript
// Parameterized $queryRawUnsafe
await prisma.$queryRawUnsafe(
  'SELECT * FROM "Product" WHERE "tenantId" = $1',
  tenantId
);

// Whitelisted identifiers
const ALLOWED = ['view1', 'view2'];
if (!ALLOWED.includes(name)) throw new Error();
await prisma.$executeRawUnsafe(`REFRESH VIEW ${name}`);
```

### 🔴 RED - Never Use These (Dangerous)

```typescript
// ❌ String concatenation
const query = `SELECT * FROM products WHERE id = ${userInput}`;

// ❌ Template literal with unsafe
await prisma.$queryRawUnsafe(`SELECT * FROM ${tableName}`);

// ❌ User input in identifiers
await prisma.$queryRawUnsafe(`ORDER BY ${req.query.sortBy}`);
```

---

## ⚡ Quick Decision Tree

```
Need to query database?
│
├─ Can you use Prisma ORM?
│  ├─ YES → Use Prisma ORM ✅ (BEST)
│  └─ NO → Continue
│
├─ Is it a simple query?
│  ├─ YES → Use $queryRaw with tagged template ✅
│  └─ NO → Continue
│
├─ Need dynamic WHERE clauses?
│  ├─ YES → Use $queryRawUnsafe with $1, $2 placeholders ⚠️
│  └─ NO → Continue
│
└─ Need DDL (CREATE/DROP)?
   └─ YES → Use $executeRawUnsafe with whitelisted identifiers ⚠️
```

---

## 📝 Cheat Sheet

### DO ✅

```typescript
// ✅ Parameterize all user inputs
const products = await prisma.$queryRaw`
  SELECT * FROM "Product"
  WHERE title ILIKE ${`%${searchTerm}%`}
`;

// ✅ Use Prisma for complex queries
const products = await prisma.product.findMany({
  where: {
    tenantId,
    OR: [
      { title: { contains: search } },
      { sku: { contains: search } }
    ]
  },
  include: { site: true }
});

// ✅ Whitelist dynamic identifiers
const ALLOWED_COLUMNS = ['price', 'title', 'createdAt'];
const sortBy = ALLOWED_COLUMNS.includes(req.query.sort) 
  ? req.query.sort 
  : 'createdAt';
```

### DON'T ❌

```typescript
// ❌ Never concatenate user input
const query = `SELECT * FROM products WHERE id = ${req.query.id}`;

// ❌ Never use template literals with unsafe
await prisma.$queryRawUnsafe(`
  SELECT * FROM products WHERE title = '${userInput}'
`);

// ❌ Never trust user input for identifiers
const table = req.query.table;
await prisma.$queryRawUnsafe(`SELECT * FROM ${table}`);
```

---

## 🔍 Code Review Checklist

When reviewing database queries, check:

- [ ] Is Prisma ORM used? (Preferred)
- [ ] Are all `${values}` in tagged templates?
- [ ] Are `$1`, `$2` placeholders used with `$queryRawUnsafe`?
- [ ] Are dynamic identifiers whitelisted?
- [ ] Is there any string concatenation?
- [ ] Is user input ever in SQL structure?

---

## 🧪 Test Your Knowledge

### Question 1: Is this safe?
```typescript
await prisma.$queryRaw`
  SELECT * FROM "Product"
  WHERE id = ${req.query.id}
`;
```
**Answer**: ✅ YES - Tagged template automatically parameterizes

### Question 2: Is this safe?
```typescript
await prisma.$queryRawUnsafe(
  `SELECT * FROM products WHERE id = ${req.query.id}`
);
```
**Answer**: ❌ NO - Template literal with unsafe method

### Question 3: Is this safe?
```typescript
const sortBy = req.query.sortBy || 'createdAt';
await prisma.$queryRawUnsafe(
  `SELECT * FROM products ORDER BY ${sortBy}`
);
```
**Answer**: ❌ NO - User input in SQL structure without whitelist

### Question 4: Is this safe?
```typescript
const ALLOWED = ['price', 'title'];
const sortBy = ALLOWED.includes(req.query.sortBy) 
  ? req.query.sortBy 
  : 'price';
await prisma.product.findMany({
  orderBy: { [sortBy]: 'desc' }
});
```
**Answer**: ✅ YES - Whitelisted identifier with Prisma ORM

---

## 🆘 When In Doubt

1. **Ask yourself**: "Could a user inject SQL here?"
2. **Prefer Prisma ORM**: It's almost always the right choice
3. **Use tagged templates**: `$queryRaw` over `$queryRawUnsafe`
4. **Whitelist identifiers**: Never trust user input for table/column names
5. **Get a code review**: Flag any `$queryRawUnsafe` usage

---

## 📚 More Information

- **Full Guide**: `docs/SAFE_QUERY_PATTERNS.md`
- **Audit Report**: `docs/SQL_INJECTION_AUDIT_REPORT.md`
- **Prisma Docs**: https://www.prisma.io/docs/concepts/components/prisma-client/raw-database-access

---

## 🎯 Remember

> **The safest query is one that uses Prisma ORM.**
> 
> Only use raw SQL when absolutely necessary,
> and always parameterize user inputs.

---

**Last Updated**: February 2, 2026  
**Print this and keep it at your desk!** 📌
