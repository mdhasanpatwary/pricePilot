---
title: "CORS Quick Reference"
description: "Quick reference for CORS configuration"
category: "integrations"
tags: ["cors", "api", "quick-reference"]
audience: "tenant"
relatedDocs: ["/admin-docs/security/cors-quick-reference.md"]
---

> **Note:** This is a simplified version for tenants. For technical details, administrators can refer to the [admin documentation](/admin-docs/security/cors-quick-reference.md).

# CORS Quick Reference

## Quick Setup

### 1. Configure Environment Variable
```bash
# .env
ALLOWED_ORIGINS="https://yourdomain.com,https://app.yourdomain.com"
```

### 2. Restart Server
```bash
npm run dev
```

## Common Commands

### Test CORS Configuration
```bash
npx tsx scripts/test-cors-configuration.ts
```

### Test with curl
```bash
# Preflight request
curl -X OPTIONS http://localhost:3000/api/v1/products \
  -H "Origin: http://localhost:3000" \
  -H "Access-Control-Request-Method: GET" \
  -v

# Actual request
curl -X GET http://localhost:3000/api/v1/products \
  -H "Origin: http://localhost:3000" \
  -v
```

## Allowed Methods
- ✅ GET
- ✅ POST
- ✅ PUT
- ✅ PATCH
- ✅ DELETE
- ✅ OPTIONS
- ❌ TRACE
- ❌ CONNECT

## Allowed Headers
- Authorization
- Content-Type
- X-CSRF-Token
- X-Requested-With
- Accept
- X-Api-Version

## Using CORS Middleware

### In API Routes
```typescript
import { withCors } from '@/lib/middleware/cors';

export const GET = withCors(async (request: NextRequest) => {
  return NextResponse.json({ data: 'response' });
});
```

### Handle Preflight
```typescript
import { handleCorsPreflightRequest } from '@/lib/middleware/cors';

export const OPTIONS = handleCorsPreflightRequest;
```

## Frontend Integration

### Fetch with Credentials
```typescript
fetch('http://localhost:3000/api/v1/products', {
  method: 'GET',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
  },
  credentials: 'include', // Important!
})
```

## Troubleshooting

### CORS Error in Browser?
1. Check origin is in ALLOWED_ORIGINS
2. Verify server is running
3. Check browser console for details

### Preflight Fails?
1. Ensure OPTIONS handler exists
2. Check allowed methods
3. Verify origin is whitelisted

### Credentials Not Sent?
1. Add `credentials: 'include'` to fetch
2. Verify CORS headers include credentials

## Security Rules

### ❌ Never Do This
```bash
# Wildcard in production
ALLOWED_ORIGINS="*"
```

### ✅ Always Do This
```bash
# Specific domains
ALLOWED_ORIGINS="https://yourdomain.com,https://app.yourdomain.com"
```

## Environment-Specific Config

### Development
```bash
ALLOWED_ORIGINS="http://localhost:3000,http://localhost:3001"
```

### Staging
```bash
ALLOWED_ORIGINS="https://staging.yourdomain.com"
```

### Production
```bash
ALLOWED_ORIGINS="https://yourdomain.com,https://app.yourdomain.com"
```

## Need More Help?

See full documentation: [docs/CORS_CONFIGURATION.md](./CORS_CONFIGURATION.md)

---

**Quick Reference Version:** 1.0  
**Last Updated:** January 2026
