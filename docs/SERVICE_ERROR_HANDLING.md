# Service Error Handling Documentation

## Overview

This document describes how error handling is implemented in PricePilot's service layer. All services follow consistent patterns for error handling, validation, and context preservation.

## Services Covered

- **SyncService**: Product synchronization with external platforms
- **ScraperService**: Competitor website scraping
- **RulesEngine**: Pricing rules evaluation
- **MatchingService**: Product matching algorithms

## Common Patterns

### 1. Input Validation

All service methods validate inputs before processing:

```typescript
// Validate required parameters
if (!tenantId || typeof tenantId !== 'string' || tenantId.trim() === '') {
  throw new ValidationError(
    'Invalid request',
    { tenantId: ['Tenant ID is required and must be a valid string'] },
    { context: { operation: 'methodName' } }
  );
}
```

### 2. Resource Existence Checks

Services verify resources exist before operating on them:

```typescript
const resource = await prisma.resource.findUnique({ where: { id } });

if (!resource) {
  throw new NotFoundError(
    'Resource',
    id,
    { context: { tenantId, operation: 'methodName' } }
  );
}
```

### 3. External API Calls

External service calls are wrapped with proper error handling:

```typescript
try {
  const response = await externalAPI.call();
} catch (error) {
  throw new ExternalServiceError(
    'ServiceName',
    'Failed to connect to external service',
    {
      cause: error,
      serviceStatusCode: error.response?.status,
      isRetryable: error.response?.status >= 500,
      context: {
        tenantId,
        operation: 'methodName',
        metadata: { url, additionalContext }
      }
    }
  );
}
```

### 4. Error Context Preservation

All errors include rich context for debugging:

```typescript
throw new AppError(
  'Error message',
  statusCode,
  'ERROR_CODE',
  {
    cause: originalError,
    context: {
      tenantId,
      userId,
      operation: 'methodName',
      metadata: {
        // Additional context specific to the operation
      }
    }
  }
);
```

### 5. Unexpected Error Wrapping

Unexpected errors are wrapped before re-throwing:

```typescript
try {
  // Service logic
} catch (error) {
  // Re-throw AppErrors with additional context
  if (error instanceof AppError) {
    error.context.tenantId = error.context.tenantId || tenantId;
    error.context.operation = error.context.operation || 'methodName';
    throw error;
  }
  
  // Wrap unexpected errors
  throw new AppError(
    'Unexpected error during operation',
    500,
    'INTERNAL_ERROR',
    {
      cause: error as Error,
      context: { tenantId, operation: 'methodName' }
    }
  );
}
```

## SyncService Error Handling

### Purpose
Handles product synchronization between PricePilot and external e-commerce platforms (OpenCart, Laravel, Shopify, WooCommerce, Magento).

### Error Scenarios

#### 1. Invalid Input
```typescript
// Missing or invalid site ID
throw new ValidationError(
  'Invalid sync request',
  { siteId: ['Site ID is required and must be a valid string'] },
  { context: { operation: 'syncSite' } }
);
```

#### 2. Site Not Found
```typescript
// Site doesn't exist in database
throw new NotFoundError(
  'Site',
  siteId,
  { context: { operation: 'syncSite' } }
);
```

#### 3. Token Decryption Failure
```typescript
// Failed to decrypt API token
throw new ExternalServiceError(
  platform,
  'Failed to decrypt API token',
  {
    cause: error,
    context: {
      tenantId,
      operation: 'syncSite',
      metadata: { siteId, baseUrl }
    },
    userMessage: 'Failed to decrypt API token. Please re-enter your token in settings.'
  }
);
```

#### 4. Unsupported Platform
```typescript
// Platform not supported
throw new ValidationError(
  'Unsupported platform',
  { platform: [`Platform ${platform} is not supported`] },
  {
    context: {
      tenantId,
      operation: 'syncSite',
      metadata: { siteId, platform }
    }
  }
);
```

#### 5. External API Failure
```typescript
// Failed to fetch products from external platform
throw new ExternalServiceError(
  platform,
  `Failed to fetch products from ${platform}`,
  {
    cause: error,
    context: {
      tenantId,
      operation: 'syncSite',
      metadata: { siteId, platform, baseUrl }
    },
    isRetryable: isRetryableError(error),
    userMessage: `Unable to fetch products from your ${platform} store. Please check your API token and try again.`
  }
);
```

### Methods

#### `syncSite(siteId: string)`
Synchronizes products from an external platform.

**Throws:**
- `ValidationError`: Invalid site ID or unsupported platform
- `NotFoundError`: Site not found
- `ExternalServiceError`: API connection failures, token decryption failures

**Context Included:**
- `tenantId`: Tenant identifier
- `operation`: 'syncSite'
- `metadata`: { siteId, platform, baseUrl }

