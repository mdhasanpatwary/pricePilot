---
title: "API Request and Response Examples"
description: "Examples of API requests and responses for common operations"
category: "pricing"
tags: ["api", "examples", "tutorial"]
audience: "tenant"
author: "PricePilot Team"
lastReviewed: "2024-05-20"
---

# API Request/Response Examples

This document provides comprehensive request and response examples for all PricePilot API endpoints.

## Table of Contents

1. [Authentication](#authentication)
2. [Products](#products)
3. [Competitors](#competitors)
4. [Price Approvals](#price-approvals)
5. [Price Updates](#price-updates)
6. [Integrations](#integrations)
7. [Product Matching](#product-matching)
8. [Auto-Approval Rules](#auto-approval-rules)
9. [Approval Delegation](#approval-delegation)
10. [Analytics](#analytics)
11. [Sync Operations](#sync-operations)
12. [System Health](#system-health)

---

## Authentication

All API requests (except `/auth/register` and `/health`) require authentication using one of these methods:

### API Key Authentication (Recommended for API integrations)

```bash
curl -X GET 'https://api.pricepilot.com/v1/products' \
  -H 'x-api-key: pk_live_1234567890abcdef' \
  -H 'Content-Type: application/json'
```

### Session Authentication (For web application)

Session cookies are automatically sent by the browser after login.

```bash
curl -X GET 'https://api.pricepilot.com/v1/products' \
  -H 'Cookie: next-auth.session-token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' \
  -H 'Content-Type: application/json'
```

---

## 1. Authentication Endpoints

### POST /auth/register

Register a new user account and tenant.

**Request:**
```bash
curl -X POST 'https://api.pricepilot.com/v1/auth/register' \
  -H 'Content-Type: application/json' \
  -d '{
    "email": "john@example.com",
    "password": "SecurePass123!",
    "companyName": "Acme Electronics"
  }'
```


**Success Response (201):**
```json
{
  "message": "User registered successfully",
  "userId": "123e4567-e89b-12d3-a456-426614174000"
}
```

**Error Response - User Already Exists (409):**
```json
{
  "error": "User with this email already exists"
}
```

**Error Response - Validation Error (422):**
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

**Error Response - Rate Limit (429):**
```json
{
  "error": "Rate limit exceeded. Please try again later."
}
```

---

## 2. Products

### GET /products

List all products with competitor price comparisons.

**Request:**
```bash
curl -X GET 'https://api.pricepilot.com/v1/products?page=1&limit=20&brand=Dell&stock=INSTOCK&sortBy=updatedAt&sortOrder=desc' \
  -H 'x-api-key: pk_live_1234567890abcdef'
```

**Success Response (200):**
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
      "compInStock": true,
      "image": "https://example.com/image.jpg",
      "url": "https://yourstore.com/laptop-001",
      "specifications": {
        "ram": "16GB",
        "storage": "512GB SSD",
        "processor": "Intel i7"
      }
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


**Error Response - Unauthorized (401):**
```json
{
  "error": "Unauthorized - Invalid API key"
}
```

**Error Response - Rate Limit (429):**
```json
{
  "error": "Rate limit exceeded. Please try again in 60 seconds."
}
```

---

## 3. Competitors

### GET /competitors

List all competitor websites being tracked.

**Request:**
```bash
curl -X GET 'https://api.pricepilot.com/v1/competitors?page=1&limit=20' \
  -H 'x-api-key: pk_live_1234567890abcdef'
```

**Success Response (200):**
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
    },
    {
      "id": "comp-456",
      "name": "ElectronicsHub",
      "url": "https://electronicshub.com",
      "products": 32,
      "status": "SYNCING",
      "health": 88,
      "isSyncing": true,
      "isAdvancedProtected": true
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

### POST /competitors

Add a new competitor website to track.

**Request:**
```bash
curl -X POST 'https://api.pricepilot.com/v1/competitors' \
  -H 'x-api-key: pk_live_1234567890abcdef' \
  -H 'Content-Type: application/json' \
  -d '{
    "url": "https://competitor.com",
    "searchQueryPattern": "/search?q={query}"
  }'
```

**Success Response (200):**
```json
{
  "id": "comp-789",
  "name": "TechStore",
  "url": "https://techstore.com",
  "products": 0,
  "status": "PENDING",
  "health": 100,
  "isSyncing": true,
  "isAdvancedProtected": false
}
```

**Error Response - Competitor Limit Reached (403):**
```json
{
  "error": "Competitor tracking limit reached (5). Please upgrade your plan to track more sites."
}
```


**Error Response - Validation Error (422):**
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation failed",
    "details": {
      "fields": {
        "url": [
          "Invalid URL format",
          "URL must start with http:// or https://"
        ]
      }
    }
  }
}
```

### DELETE /competitors

Remove a competitor from tracking.

**Request:**
```bash
curl -X DELETE 'https://api.pricepilot.com/v1/competitors?id=comp-123' \
  -H 'x-api-key: pk_live_1234567890abcdef'
```

**Success Response (200):**
```json
{
  "success": true,
  "message": "Competitor removed successfully"
}
```

**Error Response - Not Found (404):**
```json
{
  "error": "Competitor not found"
}
```

---

## 4. Price Approvals

### GET /price-approvals

Get all pending price changes awaiting approval.

**Request:**
```bash
curl -X GET 'https://api.pricepilot.com/v1/price-approvals?status=PENDING&page=1&limit=20' \
  -H 'x-api-key: pk_live_1234567890abcdef'
```

**Success Response (200):**
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

### POST /price-approvals

Approve or reject price changes.

**Request - Approve:**
```bash
curl -X POST 'https://api.pricepilot.com/v1/price-approvals' \
  -H 'x-api-key: pk_live_1234567890abcdef' \
  -H 'Content-Type: application/json' \
  -d '{
    "action": "approve",
    "changeIds": ["change-123", "change-456"]
  }'
```


**Success Response (200):**
```json
{
  "success": true,
  "message": "2 price changes approved and applied",
  "updated": 2,
  "failed": 0
}
```

**Request - Reject:**
```bash
curl -X POST 'https://api.pricepilot.com/v1/price-approvals' \
  -H 'x-api-key: pk_live_1234567890abcdef' \
  -H 'Content-Type: application/json' \
  -d '{
    "action": "reject",
    "changeIds": ["change-789"]
  }'
```

**Success Response (200):**
```json
{
  "success": true,
  "message": "1 price change rejected",
  "updated": 1,
  "failed": 0
}
```

**Error Response - Some Changes Not Found (400):**
```json
{
  "success": false,
  "message": "Some price changes could not be processed",
  "updated": 1,
  "failed": 1,
  "errors": [
    {
      "changeId": "change-999",
      "error": "Price change not found or already processed"
    }
  ]
}
```

---

## 5. Price Updates

### POST /price-update/bulk

Execute bulk price updates for multiple products.

**Request - Undercut Strategy:**
```bash
curl -X POST 'https://api.pricepilot.com/v1/price-update/bulk' \
  -H 'x-api-key: pk_live_1234567890abcdef' \
  -H 'Content-Type: application/json' \
  -d '{
    "product_ids": ["prod-123", "prod-456"],
    "logic_type": "UNDERCUT",
    "value": 50,
    "min_price": 100
  }'
```

**Success Response - All Updates Successful (200):**
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
    },
    {
      "productId": "prod-456",
      "status": "success",
      "oldPrice": 199.99,
      "newPrice": 149.99
    }
  ]
}
```

**Success Response - Partial Success (200):**
```json
{
  "message": "Price updates completed with errors",
  "updated": 1,
  "failed": 1,
  "details": [
    {
      "productId": "prod-123",
      "status": "success",
      "oldPrice": 299.99,
      "newPrice": 249.99
    },
    {
      "productId": "prod-456",
      "status": "failed",
      "error": "Product not found in store"
    }
  ]
}
```


**Request - Percentage Strategy:**
```bash
curl -X POST 'https://api.pricepilot.com/v1/price-update/bulk' \
  -H 'x-api-key: pk_live_1234567890abcdef' \
  -H 'Content-Type: application/json' \
  -d '{
    "product_ids": ["prod-789"],
    "logic_type": "PERCENTAGE",
    "value": 10,
    "min_price": 50
  }'
```

**Error Response - Validation Error (422):**
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation failed",
    "details": {
      "fields": {
        "product_ids": ["At least one product ID is required"],
        "value": ["Value must be greater than 0"]
      }
    }
  }
}
```

### GET /price-update/rollback

Get rollback history.

**Request:**
```bash
curl -X GET 'https://api.pricepilot.com/v1/price-update/rollback?limit=50' \
  -H 'x-api-key: pk_live_1234567890abcdef'
```

**Success Response - With History (200):**
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
      },
      {
        "id": "rollback-789",
        "type": "bulk",
        "productId": null,
        "oldPrice": 0,
        "newPrice": 0,
        "rolledBackAt": "2026-02-02T14:15:00Z",
        "rolledBackBy": "admin@example.com"
      }
    ],
    "count": 2
  },
  "meta": {
    "timestamp": "2026-02-03T10:00:00Z"
  }
}
```

**Success Response - Empty History (200):**
```json
{
  "success": true,
  "data": {
    "history": [],
    "count": 0
  },
  "meta": {
    "timestamp": "2026-02-03T10:00:00Z"
  }
}
```

### POST /price-update/rollback

Rollback a price change or bulk operation.

**Request - Single Rollback:**
```bash
curl -X POST 'https://api.pricepilot.com/v1/price-update/rollback' \
  -H 'x-api-key: pk_live_1234567890abcdef' \
  -H 'Content-Type: application/json' \
  -d '{
    "updateLogId": "update-123"
  }'
```


**Success Response - Single Rollback (200):**
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

**Request - Bulk Rollback:**
```bash
curl -X POST 'https://api.pricepilot.com/v1/price-update/rollback' \
  -H 'x-api-key: pk_live_1234567890abcdef' \
  -H 'Content-Type: application/json' \
  -d '{
    "snapshotId": "snapshot-456"
  }'
```

**Success Response - Bulk Rollback (200):**
```json
{
  "success": true,
  "data": {
    "type": "bulk",
    "snapshotId": "snapshot-456",
    "message": "Bulk operation rolled back successfully",
    "productsAffected": 25
  }
}
```

**Error Response - Already Rolled Back (400):**
```json
{
  "error": "This operation has already been rolled back"
}
```

**Error Response - Not Found (404):**
```json
{
  "error": "Price update log not found"
}
```

**Error Response - Rollback Failed (500):**
```json
{
  "error": "Rollback completed but failed to sync to store. Please try manual sync."
}
```

---

## 6. Integrations

### GET /integrations

List all connected e-commerce platforms.

**Request:**
```bash
curl -X GET 'https://api.pricepilot.com/v1/integrations' \
  -H 'x-api-key: pk_live_1234567890abcdef'
```

**Success Response (200):**
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
  },
  {
    "id": "int-456",
    "platform": "LARAVEL",
    "type": "USER",
    "name": "shop.example.com",
    "url": "https://shop.example.com",
    "products": 85,
    "status": "CONNECTED",
    "lastSync": "2026-02-01T08:15:00Z"
  }
]
```

### POST /integrations

Connect a new e-commerce platform.

**Request - OpenCart:**
```bash
curl -X POST 'https://api.pricepilot.com/v1/integrations' \
  -H 'x-api-key: pk_live_1234567890abcdef' \
  -H 'Content-Type: application/json' \
  -d '{
    "platform": "OPENCART",
    "baseUrl": "https://mystore.com",
    "apiToken": "your-secure-api-token-here",
    "type": "USER"
  }'
```


**Success Response (201):**
```json
{
  "id": "int-789",
  "platform": "OPENCART",
  "type": "USER",
  "url": "https://mystore.com",
  "status": "CONNECTED"
}
```

**Request - Laravel:**
```bash
curl -X POST 'https://api.pricepilot.com/v1/integrations' \
  -H 'x-api-key: pk_live_1234567890abcdef' \
  -H 'Content-Type: application/json' \
  -d '{
    "platform": "LARAVEL",
    "baseUrl": "https://shop.example.com",
    "apiToken": "your-laravel-api-token",
    "type": "USER"
  }'
```

**Error Response - Store Limit Reached (403):**
```json
{
  "error": "Store connection limit reached. Please upgrade your plan."
}
```

**Error Response - Connection Failed (422):**
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Failed to connect to store",
    "details": {
      "fields": {
        "apiToken": ["Invalid API token or unable to connect to store"]
      }
    }
  }
}
```

### DELETE /integrations

Disconnect an e-commerce platform.

**Request:**
```bash
curl -X DELETE 'https://api.pricepilot.com/v1/integrations?id=int-123' \
  -H 'x-api-key: pk_live_1234567890abcdef'
```

**Success Response (200):**
```json
{
  "success": true,
  "message": "Integration removed successfully"
}
```

---

## 7. Product Matching

### GET /matching

List pending product matches awaiting approval.

**Request:**
```bash
curl -X GET 'https://api.pricepilot.com/v1/matching?q=laptop' \
  -H 'x-api-key: pk_live_1234567890abcdef'
```

**Success Response (200):**
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
  },
  {
    "id": "match-456",
    "confidence": 78.3,
    "matchType": "BRAND_MODEL",
    "status": "PENDING",
    "product": {
      "id": "prod-789",
      "title": "HP Pavilion 14",
      "sku": "HP-PAV-14",
      "price": 899.99
    },
    "competitor": {
      "id": "comp-prod-789",
      "title": "HP Pavilion 14 inch Laptop",
      "sku": "HP-14-PAV",
      "price": 879.99,
      "siteName": "electronicshub.com"
    }
  }
]
```


### POST /matching

Approve or reject a product match.

**Request - Approve:**
```bash
curl -X POST 'https://api.pricepilot.com/v1/matching' \
  -H 'x-api-key: pk_live_1234567890abcdef' \
  -H 'Content-Type: application/json' \
  -d '{
    "matchId": "match-123",
    "action": "APPROVE"
  }'
