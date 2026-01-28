# Design Document: Rate Limiting Completion

## Overview

This design completes the rate limiting security implementation for PricePilot by ensuring comprehensive API coverage, implementing tenant-based limits, adding monitoring and alerting, creating admin management tools, and providing thorough testing. The system already has Upstash Redis-based rate limiting infrastructure with multiple limiter configurations (auth, api, read, write, sync, importExport) and middleware wrappers.

The design extends the existing infrastructure to:
1. Ensure 100% API route coverage with appropriate rate limiters
2. Implement per-tenant rate limits based on subscription plans (BASIC, PREMIUM, PRO)
3. Add comprehensive monitoring, metrics tracking, and alerting
4. Create admin tools for viewing and managing rate limits
5. Provide a dashboard for visualizing rate limit status and violations
6. Add comprehensive test coverage for all rate limiting behavior

## Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      API Routes Layer                        │
│  (Next.js API Routes with withRateLimit middleware)         │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│              Rate Limiting Middleware                        │
│  - Extract tenant/user context                              │
│  - Determine rate limiter type                              │
│  - Check for admin bypasses                                 │
│  - Apply plan-based multipliers                             │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│              Rate Limit Service                              │
│  - Check limits in Upstash Redis                            │
│  - Track metrics in PostgreSQL                              │
│  - Generate alerts on violations                            │
└────────────────────┬────────────────────────────────────────┘
                     │
         ┌───────────┴───────────┐
         ▼                       ▼
┌──────────────────┐    ┌──────────────────┐
│  Upstash Redis   │    │   PostgreSQL     │
│  (Rate Limits)   │    │   (Metrics)      │
└──────────────────┘    └──────────────────┘
```

### Component Interaction Flow

1. **Request arrives** at API route
2. **Middleware** extracts user/tenant context
3. **Rate Limit Service** checks:
   - Admin bypass status
   - Tenant plan multiplier
   - Current usage in Redis
4. **If limit exceeded**: Return 429 with headers
5. **If allowed**: Execute handler and track metrics
6. **Metrics Service** records usage in PostgreSQL
7. **Alert Service** checks thresholds and creates alerts

## Components and Interfaces

### 1. Enhanced Rate Limiting Middleware

**File**: `lib/middleware/ratelimit.ts` (enhanced)

**Responsibilities**:
- Extract tenant and plan information from session
- Check for admin bypasses
- Apply plan-based multipliers to base limits
- Track metrics for monitoring
- Generate alerts on threshold violations

**Key Functions**:

```typescript
/**
 * Enhanced rate limit middleware with tenant-based limits
 */
async function withRateLimit(
  req: NextRequest,
  limiterType: keyof typeof rateLimiters,
  handler: (req: NextRequest) => Promise<NextResponse>
): Promise<NextResponse>

/**
 * Get rate limit multiplier based on tenant plan
 */
function getPlanMultiplier(planType: PlanType): number

/**
 * Check if tenant has an active bypass
 */
async function checkBypass(tenantId: string): Promise<boolean>

/**
 * Get custom multiplier for tenant if set
 */
async function getCustomMultiplier(tenantId: string): Promise<number | null>
```

### 2. Rate Limit Configuration Service

**File**: `lib/services/rate-limit-config.ts` (new)

**Responsibilities**:
- Manage plan-based rate limit multipliers
- Handle admin bypasses and custom multipliers
- Provide configuration for different endpoint types

**Configuration Structure**:

```typescript
interface RateLimitConfig {
  planMultipliers: {
    BASIC: number;    // 1.0 (base)
    PREMIUM: number;  // 2.0 (2x limits)
    PRO: number;      // 5.0 (5x limits)
  };
  
  endpointLimits: {
    auth: { requests: number; window: string };
    api: { requests: number; window: string };
    read: { requests: number; window: string };
    write: { requests: number; window: string };
    sync: { requests: number; window: string };
    importExport: { requests: number; window: string };
  };
  
  alertThresholds: {
    violationsPerHour: number;  // 10
    violationsPerDay: number;   // 100
  };
}
```

### 3. Rate Limit Metrics Service

**File**: `lib/services/rate-limit-metrics.ts` (new)

**Responsibilities**:
- Track rate limit hits and violations
- Store metrics in PostgreSQL
- Aggregate metrics for dashboard
- Generate alerts on threshold violations

**Key Functions**:

```typescript
/**
 * Record a rate limit hit (successful request)
 */
async function recordHit(
  tenantId: string,
  limiterType: string,
  identifier: string
): Promise<void>

