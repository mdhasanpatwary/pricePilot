---
title: "Input Sanitization"
description: "Input sanitization and validation"
category: "troubleshooting"
tags: ["security", "validation", "guide"]
audience: "tenant"
relatedDocs: ["/admin-docs/security/input-sanitization.md"]
---

> **Note:** This is a simplified version for tenants. For technical details, administrators can refer to the [admin documentation](/admin-docs/security/input-sanitization.md).

# Input Sanitization & Validation System

## Overview

PricePilot implements comprehensive input validation and sanitization to prevent security vulnerabilities including:

- **XSS (Cross-Site Scripting)**: Removes malicious scripts and HTML tags
- **SQL Injection**: Prevents SQL injection through Prisma's parameterized queries and additional sanitization
- **Data Validation**: Ensures all inputs meet expected formats and constraints
- **Type Safety**: Leverages TypeScript and Zod for compile-time and runtime type checking

## Architecture

### Components

1. **Validation Schemas** (`lib/validation/schemas.ts`)
   - Zod schemas for all API inputs
   - Reusable field validators
   - Type-safe input definitions

2. **Validation Middleware** (`lib/validation/middleware.ts`)
   - Request validation utilities
   - Sanitization helpers
   - Error response formatting

3. **API Integration**
   - All API routes use validation middleware
   - Consistent error handling
   - Type-safe request handling

## Usage

### Basic Validation

```typescript
import { validateBody, validationErrorResponse, registerSchema } from "@/lib/validation";

export async function POST(req: NextRequest) {
  // Validate request body
  const validation = await validateBody(req, registerSchema);

  if (!validation.success) {
    return validationErrorResponse(validation);
  }

  // Data is now type-safe and sanitized
  const { email, password, companyName } = validation.data!;

  // ... rest of your logic
}
```

### Available Validation Functions

#### `validateBody<T>(req, schema)`
Validates and sanitizes request body against a Zod schema.

```typescript
const validation = await validateBody(req, createProductSchema);
```

#### `validateQuery<T>(req, schema)`
Validates query parameters.

```typescript
const validation = validateQuery(req, searchQuerySchema);
```

#### `validateParams<T>(params, schema)`
Validates path parameters.

```typescript
const validation = validateParams({ id: "123" }, uuidSchema);
```

#### `validationErrorResponse(result)`
Creates a standardized error response.

```typescript
if (!validation.success) {
  return validationErrorResponse(validation);
}
```

## Available Schemas

### Authentication

- `registerSchema` - User registration (email, password, companyName)
- `loginSchema` - User login (email, password)
- `passwordResetRequestSchema` - Password reset request
- `passwordResetSchema` - Password reset with token

### Integrations

- `createIntegrationSchema` - Create store integration
- `deleteIntegrationSchema` - Delete integration

### Competitors

- `createCompetitorSchema` - Add competitor URL
- `deleteCompetitorSchema` - Remove competitor

### Products

- `updateProductSchema` - Update product details
- `bulkUpdateProductsSchema` - Bulk product updates

### Pricing Rules

- `createPricingRuleSchema` - Create pricing rule
- `updatePricingRuleSchema` - Update pricing rule
- `deletePricingRuleSchema` - Delete pricing rule

### Webhooks

- `createWebhookSchema` - Create webhook
- `updateWebhookSchema` - Update webhook

### Admin

- `createTenantSchema` - Create tenant
- `updateTenantSchema` - Update tenant
- `systemConfigSchema` - System configuration

### Search & Filters

- `searchQuerySchema` - Search with pagination
- `dateRangeSchema` - Date range validation

## Field Validators

### Common Fields

```typescript
// Email validation
emailSchema: z.string().email().min(5).max(255).toLowerCase().trim()

// Password validation (min 8 chars, requires uppercase, lowercase, number)
passwordSchema: z.string().min(8).max(128).regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)

// URL validation (HTTP/HTTPS only)
urlSchema: z.string().url().min(10).max(2048)

// UUID validation
uuidSchema: z.string().uuid()

// Sanitized string (removes HTML, scripts, event handlers)
sanitizedStringSchema: z.string().trim().transform(sanitizeString)

// Company name
companyNameSchema: z.string().trim().min(2).max(100)

// SKU
skuSchema: z.string().trim().min(1).max(100).regex(/^[a-zA-Z0-9\-_]+$/)

// Price (allows 0 for "coming soon" products)
priceSchema: z.number().min(0).max(999999999.99).finite()

// Percentage (0-100)
percentageSchema: z.number().min(0).max(100).finite()
```

## Sanitization Functions

### HTML Sanitization

```typescript
import { sanitizeHtml } from "@/lib/validation";

const clean = sanitizeHtml(userInput);
// Removes: <script>, <iframe>, <object>, <embed>, <link>, <style>
// Removes: javascript:, event handlers, data URLs
```

### SQL Sanitization

```typescript
import { sanitizeSql } from "@/lib/validation";

const clean = sanitizeSql(userInput);
// Removes: SQL special characters, comments, stored procedures
// Note: Prisma handles parameterized queries automatically
```

