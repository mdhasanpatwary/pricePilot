# Error Message Templates - Usage Examples

This document provides examples of how to use the error message templates system in PricePilot.

## Overview

The error message templates system provides:
- **User-friendly messages**: Clear, non-technical messages for end users
- **Actionable guidance**: Helpful suggestions on how to resolve errors
- **Developer messages**: Technical details for debugging (development only)
- **Message formatting**: Variable substitution for dynamic content
- **Consistency**: Standardized messages across the application

## Basic Usage

### Using Default Messages

All error classes automatically use default messages from the template system:

```typescript
import { ValidationError, NotFoundError, ExternalServiceError } from '@/lib/utils/error-handler';

// Validation error with default message
throw new ValidationError(
  'Invalid product data',
  { 
    price: ['Must be greater than 0'],
    sku: ['SKU is required']
  }
);
// User sees: "The information you provided is invalid. Please check the highlighted fields and try again"

// Not found error with default message
throw new NotFoundError('Product', 'prod-123');
// User sees: "The requested Product could not be found. Please verify the ID and try again..."

// External service error with default message
throw new ExternalServiceError('OpenCart', 'Connection timeout');
// User sees: "Unable to connect to OpenCart. Please check your connection settings and try again"
```

### Custom User Messages

Override the default message when you need specific wording:

```typescript
// Custom user message for validation error
throw new ValidationError(
  'Invalid product data',
  { price: ['Must be positive'] },
  {
    userMessage: 'Please enter a valid price for your product'
  }
);

// Custom user message for external service error
throw new ExternalServiceError(
  'Shopify',
  'API rate limit exceeded',
  {
    userMessage: 'Your Shopify store is temporarily unavailable. Please try again in a few minutes',
    isRetryable: true,
    retryAfter: 300
  }
);
```

## Message Variables

Use message variables to create dynamic, context-aware messages:

```typescript
// NotFoundError automatically formats with resource type
throw new NotFoundError('UserWebsite', 'web-456');
// User sees: "The requested UserWebsite could not be found..."

// ExternalServiceError automatically includes service name
throw new ExternalServiceError('Laravel API', 'Authentication failed');
// User sees: "Unable to connect to Laravel API..."

// Custom variables via messageVariables option
throw new AppError(
  'File upload failed',
  400,
  'FILE_TOO_LARGE',
  {
    messageVariables: {
      maxSize: '10MB',
      actualSize: '15MB'
    }
  }
);
```

## Specific Error Scenarios

### Product Errors

```typescript
import { NotFoundError, ExternalServiceError } from '@/lib/utils/error-handler';

// Product not found
throw new NotFoundError('Product', productId, {
  context: {
    tenantId,
    userId,
    operation: 'getProduct'
  }
});

// Product sync failed
throw new ExternalServiceError(
  'OpenCart',
  'Failed to sync products',
  {
    userMessage: 'Unable to sync products from your website. Please verify your API token is valid',
    isRetryable: true,
    retryAfter: 60,
    context: {
      tenantId,
      operation: 'syncProducts',
      websiteId
    }
  }
);
```

### Website/Integration Errors

```typescript
// Invalid API token
throw new UnauthorizedError(
  'Invalid API token',
  {
    userMessage: 'Your API token is invalid or has expired. Please generate a new token in your website settings',
    context: {
      tenantId,
      websiteId,
      operation: 'validateToken'
    }
  }
);

// Website connection failed
throw new ExternalServiceError(
  website.platform,
  'Connection failed',
  {
    userMessage: 'Unable to connect to your website. Please verify your website URL and API token are correct',
    isRetryable: true,
    retryAfter: 30,
    context: {
      tenantId,
      websiteId,
      operation: 'testConnection'
    }
  }
);
```

### Competitor Scraping Errors

```typescript
// Scraping failed (transient)
throw new ExternalServiceError(
  'Competitor Website',
  'Scraping failed',
  {
    userMessage: 'Unable to retrieve prices from the competitor website. We will retry automatically',
    isRetryable: true,
    retryAfter: 300,
    context: {
      tenantId,
      competitorUrl,
      operation: 'scrapeCompetitor'
    }
  }
);

// Scraping blocked (permanent)
throw new ExternalServiceError(
  'Competitor Website',
  'Access blocked',
  {
    userMessage: 'Access to the competitor website was blocked. This website may have anti-scraping measures. Please contact support',
    isRetryable: false,
    context: {
      tenantId,
      competitorUrl,
      operation: 'scrapeCompetitor'
    }
  }
);
```

### Validation Errors with Field Details

