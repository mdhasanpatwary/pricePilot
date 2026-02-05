---
title: "Admin API Reference"
description: "API reference for administrative operations"
category: "system-monitoring"
tags: ["api", "reference", "admin"]
audience: "admin"
relatedDocs: ["/docs/integrations/admin-api-reference.md"]
---

# Admin API Reference

## Overview

This document provides comprehensive API documentation for the enhanced admin dashboard endpoints. All endpoints require admin authentication and return JSON responses.

## Base URL

```
https://your-domain.com/api/v1/admin
```

## Authentication

All admin API endpoints require authentication using session cookies or API keys with admin privileges.

### Headers

```http
Cookie: next-auth.session-token=<session-token>
```

Or:

```http
Authorization: Bearer <api-key>
```

## Table of Contents

1. [Session Monitoring APIs](#session-monitoring-apis)
2. [Proxy Simulator APIs](#proxy-simulator-apis)
3. [Metrics and Analytics APIs](#metrics-and-analytics-apis)
4. [Session Control APIs](#session-control-apis)
5. [System Health APIs](#system-health-apis)
6. [Export APIs](#export-apis)
7. [Tenant Debug APIs](#tenant-debug-apis)

---

## Session Monitoring APIs

### Get Active Sessions

Retrieve all currently active scraping sessions.

**Endpoint**: `GET /sessions`

**Query Parameters**:
- `tenantId` (optional): Filter by tenant ID
- `status` (optional): Filter by status (running, waiting_challenge, completed, failed)
- `limit` (optional): Number of results (default: 50, max: 200)
- `offset` (optional): Pagination offset (default: 0)

**Example Request**:
```bash
curl -X GET "https://your-domain.com/api/v1/admin/sessions?tenantId=tenant_123&status=running" \
  -H "Cookie: next-auth.session-token=<token>"
```

**Example Response**:
```json
{
  "success": true,
  "data": {
    "sessions": [
      {
        "id": "session_abc123",
        "tenantId": "tenant_123",
        "tenantName": "Acme Corp",
        "siteUrl": "https://example.com",
        "targetUrl": "https://example.com/product/123",
        "status": "running",
        "currentStage": "data_extraction",
        "proxyUsed": "http://proxy1.example.com:8080",
        "userAgent": "Mozilla/5.0...",
        "requestsCompleted": 3,
        "requestsTotal": 5,
        "challengeType": null,
        "challengeStatus": null,
        "startTime": "2026-01-27T10:30:00Z",
        "metrics": {
          "navigationTime": 1200,
          "challengeSolveTime": 0,
          "extractionTime": 0,
          "totalTime": 1200
        }
      }
    ],
    "total": 1,
    "limit": 50,
    "offset": 0
  }
}
```


### Get Session by ID

Retrieve detailed information about a specific session.

**Endpoint**: `GET /sessions/:id`

**Path Parameters**:
- `id`: Session ID

**Example Request**:
```bash
curl -X GET "https://your-domain.com/api/v1/admin/sessions/session_abc123" \
  -H "Cookie: next-auth.session-token=<token>"
```

**Example Response**:
```json
{
  "success": true,
  "data": {
    "id": "session_abc123",
    "tenantId": "tenant_123",
    "tenantName": "Acme Corp",
    "siteUrl": "https://example.com",
    "targetUrl": "https://example.com/product/123",
    "status": "completed",
    "currentStage": "validation",
    "proxyUsed": "http://proxy1.example.com:8080",
    "userAgent": "Mozilla/5.0...",
    "requestsCompleted": 5,
    "requestsTotal": 5,
    "challengeType": "cloudflare",
    "challengeStatus": "solved",
    "extractedData": {
      "title": "Product Name",
      "price": 99.99,
      "currency": "USD"
    },
    "errors": [],
    "metrics": {
      "navigationTime": 1200,
      "challengeSolveTime": 3500,
      "extractionTime": 800,
      "totalTime": 5500
    },
    "startTime": "2026-01-27T10:30:00Z",
    "endTime": "2026-01-27T10:30:05Z"
  }
}
```


### Get Session History

Retrieve historical session data with filtering.

**Endpoint**: `GET /sessions/history`

**Query Parameters**:
- `tenantId` (optional): Filter by tenant
- `status` (optional): Filter by status
- `startDate` (optional): Start date (ISO 8601)
- `endDate` (optional): End date (ISO 8601)
- `limit` (optional): Results per page (default: 50)
- `offset` (optional): Pagination offset

**Example Request**:
```bash
curl -X GET "https://your-domain.com/api/v1/admin/sessions/history?startDate=2026-01-20T00:00:00Z&limit=10" \
  -H "Cookie: next-auth.session-token=<token>"
```

**Example Response**:
```json
{
  "success": true,
  "data": {
    "sessions": [...],
    "total": 150,
    "limit": 10,
    "offset": 0
  }
}
```

---

## Proxy Simulator APIs

### Run Simulation

Execute a proxy simulation with specified configuration.

**Endpoint**: `POST /simulator/run`

**Request Body**:
```json
{
  "scenario": "rotation",
  "targetSite": "https://example.com",
  "proxyPool": [
    { "url": "http://proxy1.example.com:8080", "type": "residential" },
    { "url": "http://proxy2.example.com:8080", "type": "datacenter" }
  ],
  "requestCount": 50,
  "delayBetweenRequests": 1000
}
```


**Example Request**:
```bash
curl -X POST "https://your-domain.com/api/v1/admin/simulator/run" \
  -H "Content-Type: application/json" \
  -H "Cookie: next-auth.session-token=<token>" \
  -d '{
    "scenario": "rotation",
    "targetSite": "https://example.com",
    "proxyPool": [
      {"url": "http://proxy1.example.com:8080", "type": "residential"}
    ],
    "requestCount": 50
  }'
```

**Example Response**:
```json
{
  "success": true,
  "data": {
    "id": "sim_xyz789",
    "status": "running",
    "message": "Simulation started successfully"
  }
}
```

### Get Simulation Results

Retrieve results of a completed simulation.

**Endpoint**: `GET /simulator/results/:id`

**Path Parameters**:
- `id`: Simulation ID

**Example Response**:
```json
{
  "success": true,
  "data": {
    "id": "sim_xyz789",
    "scenario": "rotation",
    "config": {...},
    "startTime": "2026-01-27T10:00:00Z",
    "endTime": "2026-01-27T10:05:00Z",
    "requests": [...],
    "summary": {
      "totalRequests": 50,
      "successfulRequests": 48,
      "failedRequests": 2,
      "averageResponseTime": 1250,
      "proxiesUsed": 2,
      "rotationPattern": ["proxy1", "proxy2", "proxy1", "proxy2"]
    },
    "recommendations": [
      "Proxy rotation is working correctly",
      "Consider adding more proxies for better distribution"
    ]
  }
}
```


---

## Metrics and Analytics APIs

### Get Dashboard Metrics

Retrieve real-time dashboard metrics.

**Endpoint**: `GET /metrics/dashboard`

**Example Request**:
```bash
curl -X GET "https://your-domain.com/api/v1/admin/metrics/dashboard" \
  -H "Cookie: next-auth.session-token=<token>"
```

**Example Response**:
```json
{
  "success": true,
  "data": {
    "platform": {
      "activeSessions": 12,
      "requestsPerMinute": 45,
      "avgSessionDuration": 5500,
      "totalTenants": 50,
      "activeTenants": 15
    },
    "scraping": {
      "successRate": 0.92,
      "blockRate": 0.05,
      "challengeRate": 0.15,
      "avgResponseTime": 2100,
      "requestsLast24h": 12500
    },
    "proxies": {
      "totalProxies": 20,
      "healthyProxies": 18,
      "avgSuccessRate": 0.89,
      "avgResponseTime": 1800
    },
    "challenges": {
      "totalChallenges": 1250,
      "solveRate": 0.85,
      "avgSolveTime": 3200
    }
  }
}
```


### Get Tenant Metrics

Retrieve metrics for a specific tenant.

**Endpoint**: `GET /metrics/tenant/:id`

**Path Parameters**:
- `id`: Tenant ID

**Query Parameters**:
- `timeRange` (optional): Time range (1h, 24h, 7d, 30d)

**Example Response**:
```json
{
  "success": true,
  "data": {
    "tenantId": "tenant_123",
    "tenantName": "Acme Corp",
    "activeSessions": 3,
    "totalRequests": 1250,
    "successRate": 0.94,
    "avgResponseTime": 1900,
    "resourceUsage": {
      "apiRequests": 1250,
      "apiLimit": 10000,
      "concurrentSessions": 3,
      "sessionLimit": 10
    }
  }
}
```

### Get Analytics Data

Retrieve analytics data for charts and visualizations.

**Endpoint**: `GET /analytics/:type`

**Path Parameters**:
- `type`: Analytics type (sites, proxies, challenges)

**Query Parameters**:
- `timeRange`: Time range (1h, 24h, 7d, 30d)
- `tenantId` (optional): Filter by tenant

**Example Request**:
```bash
curl -X GET "https://your-domain.com/api/v1/admin/analytics/sites?timeRange=7d" \
  -H "Cookie: next-auth.session-token=<token>"
```


---

## Session Control APIs

### Pause Session

Pause an active scraping session.

**Endpoint**: `POST /sessions/:id/pause`

**Path Parameters**:
- `id`: Session ID

**Example Request**:
```bash
curl -X POST "https://your-domain.com/api/v1/admin/sessions/session_abc123/pause" \
  -H "Cookie: next-auth.session-token=<token>"
```

**Example Response**:
```json
{
  "success": true,
  "data": {
    "sessionId": "session_abc123",
    "status": "paused",
    "message": "Session paused successfully"
  }
}
```

### Resume Session

Resume a paused session.

**Endpoint**: `POST /sessions/:id/resume`

**Example Response**:
```json
{
  "success": true,
  "data": {
    "sessionId": "session_abc123",
    "status": "running",
    "message": "Session resumed successfully"
  }
}
```

### Cancel Session

Cancel an active or paused session.

**Endpoint**: `POST /sessions/:id/cancel`

**Request Body** (optional):
```json
{
  "reason": "Manual cancellation by admin"
}
```


### Retry Session

Manually retry a failed session with optional configuration override.

**Endpoint**: `POST /sessions/:id/retry`

**Request Body** (optional):
```json
{
  "overrideProxy": "http://proxy3.example.com:8080",
  "overrideDelay": 2000,
  "overrideRateLimit": 5
}
```

**Example Response**:
```json
{
  "success": true,
  "data": {
    "newSessionId": "session_def456",
    "status": "running",
    "message": "Session retry initiated"
  }
}
```

### Bulk Operations

Perform operations on multiple sessions.

**Endpoint**: `POST /sessions/bulk`

**Request Body**:
```json
{
  "sessionIds": ["session_abc123", "session_def456"],
  "operation": "pause"
}
```

**Operations**: `pause`, `resume`, `cancel`

**Example Response**:
```json
{
  "success": true,
  "data": {
    "successful": ["session_abc123", "session_def456"],
    "failed": [],
    "message": "Bulk operation completed"
  }
}
```

---

## System Health APIs

### Get System Health

Retrieve overall system health status.

**Endpoint**: `GET /health`


**Example Response**:
```json
{
  "success": true,
  "data": {
    "overall": "healthy",
    "components": {
      "database": {
        "status": "healthy",
        "responseTime": 15,
        "details": "PostgreSQL connection pool: 5/20 connections"
      },
      "redis": {
        "status": "healthy",
        "responseTime": 2,
        "details": "Memory usage: 45%"
      },
      "proxyPool": {
        "status": "degraded",
        "details": "18/20 proxies healthy"
      },
      "externalIntegrations": {
        "status": "healthy",
        "details": "All integrations responding"
      }
    },
    "alerts": [
      {
        "severity": "warning",
        "component": "proxyPool",
        "message": "2 proxies are unhealthy",
        "timestamp": "2026-01-27T10:30:00Z"
      }
    ]
  }
}
```

### Run Diagnostics

Execute system diagnostics.

**Endpoint**: `POST /diagnostics`

**Example Response**:
```json
{
  "success": true,
  "data": {
    "diagnosticId": "diag_123",
    "status": "completed",
    "results": {
      "databaseConnectivity": "passed",
      "redisConnectivity": "passed",
      "proxyConnectivity": "passed",
      "externalAPIs": "passed"
    }
  }
}
```


---

## Export APIs

### Export Session Data

Export session data in various formats.

**Endpoint**: `POST /export/sessions`

**Request Body**:
```json
{
  "format": "json",
  "filters": {
    "tenantId": "tenant_123",
    "startDate": "2026-01-20T00:00:00Z",
    "endDate": "2026-01-27T23:59:59Z",
    "status": "completed"
  }
}
```

**Formats**: `json`, `csv`, `pdf`

**Example Response**:
```json
{
  "success": true,
  "data": {
    "downloadUrl": "/downloads/sessions_export_20260127.json",
    "expiresAt": "2026-01-27T11:00:00Z",
    "recordCount": 150
  }
}
```

### Export Metrics

Export metrics data.

**Endpoint**: `POST /export/metrics`

**Request Body**:
```json
{
  "format": "csv",
  "timeRange": "7d",
  "metrics": ["successRate", "blockRate", "responseTime"]
}
```

### Export Error Logs

Export error logs with context.

**Endpoint**: `POST /export/errors`

**Request Body**:
```json
{
  "format": "json",
  "filters": {
    "severity": "error",
    "startDate": "2026-01-20T00:00:00Z"
  }
}
```


---

## Tenant Debug APIs

### Get Tenant Debug Info

Retrieve comprehensive debug information for a tenant.

**Endpoint**: `GET /debug/tenant/:id`

**Path Parameters**:
- `id`: Tenant ID

**Example Response**:
```json
{
  "success": true,
  "data": {
    "tenant": {
      "id": "tenant_123",
      "name": "Acme Corp",
      "status": "active"
    },
    "activeSessions": [...],
    "recentErrors": [
      {
        "timestamp": "2026-01-27T10:25:00Z",
        "type": "proxy_failure",
        "message": "Connection timeout",
        "count": 3,
        "affectedSites": ["example.com"]
      }
    ],
    "resourceUsage": {
      "apiRequests": 1250,
      "apiLimit": 10000,
      "concurrentSessions": 3,
      "sessionLimit": 10
    },
    "configuration": {
      "siteProfiles": [...],
      "proxySettings": {...},
      "rateLimits": {...}
    },
    "staleData": {
      "productCount": 15,
      "oldestDataAge": "48h",
      "affectedProducts": [...]
    }
  }
}
```

---

## Error Responses

All endpoints return consistent error responses:

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message",
    "details": {}
  }
}
```

### Common Error Codes

- `UNAUTHORIZED`: Authentication required
- `FORBIDDEN`: Insufficient permissions
- `NOT_FOUND`: Resource not found
- `VALIDATION_ERROR`: Invalid request parameters
- `RATE_LIMIT_EXCEEDED`: Too many requests
- `INTERNAL_ERROR`: Server error


---

## Rate Limiting

Admin API endpoints are rate-limited to prevent abuse:

- **Default Limit**: 1000 requests per hour per admin user
- **Burst Limit**: 100 requests per minute
- **Headers**: Rate limit information in response headers

```http
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 950
X-RateLimit-Reset: 1706356800
```

---

## Pagination

List endpoints support pagination:

**Query Parameters**:
- `limit`: Results per page (default: 50, max: 200)
- `offset`: Number of results to skip

**Response Format**:
```json
{
  "data": [...],
  "total": 500,
  "limit": 50,
  "offset": 0,
  "hasMore": true
}
```

---

## Filtering

Most list endpoints support filtering:

**Common Filters**:
- `tenantId`: Filter by tenant
- `status`: Filter by status
- `startDate`: Start date (ISO 8601)
- `endDate`: End date (ISO 8601)
- `search`: Text search

**Example**:
```
GET /sessions?tenantId=tenant_123&status=running&startDate=2026-01-20T00:00:00Z
```

---

## Webhooks

Configure webhooks to receive real-time notifications:

**Events**:
- `session.started`
- `session.completed`
- `session.failed`
- `system.alert`
- `proxy.unhealthy`

**Webhook Payload**:
```json
{
  "event": "session.failed",
  "timestamp": "2026-01-27T10:30:00Z",
  "data": {
    "sessionId": "session_abc123",
    "tenantId": "tenant_123",
    "error": "Connection timeout"
  }
}
```

---

*Last Updated: January 27, 2026*
*API Version: 2.0.0*