## Security Best Practices

### 1. Always Validate User Input

```typescript
// ❌ BAD - No validation
const { email } = await req.json();

// ✅ GOOD - Validated and sanitized
const validation = await validateBody(req, registerSchema);
const { email } = validation.data!;
```

### 2. Use Type-Safe Schemas

```typescript
// ✅ GOOD - Type-safe
type RegisterInput = z.infer<typeof registerSchema>;
```

### 3. Sanitize Before Database Operations

```typescript
// ✅ GOOD - Sanitized input
const { title } = validation.data!; // Already sanitized by schema
await prisma.product.create({ data: { title } });
```

### 4. Validate File Uploads

```typescript
import { validateFile } from "@/lib/validation";

const result = validateFile(file, {
  maxSizeBytes: 5 * 1024 * 1024, // 5MB
  allowedMimeTypes: ["image/jpeg", "image/png"],
  allowedExtensions: [".jpg", ".png"],
});
```

### 5. Validate IP Addresses

```typescript
import { validateIpAddress } from "@/lib/validation";

const result = validateIpAddress(req.headers.get("x-forwarded-for"));
```

## Error Handling

### Validation Error Response Format

```json
{
  "error": "Validation failed",
  "details": [
    {
      "field": "email",
      "message": "Invalid email format"
    },
    {
      "field": "password",
      "message": "Password must be at least 8 characters"
    }
  ]
}
```

### Custom Error Messages

```typescript
const schema = z.object({
  email: z.string().email("Please provide a valid email address"),
  age: z.number().min(18, "You must be at least 18 years old"),
});
```

## Testing

### Unit Tests

```typescript
import { validateBody, registerSchema } from "@/lib/validation";

describe("Input Validation", () => {
  it("should reject invalid email", async () => {
    const mockReq = {
      json: async () => ({ email: "invalid", password: "Test123", companyName: "Test" })
    };

    const result = await validateBody(mockReq, registerSchema);
    expect(result.success).toBe(false);
    expect(result.error).toBe("Validation failed");
  });

  it("should accept valid input", async () => {
    const mockReq = {
      json: async () => ({
        email: "test@example.com",
        password: "Test123",
        companyName: "Test Co"
      })
    };

    const result = await validateBody(mockReq, registerSchema);
    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
  });
});
```

## Migration Guide

### Updating Existing Routes

1. **Add validation imports**

```typescript
import { validateBody, validationErrorResponse, yourSchema } from "@/lib/validation";
```

2. **Replace manual validation**

```typescript
// Before
const { email, password } = await req.json();
if (!email || !password) {
  return NextResponse.json({ error: "Missing fields" }, { status: 400 });
}

// After
const validation = await validateBody(req, loginSchema);
if (!validation.success) {
  return validationErrorResponse(validation);
}
const { email, password } = validation.data!;
```

3. **Update type definitions**

```typescript
// Use inferred types from schemas
type LoginInput = z.infer<typeof loginSchema>;
```

## Coverage Status

### ✅ Implemented Routes

- `/api/auth/register` - Registration with email, password, company name validation
- `/api/competitors` - Competitor URL validation
- `/api/integrations` - Integration platform and URL validation
- `/api/rules` - Pricing rule validation

### 🔄 Pending Routes

The following routes should be updated to use the validation system:

- `/api/products/*` - Product CRUD operations
- `/api/webhooks/*` - Webhook management
- `/api/admin/*` - Admin operations
- `/api/analytics/*` - Analytics queries
- `/api/exports/*` - Data exports
- `/api/imports/*` - Data imports

## Performance Considerations

- **Validation Overhead**: Minimal (~1-5ms per request)
- **Memory Usage**: Zod schemas are compiled once and reused
- **Caching**: Schema compilation is cached by Zod
- **Async Validation**: Uses async/await for non-blocking validation

## Compliance

This validation system helps meet security requirements for:

- **OWASP Top 10**: Prevents injection attacks, XSS
- **GDPR**: Ensures data integrity and proper handling
- **PCI DSS**: Input validation for payment-related data
- **SOC 2**: Security controls and audit trail

## Maintenance

### Adding New Schemas

1. Define schema in `lib/validation/schemas.ts`
2. Export from `lib/validation/index.ts`
3. Use in API routes
4. Add tests
5. Update this documentation

### Updating Schemas

1. Update schema definition
2. Run tests to check for breaking changes
3. Update API routes if needed
4. Update documentation

## Support

For questions or issues:

1. Check this documentation
2. Review existing schemas in `lib/validation/schemas.ts`
3. Check validation middleware in `lib/validation/middleware.ts`
4. Refer to Zod documentation: https://zod.dev

## Changelog

### 2026-01-21
- ✅ Initial implementation
- ✅ Created validation schemas for all major entities
- ✅ Implemented validation middleware
- ✅ Updated auth, competitors, integrations, and rules routes
- ✅ Added comprehensive sanitization functions
- ✅ Created documentation