```typescript
import { getFieldValidationMessage } from '@/lib/utils/error-messages';

// Build field errors with template messages
const fields = {
  email: [getFieldValidationMessage('INVALID_EMAIL')],
  password: [getFieldValidationMessage('TOO_SHORT', { min: 8 })],
  price: [
    getFieldValidationMessage('REQUIRED'),
    getFieldValidationMessage('TOO_SMALL', { min: 0 })
  ]
};

throw new ValidationError('Validation failed', fields, {
  context: {
    tenantId,
    operation: 'createProduct'
  }
});
```

## Using Message Templates Directly

For custom scenarios, use the message template functions directly:

```typescript
import { 
  getUserMessage, 
  getDeveloperMessage,
  getErrorMessage,
  formatMessage 
} from '@/lib/utils/error-messages';

// Get user message for an error code
const userMsg = getUserMessage('PRODUCT_NOT_FOUND');
// Returns: "The product you are looking for could not be found. Please check the product ID..."

// Get user message without guidance
const shortMsg = getUserMessage('PRODUCT_NOT_FOUND', undefined, false);
// Returns: "The product you are looking for could not be found"

// Get developer message
const devMsg = getDeveloperMessage('VALIDATION_ERROR');
// Returns: "Input validation failed. Check the fields object for specific errors."

// Get complete error message template
const template = getErrorMessage('EXTERNAL_SERVICE_ERROR', {
  serviceName: 'Shopify'
});
console.log(template.userMessage); // "Unable to connect to Shopify..."
console.log(template.guidance); // "Please check your connection settings..."
console.log(template.developerMessage); // "External API call failed..."

// Format custom message with variables
const msg = formatMessage('Hello {name}, you have {count} items', {
  name: 'John',
  count: 5
});
// Returns: "Hello John, you have 5 items"
```

## Best Practices

### 1. Use Default Messages When Possible

Default messages are carefully crafted to be user-friendly and actionable:

```typescript
// Good: Use default message
throw new NotFoundError('Product', productId);

// Avoid: Custom message that's less helpful
throw new NotFoundError('Product', productId, {
  userMessage: 'Not found'
});
```

### 2. Provide Context

Always include context for better debugging:

```typescript
// Good: Include context
throw new ValidationError('Invalid data', fields, {
  context: {
    tenantId,
    userId,
    operation: 'updateProduct',
    productId
  }
});

// Avoid: No context
throw new ValidationError('Invalid data', fields);
```

### 3. Mark Transient Errors as Retryable

Help the system recover automatically:

```typescript
// Good: Mark network errors as retryable
throw new ExternalServiceError('API', 'Timeout', {
  isRetryable: true,
  retryAfter: 60,
  cause: originalError
});

// Avoid: Not marking retryable errors
throw new ExternalServiceError('API', 'Timeout');
```

### 4. Preserve Error Chains

Always include the original error as cause:

```typescript
try {
  await externalAPI.call();
} catch (error) {
  // Good: Preserve original error
  throw new ExternalServiceError('API', 'Call failed', {
    cause: error,
    isRetryable: true
  });
}
```

### 5. Use Specific Error Types

Choose the most specific error type:

```typescript
// Good: Specific error type
throw new NotFoundError('Product', productId);

// Avoid: Generic error
throw new AppError('Product not found', 404, 'NOT_FOUND');
```

## Testing Error Messages

Test that your error messages are user-friendly:

```typescript
describe('Product Service Errors', () => {
  it('should provide user-friendly message for not found', () => {
    const error = new NotFoundError('Product', '123');
    
    expect(error.userMessage).not.toContain('database');
    expect(error.userMessage).not.toContain('query');
    expect(error.userMessage).toContain('Product');
  });

  it('should include actionable guidance', () => {
    const error = new ValidationError('Failed', { price: ['Invalid'] });
    
    expect(error.userMessage.toLowerCase()).toMatch(/please|try|check/);
  });
});
```

## Adding New Error Messages

To add new specific error messages, edit `lib/utils/error-messages.ts`:

```typescript
export const SPECIFIC_MESSAGES = {
  // ... existing messages ...
  
  // Add your new message
  MY_NEW_ERROR: {
    userMessage: 'Clear, non-technical description of what went wrong',
    guidance: 'Actionable steps the user can take to resolve this',
  },
} as const;
```

Then use it in your code:

```typescript
throw new AppError(
  'Technical error description',
  500,
  'MY_NEW_ERROR',
  {
    context: { /* ... */ }
  }
);
```

## Environment-Specific Behavior

Developer messages are only included in development mode:

```typescript
// In development
const error = new ValidationError('Failed', fields);
console.log(error.developerMessage);
// Output: "Input validation failed. Check the fields object for specific errors."

// In production
const error = new ValidationError('Failed', fields);
console.log(error.developerMessage);
// Output: "Input validation failed. Check the fields object for specific errors."
// Note: Developer message is available but not sent to client in API responses
```

The global error handler controls whether developer messages are sent to clients based on the environment.