```

**Success Response - Approved (200):**
```json
{
  "success": true,
  "message": "Match approved successfully"
}
```

**Request - Reject:**
```bash
curl -X POST 'https://api.pricepilot.com/v1/matching' \
  -H 'x-api-key: pk_live_1234567890abcdef' \
  -H 'Content-Type: application/json' \
  -d '{
    "matchId": "match-456",
    "action": "REJECT"
  }'
```

**Success Response - Rejected (200):**
```json
{
  "success": true,
  "message": "Match rejected successfully"
}
```

**Error Response - Not Found (404):**
```json
{
  "error": "Product match not found"
}
```

**Error Response - Action Failed (500):**
```json
{
  "error": "Failed to process match action. Please try again."
}
```

---

## 8. Auto-Approval Rules

### GET /auto-approval-rules

List all auto-approval rules.

**Request:**
```bash
curl -X GET 'https://api.pricepilot.com/v1/auto-approval-rules' \
  -H 'x-api-key: pk_live_1234567890abcdef'
```

**Success Response (200):**
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
    },
    {
      "id": "rule-456",
      "name": "High Confidence Matches",
      "description": "Auto-approve high confidence matches",
      "enabled": true,
      "priority": 2,
      "conditions": {
        "minConfidenceScore": 95,
        "allowedStrategies": ["UNDERCUT", "MATCH"]
      }
    }
  ],
  "meta": {
    "total": 2
  }
}
```