/**
 * Record a rate limit violation (429 response)
 */
async function recordViolation(
  tenantId: string,
  limiterType: string,
  identifier: string,
  endpoint: string
): Promise<void>

/**
 * Get metrics for a tenant
 */
async function getTenantMetrics(
  tenantId: string,
  startDate: Date,
  endDate: Date
): Promise<TenantMetrics>

/**
 * Check if violations exceed threshold and create alert
 */
async function checkThresholds(tenantId: string): Promise<void>
```

### 4. Admin Rate Limit Management Service

**File**: `lib/services/rate-limit-admin.ts` (new)

**Responsibilities**:
- Manage admin bypasses
- Set custom multipliers for tenants
- Retrieve rate limit status for all tenants
- Audit all admin actions

**Key Functions**:

```typescript
/**
 * Set a temporary bypass for a tenant
 */
async function setBypass(
  tenantId: string,
  adminUserId: string,
  durationMinutes: number,
  reason: string
): Promise<void>

/**
 * Set a custom multiplier for a tenant
 */
async function setCustomMultiplier(
  tenantId: string,
  adminUserId: string,
  multiplier: number,
  reason: string
): Promise<void>

/**
 * Get rate limit status for all tenants
 */
async function getAllTenantsStatus(): Promise<TenantRateLimitStatus[]>

/**
 * Get detailed status for a specific tenant
 */
async function getTenantStatus(tenantId: string): Promise<DetailedTenantStatus>
```

### 5. API Route Coverage Audit

**File**: `scripts/audit-rate-limits.ts` (new)

**Responsibilities**:
- Scan all API routes
- Identify routes without rate limiting
- Generate coverage report
- Suggest appropriate rate limiters

**Output**: Markdown report listing all routes and their rate limiter status

## Data Models

### Database Schema Extensions

#### RateLimitMetric Table

```prisma
model RateLimitMetric {
  id            String   @id @default(uuid())
  tenantId      String
  limiterType   String   // 'auth', 'api', 'read', 'write', 'sync', 'importExport'
  identifier    String   // 'user:xxx' or 'ip:xxx'
  endpoint      String   // API route path
  hitCount      Int      @default(0)
  violationCount Int     @default(0)
  timestamp     DateTime @default(now())
  
  tenant        Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  
  @@index([tenantId, timestamp])
  @@index([limiterType, timestamp])
  @@index([tenantId, limiterType, timestamp])
}
```

#### RateLimitBypass Table

```prisma
model RateLimitBypass {
  id          String    @id @default(uuid())
  tenantId    String
  setBy       String    // Admin user ID
  reason      String
  expiresAt   DateTime
  isActive    Boolean   @default(true)
  createdAt   DateTime  @default(now())
  
  tenant      Tenant    @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  
  @@index([tenantId, isActive, expiresAt])
}
```

#### RateLimitCustomMultiplier Table

```prisma
model RateLimitCustomMultiplier {
  id          String   @id @default(uuid())
  tenantId    String   @unique
  multiplier  Float
  setBy       String   // Admin user ID
  reason      String
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  
  tenant      Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  
  @@index([tenantId])
}
```

### TypeScript Interfaces

```typescript
interface TenantMetrics {
  tenantId: string;
  planType: PlanType;
  effectiveMultiplier: number;
  bypassActive: boolean;
  periodStart: Date;
  periodEnd: Date;
  byLimiterType: {
    [key: string]: {
      hitCount: number;
      violationCount: number;
      violationRate: number;
    };
  };
  totalHits: number;
  totalViolations: number;
  topEndpoints: Array<{
    endpoint: string;
    hitCount: number;
    violationCount: number;
  }>;
}

interface TenantRateLimitStatus {
  tenantId: string;
  companyName: string;
  planType: PlanType;
  effectiveMultiplier: number;
  bypassActive: boolean;
  bypassExpiresAt?: Date;
  recentViolations: number;
  currentUsage: {
    [limiterType: string]: {
      limit: number;
      remaining: number;
      resetAt: Date;
    };
  };
}

interface DetailedTenantStatus extends TenantRateLimitStatus {
  metrics: TenantMetrics;
  recentViolationDetails: Array<{
    timestamp: Date;
    limiterType: string;
    endpoint: string;
    identifier: string;
  }>;
}
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: All API Routes Have Rate Limiting

*For any* API route in the system, when accessed, rate limiting should be applied based on the endpoint type.

**Validates: Requirements 1.1**

### Property 2: Plan-Based Multipliers Adjust Limits

