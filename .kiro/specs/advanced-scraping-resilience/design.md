# Design Document: Advanced Scraping Resilience

## Overview

This design enhances the existing web scraping infrastructure with advanced resilience features to combat modern anti-bot measures. The system will integrate residential proxy rotation, intelligent retry logic with exponential backoff, captcha solving services (2Captcha), comprehensive success rate monitoring with analytics dashboards, and dynamic concurrency adjustment based on site behavior.

The design builds upon the existing architecture:
- **ScraperService**: Orchestrates scraping operations
- **ProxyManager**: Manages proxy pool health and rotation
- **MetricsTracker**: Tracks and persists scraping metrics
- **ChallengeHandler**: Detects and handles anti-bot challenges
- **HumanSimulation**: Simulates human-like behavior

Key enhancements include:
1. Residential proxy prioritization with intelligent fallback
2. Exponential backoff retry strategy with context rotation
3. 2Captcha integration for automated captcha solving
4. Real-time analytics dashboard for success/block rates
5. Dynamic concurrency limiter that adapts to site defenses
6. Enhanced alert system for critical scraping issues

## Architecture

### Component Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        Scraper Service                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │
│  │ Retry        │  │ Concurrency  │  │ User Agent   │         │
│  │ Strategy     │  │ Limiter      │  │ Rotator      │         │
│  └──────────────┘  └──────────────┘  └──────────────┘         │
└────────────┬────────────────────────────────────────────────────┘
             │
      ┌──────┴──────┐
      │             │
┌─────▼─────┐ ┌────▼──────┐
│  Proxy    │ │ Captcha   │
│  Manager  │ │ Solver    │
│           │ │ (2Captcha)│
└─────┬─────┘ └────┬──────┘
      │            │
┌─────▼────────────▼──────┐
│   Metrics Tracker       │
│  ┌──────────────────┐   │
│  │ Alert Generator  │   │
│  └──────────────────┘   │
└─────────┬───────────────┘
          │
    ┌─────▼─────┐
    │ Database  │
    │ (Prisma)  │
    └───────────┘
```

### Data Flow

1. **Scraping Request** → Scraper Service receives URL to scrape
2. **Proxy Selection** → Proxy Manager selects healthy residential proxy (or datacenter fallback)
3. **User Agent Rotation** → Random user agent selected from pool
4. **Page Navigation** → Browser navigates with proxy and user agent
5. **Challenge Detection** → Challenge Handler checks for captchas/blocks
6. **Captcha Solving** (if needed) → Captcha Solver submits to 2Captcha API
7. **Data Extraction** → Extract product data from page
8. **Metrics Recording** → Metrics Tracker records success/failure, response time
9. **Retry Logic** (if failed) → Retry Strategy determines if/when to retry
10. **Alert Generation** → Alert Generator creates alerts for threshold violations

## Components and Interfaces

### 1. Enhanced Proxy Manager

**Purpose**: Manage proxy pool with residential/datacenter prioritization and intelligent rotation.

**Interface**:
```typescript
interface ProxyConfig {
  url: string;
  type: 'residential' | 'datacenter';
  username?: string;
  password?: string;
  priority?: number; // Higher = preferred
}

interface ProxySelectionOptions {
  preferResidential?: boolean;
  excludeProxies?: string[]; // Exclude specific proxies (for retries)
  siteBlockRate?: number; // Site's current block rate
}

class ProxyManager {
  // Existing methods...
  
  // New methods
  async getHealthyProxy(options?: ProxySelectionOptions): Promise<ProxyConfig | null>;
  getProxiesByType(type: 'residential' | 'datacenter'): ProxyConfig[];
  async selectProxyForSite(site: string, options?: ProxySelectionOptions): Promise<ProxyConfig | null>;
}
```

**Selection Algorithm**:
1. If site block rate > 20%, prioritize residential proxies
2. Filter out unhealthy proxies (failure count >= threshold)
3. Filter out excluded proxies (from retry attempts)
4. Sort by: proxy type priority → success rate → avg response time
5. Return top proxy or null if none available

### 2. Captcha Solver Service

**Purpose**: Integrate with 2Captcha API to solve captcha challenges automatically.

**Interface**:
```typescript
interface CaptchaSolveRequest {
  type: 'recaptcha_v2' | 'recaptcha_v3' | 'hcaptcha' | 'turnstile';
  siteKey: string;
  pageUrl: string;
  action?: string; // For reCAPTCHA v3
  minScore?: number; // For reCAPTCHA v3
}

