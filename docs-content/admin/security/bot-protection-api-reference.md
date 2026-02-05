---
title: "Bot Protection API Reference"
description: "API reference for bot protection features"
category: "security"
tags: ["bot-protection", "api", "security"]
audience: "admin"
relatedDocs: ["/docs/integrations/bot-protection-api-reference.md"]
---

# Bot Protection API Reference

## Overview

The Bot Protection API provides comprehensive endpoints for managing competitor website scraping, proxy configuration, monitoring metrics, and handling bot protection mechanisms. All endpoints require authentication via API token.

## Base URL

```
https://your-domain.com/api/v1/scraping
```

## Authentication

All API requests require authentication using a Bearer token:

```
Authorization: Bearer <your-api-token>
```

## Rate Limits

- **Authenticated requests**: 1000 requests/hour
- **Scraping endpoints**: 10 requests/minute per competitor site
- **Configuration endpoints**: 100 requests/hour

Rate limit headers are included in all responses:
- `X-RateLimit-Limit`: Total allowed requests
- `X-RateLimit-Remaining`: Remaining requests in current window
- `X-RateLimit-Reset`: Timestamp when limit resets

## Response Format

### Success Response

```json
{
  "success": true,
  "data": {
    // Response data
  },
  "meta": {
    "requestId": "uuid",
    "timestamp": "2024-01-15T10:30:00Z"
  }
}
```