#### `syncProductsToStore(siteId: string)`
Pushes price updates back to external platform.

**Throws:**
- `ValidationError`: Invalid site ID
- `NotFoundError`: Site not found
- `ExternalServiceError`: API connection failures, token decryption failures

**Context Included:**
- `tenantId`: Tenant identifier
- `operation`: 'syncProductsToStore'
- `metadata`: { siteId, baseUrl }

## ScraperService Error Handling

### Purpose
Handles web scraping of competitor websites with retry logic, proxy rotation, and challenge handling.

### Error Scenarios

#### 1. Invalid URL
```typescript
// Malformed product URL
throw new ExternalServiceError(
  'Unknown',
  'Invalid product URL provided',
  {
    cause: error,
    context: {
      operation: 'scrapeProductPage',
      metadata: { url }
    },
    isRetryable: false
  }
);
```

#### 2. Network Errors
```typescript
// Network timeout, connection refused, etc.
throw new ExternalServiceError(
  'Scraper',
  'Failed to scrape product page',
  {
    cause: error,
    context: {
      operation: 'scrapeProductPage',
      metadata: { url, hostname }
    },
    isRetryable: true // Network errors are retryable
  }
);
```

#### 3. Scraping Blocked
```typescript
// Website blocking automated requests
throw new ExternalServiceError(
  provider,
  `Scraping blocked by ${provider}`,
  {
    cause: originalError,
    context: {
      operation: 'scrapeProductPage',
      metadata: { url, provider, isAdvanced }
    },
    isRetryable: !isAdvanced, // Only retry simple blocks
    retryAfter: 300 // 5 minutes
  }
);
```

#### 4. Rate Limiting
```typescript
// HTTP 429 rate limit response
throw new RateLimitError(
  limit,
  windowSeconds,
  {
    context: {
      operation: 'scrapeProductPage',
      metadata: { url, hostname }
    },
    retryAfter: retryAfterSeconds
  }
);
```

### Methods

#### `scrapeProductPage(url: string)`
Scrapes a single product page with retry logic.

**Throws:**
- `ExternalServiceError`: Invalid URL, network errors, scraping blocked
- `RateLimitError`: Rate limit exceeded

**Context Included:**
- `operation`: 'scrapeProductPage'
- `metadata`: { url, hostname, provider }

**Retry Behavior:**
- Network errors: Retryable with exponential backoff
- Rate limits: Retryable after specified delay
- Advanced blocking: Not retryable

#### `scrapeProductPageWithTracking(url, tenantId, siteId, productId, tenantName?)`
Scrapes with session tracking for monitoring.

**Throws:**
- Same as `scrapeProductPage`
- Additional context includes `tenantId`

**Context Included:**
- `tenantId`: Tenant identifier
- `operation`: 'scrapeProductPageWithTracking'
- `metadata`: { url, hostname }

## RulesEngine Error Handling

### Purpose
Evaluates pricing rules and calculates price adjustments.

### Error Scenarios

#### 1. Invalid Rule Configuration
```typescript
// Rule has invalid configuration
throw new ValidationError(
  'Invalid rule configuration',
  { rule: ['Rule configuration is invalid'] },
  {
    context: {
      tenantId,
      operation: 'evaluateRule',
      metadata: { ruleId }
    }
  }
);
```

#### 2. Product Not Found
```typescript
// Product referenced in rule doesn't exist
throw new NotFoundError(
  'Product',
  productId,
  {
    context: {
      tenantId,
      operation: 'evaluateRule',
      metadata: { ruleId }
    }
  }
);
```

### Methods

#### `evaluateRule(ruleId: string, tenantId: string)`
Evaluates a pricing rule for products.

**Throws:**
- `ValidationError`: Invalid rule configuration
- `NotFoundError`: Product not found

**Context Included:**
- `tenantId`: Tenant identifier
- `operation`: 'evaluateRule'
- `metadata`: { ruleId, productId }

## MatchingService Error Handling

### Purpose
Matches user products with competitor products using SKU, brand/model, and semantic similarity.

### Error Scenarios

#### 1. Invalid Tenant ID
```typescript
// Missing or invalid tenant ID
throw new ValidationError(
  'Invalid matching request',
  { tenantId: ['Tenant ID is required and must be a valid string'] },
  { context: { operation: 'runMatching' } }
);
```

#### 2. Invalid User Product
```typescript
// User product missing required fields
throw new ValidationError(
  'Invalid user product for matching',
  { userProduct: ['User product must have a valid ID'] },
  {
    context: {
      tenantId,
      operation: 'findBestMatch',
      metadata: { userProductId }
    }
  }
);
```

#### 3. Invalid Competitor Products
```typescript
// Competitor products not an array
throw new ValidationError(
  'Invalid competitor products list',
  { competitorProducts: ['Competitor products must be an array'] },
  {
    context: {
      tenantId,
      operation: 'findBestMatch',
      metadata: { userProductId }
    }
  }
);
```

