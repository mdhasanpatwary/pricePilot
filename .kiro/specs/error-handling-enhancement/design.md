# Design Document: Error Handling Enhancement

## Overview

The Error Handling Enhancement feature establishes a comprehensive, standardized error handling system for PricePilot. This design provides a hierarchical error class structure, centralized error logging with context, security-focused sanitization, and consistent error responses across all API endpoints and service layers.

The system is built around a base `AppError` class that extends the native JavaScript `Error` class, with specialized subclasses for common error scenarios. Each error captures rich context (tenantId, userId, operation, timestamp) and provides both user-friendly messages for end users and detailed technical information for developers.

Key design principles:
- **Security First**: Automatic sanitization of sensitive data in error messages and logs
- **User Experience**: Clear, actionable error messages without technical jargon
- **Developer Experience**: Rich context and stack traces for debugging
- **Consistency**: Standardized error format across all services and APIs
- **Backward Compatibility**: Works with existing error handling code

## Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        API Layer                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │         Global Error Handler Middleware              │  │
│  │  - Catches all errors                                │  │
│  │  - Transforms to HTTP responses                      │  │
│  │  - Logs with context                                 │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                      Service Layer                           │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │  Sync    │  │ Scraper  │  │  Rules   │  │ Matching │   │
│  │ Service  │  │ Service  │  │  Engine  │  │ Service  │   │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘   │
│       ↓              ↓              ↓              ↓        │
│  Throws AppError subclasses with context                    │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                   Error Handler Core                         │
│  ┌──────────────────────────────────────────────────────┐  │
│  │              Error Class Hierarchy                   │  │
│  │  - AppError (base)                                   │  │
│  │  - ValidationError, NotFoundError, etc.              │  │
│  │  - Context capture                                   │  │
│  │  - Message formatting                                │  │
│  └──────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │              Error Sanitizer                         │  │
│  │  - Redacts sensitive data                            │  │
│  │  - Pattern matching for tokens/passwords             │  │
│  └──────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │              Error Logger                            │  │
│  │  - Integrates with lib/logger.ts                     │  │
│  │  - Structured logging with context                   │  │
│  │  - Different levels by severity                      │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### Error Flow

1. **Error Occurs**: Service layer operation fails
2. **Error Creation**: Service throws appropriate AppError subclass with context
3. **Error Propagation**: Error bubbles up to API layer
4. **Error Handling**: Global middleware catches error
5. **Error Sanitization**: Sensitive data is redacted
6. **Error Logging**: Full context logged to system
7. **Error Response**: Standardized JSON response sent to client

## Components and Interfaces

### 1. Error Class Hierarchy

#### Base AppError Class

```typescript
interface ErrorContext {
  tenantId?: string;
  userId?: string;
  operation?: string;
  requestId?: string;
  timestamp: string;
  metadata?: Record<string, any>;
}

interface ErrorOptions {
  userMessage?: string;
  developerMessage?: string;
  context?: Partial<ErrorContext>;
  cause?: Error;
  isRetryable?: boolean;
  retryAfter?: number;
}

class AppError extends Error {
  public readonly statusCode: number;
  public readonly errorCode: string;
  public readonly userMessage: string;
  public readonly developerMessage?: string;
  public readonly context: ErrorContext;
  public readonly cause?: Error;
  public readonly isRetryable: boolean;
  public readonly retryAfter?: number;

  constructor(
    message: string,
    statusCode: number,
    errorCode: string,
    options?: ErrorOptions
  );

  // Serialize error for API response
  toJSON(): ErrorResponse;
  
  // Serialize error for logging (with sanitization)
  toLogFormat(): LogEntry;
}
```

#### Specialized Error Classes

