# Input Validation Guide

## Overview

PricePilot uses a comprehensive input validation system to prevent XSS, SQL injection, and other security vulnerabilities. This guide shows you how to use the validation system in your API routes.

## Quick Start

### 1. Import validation utilities

```typescript
import {
  validateBody,
  validateQuery,
  validateParams,
  validationErrorResponse,
} from '@/lib/validation';
import { yourSchema } from '@/lib/validation/schemas';
```

### 2. Validate request data

```typescript
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Validate request body
  const validation = await validateBody(req, yourSchema);

  if (!validation.success) {
    return validationErrorResponse(validation);
  }

  // Use validated data (type-safe!)
  const { field1, field2 } = validation.data!;

  // ... your logic here
}
```

## Validation Methods

### validateBody()

Validates request body against a Zod schema.

```typescript
const validation = await validateBody(req, createProductSchema);

if (!validation.success) {
  return validationErrorResponse(validation);
}

const { name, price, sku } = validation.data!;
```

### validateQuery()

Validates query parameters.

```typescript
const validation = validateQuery(req, searchQuerySchema);

if (!validation.success) {
  return validationErrorResponse(validation);
}

const { page, limit, sortBy } = validation.data!;
```

### validateParams()

Validates path parameters.

```typescript
const validation = validateParams(
  { id: params.id },
  z.object({ id: uuidSchema })
);

if (!validation.success) {
  return validationErrorResponse(validation);
}

const { id } = validation.data!;
```

### withValidation()

Higher-order function that wraps your handler with automatic validation.

```typescript
export const POST = withValidation(
  createProductSchema,
  async (req, validatedData) => {
    // validatedData is already validated and type-safe
    const { name, price, sku } = validatedData;
    
    // ... your logic here
    
    return NextResponse.json({ success: true });
  }
);
```

## Available Schemas

### Authentication
- `registerSchema` - User registration
- `loginSchema` - User login
- `passwordResetRequestSchema` - Password reset request
- `passwordResetSchema` - Password reset
- `changePasswordSchema` - Change password

### Integrations
- `createIntegrationSchema` - Create site integration
- `deleteIntegrationSchema` - Delete integration

### Competitors
- `createCompetitorSchema` - Add competitor
- `updateCompetitorSchema` - Update competitor
- `deleteCompetitorSchema` - Delete competitor
- `manualMatchSchema` - Manual product matching
- `matchApprovalSchema` - Approve/reject match

### Products
- `updateProductSchema` - Update single product
- `bulkUpdateProductsSchema` - Bulk update products
- `bulkPriceUpdateExecutionSchema` - Execute bulk price update

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
- `scraperConfigSchema` - Scraper configuration
- `addUserSchema` - Add user
- `updateUserSchema` - Update user

### Notifications
- `markNotificationReadSchema` - Mark notification as read
- `deleteNotificationSchema` - Delete notification

### Sync
- `syncSiteSchema` - Sync site
- `stopSyncSchema` - Stop sync

### Analytics
- `mergeDuplicatesSchema` - Merge duplicate products

### API Keys
- `createApiKeySchema` - Create API key

### User Preferences
- `updateNotificationPreferencesSchema` - Update notification preferences

## Creating Custom Schemas

### Basic Schema

```typescript
import { z } from 'zod';
import { sanitizedStringSchema, uuidSchema, priceSchema } from '@/lib/validation/schemas';

export const myCustomSchema = z.object({
  name: sanitizedStringSchema, // Automatically sanitizes XSS
  productId: uuidSchema, // Validates UUID format
  price: priceSchema, // Validates price (non-negative, finite)
  description: z.string().trim().max(1000).optional(),
});

export type MyCustomInput = z.infer<typeof myCustomSchema>;
```

### Schema with Custom Validation

```typescript
export const myComplexSchema = z.object({
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
  amount: z.number().positive(),
}).refine(
  (data) => new Date(data.startDate) < new Date(data.endDate),
  { message: 'Start date must be before end date' }
);
```

