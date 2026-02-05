---
title: "API Documentation Index"
description: "Complete index of PricePilot API documentation"
category: "pricing"
tags: ["api", "reference", "index"]
audience: "tenant"
---

# PricePilot API Documentation Index

Welcome to the PricePilot API documentation. This index provides quick access to all API-related documentation.

## Quick Links

- **OpenAPI Specification:** [/public/openapi.json](../public/openapi.json)
- **Request/Response Examples:** [API Request/Response Examples](./API_REQUEST_RESPONSE_EXAMPLES.md) - **Comprehensive examples for all endpoints**
- **Interactive API Docs:** https://api.pricepilot.com/docs
- **API Status:** https://status.pricepilot.com
- **Support:** support@pricepilot.com

---

## Documentation Structure

### 1. Getting Started

#### [Authentication Guide](./API_AUTHENTICATION.md)
Learn how to authenticate with the PricePilot API using API keys or session authentication.

**Topics covered:**
- API key generation and management
- Session-based authentication
- Security best practices
- Rate limiting
- Multi-tenant isolation

#### [Usage Examples](./API_USAGE_EXAMPLES.md)
Practical examples for common API operations with code samples in multiple languages.

**Topics covered:**
- Authentication examples
- Product management
- Competitor tracking
- Price approvals
- Bulk operations
- SDK examples (JavaScript, Python, PHP, Ruby)

#### [Error Codes Reference](./API_ERROR_CODES.md)
Comprehensive guide to all error codes and how to handle them.

**Topics covered:**
- Error response formats
- HTTP status codes
- Validation errors
- Authentication errors
- Rate limiting errors
- Troubleshooting guide

---

## API Reference

### Core Resources

#### Products
Manage your product catalog and view competitor price comparisons.

**Endpoints:**
- `GET /products` - List all products with pagination and filtering
- `GET /products/{id}` - Get single product details
- `PUT /products/{id}` - Update product information
- `DELETE /products/{id}` - Delete a product

**Key Features:**
- Real-time price comparisons
- Advanced filtering (brand, category, stock status)
- Full-text search
- Pagination support
- Sorting options

#### Competitors
Track competitor websites and their products.

**Endpoints:**
- `GET /competitors` - List all tracked competitors
- `POST /competitors` - Add new competitor
- `GET /competitors/{id}` - Get competitor details
- `DELETE /competitors/{id}` - Remove competitor

**Key Features:**
- Automatic product scraping
- Sync status monitoring
- Health tracking
- Advanced protection detection

#### Price Approvals
Review and approve price changes before they're applied to your store.

**Endpoints:**
- `GET /price-approvals` - List pending approvals
- `POST /price-approvals` - Approve or reject changes
- `GET /price-approvals/count` - Get approval counts

**Key Features:**
- Bulk approval/rejection
- Expiration tracking
- Strategy-based changes
- Audit trail

#### Integrations
Connect your e-commerce platforms (OpenCart, Laravel).

**Endpoints:**
- `GET /integrations` - List connected platforms
- `POST /integrations` - Add new integration
- `DELETE /integrations` - Remove integration
- `POST /integrations/sync` - Trigger manual sync

**Key Features:**
- Secure API token storage (encrypted)
- Automatic product synchronization
- Sync status monitoring
- Multi-platform support

#### Product Matching
Manage automatic product matches between your catalog and competitors.

**Endpoints:**
- `GET /matching` - List pending matches
- `POST /matching` - Approve or reject match

**Key Features:**
- Multiple match types (SKU, Brand+Model, Fuzzy)
- Confidence scoring
- Manual override capability
- Search and filtering

---

### Advanced Features

#### Auto-Approval Rules
Automate price approval based on custom conditions.

**Endpoints:**
- `GET /auto-approval-rules` - List all rules
- `POST /auto-approval-rules` - Create new rule
- `GET /auto-approval-rules/{id}` - Get rule details
- `PUT /auto-approval-rules/{id}` - Update rule
- `DELETE /auto-approval-rules/{id}` - Delete rule
- `PATCH /auto-approval-rules/{id}/toggle` - Toggle rule
- `GET /auto-approval-rules/metrics` - Get metrics

**Rule Conditions:**
- Maximum price change (absolute)
- Maximum percentage change
- Minimum confidence score
- Allowed pricing strategies
- Product categories
- Price ranges

