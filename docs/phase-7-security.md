# Phase 7 - Security Hardening Layer

## Overview

Phase 7 implements production-grade security hardening to prevent common attack vectors and ensure environment separation. The implementation focuses on three core areas: SSRF prevention, environment separation, and multi-level rate limiting.

## 1. SSRF (Server-Side Request Forgery) Protection

### Purpose

Prevents attackers from using the application to make requests to internal services, metadata endpoints, or private IP ranges.

### Implementation Details

**File:** `lib/security/ssrf-protection.ts`

The module blocks:
- Private IP ranges (RFC 1918: 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16)
- Loopback addresses (127.0.0.0/8)
- Link-local addresses (169.254.0.0/24)
- Shared address space (100.64.0.0/10)
- Cloud metadata endpoints (AWS, GCP, Azure)
- URLs with embedded credentials

### API Reference

```typescript
import { validateUrlForSSRP, validateUrlsForSSRP, extractAndValidateUrls } from '@/lib/security/ssrf-protection';

// Validate a single URL
const result = validateUrlForSSRP('https://example.com/api');
if (!result.allowed) {
  throw new Error(`URL blocked: ${result.reason}`);
}

// Validate multiple URLs
const bulkResult = validateUrlsForSSRP([
  'https://example.com',
  'https://169.254.169.254', // Would be blocked
]);

// Extract and validate URLs from user input
const inputValidation = extractAndValidateUrls(userInput);
if (!inputValidation.allowed) {
  console.log('Blocked URLs:', inputValidation.urls);
}
```

### Integration Points

**Scraper Playground / Simulator**

```typescript
// app/api/v1/admin/simulator/route.ts or scraper-playground route
import { validateUrlForSSRP } from '@/lib/security/ssrf-protection';

export async function POST(req: NextRequest) {
  const { targetUrl } = await req.json();
  
  // Validate URL before fetching
  const validation = validateUrlForSSRP(targetUrl);
  if (!validation.allowed) {
    return NextResponse.json(
      { error: `URL blocked: ${validation.reason}` },
      { status: 400 }
    );
  }
  
  // Safe to fetch targetUrl
  const response = await fetch(targetUrl);
  return response;
}
```

**Webhook Configuration**

```typescript
// app/api/v1/webhooks/route.ts
import { validateUrlForSSRP } from '@/lib/security/ssrf-protection';

export async function POST(req: NextRequest) {
  const { webhookUrl } = await req.json();
  
  const validation = validateUrlForSSRP(webhookUrl);
  if (!validation.allowed) {
    return NextResponse.json(
      { error: `Invalid webhook URL: ${validation.reason}` },
      { status: 400 }
    );
  }
  
  // Store and use webhookUrl
}
```

---

## 2. Environment Separation

### Purpose

Enforces strict boundary between development and production environments. Prevents debug features from being accidentally enabled in production and vice versa.

### Implementation Details

**File:** `lib/security/environment-separation.ts`

Key components:
- `isProduction()` / `isDevelopment()` - Environment checks
- `ensureDevelopmentOnly(context)` - Throws in production
- `ensureProductionOnly(context)` - Throws in development
- `devOnly<T>(value)` - Type-safe dev-only values
- `validateInternalModeForProduction()` - Runtime check
- `performEnvironmentSafetyChecks()` - Startup validation

### Best Practices

**1. Startup Initialization**

```typescript
// lib/instrumentation.ts or app initialization
import { performEnvironmentSafetyChecks } from '@/lib/security/environment-separation';

export async function register() {
  // Run safety checks before any requests are served
  performEnvironmentSafetyChecks();
  
  // ... rest of initialization
}
```

**2. Feature Gates**

```typescript
import { ensureDevelopmentOnly, isProduction } from '@/lib/security/environment-separation';

// Option 1: Hard fail in production
export async function debugEndpoint(req: NextRequest) {
  ensureDevelopmentOnly('Debug endpoint');
  
  // ... debug logic
}

// Option 2: Conditional logic
export async function getLogs(req: NextRequest) {
  if (isProduction()) {
    return NextResponse.json(
      { error: 'Logs not available in production' },
      { status: 401 }
    );
  }
  
  // ... return logs
}
```

**3. Type-Safe Dev Values**

```typescript
import { devOnly } from '@/lib/security/environment-separation';

// This will not compile or throw at runtime in production
const debugApiKey = devOnly(process.env.DEBUG_API_KEY);
```

### Interaction with INTERNAL_MODE

The middleware `lib/middleware/internal-gate.ts` already checks INTERNAL_MODE at runtime:

```typescript
export async function withInternalGate(req, handler) {
  const isInternalMode = process.env.INTERNAL_MODE === 'true';
  const isProduction = process.env.NODE_ENV === 'production';

  // Double-gated: must be non-production AND explicitly enabled
  if (isProduction || !isInternalMode) {
    return new NextResponse(null, { status: 404 });
  }

  // Additional auth check...
}
```

Phase 7 enhances this with startup-time validation via `performEnvironmentSafetyChecks()`.

---

## 3. Multi-Level Rate Limiting

### Purpose

Prevents resource exhaustion and abuse through concurrent limits across tenant, IP, and endpoint class dimensions.

### Implementation Details

**File:** `lib/security/multi-level-rate-limit.ts`

Three-level enforcement:
1. **Per-Tenant Limit** - Prevents a single tenant from monopolizing resources
2. **Per-IP Limit** - Prevents distributed attacks from many IPs
3. **Per-Endpoint Class** - Different limits for auth, read, write, sync operations