```typescript
class ValidationError extends AppError {
  public readonly fields: Record<string, string[]>;
  
  constructor(
    message: string,
    fields: Record<string, string[]>,
    options?: ErrorOptions
  );
}

class NotFoundError extends AppError {
  public readonly resourceType: string;
  public readonly resourceId: string;
  
  constructor(
    resourceType: string,
    resourceId: string,
    options?: ErrorOptions
  );
}

class UnauthorizedError extends AppError {
  constructor(message?: string, options?: ErrorOptions);
}

class ForbiddenError extends AppError {
  public readonly requiredPermission?: string;
  
  constructor(
    message?: string,
    requiredPermission?: string,
    options?: ErrorOptions
  );
}

class ConflictError extends AppError {
  public readonly conflictingResource?: string;
  
  constructor(
    message: string,
    conflictingResource?: string,
    options?: ErrorOptions
  );
}

class RateLimitError extends AppError {
  public readonly limit: number;
  public readonly windowSeconds: number;
  
  constructor(
    limit: number,
    windowSeconds: number,
    options?: ErrorOptions
  );
}

class ExternalServiceError extends AppError {
  public readonly serviceName: string;
  public readonly serviceStatusCode?: number;
  
  constructor(
    serviceName: string,
    message: string,
    options?: ErrorOptions & { serviceStatusCode?: number }
  );
}
```

### 2. Error Sanitizer

```typescript
interface SanitizationRule {
  pattern: RegExp;
  replacement: string;
}

class ErrorSanitizer {
  private readonly sensitivePatterns: SanitizationRule[];
  
  constructor();
  
  // Sanitize error message
  sanitizeMessage(message: string): string;
  
  // Sanitize error context
  sanitizeContext(context: ErrorContext): ErrorContext;
  
  // Sanitize entire error object
  sanitizeError(error: AppError): AppError;
  
  // Check if field name is sensitive
  isSensitiveField(fieldName: string): boolean;
  
  // Add custom sanitization rule
  addRule(pattern: RegExp, replacement: string): void;
}
```

**Default Sensitive Patterns**:
- API tokens: `token`, `apiKey`, `api_key`, `apiToken`, `api_token`
- Credentials: `password`, `secret`, `credential`, `auth`
- Encryption: `encrypted`, `cipher`, `privateKey`, `private_key`
- Database: `connectionString`, `connection_string`, `dbUrl`, `db_url`
- Patterns: `/Bearer\s+[\w-]+/gi`, `/sk_[a-zA-Z0-9]+/gi`, `/pk_[a-zA-Z0-9]+/gi`

### 3. Error Logger

```typescript
interface LogEntry {
  level: 'error' | 'warn' | 'info';
  message: string;
  errorCode: string;
  statusCode: number;
  context: ErrorContext;
  stack?: string;
  cause?: any;
  timestamp: string;
}

class ErrorLogger {
  private readonly logger: Logger; // from lib/logger.ts
  private readonly sanitizer: ErrorSanitizer;
  
  constructor(logger: Logger, sanitizer: ErrorSanitizer);
  
  // Log error with appropriate level
  logError(error: AppError): void;
  
  // Determine log level based on error type
  private getLogLevel(error: AppError): 'error' | 'warn' | 'info';
  
  // Format error for structured logging
  private formatLogEntry(error: AppError): LogEntry;
}
```

**Log Level Mapping**:
- `ERROR`: UnauthorizedError, ForbiddenError, ExternalServiceError, unexpected errors
- `WARN`: ValidationError, NotFoundError, ConflictError, RateLimitError
- `INFO`: Retryable errors that succeed on retry

### 4. Global Error Handler Middleware

```typescript
interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: any;
  };
  meta: {
    requestId: string;
    timestamp: string;
  };
}

class GlobalErrorHandler {
  private readonly errorLogger: ErrorLogger;
  private readonly sanitizer: ErrorSanitizer;
  private readonly isDevelopment: boolean;
  
  constructor(
    errorLogger: ErrorLogger,
    sanitizer: ErrorSanitizer,
    isDevelopment: boolean
  );
  
  // Express/Next.js error handler middleware
  handleError(
    error: Error,
    req: Request,
    res: Response,
    next: NextFunction
  ): void;
  
  // Transform error to API response
  private toErrorResponse(error: AppError, requestId: string): ErrorResponse;
  
  // Wrap non-AppError errors
  private wrapError(error: Error): AppError;
}
```

