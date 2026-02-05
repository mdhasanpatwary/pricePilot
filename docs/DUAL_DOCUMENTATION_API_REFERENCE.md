# Dual Documentation System - API Reference

## Overview

The Dual Documentation System provides REST APIs for accessing and managing documentation content across tenant and admin portals. All endpoints follow RESTful principles and return JSON responses.

## Base URL

```
/api/v1/documentation
```

## Authentication

### Tenant Documentation
- **No authentication required** for read operations
- Public access to all tenant documentation

### Admin Documentation
- **Admin authentication required** for all operations
- Use Bearer token authentication
- Header: `Authorization: Bearer <token>`

## Endpoints

### 1. Get Document

Retrieve a single documentation page by type and slug.

**Endpoint:** `GET /api/v1/documentation/:type/:slug`

**Parameters:**
- `type` (path) - Documentation type: `tenant` or `admin`
- `slug` (path) - Document slug (e.g., `getting-started/quick-start`)

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "type": "tenant",
    "slug": "getting-started/quick-start",
    "title": "Quick Start Guide",
    "content": "# Quick Start...",
    "htmlContent": "<h1>Quick Start</h1>...",
    "category": "getting-started",
    "metadata": {
      "description": "Get started quickly",
      "tags": ["beginner", "setup"],
      "author": "PricePilot Team"
    },
    "createdAt": "2024-01-15T10:00:00Z",
    "updatedAt": "2024-02-01T15:30:00Z"
  }
}
```


**Status Codes:**
- `200 OK` - Success
- `404 Not Found` - Document not found
- `403 Forbidden` - Admin auth required (admin docs only)

---

### 2. List Documents

Retrieve a list of documentation pages with optional filtering.

**Endpoint:** `GET /api/v1/documentation/:type`

**Parameters:**
- `type` (path) - Documentation type: `tenant` or `admin`
- `category` (query, optional) - Filter by category
- `tags` (query, optional) - Filter by tags (comma-separated)
- `page` (query, optional) - Page number (default: 1)
- `limit` (query, optional) - Items per page (default: 20, max: 100)

**Example:** `GET /api/v1/documentation/tenant?category=getting-started&limit=10`

**Response:**
```json
{
  "success": true,
  "data": {
    "documents": [
      {
        "id": "uuid",
        "type": "tenant",
        "slug": "getting-started/quick-start",
        "title": "Quick Start Guide",
        "category": "getting-started",
        "metadata": {
          "description": "Get started quickly",
          "tags": ["beginner", "setup"]
        },
        "updatedAt": "2024-02-01T15:30:00Z"
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

**Status Codes:**
- `200 OK` - Success
- `403 Forbidden` - Admin auth required (admin docs only)

---

### 3. Search Documentation

Search documentation content with full-text search.

**Endpoint:** `GET /api/v1/documentation/search`

**Parameters:**
- `q` (query, required) - Search query
- `type` (query, required) - Documentation type: `tenant` or `admin`
- `category` (query, optional) - Filter by category
- `tags` (query, optional) - Filter by tags (comma-separated)
- `page` (query, optional) - Page number (default: 1)
- `limit` (query, optional) - Items per page (default: 20, max: 50)

**Example:** `GET /api/v1/documentation/search?q=price+update&type=tenant`

**Response:**
```json
{
  "success": true,
  "data": {
    "query": "price update",
    "results": [
      {
        "documentId": "uuid",
        "title": "Price Update Guide",
        "slug": "pricing/price-updates",
        "excerpt": "...learn how to update prices...",
        "breadcrumbs": [
          { "title": "Pricing", "slug": "pricing" },
          { "title": "Price Updates", "slug": "pricing/price-updates" }
        ],
        "relevanceScore": 0.95,
        "matchedTerms": ["price", "update"]
      }
    ],
    "total": 12,
    "suggestions": ["price strategy", "bulk updates"]
  }
}
```

**Status Codes:**
- `200 OK` - Success
- `400 Bad Request` - Missing or invalid query
- `403 Forbidden` - Admin auth required (admin docs only)

---


### 4. Track Page View

Record a page view event for analytics.

**Endpoint:** `POST /api/v1/documentation/analytics/view`

**Authentication:** Optional (user ID tracked if authenticated)

**Request Body:**
```json
{
  "documentId": "uuid",
  "type": "tenant",
  "sessionId": "session-uuid",
  "timeOnPage": 45
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "tracked": true
  }
}
```

**Status Codes:**
- `200 OK` - Success
- `400 Bad Request` - Invalid request body

---

### 5. Track Search

Record a search query for analytics.

**Endpoint:** `POST /api/v1/documentation/analytics/search`

**Request Body:**
```json
{
  "query": "price update",
  "type": "tenant",
  "resultsCount": 12,
  "clickedResultId": "uuid"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "tracked": true
  }
}
```

**Status Codes:**
- `200 OK` - Success
- `400 Bad Request` - Invalid request body

---

### 6. Submit Feedback

Submit user feedback for a documentation page.

**Endpoint:** `POST /api/v1/documentation/analytics/feedback`

**Authentication:** Optional (user ID tracked if authenticated)

**Request Body:**
```json
{
  "documentId": "uuid",
  "rating": 5,
  "comment": "Very helpful guide!"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "feedbackId": "uuid"
  }
}
```

**Status Codes:**
- `200 OK` - Success
- `400 Bad Request` - Invalid rating (must be 1-5)
- `429 Too Many Requests` - Rate limit exceeded (10/hour per user)

---

### 7. Get Analytics Metrics

Retrieve analytics metrics for documentation usage (admin only).

**Endpoint:** `GET /api/v1/documentation/analytics/metrics`

**Authentication:** Admin required

**Parameters:**
- `type` (query, optional) - Filter by type: `tenant` or `admin`
- `startDate` (query, optional) - Start date (ISO 8601)
- `endDate` (query, optional) - End date (ISO 8601)
- `metric` (query, optional) - Metric type: `popular`, `search`, `bounce`, `feedback`

**Example:** `GET /api/v1/documentation/analytics/metrics?type=tenant&metric=popular`

**Response:**
```json
{
  "success": true,
  "data": {
    "popularPages": [
      {
        "documentId": "uuid",
        "title": "Quick Start Guide",
        "slug": "getting-started/quick-start",
        "views": 1250,
        "uniqueVisitors": 890,
        "avgTimeOnPage": 180
      }
    ]
  }
}
```

**Status Codes:**
- `200 OK` - Success
- `403 Forbidden` - Admin auth required

---


### 8. Get Documentation Suggestions

Retrieve documentation update suggestions (admin only).

**Endpoint:** `GET /api/v1/documentation/suggestions`

**Authentication:** Admin required

**Parameters:**
- `status` (query, optional) - Filter by status: `pending`, `approved`, `rejected`
- `targetType` (query, optional) - Filter by type: `tenant`, `admin`
- `page` (query, optional) - Page number (default: 1)
- `limit` (query, optional) - Items per page (default: 20)

**Response:**
```json
{
  "success": true,
  "data": {
    "suggestions": [
      {
        "id": "uuid",
        "documentId": "uuid",
        "suggestedTitle": "New Feature Guide",
        "suggestedContent": "# New Feature...",
        "targetType": "tenant",
        "category": "features",
        "status": "pending",
        "taskId": "task-123",
        "createdAt": "2024-02-05T10:00:00Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 5
    }
  }
}
```

---

### 9. Approve Documentation Suggestion

Approve a documentation suggestion and apply changes (admin only).

**Endpoint:** `POST /api/v1/documentation/suggestions/:id/approve`

**Authentication:** Admin required

**Response:**
```json
{
  "success": true,
  "data": {
    "suggestionId": "uuid",
    "documentId": "uuid",
    "status": "approved"
  }
}
```

---

### 10. Reject Documentation Suggestion

Reject a documentation suggestion (admin only).

**Endpoint:** `POST /api/v1/documentation/suggestions/:id/reject`

**Authentication:** Admin required

**Request Body:**
```json
{
  "reason": "Not relevant to current documentation"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "suggestionId": "uuid",
    "status": "rejected"
  }
}
```

---

## Rate Limits

### Tenant Documentation
- Read operations: 100 requests/minute per IP
- Search: 100 requests/minute per IP
- Feedback: 10 submissions/hour per user

### Admin Documentation
- All operations: 1000 requests/hour per token

### Rate Limit Headers
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1707134400
```

---

## Error Responses

All errors follow a consistent format:

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message",
    "details": {
      "field": "Additional context"
    }
  },
  "meta": {
    "requestId": "uuid",
    "timestamp": "2024-02-05T10:00:00Z"
  }
}
```

### Common Error Codes

- `VALIDATION_ERROR` - Invalid request parameters
- `NOT_FOUND` - Resource not found
- `UNAUTHORIZED` - Authentication required
- `FORBIDDEN` - Insufficient permissions
- `RATE_LIMIT_EXCEEDED` - Too many requests
- `INTERNAL_ERROR` - Server error

---

## Content Formats

### Markdown Format
Request with `Accept: text/markdown` header to receive raw Markdown content.

### HTML Format
Request with `Accept: text/html` header to receive rendered HTML content.

### JSON Format (Default)
Default response includes both Markdown and HTML in JSON structure.

---

## Pagination

All list endpoints support pagination:

**Request:**
```
GET /api/v1/documentation/tenant?page=2&limit=20
```

**Response includes pagination metadata:**
```json
{
  "pagination": {
    "page": 2,
    "limit": 20,
    "total": 45,
    "totalPages": 3,
    "hasNext": true,
    "hasPrev": true
  }
}
```

---

## Filtering

### By Category
```
GET /api/v1/documentation/tenant?category=getting-started
```

### By Tags
```
GET /api/v1/documentation/tenant?tags=beginner,setup
```

### Combined Filters
```
GET /api/v1/documentation/tenant?category=pricing&tags=advanced
```

---

## Best Practices

1. **Cache responses** - Documentation content changes infrequently
2. **Use pagination** - Don't request all documents at once
3. **Handle rate limits** - Implement exponential backoff
4. **Track analytics** - Help improve documentation quality
5. **Provide feedback** - User feedback improves content
6. **Check status codes** - Handle errors appropriately
7. **Use search wisely** - Implement debouncing for search inputs

---

## Support

For API support or questions:
- Documentation: `/docs/api-documentation`
- Admin Guide: `/admin-docs/api-integration`
- Contact: support@pricepilot.com