interface CaptchaSolveResult {
  success: boolean;
  token?: string;
  solveTime: number; // milliseconds
  cost: number; // credits used
  error?: string;
}

class CaptchaSolver {
  constructor(apiKey: string, options?: CaptchaSolverOptions);
  
  async solveCaptcha(request: CaptchaSolveRequest): Promise<CaptchaSolveResult>;
  async detectCaptchaType(page: Page): Promise<CaptchaSolveRequest | null>;
  async injectSolution(page: Page, token: string, type: string): Promise<void>;
  getStats(): CaptchaSolverStats;
}

interface CaptchaSolverStats {
  totalSolves: number;
  successfulSolves: number;
  failedSolves: number;
  avgSolveTime: number;
  totalCost: number;
  solvesByType: Record<string, number>;
}
```

**2Captcha API Integration**:
- **Endpoint**: `https://2captcha.com/in.php` (submit) and `https://2captcha.com/res.php` (get result)
- **Authentication**: API key via `key` parameter
- **Request Flow**:
  1. Submit captcha with site key and page URL
  2. Receive task ID
  3. Poll for result every 5 seconds (max 120 seconds)
  4. Return solution token or error

**Supported Captcha Types**:
- **reCAPTCHA v2**: `method=userrecaptcha`, `googlekey`, `pageurl`
- **reCAPTCHA v3**: `method=userrecaptcha`, `version=v3`, `action`, `min_score`
- **hCaptcha**: `method=hcaptcha`, `sitekey`, `pageurl`
- **Turnstile**: `method=turnstile`, `sitekey`, `pageurl`

### 3. Retry Strategy

**Purpose**: Implement intelligent retry logic with exponential backoff and context rotation.

**Interface**:
```typescript
interface RetryOptions {
  maxRetries: number; // Default: 3
  initialDelay: number; // Default: 1000ms
  maxDelay: number; // Default: 30000ms
  backoffMultiplier: number; // Default: 2
  jitter: boolean; // Default: true
}

interface RetryContext {
  attempt: number;
  previousProxy?: string;
  previousUserAgent?: string;
  lastError?: Error;
  startTime: number;
}

class RetryStrategy {
  constructor(options?: RetryOptions);
  
  async executeWithRetry<T>(
    operation: (context: RetryContext) => Promise<T>,
    shouldRetry: (error: Error, context: RetryContext) => boolean
  ): Promise<T>;
  
  calculateDelay(attempt: number): number;
  shouldRetryError(error: Error): boolean;
}
```

**Exponential Backoff Formula**:
```
delay = min(initialDelay * (backoffMultiplier ^ attempt), maxDelay)
if (jitter) delay = delay * (0.5 + random(0, 0.5))
```

**Example Delays** (with jitter):
- Attempt 1: 1000ms * (0.5-1.0) = 500-1000ms
- Attempt 2: 2000ms * (0.5-1.0) = 1000-2000ms
- Attempt 3: 4000ms * (0.5-1.0) = 2000-4000ms

**Retry Conditions**:
- Network errors (ECONNRESET, ETIMEDOUT)
- HTTP 429 (Rate Limit)
- HTTP 503 (Service Unavailable)
- Scrape block errors (Cloudflare, etc.)
- Captcha solve failures

### 4. Concurrency Limiter

**Purpose**: Dynamically adjust concurrent requests based on site behavior.

**Interface**:
```typescript
interface ConcurrencyConfig {
  minConcurrency: number; // Default: 1
  maxConcurrency: number; // Default: 10
  initialConcurrency: number; // Default: 3
  adjustmentThreshold: number; // Default: 0.2 (20%)
}

class ConcurrencyLimiter {
  constructor(config?: ConcurrencyConfig);
  
  async acquireSlot(site: string): Promise<void>;
  releaseSlot(site: string): void;
  adjustConcurrency(site: string, metrics: SiteMetrics): void;
  getCurrentConcurrency(site: string): number;
}

interface SiteMetrics {
  blockRate: number;
  successRate: number;
  avgResponseTime: number;
  recentRequests: number;
}
```

