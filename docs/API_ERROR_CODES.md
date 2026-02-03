# PricePilot API Error Codes

This document provides a comprehensive reference for all error codes returned by the PricePilot API.

## Table of Contents

1. [Error Response Format](#error-response-format)
2. [HTTP Status Codes](#http-status-codes)
3. [Error Codes Reference](#error-codes-reference)
4. [Validation Errors](#validation-errors)
5. [Authentication Errors](#authentication-errors)
6. [Authorization Errors](#authorization-errors)
7. [Resource Errors](#resource-errors)
8. [Rate Limiting Errors](#rate-limiting-errors)
9. [Business Logic Errors](#business-logic-errors)
10. [Server Errors](#server-errors)

---

## Error Response Format

All API errors follow a consistent format:

### Standard Error Response

```json
{
  "error": "Error message describing what went wrong"
}
```

### Validation Error Response

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation failed",
    "details": {
      "fields": {
        "fieldName": ["Error message 1", "Error message 2"]
      }
    }
  }
}
```

---

## HTTP Status Codes

| Status Code | Meaning | Description |
|------------|---------|-------------|
| 200 | OK | Request succeeded |
| 201 | Created | Resource created successfully |
| 204 | No Content | Request succeeded with no response body |
| 400 | Bad Request | Invalid request format or parameters |
| 401 | Unauthorized | Authentication required or invalid |
| 403 | Forbidden | Insufficient permissions or limit reached |
| 404 | Not Found | Resource does not exist |
| 409 | Conflict | Resource already exists or operation conflicts |
| 422 | Unprocessable Entity | Validation failed |
| 429 | Too Many Requests | Rate limit exceeded |
| 500 | Internal Server Error | Unexpected server error |
| 503 | Service Unavailable | Service temporarily unavailable |

---

## Error Codes Reference

### VALIDATION_ERROR (422)

**Description:** Request validation failed. One or more fields contain invalid data.

**Example:**
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation failed",
    "details": {
      "fields": {
        "email": ["Invalid email format"],
        "password": ["Password must be at least 8 characters"],
        "maxPriceChange": ["Must be greater than 0"]
      }
    }
  }
}
```

**Common Causes:**
- Invalid email format
- Password too short
- Missing required fields
- Invalid data types
- Values out of range

**Resolution:**
- Check the `details.fields` object for specific field errors
- Correct the invalid fields and retry

---

### UNAUTHORIZED (401)

**Description:** Authentication required or credentials are invalid.

**Example:**
```json
{
  "error": "Authentication required to access products"
}
```

**Common Causes:**
- Missing API key
- Invalid API key
- Expired session
- API key revoked

**Resolution:**
- Include valid API key in `x-api-key` header
- Generate new API key from dashboard
- Re-authenticate if using session auth

---

### FORBIDDEN (403)

**Description:** Insufficient permissions or resource limit reached.

**Example:**
```json
{
  "error": "Competitor tracking limit reached (5). Please upgrade your plan to track more sites."
}
```

**Common Causes:**
- Resource limit reached (competitors, stores, products)
- Insufficient role permissions
- Tenant-level restrictions
- Feature not available in current plan

**Resolution:**
- Upgrade your plan for higher limits
- Contact support for permission issues
- Remove existing resources before adding new ones

---

### NOT_FOUND (404)

**Description:** The requested resource does not exist.

**Example:**
```json
{
  "error": "Resource not found"
}
```

**Common Causes:**
- Invalid resource ID
- Resource deleted
- Wrong tenant context
- Typo in endpoint URL

**Resolution:**
- Verify the resource ID is correct
- Check if resource was deleted
- Ensure you're accessing resources in your tenant

---

### CONFLICT (409)

**Description:** Resource already exists or operation conflicts with current state.

**Example:**
```json
{
  "error": "User with this email already exists"
}
```

**Common Causes:**
- Duplicate email during registration
- Sync already in progress
- Resource already exists
- Concurrent modification

**Resolution:**
- Use different email for registration
- Wait for current sync to complete
- Check if resource already exists

---

### RATE_LIMIT_EXCEEDED (429)

**Description:** Too many requests. Rate limit exceeded.

**Example:**
```json
{
  "error": "Rate limit exceeded. Please try again later."
}
```

**Rate Limits:**
- Authenticated: 1000 requests/hour
- Unauthenticated: 100 requests/hour
- Scraping: 10 requests/minute

**Response Headers:**
```
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 1643723400
```

**Resolution:**
- Wait until rate limit resets (check `X-RateLimit-Reset` header)
- Implement exponential backoff
- Reduce request frequency
- Cache responses when possible

---

### INTERNAL_ERROR (500)

**Description:** Unexpected server error occurred.

**Example:**
```json
{
  "error": "An unexpected error occurred"
}
```

**Common Causes:**
- Database connection failure
- External service timeout
- Unhandled exception
- System overload

**Resolution:**
- Retry the request after a delay
- Check API status page
- Contact support if error persists

---

## Validation Errors

### Email Validation

```json
{
  "fields": {
    "email": [
      "Invalid email format",
      "Email is required"
    ]
  }
}
```

**Valid formats:**
- `user@example.com`
- `user.name@example.co.uk`
- `user+tag@example.com`

---

### Password Validation

```json
{
  "fields": {
    "password": [
      "Password must be at least 8 characters",
      "Password is required"
    ]
  }
}
```

**Requirements:**
- Minimum 8 characters
- Recommended: Mix of uppercase, lowercase, numbers, symbols

---

### URL Validation

```json
{
  "fields": {
    "url": [
      "Invalid URL format",
      "URL must start with http:// or https://"
    ]
  }
}
```

**Valid formats:**
- `https://example.com`
- `https://www.example.com`
- `https://example.com/path`

---

### Price Validation

```json
{
  "fields": {
    "maxPriceChange": [
      "Must be greater than 0",
      "Must be a number"
    ],
    "minPrice": [
      "Must be greater than or equal to 0"
    ]
  }
}
```

**Requirements:**
- Must be numeric
- Price changes must be > 0
- Minimum prices must be >= 0

---

### Array Validation

```json
{
  "fields": {
    "changeIds": [
      "Must be an array",
      "Must contain at least 1 item"
    ],
    "product_ids": [
      "All items must be valid UUIDs"
    ]
  }
}
```

---

## Authentication Errors

### Missing API Key

**Request:**
```bash
curl -X GET https://api.pricepilot.com/v1/products
```

**Response (401):**
```json
{
  "error": "Authentication required to access products"
}
```

**Fix:**
```bash
curl -X GET https://api.pricepilot.com/v1/products \
  -H "x-api-key: your-api-key-here"
```

---

### Invalid API Key

**Response (401):**
```json
{
  "error": "Invalid API key"
}
```

**Resolution:**
- Verify API key is correct
- Check for extra spaces or characters
- Generate new API key if needed

---

### Expired Session

**Response (401):**
```json
{
  "error": "Session expired. Please log in again."
}
```

**Resolution:**
- Re-authenticate through login endpoint
- Use API key authentication for programmatic access

---

## Authorization Errors

### Insufficient Permissions

**Response (403):**
```json
{
  "error": "Insufficient permissions to perform this action"
}
```

**Common Scenarios:**
- User role doesn't have required permissions
- Trying to access another tenant's resources
- Feature requires admin role

---

### Resource Limit Reached

**Competitor Limit:**
```json
{
  "error": "Competitor tracking limit reached (5). Please upgrade your plan to track more sites."
}
```

**Store Limit:**
```json
{
  "error": "Site integration limit reached (3). Please upgrade your plan or contact support to add more stores."
}
```

**Resolution:**
- Upgrade to higher plan tier
- Remove existing resources
- Contact sales for custom limits

---

## Resource Errors

### Resource Not Found

**Response (404):**
```json
{
  "error": "Resource not found"
}
```

**Common Causes:**
- Invalid ID in URL path
- Resource deleted
- Wrong tenant context

---

### Resource Already Exists

**Response (409):**
```json
{
  "error": "User with this email already exists"
}
```

**Resolution:**
- Use different identifier
- Update existing resource instead
- Check if resource was already created

---

### Invalid Resource State

**Response (400):**
```json
{
  "error": "Some changes not found or already processed"
}
```

**Common Scenarios:**
- Trying to approve already-approved changes
- Operating on deleted resources
- Concurrent modifications

---

## Rate Limiting Errors

### Rate Limit Structure

**Headers in Every Response:**
```
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 995
X-RateLimit-Reset: 1643723400
```

### Rate Limit Exceeded

**Response (429):**
```json
{
  "error": "Rate limit exceeded. Please try again later."
}
```

**Limits by Endpoint Type:**

| Endpoint Type | Limit | Window |
|--------------|-------|--------|
| Read (GET) | 1000 | 1 hour |
| Write (POST/PUT/DELETE) | 500 | 1 hour |
| Auth | 20 | 15 minutes |
| Sync | 10 | 1 hour |

### Handling Rate Limits

**JavaScript Example:**
```javascript
async function makeRequest(url) {
  const response = await fetch(url, {
    headers: { 'x-api-key': 'your-key' }
  });
  
  const remaining = response.headers.get('X-RateLimit-Remaining');
  const reset = response.headers.get('X-RateLimit-Reset');
  
  if (response.status === 429) {
    const waitTime = reset - Date.now() / 1000;
    console.log(`Rate limited. Waiting ${waitTime} seconds...`);
    await sleep(waitTime * 1000);
    return makeRequest(url); // Retry
  }
  
  if (remaining < 10) {
    console.warn('Approaching rate limit');
  }
  
  return response.json();
}
```

---

## Business Logic Errors

### Sync Already in Progress

**Response (409):**
```json
{
  "skipped": true,
  "message": "Sync already in progress"
}
```

**Resolution:**
- Wait for current sync to complete
- Check sync status via competitors endpoint

---

### Invalid Pricing Strategy

**Response (400):**
```json
{
  "error": "Invalid pricing strategy for product"
}
```

**Common Causes:**
- Trying to undercut when no competitor price exists
- Invalid strategy value
- Price would go below minimum

---

### Product Not Matched

**Response (400):**
```json
{
  "error": "Product has no competitor match"
}
```

**Resolution:**
- Approve pending matches first
- Add competitors
- Wait for automatic matching

---

## Server Errors

### Internal Server Error

**Response (500):**
```json
{
  "error": "An unexpected error occurred"
}
```

**What to do:**
1. Retry with exponential backoff
2. Check API status page
3. Contact support with request ID

---

### Service Unavailable

**Response (503):**
```json
{
  "error": "Service temporarily unavailable"
}
```

**Common Causes:**
- Scheduled maintenance
- System overload
- Database maintenance

**Resolution:**
- Check status page for maintenance windows
- Retry after delay
- Subscribe to status updates

---

## Error Handling Best Practices

### 1. Always Check Status Code

```javascript
if (!response.ok) {
  const error = await response.json();
  throw new Error(error.error || 'Request failed');
}
```

### 2. Handle Validation Errors

```javascript
if (response.status === 422) {
  const { error } = await response.json();
  const fieldErrors = error.details.fields;
  
  // Display field-specific errors to user
  Object.entries(fieldErrors).forEach(([field, errors]) => {
    console.error(`${field}: ${errors.join(', ')}`);
  });
}
```

### 3. Implement Retry Logic

```javascript
async function retryRequest(fn, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      
      // Exponential backoff
      const delay = Math.pow(2, i) * 1000;
      await sleep(delay);
    }
  }
}
```

### 4. Monitor Rate Limits

```javascript
class RateLimitMonitor {
  constructor() {
    this.remaining = Infinity;
    this.reset = 0;
  }
  
  update(response) {
    this.remaining = parseInt(response.headers.get('X-RateLimit-Remaining'));
    this.reset = parseInt(response.headers.get('X-RateLimit-Reset'));
  }
  
  shouldWait() {
    return this.remaining < 10;
  }
  
  getWaitTime() {
    return Math.max(0, this.reset - Date.now() / 1000);
  }
}
```

### 5. Log Errors with Context

```javascript
function logError(error, context) {
  console.error({
    timestamp: new Date().toISOString(),
    error: error.message,
    status: error.status,
    endpoint: context.endpoint,
    method: context.method,
    requestId: error.requestId
  });
}
```

---

## Support

If you encounter an error not documented here:

1. **Check API Status:** https://status.pricepilot.com
2. **Review Documentation:** https://docs.pricepilot.com
3. **Contact Support:** support@pricepilot.com
4. **Include:**
   - Error message
   - Request ID (if available)
   - Endpoint and method
   - Timestamp
   - Steps to reproduce