*For any* tenant with a specific plan type (BASIC, PREMIUM, PRO), the effective rate limit should equal the base limit multiplied by the plan's multiplier.

**Validates: Requirements 2.1, 2.2, 2.3**

### Property 3: Rate Limit Violations Are Logged

*For any* rate limit violation, the system should create a metric record with tenant ID, limiter type, endpoint, and timestamp.

**Validates: Requirements 3.1, 3.6**

### Property 4: Metrics Track Hits and Violations

*For any* request to a rate-limited endpoint, the system should increment either the hit count (if allowed) or violation count (if blocked) for that tenant and limiter type.

**Validates: Requirements 3.2, 3.3**

### Property 5: Admin Bypasses Disable Rate Limiting

*For any* tenant with an active bypass, requests should not be rate limited regardless of usage.

**Validates: Requirements 4.3**

### Property 6: Custom Multipliers Override Plan Multipliers

*For any* tenant with a custom multiplier set, the effective rate limit should use the custom multiplier instead of the plan-based multiplier.

**Validates: Requirements 4.4**

### Property 7: Admin Actions Are Audited

*For any* admin action that modifies rate limits (bypass, custom multiplier), an audit log entry should be created with admin user ID, tenant ID, action type, and reason.

**Validates: Requirements 4.5**

### Property 8: Rate Limit Responses Include 429 Status

*For any* request that exceeds the rate limit, the response should have HTTP status code 429.

**Validates: Requirements 8.1**

### Property 9: Rate Limit Headers Are Present

*For any* response from a rate-limited endpoint, the response should include X-RateLimit-Limit, X-RateLimit-Remaining, and X-RateLimit-Reset headers.

**Validates: Requirements 8.2, 8.3, 8.4**

### Property 10: Rate Limit Errors Include Retry-After

*For any* 429 response, the response should include a Retry-After header with the number of seconds until the limit resets.

**Validates: Requirements 8.5**

### Property 11: Rate Limit Errors Have JSON Body

*For any* 429 response, the response body should be valid JSON containing an error message and the limiter type.

**Validates: Requirements 8.6, 8.7**

### Property 12: Dashboard Filters Work Correctly

*For any* combination of tenant ID, endpoint type, and time range filters, the dashboard API should return only metrics matching all specified filters.

**Validates: Requirements 6.4**

## Error Handling

### Rate Limit Exceeded

**Scenario**: User exceeds rate limit for an endpoint

**Response**:
```json
{
  "success": false,
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Rate limit exceeded. Please try again later.",
    "details": {
      "limiterType": "write",
      "retryAfter": 45
    }
  },
  "meta": {
    "requestId": "uuid",
    "timestamp": "ISO8601"
  }
}
```

**Headers**:
- `X-RateLimit-Limit`: Total allowed requests
- `X-RateLimit-Remaining`: 0
- `X-RateLimit-Reset`: Unix timestamp
- `Retry-After`: Seconds until reset

### Redis Connection Failure

**Scenario**: Upstash Redis is unavailable

**Behavior**: Fail open - allow requests but log error

**Rationale**: Availability over strict rate limiting during infrastructure issues

### Metrics Recording Failure

**Scenario**: PostgreSQL write fails when recording metrics

**Behavior**: Log error but don't block request

**Rationale**: Metrics are important but shouldn't impact user requests

### Invalid Admin Action

**Scenario**: Admin tries to set invalid multiplier (e.g., negative)

**Response**:
```json
{
  "success": false,
  "error": {
    "code": "INVALID_MULTIPLIER",
    "message": "Multiplier must be between 0.1 and 100",
    "details": {
      "provided": -1,
      "min": 0.1,
      "max": 100
    }
  }
}
```

## Testing Strategy

### Unit Tests

Unit tests will focus on specific examples, edge cases, and error conditions:

**Rate Limit Configuration**:
- Test plan multiplier retrieval for each plan type
- Test custom multiplier override logic
- Test bypass expiration logic
- Test invalid configuration handling

**Metrics Service**:
- Test metric recording with valid data
- Test metric aggregation for dashboard
- Test threshold checking and alert creation
- Test database write failures

**Admin Service**:
- Test bypass creation and expiration
- Test custom multiplier setting
- Test audit log creation
- Test permission checks

**Middleware**:
- Test rate limiter type selection for different endpoints
- Test identifier extraction (user ID vs IP)
- Test header setting in responses
- Test error response format

### Property-Based Tests

Property tests will verify universal properties across all inputs. Each test should run a minimum of 100 iterations.

**Configuration**: Use `fast-check` library for TypeScript property-based testing