#### 4. Product Not Found
```typescript
// Product doesn't exist when creating match
throw new NotFoundError(
  'Product',
  productId,
  {
    context: {
      tenantId,
      operation: 'createMatch',
      metadata: { productType: 'user' }
    }
  }
);
```

### Methods

#### `runMatching(tenantId: string)`
Runs matching for all unmatched products.

**Throws:**
- `ValidationError`: Invalid tenant ID
- `AppError`: Unexpected errors during matching

**Context Included:**
- `tenantId`: Tenant identifier
- `operation`: 'runMatching'

#### `findBestMatch(userProduct, competitorProducts, tenantId)`
Finds the best match for a user product.

**Throws:**
- `ValidationError`: Invalid product data
- `AppError`: Unexpected errors during matching

**Context Included:**
- `tenantId`: Tenant identifier
- `operation`: 'findBestMatch'
- `metadata`: { userProductId }

#### `createMatch(userId, competitorId, type, score, tenantId)`
Creates a product match record.

**Throws:**
- `ValidationError`: Invalid product IDs
- `NotFoundError`: Product not found
- `AppError`: Unexpected errors during creation

**Context Included:**
- `tenantId`: Tenant identifier
- `operation`: 'createMatch'
- `metadata`: { userProductId, competitorProductId }

## Error Context Reference

### Standard Context Fields

All service errors include these context fields:

| Field | Type | Description |
|-------|------|-------------|
| `tenantId` | string | Tenant identifier for multi-tenant isolation |
| `userId` | string | User who triggered the operation (if available) |
| `operation` | string | Method or function name |
| `requestId` | string | Request tracking ID (if available) |
| `timestamp` | string | ISO8601 timestamp |
| `metadata` | object | Operation-specific additional context |

### Service-Specific Metadata

#### SyncService
- `siteId`: Site identifier
- `platform`: Platform name (OpenCart, Laravel, etc.)
- `baseUrl`: Site base URL
- `statusCode`: HTTP status code (for API errors)

#### ScraperService
- `url`: Product URL being scraped
- `hostname`: Website hostname
- `provider`: Website provider name
- `isAdvanced`: Whether advanced blocking detected

#### RulesEngine
- `ruleId`: Pricing rule identifier
- `productId`: Product identifier

#### MatchingService
- `userProductId`: User product identifier
- `competitorProductId`: Competitor product identifier
- `productType`: 'user' or 'competitor'

## Best Practices

### 1. Always Validate Input
Validate all inputs at the start of service methods before any processing.

### 2. Check Resource Existence
Verify resources exist before operating on them to provide clear error messages.

### 3. Preserve Original Errors
Always include the original error as `cause` when wrapping errors.

### 4. Include Rich Context
Add operation name, tenant ID, and relevant metadata to all errors.

### 5. Mark Retryable Errors
Set `isRetryable: true` for transient failures (network errors, rate limits).

### 6. Provide User-Friendly Messages
Include clear, actionable `userMessage` for errors that users will see.

### 7. Use Specific Error Classes
Use the most specific error class (ValidationError, NotFoundError, etc.) rather than generic AppError.

## Testing Service Error Handling

### Unit Tests

Test that services throw correct error types:

```typescript
test('throws ValidationError for invalid input', async () => {
  await expect(
    SyncService.syncSite('')
  ).rejects.toThrow(ValidationError);
});

test('throws NotFoundError for missing resource', async () => {
  await expect(
    SyncService.syncSite('nonexistent-id')
  ).rejects.toThrow(NotFoundError);
});
```

### Integration Tests

Test error handling across service boundaries:

```typescript
test('API returns 422 for validation errors', async () => {
  const response = await POST('/api/sync', { siteId: '' });
  expect(response.status).toBe(422);
  expect(response.body.error.code).toBe('VALIDATION_ERROR');
});
```

## Migration Notes

### From Old Error Handling

If migrating from old error handling patterns:

1. Replace generic `throw new Error()` with specific error classes
2. Add context to all errors
3. Wrap external API calls with ExternalServiceError
4. Mark transient errors as retryable
5. Preserve original errors as cause

### Backward Compatibility

The error handling system maintains compatibility with existing error classes:
- `EncryptionError` → Wrapped in `ExternalServiceError`
- `DecryptionError` → Wrapped in `ExternalServiceError`
- `ScrapeBlockError` → Wrapped in `ExternalServiceError`

## See Also

- [Error Handling Guide](./ERROR_HANDLING_GUIDE.md) - Complete error handling documentation
- [API Design Standards](../api-design-standards.md) - API error response format
- [Security Requirements](../security-requirements.md) - Security considerations
