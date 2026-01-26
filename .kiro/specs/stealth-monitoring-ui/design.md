# Design Document: Stealth Monitoring UI

## Overview

This design document outlines the architecture and implementation approach for adding comprehensive monitoring and management UI to the admin and tenant panels. The design leverages existing backend services (ProxyManager, ChallengeHandler, MetricsTracker, HumanSimulator) and exposes their capabilities through intuitive dashboards and management interfaces.

The implementation follows the existing Next.js App Router architecture with React Server Components and client-side interactivity where needed. All new pages will integrate seamlessly with the current admin and tenant panel layouts.

## Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Frontend Layer                          │
│  ┌──────────────────┐         ┌──────────────────┐         │
│  │  Admin Panel     │         │  Tenant Panel    │         │
│  │  - Proxy Health  │         │  - My Metrics    │         │
│  │  - Challenges    │         │  - Site Config   │         │
│  │  - Metrics       │         │  - Alerts        │         │
│  │  - Settings      │         │                  │         │
│  └──────────────────┘         └──────────────────┘         │
└─────────────────────────────────────────────────────────────┘
                            │
                            │ HTTP/REST
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                      API Layer                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Next.js API Routes (/api/v1/admin/*, /api/v1/tenant/*) │
│  │  - Authentication & Authorization                     │  │
│  │  - Request Validation                                 │  │
│  │  - Response Formatting                                │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                   Service Layer                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │ ProxyManager │  │ Challenge    │  │ Metrics      │     │
│  │              │  │ Handler      │  │ Tracker      │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                   Data Layer                                │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Prisma ORM + PostgreSQL                             │  │
│  │  - ScrapingMetrics, ProxyMetrics, ProxyHealth        │  │
│  │  - ChallengeAttempts, SiteProfiles, Alerts           │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### Component Architecture

Each dashboard follows a consistent pattern:
1. **Page Component** (Server Component) - Handles initial data loading and layout
2. **Client Component** - Manages interactivity, real-time updates, and state
3. **API Route** - Fetches data from services and formats responses
4. **Service Integration** - Calls existing backend services

## Components and Interfaces

### 1. Admin Proxy Health Dashboard

**Location:** `app/admin/proxy-health/page.tsx`

**Component Structure:**
```typescript
interface ProxyHealthData {
  url: string;
  type: 'residential' | 'datacenter';
  isHealthy: boolean;
  successCount: number;
  failureCount: number;
  successRate: number;
  avgResponseTime: number;
  lastChecked: Date;
}

interface ProxyHealthStats {
  totalProxies: number;
  healthyProxies: number;
  unhealthyProxies: number;
  avgSuccessRate: number;
  avgResponseTime: number;
}
```

**UI Elements:**
- Stats cards showing total/healthy/unhealthy proxy counts
- Table displaying all proxies with health indicators
- Time range selector (24h, 7d, 30d)
- Refresh button for manual updates
- Status badges (healthy: green, unhealthy: red)
- Response time chart

### 2. Admin Challenge Detection Dashboard

**Location:** `app/admin/challenge-stats/page.tsx`

**Component Structure:**
```typescript
interface ChallengeStats {
  site: string;
  totalChallenges: number;
  solvedChallenges: number;
  failedChallenges: number;
  solveRate: number;
  challengeTypes: {
    type: string;
    count: number;
    solveRate: number;
  }[];
}

interface ChallengeSummary {
  totalChallenges: number;
  avgSolveRate: number;
  mostCommonType: string;
  sitesWithIssues: number;
}
```

**UI Elements:**
- Summary cards with aggregate statistics
- Table showing per-site challenge statistics
- Challenge type breakdown (pie chart)
- Solve rate trend chart (line chart)
- Warning indicators for low solve rates
- Time range filter

### 3. Admin Scraping Metrics Dashboard

**Location:** `app/admin/scraping-metrics/page.tsx`

**Component Structure:**
```typescript
interface ScrapingMetrics {
  site: string;
  tenant: string;
  totalRequests: number;
  successfulRequests: number;
  blockedRequests: number;
  successRate: number;
  blockRate: number;
  avgResponseTime: number;
  lastScrapeAt: Date;
}

interface MetricsSummary {
  totalRequests: number;
  avgSuccessRate: number;
  avgBlockRate: number;
  activeSites: number;
}
```

**UI Elements:**
- Summary cards with platform-wide metrics
- Table with per-site metrics and status indicators
- Success rate trend chart
- Block rate trend chart
- Time range selector
- Export button (CSV/JSON)
- Drill-down to site details

### 4. Tenant Metrics Dashboard

**Location:** `app/tenant/metrics/page.tsx`

**Component Structure:**
```typescript
interface TenantMetrics {
  overallSuccessRate: number;
  overallBlockRate: number;
  totalRequests: number;
  avgResponseTime: number;
  sites: {
    domain: string;
    successRate: number;
    blockRate: number;
    lastSync: Date;
    status: 'healthy' | 'degraded' | 'critical';
    challenges: {
      detected: number;
      solved: number;
    };
  }[];
}
```

**UI Elements:**
- Overview cards with tenant-wide metrics
- Site health status cards with visual indicators
- Recommendations panel for sites with issues
- Challenge detection summary
- Time range filter
- Status legend

### 5. Admin Human Simulation Settings

**Location:** `app/admin/human-simulation/page.tsx`

**Component Structure:**
```typescript
interface HumanSimulationConfig {
  typing: {
    minDelay: number;
    maxDelay: number;
  };
  actionPause: {
    minDelay: number;
    maxDelay: number;
  };
  mouseMovement: {
    enabled: boolean;
    naturalCurves: boolean;
  };
  formInteraction: {
    pauseBetweenFields: number;
    simulateCorrections: boolean;
  };
}
```

**UI Elements:**
- Form with input fields for each setting
- Range sliders with min/max values
- Recommended value indicators
- Save button with validation
- Reset to defaults button
- Preview/test simulation button

### 6. Admin Site Profile Management

**Location:** `app/admin/site-profiles/page.tsx`

**Component Structure:**
```typescript
interface SiteProfile {
  id: string;
  domain: string;
  rateLimit: {
    requestsPerMinute: number;
    concurrentRequests: number;
  };
  adaptiveDelay: {
    min: number;
    max: number;
    multiplier: number;
  };
  sessionWarmup: {
    enabled: boolean;
    paths: string[];
  };
  referrerChain: boolean;
}
```

**UI Elements:**
- List of configured profiles with edit/delete actions
- Add new profile button
- Profile editor modal/drawer
- Template selector (Cloudflare, PerimeterX, DataDome)
- Form validation with error messages
- Save and apply button

### 7. Real-Time Scraping Monitor

**Location:** `app/admin/scraping-monitor/page.tsx`

**Component Structure:**
```typescript
interface ActiveSession {
  id: string;
  site: string;
  tenant: string;
  startTime: Date;
  requestsCompleted: number;
  requestsTotal: number;
  status: 'running' | 'waiting_challenge' | 'completed' | 'failed';
  currentProxy: string | null;
  challengeType: string | null;
  challengeStatus: 'waiting' | 'solved' | 'failed' | null;
}

interface MonitorStats {
  activeSessions: number;
  requestsPerMinute: number;
  avgSessionDuration: number;
}
```

**UI Elements:**
- Stats cards with real-time metrics
- Table of active sessions with live updates
- Status indicators with animations
- Auto-refresh toggle (default: 5 seconds)
- Session detail modal
- Filter by tenant/site

### 8. Tenant Site Configuration

**Location:** `app/tenant/site-config/page.tsx`

**Component Structure:**
```typescript
interface TenantSiteConfig {
  siteId: string;
  domain: string;
  sessionWarmup: boolean;
  delays: {
    min: number;
    max: number;
  };
  allowedRanges: {
    minDelay: number;
    maxDelay: number;
  };
}
```

**UI Elements:**
- List of tenant sites
- Configuration form for each site
- Toggle for session warmup
- Delay range sliders with constraints
- Impact preview (estimated speed vs stealth)
- Save button with validation

## Data Models

### Database Schema Extensions

```prisma
// Already exists in schema
model ScrapingMetrics {
  id              String   @id @default(cuid())
  site            String
  timestamp       DateTime
  totalRequests   Int
  successfulRequests Int
  blockedRequests Int
  avgResponseTime Float
  createdAt       DateTime @default(now())
  
  @@index([site, timestamp])
}

model ProxyMetrics {
  id              String   @id @default(cuid())
  proxyUrl        String
  timestamp       DateTime
  successCount    Int
  failureCount    Int
  avgResponseTime Float
  createdAt       DateTime @default(now())
  
  @@index([proxyUrl, timestamp])
}

model ProxyHealth {
  id              String   @id @default(cuid())
  proxyUrl        String   @unique
  proxyType       String
  isHealthy       Boolean
  successCount    Int
  failureCount    Int
  lastChecked     DateTime
  updatedAt       DateTime @updatedAt
}

// New models needed
model ChallengeAttempt {
  id              String   @id @default(cuid())
  site            String
  challengeType   String
  solved          Boolean
  duration        Int
  timestamp       DateTime @default(now())
  
  @@index([site, timestamp])
  @@index([challengeType, timestamp])
}

model SiteProfile {
  id                    String   @id @default(cuid())
  domain                String   @unique
  requestsPerMinute     Int      @default(10)
  concurrentRequests    Int      @default(2)
  minDelay              Int      @default(1000)
  maxDelay              Int      @default(3000)
  delayMultiplier       Float    @default(1.0)
  sessionWarmupEnabled  Boolean  @default(false)
  sessionWarmupPaths    String[] @default([])
  referrerChainEnabled  Boolean  @default(true)
  createdAt             DateTime @default(now())
  updatedAt             DateTime @updatedAt
}

model Alert {
  id              String   @id @default(cuid())
  severity        String   // 'critical', 'warning', 'info'
  type            String   // 'high_block_rate', 'proxy_failure', 'low_solve_rate'
  message         String
  site            String?
  proxyUrl        String?
  acknowledged    Boolean  @default(false)
  acknowledgedAt  DateTime?
  createdAt       DateTime @default(now())
  
  @@index([acknowledged, createdAt])
}

model HumanSimulationConfig {
  id                      String   @id @default(cuid())
  typingMinDelay          Int      @default(50)
  typingMaxDelay          Int      @default(150)
  actionPauseMin          Int      @default(100)
  actionPauseMax          Int      @default(2000)
  mouseMovementEnabled    Boolean  @default(true)
  naturalCurvesEnabled    Boolean  @default(true)
  pauseBetweenFields      Int      @default(500)
  simulateCorrections     Boolean  @default(true)
  updatedAt               DateTime @updatedAt
}
```


## API Endpoints

### Admin Endpoints

#### GET /api/v1/admin/proxy-health
**Query Parameters:**
- `timeRange`: '24h' | '7d' | '30d' (optional, default: '24h')

**Response:**
```typescript
{
  stats: ProxyHealthStats;
  proxies: ProxyHealthData[];
}
```

#### GET /api/v1/admin/challenge-stats
**Query Parameters:**
- `timeRange`: '24h' | '7d' | '30d' (optional, default: '24h')

**Response:**
```typescript
{
  summary: ChallengeSummary;
  sites: ChallengeStats[];
}
```

#### GET /api/v1/admin/scraping-metrics
**Query Parameters:**
- `timeRange`: '24h' | '7d' | '30d' (optional, default: '24h')

**Response:**
```typescript
{
  summary: MetricsSummary;
  sites: ScrapingMetrics[];
}
```

#### GET /api/v1/admin/active-sessions
**Response:**
```typescript
{
  stats: MonitorStats;
  sessions: ActiveSession[];
}
```

#### GET /api/v1/admin/human-simulation-config
**Response:**
```typescript
{
  config: HumanSimulationConfig;
}
```

#### POST /api/v1/admin/human-simulation-config
**Request Body:**
```typescript
{
  config: HumanSimulationConfig;
}
```

**Response:**
```typescript
{
  success: boolean;
  errors?: string[];
  config: HumanSimulationConfig;
}
```

#### GET /api/v1/admin/site-profiles
**Response:**
```typescript
{
  profiles: SiteProfile[];
  templates: {
    name: string;
    profile: Partial<SiteProfile>;
  }[];
}
```

#### POST /api/v1/admin/site-profiles
**Request Body:**
```typescript
{
  profile: SiteProfile;
}
```

**Response:**
```typescript
{
  success: boolean;
  errors?: string[];
  profile: SiteProfile;
}
```

#### DELETE /api/v1/admin/site-profiles/:id
**Response:**
```typescript
{
  success: boolean;
}
```

#### GET /api/v1/admin/alerts
**Query Parameters:**
- `acknowledged`: boolean (optional)
- `severity`: 'critical' | 'warning' | 'info' (optional)

**Response:**
```typescript
{
  alerts: Alert[];
  unacknowledgedCount: number;
}
```

#### POST /api/v1/admin/alerts/:id/acknowledge
**Response:**
```typescript
{
  success: boolean;
  alert: Alert;
}
```

### Tenant Endpoints

#### GET /api/v1/tenant/scraping-metrics
**Query Parameters:**
- `timeRange`: '24h' | '7d' | '30d' (optional, default: '24h')

**Response:**
```typescript
{
  metrics: TenantMetrics;
}
```

#### GET /api/v1/tenant/site-config
**Response:**
```typescript
{
  sites: TenantSiteConfig[];
}
```

#### PATCH /api/v1/tenant/site-config/:siteId
**Request Body:**
```typescript
{
  sessionWarmup: boolean;
  delays: {
    min: number;
    max: number;
  };
}
```

**Response:**
```typescript
{
  success: boolean;
  errors?: string[];
  config: TenantSiteConfig;
}
```

## Error Handling

### API Error Responses

All API endpoints follow a consistent error response format:

```typescript
{
  error: string;
  message: string;
  details?: any;
}
```

**HTTP Status Codes:**
- 200: Success
- 400: Bad Request (validation errors)
- 401: Unauthorized
- 403: Forbidden
- 404: Not Found
- 500: Internal Server Error

### Frontend Error Handling

- Display user-friendly error messages using toast notifications
- Show inline validation errors in forms
- Provide retry mechanisms for failed API calls
- Log errors to console for debugging
- Graceful degradation when data is unavailable

## Testing Strategy

### Unit Tests

**Components to Test:**
- API route handlers (request validation, response formatting)
- Data transformation functions (metrics calculations, aggregations)
- Form validation logic
- Time range filtering logic

**Test Cases:**
- Valid and invalid API requests
- Edge cases (empty data, missing fields)
- Error scenarios (database failures, service unavailable)
- Data formatting and calculations

### Integration Tests

**Scenarios to Test:**
- End-to-end dashboard data flow (API → UI)
- Form submission and validation
- Real-time updates and polling
- Authentication and authorization
- Data export functionality

### Property-Based Tests

Not applicable for UI components. Focus on unit and integration tests.

## Performance Considerations

### Data Loading

- Implement pagination for large datasets (proxy lists, metrics tables)
- Use server-side filtering and sorting where possible
- Cache frequently accessed data (site profiles, configuration)
- Implement incremental loading for charts

### Real-Time Updates

- Use polling with configurable intervals (default: 5 seconds for monitor, 30 seconds for dashboards)
- Implement WebSocket connections for true real-time updates (future enhancement)
- Debounce user input in forms
- Optimize re-renders using React.memo and useMemo

### Chart Rendering

- Use lightweight charting library (recharts or chart.js)
- Limit data points displayed (aggregate older data)
- Lazy load charts (render only when visible)
- Use canvas-based rendering for large datasets

## Security Considerations

### Authentication & Authorization

- All admin endpoints require admin role verification
- Tenant endpoints require tenant authentication and scope validation
- Use existing authentication middleware
- Validate tenant ownership for tenant-specific data

### Input Validation

- Validate all form inputs on both client and server
- Sanitize user input to prevent XSS
- Validate time ranges and numeric inputs
- Enforce rate limits on configuration updates

### Data Access

- Tenants can only access their own data
- Admins can access all data but actions are logged
- Sensitive proxy credentials are masked in UI
- API keys and tokens are never exposed to frontend

## Deployment Considerations

### Database Migrations

- Create Prisma migration for new models (ChallengeAttempt, SiteProfile, Alert, HumanSimulationConfig)
- Ensure backward compatibility with existing data
- Add indexes for performance-critical queries

### Environment Variables

No new environment variables required. Uses existing configuration.

### Rollout Strategy

1. Deploy database migrations
2. Deploy API endpoints
3. Deploy admin panel pages
4. Deploy tenant panel pages
5. Monitor for errors and performance issues
6. Gather user feedback and iterate

## Future Enhancements

- WebSocket-based real-time updates
- Advanced filtering and search capabilities
- Custom dashboard builder
- Email/Slack notifications for alerts
- Historical data comparison
- Predictive analytics for block rate trends
- Mobile app for monitoring
- API rate limiting and throttling
- Bulk operations for site profiles
- A/B testing for different stealth configurations

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Proxy Information Completeness
*For any* proxy displayed in the admin panel, the rendered output should contain proxy URL, type, health status, and last checked time.
**Validates: Requirements 1.2**

### Property 2: Proxy Metrics Completeness
*For any* proxy metrics displayed, the output should include success count, failure count, success rate percentage, and average response time.
**Validates: Requirements 1.3**

### Property 3: Unhealthy Proxy Highlighting
*For any* proxy marked as unhealthy, the UI should include a critical status indicator.
**Validates: Requirements 1.4**

### Property 4: Proxy Time Range Filtering
*For any* time range selection, the displayed proxy metrics should only include data from that period.
**Validates: Requirements 1.5**

### Property 5: Proxy Count Accuracy
*For any* set of proxies, the displayed total count, healthy count, and unhealthy count should match the actual data.
**Validates: Requirements 1.7**

### Property 6: Challenge Data Completeness
*For any* challenge statistics displayed, the output should include site domain, total challenges, challenges solved, and solve rate percentage.
**Validates: Requirements 2.2**

### Property 7: Challenge Type Breakdown
*For any* challenge statistics, there should be a breakdown by challenge type with counts and solve rates.
**Validates: Requirements 2.3**

### Property 8: Low Solve Rate Warning
*For any* site with solve rate below threshold, the UI should display a warning indicator.
**Validates: Requirements 2.4**

### Property 9: Challenge Time Range Filtering
*For any* time range selection, the displayed challenge statistics should only include data from that period.
**Validates: Requirements 2.5**

### Property 10: Challenge Aggregate Accuracy
*For any* set of challenge data, the aggregate statistics (total challenges, average solve rate) should be calculated correctly.
**Validates: Requirements 2.6**

### Property 11: Site Metrics Completeness
*For any* site metrics displayed, the output should include total requests, successful requests, blocked requests, success rate, and block rate.
**Validates: Requirements 3.2**

### Property 12: High Block Rate Highlighting
*For any* site with block rate exceeding threshold, the UI should display a critical status indicator.
**Validates: Requirements 3.4**

### Property 13: Metrics Aggregate Accuracy
*For any* set of site metrics, the aggregate total requests and average success rate should be calculated correctly.
**Validates: Requirements 3.5**

### Property 14: Tenant Data Isolation
*For any* tenant viewing their metrics dashboard, only their configured sites should be visible in the data.
**Validates: Requirements 4.1**

### Property 15: Tenant Metrics Completeness
*For any* tenant metrics displayed, the output should include success rate, block rate, total requests, and average response time.
**Validates: Requirements 4.2**

### Property 16: Tenant Site Metrics Completeness
*For any* site in tenant view, the output should include per-site success rate and last sync time.
**Validates: Requirements 4.3**

### Property 17: Issue Recommendations Display
*For any* metrics indicating issues (high block rate, low success rate), actionable recommendations should be displayed.
**Validates: Requirements 4.4**

### Property 18: Tenant Site Status Indicators
*For any* site in tenant view, a status indicator (healthy, degraded, critical) should be present.
**Validates: Requirements 4.6**

### Property 19: Tenant Challenge Statistics Display
*For any* tenant with configured sites, challenge detection statistics should be displayed.
**Validates: Requirements 4.7**

### Property 20: Configuration Validation Errors
*For any* invalid input in human simulation settings, validation errors should be displayed.
**Validates: Requirements 5.5**

### Property 21: Configuration Update Application
*For any* successful configuration save, the changes should be applied to the system via API call.
**Validates: Requirements 5.6**

### Property 22: Recommended Ranges Display
*For any* human simulation setting, recommended ranges should be displayed in the UI.
**Validates: Requirements 5.7**

### Property 23: Site Profile Validation Errors
*For any* invalid site profile configuration, validation errors should be displayed.
**Validates: Requirements 6.5**

### Property 24: Site Profile Update Application
*For any* saved site profile, the changes should be applied immediately via API call.
**Validates: Requirements 6.7**

### Property 25: Active Session Information Completeness
*For any* active scraping session displayed, the output should include site domain, tenant name, start time, requests completed, and current status.
**Validates: Requirements 7.2**

### Property 26: Session Challenge Information Display
*For any* session encountering a challenge, the challenge type and status should be displayed.
**Validates: Requirements 7.3**

### Property 27: Session Proxy Information Display
*For any* session using a proxy, the proxy URL and health status should be displayed.
**Validates: Requirements 7.4**

### Property 28: Session Auto-Refresh
*For any* real-time monitor page, session data should be refreshed every 5 seconds without full page reload.
**Validates: Requirements 7.5**

### Property 29: Session Status Updates
*For any* session state change (completed, failed), the UI should update to reflect the new status.
**Validates: Requirements 7.6**

### Property 30: Session Aggregate Statistics Accuracy
*For any* set of active sessions, the aggregate statistics (total sessions, requests per minute) should be calculated correctly.
**Validates: Requirements 7.7**

### Property 31: API Error Response Format
*For any* API error, the response should include appropriate HTTP status code and error message.
**Validates: Requirements 8.10**

### Property 32: Visual Indicator Text Alternatives
*For any* visual status indicator, there should be a text alternative for accessibility.
**Validates: Requirements 9.7**

### Property 33: Export Data Completeness
*For any* data export, the exported data should match all visible data based on current filters.
**Validates: Requirements 10.4**

### Property 34: Export Filename Format
*For any* data export, the filename should include timestamp and data type.
**Validates: Requirements 10.5**

### Property 35: Export Audit Logging
*For any* export action, a log entry should be created in the system.
**Validates: Requirements 10.7**

### Property 36: Tenant Delay Range Constraints
*For any* delay configuration in tenant panel, the input values should be constrained to allowed ranges.
**Validates: Requirements 11.3**

### Property 37: Tenant Configuration Plan Validation
*For any* tenant configuration save, validation should check against tenant plan limits.
**Validates: Requirements 11.4**

### Property 38: Tenant Configuration Display Completeness
*For any* site configuration in tenant panel, current values and recommended settings should be displayed.
**Validates: Requirements 11.5**

### Property 39: Tenant Configuration Persistence
*For any* saved tenant configuration, the changes should be persisted and applied to future scraping sessions.
**Validates: Requirements 11.6**

### Property 40: Configuration Impact Preview
*For any* tenant site configuration, a preview showing impact on scraping speed and stealth should be calculated and displayed.
**Validates: Requirements 11.7**

### Property 41: High Block Rate Alert Creation
*For any* site with block rate exceeding threshold, an alert should be created and visible in the admin panel.
**Validates: Requirements 12.1**

### Property 42: Low Solve Rate Alert Creation
*For any* site with challenge solve rate below threshold, a warning alert should be created.
**Validates: Requirements 12.3**

### Property 43: Alert Information Completeness
*For any* alert displayed, the output should include severity, message, affected site or proxy, and timestamp.
**Validates: Requirements 12.4**

### Property 44: Alert Acknowledgment State Update
*For any* alert acknowledgment action, the alert should be marked as acknowledged and the UI should update.
**Validates: Requirements 12.5**

### Property 45: Unacknowledged Alert Count Accuracy
*For any* set of alerts, the unacknowledged count displayed in navigation should match the actual count.
**Validates: Requirements 12.6**

### Property 46: Alert Persistence
*For any* alert created, it should be persisted to the database for historical review.
**Validates: Requirements 12.7**