### Error Response

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message",
    "details": {
      // Additional error context
    }
  },
  "meta": {
    "requestId": "uuid",
    "timestamp": "2024-01-15T10:30:00Z"
  }
}
```


## Error Codes

| Code | Description | HTTP Status |
|------|-------------|-------------|
| `SCRAPING_FAILED` | General scraping failure | 500 |
| `PROXY_UNAVAILABLE` | No proxies available for scraping | 503 |
| `CAPTCHA_DETECTED` | CAPTCHA challenge encountered | 200 |
| `RATE_LIMITED` | Rate limit exceeded | 429 |
| `INVALID_CONFIGURATION` | Configuration validation failed | 400 |
| `PARSING_FAILED` | Unable to extract price data | 500 |
| `NETWORK_ERROR` | Network connectivity issue | 500 |
| `TIMEOUT_ERROR` | Request timeout | 504 |
| `UNAUTHORIZED` | Missing or invalid authentication | 401 |
| `FORBIDDEN` | Insufficient permissions | 403 |
| `NOT_FOUND` | Resource not found | 404 |
| `VALIDATION_ERROR` | Input validation failed | 422 |

---

## Scraping Configuration Endpoints

### List All Configurations

Get scraping configurations for all competitor websites.

**Endpoint**: `GET /api/v1/scraping/configs`

**Query Parameters**:
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 20, max: 100)

**Response**:
```json
{
  "success": true,
  "data": {
    "configs": [
      {
        "id": "uuid",
        "competitorWebsiteId": "uuid",
        "competitorWebsiteName": "Example Store",
        "preferredStrategy": "http_client",
        "requiresJavaScript": false,
        "proxyRequired": true,
        "baseDelayMs": 2000,
        "maxDelayMs": 300000,
        "backoffMultiplier": 2.0,
        "maxRetries": 3,
        "timeoutMs": 30000,
        "priceSelectors": [".price", ".product-price"],
        "currencySelector": ".currency",
        "fallbackRegex": "\\$([0-9,]+\\.\\d{2})",
        "createdAt": "2024-01-15T10:00:00Z",
        "updatedAt": "2024-01-15T10:00:00Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 45,
      "totalPages": 3
    }
  }
}
```


### Get Configuration for Specific Site

Get scraping configuration for a specific competitor website.

**Endpoint**: `GET /api/v1/scraping/configs/:competitorWebsiteId`

**Path Parameters**:
- `competitorWebsiteId`: UUID of the competitor website

**Response**:
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "competitorWebsiteId": "uuid",
    "preferredStrategy": "headless_browser",
    "requiresJavaScript": true,
    "proxyRequired": true,
    "baseDelayMs": 3000,
    "maxDelayMs": 300000,
    "backoffMultiplier": 2.0,
    "maxRetries": 5,
    "timeoutMs": 45000,
    "priceSelectors": [".product-price", "#price"],
    "currencySelector": ".currency-symbol",
    "fallbackRegex": "\\$([0-9,]+\\.\\d{2})",
    "createdAt": "2024-01-15T10:00:00Z",
    "updatedAt": "2024-01-15T12:30:00Z"
  }
}
```

### Update Configuration

Update scraping configuration for a specific competitor website.

**Endpoint**: `PUT /api/v1/scraping/configs/:competitorWebsiteId`

**Path Parameters**:
- `competitorWebsiteId`: UUID of the competitor website

**Request Body**:
```json
{
  "preferredStrategy": "headless_browser",
  "requiresJavaScript": true,
  "proxyRequired": true,
  "baseDelayMs": 3000,
  "maxDelayMs": 300000,
  "backoffMultiplier": 2.0,
  "maxRetries": 5,
  "timeoutMs": 45000,
  "priceSelectors": [".product-price", "#price"],
  "currencySelector": ".currency-symbol",
  "fallbackRegex": "\\$([0-9,]+\\.\\d{2})"
}
```

**Validation Rules**:
- `preferredStrategy`: Must be one of: `http_client`, `http_with_proxy`, `headless_browser`, `headless_with_proxy`, `stealth_browser`
- `baseDelayMs`: Must be > 0 and < maxDelayMs
- `maxDelayMs`: Must be > baseDelayMs
- `backoffMultiplier`: Must be >= 1.0
- `maxRetries`: Must be >= 0 and <= 10
- `timeoutMs`: Must be > 0
- `priceSelectors`: Must be non-empty array of valid CSS selectors

**Response**:
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "competitorWebsiteId": "uuid",
    "preferredStrategy": "headless_browser",
    // ... updated configuration
    "updatedAt": "2024-01-15T14:00:00Z"
  }
}
```


### Test Configuration

Test a scraping configuration before saving it.

**Endpoint**: `POST /api/v1/scraping/configs/:competitorWebsiteId/test`

**Path Parameters**:
- `competitorWebsiteId`: UUID of the competitor website

**Request Body**:
```json
{
  "testUrl": "https://competitor.com/product/123",
  "config": {
    "preferredStrategy": "headless_browser",
    "priceSelectors": [".new-price-selector"],
    "timeoutMs": 30000
  }
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "testSuccessful": true,
    "priceExtracted": 99.99,
    "currency": "USD",
    "responseTime": 2345,
    "strategyUsed": "headless_browser",
    "protectionDetected": false,
    "message": "Configuration test successful"
  }
}
```

**Error Response** (if test fails):
```json
{
  "success": false,
  "error": {
    "code": "TEST_FAILED",
    "message": "Configuration test failed",
    "details": {
      "reason": "Invalid CSS selector",
      "selector": ".new-price-selector",
      "suggestions": ["Check selector syntax", "Verify selector exists on page"]
    }
  }
}
```

### Get Configuration History

Get the change history for a competitor website's configuration.

**Endpoint**: `GET /api/v1/scraping/configs/:competitorWebsiteId/history`

**Path Parameters**:
- `competitorWebsiteId`: UUID of the competitor website

**Query Parameters**:
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 20, max: 100)

**Response**:
```json
{
  "success": true,
  "data": {
    "history": [
      {
        "id": "uuid",
        "competitorWebsiteId": "uuid",
        "changedBy": "user@example.com",
        "changedAt": "2024-01-15T14:00:00Z",
        "changes": {
          "preferredStrategy": {
            "old": "http_client",
            "new": "headless_browser"
          },
          "maxRetries": {
            "old": 3,
            "new": 5
          }
        }
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 12,
      "totalPages": 1
    }
  }
}
```


### Revert Configuration

Revert to a previous configuration version.

**Endpoint**: `POST /api/v1/scraping/configs/:competitorWebsiteId/history`

**Path Parameters**:
- `competitorWebsiteId`: UUID of the competitor website

**Request Body**:
```json
{
  "historyId": "uuid"
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "message": "Configuration reverted successfully",
    "config": {
      // Reverted configuration
    }
  }
}
```

---

## Proxy Management Endpoints

### List All Proxies

Get all configured proxies with optional filtering.

**Endpoint**: `GET /api/v1/scraping/proxies`

**Query Parameters**:
- `status` (optional): Filter by status (`active`, `disabled`)
- `provider` (optional): Filter by provider name
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 20, max: 100)

**Response**:
```json
{
  "success": true,
  "data": {
    "proxies": [
      {
        "id": "uuid",
        "provider": "ProxyProvider Inc",
        "host": "proxy1.example.com",
        "port": 8080,
        "protocol": "http",
        "region": "us-east",
        "status": "active",
        "globalSuccessCount": 1250,
        "globalFailureCount": 45,
        "globalSuccessRate": 96.5,
        "createdAt": "2024-01-10T08:00:00Z",
        "updatedAt": "2024-01-15T14:00:00Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 15,
      "totalPages": 1
    }
  }
}
```

### Create Proxy

Add a new proxy to the pool.

**Endpoint**: `POST /api/v1/scraping/proxies`

**Request Body**:
```json
{
  "provider": "ProxyProvider Inc",
  "host": "proxy2.example.com",
  "port": 8080,
  "protocol": "http",
  "username": "proxyuser",
  "password": "proxypass",
  "region": "us-west"
}
```

**Validation Rules**:
- `host`: Required, valid hostname or IP
- `port`: Required, 1-65535
- `protocol`: Required, one of: `http`, `https`, `socks5`
- `provider`: Required, non-empty string
- `username`, `password`: Optional, both required if one is provided

**Response**:
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "provider": "ProxyProvider Inc",
    "host": "proxy2.example.com",
    "port": 8080,
    "protocol": "http",
    "region": "us-west",
    "status": "active",
    "createdAt": "2024-01-15T15:00:00Z"
  }
}
```


### Get Proxy Details

Get details for a specific proxy.

**Endpoint**: `GET /api/v1/scraping/proxies/:id`

**Path Parameters**:
- `id`: UUID of the proxy

**Response**:
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "provider": "ProxyProvider Inc",
    "host": "proxy1.example.com",
    "port": 8080,
    "protocol": "http",
    "region": "us-east",
    "status": "active",
    "globalSuccessCount": 1250,
    "globalFailureCount": 45,
    "globalSuccessRate": 96.5,
    "createdAt": "2024-01-10T08:00:00Z",
    "updatedAt": "2024-01-15T14:00:00Z"
  }
}
```

### Update Proxy

Update proxy configuration.

**Endpoint**: `PUT /api/v1/scraping/proxies/:id`

**Path Parameters**:
- `id`: UUID of the proxy

**Request Body**:
```json
{
  "status": "disabled",
  "region": "us-central"
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "status": "disabled",
    "region": "us-central",
    "updatedAt": "2024-01-15T15:30:00Z"
  }
}
```

### Delete Proxy

Remove a proxy from the pool.

**Endpoint**: `DELETE /api/v1/scraping/proxies/:id`

**Path Parameters**:
- `id`: UUID of the proxy

**Response**:
```json
{
  "success": true,
  "data": {
    "message": "Proxy deleted successfully"
  }
}
```

### Get Proxy Health

Get detailed health statistics for a specific proxy.

**Endpoint**: `GET /api/v1/scraping/proxies/:id/health`

**Path Parameters**:
- `id`: UUID of the proxy

**Response**:
```json
{
  "success": true,
  "data": {
    "proxyId": "uuid",
    "globalSuccessRate": 96.5,
    "lastSuccess": "2024-01-15T14:45:00Z",
    "lastFailure": "2024-01-15T10:20:00Z",
    "isBlocked": false,
    "siteSpecificHealth": [
      {
        "competitorWebsiteId": "uuid",
        "competitorWebsiteName": "Example Store",
        "successCount": 450,
        "failureCount": 12,
        "successRate": 97.4,
        "lastSuccess": "2024-01-15T14:45:00Z",
        "lastFailure": "2024-01-14T16:30:00Z",
        "cooldownUntil": null
      }
    ]
  }
}
```


---

## Monitoring & Metrics Endpoints

### Get Metrics Summary

Get overall scraping metrics summary.

**Endpoint**: `GET /api/v1/scraping/metrics/summary`

**Query Parameters**:
- `timeWindow` (optional): Time window for metrics (`last_hour`, `last_24_hours`, `last_7_days`, `last_30_days`). Default: `last_24_hours`

**Response**:
```json
{
  "success": true,
  "data": {
    "timeWindow": "last_24_hours",
    "totalAttempts": 1250,
    "successfulAttempts": 1180,
    "failedAttempts": 70,
    "successRate": 94.4,
    "averageResponseTime": 2345,
    "protectionTypeBreakdown": {
      "ip_block": 25,
      "rate_limit": 15,
      "captcha": 5,
      "fake_data": 10,
      "delayed_response": 8,
      "none": 1180
    },
    "strategyBreakdown": {
      "http_client": 850,
      "http_with_proxy": 200,
      "headless_browser": 150,
      "headless_with_proxy": 50
    }
  }
}
```

### Get Site Metrics

Get metrics for all competitor sites.

**Endpoint**: `GET /api/v1/scraping/metrics/sites`

**Query Parameters**:
- `timeWindow` (optional): Time window for metrics. Default: `last_24_hours`
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 20, max: 100)

**Response**:
```json
{
  "success": true,
  "data": {
    "sites": [
      {
        "competitorWebsiteId": "uuid",
        "siteName": "Example Store",
        "successRate": 98.5,
        "totalAttempts": 450,
        "averageResponseTime": 1850,
        "lastSuccess": "2024-01-15T14:45:00Z",
        "lastFailure": "2024-01-14T10:20:00Z",
        "currentStatus": "healthy"
      },
      {
        "competitorWebsiteId": "uuid",
        "siteName": "Another Store",
        "successRate": 65.2,
        "totalAttempts": 320,
        "averageResponseTime": 3200,
        "lastSuccess": "2024-01-15T13:30:00Z",
        "lastFailure": "2024-01-15T14:00:00Z",
        "currentStatus": "degraded"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 45,
      "totalPages": 3
    }
  }
}
```

**Status Indicators**:
- `healthy`: Success rate ≥ 80%
- `degraded`: Success rate 50-79%
- `blocked`: Success rate < 50%


### Get Specific Site Metrics

Get detailed metrics for a specific competitor site.

**Endpoint**: `GET /api/v1/scraping/metrics/sites/:competitorWebsiteId`

**Path Parameters**:
- `competitorWebsiteId`: UUID of the competitor website

**Query Parameters**:
- `timeWindow` (optional): Time window for metrics. Default: `last_24_hours`

**Response**:
```json
{
  "success": true,
  "data": {
    "competitorWebsiteId": "uuid",
    "siteName": "Example Store",
    "successRate": 98.5,
    "totalAttempts": 450,
    "successfulAttempts": 443,
    "failedAttempts": 7,
    "averageResponseTime": 1850,
    "lastSuccess": "2024-01-15T14:45:00Z",
    "lastFailure": "2024-01-14T10:20:00Z",
    "currentStatus": "healthy",
    "protectionTypeBreakdown": {
      "ip_block": 2,
      "rate_limit": 3,
      "captcha": 0,
      "fake_data": 1,
      "delayed_response": 1,
      "none": 443
    },
    "strategyBreakdown": {
      "http_client": 380,
      "http_with_proxy": 50,
      "headless_browser": 20
    },
    "hourlyTrend": [
      {
        "hour": "2024-01-15T14:00:00Z",
        "attempts": 45,
        "successRate": 97.8,
        "avgResponseTime": 1920
      }
    ]
  }
}
```

---

## Logging & Debugging Endpoints

### Query Scrape Attempts

Get scrape attempt logs with filtering.

**Endpoint**: `GET /api/v1/scraping/attempts`

**Query Parameters**:
- `competitorWebsiteId` (optional): Filter by competitor website
- `competitorProductId` (optional): Filter by competitor product
- `success` (optional): Filter by success status (`true`, `false`)
- `protectionType` (optional): Filter by protection type
- `startDate` (optional): Filter by start date (ISO 8601)
- `endDate` (optional): Filter by end date (ISO 8601)
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 20, max: 100)

**Response**:
```json
{
  "success": true,
  "data": {
    "attempts": [
      {
        "id": "uuid",
        "competitorProductId": "uuid",
        "competitorWebsiteId": "uuid",
        "url": "https://competitor.com/product/123",
        "strategy": "http_with_proxy",
        "proxyId": "uuid",
        "userAgent": "Mozilla/5.0...",
        "success": true,
        "protectionDetected": false,
        "statusCode": 200,
        "responseTime": 1850,
        "responseSize": 45678,
        "attemptNumber": 1,
        "createdAt": "2024-01-15T14:45:00Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 1250,
      "totalPages": 63
    }
  }
}
```


### Get Specific Scrape Attempt

Get detailed information about a specific scrape attempt.

**Endpoint**: `GET /api/v1/scraping/attempts/:id`

**Path Parameters**:
- `id`: UUID of the scrape attempt

**Response**:
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "competitorProductId": "uuid",
    "competitorWebsiteId": "uuid",
    "url": "https://competitor.com/product/123",
    "strategy": "headless_browser",
    "proxyId": "uuid",
    "userAgent": "Mozilla/5.0...",
    "success": false,
    "protectionDetected": true,
    "protectionType": "captcha",
    "statusCode": 403,
    "responseTime": 3200,
    "responseSize": 12345,
    "responseSample": "<!DOCTYPE html><html>...",
    "screenshotUrl": "https://storage.example.com/screenshots/uuid.png",
    "errorMessage": "CAPTCHA challenge detected",
    "attemptNumber": 2,
    "createdAt": "2024-01-15T14:45:00Z",
    "detection": {
      "protectionType": "captcha",
      "confidence": 95.5,
      "indicators": ["recaptcha keyword found", "challenge form detected"],
      "reasoning": "HTML contains reCAPTCHA challenge form"
    }
  }
}
```

### Get Screenshot

Get the screenshot for a specific scrape attempt.

**Endpoint**: `GET /api/v1/scraping/attempts/:id/screenshot`

**Path Parameters**:
- `id`: UUID of the scrape attempt

**Response**: Binary image data (PNG format)

**Headers**:
- `Content-Type`: `image/png`
- `Content-Disposition`: `inline; filename="screenshot-{id}.png"`

### Query Protection Detections

Get bot protection detection logs.

**Endpoint**: `GET /api/v1/scraping/detections`

**Query Parameters**:
- `competitorWebsiteId` (optional): Filter by competitor website
- `protectionType` (optional): Filter by protection type
- `minConfidence` (optional): Minimum confidence score (0-100)
- `startDate` (optional): Filter by start date (ISO 8601)
- `endDate` (optional): Filter by end date (ISO 8601)
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 20, max: 100)

**Response**:
```json
{
  "success": true,
  "data": {
    "detections": [
      {
        "id": "uuid",
        "scrapeAttemptId": "uuid",
        "protectionType": "ip_block",
        "confidence": 98.5,
        "indicators": ["403 status code", "access denied message"],
        "reasoning": "HTTP 403 with IP blocking error message",
        "createdAt": "2024-01-15T14:45:00Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 125,
      "totalPages": 7
    }
  }
}
```


---

## Alert Management Endpoints

### List Alerts

Get all scraping alerts with filtering.

**Endpoint**: `GET /api/v1/scraping/alerts`

**Query Parameters**:
- `severity` (optional): Filter by severity (`info`, `warning`, `critical`)
- `type` (optional): Filter by alert type
- `competitorWebsiteId` (optional): Filter by competitor website
- `acknowledged` (optional): Filter by acknowledged status (`true`, `false`)
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 20, max: 100)