**Example Use Cases:**
- Auto-approve small price changes (< $20)
- Auto-approve high-confidence matches (> 95%)
- Category-specific rules
- Strategy-specific rules

#### Analytics
Access market intelligence and reporting data.

**Endpoints:**
- `GET /analytics/summary` - Market position summary
- `GET /analytics/history` - Historical price data
- `GET /analytics/competitor-analysis` - Competitor insights
- `GET /analytics/price-elasticity` - Price elasticity analysis

**Metrics:**
- Total SKUs tracked
- Active competitors
- Critical alerts (competitor cheaper)
- Market edge percentage
- Position summary (cheapest/neutral/expensive)

#### Sync Operations
Trigger and monitor data synchronization.

**Endpoints:**
- `POST /sync/full` - Trigger full competitive sync
- `GET /sync/status` - Check sync status

**Sync Process:**
1. Scrape competitor websites
2. Match products automatically
3. Calculate price differences
4. Generate price change recommendations
5. Apply auto-approval rules

---

## API Specifications

### OpenAPI 3.0 Specification

The complete API specification is available in OpenAPI 3.0 format:

**File:** [public/openapi.json](../public/openapi.json)

**Features:**
- Complete endpoint documentation
- Request/response schemas
- Authentication requirements
- Error code definitions
- Example requests and responses

### Interactive Documentation

Access interactive API documentation with live testing:

**URL:** https://api.pricepilot.com/docs

**Features:**
- Try API calls directly from browser
- Automatic request generation
- Response visualization
- Authentication testing

---

## Authentication

### API Key Authentication (Recommended)

**Header:** `x-api-key`

```bash
curl -X GET https://api.pricepilot.com/v1/products \
  -H "x-api-key: your-api-key-here"
```

**Generate API Key:**
1. Log in to dashboard
2. Navigate to Settings > API Keys
3. Click "Generate New API Key"
4. Copy and store securely

### Session Authentication

**Method:** Cookie-based

```bash
# Login first
curl -X POST https://api.pricepilot.com/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"password"}'

# Subsequent requests use session cookie automatically
```

---

## Rate Limits

### Limits by Authentication Type

| Auth Type | Requests | Window |
|-----------|----------|--------|
| API Key | 1000 | 1 hour |
| Session | 1000 | 1 hour |
| Unauthenticated | 100 | 1 hour |

### Limits by Endpoint Type

| Endpoint Type | Requests | Window |
|--------------|----------|--------|
| Read (GET) | 1000 | 1 hour |
| Write (POST/PUT/DELETE) | 500 | 1 hour |
| Auth | 20 | 15 minutes |
| Sync | 10 | 1 hour |

### Rate Limit Headers

```
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 995
X-RateLimit-Reset: 1643723400
```

---

## Error Handling

### Standard Error Format

```json
{
  "error": "Error message"
}
```

### Validation Error Format

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation failed",
    "details": {
      "fields": {
        "email": ["Invalid email format"]
      }
    }
  }
}
```

### Common HTTP Status Codes

| Code | Meaning | Description |
|------|---------|-------------|
| 200 | OK | Request succeeded |
| 201 | Created | Resource created |
| 400 | Bad Request | Invalid request |
| 401 | Unauthorized | Authentication required |
| 403 | Forbidden | Insufficient permissions |
| 404 | Not Found | Resource not found |
| 422 | Validation Error | Invalid input data |
| 429 | Rate Limit | Too many requests |
| 500 | Server Error | Internal error |

---

## SDK Support

### Official SDKs

**JavaScript/Node.js:**
```bash
npm install @pricepilot/sdk
```

**Python:**
```bash
pip install pricepilot-sdk
```

**PHP:**
```bash
composer require pricepilot/sdk
```

### Community SDKs

- Ruby: `gem install pricepilot`
- Go: `go get github.com/pricepilot/go-sdk`
- .NET: `dotnet add package PricePilot.SDK`

---

## Integration Guides

### OpenCart Integration

1. Install PricePilot OpenCart extension
2. Generate API token in OpenCart admin
3. Add integration in PricePilot dashboard
4. Products sync automatically

**Download:** [OpenCart Extension](../integrations/opencart/)

### Laravel Integration

1. Install PricePilot Laravel package
2. Publish configuration
3. Generate API token
4. Add integration in PricePilot dashboard

**Download:** [Laravel Package](../integrations/laravel/)

---

## Best Practices

### 1. Use Pagination

Always paginate large result sets:
```bash
GET /products?page=1&limit=50
```

### 2. Implement Caching

Cache responses to reduce API calls:
```javascript
const cache = new Map();
const cacheKey = `products-${page}`;

