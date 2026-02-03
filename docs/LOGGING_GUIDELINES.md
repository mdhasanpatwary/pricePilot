# Logging Guidelines

## Overview

This document provides guidelines for secure and effective logging in the PricePilot application. Following these guidelines ensures that sensitive data is never exposed in logs while maintaining useful debugging information.

**Security Requirement**: 2.7.5 - Prevent sensitive data logging

---

## Core Principles

### 1. Never Log Sensitive Data

**NEVER log the following:**
- Passwords (plain text or hashed)
- API tokens or keys
- Session tokens
- Authentication credentials
- Private keys or secrets
- Credit card information
- Social security numbers
- Database connection strings
- Encryption keys

### 2. Automatic Sanitization

All logging in PricePilot uses automatic sanitization:
- The `logger` utility automatically sanitizes all context objects
- Sensitive field names are detected and masked
- Sensitive patterns (tokens, emails, etc.) are redacted
- Error messages and stack traces are sanitized

### 3. Log Useful Context

**DO log:**
- User IDs (not emails or names)
- Tenant IDs
- Resource IDs (product IDs, site IDs, etc.)
- Operation types
- Timestamps
- Error codes
- Request paths (without query parameters containing sensitive data)
- Status codes

---

## Using the Logger

### Basic Usage

```typescript
import { logger } from '@/lib/logger';

// Info logging
logger.info('User logged in', {
  userId: user.id,
  tenantId: user.tenantId,
  timestamp: new Date().toISOString()
});

// Warning logging
logger.warn('Rate limit approaching', {
  userId: user.id,
  currentCount: 95,
  limit: 100
});

// Error logging
logger.error('Failed to sync products', {
  siteId: site.id,
  tenantId: site.tenantId,
  errorCode: 'SYNC_FAILED'
});

// Debug logging (development only)
logger.debug('Processing product match', {
  userProductId: product.id,
  competitorProductId: competitor.id,
  confidence: 0.95
});
```

### Automatic Sanitization

The logger automatically sanitizes sensitive data:

```typescript
// ❌ BAD: Attempting to log sensitive data
logger.info('Site connected', {
  siteId: site.id,
  apiToken: site.apiToken,  // This will be masked
  password: 'secret123'      // This will be masked
});

// ✅ RESULT: Logged as
// {
//   siteId: '123',
//   apiToken: '***REDACTED***',
//   password: '***REDACTED***'
// }
```

### Error Logging

```typescript
try {
  await someOperation();
} catch (error) {
  // Logger automatically sanitizes error messages and stack traces
  logger.error('Operation failed', {
    operation: 'someOperation',
    userId: user.id,
    error: error instanceof Error ? error.message : String(error)
  });
  
  // Or pass the error directly
  logger.error(error as Error, {
    operation: 'someOperation',
    userId: user.id
  });
}
```

---

## Sensitive Field Detection

The following field names are automatically masked:

### Authentication & Authorization
- `password`, `passwordHash`, `newPassword`, `oldPassword`
- `currentPassword`, `confirmPassword`

### Tokens & Keys
- `apiToken`, `token`, `accessToken`, `refreshToken`
- `bearerToken`, `authToken`, `sessionToken`
- `secret`, `secretKey`, `apiSecret`, `privateKey`
- `encryptionKey`, `clientSecret`

### Credentials
- `credential`, `credentials`, `apiKey`, `apiKeys`

### Personal Information
- `ssn`, `socialSecurityNumber`, `creditCard`
- `cardNumber`, `cvv`, `pin`

### Database
- `connectionString`, `databaseUrl`, `dbPassword`

---

## Pattern Detection

The logger also detects and masks sensitive patterns:

- **Long tokens**: Strings with 32+ alphanumeric characters
- **JWT tokens**: Standard JWT format
- **Credit cards**: Card number patterns
- **Email addresses**: For PII protection

---

## Best Practices

### ✅ DO

```typescript
// Log with context
logger.info('Price updated', {
  productId: product.id,
  oldPrice: 99.99,
  newPrice: 89.99,
  tenantId: tenant.id
});

// Log operation results
logger.info('Sync completed', {
  siteId: site.id,
  productsUpdated: 150,
  duration: 5000
});

// Log with error codes
logger.error('Validation failed', {
  errorCode: 'INVALID_INPUT',
  field: 'price',
  value: -10
});

// Use masked display utilities
import { maskApiToken, maskEmail } from '@/lib/utils/log-sanitizer';

logger.info('Site configuration', {
  siteId: site.id,
  apiToken: maskApiToken(site.apiToken),  // Shows last 4 chars
  email: maskEmail(user.email)             // Shows first char + domain
});
```

### ❌ DON'T

