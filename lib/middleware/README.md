# Middleware Documentation

## Global Error Handler

The Global Error Handler provides centralized error handling for all Next.js API routes with standardized error responses, automatic logging, and security features.

### Features

- **Standardized Error Responses**: Consistent JSON format across all endpoints
- **Automatic Error Logging**: All errors are logged with full context and sanitization
- **Development vs Production Mode**: Detailed error info in dev, sanitized in production
- **Request ID Tracking**: Every error response includes a unique request ID
- **HTTP Status Code Mapping**: Automatic status codes based on error type
- **Security**: Sensitive data is automatically redacted from logs and responses

### Usage

#### Method 1: Using `withGlobalErrorHandler` (Recommended)

This is the recommended approach for new API routes:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { withGlobalErrorHandler } from '@/lib/middleware/global-error-handler';
import { ValidationError, NotFoundError } from '@/lib/utils/error-handler';

export async function GET(req: NextRequest) {
  return withGlobalErrorHandler(req, async (req) => {
    // Your handler logic here
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    
    if (!id) {
      throw new ValidationError(
        'Invalid request',
        { id: ['ID is required'] }
      );
    }
    
    const item = await findItem(id);
    
    if (!item) {
      throw new NotFoundError('Item', id);
    }
    
    return NextResponse.json({ success: true, data: item });
  });
}
```

#### Method 2: Using `withErrorHandling` (For existing patterns)

This method is compatible with existing middleware patterns like `withRateLimit`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { withRateLimit } from '@/lib/middleware/ratelimit';
import { withErrorHandling } from '@/lib/middleware/global-error-handler';
import { ValidationError } from '@/lib/utils/error-handler';

async function handleGET(req: NextRequest) {
  // Your handler logic here
  const data = await fetchData();
  return NextResponse.json({ success: true, data });
}

export async function GET(req: NextRequest) {
  // Combine with rate limiting
  return withRateLimit(req, 'read', withErrorHandling(handleGET));
}
```

### Error Types

Use the appropriate error class for different scenarios:

```typescript
import {
  ValidationError,      // 422 - Invalid input
  NotFoundError,        // 404 - Resource not found
  UnauthorizedError,    // 401 - Authentication required
  ForbiddenError,       // 403 - Insufficient permissions
  ConflictError,        // 409 - Resource conflict
  RateLimitError,       // 429 - Too many requests
  ExternalServiceError, // 502 - External API failure
  AppError,             // 500 - Generic error
} from '@/lib/utils/error-handler';

// Validation error with field details
throw new ValidationError(
  'Invalid product data',
  {
    price: ['Must be greater than 0'],
    sku: ['SKU is required']
  },
  {
    context: { tenantId, operation: 'createProduct' }
  }
);

// Not found error
throw new NotFoundError(
  'Product',
  productId,
  {
    context: { tenantId, operation: 'getProduct' }
  }
);

// External service error with retry metadata
throw new ExternalServiceError(
  'OpenCart',
  'Failed to sync products',
  {
    isRetryable: true,
    retryAfter: 60,
    context: { tenantId, websiteId }
  }
);
```

### Error Response Format

All errors return a standardized format:

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid product data",
    "details": {
      "fields": {
        "price": ["Must be greater than 0"],
        "sku": ["SKU is required"]
      }
    }
  },
  "meta": {
    "requestId": "550e8400-e29b-41d4-a716-446655440000",
    "timestamp": "2024-01-15T10:30:00.000Z"
  }
}
```

### Development vs Production

**Development Mode** (NODE_ENV !== 'production'):
- Includes `developerMessage` with technical details
- Includes stack traces in error responses
- More verbose logging

**Production Mode**:
- User-friendly messages only
- No stack traces or internal details
- Sensitive data automatically redacted

### Context and Metadata

Always include context when throwing errors:

```typescript
throw new AppError(
  'Failed to process request',
  500,
  'PROCESSING_ERROR',
  {
    context: {
      tenantId: session.user.tenantId,
      userId: session.user.id,
      operation: 'processPayment',
      requestId: req.headers.get('x-request-id'),
      metadata: {
        amount: 100,
        currency: 'USD'
      }
    },
    cause: originalError, // Preserve original error
    isRetryable: true,
    retryAfter: 30
  }
);
```

### Migration Guide

To migrate existing API routes:

1. **Import the error handler**:
   ```typescript
   import { withGlobalErrorHandler } from '@/lib/middleware/global-error-handler';
   ```

2. **Replace manual error handling**:
   ```typescript
   // Before
   export async function GET(req: NextRequest) {
     try {
       const data = await fetchData();
       return NextResponse.json({ data });
     } catch (error) {
       console.error('Error:', error);
       return NextResponse.json(
         { error: 'Failed to fetch data' },
         { status: 500 }
       );
     }
   }
   
   // After
   export async function GET(req: NextRequest) {
     return withGlobalErrorHandler(req, async (req) => {
       const data = await fetchData();
       return NextResponse.json({ success: true, data });
     });
   }
   ```

3. **Use specific error types**:
   ```typescript
   // Before
   if (!id) {
     return NextResponse.json(
       { error: 'ID is required' },
       { status: 400 }
     );
   }
   
   // After
   if (!id) {
     throw new ValidationError(
       'Invalid request',
       { id: ['ID is required'] }
     );
   }
   ```

### Best Practices

1. **Always use specific error types** instead of generic AppError
2. **Include context** (tenantId, userId, operation) in all errors
3. **Preserve original errors** using the `cause` option
4. **Mark transient errors as retryable** with appropriate retry delays
5. **Use user-friendly messages** that don't expose internal details
6. **Test error responses** to ensure proper status codes and format

### Testing

Test error handling in your API routes:

```typescript
import { GET } from './route';
import { NextRequest } from 'next/server';

