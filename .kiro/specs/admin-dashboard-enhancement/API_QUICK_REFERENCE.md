# Metrics and Analytics API - Quick Reference

## Base URL
All endpoints are prefixed with `/api/v1/admin`

## Authentication
All endpoints require admin authentication via NextAuth session.

## Endpoints

### 1. Dashboard Metrics
```
GET /metrics/dashboard
```
Returns aggregated platform, scraping, proxy, and challenge metrics.

**Example:**
```bash
curl -X GET http://localhost:3000/api/v1/admin/metrics/dashboard \
  -H "Cookie: next-auth.session-token=..."
```

---

### 2. Tenant Metrics
```
GET /metrics/tenant/{tenantId}
```
Returns metrics for a specific tenant.

**Example:**
```bash
curl -X GET http://localhost:3000/api/v1/admin/metrics/tenant/tenant-123 \
  -H "Cookie: next-auth.session-token=..."
```

---

### 3. Site Analytics
```
GET /analytics/sites?timeRange={1h|24h|7d}&limit={number}&siteUrl={url}
```
Returns site analytics with optional filtering.

**Query Parameters:**
- `timeRange` (optional): `1h`, `24h`, or `7d` (default: `24h`)
- `limit` (optional): Number of top failures (default: `10`)
- `siteUrl` (optional): Filter by specific site

**Example:**
```bash
curl -X GET "http://localhost:3000/api/v1/admin/analytics/sites?timeRange=24h&limit=5" \
  -H "Cookie: next-auth.session-token=..."
```

---

### 4. Proxy Analytics
```
GET /analytics/proxies?timeRange={1h|24h|7d}&limit={number}&proxyUrl={url}
```
Returns proxy health and performance analytics.

**Query Parameters:**
- `timeRange` (optional): `1h`, `24h`, or `7d` (default: `24h`)
- `limit` (optional): Number of top failures (default: `10`)
- `proxyUrl` (optional): Filter by specific proxy

**Example:**
```bash
curl -X GET "http://localhost:3000/api/v1/admin/analytics/proxies?timeRange=7d" \
  -H "Cookie: next-auth.session-token=..."
```

---

### 5. Challenge Analytics
```
GET /analytics/challenges?timeRange={1h|24h|7d}&challengeType={type}&siteUrl={url}
```
Returns challenge detection and solve rate analytics.

**Query Parameters:**
- `timeRange` (optional): `1h`, `24h`, or `7d` (default: `24h`)
- `challengeType` (optional): Filter by challenge type (e.g., `cloudflare`, `recaptcha`)
- `siteUrl` (optional): Filter by specific site

**Example:**
```bash
curl -X GET "http://localhost:3000/api/v1/admin/analytics/challenges?challengeType=cloudflare" \
  -H "Cookie: next-auth.session-token=..."
```

---

## Response Format

### Success Response
```json
{
  "success": true,
  "data": { ... }
}
```

### Error Response
```json
{
  "success": false,
  "error": "Error message",
  "details": "Detailed error information"
}
```

## HTTP Status Codes

- `200 OK`: Successful request
- `400 Bad Request`: Invalid parameters
- `401 Unauthorized`: Missing or invalid authentication
- `404 Not Found`: Resource not found
- `500 Internal Server Error`: Server error

## Rate Limiting

These endpoints use the MetricsAggregator caching layer:
- Dashboard metrics: 30s cache
- Tenant metrics: 1min cache
- Analytics data: 1-2min cache

## Frontend Integration

These endpoints are designed to be consumed by:
- MetricsDashboard component (Task 16)
- SystemHealthMonitor component (Task 17)
- Analytics pages (Tasks 12-15)

## Testing

Run tests with:
```bash
npm test -- __tests__/app/api/admin/metrics-analytics.test.ts
```

All 11 tests should pass.