**Adjustment Algorithm**:
```typescript
if (blockRate > 0.2) {
  // Reduce by 50% if block rate exceeds 20%
  newConcurrency = Math.max(minConcurrency, currentConcurrency * 0.5);
} else if (successRate > 0.8 && avgResponseTime < 2000) {
  // Increase by 10% if success rate > 80% and fast responses
  newConcurrency = Math.min(maxConcurrency, currentConcurrency * 1.1);
} else if (statusCode === 429) {
  // Immediate 50% reduction on rate limit
  newConcurrency = Math.max(minConcurrency, currentConcurrency * 0.5);
}
```

### 5. Enhanced Metrics Tracker

**Purpose**: Track comprehensive metrics and generate alerts for threshold violations.

**New Methods**:
```typescript
class MetricsTracker {
  // Existing methods...
  
  // New methods
  async getSiteAnalytics(site: string, timeRange: '1h' | '24h' | '7d'): Promise<SiteAnalytics>;
  async getProxyAnalytics(proxy: string, timeRange: '1h' | '24h' | '7d'): Promise<ProxyAnalytics>;
  async getChallengeAnalytics(timeRange: '1h' | '24h' | '7d'): Promise<ChallengeAnalytics>;
  async getTopFailingSites(limit: number): Promise<SiteFailureStats[]>;
  async getTopFailingProxies(limit: number): Promise<ProxyFailureStats[]>;
}

interface SiteAnalytics {
  site: string;
  timeRange: string;
  totalRequests: number;
  successfulRequests: number;
  blockedRequests: number;
  challengedRequests: number;
  successRate: number;
  blockRate: number;
  challengeRate: number;
  avgResponseTime: number;
  requestsByHour: Array<{ hour: string; count: number }>;
  topFailureReasons: Array<{ reason: string; count: number }>;
}

interface ProxyAnalytics {
  proxy: string;
  proxyType: 'residential' | 'datacenter';
  timeRange: string;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  successRate: number;
  avgResponseTime: number;
  requestsBySite: Array<{ site: string; count: number; successRate: number }>;
}

interface ChallengeAnalytics {
  timeRange: string;
  totalChallenges: number;
  solvedChallenges: number;
  failedChallenges: number;
  solveRate: number;
  avgSolveTime: number;
  challengesByType: Array<{ type: string; count: number; solveRate: number }>;
  challengesBySite: Array<{ site: string; count: number; solveRate: number }>;
}
```

### 6. Alert Generator

**Purpose**: Generate alerts for critical scraping issues based on configurable thresholds.

**Interface**:
```typescript
interface AlertThresholds {
  blockRateThreshold: number; // Default: 0.3 (30%)
  solveRateThreshold: number; // Default: 0.7 (70%)
  proxyFailureThreshold: number; // Default: 0.5 (50%)
  responseTimeThreshold: number; // Default: 5000ms
}

class AlertGenerator {
  constructor(thresholds?: AlertThresholds);
  
  async checkAndCreateAlerts(): Promise<Alert[]>;
  async createBlockRateAlert(site: string, blockRate: number): Promise<Alert>;
  async createProxyFailureAlert(proxy: string, failureRate: number): Promise<Alert>;
  async createSolveRateAlert(site: string, solveRate: number): Promise<Alert>;
  async createAllProxiesUnhealthyAlert(): Promise<Alert>;
}

interface Alert {
  id: string;
  severity: 'critical' | 'warning' | 'info';
  type: 'high_block_rate' | 'proxy_failure' | 'low_solve_rate' | 'all_proxies_unhealthy';
  message: string;
  site?: string;
  proxyUrl?: string;
  acknowledged: boolean;
  createdAt: Date;
}
```

## Data Models

### Database Schema Extensions

**ProxyHealth Table** (existing - no changes needed):
```prisma
model ProxyHealth {
  id              String   @id @default(uuid())
  proxyUrl        String   @unique
  proxyType       String   // 'residential' or 'datacenter'
  isHealthy       Boolean  @default(true)
  failureCount    Int      @default(0)
  successCount    Int      @default(0)
  avgResponseTime Float    @default(0)
  lastChecked     DateTime @default(now())
  lastSuccess     DateTime @default(now())
}
```