### POST /auto-approval-rules

Create a new auto-approval rule.

**Request:**
```bash
curl -X POST 'https://api.pricepilot.com/v1/auto-approval-rules' \
  -H 'x-api-key: pk_live_1234567890abcdef' \
  -H 'Content-Type: application/json' \
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


**Success Response (201):**
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

**Error Response - Validation Error (422):**
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation failed",
    "details": {
      "fields": {
        "conditions.maxPercentageChange": ["Must be between 0 and 100"],
        "conditions.minConfidenceScore": ["Must be between 0 and 100"]
      }
    }
  }
}
```

### GET /auto-approval-rules/{id}

Get a single auto-approval rule.

**Request:**
```bash
curl -X GET 'https://api.pricepilot.com/v1/auto-approval-rules/rule-123' \
  -H 'x-api-key: pk_live_1234567890abcdef'
```

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "id": "rule-123",
    "name": "Small Price Changes",
    "description": "Auto-approve changes under $20",
    "enabled": true,
    "priority": 1,
    "conditions": {
      "maxPriceChange": 20.00,
      "minConfidenceScore": 85
    },
    "createdAt": "2026-01-15T10:00:00Z",
    "updatedAt": "2026-02-01T14:30:00Z"
  }
}
```

**Error Response - Not Found (404):**
```json
{
  "error": "Auto-approval rule not found"
}
```

### PUT /auto-approval-rules/{id}

Update an auto-approval rule.

**Request:**
```bash
curl -X PUT 'https://api.pricepilot.com/v1/auto-approval-rules/rule-123' \
  -H 'x-api-key: pk_live_1234567890abcdef' \
  -H 'Content-Type: application/json' \
  -d '{
    "name": "Small Price Changes - Updated",
    "enabled": false,
    "priority": 2
  }'