## Sanitization Functions

### sanitizeHtml()

Removes dangerous HTML content to prevent XSS attacks.

```typescript
import { sanitizeHtml } from '@/lib/validation/middleware';

// Strict mode (default) - strips all HTML
const clean = sanitizeHtml('<script>alert(1)</script>Hello');
// Result: "Hello"

// Basic formatting mode - allows safe tags
const formatted = sanitizeHtml('<p>Hello <strong>World</strong></p>', true);
// Result: "<p>Hello <strong>World</strong></p>"
```

### sanitizeSql()

Removes SQL injection attempts (use only for raw SQL, Prisma handles this automatically).

```typescript
import { sanitizeSql } from '@/lib/validation/middleware';

const clean = sanitizeSql("'; DROP TABLE users; --");
// Result: " DROP TABLE users "
```

## Validation Helpers

### validateFile()

Validates file uploads.

```typescript
import { validateFile } from '@/lib/validation/middleware';

const result = validateFile(file, {
  maxSizeBytes: 5 * 1024 * 1024, // 5MB
  allowedMimeTypes: ['image/jpeg', 'image/png'],
  allowedExtensions: ['.jpg', '.jpeg', '.png'],
});

if (!result.success) {
  return NextResponse.json({ error: result.error }, { status: 400 });
}
```

### validateIpAddress()

Validates IP address format.

```typescript
import { validateIpAddress } from '@/lib/validation/middleware';

const result = validateIpAddress('192.168.1.1');

if (!result.success) {
  return NextResponse.json({ error: result.error }, { status: 400 });
}
```

### validateJson()

Validates JSON string format.

```typescript
import { validateJson } from '@/lib/validation/middleware';

const result = validateJson('{"key": "value"}');

if (!result.success) {
  return NextResponse.json({ error: result.error }, { status: 400 });
}

const data = result.data; // Parsed JSON object
```

### validateDateRange()

Validates date range (start before end, max 1 year).

```typescript
import { validateDateRange } from '@/lib/validation/middleware';

const result = validateDateRange(startDate, endDate);

if (!result.success) {
  return NextResponse.json({ error: result.error }, { status: 400 });
}
```

## Common Validation Patterns

### Pattern 1: Simple POST endpoint

```typescript
import { validateBody, validationErrorResponse, createProductSchema } from '@/lib/validation';

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const validation = await validateBody(req, createProductSchema);

  if (!validation.success) {
    return validationErrorResponse(validation);
  }

  const { name, price, sku } = validation.data!;

  // Create product...
  
  return NextResponse.json({ success: true });
}
```

### Pattern 2: GET endpoint with query params

```typescript
import { validateQuery, validationErrorResponse, searchQuerySchema } from '@/lib/validation';

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const validation = validateQuery(req, searchQuerySchema);

  if (!validation.success) {
    return validationErrorResponse(validation);
  }

  const { page, limit, sortBy, sortOrder } = validation.data!;

  // Fetch data with pagination...
  
  return NextResponse.json({ data, pagination });
}
```

### Pattern 3: DELETE endpoint with ID

```typescript
import { validateQuery, validationErrorResponse, uuidSchema } from '@/lib/validation';
import { z } from 'zod';

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const validation = validateQuery(req, z.object({ id: uuidSchema }));

  if (!validation.success) {
    return validationErrorResponse(validation);
  }

  const { id } = validation.data!;

  // Delete resource...
  
  return NextResponse.json({ success: true });
}
```

### Pattern 4: Using withValidation HOF

```typescript
import { withValidation, createProductSchema } from '@/lib/validation';

export const POST = withValidation(
  createProductSchema,
  async (req, validatedData) => {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { name, price, sku } = validatedData;

    // Create product...
    
    return NextResponse.json({ success: true });
  }
);
```

## Error Responses

### Validation Error Format

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

