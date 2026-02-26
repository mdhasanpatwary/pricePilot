---
title: "API Documentation"
description: "Complete PricePilot API reference with endpoints, authentication, and examples"
category: "integrations"
tags: ["api", "reference", "endpoints", "authentication"]
audience: "tenant"
author: "PricePilot Team"
lastReviewed: "2024-05-20"
---

# PricePilot API Documentation

Complete reference for the PricePilot REST API. This documentation covers all available endpoints, authentication methods, request/response formats, and code examples in multiple languages.

## Table of Contents

1. [Quick Start](#quick-start)
2. [Authentication](#authentication)
3. [Core Endpoints](#core-endpoints)
   - [Products](#products)
   - [Competitors](#competitors)
   - [Price Approvals](#price-approvals)
   - [Price Updates](#price-updates)
   - [Integrations](#integrations)
   - [Product Matching](#product-matching)
   - [Auto-Approval Rules](#auto-approval-rules)
   - [Analytics](#analytics)
   - [Sync Operations](#sync-operations)
   - [Monitoring & Alerts](#monitoring--alerts)
   - [Exports](#exports)
   - [Imports](#imports)
   - [GDPR Compliance](#gdpr-compliance)
   - [Feedback](#feedback)
   - [Audit Logs](#audit-logs)
   - [Notifications](#notifications)
   - [Approval Delegation](#approval-delegation)
   - [Webhooks](#webhooks)
   - [User Management](#user-management)
   - [System Health](#system-health)
4. [Rate Limiting](#rate-limiting)
5. [Error Handling](#error-handling)
6. [Code Examples](#code-examples)

---

## Quick Start

### Base URL

```
https://api.pricepilot.com/v1
```

### Authentication

All API requests require authentication using an API key:

```bash
curl -X GET https://api.pricepilot.com/v1/products \
  -H "x-api-key: your-api-key-here"
```

### Generate API Key

1. Log in to your PricePilot dashboard
2. Navigate to **Settings > API Keys**
3. Click **Generate New API Key**
4. Copy and store securely

---

## Authentication

PricePilot API supports two authentication methods: API Key authentication (recommended for integrations) and Session authentication (for web applications).

### API Key Authentication (Recommended)

API keys provide secure, token-based authentication for programmatic access to the PricePilot API. Each API key is tied to your tenant account and can be managed from the dashboard.

**Header:** `x-api-key`

**Format:** `pk_live_` or `pk_test_` followed by a random string

```bash
curl -X GET https://api.pricepilot.com/v1/products \
  -H "x-api-key: pk_live_1234567890abcdef"
```

**Generating API Keys:**

1. Log in to your PricePilot dashboard
2. Navigate to **Settings > API Keys** or **Developers > API Keys**
3. Click **Generate New API Key**
4. Provide a descriptive name (e.g., "Production Server", "Development")
5. Copy the key immediately (it won't be shown again)
6. Store the key securely in environment variables

**API Key Best Practices:**

- Never commit API keys to version control
- Use environment variables to store keys
- Rotate keys regularly (every 90 days recommended)
- Use different keys for different environments (development, staging, production)
- Revoke compromised keys immediately
- Monitor API key usage in the dashboard

**API Key Permissions:**

API keys inherit the permissions of the user who created them. They provide access to:
- All tenant-scoped endpoints
- Product management
- Competitor tracking
- Price updates and approvals
- Analytics and reporting
- Webhook management

**Security Features:**

- Keys are encrypted at rest in the database
- Rate limiting is applied per API key
- Failed authentication attempts are logged
- Keys can be revoked instantly from the dashboard

### Session Authentication

**Method:** Cookie-based (for web applications)

Session authentication is used by the PricePilot web application and is suitable for browser-based integrations.

```bash
# Login first to establish session
curl -X POST https://api.pricepilot.com/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"password"}' \
  -c cookies.txt

# Subsequent requests use session cookie automatically
curl -X GET https://api.pricepilot.com/v1/products \
  -b cookies.txt
```

**Session Properties:**

- Sessions expire after 30 days of inactivity
- Sessions are invalidated on password change
- Multiple concurrent sessions are supported
- Sessions can be managed from **Settings > Active Sessions**

**For detailed authentication information, see:** [API Authentication Guide](./api-authentication.md)

---

## Core Endpoints

### Products

Manage your product catalog and view competitor price comparisons.

#### GET /products

List all products with pagination and filtering.

**Request:**
```bash
curl -X GET "https://api.pricepilot.com/v1/products?page=1&limit=20&brand=Dell" \
  -H "x-api-key: your-api-key-here"
```

**Query Parameters:**
- `page` (integer): Page number (default: 1)
- `limit` (integer): Items per page (default: 20, max: 100)
- `brand` (string): Filter by brand
- `category` (string): Filter by category
- `stock` (string): Filter by stock status (INSTOCK, OUTOFSTOCK)
- `status` (string): Filter by price status (RED, GREEN, NEUTRAL)
- `q` (string): Search query
- `sortBy` (string): Sort field (price, updatedAt, etc.)
- `sortOrder` (string): Sort order (asc, desc)

**Response (200):**
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
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 100,
    "totalPages": 5
  }
}
```


#### GET /products/{id}

Get a single product by ID.

**Request:**
```bash
curl -X GET "https://api.pricepilot.com/v1/products/prod-123" \
  -H "x-api-key: your-api-key-here"
```

**Response (200):**
```json
{
  "id": "prod-123",
  "sku": "LAPTOP-001",
  "title": "Dell XPS 15 Laptop",
  "brand": "Dell",
  "yourPrice": 1299.99,
  "compPrice": 1249.99,
  "status": "RED"
}
```

#### PUT /products/{id}

Update a product.

**Request:**
```bash
curl -X PUT "https://api.pricepilot.com/v1/products/prod-123" \
  -H "x-api-key: your-api-key-here" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Dell XPS 15 Updated",
    "yourPrice": 1199.99
  }'
```

#### DELETE /products/{id}

Delete a product.

**Request:**
```bash
curl -X DELETE "https://api.pricepilot.com/v1/products/prod-123" \
  -H "x-api-key: your-api-key-here"
```

**Response (200):**
```json
{
  "success": true,
  "message": "Product deleted successfully"
}
```

---

### Competitors

Track competitor websites and their products.

#### GET /competitors

List all tracked competitors.

**Request:**
```bash
curl -X GET "https://api.pricepilot.com/v1/competitors?page=1&limit=20" \
  -H "x-api-key: your-api-key-here"
```

**Response (200):**
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


#### POST /competitors

Add a new competitor website to track.

**Request:**
```bash
curl -X POST "https://api.pricepilot.com/v1/competitors" \
  -H "x-api-key: your-api-key-here" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://competitor.com",
    "searchQueryPattern": "/search?q={query}"
  }'
```

**Response (200):**
```json
{
  "id": "comp-789",
  "name": "Competitor",
  "url": "https://competitor.com",
  "products": 0,
  "status": "PENDING",
  "isSyncing": true
}
```

#### DELETE /competitors

Remove a competitor from tracking.

**Request:**
```bash
curl -X DELETE "https://api.pricepilot.com/v1/competitors?id=comp-123" \
  -H "x-api-key: your-api-key-here"
```

**Response (200):**
```json
{
  "success": true,
  "message": "Competitor removed successfully"
}
```

---

### Price Approvals

Review and approve price changes before they're applied to your store.

#### GET /price-approvals

Get all pending price changes awaiting approval.

**Request:**
```bash
curl -X GET "https://api.pricepilot.com/v1/price-approvals?status=PENDING&page=1&limit=20" \
  -H "x-api-key: your-api-key-here"
```

**Query Parameters:**
- `status` (string): Filter by status (PENDING, APPROVED, REJECTED)
- `page` (integer): Page number
- `limit` (integer): Items per page

**Response (200):**
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
        "sku": "MOUSE-001"
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


#### POST /price-approvals

Approve or reject price changes.

**Request - Approve:**
```bash
curl -X POST "https://api.pricepilot.com/v1/price-approvals" \
  -H "x-api-key: your-api-key-here" \
  -H "Content-Type: application/json" \
  -d '{
    "action": "approve",
    "changeIds": ["change-123", "change-456"]
  }'
```

**Request - Reject:**
```bash
curl -X POST "https://api.pricepilot.com/v1/price-approvals" \
  -H "x-api-key: your-api-key-here" \
  -H "Content-Type: application/json" \
  -d '{
    "action": "reject",
    "changeIds": ["change-789"]
  }'
```

**Response (200):**
```json
{
  "success": true,
  "message": "2 price changes approved and applied",
  "updated": 2,
  "failed": 0
}
```

#### GET /price-approvals/count

Get count of pending approvals.

**Request:**
```bash
curl -X GET "https://api.pricepilot.com/v1/price-approvals/count" \
  -H "x-api-key: your-api-key-here"
```

**Response (200):**
```json
{
  "count": 15
}
```

---

### Price Updates

Execute bulk price updates for multiple products.

#### POST /price-update/bulk

Update prices for multiple products at once.

**Request - Undercut Strategy:**
```bash
curl -X POST "https://api.pricepilot.com/v1/price-update/bulk" \
  -H "x-api-key: your-api-key-here" \
  -H "Content-Type: application/json" \
  -d '{
    "product_ids": ["prod-123", "prod-456"],
    "logic_type": "UNDERCUT",
    "value": 50,
    "min_price": 100
  }'
```

**Request Body Parameters:**
- `product_ids` (array): Array of product IDs to update
- `logic_type` (string): Pricing strategy (UNDERCUT, MATCH, PERCENTAGE, FIXED)
- `value` (number): Value for the strategy (amount or percentage)
- `min_price` (number): Minimum price floor (optional)

**Pricing Strategies:**
- `UNDERCUT`: Set price to competitor price minus value
- `MATCH`: Set price equal to competitor price
- `PERCENTAGE`: Set price to value% less than competitor
- `FIXED`: Set a fixed price regardless of competitor

**Response (200):**
```json
{
  "message": "Price updates completed",
  "updated": 2,
  "failed": 0,
  "details": [
    {
      "productId": "prod-123",
      "status": "success",
      "oldPrice": 299.99,
      "newPrice": 249.99
    }
  ]
}
```


#### POST /price-update/rollback

Rollback a price change or bulk operation.

**Request - Single Rollback:**
```bash
curl -X POST "https://api.pricepilot.com/v1/price-update/rollback" \
  -H "x-api-key: your-api-key-here" \
  -H "Content-Type: application/json" \
  -d '{
    "updateLogId": "update-123"
  }'
```

**Request - Bulk Rollback:**
```bash
curl -X POST "https://api.pricepilot.com/v1/price-update/rollback" \
  -H "x-api-key: your-api-key-here" \
  -H "Content-Type: application/json" \
  -d '{
    "snapshotId": "snapshot-456"
  }'
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "type": "single",
    "updateLogId": "update-123",
    "message": "Price change rolled back successfully",
    "productsAffected": 1
  }
}
```

#### GET /price-update/rollback

Get rollback history.

**Request:**
```bash
curl -X GET "https://api.pricepilot.com/v1/price-update/rollback?limit=50" \
  -H "x-api-key": your-api-key-here"
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "history": [
      {
        "id": "rollback-123",
        "type": "single",
        "productId": "prod-456",
        "oldPrice": 249.99,
        "newPrice": 299.99,
        "rolledBackAt": "2026-02-03T09:30:00Z",
        "rolledBackBy": "john@example.com"
      }
    ],
    "count": 1
  }
}
```

---

### Integrations

Connect your e-commerce platforms (OpenCart, Laravel).

#### GET /integrations

List all connected e-commerce platforms.

**Request:**
```bash
curl -X GET "https://api.pricepilot.com/v1/integrations" \
  -H "x-api-key: your-api-key-here"
```

**Response (200):**
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


#### POST /integrations

Connect a new e-commerce platform.

**Request - OpenCart:**
```bash
curl -X POST "https://api.pricepilot.com/v1/integrations" \
  -H "x-api-key: your-api-key-here" \
  -H "Content-Type: application/json" \
  -d '{
    "platform": "OPENCART",
    "baseUrl": "https://mystore.com",
    "apiToken": "your-secure-api-token-here",
    "type": "USER"
  }'
```

**Request - Laravel:**
```bash
curl -X POST "https://api.pricepilot.com/v1/integrations" \
  -H "x-api-key: your-api-key-here" \
  -H "Content-Type: application/json" \
  -d '{
    "platform": "LARAVEL",
    "baseUrl": "https://shop.example.com",
    "apiToken": "your-laravel-api-token",
    "type": "USER"
  }'
```

**Response (201):**
```json
{
  "id": "int-789",
  "platform": "OPENCART",
  "type": "USER",
  "url": "https://mystore.com",
  "status": "CONNECTED"
}
```

#### DELETE /integrations

Disconnect an e-commerce platform.

**Request:**
```bash
curl -X DELETE "https://api.pricepilot.com/v1/integrations?id=int-123" \
  -H "x-api-key: your-api-key-here"
```

**Response (200):**
```json
{
  "success": true,
  "message": "Integration removed successfully"
}
```

#### POST /integrations/sync

Trigger manual sync for an integration.

**Request:**
```bash
curl -X POST "https://api.pricepilot.com/v1/integrations/sync" \
  -H "x-api-key: your-api-key-here" \
  -H "Content-Type: application/json" \
  -d '{
    "integrationId": "int-123"
  }'
```

**Response (200):**
```json
{
  "success": true,
  "message": "Sync initiated",
  "syncId": "sync-456"
}
```

---

### Product Matching

Manage automatic product matches between your catalog and competitors.

#### GET /matching

List pending product matches awaiting approval.

**Request:**
```bash
curl -X GET "https://api.pricepilot.com/v1/matching?q=laptop" \
  -H "x-api-key: your-api-key-here"
```

**Query Parameters:**
- `q` (string): Search query
- `matchType` (string): Filter by match type (SKU, BRAND_MODEL, FUZZY, MANUAL)
- `status` (string): Filter by status (PENDING, APPROVED, REJECTED)


**Response (200):**
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

#### POST /matching

Approve or reject a product match.

**Request - Approve:**
```bash
curl -X POST "https://api.pricepilot.com/v1/matching" \
  -H "x-api-key: your-api-key-here" \
  -H "Content-Type: application/json" \
  -d '{
    "matchId": "match-123",
    "action": "APPROVE"
  }'
```

**Request - Reject:**
```bash
curl -X POST "https://api.pricepilot.com/v1/matching" \
  -H "x-api-key: your-api-key-here" \
  -H "Content-Type: application/json" \
  -d '{
    "matchId": "match-456",
    "action": "REJECT"
  }'
```

**Response (200):**
```json
{
  "success": true,
  "message": "Match approved successfully"
}
```

---

### Auto-Approval Rules

Automate price approval based on custom conditions.

#### GET /auto-approval-rules

List all auto-approval rules.

**Request:**
```bash
curl -X GET "https://api.pricepilot.com/v1/auto-approval-rules" \
  -H "x-api-key: your-api-key-here"
```

**Response (200):**
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


#### POST /auto-approval-rules

Create a new auto-approval rule.

**Request:**
```bash
curl -X POST "https://api.pricepilot.com/v1/auto-approval-rules" \
  -H "x-api-key: your-api-key-here" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Small Price Changes",
    "description": "Auto-approve changes under $20",
    "enabled": true,
    "priority": 1,
    "conditions": {
      "maxPriceChange": 20.00,
      "minConfidenceScore": 85,
      "allowedStrategies": ["UNDERCUT", "MATCH"]
    }
  }'
```

**Request Body Parameters:**
- `name` (string): Rule name
- `description` (string): Rule description
- `enabled` (boolean): Whether rule is active
- `priority` (integer): Rule priority (lower = higher priority)
- `conditions` (object): Rule conditions
  - `maxPriceChange` (number): Maximum absolute price change
  - `maxPercentageChange` (number): Maximum percentage change
  - `minConfidenceScore` (number): Minimum match confidence (0-100)
  - `allowedStrategies` (array): Allowed pricing strategies
  - `productCategories` (array): Allowed product categories
  - `priceRange` (object): Price range filter

**Response (201):**
```json
{
  "success": true,
  "data": {
    "id": "rule-789",
    "name": "Small Price Changes",
    "enabled": true,
    "priority": 1
  }
}
```

#### GET /auto-approval-rules/{id}

Get a single auto-approval rule.

**Request:**
```bash
curl -X GET "https://api.pricepilot.com/v1/auto-approval-rules/rule-123" \
  -H "x-api-key: your-api-key-here"
```

#### PUT /auto-approval-rules/{id}

Update an auto-approval rule.

**Request:**
```bash
curl -X PUT "https://api.pricepilot.com/v1/auto-approval-rules/rule-123" \
  -H "x-api-key: your-api-key-here" \
  -H "Content-Type: application/json" \
  -d '{
    "enabled": false
  }'
```

#### DELETE /auto-approval-rules/{id}

Delete an auto-approval rule.

**Request:**
```bash
curl -X DELETE "https://api.pricepilot.com/v1/auto-approval-rules/rule-123" \
  -H "x-api-key: your-api-key-here"
```

#### PATCH /auto-approval-rules/{id}/toggle

Toggle rule enabled status.

**Request:**
```bash
curl -X PATCH "https://api.pricepilot.com/v1/auto-approval-rules/rule-123/toggle" \
  -H "x-api-key: your-api-key-here"
```

#### GET /auto-approval-rules/metrics

Get auto-approval metrics.

**Request:**
```bash
curl -X GET "https://api.pricepilot.com/v1/auto-approval-rules/metrics" \
  -H "x-api-key: your-api-key-here"
```


---

### Analytics

Access market intelligence and reporting data.

#### GET /analytics/summary

Get market position summary.

**Request:**
```bash
curl -X GET "https://api.pricepilot.com/v1/analytics/summary" \
  -H "x-api-key: your-api-key-here"
```

**Response (200):**
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

#### GET /analytics/history

Get historical price data.

**Request:**
```bash
curl -X GET "https://api.pricepilot.com/v1/analytics/history?productId=prod-123&days=30" \
  -H "x-api-key: your-api-key-here"
```

**Query Parameters:**
- `productId` (string): Product ID
- `days` (integer): Number of days of history (default: 30)

#### GET /analytics/competitor-analysis

Get competitor insights.

**Request:**
```bash
curl -X GET "https://api.pricepilot.com/v1/analytics/competitor-analysis" \
  -H "x-api-key: your-api-key-here"
```

---

### Sync Operations

Trigger and monitor data synchronization.

#### POST /sync/full

Trigger a full competitive sync.

**Request:**
```bash
curl -X POST "https://api.pricepilot.com/v1/sync/full" \
  -H "x-api-key: your-api-key-here"
```

**Response (200):**
```json
{
  "message": "Full sync initiated",
  "syncId": "sync-123"
}
```

**Response (409) - Sync Already in Progress:**
```json
{
  "skipped": true,
  "message": "Sync already in progress"
}
```

---

### Monitoring & Alerts

Configure and manage monitoring alerts.

#### GET /monitoring/alerts

List all alerts.

**Request:**
```bash
curl -X GET "https://api.pricepilot.com/v1/monitoring/alerts?status=ACTIVE" \
  -H "x-api-key: your-api-key-here"
```

**Query Parameters:**
- `status` (string): Filter by status (ACTIVE, RESOLVED, ACKNOWLEDGED)
- `severity` (string): Filter by severity (CRITICAL, WARNING, INFO)
- `page` (integer): Page number
- `limit` (integer): Items per page


#### POST /monitoring/alert-rules

Create a new alert rule.

**Request:**
```bash
curl -X POST "https://api.pricepilot.com/v1/monitoring/alert-rules" \
  -H "x-api-key: your-api-key-here" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "High Price Difference Alert",
    "condition": "price_difference > 100",
    "severity": "CRITICAL",
    "enabled": true
  }'
```

#### GET /monitoring/metrics

Get monitoring metrics.

**Request:**
```bash
curl -X GET "https://api.pricepilot.com/v1/monitoring/metrics" \
  -H "x-api-key: your-api-key-here"
```

---

### Exports

Export your data in various formats for analysis and backup.

#### GET /exports/products

Export products to CSV or JSON format.

**Request:**
```bash
curl -X GET "https://api.pricepilot.com/v1/exports/products?format=csv" \
  -H "x-api-key: your-api-key-here"
```

**Query Parameters:**
- `format` (string): Export format (csv, json) - default: csv
- `status` (string): Filter by status (RED, GREEN, NEUTRAL)
- `brand` (string): Filter by brand
- `category` (string): Filter by category

**Response (200):**
Returns a downloadable file with product data.

**Rate Limit:** 10 requests per hour

#### GET /exports/competitors

Export competitor data to CSV or JSON format.

**Request:**
```bash
curl -X GET "https://api.pricepilot.com/v1/exports/competitors?format=json" \
  -H "x-api-key: your-api-key-here"
```

**Query Parameters:**
- `format` (string): Export format (csv, json) - default: csv

**Response (200):**
Returns a downloadable file with competitor data.

**Rate Limit:** 10 requests per hour

---

### Imports

Import products and competitors in bulk.

#### POST /imports/products

Import products from CSV file.

**Request:**
```bash
curl -X POST "https://api.pricepilot.com/v1/imports/products" \
  -H "x-api-key: your-api-key-here" \
  -F "file=@products.csv"
```

**CSV Format:**
```csv
sku,title,brand,model,price,category
LAPTOP-001,Dell XPS 15,Dell,XPS 15,1299.99,Laptops
MOUSE-001,Logitech MX Master,Logitech,MX Master,99.99,Accessories
```

**Response (200):**
```json
{
  "success": true,
  "imported": 2,
  "failed": 0,
  "errors": []
}
```

**Rate Limit:** 5 requests per hour

#### POST /imports/competitors

Import competitors from CSV file.

**Request:**
```bash
curl -X POST "https://api.pricepilot.com/v1/imports/competitors" \
  -H "x-api-key: your-api-key-here" \
  -F "file=@competitors.csv"
```

**CSV Format:**
```csv
name,url
TechStore,https://techstore.com
ElectronicsHub,https://electronicshub.com
```

**Response (200):**
```json
{
  "success": true,
  "imported": 2,
  "failed": 0,
  "errors": []
}
```

**Rate Limit:** 5 requests per hour

---

### GDPR Compliance

Manage user data in compliance with GDPR regulations.

#### GET /gdpr/export

Export all user data for GDPR compliance.

**Request:**
```bash
curl -X GET "https://api.pricepilot.com/v1/gdpr/export" \
  -H "x-api-key: your-api-key-here"
```

**Response (200):**
Returns a comprehensive JSON file containing all user data including:
- Account information
- Products and pricing history
- Competitors and matches
- Audit logs
- API keys (masked)
- Notification preferences

**Processing Time:** May take several minutes for large datasets. The API will return a job ID that can be polled for completion status.

**Rate Limit:** 1 request per day

#### POST /gdpr/delete

Request account deletion (GDPR right to be forgotten).

**Request:**
```bash
curl -X POST "https://api.pricepilot.com/v1/gdpr/delete" \
  -H "x-api-key: your-api-key-here" \
  -H "Content-Type: application/json" \
  -d '{
    "confirmation": "DELETE_MY_ACCOUNT",
    "reason": "No longer using the service"
  }'
```

**Request Body:**
- `confirmation` (string): Must be exactly "DELETE_MY_ACCOUNT"
- `reason` (string): Optional reason for deletion

**Response (200):**
```json
{
  "success": true,
  "message": "Account deletion scheduled",
  "deletionDate": "2026-02-10T00:00:00Z"
}
```

**Note:** Account deletion is scheduled for 7 days after the request to allow for cancellation. All data will be permanently deleted after this period.

**Rate Limit:** 1 request per day

---

### Feedback

Submit and retrieve user feedback.

#### POST /feedback/submit

Submit user feedback about the platform.

**Request:**
```bash
curl -X POST "https://api.pricepilot.com/v1/feedback/submit" \
  -H "x-api-key: your-api-key-here" \
  -H "Content-Type: application/json" \
  -d '{
    "category": "feature_request",
    "rating": 4,
    "comment": "Would love to see bulk import feature",
    "page": "/dashboard/products"
  }'
```

**Request Body:**
- `category` (string): Feedback category (bug_report, feature_request, general, usability)
- `rating` (integer): Rating from 1-5
- `comment` (string): Feedback text
- `page` (string): Page where feedback was submitted

**Response (200):**
```json
{
  "success": true,
  "message": "Thank you for your feedback",
  "id": "feedback-123"
}
```

**Rate Limit:** 20 requests per hour

#### GET /feedback/score

Get overall satisfaction score.

**Request:**
```bash
curl -X GET "https://api.pricepilot.com/v1/feedback/score" \
  -H "x-api-key: your-api-key-here"
```

**Response (200):**
```json
{
  "averageScore": 4.2,
  "totalResponses": 150,
  "distribution": {
    "1": 5,
    "2": 10,
    "3": 20,
    "4": 50,
    "5": 65
  }
}
```

**Rate Limit:** 100 requests per hour

---

### Audit Logs

Access audit trail for compliance and security monitoring.

#### GET /audit-logs

Retrieve audit logs for your account.

**Request:**
```bash
curl -X GET "https://api.pricepilot.com/v1/audit-logs?page=1&limit=50&action=PRICE_UPDATE" \
  -H "x-api-key: your-api-key-here"
```

**Query Parameters:**
- `page` (integer): Page number
- `limit` (integer): Items per page (max: 100)
- `action` (string): Filter by action type
- `userId` (string): Filter by user ID
- `startDate` (string): Start date (ISO 8601)
- `endDate` (string): End date (ISO 8601)

**Action Types:**
- `LOGIN` - User login
- `LOGOUT` - User logout
- `PRICE_UPDATE` - Price updated
- `PRODUCT_CREATED` - Product created
- `PRODUCT_DELETED` - Product deleted
- `COMPETITOR_ADDED` - Competitor added
- `COMPETITOR_REMOVED` - Competitor removed
- `MATCH_APPROVED` - Match approved
- `MATCH_REJECTED` - Match rejected
- `RULE_CREATED` - Auto-approval rule created
- `RULE_UPDATED` - Auto-approval rule updated
- `API_KEY_CREATED` - API key generated
- `API_KEY_REVOKED` - API key revoked

**Response (200):**
```json
{
  "logs": [
    {
      "id": "log-123",
      "action": "PRICE_UPDATE",
      "userId": "user-456",
      "userName": "john@example.com",
      "timestamp": "2026-02-01T10:30:00Z",
      "ipAddress": "192.168.1.1",
      "userAgent": "Mozilla/5.0...",
      "details": {
        "productId": "prod-789",
        "oldPrice": 299.99,
        "newPrice": 279.99
      }
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 1250,
    "totalPages": 25
  }
}
```

**Rate Limit:** 100 requests per hour

---

### Notifications

Manage in-app notifications.

#### GET /notifications

Get user notifications.

**Request:**
```bash
curl -X GET "https://api.pricepilot.com/v1/notifications?unreadOnly=true" \
  -H "x-api-key: your-api-key-here"
```

**Query Parameters:**
- `unreadOnly` (boolean): Show only unread notifications
- `page` (integer): Page number
- `limit` (integer): Items per page

**Response (200):**
```json
{
  "notifications": [
    {
      "id": "notif-123",
      "type": "PRICE_ALERT",
      "title": "Price Alert: 15 products at risk",
      "message": "15 of your products are now more expensive than competitors",
      "read": false,
      "createdAt": "2026-02-01T10:00:00Z",
      "link": "/dashboard/products?status=RED"
    }
  ],
  "unreadCount": 5,
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 50,
    "totalPages": 3
  }
}
```

**Rate Limit:** 100 requests per hour

#### PATCH /notifications

Mark notifications as read.

**Request:**
```bash
curl -X PATCH "https://api.pricepilot.com/v1/notifications" \
  -H "x-api-key: your-api-key-here" \
  -H "Content-Type: application/json" \
  -d '{
    "notificationIds": ["notif-123", "notif-456"],
    "read": true
  }'
```

**Response (200):**
```json
{
  "success": true,
  "updated": 2
}
```

**Rate Limit:** 100 requests per hour

---

### Approval Delegation

Delegate price approval authority to team members.

#### GET /approval-delegation

List all approval delegations.

**Request:**
```bash
curl -X GET "https://api.pricepilot.com/v1/approval-delegation" \
  -H "x-api-key: your-api-key-here"
```

**Response (200):**
```json
{
  "delegations": [
    {
      "id": "deleg-123",
      "fromUserId": "user-456",
      "fromUserName": "john@example.com",
      "toUserId": "user-789",
      "toUserName": "jane@example.com",
      "startDate": "2026-02-01T00:00:00Z",
      "endDate": "2026-02-07T23:59:59Z",
      "active": true,
      "reason": "Vacation"
    }
  ]
}
```

**Rate Limit:** 100 requests per hour

#### POST /approval-delegation

Create a new approval delegation.

**Request:**
```bash
curl -X POST "https://api.pricepilot.com/v1/approval-delegation" \
  -H "x-api-key: your-api-key-here" \
  -H "Content-Type: application/json" \
  -d '{
    "toUserId": "user-789",
    "startDate": "2026-02-05T00:00:00Z",
    "endDate": "2026-02-12T23:59:59Z",
    "reason": "Business trip"
  }'
```

**Response (201):**
```json
{
  "success": true,
  "delegation": {
    "id": "deleg-456",
    "toUserId": "user-789",
    "startDate": "2026-02-05T00:00:00Z",
    "endDate": "2026-02-12T23:59:59Z",
    "active": true
  }
}
```

**Rate Limit:** 20 requests per hour

#### DELETE /approval-delegation/{id}

Cancel an approval delegation.

**Request:**
```bash
curl -X DELETE "https://api.pricepilot.com/v1/approval-delegation/deleg-123" \
  -H "x-api-key: your-api-key-here"
```

**Response (200):**
```json
{
  "success": true,
  "message": "Delegation cancelled"
}
```

**Rate Limit:** 20 requests per hour

---

### Monitoring & Alerts

Configure and manage monitoring alerts.

#### GET /monitoring/alerts

List all alerts.

**Request:**
```bash
curl -X GET "https://api.pricepilot.com/v1/monitoring/alerts?status=ACTIVE" \
  -H "x-api-key: your-api-key-here"
```

**Query Parameters:**
- `status` (string): Filter by status (ACTIVE, RESOLVED, ACKNOWLEDGED)
- `severity` (string): Filter by severity (CRITICAL, WARNING, INFO)
- `page` (integer): Page number
- `limit` (integer): Items per page


#### POST /monitoring/alert-rules

Create a new alert rule.

**Request:**
```bash
curl -X POST "https://api.pricepilot.com/v1/monitoring/alert-rules" \
  -H "x-api-key: your-api-key-here" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "High Price Difference Alert",
    "condition": "price_difference > 100",
    "severity": "CRITICAL",
    "enabled": true
  }'
```

#### GET /monitoring/metrics

Get monitoring metrics.

**Request:**
```bash
curl -X GET "https://api.pricepilot.com/v1/monitoring/metrics" \
  -H "x-api-key: your-api-key-here"
```

---

### Webhooks

Configure webhooks for real-time event notifications.

#### POST /webhooks

Create a new webhook.

**Request:**
```bash
curl -X POST "https://api.pricepilot.com/v1/webhooks" \
  -H "x-api-key: your-api-key-here" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://your-server.com/webhook",
    "events": ["price.changed", "sync.completed"],
    "secret": "your-webhook-secret"
  }'