```

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "id": "rule-123",
    "name": "Small Price Changes - Updated",
    "enabled": false,
    "priority": 2,
    "updatedAt": "2026-02-03T10:00:00Z"
  }
}
```

### DELETE /auto-approval-rules/{id}

Delete an auto-approval rule.

**Request:**
```bash
curl -X DELETE 'https://api.pricepilot.com/v1/auto-approval-rules/rule-123' \
  -H 'x-api-key: pk_live_1234567890abcdef'
```

**Success Response (200):**
```json
{
  "success": true,
  "message": "Auto-approval rule deleted successfully"
}
```

---

## 9. Approval Delegation

### GET /approval-delegation

List all approval delegations.

**Request:**
```bash
curl -X GET 'https://api.pricepilot.com/v1/approval-delegation' \
  -H 'x-api-key: pk_live_1234567890abcdef'
```


**Success Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": "delegation-123",
      "fromUserId": "user-456",
      "toUserId": "user-789",
      "fromUser": {
        "id": "user-456",
        "name": "John Doe",
        "email": "john@example.com"
      },
      "toUser": {
        "id": "user-789",
        "name": "Jane Smith",
        "email": "jane@example.com"
      },
      "startDate": "2026-02-01T00:00:00Z",
      "endDate": "2026-02-15T23:59:59Z",
      "isActive": true,
      "createdAt": "2026-01-31T10:00:00Z"
    },
    {
      "id": "delegation-456",
      "fromUserId": "user-456",
      "toUserId": "user-999",
      "fromUser": {
        "id": "user-456",
        "name": "John Doe",
        "email": "john@example.com"
      },
      "toUser": {
        "id": "user-999",
        "name": "Bob Johnson",
        "email": "bob@example.com"
      },
      "startDate": "2026-01-15T00:00:00Z",
      "endDate": "2026-01-31T23:59:59Z",
      "isActive": false,
      "createdAt": "2026-01-14T10:00:00Z"
    }
  ]
}
```

### POST /approval-delegation

Create a new approval delegation.

**Request:**
```bash
curl -X POST 'https://api.pricepilot.com/v1/approval-delegation' \
  -H 'x-api-key: pk_live_1234567890abcdef' \
  -H 'Content-Type: application/json' \
  -d '{
    "toUserId": "user-789",
    "startDate": "2026-02-01T00:00:00Z",
    "endDate": "2026-02-15T23:59:59Z"
  }'