**Response**:
```json
{
  "success": true,
  "data": {
    "alerts": [
      {
        "id": "uuid",
        "severity": "critical",
        "type": "captcha_detected",
        "title": "CAPTCHA Challenge Detected",
        "message": "CAPTCHA challenge detected on Example Store. Manual intervention may be required.",
        "competitorWebsiteId": "uuid",
        "competitorWebsiteName": "Example Store",
        "metadata": {
          "protectionType": "captcha",
          "successRate": 45.2,
          "recentFailures": 12
        },
        "acknowledged": false,
        "createdAt": "2024-01-15T14:45:00Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 8,
      "totalPages": 1
    }
  }
}
```

**Alert Types**:
- `success_rate_drop`: Success rate dropped below threshold
- `captcha_detected`: CAPTCHA challenge encountered
- `all_proxies_blocked`: All proxies blocked for a site
- `site_blocked`: Site appears to be blocking all requests
- `high_failure_rate`: High failure rate detected
- `scraping_recovered`: Scraping performance recovered

### Acknowledge Alert

Mark an alert as acknowledged.

**Endpoint**: `POST /api/v1/scraping/alerts/:id/acknowledge`

**Path Parameters**:
- `id`: UUID of the alert

**Response**:
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "acknowledged": true,
    "acknowledgedAt": "2024-01-15T15:00:00Z",
    "acknowledgedBy": "user@example.com"
  }
}
```

### Delete Alert

Delete an alert.

**Endpoint**: `DELETE /api/v1/scraping/alerts/:id`

**Path Parameters**:
- `id`: UUID of the alert

**Response**:
```json
{
  "success": true,
  "data": {
    "message": "Alert deleted successfully"
  }
}
```


---

## Staleness Configuration Endpoints

### Get Staleness Configuration

Get the staleness threshold configuration.

**Endpoint**: `GET /api/v1/scraping/staleness-config`

**Response**:
```json
{
  "success": true,
  "data": {
    "stalenessThresholdHours": 24,
    "updatedAt": "2024-01-15T10:00:00Z"
  }
}
```

### Update Staleness Configuration

Update the staleness threshold.

**Endpoint**: `PUT /api/v1/scraping/staleness-config`

**Request Body**:
```json
{
  "stalenessThresholdHours": 48
}
```

**Validation Rules**:
- `stalenessThresholdHours`: Must be > 0 and <= 720 (30 days)

**Response**:
```json
{
  "success": true,
  "data": {
    "stalenessThresholdHours": 48,
    "updatedAt": "2024-01-15T15:30:00Z"
  }
}
```

---

## Manual Price Entry Endpoint

### Submit Manual Price

Manually enter a competitor product price when automated scraping fails.

**Endpoint**: `POST /api/v1/competitor-products/:id/manual-price`

**Path Parameters**:
- `id`: UUID of the competitor product

**Request Body**:
```json
{
  "price": 99.99,
  "currency": "USD"
}
```

**Validation Rules**:
- `price`: Must be > 0 and < 1000000
- `currency`: Optional, 3-letter currency code

**Response**:
```json
{
  "success": true,
  "data": {
    "competitorProductId": "uuid",
    "price": 99.99,
    "currency": "USD",
    "enteredBy": "user@example.com",
    "enteredAt": "2024-01-15T15:45:00Z",
    "isManual": true
  }
}
```

---

## Price History Endpoint

### Get Price History

Get price history for a competitor product.

**Endpoint**: `GET /api/v1/competitor-products/:id/price-history`

**Path Parameters**:
- `id`: UUID of the competitor product

**Query Parameters**:
- `startDate` (optional): Start date for history (ISO 8601)
- `endDate` (optional): End date for history (ISO 8601)
- `limit` (optional): Maximum number of records (default: 100, max: 1000)

**Response**:
```json
{
  "success": true,
  "data": {
    "competitorProductId": "uuid",
    "history": [
      {
        "price": 99.99,
        "currency": "USD",
        "recordedAt": "2024-01-15T14:00:00Z",
        "isManual": false,
        "scrapedSuccessfully": true
      },
      {
        "price": 89.99,
        "currency": "USD",
        "recordedAt": "2024-01-14T14:00:00Z",
        "isManual": true,
        "enteredBy": "user@example.com"
      }
    ],
    "summary": {
      "currentPrice": 99.99,
      "lowestPrice": 79.99,
      "highestPrice": 109.99,
      "averagePrice": 94.50,
      "priceChanges": 5
    }
  }
}
```


---

## Webhooks

### Alert Webhook

When alerts are triggered, PricePilot can send webhook notifications to configured endpoints.

**Webhook URL Configuration**: Set in tenant settings

**Request Method**: `POST`

**Request Headers**:
```
Content-Type: application/json
X-PricePilot-Signature: <HMAC-SHA256 signature>
X-PricePilot-Event: alert.triggered
```

**Request Body**:
```json
{
  "event": "alert.triggered",
  "timestamp": "2024-01-15T14:45:00Z",
  "data": {
    "alertId": "uuid",
    "tenantId": "uuid",
    "severity": "critical",
    "type": "captcha_detected",
    "title": "CAPTCHA Challenge Detected",
    "message": "CAPTCHA challenge detected on Example Store",
    "competitorWebsiteId": "uuid",
    "competitorWebsiteName": "Example Store",
    "metadata": {
      "protectionType": "captcha",
      "successRate": 45.2,
      "recentFailures": 12
    }
  }
}
```

**Expected Response**: HTTP 200-299 status code

**Retry Policy**: 
- Retries on failure: 3 attempts
- Backoff: Exponential (1s, 2s, 4s)
- Timeout: 10 seconds per attempt

---

## Code Examples

### JavaScript/TypeScript

```typescript
// Initialize API client
const API_BASE = 'https://your-domain.com/api/v1/scraping';
const API_TOKEN = 'your-api-token';

