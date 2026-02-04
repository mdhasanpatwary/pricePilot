# PricePilot API Authentication Guide

> **📖 For comprehensive authentication documentation, see the [Authentication Guide](./AUTHENTICATION_GUIDE.md)**

This document provides a quick reference for API authentication. For detailed information including troubleshooting, security best practices, and code examples, refer to the complete [Authentication Guide](./AUTHENTICATION_GUIDE.md).

## Quick Start

### API Token Authentication

```bash
curl -X GET https://api.pricepilot.com/v1/products \
  -H "x-api-key: pp_your_token_here"
```

### Session Authentication

```bash
curl -X POST https://pricepilot.com/api/auth/signin/credentials \
  -H "Content-Type: application/json" \
  -d '{"email": "user@example.com", "password": "your-password"}'
```

---

## Table of Contents

1. [Authentication Methods](#authentication-methods)
2. [API Key Authentication](#api-key-authentication)
3. [Session Authentication](#session-authentication)
4. [Security Best Practices](#security-best-practices)
5. [Rate Limiting](#rate-limiting)
6. [Troubleshooting](#troubleshooting)

---

## Authentication Methods

PricePilot API supports two authentication methods:

### 1. API Key Authentication (Recommended for Programmatic Access)

- **Use Case:** Server-to-server communication, scripts, integrations
- **Header:** `x-api-key`
- **Expiration:** Never (unless manually revoked)
- **Rate Limit:** 1000 requests/hour

### 2. Session Authentication (Web Application)

- **Use Case:** Browser-based applications
- **Method:** Cookie-based session
- **Expiration:** 30 days of inactivity
- **Rate Limit:** 1000 requests/hour

---

## API Key Authentication

### Generating an API Key

1. Log in to your PricePilot dashboard
2. Navigate to **Settings > API Keys**
3. Click **Generate New API Key**
4. Copy the key immediately (it won't be shown again)
5. Store it securely

### Using API Keys

Include your API key in the `x-api-key` header with every request:

```bash
curl -X GET https://api.pricepilot.com/v1/products \
  -H "x-api-key: your-api-key-here"
```

### API Key Format

API keys are 64-character hexadecimal strings:
```
a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9d0e1f2
```

### Managing API Keys

**List Your API Keys:**
```bash
curl -X GET https://api.pricepilot.com/v1/user/api-keys \
  -H "x-api-key: your-api-key-here"
```

**Revoke an API Key:**
```bash
curl -X DELETE https://api.pricepilot.com/v1/user/api-keys/{keyId} \
  -H "x-api-key: your-api-key-here"
```

**Create a New API Key:**
```bash
curl -X POST https://api.pricepilot.com/v1/user/api-keys \
  -H "x-api-key: your-api-key-here" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Production Server",
    "description": "API key for production deployment"
  }'
```

---

## Session Authentication

### Login

**Endpoint:** `POST /api/v1/auth/login`

```bash
curl -X POST https://api.pricepilot.com/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "your-password"
  }'
```

**Response:**
```json
{
  "success": true,
  "user": {
    "id": "user-123",
    "email": "user@example.com",
    "name": "John Doe",
    "role": "ADMIN"
  }
}
```

The response includes a session cookie that will be automatically sent with subsequent requests.

### Register

**Endpoint:** `POST /api/v1/auth/register`

```bash
curl -X POST https://api.pricepilot.com/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "newuser@example.com",
    "password": "SecurePass123!",
    "companyName": "Acme Electronics"
  }'
```

**Response:**
```json
{
  "message": "User registered successfully",
  "userId": "user-456"
}
```

### Logout

**Endpoint:** `POST /api/v1/auth/logout`

```bash
curl -X POST https://api.pricepilot.com/v1/auth/logout \
  -H "Cookie: next-auth.session-token=your-session-token"
```

### Session Expiration

- **Idle Timeout:** 30 days of inactivity
- **Absolute Timeout:** 90 days from creation
- **Renewal:** Automatic on each request

---

## Security Best Practices

### 1. Protect Your API Keys

**DO:**
- Store API keys in environment variables
- Use secret management services (AWS Secrets Manager, HashiCorp Vault)
- Rotate keys regularly
- Use different keys for different environments

**DON'T:**
- Commit API keys to version control
- Share API keys via email or chat
- Use the same key across multiple applications
- Expose keys in client-side code

### 2. Environment Variables

**Example (.env file):**
```bash
PRICEPILOT_API_KEY=your-api-key-here
PRICEPILOT_API_URL=https://api.pricepilot.com/v1
```

**Usage in Node.js:**
```javascript
const apiKey = process.env.PRICEPILOT_API_KEY;

fetch('https://api.pricepilot.com/v1/products', {
  headers: {
    'x-api-key': apiKey
  }
});
```

**Usage in Python:**
```python
import os

api_key = os.environ.get('PRICEPILOT_API_KEY')

headers = {
    'x-api-key': api_key
}
```

### 3. HTTPS Only

**Always use HTTPS:**
```bash
# Good
https://api.pricepilot.com/v1/products

# Bad - Never use HTTP
http://api.pricepilot.com/v1/products
```

### 4. Key Rotation

Rotate API keys regularly:

1. Generate new API key
2. Update applications with new key
3. Test thoroughly
4. Revoke old key

**Recommended rotation schedule:**
- Production: Every 90 days
- Development: Every 180 days
- After security incident: Immediately

### 5. Least Privilege

Create separate API keys for different purposes:

```
Production Server: Full access
CI/CD Pipeline: Read-only access
Analytics Tool: Analytics endpoints only
```

---

## Rate Limiting

### Rate Limit Headers

Every API response includes rate limit information:

```
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 995
X-RateLimit-Reset: 1643723400
```

### Rate Limits by Authentication Type

| Auth Type | Limit | Window |
|-----------|-------|--------|
| API Key | 1000 requests | 1 hour |
| Session | 1000 requests | 1 hour |
| Unauthenticated | 100 requests | 1 hour |

### Rate Limits by Endpoint Type

| Endpoint Type | Limit | Window |
|--------------|-------|--------|
| Read (GET) | 1000 | 1 hour |
| Write (POST/PUT/DELETE) | 500 | 1 hour |
| Auth | 20 | 15 minutes |
| Sync | 10 | 1 hour |

### Handling Rate Limits

**Check remaining requests:**
```javascript
const response = await fetch('https://api.pricepilot.com/v1/products', {
  headers: { 'x-api-key': apiKey }
});

const remaining = response.headers.get('X-RateLimit-Remaining');
const reset = response.headers.get('X-RateLimit-Reset');

console.log(`${remaining} requests remaining`);
console.log(`Resets at ${new Date(reset * 1000)}`);
```

**Implement backoff:**
```javascript
async function makeRequestWithBackoff(url, options, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    const response = await fetch(url, options);
    
    if (response.status === 429) {
      const reset = response.headers.get('X-RateLimit-Reset');
      const waitTime = (reset * 1000) - Date.now();
      
      console.log(`Rate limited. Waiting ${waitTime}ms...`);
      await sleep(waitTime);
      continue;
    }
    
    return response;
  }
  
  throw new Error('Max retries exceeded');
}
```

---

## Multi-Tenant Isolation

### Automatic Tenant Context

All authenticated requests automatically include tenant context:

```javascript
// User A (Tenant 1) makes request
fetch('https://api.pricepilot.com/v1/products', {
  headers: { 'x-api-key': 'user-a-key' }
});
// Returns only Tenant 1's products

// User B (Tenant 2) makes request
fetch('https://api.pricepilot.com/v1/products', {
  headers: { 'x-api-key': 'user-b-key' }
});
// Returns only Tenant 2's products
```

### Cross-Tenant Access

Cross-tenant access is **not allowed**. Each API key is scoped to a single tenant.

---

## Authentication Examples

### JavaScript/Node.js

```javascript
const axios = require('axios');

const client = axios.create({
  baseURL: 'https://api.pricepilot.com/v1',
  headers: {
    'x-api-key': process.env.PRICEPILOT_API_KEY
  }
});

// Make authenticated request
const products = await client.get('/products');
console.log(products.data);
```

### Python

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
products = response.json()
print(products)
```

### PHP

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
$products = json_decode($response, true);
curl_close($ch);

print_r($products);
?>
```

### Ruby

```ruby
require 'net/http'
require 'json'

api_key = ENV['PRICEPILOT_API_KEY']
uri = URI('https://api.pricepilot.com/v1/products')

request = Net::HTTP::Get.new(uri)
request['x-api-key'] = api_key

response = Net::HTTP.start(uri.hostname, uri.port, use_ssl: true) do |http|
  http.request(request)
end

products = JSON.parse(response.body)
puts products
```

---

## Troubleshooting

For detailed troubleshooting information, see the [Authentication Guide - Troubleshooting Section](./AUTHENTICATION_GUIDE.md#troubleshooting).

### Quick Diagnostics

**Test API Token:**
```bash
curl -X GET https://api.pricepilot.com/v1/health \
  -H "x-api-key: pp_your_token_here" \
  -v
```

**Test Session:**
```bash
curl -X GET https://api.pricepilot.com/v1/user/profile \
  -H "Cookie: next-auth.session-token=your-session-token" \
  -v
```

**Check Rate Limits:**
```bash
curl -X GET https://api.pricepilot.com/v1/rate-limit \
  -H "x-api-key: pp_your_token_here"
```

### Common Issues

| Error | Quick Fix |
|-------|-----------|
| "Authentication required" | Include `x-api-key` header or session cookie |
| "Invalid API key" | Verify token format starts with `pp_` |
| "Session expired" | Log in again or enable "Remember Me" |
| "Rate limit exceeded" | Wait for reset time in `X-RateLimit-Reset` header |

For complete troubleshooting guide with detailed solutions, see [Authentication Guide](./AUTHENTICATION_GUIDE.md#troubleshooting).

---

## Security Checklist

- [ ] API keys stored in environment variables
- [ ] API keys not committed to version control
- [ ] HTTPS used for all requests
- [ ] Rate limit monitoring implemented
- [ ] Error handling for 401/403 responses
- [ ] API keys rotated regularly
- [ ] Separate keys for different environments
- [ ] Least privilege access implemented
- [ ] Logging excludes sensitive data
- [ ] API key revocation process documented

---

## Support

For authentication issues:

- **Documentation:** https://docs.pricepilot.com/authentication
- **Support:** support@pricepilot.com
- **Security Issues:** security@pricepilot.com
