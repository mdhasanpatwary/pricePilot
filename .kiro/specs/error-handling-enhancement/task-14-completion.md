# Task 14 Completion: Security Error Audit Logging

## Summary

Successfully implemented security error audit logging functionality that automatically logs UnauthorizedError and ForbiddenError instances to the audit trail with IP address and user agent information.

## Implementation Details

### 1. Updated ErrorLogger (`lib/utils/error-logger.ts`)

**Changes:**
- Added imports for `UnauthorizedError`, `ForbiddenError`, and `recordAuditLog`
- Updated `logError()` method signature to accept optional request information (IP and user agent)
- Added `isSecurityError()` private method to detect security-related errors
- Added `logSecurityErrorToAudit()` private method to log security errors to audit trail
- Implemented graceful handling when tenant/user context is missing
- Implemented error handling for audit logging failures (non-blocking)

**Key Features:**
- Automatically detects UnauthorizedError and ForbiddenError instances
- Extracts context information (tenantId, userId, operation, requestId)
- Includes IP address and user agent from request
- Logs to audit trail with appropriate action codes:
  - `SECURITY_UNAUTHORIZED_ACCESS` for UnauthorizedError
  - `SECURITY_FORBIDDEN_ACCESS` for ForbiddenError
- Includes additional details like required permission for ForbiddenError
- Fails gracefully if audit logging fails (logs error but doesn't throw)

### 2. Updated Audit System (`lib/audit.ts`)

**Changes:**
- Added two new audit action types:
  - `SECURITY_UNAUTHORIZED_ACCESS`
  - `SECURITY_FORBIDDEN_ACCESS`

### 3. Updated GlobalErrorHandler (`lib/middleware/global-error-handler.ts`)

**Changes:**
- Updated `handleError()` method to extract IP address and user agent from request
- Added `getIpAddress()` private method to extract IP from various headers:
  - `x-forwarded-for` (for proxied environments)
  - `x-real-ip`
- Passes request information to `errorLogger.logError()`
- Removed unused `ErrorSanitizer` parameter from constructor

**IP Address Extraction Priority:**
1. `x-forwarded-for` header (takes first IP from comma-separated list)
2. `x-real-ip` header
3. Returns `undefined` if not available

### 4. Unit Tests (`__tests__/lib/utils/error-logger-audit.test.ts`)

**Test Coverage:**
- UnauthorizedError audit logging with IP and user agent
- UnauthorizedError audit logging without request info
- UnauthorizedError without tenant context (should not log)
- UnauthorizedError without user context (should not log)
- ForbiddenError audit logging with required permission
- ForbiddenError audit logging without required permission
- Non-security errors should not log to audit trail
- Audit logging failures handled gracefully
- Email fallback to "unknown" when not provided

**All tests pass:** ✅ 9/9 tests passing

### 5. Updated Global Error Handler Tests

**Changes:**
- Updated tests to verify IP and user agent extraction
- Added test for `x-forwarded-for` header extraction
- Added test for `x-real-ip` header extraction
- Added test for user agent extraction
- Added test for missing IP and user agent handling
- Updated constructor calls to remove unused sanitizer parameter

**All tests pass:** ✅ 28/28 tests passing

## Requirements Validated

✅ **Requirement 4.8:** Security error audit logging
- UnauthorizedError logged to audit trail
- ForbiddenError logged to audit trail
- IP address included in audit logs
- User agent included in audit logs

## Security Considerations

1. **Non-blocking:** Audit logging failures do not break the application
2. **Context validation:** Only logs when tenant and user context are available
3. **Graceful degradation:** Logs warning when context is missing
4. **Privacy:** Uses existing audit system which handles sensitive data appropriately
5. **Comprehensive details:** Includes operation, timestamp, error message, and required permissions

## Usage Example

```typescript
// In an API route
import { withGlobalErrorHandler } from '@/lib/middleware/global-error-handler';
import { UnauthorizedError } from '@/lib/utils/error-handler';

export async function GET(req: NextRequest) {
  return withGlobalErrorHandler(req, async (req) => {
    // If authentication fails
    throw new UnauthorizedError('Invalid token', {
      context: {
        tenantId: 'tenant-123',
        userId: 'user-456',
        operation: 'api-access',
        metadata: {
          userEmail: 'user@example.com',
        },
      },
    });
    
    // This will automatically:
    // 1. Log the error with sanitization
    // 2. Create an audit log entry with:
    //    - Action: SECURITY_UNAUTHORIZED_ACCESS
    //    - IP address from request headers
    //    - User agent from request headers
    //    - Full error context
  });
}
```

## Audit Log Entry Example

```json
{
  "tenantId": "tenant-123",
  "userId": "user-456",
  "userEmail": "user@example.com",
  "action": "SECURITY_UNAUTHORIZED_ACCESS",
  "entityId": "req-789",
  "details": {
    "errorCode": "UNAUTHORIZED",
    "errorMessage": "Invalid token",
    "operation": "api-access",
    "timestamp": "2024-01-15T10:30:00Z",
    "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
  },
  "ipAddress": "192.168.1.1"
}
```

## Files Modified

1. `lib/utils/error-logger.ts` - Added security error audit logging
2. `lib/audit.ts` - Added security audit action types
3. `lib/middleware/global-error-handler.ts` - Added IP and user agent extraction
4. `__tests__/lib/utils/error-logger-audit.test.ts` - New test file (9 tests)
5. `__tests__/lib/middleware/global-error-handler.test.ts` - Updated tests (28 tests)

## Next Steps

The security error audit logging is now complete and integrated with the error handling system. All security-related errors (UnauthorizedError and ForbiddenError) will automatically be logged to the audit trail with full context including IP address and user agent.

The next task in the implementation plan is:
- Task 15: Update API endpoints to use global error handler
