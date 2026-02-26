---
title: "API Validation Guide"
description: "Understanding API validation errors and how to fix them"
category: "troubleshooting"
tags: ["api", "validation", "troubleshooting"]
audience: "tenant"
author: "PricePilot Team"
lastReviewed: "2024-05-20"
---

# API Validation Guide

## Quick Start

This guide shows you how to add validation to API endpoints in PricePilot.

## Basic Usage

### 1. Import Validation Functions

```typescript
import {
  validateBody,
  validateQuery,
  validateParams,
  validationErrorResponse,
} from "@/lib/validation";
```

### 2. Import or Create Schema

```typescript
import { createProductSchema } from "@/lib/validation/schemas";
```

### 3. Validate in Handler

```typescript
async function handlePOST(req: NextRequest) {
  // Validate request body
  const validation = await validateBody(req, createProductSchema);
  
  if (!validation.success) {
    return validationErrorResponse(validation);
  }
  
  // Use validated data (type-safe!)
  const { name, price, sku } = validation.data!;
  
  // ... rest of handler
}
```

## Complete Example

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { withRateLimit } from "@/lib/middleware/ratelimit";
import {
  validateBody,
  validationErrorResponse,
  createProductSchema,
} from "@/lib/validation";

async function handlePOST(req: NextRequest) {
  // 1. Check authentication
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 2. Validate input
  const validation = await validateBody(req, createProductSchema);
  if (!validation.success) {
    return validationErrorResponse(validation);
  }

  // 3. Use validated data (type-safe!)
  const { name, price, sku } = validation.data!;

  // 4. Process request
  const product = await prisma.product.create({
    data: {
      name,
      price,
      sku,
      tenantId: session.user.tenantId,
    },
  });

  return NextResponse.json(product, { status: 201 });
}

export async function POST(req: NextRequest) {
  return withRateLimit(req, "write", handlePOST);
}
```

## Creating Custom Schemas

### Basic Schema

```typescript
import { z } from "zod";

export const createProductSchema = z.object({
  name: z.string().min(1).max(255),
  price: z.number().positive(),
  sku: z.string().min(1).max(100),
  description: z.string().max(1000).optional(),
});
```

### Advanced Schema with Validation

```typescript
export const createUserSchema = z.object({
  email: z.string().email().toLowerCase().trim(),
  password: z
    .string()
    .min(8)
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])/,
      "Password must contain uppercase, lowercase, number, and special character"
    ),
  companyName: z
    .string()
    .min(2)
    .max(100)
    .regex(/^[a-zA-Z0-9\s\-_.,&'()]+$/),
});
```

### Schema with Custom Validation

```typescript
export const dateRangeSchema = z
  .object({
    startDate: z.string().datetime(),
    endDate: z.string().datetime(),
  })
  .refine(
    (data) => new Date(data.startDate) <= new Date(data.endDate),
    { message: "Start date must be before end date" }
  );
```

## Validation Types

### Request Body Validation

```typescript
const validation = await validateBody(req, schema);
```

### Query Parameter Validation

```typescript
const validation = validateQuery(req, schema);
```

### Path Parameter Validation

```typescript
const validation = validateParams(params, schema);
```

## Common Schemas

### UUID Validation

```typescript
import { uuidSchema } from "@/lib/validation/schemas";

const schema = z.object({
  id: uuidSchema,
});
```

### Email Validation

```typescript
import { emailSchema } from "@/lib/validation/schemas";

const schema = z.object({
  email: emailSchema,
});
```

### URL Validation

```typescript
import { urlSchema } from "@/lib/validation/schemas";

const schema = z.object({
  url: urlSchema,
});
```

### Price Validation

```typescript
import { priceSchema } from "@/lib/validation/schemas";

const schema = z.object({
  price: priceSchema,
});
```

## Error Handling

### Standard Error Response

```typescript
if (!validation.success) {
  return validationErrorResponse(validation);
}
```

Returns:
```json
{
  "error": "Validation failed",
  "details": [
    {
      "field": "email",
      "message": "Invalid email format"
    }
  ]
}
```

### Custom Error Response

```typescript
if (!validation.success) {
  return NextResponse.json(
    {
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Invalid input",
        details: validation.errors,
      },
    },
    { status: 422 }
  );
}
```

## Security Best Practices

### 1. Always Validate at API Boundary

```typescript
// ✅ GOOD: Validate immediately
async function handlePOST(req: NextRequest) {
  const validation = await validateBody(req, schema);
  if (!validation.success) {
    return validationErrorResponse(validation);
  }
  // ... process validated data
}

