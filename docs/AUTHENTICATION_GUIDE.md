# PricePilot Authentication Guide

## Table of Contents

1. [Overview](#overview)
2. [Authentication Methods](#authentication-methods)
3. [API Token Authentication](#api-token-authentication)
4. [Session Authentication](#session-authentication)
5. [Security Best Practices](#security-best-practices)
6. [Troubleshooting](#troubleshooting)
7. [FAQ](#faq)

---

## Overview

PricePilot supports two authentication methods to accommodate different use cases:

- **API Token Authentication**: For programmatic access, integrations, and server-to-server communication
- **Session Authentication**: For web browser access through the dashboard UI

Both methods provide secure access to PricePilot resources with automatic tenant isolation.

### Key Features

- **Multi-tenant isolation**: All authenticated requests are automatically scoped to your tenant
- **Rate limiting**: Protects against abuse while allowing normal usage
- **Secure token storage**: API tokens are hashed and encrypted
- **Session management**: Automatic session expiration and renewal
- **Audit logging**: All authentication events are logged for security

---

## Authentication Methods

### Comparison

| Feature | API Token | Session |
|---------|-----------|---------|
| **Use Case** | Programmatic access, integrations | Web browser access |
| **Authentication** | `x-api-key` header | Cookie-based |
| **Expiration** | Configurable (default: never) | 24 hours (default) or 30 days (remember me) |
| **Rate Limit** | 1000 requests/hour | 1000 requests/hour |
| **Revocation** | Manual via dashboard | Automatic on logout |
| **Best For** | Scripts, APIs, integrations | Dashboard, admin panel |

### When to Use Each Method

**Use API Token Authentication when:**
- Building integrations with external systems
- Running automated scripts or cron jobs
- Accessing API from server-side applications
- Need long-lived authentication
- Require programmatic access

**Use Session Authentication when:**
- Accessing the web dashboard
- Using the admin panel
- Interactive user sessions
- Need automatic session management
- Browser-based applications

---

## API Token Authentication

### Overview

API tokens provide secure, long-lived authentication for programmatic access to PricePilot APIs.

### Token Format

API tokens follow this format:
```
pp_[64-character-hexadecimal-string]
```

Example:
```
pp_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9d0e1f2
```

### Generating API Tokens

#### Via Dashboard (Recommended)

1. Log in to your PricePilot dashboard
2. Navigate to **Settings > Developers > API Keys**
3. Click **Generate New API Key**
4. Provide a name and optional description
5. Set expiration (optional)
6. Click **Create**
7. **Copy the token immediately** - it will only be shown once

#### Via API

```bash
curl -X POST https://api.pricepilot.com/v1/user/api-keys \
  -H "Content-Type: application/json" \
  -H "Cookie: next-auth.session-token=your-session-token" \
  -d '{
    "name": "Production Server",
    "description": "API key for production deployment",
    "expiresAt": "2027-12-31T23:59:59Z"
  }'
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "key_123abc",
    "name": "Production Server",
    "key": "pp_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9d0e1f2",
    "createdAt": "2026-02-03T10:00:00Z",
    "expiresAt": "2027-12-31T23:59:59Z"
  }
}
```

⚠️ **Important**: Save the token immediately. For security reasons, it cannot be retrieved later.

### Using API Tokens

Include your API token in the `x-api-key` header with every request:

```bash
curl -X GET https://api.pricepilot.com/v1/products \
  -H "x-api-key: pp_your_token_here"
```

#### JavaScript/Node.js Example

```javascript
const axios = require('axios');

const client = axios.create({
  baseURL: 'https://api.pricepilot.com/v1',
  headers: {
    'x-api-key': process.env.PRICEPILOT_API_KEY
  }
});

// Make authenticated request
async function getProducts() {
  try {
    const response = await client.get('/products');
    console.log('Products:', response.data);
  } catch (error) {
    console.error('Error:', error.response?.data || error.message);
  }
}
```

#### Python Example

```python
import requests
import os

API_KEY = os.environ.get('PRICEPILOT_API_KEY')
BASE_URL = 'https://api.pricepilot.com/v1'

headers = {
    'x-api-key': API_KEY
}

# Make authenticated request
response = requests.get(f'{BASE_URL}/products', headers=headers)

if response.status_code == 200:
    products = response.json()
    print('Products:', products)
else:
    print('Error:', response.status_code, response.text)
```

#### PHP Example

```php
<?php
$apiKey = getenv('PRICEPILOT_API_KEY');
$baseUrl = 'https://api.pricepilot.com/v1';

$ch = curl_init();
curl_setopt($ch, CURLOPT_URL, "$baseUrl/products");
curl_setopt($ch, CURLOPT_HTTPHEADER, [
    "x-api-key: $apiKey"
]);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);

$response = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

if ($httpCode === 200) {
    $products = json_decode($response, true);
    print_r($products);
} else {
    echo "Error: $httpCode - $response\n";
}
?>
```

### Managing API Tokens

#### List All Tokens

```bash
curl -X GET https://api.pricepilot.com/v1/user/api-keys \
  -H "x-api-key: pp_your_token_here"
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "key_123abc",
      "name": "Production Server",
      "description": "API key for production deployment",
      "createdAt": "2026-02-03T10:00:00Z",
      "lastUsedAt": "2026-02-03T15:30:00Z",
      "expiresAt": "2027-12-31T23:59:59Z",
      "isActive": true
    },
    {
      "id": "key_456def",
      "name": "Development",
      "description": "API key for development environment",
      "createdAt": "2026-01-15T09:00:00Z",
      "lastUsedAt": "2026-02-02T14:20:00Z",
      "expiresAt": null,
      "isActive": true
    }
  ]
}
```

#### Revoke a Token

```bash
curl -X DELETE https://api.pricepilot.com/v1/user/api-keys/key_123abc \
  -H "x-api-key: pp_your_token_here"
```

**Response:**
```json
{
  "success": true,
  "message": "API key revoked successfully"
}
```

#### Update Token Details

```bash
curl -X PATCH https://api.pricepilot.com/v1/user/api-keys/key_123abc \
  -H "x-api-key: pp_your_token_here" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Production Server (Updated)",
    "description": "Updated description"
  }'
```

### Token Security

#### Storage Best Practices

**DO:**
- Store tokens in environment variables
- Use secret management services (AWS Secrets Manager, HashiCorp Vault, etc.)
- Rotate tokens regularly (every 90 days recommended)
- Use different tokens for different environments
- Revoke tokens immediately if compromised

**DON'T:**
- Commit tokens to version control
- Share tokens via email, chat, or other insecure channels
- Use the same token across multiple applications
- Expose tokens in client-side code
- Log tokens in application logs

#### Environment Variables

**Example .env file:**
```bash
PRICEPILOT_API_KEY=pp_your_token_here
PRICEPILOT_API_URL=https://api.pricepilot.com/v1
```

**Loading in Node.js:**
```javascript
require('dotenv').config();

const apiKey = process.env.PRICEPILOT_API_KEY;
if (!apiKey) {
  throw new Error('PRICEPILOT_API_KEY environment variable is required');
}
```

**Loading in Python:**
```python
import os
from dotenv import load_dotenv

load_dotenv()

api_key = os.environ.get('PRICEPILOT_API_KEY')
if not api_key:
    raise ValueError('PRICEPILOT_API_KEY environment variable is required')
```

### Token Rotation

Regular token rotation is a security best practice:

1. **Generate new token** with same permissions
2. **Update applications** to use new token
3. **Test thoroughly** in staging environment
4. **Deploy to production**
5. **Monitor for errors** for 24-48 hours
6. **Revoke old token** once confirmed working

**Recommended rotation schedule:**
- Production: Every 90 days
- Staging: Every 180 days
- Development: Every 365 days
- After security incident: Immediately

---

## Session Authentication

### Overview

Session authentication provides secure, cookie-based authentication for web browser access to the PricePilot dashboard.

### Login Flow

#### 1. User Login

**Endpoint:** `POST /api/auth/signin/credentials`

```bash
curl -X POST https://pricepilot.com/api/auth/signin/credentials \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "your-secure-password",
    "rememberMe": true
  }'
```

**Response:**
```json
{
  "url": "/dashboard",
  "ok": true
}
```

The response includes a `Set-Cookie` header with the session token:
```
Set-Cookie: next-auth.session-token=eyJhbGc...; Path=/; HttpOnly; Secure; SameSite=Lax
```

#### 2. Automatic Session Management

Once logged in, the browser automatically includes the session cookie with all requests to PricePilot.

#### 3. Session Validation

Every request validates the session:
- Checks if session exists in database
- Verifies session hasn't expired
- Updates last used timestamp
- Enforces concurrent session limits (max 5 per user)

### Session Configuration

#### Session Duration

| Setting | Default | Remember Me |
|---------|---------|-------------|
| **Idle Timeout** | 24 hours | 30 days |
| **Absolute Timeout** | 30 days | 30 days |
| **Update Frequency** | 1 hour | 1 hour |

#### Session Cookies

PricePilot uses secure, HTTP-only cookies:

```javascript
{
  sessionToken: {
    name: '__Secure-next-auth.session-token', // Production
    options: {
      httpOnly: true,      // Prevents JavaScript access
      sameSite: 'lax',     // CSRF protection
      path: '/',           // Available site-wide
      secure: true         // HTTPS only (production)
    }
  }
}
```

### Remember Me

When "Remember Me" is checked during login:
- Session duration extends to 30 days
- Session persists across browser restarts
- Automatic re-authentication on return visits

### Logout

#### Manual Logout

**Endpoint:** `POST /api/auth/signout`

```bash
curl -X POST https://pricepilot.com/api/auth/signout \
  -H "Cookie: next-auth.session-token=your-session-token"
```

This will:
- Delete the session from the database
- Clear the session cookie
- Redirect to login page

#### Automatic Logout

Sessions are automatically terminated when:
- Session expires (24 hours or 30 days)
- User changes password
- User is deactivated
- Maximum concurrent sessions exceeded
- Session is manually revoked

### Session Management

#### View Active Sessions

Navigate to **Settings > Security > Active Sessions** to see:
- Device information
- Last used timestamp
- IP address
- Location (approximate)

#### Revoke Sessions

You can revoke individual sessions or all sessions except current:

```bash
# Revoke specific session
curl -X DELETE https://api.pricepilot.com/v1/user/sessions/session_123 \
  -H "Cookie: next-auth.session-token=your-session-token"

# Revoke all other sessions
curl -X POST https://api.pricepilot.com/v1/user/sessions/revoke-all \
  -H "Cookie: next-auth.session-token=your-session-token"
```

### Concurrent Session Limits

PricePilot enforces a maximum of **5 concurrent sessions** per user:
- Prevents account sharing
- Improves security
- When limit reached, oldest session is automatically revoked

---

## Security Best Practices

### 1. Use HTTPS Only

**Always use HTTPS** for all API requests and dashboard access:

```bash
# ✅ Good
https://api.pricepilot.com/v1/products

# ❌ Bad - Never use HTTP
http://api.pricepilot.com/v1/products
```

### 2. Protect API Tokens

- Store in environment variables or secret managers
- Never commit to version control
- Rotate regularly (every 90 days)
- Use different tokens per environment
- Revoke immediately if compromised

### 3. Strong Passwords

Password requirements:
- Minimum 12 characters
- At least one uppercase letter
- At least one lowercase letter
- At least one number
- At least one special character

### 4. Enable Two-Factor Authentication (2FA)

Coming soon: Add an extra layer of security with 2FA.

### 5. Monitor Authentication Activity

Review authentication logs regularly:
- Failed login attempts
- New API token creation
- Session revocations
- Unusual access patterns

### 6. Implement Rate Limiting

PricePilot automatically rate limits authentication attempts:
- Login: 5 attempts per 15 minutes
- API requests: 1000 per hour
- Failed attempts trigger temporary lockout

### 7. Use Least Privilege

Create separate API tokens with minimal required permissions:
- Read-only tokens for analytics
- Write tokens for integrations
- Admin tokens only when necessary

---

## Troubleshooting

### Common Issues

#### 1. "Authentication required" Error

**Symptoms:**
```json
{
  "success": false,
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Authentication required"
  }
}
```

**Causes:**
- Missing authentication header
- Missing session cookie
- Request to protected endpoint without auth

**Solutions:**
- Include `x-api-key` header with API token
- Ensure session cookie is sent with request
- Verify you're logged in for dashboard access

**Test:**
```bash
# Verify API token is included
curl -v https://api.pricepilot.com/v1/products \
  -H "x-api-key: pp_your_token_here"

# Look for this in output:
> x-api-key: pp_your_token_here
```

#### 2. "Invalid API key" Error

**Symptoms:**
```json
{
  "success": false,
  "error": {
    "code": "INVALID_API_KEY",
    "message": "Invalid or expired API key"
  }
}
```

**Causes:**
- API token is incorrect
- API token has been revoked
- API token has expired
- Token format is invalid

**Solutions:**
1. Verify token is correct (no extra spaces or characters)
2. Check if token was revoked in dashboard
3. Check expiration date
4. Ensure token starts with `pp_`
5. Generate new token if needed

**Test:**
```bash
# List your API keys to verify
curl -X GET https://api.pricepilot.com/v1/user/api-keys \
  -H "Cookie: next-auth.session-token=your-session-token"
```

#### 3. "Session expired" Error

**Symptoms:**
- Redirected to login page
- "Session expired" message
- 401 Unauthorized on dashboard requests

**Causes:**
- Session idle timeout (24 hours)
- Session absolute timeout (30 days)
- Session manually revoked
- Password changed
- Maximum sessions exceeded

**Solutions:**
1. Log in again
2. Enable "Remember Me" for longer sessions
3. Check active sessions in settings
4. Use API tokens for long-running processes

#### 4. "Rate limit exceeded" Error

**Symptoms:**
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

**Causes:**
- Too many requests in time window
- Exceeded 1000 requests per hour
- Multiple failed authentication attempts

**Solutions:**
1. Wait until rate limit resets
2. Implement exponential backoff
3. Cache responses when possible
4. Optimize request patterns

**Implementation:**
```javascript
async function makeRequestWithRetry(url, options, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    const response = await fetch(url, options);
    
    if (response.status === 429) {
      const reset = response.headers.get('X-RateLimit-Reset');
      const waitTime = (parseInt(reset) * 1000) - Date.now();
      
      console.log(`Rate limited. Waiting ${waitTime}ms...`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
      continue;
    }
    
    return response;
  }
  
  throw new Error('Max retries exceeded');
}
```

#### 5. "Invalid credentials" Error

**Symptoms:**
```json
{
  "error": "Invalid credentials"
}
```

**Causes:**
- Incorrect email or password
- Account not verified
- Account deactivated
- Too many failed attempts (temporary lockout)

**Solutions:**
1. Verify email and password are correct
2. Check email for verification link
3. Contact support if account is locked
4. Wait 15 minutes if temporarily locked out
5. Use password reset if forgotten

#### 6. CORS Errors (Browser Only)

**Symptoms:**
```
Access to fetch at 'https://api.pricepilot.com/v1/products' from origin 'https://myapp.com' 
has been blocked by CORS policy
```

**Causes:**
- Making API requests from browser
- Origin not whitelisted
- Missing CORS headers

**Solutions:**
1. Make API requests from server-side code
2. Contact support to whitelist your domain
3. Use session authentication for browser requests
4. Proxy requests through your backend

### Diagnostic Commands

#### Test API Token

```bash
# Test authentication
curl -X GET https://api.pricepilot.com/v1/health \
  -H "x-api-key: pp_your_token_here" \
  -v
```

**Expected output:**
```
< HTTP/2 200
< x-ratelimit-limit: 1000
< x-ratelimit-remaining: 999
{
  "status": "ok",
  "authenticated": true,
  "tenantId": "tenant_123"
}
```

#### Test Session

```bash
# Test session authentication
curl -X GET https://api.pricepilot.com/v1/user/profile \
  -H "Cookie: next-auth.session-token=your-session-token" \
  -v
```

#### Check Rate Limits

```bash
# Check current rate limit status
curl -X GET https://api.pricepilot.com/v1/rate-limit \
  -H "x-api-key: pp_your_token_here"
```

**Response:**
```json
{
  "limit": 1000,
  "remaining": 847,
  "reset": 1643723400,
  "resetIn": "45 minutes"
}
```

### Getting Help

If you're still experiencing issues:

1. **Check Status Page**: https://status.pricepilot.com
2. **Review Documentation**: https://docs.pricepilot.com
3. **Contact Support**: support@pricepilot.com
4. **Security Issues**: security@pricepilot.com

Include in your support request:
- Error message and code
- Request ID (from error response)
- Timestamp of issue
- Steps to reproduce
- API endpoint or dashboard page

---

## FAQ

### General Questions

**Q: Which authentication method should I use?**

A: Use API tokens for programmatic access and integrations. Use session authentication for web dashboard access.

**Q: Can I use both authentication methods?**

A: Yes, you can use API tokens for API access and session authentication for dashboard access simultaneously.

**Q: How many API tokens can I create?**

A: You can create up to 10 active API tokens per tenant.

**Q: Do API tokens expire?**

A: By default, API tokens don't expire. You can optionally set an expiration date when creating a token.

### Security Questions

**Q: Are API tokens encrypted?**

A: Yes, API tokens are hashed using SHA-256 before storage. The plain token is only shown once during creation.

**Q: What happens if my API token is compromised?**

A: Immediately revoke the compromised token in your dashboard and generate a new one. Review audit logs for unauthorized access.

**Q: Can I restrict API token permissions?**

A: Currently, API tokens have the same permissions as the user who created them. Granular permissions are coming soon.

**Q: How secure are sessions?**

A: Sessions use HTTP-only, secure cookies with SameSite protection. Sessions are stored server-side and validated on every request.

### Technical Questions

**Q: Can I use API tokens in browser JavaScript?**

A: Not recommended. API tokens should be kept secret and used only in server-side code. Use session authentication for browser access.

**Q: How do I handle token rotation without downtime?**

A: Create a new token, update your applications, test thoroughly, then revoke the old token after confirming the new one works.

**Q: What's the difference between session token and API token?**

A: Session tokens are short-lived, cookie-based, and managed automatically. API tokens are long-lived, header-based, and managed manually.

**Q: Can I use API tokens with webhooks?**

A: Yes, include your API token in the `x-api-key` header when configuring webhook endpoints.

### Troubleshooting Questions

**Q: Why am I getting "Authentication required" errors?**

A: Ensure you're including the `x-api-key` header with your API token, or that your session cookie is being sent with the request.

**Q: Why does my session keep expiring?**

A: Default session timeout is 24 hours. Enable "Remember Me" during login for 30-day sessions.

**Q: How do I test if my API token is working?**

A: Use the health check endpoint: `curl -H "x-api-key: your_token" https://api.pricepilot.com/v1/health`

**Q: What should I do if I'm rate limited?**

A: Wait for the rate limit to reset (check `X-RateLimit-Reset` header) or implement exponential backoff in your code.

---

## Additional Resources

### Documentation

- [API Reference](./ADMIN_API_REFERENCE.md) - Complete API endpoint documentation
- [Security Guide](./SECURITY_HEADERS.md) - Security best practices
- [Rate Limiting](./RATE_LIMITING.md) - Rate limiting details
- [Error Codes](./API_ERROR_CODES.md) - Complete error code reference

### Tools

- [API Testing Tool](https://pricepilot.com/developers/api-tester) - Test API endpoints
- [Token Generator](https://pricepilot.com/settings/api-keys) - Generate API tokens
- [Session Manager](https://pricepilot.com/settings/security) - Manage active sessions

### Support

- **Email**: support@pricepilot.com
- **Security**: security@pricepilot.com
- **Status**: https://status.pricepilot.com
- **Community**: https://community.pricepilot.com

---

*Last Updated: February 3, 2026*
*Version: 1.0.0*