### 5. Service Layer Integration

Each service will use a consistent pattern for error handling:

```typescript
class SyncService {
  async syncProducts(websiteId: string, tenantId: string): Promise<Product[]> {
    try {
      // Validate input
      if (!websiteId) {
        throw new ValidationError(
          'Invalid sync request',
          { websiteId: ['Website ID is required'] },
          { context: { tenantId, operation: 'syncProducts' } }
        );
      }
      
      // Check if website exists
      const website = await this.getWebsite(websiteId);
      if (!website) {
        throw new NotFoundError(
          'UserWebsite',
          websiteId,
          { context: { tenantId, operation: 'syncProducts' } }
        );
      }
      
      // Call external API
      try {
        const products = await this.fetchProductsFromWebsite(website);
        return products;
      } catch (error) {
        throw new ExternalServiceError(
          website.platform,
          'Failed to fetch products from website',
          {
            cause: error,
            context: { tenantId, operation: 'syncProducts', websiteId },
            isRetryable: this.isRetryableError(error)
          }
        );
      }
    } catch (error) {
      // If already an AppError, re-throw
      if (error instanceof AppError) {
        throw error;
      }
      
      // Wrap unexpected errors
      throw new AppError(
        'Unexpected error during product sync',
        500,
        'SYNC_ERROR',
        {
          cause: error,
          context: { tenantId, operation: 'syncProducts', websiteId }
        }
      );
    }
  }
}
```

### 6. Backward Compatibility Layer

```typescript
// Wrapper for existing error classes
class EncryptionErrorAdapter extends AppError {
  constructor(originalError: EncryptionError) {
    super(
      originalError.message,
      500,
      'ENCRYPTION_ERROR',
      {
        cause: originalError,
        context: { operation: 'encryption' }
      }
    );
  }
}

// Enhanced withErrorHandling wrapper
function withErrorHandling<T>(
  fn: (...args: any[]) => Promise<T>,
  context?: Partial<ErrorContext>
): (...args: any[]) => Promise<T> {
  return async (...args: any[]): Promise<T> => {
    try {
      return await fn(...args);
    } catch (error) {
      // If already an AppError, add context and re-throw
      if (error instanceof AppError) {
        error.context = { ...error.context, ...context };
        throw error;
      }
      
      // Wrap other errors
      throw new AppError(
        error.message || 'An unexpected error occurred',
        500,
        'INTERNAL_ERROR',
        {
          cause: error,
          context: { ...context, operation: fn.name }
        }
      );
    }
  };
}
```

## Data Models

### Error Response Format

```typescript
// Success Response (for reference)
interface SuccessResponse<T> {
  success: true;
  data: T;
  meta: {
    requestId: string;
    timestamp: string;
  };
}

// Error Response
interface ErrorResponse {
  success: false;
  error: {
    code: string;           // Machine-readable error code (e.g., "VALIDATION_ERROR")
    message: string;        // User-friendly message
    details?: any;          // Additional error details (e.g., validation fields)
  };
  meta: {
    requestId: string;      // Unique request identifier for tracking
    timestamp: string;      // ISO8601 timestamp
  };
}

// Validation Error Response (specific case)
interface ValidationErrorResponse extends ErrorResponse {
  error: {
    code: 'VALIDATION_ERROR';
    message: string;
    details: {
      fields: Record<string, string[]>;  // Field name -> array of error messages
    };
  };
}

// Example responses:
// 1. Validation Error
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "The provided data is invalid",
    "details": {
      "fields": {
        "email": ["Invalid email format"],
        "price": ["Must be greater than 0", "Must be a number"]
      }
    }
  },
  "meta": {
    "requestId": "req_abc123",
    "timestamp": "2024-01-15T10:30:00Z"
  }
}

// 2. Not Found Error
{
  "success": false,
  "error": {
    "code": "NOT_FOUND",
    "message": "The requested product could not be found",
    "details": {
      "resourceType": "Product",
      "resourceId": "prod_123"
    }
  },
  "meta": {
    "requestId": "req_def456",
    "timestamp": "2024-01-15T10:31:00Z"
  }
}

// 3. External Service Error
{
  "success": false,
  "error": {
    "code": "EXTERNAL_SERVICE_ERROR",
    "message": "Unable to connect to your website. Please check your API token and try again.",
    "details": {
      "serviceName": "OpenCart",
      "isRetryable": true,
      "retryAfter": 60
    }
  },
  "meta": {
    "requestId": "req_ghi789",
    "timestamp": "2024-01-15T10:32:00Z"
  }
}
```