**CaptchaSolveAttempt Table** (new):
```prisma
model CaptchaSolveAttempt {
  id              String   @id @default(uuid())
  site            String
  captchaType     String   // 'recaptcha_v2', 'recaptcha_v3', 'hcaptcha', 'turnstile'
  success         Boolean
  solveTime       Int      // milliseconds
  cost            Float    // credits used
  errorMessage    String?
  timestamp       DateTime @default(now())
  
  @@index([site, timestamp])
  @@index([captchaType, timestamp])
}
```

**RetryQueue Table** (new):
```prisma
model RetryQueue {
  id              String   @id @default(uuid())
  tenantId        String
  siteId          String
  productId       String
  url             String
  retryCount      Int      @default(0)
  maxRetries      Int      @default(4)
  nextRetryAt     DateTime
  lastAttemptAt   DateTime?
  lastError       String?
  status          String   @default("PENDING") // PENDING, IN_PROGRESS, SUCCESS, FAILED
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  
  @@index([status, nextRetryAt])
  @@index([tenantId, siteId])
}
```

**ConcurrencyState Table** (new):
```prisma
model ConcurrencyState {
  id                  String   @id @default(uuid())
  site                String   @unique
  currentConcurrency  Int      @default(3)
  activeRequests      Int      @default(0)
  lastAdjustedAt      DateTime @default(now())
  adjustmentReason    String?
  
  @@index([site])
}
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Proxy Rotation Consistency
*For any* scraping request that fails, when retrying, the system should use a different proxy than the previous attempt (unless only one proxy is available).
**Validates: Requirements 1.3, 3.3**

### Property 2: Exponential Backoff Timing
*For any* retry attempt N, the delay before retry should be at least `initialDelay * (backoffMultiplier ^ (N-1))` and at most `maxDelay`.
**Validates: Requirements 3.1**

### Property 3: Captcha Solution Injection
*For any* successfully solved captcha, injecting the solution token into the page should result in the challenge being cleared and the page becoming accessible.
**Validates: Requirements 4.3**

### Property 4: Concurrency Reduction on High Block Rate
*For any* site where block rate exceeds 20%, the concurrency limiter should reduce concurrent requests by at least 30%.
**Validates: Requirements 6.2**

### Property 5: Residential Proxy Prioritization
*For any* site with block rate above 20%, when selecting a proxy, residential proxies should be selected before datacenter proxies (if healthy residential proxies are available).
**Validates: Requirements 1.2**

### Property 6: Metrics Persistence
*For any* scraping request, the metrics (success/failure, response time, proxy used) should be persisted to the database within the configured persist interval.
**Validates: Requirements 5.1**

### Property 7: Alert Creation on Threshold Violation
*For any* site where block rate exceeds 30%, an alert with severity "critical" should be created within 1 minute.
**Validates: Requirements 5.7, 12.1**

### Property 8: Retry Queue Exponential Backoff
*For any* failed request in the retry queue, the next retry time should follow exponential backoff: 5min, 15min, 1h, 6h.
**Validates: Requirements 8.2**

### Property 9: User Agent Rotation on Retry
*For any* retry attempt, the user agent should be different from the previous attempt.
**Validates: Requirements 3.2, 9.3**

### Property 10: Proxy Health Recovery
*For any* proxy marked unhealthy, after the recovery period (10 minutes) and a successful request, the proxy should be marked healthy again.
**Validates: Requirements 7.3**

### Property 11: Concurrency Bounds
*For any* site, the concurrent request count should never be less than the configured minimum (1) or greater than the configured maximum (10).
**Validates: Requirements 6.4, 6.5**

### Property 12: Challenge Solve Rate Tracking
*For any* challenge attempt, the solve time and success status should be recorded in the database.
**Validates: Requirements 10.2**

## Error Handling

### Error Categories

1. **Network Errors**
   - ECONNRESET, ETIMEDOUT, ENOTFOUND
   - Action: Retry with exponential backoff (up to 3 attempts)
   - Fallback: Mark request as failed, add to retry queue

2. **Rate Limit Errors (HTTP 429)**
   - Action: Immediate concurrency reduction (50%)
   - Retry: After calculated backoff delay
   - Fallback: If persistent, reduce to minimum concurrency

3. **Block Errors (HTTP 403, Cloudflare, etc.)**
   - Action: Switch to residential proxy, retry with new context
   - Fallback: If all proxies blocked, add to retry queue with longer delay

4. **Captcha Errors**
   - Action: Submit to 2Captcha service
   - Retry: Up to 3 solve attempts
   - Fallback: If solve fails, mark as blocked, add to retry queue

5. **Proxy Errors**
   - Action: Mark proxy as unhealthy, select different proxy
   - Retry: Immediate retry with new proxy
   - Fallback: If no healthy proxies, create critical alert

6. **Timeout Errors**
   - Action: Increase wait time, retry with longer timeout
   - Fallback: After 3 attempts, mark as failed

### Error Recovery Flow

```
Request Failed
    │
    ├─> Network Error? ──> Retry with backoff (3x)
    │
    ├─> Rate Limit (429)? ──> Reduce concurrency + Retry
    │
    ├─> Block (403)? ──> Switch to residential proxy + Retry
    │
    ├─> Captcha? ──> Solve with 2Captcha (3x) + Retry
    │
    ├─> Proxy Error? ──> Mark unhealthy + Select new proxy + Retry
    │
    └─> All retries exhausted? ──> Add to retry queue
