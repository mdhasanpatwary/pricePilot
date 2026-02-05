---
title: "Error Handling Guide"
description: "Guide to error handling and recovery"
category: "system-monitoring"
tags: ["errors", "handling", "monitoring"]
audience: "admin"
relatedDocs: ["/docs/troubleshooting/error-handling-guide.md"]
---

# Error Handling Guide

## Overview

PricePilot uses a comprehensive, standardized error handling system that provides:
- **Security First**: Automatic sanitization of sensitive data
- **User Experience**: Clear, actionable error messages
- **Developer Experience**: Rich context and stack traces for debugging
- **Consistency**: Standardized error format across all services and APIs
- **Backward Compatibility**: Works with existing error handling code

## Quick Start

### Basic Usage

```typescript
import { ValidationError, NotFoundError } from '@/lib/utils/error-handler';

// Throw a validation error
throw new ValidationError(
  'Invalid product data',
  { 
    sku: ['SKU is required'],
    price: ['Price must be greater than 0']
  }
);

// Throw a not found error
throw new NotFoundError('Product', productId, {
  context: { tenantId, operation: 'getProduct' }
});
```

### In API Routes

```typescript
import { GlobalErrorHandler } from '@/lib/middleware/global-error-handler';

// Errors are automatically caught and formatted
export async function GET(req: Request) {
  // Your code - just throw AppError subclasses
  const product = await getProduct(id);
  if (!product) {
    throw new NotFoundError('Product', id);
  }
  return Response.json({ success: true, data: product });
}
```

## Error Class Hierarchy

### Base Class: AppError

All application errors extend `AppError`:

```typescript
class AppError extends Error {
  statusCode: number;        // HTTP status code
  errorCode: string;         // Machine-readable code
  userMessage: string;       // User-friendly message
  developerMessage?: string; // Technical details (dev only)
  context: ErrorContext;     // Rich metadata
  cause?: Error;             // Original error if wrapped
  isRetryable: boolean;      // Can this be retried?
  retryAfter?: number;       // Retry delay in seconds
}
```

### Specialized Error Classes

#### ValidationError (422)

For input validation failures:

```typescript
throw new ValidationError(
  'Invalid input data',
  {
    email: ['Invalid email format'],
    price: ['Must be greater than 0', 'Must be a number']
  },
  {
    context: { tenantId, operation: 'createProduct' }
  }
);
```

#### NotFoundError (404)

For missing resources:

```typescript
throw new NotFoundError(
  'Product',           // Resource type
  productId,           // Resource ID
  {
    context: { tenantId, operation: 'getProduct' }
  }
);
```

#### UnauthorizedError (401)

For authentication failures:

```typescript
throw new UnauthorizedError(
  'Invalid API token',
  {
    context: { operation: 'authenticate' }
  }
);
```

#### ForbiddenError (403)

For authorization failures:

```typescript
throw new ForbiddenError(
  'Insufficient permissions',
  'admin',  // Required permission
  {
    context: { userId, tenantId, operation: 'deleteProduct' }
  }
);
```

#### ConflictError (409)

For resource conflicts:

```typescript
throw new ConflictError(
  'Product with this SKU already exists',
  'Product:SKU-123',  // Conflicting resource
  {
    context: { tenantId, operation: 'createProduct' }
  }
);
```

#### RateLimitError (429)

For rate limiting violations:

```typescript
throw new RateLimitError(
  100,    // Limit
  3600,   // Window in seconds
  {
    context: { userId, operation: 'scrapeCompetitor' },
    retryAfter: 3600
  }
);
```

#### ExternalServiceError (502)

For third-party API failures:

```typescript
throw new ExternalServiceError(
  'OpenCart',  // Service name
  'Failed to fetch products from website',
  {
    cause: originalError,
    context: { tenantId, websiteId, operation: 'syncProducts' },
    isRetryable: true,
    serviceStatusCode: 503
  }
);
```

## Error Context

All errors capture rich context for debugging:

```typescript
interface ErrorContext {
  tenantId?: string;      // Multi-tenant isolation
  userId?: string;        // User who triggered error
  operation?: string;     // Function/operation name
  requestId?: string;     // Request tracking ID
  timestamp: string;      // ISO8601 timestamp
  metadata?: Record<string, any>;  // Custom data
}
```