```typescript
// Don't log full user objects
logger.info('User action', { user });  // May contain email, password hash

// Don't log request bodies directly
logger.info('API request', { body: req.body });  // May contain passwords

// Don't log full error objects from external APIs
logger.error('API failed', { response: apiResponse });  // May contain tokens

// Don't log query strings
logger.info('Request received', { url: req.url });  // May contain tokens in params
```

---

## Service-Specific Guidelines

### Authentication Service

```typescript
// ✅ GOOD
logger.info('Login attempt', {
  email: maskEmail(email),
  success: true,
  userId: user.id
});

// ❌ BAD
logger.info('Login attempt', {
  email: email,
  password: password  // NEVER!
});
```

### Sync Service

```typescript
// ✅ GOOD
logger.info('Syncing products', {
  siteId: site.id,
  platform: site.platform,
  productCount: products.length
});

// ❌ BAD
logger.info('Syncing products', {
  site: site  // Contains apiToken!
});
```

### Price Update Service

```typescript
// ✅ GOOD
logger.info('Price update executed', {
  productId: product.id,
  oldPrice: 99.99,
  newPrice: 89.99,
  strategy: 'UNDERCUT'
});

// ❌ BAD
logger.info('Price update executed', {
  product: product  // May contain sensitive data
});
```

---

## Utility Functions

### Mask API Token

```typescript
import { maskApiToken } from '@/lib/utils/log-sanitizer';

const masked = maskApiToken('very-long-secret-token-12345');
// Result: '***REDACTED***2345'
```

### Mask Email

```typescript
import { maskEmail } from '@/lib/utils/log-sanitizer';

const masked = maskEmail('user@example.com');
// Result: 'u***@example.com'
```

### Sanitize Context

```typescript
import { sanitizeLogContext } from '@/lib/utils/log-sanitizer';

const context = {
  userId: '123',
  apiToken: 'secret-token',
  email: 'user@example.com'
};

const sanitized = sanitizeLogContext(context);
// Result: {
//   userId: '123',
//   apiToken: '***REDACTED***',
//   email: '***REDACTED***'
// }
```

---

## Production Logging

### External Services

When integrating with external logging services (Sentry, LogRocket, Datadog):

1. **Always sanitize before sending**
2. **Configure service-level scrubbing**
3. **Test sanitization in staging**
4. **Review logs regularly for leaks**

### Sentry Integration Example

```typescript
import * as Sentry from '@sentry/nextjs';
import { sanitizeLogContext } from '@/lib/utils/log-sanitizer';

Sentry.captureException(error, {
  contexts: {
    operation: sanitizeLogContext({
      userId: user.id,
      operation: 'sync',
      // ... other context
    })
  }
});
```

---

## Audit and Compliance

### Regular Audits

1. **Review logs monthly** for sensitive data leaks
2. **Test sanitization** with real-world data
3. **Update sensitive field list** as needed
4. **Train team** on logging best practices

### Compliance Requirements

- **GDPR**: No PII in logs without consent
- **PCI DSS**: No credit card data in logs
- **SOC 2**: Secure logging practices documented

---

## Testing Logging

### Unit Tests

```typescript
import { sanitizeLogContext } from '@/lib/utils/log-sanitizer';

describe('Log Sanitization', () => {
  it('should mask API tokens', () => {
    const context = { apiToken: 'secret-123' };
    const sanitized = sanitizeLogContext(context);
    expect(sanitized.apiToken).toBe('***REDACTED***');
  });
  
  it('should preserve safe fields', () => {
    const context = { userId: '123', productId: '456' };
    const sanitized = sanitizeLogContext(context);
    expect(sanitized.userId).toBe('123');
    expect(sanitized.productId).toBe('456');
  });
});
```

---

## Troubleshooting

### Logs Missing Context

If logs are missing expected context:
1. Check if field names match sensitive patterns
2. Verify sanitization is not too aggressive
3. Use `maskApiToken()` for partial display

### Sensitive Data Still Appearing

If sensitive data appears in logs:
1. Add field name to `SENSITIVE_FIELDS` in `log-sanitizer.ts`
2. Add pattern to `SENSITIVE_PATTERNS` if needed
3. Report to security team immediately
4. Rotate compromised credentials

---

## Quick Reference

### Safe to Log
- ✅ User IDs
- ✅ Tenant IDs
- ✅ Resource IDs
- ✅ Timestamps
- ✅ Counts and metrics
- ✅ Error codes
- ✅ Operation types
- ✅ Status codes

### Never Log
- ❌ Passwords
- ❌ API tokens
- ❌ Session tokens
- ❌ Private keys
- ❌ Credit cards
- ❌ Full email addresses
- ❌ Connection strings
- ❌ Secrets

---

## Support

For questions about logging:
- Review this document
- Check `lib/utils/log-sanitizer.ts` for implementation
- Contact security team for sensitive data concerns
- Report logging issues to development team

---

**Last Updated**: February 2, 2026  
**Version**: 1.0  
**Owner**: Security Team
