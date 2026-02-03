# Task 2.1: Error Capture Service Implementation - Complete

## Summary

Successfully implemented a comprehensive error capture service with Sentry integration for the monitoring and alerting system.

## Implementation Details

### Files Created

1. **lib/services/monitoring/error-capture.ts**
   - Complete ErrorCaptureService implementation
   - Sentry integration with graceful degradation
   - Context extraction (userId, tenantId, requestId, endpoint)
   - Comprehensive sensitive data sanitization
   - Error grouping and frequency tracking

2. **__tests__/lib/services/monitoring/error-capture.test.ts**
   - Unit tests for error capture functionality
   - Tests for sensitive data sanitization
   - Tests for graceful degradation
   - Tests for context extraction

## Key Features Implemented

### 1. Sentry Integration (Requirement 1.1)
- Captures errors and sends to Sentry when available
- Includes full error context and stack traces
- Configurable via environment variables (SENTRY_DSN, SENTRY_ENABLED)

### 2. Context Extraction (Requirement 1.2)
- Extracts userId, tenantId, requestId, endpoint from requests
- Adds method, statusCode, and additional data
- Helper function `extractErrorContext()` for Next.js requests

### 3. Sensitive Data Sanitization (Requirement 1.3)
- Sanitizes passwords, tokens, API keys
- Redacts credit card numbers with pattern `[REDACTED_CARD]`
- Redacts SSN with pattern `[REDACTED_SSN]`
- Sanitizes nested objects and arrays
- Comprehensive list of sensitive field names

### 4. Error Grouping (Requirement 1.4)
- Generates fingerprints for error grouping
- Tracks error frequency in memory cache
- Groups similar errors together
- Sends frequency data to Sentry

### 5. Graceful Degradation (Requirement 1.5)
- Falls back to local logging when Sentry unavailable
- Continues operation even if Sentry fails
- Logs errors with full context locally
- No application disruption on monitoring failures

## API

### ErrorCaptureService

```typescript
interface ErrorCaptureMiddleware {
    captureError(error: Error, context: ErrorContext): Promise<void>;
    captureException(exception: unknown, context: ErrorContext): Promise<void>;
    setUserContext(userId: string, tenantId: string): void;
}
```

### ErrorContext

```typescript
interface ErrorContext {
    userId?: string;
    tenantId?: string;
    requestId: string;
    endpoint: string;
    method: string;
    statusCode?: number;
    additionalData?: Record<string, any>;
}
```

### Usage Example

```typescript
import { defaultErrorCaptureService, extractErrorContext } from '@/lib/services/monitoring/error-capture';

// In an API route
try {
    // Your code
} catch (error) {
    const context = extractErrorContext(req, error as Error);
    await defaultErrorCaptureService.captureError(error as Error, context);
    throw error;
}

// Set user context
defaultErrorCaptureService.setUserContext('user-123', 'tenant-456');
```

## Sensitive Data Patterns

The service sanitizes the following patterns:
- **Passwords**: password, passwd, pwd
- **Tokens**: token, jwt, bearer, authorization
- **API Keys**: api_key, apikey, api_secret
- **Credit Cards**: 16-digit card numbers (with or without separators)
- **CVV**: cvv, cvc, security_code
- **SSN**: 9-digit SSN (with or without separators)

## Configuration

Environment variables:
- `SENTRY_DSN`: Sentry project DSN
- `SENTRY_ENABLED`: Enable/disable Sentry (default: true)
- `SENTRY_ENVIRONMENT`: Environment name (development, production, etc.)
- `SENTRY_RELEASE`: Release version
- `SENTRY_TRACES_SAMPLE_RATE`: Performance monitoring sample rate

## Testing

Unit tests cover:
- ✅ Error capture with local logging
- ✅ Credit card sanitization
- ✅ SSN sanitization
- ✅ Sensitive field sanitization
- ✅ Error frequency tracking
- ✅ Exception handling (Error and non-Error types)
- ✅ User context setting
- ✅ Graceful degradation
- ✅ Context extraction from requests

## Integration with Existing Code

The service integrates with:
- Existing Sentry configuration (sentry.server.config.ts, sentry.client.config.ts)
- Existing logger (lib/logger.ts)
- Existing error handling (lib/middleware/global-error-handler.ts)

## Next Steps

Optional tasks (marked with * in tasks.md):
- 2.2: Property test for error capture completeness
- 2.3: Property test for sensitive data sanitization
- 2.4: Additional unit tests for edge cases

These optional tasks can be completed later if needed for additional test coverage.

## Requirements Satisfied

- ✅ Requirement 1.1: Capture error details and send to Sentry
- ✅ Requirement 1.2: Include context data (user ID, tenant ID, request details, stack trace)
- ✅ Requirement 1.3: Exclude sensitive data (passwords, API tokens, credit card numbers)
- ✅ Requirement 1.4: Track error frequency and group similar errors
- ✅ Requirement 1.5: Log errors locally when Sentry is unavailable

## Status

✅ **COMPLETE** - Core implementation finished and ready for use