```

## Testing Strategy

### Unit Testing

**Proxy Manager Tests**:
- Test proxy selection prioritizes residential over datacenter when block rate > 20%
- Test proxy rotation excludes previously used proxies
- Test fallback to datacenter when no residential proxies available
- Test proxy health marking (healthy/unhealthy transitions)

**Retry Strategy Tests**:
- Test exponential backoff delay calculation
- Test jitter adds randomness to delays
- Test max delay cap is enforced
- Test retry context includes previous proxy/user agent

**Captcha Solver Tests**:
- Test captcha type detection from page
- Test 2Captcha API request formatting
- Test solution token injection into page
- Test solve timeout handling

**Concurrency Limiter Tests**:
- Test concurrency reduction on high block rate
- Test concurrency increase on high success rate
- Test minimum/maximum concurrency bounds
- Test slot acquisition/release

**Alert Generator Tests**:
- Test alert creation when block rate exceeds threshold
- Test alert creation when all proxies unhealthy
- Test alert creation when solve rate drops below threshold
- Test alert deduplication (no duplicate alerts for same condition)

### Property-Based Testing

Each property test should run a minimum of 100 iterations with randomized inputs.

**Property Test 1: Proxy Rotation**
- Generate: Random scraping requests with failures
- Assert: Retry uses different proxy than previous attempt
- Tag: **Feature: advanced-scraping-resilience, Property 1: Proxy Rotation Consistency**

**Property Test 2: Exponential Backoff**
- Generate: Random retry attempts (1-10)
- Assert: Delay is within calculated bounds
- Tag: **Feature: advanced-scraping-resilience, Property 2: Exponential Backoff Timing**

**Property Test 3: Residential Proxy Priority**
- Generate: Random sites with varying block rates
- Assert: When block rate > 20%, residential proxies selected first
- Tag: **Feature: advanced-scraping-resilience, Property 5: Residential Proxy Prioritization**

**Property Test 4: Concurrency Bounds**
- Generate: Random concurrency adjustments
- Assert: Concurrency stays within [min, max] bounds
- Tag: **Feature: advanced-scraping-resilience, Property 11: Concurrency Bounds**

**Property Test 5: Metrics Persistence**
- Generate: Random scraping requests
- Assert: All requests have corresponding metrics in database
- Tag: **Feature: advanced-scraping-resilience, Property 6: Metrics Persistence**

### Integration Testing

**End-to-End Scraping Flow**:
1. Configure residential and datacenter proxies
2. Trigger scraping request to site with anti-bot protection
3. Verify proxy rotation on failure
4. Verify captcha solving if challenge detected
5. Verify metrics recorded in database
6. Verify alerts created if thresholds exceeded

**Retry Queue Processing**:
1. Add failed requests to retry queue
2. Verify exponential backoff delays
3. Verify retry attempts with different proxies/user agents
4. Verify successful retries update product data
5. Verify failed retries marked as permanently failed

**Concurrency Adjustment**:
1. Simulate high block rate for a site
2. Verify concurrency reduced
3. Simulate improved success rate
4. Verify concurrency gradually increased

### Testing Configuration

**Property-Based Testing Library**: Use `fast-check` for TypeScript
**Minimum Iterations**: 100 per property test
**Test Environment**: Use test database with seeded proxy/site data
**Mocking**: Mock 2Captcha API responses for unit tests
**Integration**: Use real Playwright browser for integration tests

## Implementation Notes

### Browser Context Lifecycle Management

**Critical Fix**: The browser context pool must properly manage context lifecycle to prevent race conditions in parallel scraping operations.

**Key Principles**:
1. **Never close contexts** - Contexts should only be released back to the pool, not closed
2. **Validate before reuse** - Check if context and browser are still connected before reusing
3. **Clean pages on release** - Close all pages when releasing a context to prevent leaks
4. **Error handling** - Wrap context acquisition and page creation in try-catch blocks
5. **Resource cleanup** - Always release concurrent slots and close pages in finally blocks

**Implementation Details**:

```typescript
// ✅ CORRECT: Release context without closing
finally {
  if (page) {
    await page.close().catch(() => {});
  }
  if (context) {
    await this.browserPool.releaseContext(context).catch(() => {});
  }
  siteProfileManager.releaseConcurrentSlot(hostname);
}