### Error Code Mapping

| Error Class | Error Code | HTTP Status | User Message Template |
|-------------|------------|-------------|----------------------|
| ValidationError | VALIDATION_ERROR | 422 | "The provided data is invalid" |
| NotFoundError | NOT_FOUND | 404 | "The requested {resourceType} could not be found" |
| UnauthorizedError | UNAUTHORIZED | 401 | "Authentication is required to access this resource" |
| ForbiddenError | FORBIDDEN | 403 | "You don't have permission to access this resource" |
| ConflictError | CONFLICT | 409 | "This operation conflicts with an existing resource" |
| RateLimitError | RATE_LIMIT_EXCEEDED | 429 | "Too many requests. Please try again later" |
| ExternalServiceError | EXTERNAL_SERVICE_ERROR | 502 | "Unable to connect to external service" |
| AppError (generic) | INTERNAL_ERROR | 500 | "An unexpected error occurred" |

### Log Entry Format

```typescript
interface LogEntry {
  level: 'error' | 'warn' | 'info';
  message: string;
  errorCode: string;
  statusCode: number;
  context: {
    tenantId?: string;
    userId?: string;
    operation?: string;
    requestId?: string;
    timestamp: string;
    metadata?: Record<string, any>;
  };
  stack?: string;           // Stack trace (sanitized)
  cause?: {                 // Original error if wrapped
    message: string;
    stack?: string;
  };
  timestamp: string;
  environment: 'development' | 'production';
}

// Example log entry:
{
  "level": "error",
  "message": "Failed to sync products from OpenCart website",
  "errorCode": "EXTERNAL_SERVICE_ERROR",
  "statusCode": 502,
  "context": {
    "tenantId": "tenant_123",
    "userId": "user_456",
    "operation": "syncProducts",
    "requestId": "req_abc123",
    "timestamp": "2024-01-15T10:30:00Z",
    "metadata": {
      "websiteId": "website_789",
      "platform": "OpenCart"
    }
  },
  "stack": "ExternalServiceError: Failed to fetch products...",
  "cause": {
    "message": "ECONNREFUSED",
    "stack": "Error: connect ECONNREFUSED..."
  },
  "timestamp": "2024-01-15T10:30:00Z",
  "environment": "production"
}
```

## Correctness Properties


*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property Reflection

After analyzing all acceptance criteria, I identified several areas where properties can be consolidated:

**Consolidation 1**: Requirements 2.1-2.7 (context field capture) can be combined into a single property about context preservation.

**Consolidation 2**: Requirements 4.1-4.4 (sensitive data redaction) can be combined into a single property about sanitization patterns.

**Consolidation 3**: Requirements 5.1-5.6 (log entry fields) can be combined into a single property about log completeness.

**Consolidation 4**: Requirements 6.1-6.4 (service error wrapping) can be combined into a single property about error type consistency.

**Consolidation 5**: Requirements 7.3-7.9 (specific HTTP status codes) are examples that validate the general property 7.2.