**Test Tagging**: Each property test must include a comment:
```typescript
// Feature: rate-limiting-completion, Property 1: All API Routes Have Rate Limiting
```

**Property Test Examples**:

```typescript
// Property 2: Plan-Based Multipliers Adjust Limits
test('plan multipliers correctly scale base limits', async () => {
  await fc.assert(
    fc.asyncProperty(
      fc.constantFrom('BASIC', 'PREMIUM', 'PRO'),
      fc.integer({ min: 1, max: 1000 }),
      async (planType, baseLimit) => {
        const multiplier = getPlanMultiplier(planType);
        const effectiveLimit = baseLimit * multiplier;
        
        // Verify the math is correct
        expect(effectiveLimit).toBe(baseLimit * multiplier);
        
        // Verify multipliers are as expected
        if (planType === 'BASIC') expect(multiplier).toBe(1.0);
        if (planType === 'PREMIUM') expect(multiplier).toBe(2.0);
        if (planType === 'PRO') expect(multiplier).toBe(5.0);
      }
    ),
    { numRuns: 100 }
  );
});

// Property 3: Rate Limit Violations Are Logged
test('all violations create metric records', async () => {
  await fc.assert(
    fc.asyncProperty(
      fc.uuid(),
      fc.constantFrom('auth', 'api', 'read', 'write', 'sync', 'importExport'),
      fc.string(),
      async (tenantId, limiterType, endpoint) => {
        await recordViolation(tenantId, limiterType, 'user:test', endpoint);
        
        const metrics = await prisma.rateLimitMetric.findFirst({
          where: { tenantId, limiterType, endpoint }
        });
        
        expect(metrics).not.toBeNull();
        expect(metrics!.violationCount).toBeGreaterThan(0);
      }
    ),
    { numRuns: 100 }
  );
});
```

### Integration Tests

Integration tests will verify end-to-end flows:

**Rate Limiting Flow**:
1. Create test tenant with specific plan
2. Make requests to rate-limited endpoint
3. Verify rate limiting is enforced
4. Verify metrics are recorded
5. Verify headers are correct

**Admin Management Flow**:
1. Super admin sets bypass for tenant
2. Tenant makes requests exceeding limit
3. Verify requests are allowed
4. Verify audit log is created
5. Wait for bypass to expire
6. Verify rate limiting resumes

**Dashboard Data Flow**:
1. Generate rate limit violations
2. Query dashboard API
3. Verify metrics are aggregated correctly
4. Test filtering by tenant, type, time range
5. Verify data matches database

### Test Coverage Goals

- **Unit Tests**: 90%+ coverage of service functions
- **Property Tests**: All 12 correctness properties implemented
- **Integration Tests**: All critical user flows covered
- **API Route Coverage**: 100% of routes have rate limiting

## Implementation Notes

### Existing Infrastructure

The system already has:
- Upstash Redis integration (`lib/ratelimit.ts`)
- Rate limiter configurations for different endpoint types
- Middleware wrapper (`withRateLimit`)
- Rate limit headers in responses
- Many API routes already protected

### What Needs to Be Added

1. **Database Tables**: RateLimitMetric, RateLimitBypass, RateLimitCustomMultiplier
2. **Services**: rate-limit-config, rate-limit-metrics, rate-limit-admin
3. **API Routes**: Admin endpoints for managing rate limits
4. **Dashboard**: UI for viewing metrics and violations
5. **Tests**: Comprehensive unit, property, and integration tests
6. **Documentation**: Rate limiting guide for developers

### Migration Strategy

1. **Phase 1**: Add database tables and run migration
2. **Phase 2**: Implement services and enhance middleware
3. **Phase 3**: Add missing rate limiters to unprotected routes
4. **Phase 4**: Implement admin API endpoints
5. **Phase 5**: Build dashboard UI
6. **Phase 6**: Add comprehensive tests
7. **Phase 7**: Document rate limiting strategy

### Performance Considerations

- **Redis Calls**: Already optimized with Upstash
- **Metrics Recording**: Use async writes, don't block requests
- **Dashboard Queries**: Add database indexes on timestamp and tenantId
- **Alert Checking**: Run threshold checks asynchronously

### Security Considerations

- **Admin Endpoints**: Require super admin authentication
- **Bypass Auditing**: Log all bypass creations and expirations
- **Custom Multipliers**: Validate range (0.1 to 100)
- **Metrics Access**: Enforce tenant isolation (except for super admins)
- **Redis Security**: Use TLS for Upstash connection