const headers = {
  'Authorization': `Bearer ${API_TOKEN}`,
  'Content-Type': 'application/json'
};

// Get metrics summary
async function getMetricsSummary() {
  const response = await fetch(`${API_BASE}/metrics/summary?timeWindow=last_24_hours`, {
    headers
  });
  const data = await response.json();
  return data;
}

// Update scraping configuration
async function updateConfig(competitorWebsiteId: string, config: any) {
  const response = await fetch(`${API_BASE}/configs/${competitorWebsiteId}`, {
    method: 'PUT',
    headers,
    body: JSON.stringify(config)
  });
  const data = await response.json();
  return data;
}

// Add a new proxy
async function addProxy(proxyData: any) {
  const response = await fetch(`${API_BASE}/proxies`, {
    method: 'POST',
    headers,
    body: JSON.stringify(proxyData)
  });
  const data = await response.json();
  return data;
}

// Query scrape attempts
async function getScrapingLogs(filters: any) {
  const params = new URLSearchParams(filters);
  const response = await fetch(`${API_BASE}/attempts?${params}`, {
    headers
  });
  const data = await response.json();
  return data;
}
```

### Python

```python
import requests

API_BASE = 'https://your-domain.com/api/v1/scraping'
API_TOKEN = 'your-api-token'