### Custom Error Response

```typescript
if (!validation.success) {
  return NextResponse.json(
    {
      error: validation.error || 'Validation failed',
      details: validation.errors,
    },
    { status: 400 }
  );
}
```

## Security Best Practices

### 1. Always validate user input

```typescript
// ❌ BAD - No validation
const { email } = await req.json();

// ✅ GOOD - Validated
const validation = await validateBody(req, z.object({ email: emailSchema }));
if (!validation.success) return validationErrorResponse(validation);
const { email } = validation.data!;
```

### 2. Use sanitized schemas for text

```typescript
// ❌ BAD - Raw string
const schema = z.object({
  name: z.string(),
});

// ✅ GOOD - Sanitized string
const schema = z.object({
  name: sanitizedStringSchema, // Removes XSS
});
```

### 3. Validate all input sources

```typescript
// Validate body
const bodyValidation = await validateBody(req, bodySchema);

// Validate query params
const queryValidation = validateQuery(req, querySchema);

// Validate path params
const paramsValidation = validateParams(params, paramsSchema);
```

### 4. Use Prisma for database queries

```typescript
// ❌ BAD - Raw SQL (vulnerable to injection)
await prisma.$queryRaw`SELECT * FROM users WHERE id = ${userId}`;

// ✅ GOOD - Prisma ORM (safe)
await prisma.user.findUnique({ where: { id: userId } });
```

### 5. Sanitize HTML content

```typescript
import { sanitizeHtml } from '@/lib/validation/middleware';

// For plain text fields
const cleanText = sanitizeHtml(userInput); // Strips all HTML

// For rich text fields (if needed)
const cleanHtml = sanitizeHtml(userInput, true); // Allows safe formatting
```

## Testing Validation

### Example Test

```typescript
import { emailSchema } from '@/lib/validation/schemas';

describe('emailSchema', () => {
  it('should accept valid emails', () => {
    expect(() => emailSchema.parse('user@example.com')).not.toThrow();
  });

  it('should reject invalid emails', () => {
    expect(() => emailSchema.parse('not-an-email')).toThrow();
  });

  it('should reject XSS attempts', () => {
    expect(() => emailSchema.parse('<script>alert(1)</script>@example.com')).toThrow();
  });
});
```

## Common Issues

### Issue 1: Validation fails for valid input

**Problem**: Schema is too strict

**Solution**: Check schema definition and adjust constraints

```typescript
// Too strict
const schema = z.object({
  name: z.string().min(10), // Requires 10+ characters
});

// Better
const schema = z.object({
  name: z.string().min(2).max(100), // More reasonable
});
```

### Issue 2: Type errors with validated data

**Problem**: TypeScript doesn't know the type

**Solution**: Use type inference or explicit types

```typescript
// Infer type from schema
export type MyInput = z.infer<typeof mySchema>;

// Use in handler
const { field1, field2 } = validation.data! as MyInput;
```

### Issue 3: Validation is too slow

**Problem**: Complex schema with many refinements

**Solution**: Simplify schema or use async validation

```typescript
// Slow - multiple refinements
const schema = z.object({
  field1: z.string().refine(...),
  field2: z.string().refine(...),
  field3: z.string().refine(...),
});

// Faster - single refinement
const schema = z.object({
  field1: z.string(),
  field2: z.string(),
  field3: z.string(),
}).refine((data) => {
  // Validate all fields at once
  return true;
});
```

## Resources

- [Zod Documentation](https://zod.dev/)
- [DOMPurify Documentation](https://github.com/cure53/DOMPurify)
- [OWASP Input Validation Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html)
- [OWASP XSS Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html)

## Support

For questions or issues with validation:
1. Check this guide
2. Review existing validation schemas in `lib/validation/schemas.ts`
3. Check test examples in `__tests__/lib/validation/input-validation.test.ts`
4. Consult the security team

---

**Last Updated**: January 29, 2026
**Version**: 1.0
