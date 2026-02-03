# CORS Configuration Guide

## Overview

This document describes the Cross-Origin Resource Sharing (CORS) configuration for the PricePilot API. CORS is a security feature that restricts which domains can access your API endpoints.

## Security Principles

### 1. No Wildcards in Production
- **NEVER** use `*` (wildcard) for allowed origins in production
- Always specify exact domains
- This prevents unauthorized domains from accessing your API

### 2. Whitelist-Based Approach
- Only explicitly allowed origins can access the API
- Origins are configured via environment variables
- Default fallback to `NEXTAUTH_URL`

### 3. Restricted Methods and Headers
- Only necessary HTTP methods are allowed
- Headers are limited to required ones
- Credentials (cookies) are supported for authenticated requests

## Configuration

### Environment Variables

Add the following to your `.env` file:

```bash
# CORS Configuration
# Comma-separated list of allowed origins
ALLOWED_ORIGINS="https://yourdomain.com,https://app.yourdomain.com"
```

### Development vs Production

#### Development
- Allows `localhost` with any port
- More permissive for testing
- Still validates origin header

#### Production
- Strict origin validation
- No wildcards allowed
- HTTPS recommended for all origins
- Validates configuration on startup

## Allowed Methods

The following HTTP methods are allowed:
- `GET` - Read resources
- `POST` - Create resources
- `PUT` - Replace resources
- `PATCH` - Update resources
- `DELETE` - Remove resources
- `OPTIONS` - Preflight requests

## Allowed Headers

The following request headers are allowed:
- `X-CSRF-Token` - CSRF protection
- `X-Requested-With` - AJAX identification
- `Accept` - Content negotiation
- `Accept-Version` - API versioning
- `Content-Length` - Request size
- `Content-MD5` - Content integrity
- `Content-Type` - Request format
- `Date` - Request timestamp
- `X-Api-Version` - API version
- `Authorization` - Authentication token

## Exposed Headers

The following response headers are exposed to clients:
- `X-RateLimit-Limit` - Rate limit maximum
- `X-RateLimit-Remaining` - Remaining requests
- `X-RateLimit-Reset` - Rate limit reset time

## Implementation

### Next.js Configuration

CORS headers are configured in `next.config.ts`:

```typescript
async headers() {
  const allowedOrigins = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',').map(origin => origin.trim())
    : [process.env.NEXTAUTH_URL || 'http://localhost:3000'];

  return [
    {
      source: "/api/:path*",
      headers: [
        {
          key: "Access-Control-Allow-Origin",
          value: allowedOrigins.join(','),
        },
        // ... other headers
      ],
    },
  ];
}
```

### Middleware

For dynamic CORS handling, use the middleware:

```typescript
import { withCors } from '@/lib/middleware/cors';

export const GET = withCors(async (request: NextRequest) => {
  // Your handler logic
  return NextResponse.json({ data: 'response' });
});
```

### Preflight Requests

OPTIONS requests (preflight) are automatically handled:

```typescript
import { handleCorsPreflightRequest } from '@/lib/middleware/cors';

export async function OPTIONS(request: NextRequest) {
  return handleCorsPreflightRequest(request);
}
```

## Testing CORS

### Manual Testing

Test with curl:

```bash
# Test preflight request
curl -X OPTIONS http://localhost:3000/api/v1/products \
  -H "Origin: http://localhost:3000" \
  -H "Access-Control-Request-Method: GET" \
  -v

# Test actual request
curl -X GET http://localhost:3000/api/v1/products \
  -H "Origin: http://localhost:3000" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -v
```

### Automated Testing

Run the test script:

```bash
# Start the development server first
npm run dev

# In another terminal, run the test
npx tsx scripts/test-cors-configuration.ts
```

### Browser Testing

Open browser console and test:

```javascript
// Test from allowed origin
fetch('http://localhost:3000/api/v1/products', {
  method: 'GET',
  headers: {
    'Content-Type': 'application/json',
  },
  credentials: 'include',
})
  .then(response => response.json())
  .then(data => console.log('Success:', data))
  .catch(error => console.error('Error:', error));
```

## Common Issues