headers = {
    'Authorization': f'Bearer {API_TOKEN}',
    'Content-Type': 'application/json'
}

# Get metrics summary
def get_metrics_summary():
    response = requests.get(
        f'{API_BASE}/metrics/summary',
        headers=headers,
        params={'timeWindow': 'last_24_hours'}
    )
    return response.json()

# Update scraping configuration
def update_config(competitor_website_id, config):
    response = requests.put(
        f'{API_BASE}/configs/{competitor_website_id}',
        headers=headers,
        json=config
    )
    return response.json()

# Add a new proxy
def add_proxy(proxy_data):
    response = requests.post(
        f'{API_BASE}/proxies',
        headers=headers,
        json=proxy_data
    )
    return response.json()

# Query scrape attempts
def get_scraping_logs(filters):
    response = requests.get(
        f'{API_BASE}/attempts',
        headers=headers,
        params=filters
    )
    return response.json()
```

---

## Best Practices

### Rate Limiting
- Implement exponential backoff when receiving 429 responses
- Cache frequently accessed data (metrics, configurations)
- Use pagination for large result sets
- Monitor rate limit headers

### Error Handling
- Always check the `success` field in responses
- Log `requestId` for debugging
- Implement retry logic for transient errors
- Handle specific error codes appropriately

### Security
- Store API tokens securely (environment variables, secrets manager)
- Use HTTPS for all requests
- Rotate API tokens regularly
- Validate webhook signatures

### Performance
- Use appropriate time windows for metrics queries
- Implement client-side caching
- Batch operations when possible
- Use webhooks instead of polling for alerts

---

## Support

For API support, contact:
- Email: api-support@pricepilot.com
- Documentation: https://docs.pricepilot.com
- Status Page: https://status.pricepilot.com