```

**Success Response (201):**
```json
{
  "success": true,
  "data": {
    "id": "delegation-789",
    "fromUserId": "user-456",
    "toUserId": "user-789",
    "startDate": "2026-02-01T00:00:00Z",
    "endDate": "2026-02-15T23:59:59Z"
  }
}
```

**Error Response - Invalid Date Range (422):**
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation failed",
    "details": {
      "fields": {
        "endDate": ["End date must be after start date"]
      }
    }
  }
}
```

**Error Response - User Not Found (422):**
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation failed",
    "details": {
      "fields": {
        "toUserId": ["User not found or not in your tenant"]
      }
    }
  }
}
```

### PATCH /approval-delegation/{id}

Update an approval delegation.

**Request:**
```bash
curl -X PATCH 'https://api.pricepilot.com/v1/approval-delegation/delegation-123' \
  -H 'x-api-key: pk_live_1234567890abcdef' \
  -H 'Content-Type: application/json' \
  -d '{
    "startDate": "2026-02-01T00:00:00Z",
    "endDate": "2026-02-28T23:59:59Z"
  }'
```

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "id": "delegation-123",
    "startDate": "2026-02-01T00:00:00Z",
    "endDate": "2026-02-28T23:59:59Z"
  }
}
```


### DELETE /approval-delegation/{id}

Revoke an approval delegation.

**Request:**
```bash
curl -X DELETE 'https://api.pricepilot.com/v1/approval-delegation/delegation-123' \
  -H 'x-api-key: pk_live_1234567890abcdef'
```

**Success Response (200):**
```json
{
  "success": true,
  "message": "Delegation revoked successfully"
}
```

**Error Response - Not Found (404):**
```json
{
  "error": "Approval delegation not found"
}
```

---

## 10. Analytics

### GET /analytics/summary

Get market intelligence summary.