### Adding Context

```typescript
throw new NotFoundError('Product', id, {
  context: {
    tenantId: 'tenant_123',
    userId: 'user_456',
    operation: 'getProduct',
    requestId: req.id,
    metadata: {
      websiteId: 'website_789',
      sku: 'PROD-001'
    }
  }
});
```

## Service Layer Integration

### Pattern for Service Methods

```typescript
class ProductService {
  async getProduct(id: string, tenantId: string): Promise<Product> {
    try {
      // Validate input
      if (!id) {
        throw new ValidationError(
          'Invalid request',
          { id: ['Product ID is required'] },
          { context: { tenantId, operation: 'getProduct' } }
        );
      }
      
      // Fetch resource
      const product = await prisma.product.findUnique({
        where: { id, tenantId }
      });
      
      if (!product) {
        throw new NotFoundError('Product', id, {
          context: { tenantId, operation: 'getProduct' }
        });
      }
      
      return product;
    } catch (error) {
      // Re-throw AppErrors
      if (error instanceof AppError) {
        throw error;
      }
      
      // Wrap unexpected errors
      throw new AppError(
        'Unexpected error fetching product',
        500,
        'INTERNAL_ERROR',
        {
          cause: error,
          context: { tenantId, operation: 'getProduct', productId: id }
        }
      );
    }
  }
}
```

### External API Calls

```typescript
async function fetchFromExternalAPI(url: string): Promise<Data> {
  try {
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new ExternalServiceError(
        'ExternalAPI',
        `API returned ${response.status}`,
        {
          serviceStatusCode: response.status,
          isRetryable: response.status >= 500,
          context: { operation: 'fetchFromExternalAPI', url }
        }
      );
    }
    
    return await response.json();
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    
    // Network errors are retryable
    throw new ExternalServiceError(
      'ExternalAPI',
      'Network request failed',
      {
        cause: error,
        isRetryable: true,
        context: { operation: 'fetchFromExternalAPI', url }
      }
    );
  }
}
```

## API Error Responses

### Response Format

All API errors follow this format:

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "User-friendly message",
    "details": {
      // Additional context (e.g., validation fields)
    }
  },
  "meta": {
    "requestId": "req_abc123",
    "timestamp": "2024-01-15T10:30:00Z"
  }
}
```

### Validation Error Response

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "The provided data is invalid",
    "details": {
      "fields": {
        "email": ["Invalid email format"],
        "price": ["Must be greater than 0"]
      }
    }
  },
  "meta": {
    "requestId": "req_abc123",
    "timestamp": "2024-01-15T10:30:00Z"
  }
}
```

### HTTP Status Code Mapping

| Error Class | Error Code | HTTP Status |
|-------------|------------|-------------|
| ValidationError | VALIDATION_ERROR | 422 |
| NotFoundError | NOT_FOUND | 404 |
| UnauthorizedError | UNAUTHORIZED | 401 |
| ForbiddenError | FORBIDDEN | 403 |
| ConflictError | CONFLICT | 409 |
| RateLimitError | RATE_LIMIT_EXCEEDED | 429 |
| ExternalServiceError | EXTERNAL_SERVICE_ERROR | 502 |
| AppError (generic) | INTERNAL_ERROR | 500 |

## Security and Sanitization

### Automatic Sanitization

The error system automatically redacts sensitive data:

```typescript
// Before sanitization
const error = new AppError('Failed to connect', 500, 'CONNECTION_ERROR', {
  context: {
    metadata: {
      apiToken: 'sk_live_abc123',
      password: 'secret123',
      connectionString: 'postgresql://user:pass@host/db'
    }
  }
});

// After sanitization (in logs and responses)
{
  "metadata": {
    "apiToken": "[REDACTED]",
    "password": "[REDACTED]",
    "connectionString": "[REDACTED]"
  }
}
```

### Sensitive Patterns

Automatically redacted:
- API tokens: `token`, `apiKey`, `apiToken`
- Credentials: `password`, `secret`, `credential`
- Encryption: `encrypted`, `cipher`, `privateKey`
- Database: `connectionString`, `dbUrl`
- Patterns: `Bearer ...`, `sk_...`, `pk_...`

### Development vs Production

