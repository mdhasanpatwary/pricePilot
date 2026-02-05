---
title: "API Error Codes"
description: "Complete reference of API error codes"
category: "troubleshooting"
tags: ["api", "errors", "troubleshooting"]
audience: "tenant"
relatedDocs: ["/admin-docs/system-monitoring/api-error-codes.md"]
---

# PricePilot API Error Codes Reference

**Version:** 1.0.0  
**Last Updated:** February 3, 2026

This document provides a comprehensive reference for all error codes returned by the PricePilot API. Use this guide to understand error responses, implement proper error handling, and troubleshoot issues.

## Table of Contents

1. [Error Response Format](#error-response-format)
2. [HTTP Status Codes](#http-status-codes)
3. [Error Codes Quick Reference](#error-codes-quick-reference)
4. [Validation Errors](#validation-errors)
5. [Authentication Errors](#authentication-errors)
6. [Authorization Errors](#authorization-errors)
7. [Resource Errors](#resource-errors)
8. [Rate Limiting Errors](#rate-limiting-errors)
9. [Business Logic Errors](#business-logic-errors)
10. [External Service Errors](#external-service-errors)
11. [Server Errors](#server-errors)
12. [Error Handling Best Practices](#error-handling-best-practices)
13. [Retry Guidelines](#retry-guidelines)

---

## Error Response Format

All API errors follow a consistent, standardized format to ensure predictable error handling across all endpoints.

### Standard Error Response (Simple)

Used for most errors with a simple error message:

```json
{
  "error": "Error message describing what went wrong"
}
```

**Example:**
```json
{
  "error": "Authentication required to access products"
}
```

### Structured Error Response (Detailed)

Used for validation errors and complex error scenarios:

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message",
    "details": {
      // Additional error-specific information
    }
  },
  "meta": {
    "requestId": "550e8400-e29b-41d4-a716-446655440000",
    "timestamp": "2026-02-03T10:30:00.000Z"
  }
}
```

**Example:**
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "The information you provided is invalid",
    "details": {
      "fields": {
        "email": ["Invalid email format"],
        "password": ["Password must be at least 8 characters"]
      }
    }
  },
  "meta": {
    "requestId": "550e8400-e29b-41d4-a716-446655440000",
    "timestamp": "2026-02-03T10:30:00.000Z"
  }
}
```

### Response Headers

All error responses include these headers:

```
Content-Type: application/json
X-Request-ID: 550e8400-e29b-41d4-a716-446655440000
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 995
X-RateLimit-Reset: 1643723400
```

---

## HTTP Status Codes

PricePilot API uses standard HTTP status codes to indicate the success or failure of requests.

### Success Codes (2xx)

| Status Code | Name | Description | When Used |
|------------|------|-------------|-----------|
| 200 | OK | Request succeeded | GET, PUT, PATCH requests |
| 201 | Created | Resource created successfully | POST requests creating new resources |
| 204 | No Content | Request succeeded with no response body | DELETE requests |

### Client Error Codes (4xx)

| Status Code | Name | Description | When Used |
|------------|------|-------------|-----------|
| 400 | Bad Request | Invalid request format or parameters | Malformed JSON, invalid query params |
| 401 | Unauthorized | Authentication required or invalid | Missing/invalid API key or session |
| 403 | Forbidden | Insufficient permissions or limit reached | Permission denied, plan limits |
| 404 | Not Found | Resource does not exist | Invalid resource ID |
| 409 | Conflict | Resource already exists or operation conflicts | Duplicate resources, concurrent edits |
| 422 | Unprocessable Entity | Validation failed | Invalid field values |
| 429 | Too Many Requests | Rate limit exceeded | Too many requests in time window |

### Server Error Codes (5xx)

| Status Code | Name | Description | When Used |
|------------|------|-------------|-----------|
| 500 | Internal Server Error | Unexpected server error | Unhandled exceptions |
| 502 | Bad Gateway | External service failure | Third-party API errors |
| 503 | Service Unavailable | Service temporarily unavailable | Maintenance, overload |

---

## Error Codes Quick Reference

Complete list of all error codes used in the PricePilot API.

### General Errors

| Error Code | HTTP Status | Description | Retryable |
|-----------|-------------|-------------|-----------|
| `INTERNAL_ERROR` | 500 | Unexpected server error | Yes (with backoff) |
| `SERVICE_UNAVAILABLE` | 503 | Service temporarily unavailable | Yes (with backoff) |
| `DATABASE_ERROR` | 500 | Database operation failed | Yes (with backoff) |
| `NETWORK_ERROR` | 502 | Network connectivity issue | Yes (with backoff) |
| `NETWORK_TIMEOUT` | 504 | Request timeout | Yes (with backoff) |

### Validation Errors

| Error Code | HTTP Status | Description | Retryable |
|-----------|-------------|-------------|-----------|
| `VALIDATION_ERROR` | 422 | Input validation failed | No |
| `INVALID_EMAIL` | 422 | Invalid email format | No |
| `INVALID_URL` | 422 | Invalid URL format | No |
| `INVALID_PRICE` | 422 | Invalid price value | No |
| `REQUIRED_FIELD` | 422 | Required field missing | No |
| `INVALID_FILE_TYPE` | 422 | Unsupported file type | No |
| `FILE_TOO_LARGE` | 422 | File exceeds size limit | No |

### Authentication & Authorization Errors

| Error Code | HTTP Status | Description | Retryable |
|-----------|-------------|-------------|-----------|
| `UNAUTHORIZED` | 401 | Authentication required | No |
| `INVALID_CREDENTIALS` | 401 | Invalid email or password | No |
| `INVALID_API_TOKEN` | 401 | Invalid or expired API token | No |
| `SESSION_EXPIRED` | 401 | Session has expired | No |
| `ACCOUNT_LOCKED` | 401 | Account temporarily locked | No |
| `FORBIDDEN` | 403 | Insufficient permissions | No |
| `FEATURE_NOT_AVAILABLE` | 403 | Feature not in current plan | No |
| `SUBSCRIPTION_EXPIRED` | 403 | Subscription has expired | No |

### Resource Errors

| Error Code | HTTP Status | Description | Retryable |
|-----------|-------------|-------------|-----------|
| `NOT_FOUND` | 404 | Resource not found | No |
| `PRODUCT_NOT_FOUND` | 404 | Product not found | No |
| `WEBSITE_NOT_FOUND` | 404 | Website configuration not found | No |
| `COMPETITOR_NOT_FOUND` | 404 | Competitor not found | No |
| `TENANT_NOT_FOUND` | 404 | Tenant account not found | No |
| `CONFLICT` | 409 | Resource conflict | No |

### Rate Limiting Errors

| Error Code | HTTP Status | Description | Retryable |
|-----------|-------------|-------------|-----------|
| `RATE_LIMIT_EXCEEDED` | 429 | Too many requests | Yes (after reset) |

### Business Logic Errors

| Error Code | HTTP Status | Description | Retryable |
|-----------|-------------|-------------|-----------|
| `PRODUCT_SYNC_FAILED` | 502 | Product sync failed | Yes |
| `PRODUCT_UPDATE_FAILED` | 502 | Price update failed | Yes |
| `WEBSITE_CONNECTION_FAILED` | 502 | Cannot connect to website | Yes |
| `SCRAPING_FAILED` | 502 | Competitor scraping failed | Yes |
| `SCRAPING_BLOCKED` | 403 | Scraping blocked by website | No |
| `MATCHING_FAILED` | 500 | Product matching failed | Yes |
| `NO_MATCHES_FOUND` | 404 | No matching products | No |
| `PRICE_BELOW_MINIMUM` | 422 | Price below minimum threshold | No |
| `PRICE_UPDATE_REJECTED` | 422 | Price update rejected | No |

### External Service Errors

| Error Code | HTTP Status | Description | Retryable |
|-----------|-------------|-------------|-----------|
| `EXTERNAL_SERVICE_ERROR` | 502 | Third-party service error | Yes (if transient) |
| `AUTHENTICATION_FAILED` | 401 | External auth failed | No |
| `ENCRYPTION_FAILED` | 500 | Encryption operation failed | No |
| `DECRYPTION_FAILED` | 500 | Decryption operation failed | No |

---

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

Validation errors occur when the request data doesn't meet the required format or constraints. These errors are **not retryable** and require the client to correct the input.

### VALIDATION_ERROR (422)

**Description:** One or more fields contain invalid data.

**User Message:** "The information you provided is invalid. Please check the highlighted fields and try again."

**Response Example:**
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "The information you provided is invalid",
    "details": {
      "fields": {
        "email": ["Invalid email format"],
        "password": ["Password must be at least 8 characters"],
        "maxPriceChange": ["Must be greater than 0"],
        "url": ["URL must start with http:// or https://"]
      }
    }
  },
  "meta": {
    "requestId": "550e8400-e29b-41d4-a716-446655440000",
    "timestamp": "2026-02-03T10:30:00.000Z"
  }
}
```

**Common Causes:**
- Invalid email format
- Password too short or weak
- Missing required fields
- Invalid data types (string instead of number)
- Values out of acceptable range
- Invalid URL format
- Invalid date format

**How to Fix:**
1. Check the `details.fields` object for specific field errors
2. Correct each invalid field according to the error message
3. Ensure all required fields are provided
4. Verify data types match the API specification
5. Retry the request with corrected data

**Example Fix:**
```javascript
// Before (invalid)
const response = await fetch('/api/v1/sites', {
  method: 'POST',
  headers: { 'x-api-key': apiKey },
  body: JSON.stringify({
    url: 'invalid-url',  // Missing protocol
    apiToken: '',        // Empty required field
  })
});

// After (valid)
const response = await fetch('/api/v1/sites', {
  method: 'POST',
  headers: { 'x-api-key': apiKey },
  body: JSON.stringify({
    url: 'https://mystore.com',
    apiToken: 'valid-token-here',
    type: 'OPENCART'
  })
});
```

### Field-Specific Validation Errors

#### Email Validation

**Error Messages:**
- "Invalid email format"
- "Email is required"
- "Email already exists"

**Valid Formats:**
```
user@example.com
user.name@example.co.uk
user+tag@example.com
```

**Invalid Formats:**
```
user@                    // Missing domain
@example.com            // Missing local part
user@example            // Missing TLD
user example@test.com   // Contains space
```

#### Password Validation

**Error Messages:**
- "Password must be at least 8 characters"
- "Password is required"
- "Password must contain uppercase, lowercase, number, and symbol"

**Requirements:**
- Minimum 8 characters
- At least one uppercase letter (recommended)
- At least one lowercase letter (recommended)
- At least one number (recommended)
- At least one special character (recommended)

**Example:**
```javascript
// Weak password (rejected)
password: "12345"

// Strong password (accepted)
password: "MyP@ssw0rd2026"
```

#### URL Validation

**Error Messages:**
- "Invalid URL format"
- "URL must start with http:// or https://"
- "URL is required"

**Valid Formats:**
```
https://example.com
https://www.example.com
https://example.com/path
https://subdomain.example.com
```

**Invalid Formats:**
```
example.com              // Missing protocol
www.example.com          // Missing protocol
ftp://example.com        // Wrong protocol
https://                 // Missing domain
```

#### Price Validation

**Error Messages:**
- "Must be greater than 0"
- "Must be a number"
- "Price is required"
- "Invalid price format"

**Valid Values:**
```json
{
  "price": 99.99,
  "minPrice": 50.00,
  "maxPriceChange": 10.00
}
```

**Invalid Values:**
```json
{
  "price": -10,           // Negative
  "minPrice": "fifty",    // Not a number
  "maxPriceChange": 0     // Must be > 0
}
```

#### Array Validation

**Error Messages:**
- "Must be an array"
- "Must contain at least 1 item"
- "All items must be valid UUIDs"
- "Array cannot be empty"

**Example:**
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation failed",
    "details": {
      "fields": {
        "changeIds": ["Must be an array", "Must contain at least 1 item"],
        "productIds": ["All items must be valid UUIDs"]
      }
    }
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


---

## Retry Guidelines

Understanding when and how to retry failed requests is crucial for building resilient applications.

### Retryable vs Non-Retryable Errors

#### Retryable Errors (Transient Failures)

These errors are temporary and may succeed if retried:

| Error Code | Retry Strategy | Wait Time |
|-----------|----------------|-----------|
| `RATE_LIMIT_EXCEEDED` | Yes | Check `X-RateLimit-Reset` header |
| `INTERNAL_ERROR` | Yes | Exponential backoff (1s, 2s, 4s, 8s) |
| `SERVICE_UNAVAILABLE` | Yes | Exponential backoff |
| `NETWORK_TIMEOUT` | Yes | Exponential backoff |
| `NETWORK_ERROR` | Yes | Exponential backoff |
| `DATABASE_ERROR` | Yes | Exponential backoff |
| `EXTERNAL_SERVICE_ERROR` | Maybe | Check `isRetryable` field |
| `PRODUCT_SYNC_FAILED` | Yes | Exponential backoff |
| `SCRAPING_FAILED` | Yes | Exponential backoff |

#### Non-Retryable Errors (Permanent Failures)

These errors require client-side fixes and should not be retried:

| Error Code | Why Not Retryable | Action Required |
|-----------|-------------------|-----------------|
| `VALIDATION_ERROR` | Invalid input data | Fix input and retry |
| `UNAUTHORIZED` | Invalid credentials | Update credentials |
| `FORBIDDEN` | Insufficient permissions | Upgrade plan or request access |
| `NOT_FOUND` | Resource doesn't exist | Verify resource ID |
| `CONFLICT` | Resource already exists | Use different identifier |
| `SCRAPING_BLOCKED` | Website blocks scraping | Contact support |
| `PRICE_BELOW_MINIMUM` | Business rule violation | Adjust pricing rules |

### Retry Implementation Patterns

#### 1. Exponential Backoff

Recommended for most retryable errors:

```javascript
async function retryWithBackoff(fn, maxRetries = 3) {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      // Don't retry on last attempt
      if (attempt === maxRetries - 1) {
        throw error;
      }
      
      // Check if error is retryable
      if (!isRetryable(error)) {
        throw error;
      }
      
      // Calculate backoff delay: 2^attempt seconds
      const delayMs = Math.pow(2, attempt) * 1000;
      
      // Add jitter to prevent thundering herd
      const jitter = Math.random() * 1000;
      
      console.log(`Retry attempt ${attempt + 1} after ${delayMs + jitter}ms`);
      await sleep(delayMs + jitter);
    }
  }
}

function isRetryable(error) {
  const retryableCodes = [
    'INTERNAL_ERROR',
    'SERVICE_UNAVAILABLE',
    'NETWORK_TIMEOUT',
    'NETWORK_ERROR',
    'DATABASE_ERROR',
    'PRODUCT_SYNC_FAILED',
    'SCRAPING_FAILED'
  ];
  
  return error.status >= 500 || 
         retryableCodes.includes(error.code) ||
         error.isRetryable === true;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Usage
try {
  const result = await retryWithBackoff(async () => {
    return await fetch('/api/v1/products', {
      headers: { 'x-api-key': apiKey }
    });
  });
} catch (error) {
  console.error('Request failed after retries:', error);
}
```

#### 2. Rate Limit Handling

Special handling for rate limit errors:

```javascript
async function handleRateLimit(fn) {
  try {
    const response = await fn();
    
    // Check rate limit headers
    const remaining = parseInt(response.headers.get('X-RateLimit-Remaining'));
    const reset = parseInt(response.headers.get('X-RateLimit-Reset'));
    
    // Warn if approaching limit
    if (remaining < 10) {
      console.warn(`Approaching rate limit: ${remaining} requests remaining`);
    }
    
    return response;
    
  } catch (error) {
    if (error.status === 429) {
      // Extract retry-after from error details
      const retryAfter = error.details?.retryAfter || 60;
      
      console.log(`Rate limited. Waiting ${retryAfter} seconds...`);
      await sleep(retryAfter * 1000);
      
      // Retry once after waiting
      return await fn();
    }
    
    throw error;
  }
}

// Usage
const response = await handleRateLimit(async () => {
  return await fetch('/api/v1/products', {
    headers: { 'x-api-key': apiKey }
  });
});
```

#### 3. Circuit Breaker Pattern

Prevent cascading failures:

```javascript
class CircuitBreaker {
  constructor(threshold = 5, timeout = 60000) {
    this.failureCount = 0;
    this.threshold = threshold;
    this.timeout = timeout;
    this.state = 'CLOSED'; // CLOSED, OPEN, HALF_OPEN
    this.nextAttempt = Date.now();
  }
  
  async execute(fn) {
    if (this.state === 'OPEN') {
      if (Date.now() < this.nextAttempt) {
        throw new Error('Circuit breaker is OPEN');
      }
      this.state = 'HALF_OPEN';
    }
    
    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }
  
  onSuccess() {
    this.failureCount = 0;
    this.state = 'CLOSED';
  }
  
  onFailure() {
    this.failureCount++;
    if (this.failureCount >= this.threshold) {
      this.state = 'OPEN';
      this.nextAttempt = Date.now() + this.timeout;
      console.warn('Circuit breaker opened');
    }
  }
}

// Usage
const breaker = new CircuitBreaker();

try {
  const result = await breaker.execute(async () => {
    return await fetch('/api/v1/products', {
      headers: { 'x-api-key': apiKey }
    });
  });
} catch (error) {
  console.error('Request failed:', error);
}
```

### Retry Best Practices

1. **Always Use Exponential Backoff**
   - Start with 1 second delay
   - Double the delay on each retry
   - Add random jitter to prevent thundering herd
   - Cap maximum delay at 60 seconds

2. **Limit Retry Attempts**
   - Maximum 3-5 retries for most operations
   - Fail fast for non-retryable errors
   - Log all retry attempts for debugging

3. **Check Error Details**
   - Look for `isRetryable` field in error response
   - Check `retryAfter` for recommended wait time
   - Respect rate limit headers

4. **Monitor Retry Metrics**
   - Track retry success/failure rates
   - Alert on high retry rates
   - Identify problematic endpoints

5. **Implement Timeouts**
   - Set reasonable request timeouts (10-30 seconds)
   - Don't retry indefinitely
   - Fail gracefully after max retries

6. **Handle Partial Failures**
   - For batch operations, track which items failed
   - Retry only failed items
   - Provide detailed failure reports

### Example: Complete Retry Implementation

```javascript
class ApiClient {
  constructor(apiKey, options = {}) {
    this.apiKey = apiKey;
    this.baseUrl = options.baseUrl || 'https://api.pricepilot.com/v1';
    this.maxRetries = options.maxRetries || 3;
    this.timeout = options.timeout || 30000;
  }
  
  async request(endpoint, options = {}) {
    const url = `${this.baseUrl}${endpoint}`;
    
    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeout);
        
        const response = await fetch(url, {
          ...options,
          headers: {
            'x-api-key': this.apiKey,
            'Content-Type': 'application/json',
            ...options.headers
          },
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        // Handle rate limiting
        if (response.status === 429) {
          const retryAfter = parseInt(response.headers.get('Retry-After') || '60');
          
          if (attempt < this.maxRetries - 1) {
            console.log(`Rate limited. Waiting ${retryAfter}s before retry ${attempt + 1}`);
            await this.sleep(retryAfter * 1000);
            continue;
          }
        }
        
        // Handle server errors with retry
        if (response.status >= 500 && attempt < this.maxRetries - 1) {
          const delay = Math.pow(2, attempt) * 1000;
          const jitter = Math.random() * 1000;
          console.log(`Server error. Retrying in ${delay + jitter}ms`);
          await this.sleep(delay + jitter);
          continue;
        }
        
        // Parse response
        const data = await response.json();
        
        if (!response.ok) {
          throw new ApiError(data, response.status);
        }
        
        return data;
        
      } catch (error) {
        // Don't retry on last attempt
        if (attempt === this.maxRetries - 1) {
          throw error;
        }
        
        // Don't retry client errors (4xx except 429)
        if (error.status >= 400 && error.status < 500 && error.status !== 429) {
          throw error;
        }
        
        // Retry on network errors
        const delay = Math.pow(2, attempt) * 1000;
        const jitter = Math.random() * 1000;
        console.log(`Request failed. Retrying in ${delay + jitter}ms`);
        await this.sleep(delay + jitter);
      }
    }
  }
  
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

class ApiError extends Error {
  constructor(data, status) {
    super(data.error?.message || data.error || 'API request failed');
    this.name = 'ApiError';
    this.status = status;
    this.code = data.error?.code;
    this.details = data.error?.details;
  }
}

// Usage
const client = new ApiClient('your-api-key');

try {
  const products = await client.request('/products');
  console.log('Products:', products);
} catch (error) {
  if (error instanceof ApiError) {
    console.error(`API Error [${error.code}]:`, error.message);
    console.error('Details:', error.details);
  } else {
    console.error('Unexpected error:', error);
  }
}
```

---

## Additional Resources

### Related Documentation

- [API Authentication Guide](./AUTHENTICATION_GUIDE.md) - Complete authentication documentation
- [API Documentation Index](./API_DOCUMENTATION_INDEX.md) - All API endpoints
- [Error Handling Guide](./ERROR_HANDLING_GUIDE.md) - Error handling best practices
- [Rate Limiting Guide](./RATE_LIMITING.md) - Rate limiting details

### Support Resources

- **API Status Page:** https://status.pricepilot.com
- **Developer Documentation:** https://docs.pricepilot.com
- **Support Email:** support@pricepilot.com
- **Community Forum:** https://community.pricepilot.com

### Reporting Issues

When reporting an error, please include:

1. **Error Details:**
   - Error code
   - Error message
   - HTTP status code
   - Request ID (from `X-Request-ID` header or `meta.requestId`)

2. **Request Information:**
   - Endpoint URL
   - HTTP method
   - Request headers (excluding sensitive data)
   - Request body (excluding sensitive data)

3. **Context:**
   - Timestamp of the error
   - Frequency (one-time or recurring)
   - Steps to reproduce
   - Expected vs actual behavior

4. **Environment:**
   - Client library/SDK version
   - Programming language and version
   - Operating system

### Example Error Report

```
Subject: API Error - EXTERNAL_SERVICE_ERROR on product sync

Error Details:
- Error Code: EXTERNAL_SERVICE_ERROR
- HTTP Status: 502
- Message: "Unable to connect to OpenCart"
- Request ID: 550e8400-e29b-41d4-a716-446655440000

Request Information:
- Endpoint: POST /api/v1/sites/abc123/sync
- Method: POST
- Timestamp: 2026-02-03T10:30:00.000Z

Context:
- This error occurs every time I try to sync products
- Started happening after updating OpenCart to version 4.0
- Expected: Products should sync successfully
- Actual: Sync fails with connection error

Environment:
- Node.js v18.17.0
- Using fetch API
- macOS 13.4
```

---

**Document Version:** 1.0.0  
**Last Updated:** February 3, 2026  
**Maintained By:** PricePilot Engineering Team

For questions or suggestions about this documentation, please contact: docs@pricepilot.com