**Request:**
```bash
curl -X GET 'https://api.pricepilot.com/v1/analytics/summary' \
  -H 'x-api-key: pk_live_1234567890abcdef'
```

**Success Response (200):**
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

## 11. Sync Operations

### POST /sync/full

Trigger a full competitive sync.

**Request:**
```bash
curl -X POST 'https://api.pricepilot.com/v1/sync/full' \
  -H 'x-api-key: pk_live_1234567890abcdef'
```

**Success Response (200):**
```json
{
  "message": "Full sync initiated",
  "syncId": "sync-123"
}
```

**Error Response - Sync Already in Progress (409):**
```json
{
  "skipped": true,
  "message": "Sync already in progress"
}
```

---

## 12. System Health

### GET /health

Check API health status (no authentication required).

**Request:**
```bash
curl -X GET 'https://api.pricepilot.com/v1/health'
```

**Success Response (200):**
```json
{
  "status": "ok",
  "timestamp": "2026-02-03T10:00:00Z",
  "version": "1.0.0"
}
```

**Error Response - Service Unavailable (503):**
```json
{
  "status": "error",
  "message": "Database connection failed"
}
```

---

## Common Error Responses

### 401 Unauthorized

Missing or invalid authentication:

```json
{
  "error": "Unauthorized - API key required"
}
```

```json
{
  "error": "Unauthorized - Invalid API key"
}
```

### 403 Forbidden

Insufficient permissions or resource limits:

```json
{
  "error": "Competitor tracking limit reached (5). Please upgrade your plan to track more sites."
}
```

```json
{
  "error": "Store connection limit reached. Please upgrade your plan."
}
```


### 404 Not Found

Resource not found:

```json
{
  "error": "Product not found"
}
```

```json
{
  "error": "Competitor not found"
}
```

```json
{
  "error": "Auto-approval rule not found"
}
```

### 422 Validation Error

Request validation failed:

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
        "price": ["Must be greater than 0"]
      }
    }
  }
}
```

### 429 Rate Limit Exceeded

Too many requests:

```json
{
  "error": "Rate limit exceeded. Please try again in 60 seconds."
}
```

Response headers include:
- `X-RateLimit-Limit`: Total allowed requests
- `X-RateLimit-Remaining`: Remaining requests
- `X-RateLimit-Reset`: Reset timestamp

### 500 Internal Server Error

Unexpected server error:

```json
{
  "error": "An unexpected error occurred. Please try again or contact support."
}
```

---

## Rate Limits

Different rate limits apply based on authentication and endpoint type:

| Authentication | Limit | Window |
|---------------|-------|--------|
| Authenticated (API Key) | 1000 requests | 1 hour |
| Unauthenticated | 100 requests | 1 hour |
| Scraping endpoints | 10 requests | 1 minute |
| Admin endpoints | 1000 requests | 1 hour |

Rate limit information is included in response headers:
- `X-RateLimit-Limit`: Maximum requests allowed
- `X-RateLimit-Remaining`: Requests remaining in current window
- `X-RateLimit-Reset`: Unix timestamp when the limit resets

---

## Pagination

List endpoints support pagination with these query parameters:

| Parameter | Type | Default | Max | Description |
|-----------|------|---------|-----|-------------|
| `page` | integer | 1 | - | Page number |
| `limit` | integer | 20 | 100 | Items per page |
| `sortBy` | string | varies | - | Field to sort by |
| `sortOrder` | string | desc | - | Sort order (asc/desc) |

Pagination response format:

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

---

## Best Practices

### 1. Use API Keys for Programmatic Access

Generate API keys from your dashboard under Settings > API Keys. Store them securely and never commit them to version control.

### 2. Handle Rate Limits Gracefully

Monitor rate limit headers and implement exponential backoff when limits are reached.

### 3. Validate Responses

Always check the `success` field in responses and handle errors appropriately.

### 4. Use Pagination

For large datasets, use pagination to avoid timeouts and improve performance.

### 5. Implement Retry Logic

For transient errors (500, 503), implement retry logic with exponential backoff.

### 6. Keep API Keys Secure

- Never expose API keys in client-side code
- Rotate keys regularly
- Use environment variables for key storage
- Revoke compromised keys immediately

---

## Support

For API support, contact:
- Email: support@pricepilot.com
- Documentation: https://pricepilot.com/docs
- Status Page: https://status.pricepilot.com