**Development Mode**:
- Includes developer messages in responses
- Shows full stack traces
- Logs detailed error information

**Production Mode**:
- Only user-friendly messages in responses
- No stack traces exposed
- Sanitized logs only

## Error Logging

### Automatic Logging

All errors are automatically logged with:
- Error type and message
- Full stack trace (sanitized)
- Error context (tenantId, userId, operation)
- Request details (if available)
- Original error (if wrapped)

### Log Levels

| Error Type | Log Level |
|------------|-----------|
| UnauthorizedError | ERROR |
| ForbiddenError | ERROR |
| ExternalServiceError | ERROR |
| Unexpected errors | ERROR |
| ValidationError | WARN |
| NotFoundError | WARN |
| ConflictError | WARN |
| RateLimitError | WARN |

### Security Audit Logging

Security-related errors are automatically logged to the audit trail:
- UnauthorizedError
- ForbiddenError

Audit logs include:
- IP address
- User agent
- Timestamp
- User ID (if available)

## Retry Logic

### Retryable Errors

Some errors are marked as retryable:

```typescript
const error = new ExternalServiceError(
  'OpenCart',
  'Service temporarily unavailable',
  {
    isRetryable: true,
    retryAfter: 60  // Retry after 60 seconds
  }
);
```

### Checking Retry Status

```typescript
if (error.isRetryable) {
  const delay = error.retryAfter || 60;
  await sleep(delay * 1000);
  return retry();
}
```

### Retryable Error Types

- Network timeouts
- 5xx errors from external services
- Rate limit errors (with backoff)
- Temporary service unavailability

## Backward Compatibility

### Existing Error Classes

The system maintains compatibility with existing errors:

```typescript
// Old error classes still work
import { EncryptionError } from '@/lib/services/encryption/errors';

try {
  await encrypt(data);
} catch (error) {
  // Automatically wrapped and processed
  if (error instanceof EncryptionError) {
    // Handled by new system
  }
}
```

### withErrorHandling Wrapper

Enhanced wrapper for gradual migration:

```typescript
import { withErrorHandling } from '@/lib/error-api';

const safeFunction = withErrorHandling(
  async (data) => {
    // Your code
  },
  { operation: 'processData' }
);
```

## Common Scenarios

### Scenario 1: API Endpoint with Validation

```typescript
export async function POST(req: Request) {
  const body = await req.json();
  
  // Validate input
  const errors: Record<string, string[]> = {};
  if (!body.name) errors.name = ['Name is required'];
  if (!body.price || body.price <= 0) {
    errors.price = ['Price must be greater than 0'];
  }
  
  if (Object.keys(errors).length > 0) {
    throw new ValidationError('Invalid product data', errors);
  }
  
  // Process request
  const product = await createProduct(body);
  return Response.json({ success: true, data: product });
}
```

### Scenario 2: Service with External API

```typescript
class SyncService {
  async syncProducts(websiteId: string, tenantId: string) {
    const website = await this.getWebsite(websiteId);
    if (!website) {
      throw new NotFoundError('UserWebsite', websiteId, {
        context: { tenantId, operation: 'syncProducts' }
      });
    }
    
    try {
      const products = await this.fetchFromWebsite(website);
      return products;
    } catch (error) {
      throw new ExternalServiceError(
        website.platform,
        'Failed to fetch products',
        {
          cause: error,
          isRetryable: true,
          context: { tenantId, websiteId, operation: 'syncProducts' }
        }
      );
    }
  }
}
```

### Scenario 3: Authorization Check

```typescript
async function deleteProduct(id: string, userId: string) {
  const user = await getUser(userId);
  
  if (user.role !== 'admin') {
    throw new ForbiddenError(
      'Only administrators can delete products',
      'admin',
      { context: { userId, operation: 'deleteProduct' } }
    );
  }
  
  await prisma.product.delete({ where: { id } });
}
```

### Scenario 4: Rate Limiting

```typescript
async function scrapeCompetitor(url: string, userId: string) {
  const rateLimitKey = `scrape:${userId}`;
  const count = await redis.incr(rateLimitKey);
  
  if (count > 10) {
    throw new RateLimitError(10, 60, {
      context: { userId, operation: 'scrapeCompetitor' },
      retryAfter: 60
    });
  }
  
  await redis.expire(rateLimitKey, 60);
  return await scrape(url);
}
```