```

**Available Events:**
- `product.created` - New product added
- `product.updated` - Product updated
- `product.deleted` - Product deleted
- `price.changed` - Price changed
- `match.approved` - Match approved
- `competitor.added` - Competitor added
- `sync.completed` - Sync completed

**Webhook Payload Example:**
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

### User Management

Manage API keys and user preferences.

#### GET /user/api-keys

List all API keys for the authenticated user.

**Request:**
```bash
curl -X GET "https://api.pricepilot.com/v1/user/api-keys" \
  -H "x-api-key: your-api-key-here"
```

#### POST /user/api-keys

Create a new API key.

**Request:**
```bash
curl -X POST "https://api.pricepilot.com/v1/user/api-keys" \
  -H "x-api-key: your-api-key-here" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Production Server",
    "description": "API key for production deployment"
  }'
```

#### DELETE /user/api-keys/{id}

Revoke an API key.

**Request:**
```bash
curl -X DELETE "https://api.pricepilot.com/v1/user/api-keys/key-123" \
  -H "x-api-key: your-api-key-here"
```


---

### System Health

Check API health status.

#### GET /health

Check API health (no authentication required).

**Request:**
```bash
curl -X GET "https://api.pricepilot.com/v1/health"
```

**Response (200):**
```json
{
  "status": "ok",
  "timestamp": "2026-02-03T10:00:00Z",
  "version": "1.0.0"
}
```

---

## Rate Limiting

### Rate Limits by Authentication Type

| Authentication | Limit | Window |
|---------------|-------|--------|
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

### Rate Limit Headers

Every API response includes rate limit information:

```
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 995
X-RateLimit-Reset: 1643723400
```

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

**Implement exponential backoff:**
```javascript
async function makeRequestWithBackoff(url, options, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    const response = await fetch(url, options);
    
    if (response.status === 429) {
      const reset = response.headers.get('X-RateLimit-Reset');
      const waitTime = (reset * 1000) - Date.now();
      
      console.log(`Rate limited. Waiting ${waitTime}ms...`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
      continue;
    }
    
    return response;
  }
  
  throw new Error('Max retries exceeded');
}
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
        "email": ["Invalid email format"],
        "price": ["Must be greater than 0"]
      }
    }
  }
}
```


### HTTP Status Codes

| Code | Meaning | Description |
|------|---------|-------------|
| 200 | OK | Request succeeded |
| 201 | Created | Resource created successfully |
| 204 | No Content | Request succeeded with no response body |
| 400 | Bad Request | Invalid request format or parameters |
| 401 | Unauthorized | Authentication required or invalid |
| 403 | Forbidden | Insufficient permissions or resource limits |
| 404 | Not Found | Resource not found |
| 409 | Conflict | Resource conflict (e.g., sync already in progress) |
| 422 | Validation Error | Request validation failed |
| 429 | Rate Limit Exceeded | Too many requests |
| 500 | Internal Server Error | Unexpected server error |
| 503 | Service Unavailable | Service temporarily unavailable |

### Common Error Responses

**401 Unauthorized:**
```json
{
  "error": "Unauthorized - Invalid API key"
}
```

**403 Forbidden:**
```json
{
  "error": "Competitor tracking limit reached (5). Please upgrade your plan."
}
```

**404 Not Found:**
```json
{
  "error": "Product not found"
}
```

**422 Validation Error:**
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation failed",
    "details": {
      "fields": {
        "url": ["Invalid URL format"]
      }
    }
  }
}
```