**Consolidation 6**: Requirements 9.1-9.3 (specific retryable errors) can be combined into a single property about retry metadata.

### Properties

**Property 1: Error Context Preservation**
*For any* error created with context fields (tenantId, userId, operation, requestId, metadata), all provided context fields should be accessible from the error instance and preserved through serialization.
**Validates: Requirements 1.9, 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8**

**Property 2: Error Type to Status Code Mapping**
*For any* error class (ValidationError, NotFoundError, UnauthorizedError, etc.), the error instance should have the correct HTTP status code assigned (422, 404, 401, etc.).
**Validates: Requirements 1.10, 7.2**

**Property 3: Sensitive Data Sanitization**
*For any* error containing sensitive data patterns (API tokens, passwords, credentials, connection strings), the sanitized output should have all sensitive values redacted with a placeholder.
**Validates: Requirements 3.3, 4.1, 4.2, 4.3, 4.4**

**Property 4: User Message Non-Technical**
*For any* error with a user message, the message should not contain technical details such as file paths, stack traces, database queries, or internal variable names.
**Validates: Requirements 3.1, 3.4**

**Property 5: Default User Messages**
*For any* standard error type (ValidationError, NotFoundError, etc.), creating an error without a custom user message should result in a non-empty default user message.
**Validates: Requirements 3.5**

**Property 6: Custom User Message Override**
*For any* error created with a custom user message, the error's userMessage property should match the provided custom message.
**Validates: Requirements 3.6**

**Property 7: ValidationError Field Details**
*For any* ValidationError instance, the error should contain a fields object with field names as keys and arrays of error messages as values.
**Validates: Requirements 3.7**

**Property 8: Environment-Based Developer Message Inclusion**
*For any* error serialized to an API response, developer messages should be included if and only if the environment is development mode.
**Validates: Requirements 4.6, 4.7**

**Property 9: Security Error Audit Logging**
*For any* security-related error (UnauthorizedError, ForbiddenError), the error should be logged with an audit trail marker.
**Validates: Requirements 4.8**

**Property 10: Log Entry Completeness**
*For any* error logged by the ErrorLogger, the log entry should contain all required fields: level, message, errorCode, statusCode, context, timestamp, and environment.
**Validates: Requirements 5.1, 5.2, 5.3, 5.4, 5.5, 5.6**

**Property 11: Error Type to Log Level Mapping**
*For any* error type, the log level should match the severity mapping: ERROR for critical errors (Unauthorized, Forbidden, ExternalService), WARN for user errors (Validation, NotFound, Conflict, RateLimit).
**Validates: Requirements 5.7**

**Property 12: Original Error Preservation**
*For any* error created with a cause, the cause should be accessible from the error instance and included in the log format (sanitized).
**Validates: Requirements 5.10, 6.9**

**Property 13: Service Error Type Consistency**
*For any* error thrown by service layer methods, the error should be an instance of AppError or one of its subclasses.
**Validates: Requirements 6.1, 6.2, 6.3, 6.4**

**Property 14: Service Operation Context**
*For any* error thrown by a service method, the error context should include the operation name.
**Validates: Requirements 6.8**

**Property 15: Standardized Error Response Format**
*For any* error converted to an API response, the response should have the structure: { success: false, error: { code, message, details? }, meta: { requestId, timestamp } }.
**Validates: Requirements 7.1**

**Property 16: Unique Error Codes**
*For any* error type, the error code should be unique and consistent across all instances of that type.
**Validates: Requirements 7.10**

**Property 17: Request ID in Error Responses**
*For any* error response, the meta object should contain a non-empty requestId.
**Validates: Requirements 7.11**

**Property 18: Error Logging Before Response**
*For any* error handled by the global error handler, the error should be logged before the response is sent.
**Validates: Requirements 7.12**