// ❌ INCORRECT: Closing context destroys it permanently
finally {
  await context.close(); // DON'T DO THIS
  await this.browserPool.releaseContext(context);
}
```

**Context Validation**:
```typescript
// Check if context is still valid before reusing
if (pooled && !pooled.inUse) {
  try {
    const pages = pooled.context.pages();
    // Also verify the browser is still connected
    if (pages && this.browser && this.browser.isConnected()) {
      pooled.inUse = true;
      return pooled.context;
    } else {
      // Remove invalid context from pool
      this.contexts.delete(contextKey);
    }
  } catch (error) {
    // Context is closed, remove from pool
    this.contexts.delete(contextKey);
  }
}
```

**Error Handling**:
```typescript
let context: any = null;
let page: any = null;

try {
  context = await this.browserPool.acquireContext(userAgent, proxy);
  page = await context.newPage();
} catch (error) {
  logger.error(`Failed to acquire context or create page:`, { error });
  // Clean up resources before returning
  siteProfileManager.releaseConcurrentSlot(hostname);
  return null;
}
```

**Benefits**:
- Prevents "Target page, context or browser has been closed" errors
- Enables safe parallel scraping operations
- Reduces memory leaks from unclosed pages
- Improves context reuse efficiency

See `BROWSER_CONTEXT_FIX.md` for detailed analysis and fixes.

### Configuration

**Environment Variables**:
```env
# Captcha Solving
CAPTCHA_SOLVER_ENABLED=true
CAPTCHA_SOLVER_API_KEY=your_2captcha_api_key
CAPTCHA_SOLVER_TIMEOUT=120000

# Retry Strategy
RETRY_MAX_ATTEMPTS=3
RETRY_INITIAL_DELAY=1000
RETRY_MAX_DELAY=30000
RETRY_BACKOFF_MULTIPLIER=2

# Concurrency
CONCURRENCY_MIN=1
CONCURRENCY_MAX=10
CONCURRENCY_INITIAL=3

# Alerts
ALERT_BLOCK_RATE_THRESHOLD=0.3
ALERT_SOLVE_RATE_THRESHOLD=0.7
ALERT_PROXY_FAILURE_THRESHOLD=0.5
```

### Performance Considerations

1. **Proxy Selection**: Cache healthy proxies in memory, refresh every 5 minutes
2. **Metrics Buffering**: Buffer metrics in memory, persist every 5 minutes
3. **Alert Deduplication**: Track alerted conditions in memory to avoid duplicate alerts
4. **Retry Queue**: Process retry queue in background worker, not in main request flow

### Security Considerations

1. **API Key Storage**: Store 2Captcha API key in environment variables, never in code
2. **Proxy Credentials**: Encrypt proxy credentials in database
3. **Rate Limiting**: Respect site rate limits to avoid legal issues
4. **User Agent Rotation**: Use realistic user agents to avoid detection

### Monitoring and Observability

1. **Metrics Dashboard**: Display real-time success/block rates per site
2. **Proxy Health Dashboard**: Display proxy performance metrics
3. **Alert Dashboard**: Display unacknowledged alerts with severity
4. **Logs**: Structured logging with correlation IDs for request tracing