**429 Rate Limit:**
```json
{
  "error": "Rate limit exceeded. Please try again in 60 seconds."
}
```

---

## Code Examples

### JavaScript/Node.js

**Using fetch:**
```javascript
const apiKey = process.env.PRICEPILOT_API_KEY;
const baseUrl = 'https://api.pricepilot.com/v1';

async function getProducts() {
  const response = await fetch(`${baseUrl}/products`, {
    headers: {
      'x-api-key': apiKey
    }
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error);
  }
  
  return await response.json();
}

// Usage
getProducts()
  .then(data => console.log(data))
  .catch(error => console.error('Error:', error));
```

**Using axios:**
```javascript
const axios = require('axios');

const client = axios.create({
  baseURL: 'https://api.pricepilot.com/v1',
  headers: {
    'x-api-key': process.env.PRICEPILOT_API_KEY
  }
});

// Get products
const products = await client.get('/products');
console.log(products.data);

// Add competitor
const competitor = await client.post('/competitors', {
  url: 'https://competitor.com'
});
console.log(competitor.data);

// Approve price changes
await client.post('/price-approvals', {
  action: 'approve',
  changeIds: ['change-123', 'change-456']
});
```


### Python

**Using requests:**
```python
import requests
import os

API_KEY = os.environ.get('PRICEPILOT_API_KEY')
BASE_URL = 'https://api.pricepilot.com/v1'

headers = {
    'x-api-key': API_KEY
}

# Get products
response = requests.get(f'{BASE_URL}/products', headers=headers)
products = response.json()
print(products)

# Add competitor
response = requests.post(
    f'{BASE_URL}/competitors',
    headers=headers,
    json={'url': 'https://competitor.com'}
)
competitor = response.json()
print(competitor)

# Approve price changes
response = requests.post(
    f'{BASE_URL}/price-approvals',
    headers=headers,
    json={
        'action': 'approve',
        'changeIds': ['change-123', 'change-456']
    }
)
result = response.json()
print(result)
```