**Property 19: Backward Compatibility with Existing Errors**
*For any* existing error type (EncryptionError, DecryptionError, ScrapeBlockError), the error should be processable by the new error handling system and wrapped appropriately.
**Validates: Requirements 8.1, 8.2, 8.3, 8.4, 8.5**

**Property 20: Retry Metadata Consistency**
*For any* error marked as retryable, the error should have isRetryable set to true and optionally include a retryAfter value; for non-retryable errors, isRetryable should be false.
**Validates: Requirements 9.1, 9.2, 9.3, 9.4, 9.5, 9.6**

## Error Handling

The error handling system is designed to handle errors gracefully at multiple levels:

### Error Creation Failures

If error creation itself fails (e.g., invalid parameters):
- Fall back to a generic AppError with minimal context
- Log the failure to create the error
- Ensure the system never crashes due to error handling

### Circular Error Handling

To prevent infinite loops in error handling:
- Error handler catches its own errors
- Falls back to simple console logging if logger fails
- Uses try-catch blocks around all error processing

### Missing Context

When required context is unavailable:
- Use default values (e.g., "unknown" for operation)
- Log warning about missing context
- Continue processing with partial context

### Sanitization Failures

If sanitization fails:
- Log the sanitization failure
- Use a generic redacted message
- Never expose the original unsanitized data

### Logger Failures

If the logger is unavailable or fails:
- Fall back to console.error
- Include minimal error information
- Ensure error is still recorded somewhere

### Example Error Handling in Error Handler

```typescript
class GlobalErrorHandler {
  handleError(error: Error, req: Request, res: Response): void {
    try {
      // Wrap non-AppError errors
      const appError = error instanceof AppError 
        ? error 
        : this.wrapError(error);
      
      // Add request context if missing
      if (!appError.context.requestId && req.id) {
        appError.context.requestId = req.id;
      }
      
      // Log error (with fallback)
      try {
        this.errorLogger.logError(appError);
      } catch (logError) {
        console.error('Failed to log error:', logError);
        console.error('Original error:', appError);
      }
      
      // Send response (with fallback)
      try {
        const response = this.toErrorResponse(appError, req.id);
        res.status(appError.statusCode).json(response);
      } catch (responseError) {
        console.error('Failed to send error response:', responseError);
        res.status(500).json({
          success: false,
          error: {
            code: 'INTERNAL_ERROR',
            message: 'An unexpected error occurred'
          },
          meta: {
            requestId: req.id || 'unknown',
            timestamp: new Date().toISOString()
          }
        });
      }
    } catch (handlerError) {
      // Last resort fallback
      console.error('Critical error in error handler:', handlerError);
      console.error('Original error:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'An unexpected error occurred'
        },
        meta: {
          requestId: 'unknown',
          timestamp: new Date().toISOString()
        }
      });
    }
  }
}
```

## Testing Strategy

### Dual Testing Approach

The error handling system requires both unit tests and property-based tests:

**Unit Tests** focus on:
- Specific error class instantiation
- Error message formatting for known inputs
- HTTP status code mapping for each error type
- Sanitization of specific sensitive patterns
- Integration with existing error classes
- Edge cases (null context, empty messages, etc.)

**Property-Based Tests** focus on:
- Context preservation across all error types
- Sanitization effectiveness for generated sensitive data
- Error serialization round-trip consistency
- Log entry completeness for any error
- Response format consistency for any error type

### Property-Based Testing Configuration

**Library**: fast-check (for TypeScript/JavaScript)

**Configuration**:
- Minimum 100 iterations per property test
- Custom generators for error instances with random context
- Custom generators for sensitive data patterns
- Shrinking enabled to find minimal failing cases

**Test Tagging**:
Each property test must include a comment referencing the design property:
```typescript
// Feature: error-handling-enhancement, Property 1: Error Context Preservation
test('error context preservation', () => {
  fc.assert(
    fc.property(errorWithContextGenerator, (error) => {
      // Test that all context fields are preserved
    }),
    { numRuns: 100 }
  );
});
```