describe('API Error Handling', () => {
  it('should return 422 for validation errors', async () => {
    const req = new NextRequest('http://localhost/api/test');
    const response = await GET(req);
    
    expect(response.status).toBe(422);
    const data = await response.json();
    expect(data.success).toBe(false);
    expect(data.error.code).toBe('VALIDATION_ERROR');
    expect(data.meta.requestId).toBeDefined();
  });
});
```

### Troubleshooting

**Error not being caught?**
- Ensure you're using `withGlobalErrorHandler` or `withErrorHandling`
- Check that errors are thrown, not returned
- Verify async/await is used correctly

**Sensitive data in logs?**
- The sanitizer automatically redacts common patterns
- Add custom patterns if needed (see ErrorSanitizer docs)

**Wrong status code?**
- Use the correct error class (ValidationError, NotFoundError, etc.)
- Check the error class hierarchy

**Missing request ID?**
- Request IDs are automatically generated
- Can be provided via `x-request-id` header
- Always included in error responses

## Query Timing Middleware

The Query Timing Middleware automatically captures query execution times and logs slow queries for performance monitoring.

### Features

- **Automatic Slow Query Detection**: Logs queries exceeding 1000ms threshold
- **Non-Blocking Logging**: Asynchronous logging doesn't impact response times
- **Tenant Context Extraction**: Automatically extracts tenant ID from queries
- **Integration with QueryAnalyzer**: Seamlessly integrates with performance monitoring

### Usage

The middleware is automatically applied to the optimized Prisma client:

```typescript
import { optimizedPrisma } from '@/lib/database/optimized-prisma';

// Middleware is already applied - just use the client
const products = await optimizedPrisma.userProduct.findMany({
  where: { tenantId: 'tenant-123' }
});
```

### Manual Application

To apply to a custom Prisma client:

```typescript
import { PrismaClient } from '@prisma/client';
import { applyQueryTimingMiddleware } from '@/lib/middleware/query-timing';

const prisma = new PrismaClient();
applyQueryTimingMiddleware(prisma);
```

### Configuration

The slow query threshold is configured in `lib/database/optimization-constants.ts`:

```typescript
export const SLOW_QUERY_THRESHOLD_MS = 1000; // 1 second
```

### Monitoring

View slow queries through the admin dashboard:

```
GET /api/v1/admin/performance/slow-queries
```

Or query directly:

```typescript
import { getQueryAnalyzer } from '@/lib/services/query-analyzer';
import { prisma } from '@/lib/prisma';

const analyzer = getQueryAnalyzer(prisma);
const slowQueries = await analyzer.getTopSlowQueries(20, {
  start: new Date('2024-01-01'),
  end: new Date('2024-01-31')
});
```

### Daily Aggregation

Run the aggregation script daily via cron:

```bash
# Aggregate yesterday's metrics
ts-node scripts/aggregate-query-metrics.ts

# Aggregate specific date
ts-node scripts/aggregate-query-metrics.ts 2024-01-15
```

Recommended cron schedule (3 AM UTC):

```cron
0 3 * * * cd /path/to/app && ts-node scripts/aggregate-query-metrics.ts
```

## Rate Limiting

See `ratelimit.ts` for rate limiting middleware documentation.