**Error handling:**
```python
try:
    response = requests.get(f'{BASE_URL}/products', headers=headers)
    response.raise_for_status()
    products = response.json()
except requests.exceptions.HTTPError as e:
    print(f'HTTP Error: {e}')
    print(f'Response: {e.response.json()}')
except requests.exceptions.RequestException as e:
    print(f'Request Error: {e}')
```

### PHP

**Using cURL:**
```php
<?php
$apiKey = getenv('PRICEPILOT_API_KEY');
$baseUrl = 'https://api.pricepilot.com/v1';

function makeRequest($endpoint, $method = 'GET', $data = null) {
    global $apiKey, $baseUrl;
    
    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, "$baseUrl$endpoint");
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        "x-api-key: $apiKey",
        "Content-Type: application/json"
    ]);
    
    if ($method !== 'GET') {
        curl_setopt($ch, CURLOPT_CUSTOMREQUEST, $method);
        if ($data) {
            curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data));
        }
    }
    
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    
    if ($httpCode >= 400) {
        throw new Exception("API Error: $response");
    }
    
    return json_decode($response, true);
}

// Get products
$products = makeRequest('/products');
print_r($products);

// Add competitor
$competitor = makeRequest('/competitors', 'POST', [
    'url' => 'https://competitor.com'
]);
print_r($competitor);

// Approve price changes
$result = makeRequest('/price-approvals', 'POST', [
    'action' => 'approve',
    'changeIds' => ['change-123', 'change-456']
]);
print_r($result);
?>
```