### Unit Test Coverage

**Error Class Tests**:
- Test each error class constructor
- Test default values
- Test custom messages
- Test inheritance chain
- Test toJSON() serialization
- Test toLogFormat() serialization

**Sanitizer Tests**:
- Test each sensitive pattern (API tokens, passwords, etc.)
- Test nested object sanitization
- Test array sanitization
- Test edge cases (null, undefined, circular references)

**Logger Tests**:
- Test log level determination
- Test log entry formatting
- Test integration with lib/logger.ts
- Test error vs warn vs info levels

**Global Handler Tests**:
- Test error wrapping
- Test response formatting
- Test status code setting
- Test development vs production mode

**Service Integration Tests**:
- Test SyncService error handling
- Test ScraperService error handling
- Test RulesEngine error handling
- Test MatchingService error handling

### Property-Based Test Examples

**Property 1: Context Preservation**
```typescript
// Generate random error context
const contextGenerator = fc.record({
  tenantId: fc.option(fc.uuid()),
  userId: fc.option(fc.uuid()),
  operation: fc.option(fc.string()),
  requestId: fc.option(fc.uuid()),
  metadata: fc.option(fc.dictionary(fc.string(), fc.anything()))
});

// Test that context is preserved
fc.assert(
  fc.property(contextGenerator, (context) => {
    const error = new AppError('Test', 500, 'TEST', { context });
    expect(error.context.tenantId).toBe(context.tenantId);
    expect(error.context.userId).toBe(context.userId);
    // ... check all fields
  }),
  { numRuns: 100 }
);
```

**Property 3: Sensitive Data Sanitization**
```typescript
// Generate strings with sensitive patterns
const sensitiveDataGenerator = fc.oneof(
  fc.string().map(s => `Bearer ${s}`),
  fc.string().map(s => `password: ${s}`),
  fc.string().map(s => `apiToken: ${s}`),
  fc.string().map(s => `sk_${s}`)
);

// Test that sensitive data is redacted
fc.assert(
  fc.property(sensitiveDataGenerator, (sensitiveData) => {
    const sanitizer = new ErrorSanitizer();
    const sanitized = sanitizer.sanitizeMessage(sensitiveData);
    expect(sanitized).not.toContain(sensitiveData);
    expect(sanitized).toContain('[REDACTED]');
  }),
  { numRuns: 100 }
);
```

### Integration Testing

**API Endpoint Tests**:
- Test error responses from actual API endpoints
- Test that errors are logged correctly
- Test that status codes are correct
- Test that sensitive data is not exposed

**Service Layer Tests**:
- Test that services throw correct error types
- Test that context is included
- Test that original errors are preserved as causes

### Test Organization

```
__tests__/
  lib/
    utils/
      error-handler.test.ts          # Unit tests for error classes
      error-handler.properties.test.ts # Property-based tests
      error-sanitizer.test.ts        # Unit tests for sanitizer
      error-sanitizer.properties.test.ts # Property-based tests
      error-logger.test.ts           # Unit tests for logger
      global-error-handler.test.ts   # Unit tests for middleware
    services/
      sync.error-handling.test.ts    # Service integration tests
      scraper.error-handling.test.ts
      rules-engine.error-handling.test.ts
      matching.error-handling.test.ts
  api/
    error-responses.test.ts          # API integration tests
```

### Test Execution

All tests should be run as part of the CI/CD pipeline:
```bash
# Run all tests
npm test

# Run only unit tests
npm test -- --testPathPattern="\.test\.ts$"

# Run only property tests
npm test -- --testPathPattern="\.properties\.test\.ts$"

# Run with coverage
npm test -- --coverage
```

### Success Criteria

- All unit tests pass
- All property-based tests pass (100 iterations each)
- Code coverage > 90% for error handling code
- No sensitive data exposed in any test scenario
- All services properly integrated with new error handling