### Configuration

```typescript
import { enforceMultiLevelRateLimit, rateLimitErrorResponse } from '@/lib/security/multi-level-rate-limit';

export async function GET(req: NextRequest) {
  // Apply multi-level rate limiting
  const rateLimit = await enforceMultiLevelRateLimit(req, {
    perTenant: { limit: 1000, windowMs: 60000 },    // 1000 req/min per tenant
    perIp: { limit: 500, windowMs: 60000 },         // 500 req/min per IP
  });
  
  if (!rateLimit.allowed) {
    return rateLimitErrorResponse(rateLimit);
  }
  
  // ... handle request
}
```

### Plan-Based Rate Limit Multipliers

Enterprise tenants receive 2x rate limit, PRO tenants receive 1.5x:

```typescript
// Checked automatically in checkTenantRateLimit()
const multiplier = tenant.planType === 'PRO' ? 1.5 : 1;
const effectiveLimit = Math.floor(baseLimit * multiplier);
```

### Tenant-Specific Rate Limiting

```typescript
import { checkTenantRateLimit } from '@/lib/security/multi-level-rate-limit';

// Check if a tenant has exceeded its rate limit
const result = await checkTenantRateLimit(tenantId, null, { limit: 100 });

if (!result.allowed) {
  return NextResponse.json(
    { error: 'Tenant rate limit exceeded', retryAfter: result.retryAfterSeconds },
    { status: 429 }
  );
}
```

### IP-Based Rate Limiting

```typescript
import { checkIpRateLimit, getClientIp } from '@/lib/security/multi-level-rate-limit';

const ip = getClientIp(req);
const result = await checkIpRateLimit(ip, null, { limit: 500 });

if (!result.allowed) {
  return rateLimitErrorResponse(result);
}
```

---

## 4. CI/CD Security Checks

### Purpose

Automated validation in the build pipeline to prevent security regressions.

### Script

**File:** `scripts/phase-7-security-check.sh`

Checks performed:
1. INTERNAL_MODE disabled in production environment
2. No hardcoded credentials detected
3. No unguarded NODE_ENV checks
4. No debug console methods in production code
5. SSRF protection module exists
6. Environment separation module exists

### Integration

Add to `package.json`:

```json
{
  "scripts": {
    "security:check": "bash scripts/phase-7-security-check.sh",
    "security:check:ci": "NODE_ENV=production bash scripts/phase-7-security-check.sh"
  }
}
```

Add to CI pipeline (GitHub Actions example):

```yaml
# .github/workflows/security.yml
name: Security Hardening Checks

on: [push, pull_request]

jobs:
  phase7-checks:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Run security checks
        run: npm run security:check:ci
      
      - name: Lint & Build
        run: npm run lint && npm run build
```

### Manual Execution

```bash
# Development environment checks
npm run security:check

# Production-simulated checks
NODE_ENV=production npm run security:check:ci
```

---

## Implementation Checklist

### Immediate Integration

- [ ] Import and call `performEnvironmentSafetyChecks()` in application startup
- [ ] Add SSRF validation to any URL/webhook input endpoints
- [ ] Integrate `enforceMultiLevelRateLimit()` into high-traffic routes
- [ ] Add security checks to CI/CD pipeline

### Validation

- [ ] Test SSRF blocking with private IPs (e.g., 127.0.0.1, 10.0.0.1, 169.254.169.254)
- [ ] Test SSRF blocking with cloud metadata endpoints
- [ ] Verify INTERNAL_MODE=true fails in production builds
- [ ] Verify `ensureDevelopmentOnly` throws in production
- [ ] Test multi-level rate limiting with synthetic load

### Documentation

- [ ] Update API documentation with SSRF validation requirements
- [ ] Document rate limit multipliers for each plan
- [ ] Add security troubleshooting guide
- [ ] Create runbook for responding to rate limit incidents

---

## Security Model

### Threat Model

| Threat | Mitigation |
|--------|-----------|
| SSRF to internal services | URL validation blocks private IPs and metadata endpoints |
| Credential exposure via debug | `INTERNAL_MODE` gates + environment separation |
| Debug code in production | Environment safety checks at startup |
| Tenant resource abuse | Per-tenant rate limiting with plan multipliers |
| Distributed attack (many IPs) | Per-IP rate limiting with shared limits |
| Brute force on auth | Strict auth endpoint rate limit (5/15min) |

### Defense in Depth

1. **Build Time**: Linting catches debug imports
2. **Deploy Time**: CI validates INTERNAL_MODE disabled
3. **Runtime**: Environment safety checks validate configuration
4. **Request Time**: Rate limiting enforces quotas; SSRF validation blocks attacks

---

## Next Steps

### Phase 8 Planning

Phase 8 will focus on chaos testing and failure modes:
- Simulate Redis unavailability
- Simulate worker crashes
- Simulate browser crashes
- Simulate network flooding
- Validate all hardening measures hold under load

### Observability Integration

Connect Phase 7 security enforcement to Phase 6 observability:
- Alert on rate limit threshold breaches
- Log SSRF validation failures
- Track INTERNAL_MODE state changes
- Monitor environment safety check failures

---

## Related Files

- [withInternalGate middleware](../lib/middleware/internal-gate.ts)
- [Rate limiters](../lib/ratelimit.ts)
- [Security modules](../lib/security/)
- [CI configuration](../.github/workflows/)