### Ruby

**Using net/http:**
```ruby
require 'net/http'
require 'json'

api_key = ENV['PRICEPILOT_API_KEY']
base_url = 'https://api.pricepilot.com/v1'

def make_request(endpoint, method = :get, data = nil)
  uri = URI("#{ENV['BASE_URL']}#{endpoint}")
  
  request = case method
  when :get then Net::HTTP::Get.new(uri)
  when :post then Net::HTTP::Post.new(uri)
  when :put then Net::HTTP::Put.new(uri)
  when :delete then Net::HTTP::Delete.new(uri)
  end
  
  request['x-api-key'] = ENV['PRICEPILOT_API_KEY']
  request['Content-Type'] = 'application/json'
  request.body = data.to_json if data
  
  response = Net::HTTP.start(uri.hostname, uri.port, use_ssl: true) do |http|
    http.request(request)
  end
  
  JSON.parse(response.body)
end

# Get products
products = make_request('/products')
puts products

# Add competitor
competitor = make_request('/competitors', :post, {
  url: 'https://competitor.com'
})
puts competitor
```

### Go

**Using net/http:**
```go
package main

import (
    "bytes"
    "encoding/json"
    "fmt"
    "io"
    "net/http"
    "os"
)

const baseURL = "https://api.pricepilot.com/v1"

type Client struct {
    apiKey     string
    httpClient *http.Client
}

func NewClient(apiKey string) *Client {
    return &Client{
        apiKey:     apiKey,
        httpClient: &http.Client{},
    }
}

func (c *Client) makeRequest(method, endpoint string, body interface{}) ([]byte, error) {
    var reqBody io.Reader
    if body != nil {
        jsonData, err := json.Marshal(body)
        if err != nil {
            return nil, err
        }
        reqBody = bytes.NewBuffer(jsonData)
    }

    req, err := http.NewRequest(method, baseURL+endpoint, reqBody)
    if err != nil {
        return nil, err
    }

    req.Header.Set("x-api-key", c.apiKey)
    req.Header.Set("Content-Type", "application/json")

    resp, err := c.httpClient.Do(req)
    if err != nil {
        return nil, err
    }
    defer resp.Body.Close()

    return io.ReadAll(resp.Body)
}

func main() {
    apiKey := os.Getenv("PRICEPILOT_API_KEY")
    client := NewClient(apiKey)

    // Get products
    products, err := client.makeRequest("GET", "/products", nil)
    if err != nil {
        fmt.Println("Error:", err)
        return
    }
    fmt.Println(string(products))

    // Add competitor
    competitorData := map[string]string{
        "url": "https://competitor.com",
    }
    competitor, err := client.makeRequest("POST", "/competitors", competitorData)
    if err != nil {
        fmt.Println("Error:", err)
        return
    }
    fmt.Println(string(competitor))
}
```