if (cache.has(cacheKey)) {
  return cache.get(cacheKey);
}
```

### 3. Handle Rate Limits

Monitor rate limit headers and implement backoff:
```javascript
const remaining = response.headers.get('X-RateLimit-Remaining');
if (remaining < 10) {
  console.warn('Approaching rate limit');
}
```

### 4. Use Filters

Filter on server-side to reduce payload:
```bash
GET /products?brand=Dell&category=Laptops&stock=INSTOCK
```

### 5. Error Handling

Always handle errors gracefully:
```javascript
try {
  const response = await fetch(url, options);
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error);
  }
  return await response.json();
} catch (error) {
  console.error('API Error:', error);
  // Handle error appropriately
}
```

---

## Webhooks

### Available Events

- `product.created` - New product added
- `product.updated` - Product updated
- `product.deleted` - Product deleted
- `price.changed` - Price changed
- `match.approved` - Match approved
- `competitor.added` - Competitor added
- `sync.completed` - Sync completed

### Webhook Configuration

```bash
POST /webhooks
{
  "url": "https://your-server.com/webhook",
  "events": ["price.changed", "sync.completed"],
  "secret": "your-webhook-secret"
}
```

### Webhook Payload

```json
{
  "event": "price.changed",
  "timestamp": "2026-02-01T10:00:00Z",
  "data": {
    "productId": "prod-123",
    "oldPrice": 299.99,
    "newPrice": 279.99
  }
}
```

---

## Testing

### Sandbox Environment

Test API integration without affecting production data:

**URL:** https://sandbox-api.pricepilot.com/v1

**Features:**
- Separate test data
- No rate limits
- Mock competitor data
- Reset data anytime

### Postman Collection

Import our Postman collection for easy testing:

**Download:** [PricePilot API Postman Collection](https://api.pricepilot.com/postman)

---

## Changelog

### Version 1.0.0 (Current)

**Released:** February 1, 2026

**Features:**
- Complete REST API
- API key authentication
- Session authentication
- Auto-approval rules
- Product matching
- Analytics endpoints
- Webhook support
- Rate limiting
- Multi-tenant isolation

**Endpoints:** 50+
**Resources:** 10+

---

## Support & Resources

### Documentation
- **API Reference:** https://api.pricepilot.com/docs
- **Guides:** https://docs.pricepilot.com
- **Tutorials:** https://docs.pricepilot.com/tutorials

### Community
- **GitHub:** https://github.com/pricepilot
- **Stack Overflow:** Tag `pricepilot`
- **Discord:** https://discord.gg/pricepilot

### Support
- **Email:** support@pricepilot.com
- **Status Page:** https://status.pricepilot.com
- **Security:** security@pricepilot.com

### Legal
- **Terms of Service:** https://pricepilot.com/terms
- **Privacy Policy:** https://pricepilot.com/privacy
- **API Terms:** https://pricepilot.com/api-terms

---

## Quick Start

### 1. Register Account

```bash
curl -X POST https://api.pricepilot.com/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "you@example.com",
    "password": "SecurePass123!",
    "companyName": "Your Company"
  }'
```

### 2. Generate API Key

Log in to dashboard → Settings → API Keys → Generate

### 3. Make First Request

```bash
curl -X GET https://api.pricepilot.com/v1/products \
  -H "x-api-key: your-api-key-here"
```

### 4. Add Integration

```bash
curl -X POST https://api.pricepilot.com/v1/integrations \
  -H "Content-Type: application/json" \
  -H "x-api-key: your-api-key-here" \
  -d '{
    "platform": "OPENCART",
    "baseUrl": "https://yourstore.com",
    "apiToken": "your-store-api-token"
  }'
```

### 5. Add Competitor

```bash
curl -X POST https://api.pricepilot.com/v1/competitors \
  -H "Content-Type: application/json" \
  -H "x-api-key: your-api-key-here" \
  -d '{
    "url": "https://competitor.com"
  }'
```

---

**Last Updated:** February 1, 2026  
**API Version:** 1.0.0  
**Documentation Version:** 1.0.0