### Issue 1: CORS Error in Browser

**Symptom:**
```
Access to fetch at 'http://localhost:3000/api/v1/products' from origin 
'http://localhost:3001' has been blocked by CORS policy
```

**Solution:**
Add the origin to `ALLOWED_ORIGINS`:
```bash
ALLOWED_ORIGINS="http://localhost:3000,http://localhost:3001"
```

### Issue 2: Preflight Request Fails

**Symptom:**
```
Response to preflight request doesn't pass access control check
```

**Solution:**
Ensure your API route handles OPTIONS requests:
```typescript
export async function OPTIONS(request: NextRequest) {
  return handleCorsPreflightRequest(request);
}
```

### Issue 3: Credentials Not Sent

**Symptom:**
Cookies or authentication headers not sent with request

**Solution:**
Include credentials in fetch:
```javascript
fetch(url, {
  credentials: 'include',
  // ... other options
})
```

### Issue 4: Wildcard Error in Production

**Symptom:**
```
CORS: Wildcard (*) origins are not allowed in production
```

**Solution:**
Replace wildcard with specific domains:
```bash
# Bad
ALLOWED_ORIGINS="*"

# Good
ALLOWED_ORIGINS="https://yourdomain.com,https://app.yourdomain.com"
```

## Security Best Practices

### 1. Use HTTPS in Production
Always use HTTPS for production origins:
```bash
# Good
ALLOWED_ORIGINS="https://yourdomain.com"

# Bad (insecure)
ALLOWED_ORIGINS="http://yourdomain.com"
```

### 2. Limit Origins
Only add origins that need API access:
```bash
# Good - specific domains
ALLOWED_ORIGINS="https://app.yourdomain.com,https://admin.yourdomain.com"

# Bad - too permissive
ALLOWED_ORIGINS="https://yourdomain.com,https://*.yourdomain.com"
```

### 3. Regular Audits
- Review allowed origins quarterly
- Remove unused origins
- Update documentation

### 4. Monitor CORS Errors
- Log rejected CORS requests
- Alert on unusual patterns
- Investigate unauthorized access attempts

## Integration Examples

### Frontend (React/Next.js)

```typescript
// api/client.ts
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL;

export async function fetchProducts() {
  const response = await fetch(`${API_BASE_URL}/api/v1/products`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${getToken()}`,
    },
    credentials: 'include',
  });
  
  if (!response.ok) {
    throw new Error('Failed to fetch products');
  }
  
  return response.json();
}
```

### Mobile App

```typescript
// For React Native or mobile apps
fetch('https://api.yourdomain.com/api/v1/products', {
  method: 'GET',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
  },
})
  .then(response => response.json())
  .then(data => console.log(data));
```

### Third-Party Integration

For third-party integrations, provide them with:
1. Their origin to add to `ALLOWED_ORIGINS`
2. API documentation
3. Authentication requirements
4. Rate limits

## Troubleshooting

### Enable CORS Logging

Add logging to track CORS requests:

```typescript
// lib/middleware/cors.ts
export function applyCorsHeaders(response: NextResponse, origin: string | null) {
  console.log('CORS Request:', {
    origin,
    allowed: isOriginAllowed(origin),
    timestamp: new Date().toISOString(),
  });
  
  // ... rest of the function
}
```

### Check Configuration

Verify your configuration:

```bash
# Check environment variables
echo $ALLOWED_ORIGINS

# Validate configuration
npx tsx scripts/test-cors-configuration.ts
```

### Debug in Browser

Use browser DevTools:
1. Open Network tab
2. Look for OPTIONS request (preflight)
3. Check Response Headers for `Access-Control-*` headers
4. Verify request headers include `Origin`

## References

- [MDN: CORS](https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS)
- [OWASP: CORS Security](https://owasp.org/www-community/attacks/CORS_OriginHeaderScrutiny)
- [Next.js: Headers](https://nextjs.org/docs/app/api-reference/next-config-js/headers)

## Support

For CORS-related issues:
1. Check this documentation
2. Run the test script
3. Review server logs
4. Contact the development team

---

**Last Updated:** January 2026  
**Version:** 1.0