### C# / .NET

**Using HttpClient:**
```csharp
using System;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using System.Threading.Tasks;

public class PricePilotClient
{
    private readonly HttpClient _httpClient;
    private const string BaseUrl = "https://api.pricepilot.com/v1";

    public PricePilotClient(string apiKey)
    {
        _httpClient = new HttpClient();
        _httpClient.DefaultRequestHeaders.Add("x-api-key", apiKey);
    }

    public async Task<string> GetProductsAsync()
    {
        var response = await _httpClient.GetAsync($"{BaseUrl}/products");
        response.EnsureSuccessStatusCode();
        return await response.Content.ReadAsStringAsync();
    }

    public async Task<string> AddCompetitorAsync(string url)
    {
        var data = new { url = url };
        var json = JsonSerializer.Serialize(data);
        var content = new StringContent(json, Encoding.UTF8, "application/json");

        var response = await _httpClient.PostAsync($"{BaseUrl}/competitors", content);
        response.EnsureSuccessStatusCode();
        return await response.Content.ReadAsStringAsync();
    }

    public async Task<string> ApproveChangesAsync(string[] changeIds)
    {
        var data = new
        {
            action = "approve",
            changeIds = changeIds
        };
        var json = JsonSerializer.Serialize(data);
        var content = new StringContent(json, Encoding.UTF8, "application/json");

        var response = await _httpClient.PostAsync($"{BaseUrl}/price-approvals", content);
        response.EnsureSuccessStatusCode();
        return await response.Content.ReadAsStringAsync();
    }
}

// Usage
class Program
{
    static async Task Main(string[] args)
    {
        var apiKey = Environment.GetEnvironmentVariable("PRICEPILOT_API_KEY");
        var client = new PricePilotClient(apiKey);

        try
        {
            // Get products
            var products = await client.GetProductsAsync();
            Console.WriteLine(products);

            // Add competitor
            var competitor = await client.AddCompetitorAsync("https://competitor.com");
            Console.WriteLine(competitor);

            // Approve changes
            var result = await client.ApproveChangesAsync(new[] { "change-123", "change-456" });
            Console.WriteLine(result);
        }
        catch (HttpRequestException ex)
        {
            Console.WriteLine($"Error: {ex.Message}");
        }
    }
}
```

