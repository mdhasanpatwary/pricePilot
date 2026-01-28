---
inclusion: always
---

# API Design Standards

## API Architecture

### RESTful Principles
- Use standard HTTP methods (GET, POST, PUT, PATCH, DELETE)
- Resource-based URLs
- Stateless requests
- Consistent response formats

### Versioning
- URL-based versioning: `/api/v1/...`
- Maintain backward compatibility
- Deprecation notices in headers
- Migration guides for breaking changes

## Request/Response Format

### Request Structure
```json
{
  "data": {
    // Request payload
  },
  "meta": {
    "requestId": "uuid",
    "timestamp": "ISO8601"
  }
}
```

### Success Response
```json
{
  "success": true,
  "data": {
    // Response data
  },
  "meta": {
    "requestId": "uuid",
    "timestamp": "ISO8601"
  }
}
```

### Error Response
```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable message",
    "details": {
      // Additional error context
    }
  },
  "meta": {
    "requestId": "uuid",
    "timestamp": "ISO8601"
  }
}
```

## Authentication

### API Token Authentication
- Header: `Authorization: Bearer <token>`
- Token validation on every request
- Token expiration and refresh
- Rate limiting per token

### Multi-Tenant Context
- Extract tenantId from authenticated user
- Enforce tenant isolation in all queries
- No cross-tenant data access

## Endpoint Naming Conventions

### Resource Collections
- `GET /api/v1/products` - List products
- `POST /api/v1/products` - Create product
- `GET /api/v1/products/:id` - Get product
- `PUT /api/v1/products/:id` - Update product
- `DELETE /api/v1/products/:id` - Delete product

### Actions on Resources
- `POST /api/v1/products/:id/sync` - Sync product
- `POST /api/v1/products/bulk-update` - Bulk update

### Nested Resources
- `GET /api/v1/competitors/:id/products` - Get competitor products

## Query Parameters

### Pagination
- `page` - Page number (default: 1)
- `limit` - Items per page (default: 20, max: 100)
- `offset` - Alternative to page

### Filtering
- `status=active` - Filter by status
- `brand=Samsung` - Filter by brand
- `minPrice=100&maxPrice=500` - Range filters

### Sorting
- `sort=price` - Sort ascending
- `sort=-price` - Sort descending
- `sort=brand,price` - Multiple sort fields

### Search
- `q=search+term` - Full-text search
- `fields=name,sku` - Search specific fields

## HTTP Status Codes

### Success Codes
- `200 OK` - Successful GET, PUT, PATCH
- `201 Created` - Successful POST
- `204 No Content` - Successful DELETE

### Client Error Codes
- `400 Bad Request` - Invalid input
- `401 Unauthorized` - Missing/invalid auth
- `403 Forbidden` - Insufficient permissions
- `404 Not Found` - Resource not found
- `422 Unprocessable Entity` - Validation errors
- `429 Too Many Requests` - Rate limit exceeded

### Server Error Codes
- `500 Internal Server Error` - Unexpected error
- `503 Service Unavailable` - Temporary outage

## Validation

### Input Validation
- Validate all inputs before processing
- Return detailed validation errors
- Use schema validation (Zod, Joi)
- Sanitize inputs to prevent injection

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

## Rate Limiting

### Limits
- Authenticated: 1000 requests/hour
- Unauthenticated: 100 requests/hour
- Scraping endpoints: 10 requests/minute

### Headers
- `X-RateLimit-Limit` - Total allowed
- `X-RateLimit-Remaining` - Remaining requests
- `X-RateLimit-Reset` - Reset timestamp

## OpenCart Module API

### Product List
```
GET /api/pricepilot/products
Authorization: Bearer <token>

Response:
{
  "success": true,
  "data": {
    "products": [
      {
        "id": "123",
        "sku": "PROD-001",
        "name": "Product Name",
        "price": 99.99,
        "brand": "Brand Name",
        "model": "Model-X"
      }
    ]
  }
}
```

### Product Update
```
POST /api/pricepilot/products/update
Authorization: Bearer <token>
Content-Type: application/json

{
  "updates": [
    {
      "id": "123",
      "price": 89.99
    }
  ]
}

Response:
{
  "success": true,
  "data": {
    "updated": 1,
    "failed": 0,
    "results": [
      {
        "id": "123",
        "status": "success"
      }
    ]
  }
}
```

## Laravel Package API

### Similar structure to OpenCart
- RESTful endpoints
- Token authentication
- Consistent response format
- Validation and error handling

## Documentation

### OpenAPI/Swagger
- Document all endpoints
- Include request/response examples
- Describe authentication
- List error codes

### Integration Guides
- Step-by-step setup
- Code examples
- Troubleshooting tips
- FAQ section
