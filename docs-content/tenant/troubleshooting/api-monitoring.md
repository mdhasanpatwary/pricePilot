---
title: "API Monitoring"
description: "Monitoring API usage and performance"
category: "troubleshooting"
tags: ["api", "monitoring", "usage"]
audience: "tenant"
relatedDocs: ["/admin-docs/system-monitoring/api-monitoring.md"]
---

> **Note:** This is a simplified version for tenants. For technical details, administrators can refer to the [admin documentation](/admin-docs/system-monitoring/api-monitoring.md).

# Monitoring API Reference

## Overview

This document provides detailed API reference for the stealth monitoring endpoints. These endpoints power the admin and tenant monitoring dashboards and can be used for custom integrations.

## Table of Contents

1. [Authentication](#authentication)
2. [Admin Endpoints](#admin-endpoints)
3. [Tenant Endpoints](#tenant-endpoints)
4. [Error Handling](#error-handling)
5. [Rate Limiting](#rate-limiting)
6. [Examples](#examples)

---

## Authentication

All API requests require authentication via NextAuth session or API token.

### Session Authentication (Browser)

Requests from the browser automatically include session cookies. No additional headers required.

### API Token Authentication

For programmatic access, include the API token in the request header:

```http
Authorization: Bearer YOUR_API_TOKEN
```

### Role Requirements

- **Admin Endpoints**: Require `ADMIN` or `SUPER_ADMIN` role
- **Tenant Endpoints**: Require valid tenant authentication

---

## Admin Endpoints

### Proxy Health

#### GET /api/v1/admin/proxy-health

Fetch proxy pool health status and performance metrics.

**Authentication**: Admin role required

**Query Parameters**:

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `timeRange` | string | No | `24h` | Time range for metrics: `24h`, `7d`, `30d` |

**Response**: `200 OK`

```json
{
  "stats": {
    "totalProxies": 10,
    "healthyProxies": 8,
    "unhealthyProxies": 2,
    "avgSuccessRate": 0.85,
    "avgResponseTime": 250
  },
  "proxies": [
    {
      "url": "http://proxy1.example.com:8080",
      "type": "residential",
      "isHealthy": true,
      "successCount": 450,
      "failureCount": 50,
      "successRate": 0.90,
      "avgResponseTime": 230,
      "lastChecked": "2026-01-26T10:30:00Z"
    }
  ]
}
```

**Response Fields**:

- `stats.totalProxies`: Total number of configured proxies
- `stats.healthyProxies`: Number of proxies with success rate > 70%
- `stats.unhealthyProxies`: Number of proxies with success rate < 70%
- `stats.avgSuccessRate`: Average success rate across all proxies (0-1)
- `stats.avgResponseTime`: Average response time in milliseconds
- `proxies[].url`: Proxy URL
- `proxies[].type`: Proxy type (`residential`, `datacenter`, `unknown`)
- `proxies[].isHealthy`: Health status boolean
- `proxies[].successCount`: Number of successful requests
- `proxies[].failureCount`: Number of failed requests
- `proxies[].successRate`: Success rate (0-1)
- `proxies[].avgResponseTime`: Average response time in milliseconds
- `proxies[].lastChecked`: ISO 8601 timestamp of last health check

**Error Responses**:

- `401 Unauthorized`: Missing or invalid authentication
- `403 Forbidden`: User does not have admin role
- `500 Internal Server Error`: Server error occurred

---

### Challenge Statistics

#### GET /api/v1/admin/challenge-stats

Fetch challenge detection and solve rate statistics.

**Authentication**: Admin role required

**Query Parameters**:

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `timeRange` | string | No | `24h` | Time range for statistics: `24h`, `7d`, `30d` |

**Response**: `200 OK`

```json
{
  "summary": {
    "totalChallenges": 150,
    "avgSolveRate": 0.75,
    "mostCommonType": "cloudflare",
    "sitesWithIssues": 2
  },
  "sites": [
    {
      "site": "example.com",
      "totalChallenges": 50,
      "solvedChallenges": 40,
      "failedChallenges": 10,
      "solveRate": 0.80,
      "challengeTypes": [
        {
          "type": "cloudflare",
          "count": 30,
          "solveRate": 0.85
        },
        {
          "type": "recaptcha",
          "count": 20,
          "solveRate": 0.75
        }
      ]
    }
  ]
}
```

**Response Fields**:

- `summary.totalChallenges`: Total challenges detected across all sites
- `summary.avgSolveRate`: Average solve rate across all sites (0-1)
- `summary.mostCommonType`: Most frequently encountered challenge type
- `summary.sitesWithIssues`: Number of sites with solve rate < 30%
- `sites[].site`: Domain name
- `sites[].totalChallenges`: Total challenges for this site
- `sites[].solvedChallenges`: Successfully solved challenges
- `sites[].failedChallenges`: Failed challenge attempts
- `sites[].solveRate`: Solve rate for this site (0-1)
- `sites[].challengeTypes[].type`: Challenge type (`cloudflare`, `turnstile`, `recaptcha`, `perimeterx`, `datadome`)
- `sites[].challengeTypes[].count`: Number of challenges of this type
- `sites[].challengeTypes[].solveRate`: Solve rate for this challenge type (0-1)

**Error Responses**:

- `401 Unauthorized`: Missing or invalid authentication
- `403 Forbidden`: User does not have admin role
- `500 Internal Server Error`: Server error occurred

---

### Scraping Metrics

#### GET /api/v1/admin/scraping-metrics

Fetch comprehensive scraping performance metrics.

**Authentication**: Admin role required

**Query Parameters**:

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `timeRange` | string | No | `24h` | Time range for metrics: `24h`, `7d`, `30d` |

**Response**: `200 OK`

```json
{
  "summary": {
    "totalRequests": 10000,
    "avgSuccessRate": 0.88,
    "avgBlockRate": 0.12,
    "activeSites": 25
  },
  "sites": [
    {
      "site": "example.com",
      "tenant": "tenant-123",
      "totalRequests": 500,
      "successfulRequests": 450,
      "blockedRequests": 50,
      "successRate": 0.90,
      "blockRate": 0.10,
      "avgResponseTime": 280,
      "lastScrapeAt": "2026-01-26T10:45:00Z"
    }
  ]
}
```

**Response Fields**:

- `summary.totalRequests`: Total requests across all sites
- `summary.avgSuccessRate`: Average success rate (0-1)
- `summary.avgBlockRate`: Average block rate (0-1)
- `summary.activeSites`: Number of sites with recent activity
- `sites[].site`: Domain name
- `sites[].tenant`: Tenant identifier
- `sites[].totalRequests`: Total requests for this site
- `sites[].successfulRequests`: Successful requests
- `sites[].blockedRequests`: Blocked requests
- `sites[].successRate`: Success rate (0-1)
- `sites[].blockRate`: Block rate (0-1)
- `sites[].avgResponseTime`: Average response time in milliseconds
- `sites[].lastScrapeAt`: ISO 8601 timestamp of last scrape

**Error Responses**:

- `401 Unauthorized`: Missing or invalid authentication
- `403 Forbidden`: User does not have admin role
- `500 Internal Server Error`: Server error occurred

---

### Active Sessions

#### GET /api/v1/admin/active-sessions

Fetch real-time scraping session data.

**Authentication**: Admin role required

**Response**: `200 OK`

```json
{
  "stats": {
    "activeSessions": 5,
    "requestsPerMinute": 45,
    "avgSessionDuration": 120
  },
  "sessions": [
    {
      "id": "session-123",
      "site": "example.com",
      "tenant": "tenant-456",
      "startTime": "2026-01-26T10:40:00Z",
      "requestsCompleted": 25,
      "requestsTotal": 50,
      "status": "running",
      "currentProxy": "http://proxy1.example.com:8080",
      "challengeType": null,
      "challengeStatus": null
    }
  ]
}
```

**Response Fields**:

- `stats.activeSessions`: Number of currently active sessions
- `stats.requestsPerMinute`: Current request rate
- `stats.avgSessionDuration`: Average session duration in seconds
- `sessions[].id`: Unique session identifier
- `sessions[].site`: Target site domain
- `sessions[].tenant`: Tenant identifier
- `sessions[].startTime`: ISO 8601 timestamp of session start
- `sessions[].requestsCompleted`: Number of completed requests
- `sessions[].requestsTotal`: Total requests planned
- `sessions[].status`: Session status (`running`, `waiting_challenge`, `completed`, `failed`)
- `sessions[].currentProxy`: Proxy URL being used (null if none)
- `sessions[].challengeType`: Challenge type if detected (null if none)
- `sessions[].challengeStatus`: Challenge status (`waiting`, `solved`, `failed`, null)

**Error Responses**:

- `401 Unauthorized`: Missing or invalid authentication
- `403 Forbidden`: User does not have admin role
- `500 Internal Server Error`: Server error occurred

---

### Human Simulation Configuration

#### GET /api/v1/admin/human-simulation-config

Fetch current human simulation configuration.

**Authentication**: Admin role required

**Response**: `200 OK`

```json
{
  "config": {
    "typing": {
      "minDelay": 50,
      "maxDelay": 150
    },
    "actionPause": {
      "minDelay": 100,
      "maxDelay": 2000
    },
    "mouseMovement": {
      "enabled": true,
      "naturalCurves": true
    },
    "formInteraction": {
      "pauseBetweenFields": 500,
      "simulateCorrections": true
    }
  }
}
```

**Response Fields**:

- `config.typing.minDelay`: Minimum typing delay in milliseconds
- `config.typing.maxDelay`: Maximum typing delay in milliseconds
- `config.actionPause.minDelay`: Minimum pause between actions in milliseconds
- `config.actionPause.maxDelay`: Maximum pause between actions in milliseconds
- `config.mouseMovement.enabled`: Whether mouse movement is enabled
- `config.mouseMovement.naturalCurves`: Whether to use natural Bezier curves
- `config.formInteraction.pauseBetweenFields`: Pause between form fields in milliseconds
- `config.formInteraction.simulateCorrections`: Whether to simulate typing corrections

**Error Responses**:

- `401 Unauthorized`: Missing or invalid authentication
- `403 Forbidden`: User does not have admin role
- `500 Internal Server Error`: Server error occurred

---

#### POST /api/v1/admin/human-simulation-config

Update human simulation configuration.

**Authentication**: Admin role required

**Request Body**:

```json
{
  "config": {
    "typing": {
      "minDelay": 60,
      "maxDelay": 140
    },
    "actionPause": {
      "minDelay": 150,
      "maxDelay": 1800
    },
    "mouseMovement": {
      "enabled": true,
      "naturalCurves": true
    },
    "formInteraction": {
      "pauseBetweenFields": 600,
      "simulateCorrections": true
    }
  }
}
```

**Validation Rules**:

- `typing.minDelay`: 10-500ms
- `typing.maxDelay`: 50-1000ms, must be > minDelay
- `actionPause.minDelay`: 50-1000ms
- `actionPause.maxDelay`: 100-5000ms, must be > minDelay
- `pauseBetweenFields`: 100-2000ms

**Response**: `200 OK`

```json
{
  "success": true,
  "config": {
    /* updated configuration */
  }
}
```

**Error Responses**:

- `400 Bad Request`: Validation errors
  ```json
  {
    "error": "Validation failed",
    "message": "Invalid configuration values",
    "details": {
      "typing.maxDelay": "Must be greater than minDelay"
    }
  }
  ```
- `401 Unauthorized`: Missing or invalid authentication
- `403 Forbidden`: User does not have admin role
- `500 Internal Server Error`: Server error occurred

---

### Site Profiles

#### GET /api/v1/admin/site-profiles

Fetch all site profiles and templates.

**Authentication**: Admin role required

**Response**: `200 OK`

```json
{
  "profiles": [
    {
      "id": "profile-123",
      "domain": "example.com",
      "requestsPerMinute": 10,
      "concurrentRequests": 2,
      "minDelay": 1000,
      "maxDelay": 3000,
      "delayMultiplier": 1.5,
      "sessionWarmupEnabled": true,
      "sessionWarmupPaths": ["/", "/products"],
      "referrerChainEnabled": true,
      "createdAt": "2026-01-20T10:00:00Z",
      "updatedAt": "2026-01-26T10:00:00Z"
    }
  ],
  "templates": [
    {
      "name": "Cloudflare",
      "description": "Optimized for Cloudflare-protected sites",
      "profile": {
        "requestsPerMinute": 10,
        "concurrentRequests": 2,
        "minDelay": 3000,
        "maxDelay": 5000,
        "delayMultiplier": 1.5,
        "sessionWarmupEnabled": true,
        "sessionWarmupPaths": ["/"],
        "referrerChainEnabled": true
      }
    }
  ]
}
```

**Response Fields**:

- `profiles[]`: Array of configured site profiles
- `profiles[].id`: Unique profile identifier
- `profiles[].domain`: Target domain
- `profiles[].requestsPerMinute`: Rate limit
- `profiles[].concurrentRequests`: Concurrent request limit
- `profiles[].minDelay`: Minimum delay in milliseconds
- `profiles[].maxDelay`: Maximum delay in milliseconds
- `profiles[].delayMultiplier`: Adaptive delay multiplier
- `profiles[].sessionWarmupEnabled`: Whether warmup is enabled
- `profiles[].sessionWarmupPaths`: Paths to visit during warmup
- `profiles[].referrerChainEnabled`: Whether to track referrer chain
- `templates[]`: Array of pre-configured templates
- `templates[].name`: Template name
- `templates[].description`: Template description
- `templates[].profile`: Template configuration

**Error Responses**:

- `401 Unauthorized`: Missing or invalid authentication
- `403 Forbidden`: User does not have admin role
- `500 Internal Server Error`: Server error occurred

---

#### POST /api/v1/admin/site-profiles

Create or update a site profile.

**Authentication**: Admin role required

**Request Body**:

```json
{
  "profile": {
    "domain": "example.com",
    "requestsPerMinute": 10,
    "concurrentRequests": 2,
    "minDelay": 1000,
    "maxDelay": 3000,
    "delayMultiplier": 1.5,
    "sessionWarmupEnabled": true,
    "sessionWarmupPaths": ["/", "/products"],
    "referrerChainEnabled": true
  }
}
```

**Validation Rules**:

- `domain`: Required, valid domain format
- `requestsPerMinute`: 1-60
- `concurrentRequests`: 1-10
- `minDelay`: 100-10000ms
- `maxDelay`: 500-30000ms, must be > minDelay
- `delayMultiplier`: 1.0-5.0
- `sessionWarmupPaths`: Array of valid URL paths

**Response**: `200 OK`

```json
{
  "success": true,
  "profile": {
    /* created/updated profile */
  }
}
```

**Error Responses**:

- `400 Bad Request`: Validation errors
- `401 Unauthorized`: Missing or invalid authentication
- `403 Forbidden`: User does not have admin role
- `500 Internal Server Error`: Server error occurred

---

#### DELETE /api/v1/admin/site-profiles/:id

Delete a site profile.

**Authentication**: Admin role required

**URL Parameters**:

- `id`: Profile ID to delete

**Response**: `200 OK`

```json
{
  "success": true
}
```

**Error Responses**:

- `404 Not Found`: Profile not found
- `401 Unauthorized`: Missing or invalid authentication
- `403 Forbidden`: User does not have admin role
- `500 Internal Server Error`: Server error occurred

---

### Alerts

#### GET /api/v1/admin/alerts

Fetch system alerts with optional filtering.

**Authentication**: Admin role required

**Query Parameters**:

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `acknowledged` | boolean | No | - | Filter by acknowledged status |
| `severity` | string | No | - | Filter by severity: `critical`, `warning`, `info` |

**Response**: `200 OK`

```json
{
  "alerts": [
    {
      "id": "alert-123",
      "severity": "critical",
      "type": "proxy_failure",
      "message": "All proxies unhealthy",
      "site": null,
      "proxyUrl": null,
      "acknowledged": false,
      "acknowledgedAt": null,
      "createdAt": "2026-01-26T10:00:00Z"
    }
  ],
  "unacknowledgedCount": 3
}
```

**Response Fields**:

- `alerts[]`: Array of alerts
- `alerts[].id`: Unique alert identifier
- `alerts[].severity`: Alert severity (`critical`, `warning`, `info`)
- `alerts[].type`: Alert type (`high_block_rate`, `proxy_failure`, `low_solve_rate`)
- `alerts[].message`: Human-readable alert message
- `alerts[].site`: Affected site domain (null if not site-specific)
- `alerts[].proxyUrl`: Affected proxy URL (null if not proxy-specific)
- `alerts[].acknowledged`: Whether alert has been acknowledged
- `alerts[].acknowledgedAt`: ISO 8601 timestamp of acknowledgment (null if not acknowledged)
- `alerts[].createdAt`: ISO 8601 timestamp of alert creation
- `unacknowledgedCount`: Total number of unacknowledged alerts

**Error Responses**:

- `401 Unauthorized`: Missing or invalid authentication
- `403 Forbidden`: User does not have admin role
- `500 Internal Server Error`: Server error occurred

---

#### POST /api/v1/admin/alerts/:id/acknowledge

Acknowledge an alert.

**Authentication**: Admin role required

**URL Parameters**:

- `id`: Alert ID to acknowledge

**Response**: `200 OK`

```json
{
  "success": true,
  "alert": {
    "id": "alert-123",
    "acknowledged": true,
    "acknowledgedAt": "2026-01-26T11:00:00Z"
  }
}
```

**Error Responses**:

- `404 Not Found`: Alert not found
- `401 Unauthorized`: Missing or invalid authentication
- `403 Forbidden`: User does not have admin role
- `500 Internal Server Error`: Server error occurred

---

## Tenant Endpoints

### Tenant Scraping Metrics

#### GET /api/v1/tenant/scraping-metrics

Fetch tenant-specific scraping metrics.

**Authentication**: Tenant authentication required

**Query Parameters**:

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `timeRange` | string | No | `24h` | Time range for metrics: `24h`, `7d`, `30d` |

**Response**: `200 OK`

```json
{
  "metrics": {
    "overallSuccessRate": 0.88,
    "overallBlockRate": 0.12,
    "totalRequests": 1000,
    "avgResponseTime": 300,
    "sites": [
      {
        "domain": "competitor1.com",
        "successRate": 0.90,
        "blockRate": 0.10,
        "lastSync": "2026-01-26T10:30:00Z",
        "status": "healthy",
        "challenges": {
          "detected": 10,
          "solved": 9
        }
      }
    ]
  }
}
```

**Response Fields**:

- `metrics.overallSuccessRate`: Overall success rate across all sites (0-1)
- `metrics.overallBlockRate`: Overall block rate across all sites (0-1)
- `metrics.totalRequests`: Total requests for this tenant
- `metrics.avgResponseTime`: Average response time in milliseconds
- `metrics.sites[]`: Array of site metrics
- `metrics.sites[].domain`: Site domain
- `metrics.sites[].successRate`: Success rate for this site (0-1)
- `metrics.sites[].blockRate`: Block rate for this site (0-1)
- `metrics.sites[].lastSync`: ISO 8601 timestamp of last sync
- `metrics.sites[].status`: Site health status (`healthy`, `degraded`, `critical`)
- `metrics.sites[].challenges.detected`: Number of challenges detected
- `metrics.sites[].challenges.solved`: Number of challenges solved

**Error Responses**:

- `401 Unauthorized`: Missing or invalid authentication
- `500 Internal Server Error`: Server error occurred

---

### Tenant Site Configuration

#### GET /api/v1/tenant/site-config

Fetch tenant site configurations.

**Authentication**: Tenant authentication required

**Response**: `200 OK`

```json
{
  "sites": [
    {
      "siteId": "site-123",
      "domain": "competitor1.com",
      "sessionWarmup": true,
      "delays": {
        "min": 1000,
        "max": 3000
      },
      "allowedRanges": {
        "minDelay": 500,
        "maxDelay": 5000
      }
    }
  ]
}
```

**Response Fields**:

- `sites[]`: Array of site configurations
- `sites[].siteId`: Unique site identifier
- `sites[].domain`: Site domain
- `sites[].sessionWarmup`: Whether session warmup is enabled
- `sites[].delays.min`: Current minimum delay in milliseconds
- `sites[].delays.max`: Current maximum delay in milliseconds
- `sites[].allowedRanges.minDelay`: Minimum allowed delay based on plan
- `sites[].allowedRanges.maxDelay`: Maximum allowed delay based on plan

**Error Responses**:

- `401 Unauthorized`: Missing or invalid authentication
- `500 Internal Server Error`: Server error occurred

---

#### PATCH /api/v1/tenant/site-config/:siteId

Update site configuration.

**Authentication**: Tenant authentication required

**URL Parameters**:

- `siteId`: Site ID to update

**Request Body**:

```json
{
  "sessionWarmup": true,
  "delays": {
    "min": 1500,
    "max": 2500
  }
}
```

**Validation Rules**:

- `delays.min`: Must be within allowed range for tenant plan
- `delays.max`: Must be within allowed range and > min
- Tenant must own the site

**Response**: `200 OK`

```json
{
  "success": true,
  "config": {
    /* updated configuration */
  }
}
```

**Error Responses**:

- `400 Bad Request`: Validation errors
  ```json
  {
    "error": "Validation failed",
    "message": "Delay values exceed plan limits",
    "details": {
      "delays.min": "Minimum delay must be at least 500ms for your plan"
    }
  }
  ```
- `401 Unauthorized`: Missing or invalid authentication
- `403 Forbidden`: Site does not belong to tenant
- `404 Not Found`: Site not found
- `500 Internal Server Error`: Server error occurred

---

## Error Handling

### Error Response Format

All error responses follow a consistent format:

```json
{
  "error": "Error type",
  "message": "Human-readable error message",
  "details": {
    /* Optional additional error details */
  }
}
```

### HTTP Status Codes

| Code | Meaning | Description |
|------|---------|-------------|
| 200 | OK | Request successful |
| 400 | Bad Request | Invalid request parameters or validation errors |
| 401 | Unauthorized | Missing or invalid authentication |
| 403 | Forbidden | Insufficient permissions |
| 404 | Not Found | Resource not found |
| 429 | Too Many Requests | Rate limit exceeded |
| 500 | Internal Server Error | Server error occurred |

---

## Rate Limiting

### Limits

- **Admin Endpoints**: 100 requests per minute per user
- **Tenant Endpoints**: 60 requests per minute per user

### Rate Limit Headers

Responses include rate limit information in headers:

```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1706270400
```

### Exceeded Rate Limit

When rate limit is exceeded, the API returns:

```http
HTTP/1.1 429 Too Many Requests
```

```json
{
  "error": "Rate limit exceeded",
  "message": "Too many requests. Please try again later.",
  "details": {
    "retryAfter": 60
  }
}
```

---

## Examples

### Fetch Proxy Health (cURL)

```bash
curl -X GET "https://api.pricepilot.com/api/v1/admin/proxy-health?timeRange=7d" \
  -H "Authorization: Bearer YOUR_API_TOKEN"
```

### Update Human Simulation Config (JavaScript)

```javascript
const response = await fetch('/api/v1/admin/human-simulation-config', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    config: {
      typing: {
        minDelay: 60,
        maxDelay: 140
      },
      actionPause: {
        minDelay: 150,
        maxDelay: 1800
      },
      mouseMovement: {
        enabled: true,
        naturalCurves: true
      },
      formInteraction: {
        pauseBetweenFields: 600,
        simulateCorrections: true
      }
    }
  })
});

const data = await response.json();
console.log('Config updated:', data.success);
```

### Fetch Tenant Metrics (Python)

```python
import requests

response = requests.get(
    'https://api.pricepilot.com/api/v1/tenant/scraping-metrics',
    params={'timeRange': '24h'},
    headers={'Authorization': 'Bearer YOUR_API_TOKEN'}
)

data = response.json()
print(f"Success rate: {data['metrics']['overallSuccessRate']:.2%}")
```

### Create Site Profile (Node.js)

```javascript
const axios = require('axios');

async function createSiteProfile() {
  try {
    const response = await axios.post(
      'https://api.pricepilot.com/api/v1/admin/site-profiles',
      {
        profile: {
          domain: 'example.com',
          requestsPerMinute: 10,
          concurrentRequests: 2,
          minDelay: 1000,
          maxDelay: 3000,
          delayMultiplier: 1.5,
          sessionWarmupEnabled: true,
          sessionWarmupPaths: ['/', '/products'],
          referrerChainEnabled: true
        }
      },
      {
        headers: {
          'Authorization': 'Bearer YOUR_API_TOKEN',
          'Content-Type': 'application/json'
        }
      }
    );
    
    console.log('Profile created:', response.data.profile);
  } catch (error) {
    console.error('Error:', error.response.data);
  }
}
```

---

*Last Updated: January 26, 2026*