### Java

**Using HttpClient (Java 11+):**
```java
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;

public class PricePilotClient {
    private final HttpClient httpClient;
    private final String apiKey;
    private static final String BASE_URL = "https://api.pricepilot.com/v1";

    public PricePilotClient(String apiKey) {
        this.apiKey = apiKey;
        this.httpClient = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(30))
                .build();
    }

    public String getProducts() throws Exception {
        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(BASE_URL + "/products"))
                .header("x-api-key", apiKey)
                .GET()
                .build();

        HttpResponse<String> response = httpClient.send(request,
                HttpResponse.BodyHandlers.ofString());

        if (response.statusCode() >= 400) {
            throw new Exception("API Error: " + response.body());
        }

        return response.body();
    }

    public String addCompetitor(String url) throws Exception {
        String json = String.format("{\"url\":\"%s\"}", url);

        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(BASE_URL + "/competitors"))
                .header("x-api-key", apiKey)
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(json))
                .build();

        HttpResponse<String> response = httpClient.send(request,
                HttpResponse.BodyHandlers.ofString());

        if (response.statusCode() >= 400) {
            throw new Exception("API Error: " + response.body());
        }

        return response.body();
    }

    public String approveChanges(String[] changeIds) throws Exception {
        StringBuilder json = new StringBuilder("{\"action\":\"approve\",\"changeIds\":[");
        for (int i = 0; i < changeIds.length; i++) {
            json.append("\"").append(changeIds[i]).append("\"");
            if (i < changeIds.length - 1) json.append(",");
        }
        json.append("]}");

        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(BASE_URL + "/price-approvals"))
                .header("x-api-key", apiKey)
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(json.toString()))
                .build();

        HttpResponse<String> response = httpClient.send(request,
                HttpResponse.BodyHandlers.ofString());

        if (response.statusCode() >= 400) {
            throw new Exception("API Error: " + response.body());
        }

        return response.body();
    }

    public static void main(String[] args) {
        String apiKey = System.getenv("PRICEPILOT_API_KEY");
        PricePilotClient client = new PricePilotClient(apiKey);

        try {
            // Get products
            String products = client.getProducts();
            System.out.println(products);

            // Add competitor
            String competitor = client.addCompetitor("https://competitor.com");
            System.out.println(competitor);

            // Approve changes
            String result = client.approveChanges(new String[]{"change-123", "change-456"});
            System.out.println(result);
        } catch (Exception e) {
            System.err.println("Error: " + e.getMessage());
        }
    }
}
```

### Ruby

