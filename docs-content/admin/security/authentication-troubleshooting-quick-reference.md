---
title: "Authentication Troubleshooting Quick Reference"
description: "Quick reference for authentication issues"
category: "security"
author: "PricePilot Team"
lastReviewed: "2024-05-20"
tags: ["authentication", "troubleshooting", "security"]
audience: "admin"
relatedDocs: ["/docs/troubleshooting/authentication-troubleshooting-quick-reference.md"]
---

# Authentication Troubleshooting Quick Reference

> **📖 For complete documentation, see the [Authentication Guide](./AUTHENTICATION_GUIDE.md)**

This is a quick reference guide for common authentication issues. For detailed explanations and solutions, refer to the complete [Authentication Guide - Troubleshooting Section](./AUTHENTICATION_GUIDE.md#troubleshooting).

---

## Quick Diagnostic Commands

### Test API Token
```bash
curl -X GET https://api.pricepilot.com/v1/health \
  -H "x-api-key: pp_your_token_here" \
  -v
```

### Test Session
```bash
curl -X GET https://api.pricepilot.com/v1/user/profile \
  -H "Cookie: next-auth.session-token=your-session-token" \
  -v
```

### Check Rate Limits
```bash
curl -X GET https://api.pricepilot.com/v1/rate-limit \
  -H "x-api-key: pp_your_token_here"
```

---

## Common Errors & Quick Fixes

### 1. "Authentication required"

**Error Response:**
```json
{
  "success": false,
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Authentication required"
  }
}
```

**Quick Fixes:**
- ✅ Include `x-api-key` header with API token
- ✅ Ensure session cookie is sent with request
- ✅ Verify you're logged in for dashboard access

**Test:**
```bash
# Verify header is included
curl -v https://api.pricepilot.com/v1/products \
  -H "x-api-key: pp_your_token_here" | grep "x-api-key"
```

---

### 2. "Invalid API key"

**Error Response:**
```json
{
  "success": false,
  "error": {
    "code": "INVALID_API_KEY",
    "message": "Invalid or expired API key"
  }
}
```

**Quick Fixes:**
- ✅ Verify token starts with `pp_`
- ✅ Check for extra spaces or characters
- ✅ Verify token hasn't been revoked
- ✅ Check expiration date
- ✅ Generate new token if needed

**Test:**
```bash
# List your API keys
curl -X GET https://api.pricepilot.com/v1/user/api-keys \
  -H "Cookie: next-auth.session-token=your-session-token"
```

---

### 3. "Session expired"

**Symptoms:**
- Redirected to login page
- "Session expired" message
- 401 Unauthorized on dashboard

**Quick Fixes:**
- ✅ Log in again
- ✅ Enable "Remember Me" for 30-day sessions
- ✅ Use API tokens for long-running processes
- ✅ Check active sessions in settings

**Session Durations:**
- Default: 24 hours
- Remember Me: 30 days
- API Token: Never expires (unless set)

---

### 4. "Rate limit exceeded"

**Error Response:**
```json
{
  "success": false,
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Too many requests. Please try again later."
  }
}
```

**Response Headers:**
```
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 1643723400
```

**Quick Fixes:**
- ✅ Wait until rate limit resets
- ✅ Implement exponential backoff
- ✅ Cache responses when possible
- ✅ Optimize request patterns

**Implementation:**
```javascript
async function makeRequestWithRetry(url, options) {
  const response = await fetch(url, options);
  
  if (response.status === 429) {
    const reset = response.headers.get('X-RateLimit-Reset');
    const waitTime = (parseInt(reset) * 1000) - Date.now();
    
    console.log(`Rate limited. Waiting ${waitTime}ms...`);
    await new Promise(resolve => setTimeout(resolve, waitTime));
    return makeRequestWithRetry(url, options);
  }
  
  return response;
}
```

---

### 5. "Invalid credentials"

**Error Response:**
```json
{
  "error": "Invalid credentials"
}
```

**Quick Fixes:**
- ✅ Verify email and password are correct
- ✅ Check email for verification link
- ✅ Wait 15 minutes if temporarily locked out
- ✅ Use password reset if forgotten
- ✅ Contact support if account is locked

**Lockout Policy:**
- 5 failed attempts = 15-minute lockout
- 10 failed attempts = 1-hour lockout
- 20 failed attempts = Account review required

---

### 6. CORS Errors (Browser Only)

**Error Message:**
```
Access to fetch at 'https://api.pricepilot.com/v1/products' from origin 'https://myapp.com' 
has been blocked by CORS policy
```

**Quick Fixes:**
- ✅ Make API requests from server-side code
- ✅ Contact support to whitelist your domain
- ✅ Use session authentication for browser requests
- ✅ Proxy requests through your backend

**Not Recommended:**
- ❌ Making API requests from browser JavaScript
- ❌ Exposing API tokens in client-side code

---

## Rate Limits Reference

| Endpoint Type | Limit | Window |
|--------------|-------|--------|
| Authentication | 5 attempts | 15 minutes |
| Read (GET) | 1000 requests | 1 hour |
| Write (POST/PUT/DELETE) | 500 requests | 1 hour |
| Sync Operations | 10 requests | 1 hour |

---

## Token Format Reference

### API Token Format
```
pp_[64-character-hexadecimal-string]
```

**Example:**
```
pp_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9d0e1f2
```

### Session Token Format
```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Note:** Session tokens are managed automatically by the browser.

---

## Security Checklist

Before deploying:
- [ ] API tokens stored in environment variables
- [ ] API tokens not committed to version control
- [ ] HTTPS used for all requests
- [ ] Rate limit monitoring implemented
- [ ] Error handling for 401/403 responses
- [ ] API tokens rotated regularly (every 90 days)
- [ ] Separate tokens for different environments
- [ ] Least privilege access implemented
- [ ] Logging excludes sensitive data
- [ ] Session timeout configured appropriately

---

## Getting Help

### Self-Service Resources
1. **[Complete Authentication Guide](./AUTHENTICATION_GUIDE.md)** - Detailed documentation
2. **[API Reference](./ADMIN_API_REFERENCE.md)** - API endpoint documentation
3. **[Status Page](https://status.pricepilot.com)** - Service status

### Support Channels
- **General Support**: support@pricepilot.com
- **Security Issues**: security@pricepilot.com
- **Emergency**: +1-555-SUPPORT (24/7)

### Information to Include
When contacting support, include:
- Error message and code
- Request ID (from error response)
- Timestamp of issue
- Steps to reproduce
- API endpoint or dashboard page
- Browser/client information

---

## Quick Links

- [Authentication Guide](./AUTHENTICATION_GUIDE.md) - Complete documentation
- [API Reference](./ADMIN_API_REFERENCE.md) - API endpoints
- [Security Guide](./SECURITY_HEADERS.md) - Security best practices
- [Rate Limiting](./RATE_LIMITING.md) - Rate limiting details
- [Error Codes](./API_ERROR_CODES.md) - Error code reference

---

*Last Updated: February 3, 2026*
*Version: 1.0.0*