// ❌ BAD: Use raw input
async function handlePOST(req: NextRequest) {
  const body = await req.json();
  // ... use body directly (unsafe!)
}
```

### 2. Sanitize User Content

```typescript
import { sanitizeHtml } from "@/lib/validation/middleware";

const schema = z.object({
  description: z.string().transform((val) => sanitizeHtml(val)),
});
```

### 3. Use Strict Schemas

```typescript
// ✅ GOOD: Strict schema (no unknown keys)
const schema = z.object({
  name: z.string(),
  price: z.number(),
}).strict();

// ❌ BAD: Allows unknown keys
const schema = z.object({
  name: z.string(),
  price: z.number(),
}).passthrough();
```

### 4. Validate Nested Objects

```typescript
const schema = z.object({
  user: z.object({
    name: z.string(),
    email: emailSchema,
  }),
  settings: z.object({
    notifications: z.boolean(),
    theme: z.enum(["light", "dark"]),
  }),
});
```

### 5. Validate Arrays

```typescript
const schema = z.object({
  productIds: z
    .array(uuidSchema)
    .min(1, "At least one product required")
    .max(100, "Maximum 100 products allowed"),
});
```

## Testing Validation

### Test Invalid Input

```typescript
// Test with missing required field
const response = await fetch("/api/products", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({}),
});

expect(response.status).toBe(400);
const data = await response.json();
expect(data.error).toBe("Validation failed");
```

### Test Invalid Format

```typescript
// Test with invalid email
const response = await fetch("/api/users", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    email: "not-an-email",
    password: "Test123!",
  }),
});

expect(response.status).toBe(400);
const data = await response.json();
expect(data.details[0].field).toBe("email");
```

### Test XSS Prevention

```typescript
// Test with XSS attempt
const response = await fetch("/api/products", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    name: "<script>alert('XSS')</script>",
    price: 99.99,
  }),
});

expect(response.status).toBe(201);
const data = await response.json();
// Script tags should be removed
expect(data.name).not.toContain("<script>");
```

## Common Patterns

### Optional Fields with Defaults

```typescript
const schema = z.object({
  name: z.string(),
  isActive: z.boolean().default(true),
  priority: z.number().default(1),
});
```

### Conditional Validation

```typescript
const schema = z
  .object({
    type: z.enum(["email", "sms"]),
    email: z.string().email().optional(),
    phone: z.string().optional(),
  })
  .refine(
    (data) => {
      if (data.type === "email") return !!data.email;
      if (data.type === "sms") return !!data.phone;
      return true;
    },
    { message: "Email required for email type, phone for SMS type" }
  );
```

### Transform and Validate

```typescript
const schema = z.object({
  price: z
    .string()
    .transform((val) => parseFloat(val))
    .pipe(z.number().positive()),
  tags: z
    .string()
    .transform((val) => val.split(",").map((t) => t.trim()))
    .pipe(z.array(z.string().min(1))),
});
```

## Troubleshooting

### Schema Not Found

```typescript
// ❌ Error: Cannot find module
import { mySchema } from "@/lib/validation";

// ✅ Fix: Import from schemas file
import { mySchema } from "@/lib/validation/schemas";
```

### Type Errors

```typescript
// ❌ Error: Type 'unknown' is not assignable
const { name } = validation.data;

// ✅ Fix: Use non-null assertion
const { name } = validation.data!;
```

### Validation Not Working

```typescript
// ❌ Problem: Forgot to check success
const validation = await validateBody(req, schema);
const { name } = validation.data!; // May be undefined!

// ✅ Fix: Always check success first
const validation = await validateBody(req, schema);
if (!validation.success) {
  return validationErrorResponse(validation);
}
const { name } = validation.data!; // Now safe!
```

## Resources

- [Zod Documentation](https://zod.dev/)
- [OWASP Input Validation](https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html)
- [PricePilot Validation Schemas](../lib/validation/schemas.ts)
- [PricePilot Validation Middleware](../lib/validation/middleware.ts)

## Support

For questions or issues with validation:
1. Check existing schemas in `lib/validation/schemas.ts`
2. Review validation middleware in `lib/validation/middleware.ts`
3. Look at existing API routes for examples
4. Consult this guide for common patterns

---

**Last Updated**: February 2, 2026  
**Version**: 1.0