**Using net/http:**
```ruby
require 'net/http'
require 'json'

api_key = ENV['PRICEPILOT_API_KEY']
base_url = 'https://api.pricepilot.com/v1'

def make_request(endpoint, method = :get, data = nil)
  uri = URI("#{ENV['BASE_URL']}#{endpoint}")
  
  request = case method
  when :get then Net::HTTP::Get.new(uri)
  when :post then Net::HTTP::Post.new(uri)
  when :put then Net::HTTP::Put.new(uri)
  when :delete then Net::HTTP::Delete.new(uri)
  end
  
  request['x-api-key'] = ENV['PRICEPILOT_API_KEY']
  request['Content-Type'] = 'application/json'
  request.body = data.to_json if data
  
  response = Net::HTTP.start(uri.hostname, uri.port, use_ssl: true) do |http|
    http.request(request)
  end
  
  JSON.parse(response.body)
end

# Get products
products = make_request('/products')
puts products

# Add competitor
competitor = make_request('/competitors', :post, {
  url: 'https://competitor.com'
})
puts competitor
```


### cURL

**Basic GET request:**
```bash
curl -X GET "https://api.pricepilot.com/v1/products" \
  -H "x-api-key: your-api-key-here"
```

**POST request with JSON body:**
```bash
curl -X POST "https://api.pricepilot.com/v1/competitors" \
  -H "x-api-key: your-api-key-here" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://competitor.com"
  }'
```

**With query parameters:**
```bash
curl -X GET "https://api.pricepilot.com/v1/products?page=1&limit=20&brand=Dell" \
  -H "x-api-key: your-api-key-here"
```

**Verbose output (for debugging):**
```bash
curl -v -X GET "https://api.pricepilot.com/v1/products" \
  -H "x-api-key: your-api-key-here"
```

---

## Best Practices

### 1. Use Environment Variables

Never hardcode API keys in your code. Use environment variables:

```javascript
// Good
const apiKey = process.env.PRICEPILOT_API_KEY;

// Bad
const apiKey = 'pk_live_1234567890abcdef';
```

### 2. Implement Error Handling

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

### 3. Use Pagination

For large datasets, always use pagination:

```bash
# Good
curl "https://api.pricepilot.com/v1/products?page=1&limit=50"

# Bad - fetching all at once
curl "https://api.pricepilot.com/v1/products"
```

### 4. Cache Responses

Cache responses when appropriate to reduce API calls:

```javascript
const cache = new Map();
const cacheKey = `products-${page}`;

if (cache.has(cacheKey)) {
  return cache.get(cacheKey);
}

const data = await fetchProducts(page);
cache.set(cacheKey, data);
return data;
```

### 5. Monitor Rate Limits

Monitor rate limit headers and implement backoff:

```javascript
const remaining = response.headers.get('X-RateLimit-Remaining');
if (remaining < 10) {
  console.warn('Approaching rate limit');
}
```

### 6. Use Filters

Filter on the server-side to reduce payload size:

```bash
# Good: Filter on server
curl "https://api.pricepilot.com/v1/products?brand=Dell&category=Laptops"

# Bad: Fetch all and filter client-side
curl "https://api.pricepilot.com/v1/products"
```

### 7. Secure Your API Keys

- Store API keys in environment variables
- Never commit API keys to version control
- Rotate keys regularly
- Use different keys for different environments
- Revoke compromised keys immediately

### 8. Handle Timeouts

Set appropriate timeouts for API requests:

```javascript
const controller = new AbortController();
const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

try {
  const response = await fetch(url, {
    signal: controller.signal,
    headers: { 'x-api-key': apiKey }
  });
  clearTimeout(timeoutId);
  return await response.json();
} catch (error) {
  if (error.name === 'AbortError') {
    console.error('Request timeout');
  }
  throw error;
}
```


---

## Pagination

List endpoints support pagination with these query parameters:

| Parameter | Type | Default | Max | Description |
|-----------|------|---------|-----|-------------|
| `page` | integer | 1 | - | Page number |
| `limit` | integer | 20 | 100 | Items per page |
| `sortBy` | string | varies | - | Field to sort by |
| `sortOrder` | string | desc | - | Sort order (asc/desc) |

**Pagination Response Format:**
```json
{
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 150,
    "totalPages": 8
  }
}
```

**Example:**
```bash
curl -X GET "https://api.pricepilot.com/v1/products?page=2&limit=50&sortBy=price&sortOrder=asc" \
  -H "x-api-key: your-api-key-here"
```

---

## Filtering and Searching

### Filter Parameters

Most list endpoints support filtering:

**Products:**
- `brand` - Filter by brand name
- `category` - Filter by category
- `stock` - Filter by stock status (INSTOCK, OUTOFSTOCK)
- `status` - Filter by price status (RED, GREEN, NEUTRAL)
- `q` - Full-text search

**Example:**
```bash
curl -X GET "https://api.pricepilot.com/v1/products?brand=Dell&category=Laptops&stock=INSTOCK&status=RED" \
  -H "x-api-key: your-api-key-here"
```

### Search

Use the `q` parameter for full-text search:

```bash
curl -X GET "https://api.pricepilot.com/v1/products?q=Dell+XPS+15" \
  -H "x-api-key: your-api-key-here"
```

---

## Webhooks

### Setting Up Webhooks

Webhooks allow you to receive real-time notifications when events occur in your PricePilot account.

**Create a webhook:**
```bash
curl -X POST "https://api.pricepilot.com/v1/webhooks" \
  -H "x-api-key: your-api-key-here" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://your-server.com/webhook",
    "events": ["price.changed", "sync.completed"],
    "secret": "your-webhook-secret"
  }'
```

### Available Events

- `product.created` - New product added
- `product.updated` - Product updated
- `product.deleted` - Product deleted
- `price.changed` - Price changed
- `match.approved` - Match approved
- `match.rejected` - Match rejected
- `competitor.added` - Competitor added
- `competitor.removed` - Competitor removed
- `sync.started` - Sync started
- `sync.completed` - Sync completed
- `sync.failed` - Sync failed

### Webhook Payload

All webhook payloads follow this format:

```json
{
  "event": "price.changed",
  "timestamp": "2026-02-01T10:00:00Z",
  "data": {
    "productId": "prod-123",
    "oldPrice": 299.99,
    "newPrice": 279.99,
    "strategy": "UNDERCUT"
  }
}
```

### Verifying Webhooks

Verify webhook authenticity using the signature:

```javascript
const crypto = require('crypto');

function verifyWebhook(payload, signature, secret) {
  const hmac = crypto.createHmac('sha256', secret);
  const digest = hmac.update(JSON.stringify(payload)).digest('hex');
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(digest)
  );
}

// In your webhook handler
app.post('/webhook', (req, res) => {
  const signature = req.headers['x-pricepilot-signature'];
  const isValid = verifyWebhook(req.body, signature, webhookSecret);
  
  if (!isValid) {
    return res.status(401).send('Invalid signature');
  }
  
  // Process webhook
  console.log('Event:', req.body.event);
  res.status(200).send('OK');
});
```

