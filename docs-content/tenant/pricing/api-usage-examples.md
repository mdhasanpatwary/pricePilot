---
title: "API Usage Examples"
description: "Practical examples of using the PricePilot API"
category: "pricing"
tags: ["api", "examples", "tutorial"]
audience: "tenant"
author: "PricePilot Team"
lastReviewed: "2024-05-20"
---

# PricePilot API Usage Examples

This document provides practical examples for using the PricePilot API. All examples use `curl` for simplicity, but you can use any HTTP client.

## Table of Contents

1. [Authentication](#authentication)
2. [Products](#products)
3. [Competitors](#competitors)
4. [Price Approvals](#price-approvals)
5. [Integrations](#integrations)
6. [Product Matching](#product-matching)
7. [Auto-Approval Rules](#auto-approval-rules)
8. [Analytics](#analytics)
9. [Error Handling](#error-handling)

---

## Authentication

### Register a New User

```bash
curl -X POST https://api.pricepilot.com/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "john@example.com",
    "password": "SecurePass123!",
    "companyName": "Acme Electronics"
  }'
```

**Response:**
```json
{
  "message": "User registered successfully",
  "userId": "123e4567-e89b-12d3-a456-426614174000"
}
```

### Using API Keys

All subsequent requests require authentication. Include your API key in the `x-api-key` header:

```bash
curl -X GET https://api.pricepilot.com/v1/products \
  -H "x-api-key: your-api-key-here"
```

---

## Products

### List All Products

Get a paginated list of your products with competitor price comparisons:

```bash
curl -X GET "https://api.pricepilot.com/v1/products?page=1&limit=20" \
  -H "x-api-key: your-api-key-here"
```

**Response:**
```json
{
  "products": [
    {
      "id": "prod-123",
      "sku": "LAPTOP-001",
      "title": "Dell XPS 15 Laptop",
      "brand": "Dell",
      "model": "XPS 15",
      "category": "Laptops",
      "yourPrice": 1299.99,
      "compPrice": 1249.99,
      "diff": -50.00,
      "status": "RED",
      "inStock": true,
      "compInStock": true
    }
  ],
  "stats": {
    "atRisk": 15,
    "optimal": 45,
    "parity": 10,
    "competitorOos": 5,
    "notFound": 25
  },
  "currency": "USD",
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 100,
    "totalPages": 5
  }
}
```

### Search Products

Search by title, SKU, brand, or model:

```bash
curl -X GET "https://api.pricepilot.com/v1/products?q=Dell+XPS" \
  -H "x-api-key: your-api-key-here"
```

### Filter Products

Filter by brand, category, or stock status:

```bash
curl -X GET "https://api.pricepilot.com/v1/products?brand=Dell&category=Laptops&stock=INSTOCK" \
  -H "x-api-key: your-api-key-here"
```

### Sort Products

Sort by any field:

```bash
curl -X GET "https://api.pricepilot.com/v1/products?sortBy=yourPrice&sortOrder=desc" \
  -H "x-api-key: your-api-key-here"
```

---

## Competitors

### List Competitors

Get all competitor websites you're tracking:

```bash
curl -X GET https://api.pricepilot.com/v1/competitors \
  -H "x-api-key: your-api-key-here"
```

**Response:**
```json
{
  "competitors": [
    {
      "id": "comp-123",
      "name": "TechStore",
      "url": "https://techstore.com",
      "products": 45,
      "status": "ACTIVE",
      "health": 95,
      "isSyncing": false,
      "isAdvancedProtected": false
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 5,
    "totalPages": 1
  }
}
```

### Add a Competitor

Start tracking a new competitor website:

```bash
curl -X POST https://api.pricepilot.com/v1/competitors \
  -H "Content-Type: application/json" \
  -H "x-api-key: your-api-key-here" \
  -d '{
    "url": "https://competitor.com"
  }'
```

**Response:**
```json
{
  "id": "comp-456",
  "name": "Competitor",
  "url": "https://competitor.com",
  "products": 0,
  "status": "SYNCING",
  "health": 0,
  "isSyncing": true
}
```

### Remove a Competitor

Stop tracking a competitor:

```bash
curl -X DELETE "https://api.pricepilot.com/v1/competitors?id=comp-123" \
  -H "x-api-key: your-api-key-here"
```

---

## Price Approvals

### List Pending Approvals

Get all price changes awaiting approval:

```bash
curl -X GET "https://api.pricepilot.com/v1/price-approvals?status=PENDING" \
  -H "x-api-key: your-api-key-here"
```

**Response:**
```json
{
  "changes": [
    {
      "id": "change-123",
      "productId": "prod-456",
      "oldPrice": 299.99,
      "newPrice": 279.99,
      "strategy": "UNDERCUT",
      "status": "PENDING",
      "createdAt": "2026-02-01T10:00:00Z",
      "expiresAt": "2026-02-08T10:00:00Z",
      "product": {
        "id": "prod-456",
        "title": "Wireless Mouse",
        "sku": "MOUSE-001",
        "imageUrl": "https://example.com/mouse.jpg"
      }
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 15,
    "totalPages": 1
  }
}
```

### Approve Price Changes

Approve one or more pending price changes:

```bash
curl -X POST https://api.pricepilot.com/v1/price-approvals \
  -H "Content-Type: application/json" \
  -H "x-api-key: your-api-key-here" \
  -d '{
    "action": "approve",
    "changeIds": ["change-123", "change-456"]
  }'
```

**Response:**
```json
{
  "success": true,
  "message": "2 price changes approved and applied",
  "updated": 2,
  "failed": 0
}
```

### Reject Price Changes

Reject pending price changes:

```bash
curl -X POST https://api.pricepilot.com/v1/price-approvals \
  -H "Content-Type: application/json" \
  -H "x-api-key: your-api-key-here" \
  -d '{
    "action": "reject",
    "changeIds": ["change-789"]
  }'
```

---

## Integrations

### List Integrations

Get all connected e-commerce platforms:

```bash
curl -X GET https://api.pricepilot.com/v1/integrations \
  -H "x-api-key: your-api-key-here"
```

**Response:**
```json
[
  {
    "id": "int-123",
    "platform": "OPENCART",
    "type": "USER",
    "name": "mystore.com",
    "url": "https://mystore.com",
    "products": 150,
    "status": "CONNECTED",
    "lastSync": "2026-02-01T09:30:00Z"
  }
]
```

### Add Integration (OpenCart)

Connect your OpenCart store:

```bash
curl -X POST https://api.pricepilot.com/v1/integrations \
  -H "Content-Type: application/json" \
  -H "x-api-key: your-api-key-here" \
  -d '{
    "platform": "OPENCART",
    "baseUrl": "https://mystore.com",
    "apiToken": "your-opencart-api-token",
    "type": "USER"
  }'
```

### Add Integration (Laravel)

Connect your Laravel store:

```bash
curl -X POST https://api.pricepilot.com/v1/integrations \
  -H "Content-Type: application/json" \
  -H "x-api-key: your-api-key-here" \
  -d '{
    "platform": "LARAVEL",
    "baseUrl": "https://mystore.com",
    "apiToken": "your-laravel-api-token",
    "type": "USER"
  }'
```

### Remove Integration

Disconnect a platform:

```bash
curl -X DELETE "https://api.pricepilot.com/v1/integrations?id=int-123" \
  -H "x-api-key: your-api-key-here"
```

---

## Product Matching

### List Pending Matches

Get all product matches awaiting approval:

```bash
curl -X GET https://api.pricepilot.com/v1/matching \
  -H "x-api-key: your-api-key-here"
```

**Response:**
```json
[
  {
    "id": "match-123",
    "confidence": 95.5,
    "matchType": "SKU",
    "status": "PENDING",
    "product": {
      "id": "prod-123",
      "title": "Dell XPS 15",
      "sku": "LAPTOP-001",
      "price": 1299.99
    },
    "competitor": {
      "id": "comp-prod-456",
      "title": "Dell XPS 15 Laptop",
      "sku": "LAPTOP-001",
      "price": 1249.99,
      "siteName": "techstore.com"
    }
  }
]
```

### Approve a Match

Approve a product match:

```bash
curl -X POST https://api.pricepilot.com/v1/matching \
  -H "Content-Type: application/json" \
  -H "x-api-key: your-api-key-here" \
  -d '{
    "matchId": "match-123",
    "action": "APPROVE"
  }'
```

### Reject a Match

Reject a product match:

```bash
curl -X POST https://api.pricepilot.com/v1/matching \
  -H "Content-Type: application/json" \
  -H "x-api-key: your-api-key-here" \
  -d '{
    "matchId": "match-123",
    "action": "REJECT"
  }'
```

---

## Auto-Approval Rules

### List Auto-Approval Rules

Get all your auto-approval rules:

```bash
curl -X GET https://api.pricepilot.com/v1/auto-approval-rules \
  -H "x-api-key: your-api-key-here"
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "rule-123",
      "name": "Small Price Changes",
      "description": "Auto-approve changes under $20",
      "enabled": true,
      "priority": 1,
      "conditions": {
        "maxPriceChange": 20.00,
        "minConfidenceScore": 85
      }
    }
  ],
  "meta": {
    "total": 1
  }
}
```

### Create Auto-Approval Rule

Create a new rule to automatically approve price changes:

```bash
curl -X POST https://api.pricepilot.com/v1/auto-approval-rules \
  -H "Content-Type: application/json" \
  -H "x-api-key: your-api-key-here" \
  -d '{
    "name": "Small Price Changes",
    "description": "Auto-approve changes under $20",
    "enabled": true,
    "priority": 1,
    "conditions": {
      "maxPriceChange": 20.00,
      "minConfidenceScore": 85
    }
  }'
```

### Create Category-Specific Rule

Auto-approve only for specific categories:

```bash
curl -X POST https://api.pricepilot.com/v1/auto-approval-rules \
  -H "Content-Type: application/json" \
  -H "x-api-key: your-api-key-here" \
  -d '{
    "name": "Electronics Auto-Approval",
    "description": "Auto-approve electronics with constraints",
    "enabled": true,
    "priority": 2,
    "conditions": {
      "productCategories": ["Electronics", "Computers"],
      "maxPercentageChange": 15.0,
      "allowedStrategies": ["UNDERCUT", "MATCH"],
      "minConfidenceScore": 90
    }
  }'
```

### Update Auto-Approval Rule

Update an existing rule:

```bash
curl -X PUT https://api.pricepilot.com/v1/auto-approval-rules/rule-123 \
  -H "Content-Type: application/json" \
  -H "x-api-key: your-api-key-here" \
  -d '{
    "enabled": false
  }'
```

### Delete Auto-Approval Rule

Delete a rule:

```bash
curl -X DELETE https://api.pricepilot.com/v1/auto-approval-rules/rule-123 \
  -H "x-api-key: your-api-key-here"
```

---

## Analytics

### Get Market Summary

Get real-time market intelligence:

```bash
curl -X GET https://api.pricepilot.com/v1/analytics/summary \
  -H "x-api-key: your-api-key-here"
```

**Response:**
```json
{
  "stats": {
    "totalSKUs": 150,
    "activeRivals": 3,
    "criticalAlerts": 15,
    "marketEdge": 75.5
  },
  "positionSummary": {
    "cheapest": 85,
    "neutral": 20,
    "expensive": 45
  }
}
```

---

## Bulk Operations

### Bulk Price Update

Update prices for multiple products at once:

```bash
curl -X POST https://api.pricepilot.com/v1/price-update/bulk \
  -H "Content-Type: application/json" \
  -H "x-api-key: your-api-key-here" \
  -d '{
    "product_ids": ["prod-123", "prod-456", "prod-789"],
    "logic_type": "UNDERCUT",
    "value": 50,
    "min_price": 100
  }'
```

**Response:**
```json
{
  "message": "Price updates completed",
  "updated": 3,
  "failed": 0
}
```

### Pricing Strategies

**Undercut by Fixed Amount:**
```json
{
  "logic_type": "UNDERCUT",
  "value": 50
}
```
Sets your price to competitor price minus $50.

**Match Competitor Price:**
```json
{
  "logic_type": "MATCH",
  "value": 0
}
```
Sets your price equal to competitor price.

**Percentage Discount:**
```json
{
  "logic_type": "PERCENTAGE",
  "value": 10
}
```
Sets your price to 10% less than competitor.

**Fixed Price:**
```json
{
  "logic_type": "FIXED",
  "value": 299.99
}
```
Sets a fixed price regardless of competitor.

---

## Sync Operations

### Trigger Full Sync

Manually trigger a full competitive sync:

```bash
curl -X POST https://api.pricepilot.com/v1/sync/full \
  -H "x-api-key: your-api-key-here"
```

**Response:**
```json
{
  "message": "Full sync initiated",
  "syncId": "sync-123"
}
```

---

## Error Handling

### Common Error Responses

**Validation Error (422):**
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation failed",
    "details": {
      "fields": {
        "email": ["Invalid email format"],
        "password": ["Password must be at least 8 characters"]
      }
    }
  }
}
```

**Unauthorized (401):**
```json
{
  "error": "Authentication required"
}
```

**Forbidden (403):**
```json
{
  "error": "Competitor tracking limit reached (5). Please upgrade your plan."
}
```

**Not Found (404):**
```json
{
  "error": "Resource not found"
}
```

**Rate Limit (429):**
```json
{
  "error": "Rate limit exceeded. Please try again later."
}
```

### Rate Limits

- **Authenticated requests:** 1000 requests/hour
- **Unauthenticated requests:** 100 requests/hour
- **Scraping endpoints:** 10 requests/minute

Rate limit headers are included in all responses:
```
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 995
X-RateLimit-Reset: 1643723400
```

---

## Best Practices

### 1. Use Pagination

Always use pagination for large datasets:
```bash
curl -X GET "https://api.pricepilot.com/v1/products?page=1&limit=50"
```

### 2. Handle Errors Gracefully

Always check the response status and handle errors:
```javascript
const response = await fetch('https://api.pricepilot.com/v1/products', {
  headers: { 'x-api-key': 'your-key' }
});

if (!response.ok) {
  const error = await response.json();
  console.error('API Error:', error);
  return;
}

const data = await response.json();
```

### 3. Respect Rate Limits

Monitor rate limit headers and implement backoff:
```javascript
const remaining = response.headers.get('X-RateLimit-Remaining');
if (remaining < 10) {
  console.warn('Approaching rate limit');
}
```

### 4. Use Filters and Search

Reduce payload size by filtering on the server:
```bash
# Good: Filter on server
curl "https://api.pricepilot.com/v1/products?brand=Dell&category=Laptops"

# Bad: Fetch all and filter client-side
curl "https://api.pricepilot.com/v1/products"
```

### 5. Cache Responses

Cache responses when appropriate to reduce API calls:
```javascript
const cache = new Map();
const cacheKey = 'products-page-1';

if (cache.has(cacheKey)) {
  return cache.get(cacheKey);
}

const data = await fetchProducts();
cache.set(cacheKey, data);
```

---

## SDK Examples

### JavaScript/Node.js

```javascript
const PricePilot = require('pricepilot-sdk');

const client = new PricePilot({
  apiKey: 'your-api-key-here'
});

// List products
const products = await client.products.list({
  page: 1,
  limit: 20,
  brand: 'Dell'
});

// Add competitor
const competitor = await client.competitors.create({
  url: 'https://competitor.com'
});

// Approve price changes
await client.priceApprovals.approve(['change-123', 'change-456']);
```

### Python

```python
from pricepilot import PricePilot

client = PricePilot(api_key='your-api-key-here')

# List products
products = client.products.list(page=1, limit=20, brand='Dell')

# Add competitor
competitor = client.competitors.create(url='https://competitor.com')

# Approve price changes
client.price_approvals.approve(['change-123', 'change-456'])
```

---

## Support

For additional help:
- **Documentation:** https://docs.pricepilot.com
- **API Reference:** https://api.pricepilot.com/docs
- **Support:** support@pricepilot.com
- **Status:** https://status.pricepilot.com