## Best Practices

### 1. Always Include Context

```typescript
// Good
throw new NotFoundError('Product', id, {
  context: { tenantId, userId, operation: 'getProduct' }
});

// Bad
throw new NotFoundError('Product', id);
```

### 2. Preserve Original Errors

```typescript
// Good
try {
  await externalAPI();
} catch (error) {
  throw new ExternalServiceError('API', 'Failed', {
    cause: error  // Preserve original
  });
}

// Bad
try {
  await externalAPI();
} catch (error) {
  throw new ExternalServiceError('API', 'Failed');
}
```

### 3. Use Specific Error Classes

```typescript
// Good
throw new ValidationError('Invalid input', { email: ['Invalid format'] });

// Bad
throw new AppError('Invalid input', 422, 'VALIDATION_ERROR');
```

### 4. Provide User-Friendly Messages

```typescript
// Good
throw new ExternalServiceError(
  'OpenCart',
  'Unable to connect to your website. Please check your API token.',
  { userMessage: 'Connection failed. Please verify your settings.' }
);

// Bad
throw new ExternalServiceError(
  'OpenCart',
  'ECONNREFUSED 127.0.0.1:3000'
);
```

### 5. Mark Transient Errors as Retryable

```typescript
// Good
throw new ExternalServiceError('API', 'Timeout', {
  isRetryable: true,
  retryAfter: 30
});

// Bad
throw new ExternalServiceError('API', 'Timeout');
```

## Testing

### Unit Testing Errors

```typescript
import { ValidationError } from '@/lib/utils/error-handler';

test('throws validation error for invalid input', () => {
  expect(() => {
    validateProduct({ price: -10 });
  }).toThrow(ValidationError);
});

test('validation error includes field details', () => {
  try {
    validateProduct({ price: -10 });
  } catch (error) {
    expect(error).toBeInstanceOf(ValidationError);
    expect(error.fields).toHaveProperty('price');
  }
});
```

### Testing API Error Responses

```typescript
test('returns 422 for validation errors', async () => {
  const response = await POST(
    new Request('http://localhost/api/products', {
      method: 'POST',
      body: JSON.stringify({ price: -10 })
    })
  );
  
  expect(response.status).toBe(422);
  const body = await response.json();
  expect(body.success).toBe(false);
  expect(body.error.code).toBe('VALIDATION_ERROR');
});
```

## Troubleshooting

### Error Not Being Caught

Ensure you're throwing AppError subclasses:
```typescript
// This will be caught
throw new NotFoundError('Product', id);

// This won't be handled properly
throw new Error('Not found');
```

### Sensitive Data Still Visible

Check field names match sensitive patterns:
```typescript
// Will be redacted
{ apiToken: 'secret' }
{ password: 'secret' }

// Won't be redacted (use correct field names)
{ token: 'secret' }  // Use 'apiToken' instead
```

### Missing Context in Logs

Always provide context when creating errors:
```typescript
throw new NotFoundError('Product', id, {
  context: { tenantId, operation: 'getProduct' }
});
```

## Migration Guide

### Migrating from Old Error Handling

1. **Replace generic throws**:
```typescript
// Before
throw new Error('Product not found');

// After
throw new NotFoundError('Product', id);
```

2. **Add context to errors**:
```typescript
// Before
throw new NotFoundError('Product', id);

// After
throw new NotFoundError('Product', id, {
  context: { tenantId, operation: 'getProduct' }
});
```

3. **Wrap external API calls**:
```typescript
// Before
const data = await fetch(url);

// After
try {
  const data = await fetch(url);
} catch (error) {
  throw new ExternalServiceError('API', 'Failed', {
    cause: error,
    isRetryable: true
  });
}
```

## Reference

### Error Class Reference

See [lib/utils/error-handler.ts](../lib/utils/error-handler.ts) for complete implementation.

### Middleware Reference

See [lib/middleware/global-error-handler.ts](../lib/middleware/global-error-handler.ts) for API integration.

### Sanitizer Reference

See [lib/utils/error-sanitizer.ts](../lib/utils/error-sanitizer.ts) for sanitization rules.

### Logger Reference

See [lib/utils/error-logger.ts](../lib/utils/error-logger.ts) for logging implementation.
