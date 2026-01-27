# Admin Dashboard Enhancement - Data Layer

This directory contains the data layer implementation for the Admin Dashboard Enhancement feature.

## Overview

The data layer provides database schema, Redis data structures, and repository services for:
- Real-time scraping session tracking
- Proxy simulation results
- System alerts and notifications

## Database Schema

### New Tables

#### ScrapingSession
Tracks all scraping sessions with complete lifecycle information.

**Fields:**
- `id`: Unique session identifier
- `tenantId`: Tenant who owns the session
- `tenantName`: Tenant display name
- `siteUrl`: Target site URL
- `targetUrl`: Specific page being scraped
- `status`: Session status (initializing, running, waiting_challenge, completed, failed)
- `currentStage`: Current lifecycle stage (proxy_selection, navigation, challenge_detection, challenge_solving, data_extraction, validation)
- `proxyUsed`: Proxy URL being used
- `userAgent`: User agent string
- `requestsCompleted`: Number of completed requests
- `requestsTotal`: Total requests planned
- `challengeType`: Type of challenge encountered (if any)
- `challengeStatus`: Challenge solving status
- `extractedData`: Extracted data (JSON)
- `errors`: Array of error objects (JSON)
- `metrics`: Session metrics (JSON)
- `startTime`: Session start timestamp
- `endTime`: Session end timestamp

**Indexes:**
- `tenantId` - for filtering by tenant
- `status` - for filtering by status
- `startTime` - for time-based queries

**Retention:** 30 days (configurable)

#### SimulationResult
Stores proxy simulation results for testing and analysis.

**Fields:**
- `id`: Unique simulation identifier
- `scenario`: Simulation scenario type
- `config`: Simulation configuration (JSON)
- `requests`: Array of request results (JSON)
- `summary`: Summary statistics (JSON)
- `recommendations`: Array of recommendations (JSON)
- `startTime`: Simulation start timestamp
- `endTime`: Simulation end timestamp

**Indexes:**
- `scenario` - for filtering by scenario type
- `createdAt` - for time-based queries

**Retention:** 30 days (configurable)

#### SystemAlert
Stores system alerts and notifications for administrators.

**Fields:**
- `id`: Unique alert identifier
- `alertType`: Type of alert (component_failure, performance_degradation, etc.)
- `severity`: Alert severity (critical, warning, info)
- `title`: Alert title
- `message`: Alert message
- `context`: Additional context data (JSON)
- `acknowledged`: Whether alert has been acknowledged
- `acknowledgedAt`: Acknowledgment timestamp
- `acknowledgedBy`: User who acknowledged

**Indexes:**
- `acknowledged` - for filtering unacknowledged alerts
- `createdAt` - for time-based queries
- `severity` - for filtering by severity

**Retention:** 30 days for acknowledged alerts (configurable)

## Redis Data Structures

### Active Sessions (Hash)
**Key Pattern:** `session:{sessionId}`

**Fields:**
- `tenantId`
- `status`
- `currentStage`
- `proxyUsed`
- `startTime`
- `metrics` (JSON string)

**TTL:** 1 hour

### Session Index by Tenant (Set)
**Key Pattern:** `tenant:{tenantId}:sessions`

**Members:** Set of session IDs

**TTL:** 1 hour

### Real-Time Metrics (Hash)
**Key Pattern:** `metrics:realtime`

**Fields:**
- `activeSessions`
- `requestsPerMinute`
- `avgResponseTime`
- `lastUpdated`

**TTL:** 5 minutes

## Repository Services

### SessionRepository
**File:** `lib/services/session-repository.ts`

**Methods:**
- `createSession(data)` - Create new session
- `updateSession(sessionId, updates)` - Update session
- `getSession(sessionId)` - Get session by ID
- `getActiveSessions(filters)` - Get active sessions
- `getSessionHistory(filters)` - Get session history
- `deleteOldSessions(olderThanDays)` - Cleanup old sessions
- `getSessionCountByStatus(tenantId)` - Get session counts

### SimulationRepository
**File:** `lib/services/simulation-repository.ts`

**Methods:**
- `createSimulation(data)` - Create simulation result
- `getSimulation(simulationId)` - Get simulation by ID
- `listSimulations(limit, scenario)` - List recent simulations
- `deleteOldSimulations(olderThanDays)` - Cleanup old simulations
- `getSimulationCountByScenario()` - Get simulation counts

### AlertRepository
**File:** `lib/services/alert-repository.ts`

**Methods:**
- `createAlert(data)` - Create new alert
- `getAlert(alertId)` - Get alert by ID
- `getUnacknowledgedAlerts(severity)` - Get unacknowledged alerts
- `getRecentAlerts(limit, acknowledged)` - Get recent alerts
- `acknowledgeAlert(alertId, acknowledgedBy)` - Acknowledge alert
- `acknowledgeAlerts(alertIds, acknowledgedBy)` - Bulk acknowledge
- `deleteOldAlerts(olderThanDays)` - Cleanup old alerts
- `getAlertCountBySeverity(acknowledged)` - Get alert counts

### RedisSessionManager
**File:** `lib/services/redis-session-manager.ts`

**Methods:**
- `setSession(sessionId, data)` - Store session in Redis
- `getSession(sessionId)` - Get session from Redis
- `updateSession(sessionId, updates)` - Update session fields
- `deleteSession(sessionId, tenantId)` - Delete session
- `getTenantSessions(tenantId)` - Get all sessions for tenant
- `getAllActiveSessions()` - Get all active session IDs
- `setMetrics(metrics)` - Store real-time metrics
- `getMetrics()` - Get real-time metrics
- `clearAllSessions()` - Clear all session data (testing)

## Type Definitions

**File:** `lib/types/admin-dashboard.ts`

Comprehensive TypeScript types for:
- Session data and states
- Simulation configurations and results
- System alerts
- Dashboard metrics
- Filters and queries

## Usage Examples

### Creating a Session
```typescript
import { sessionRepository } from '@/lib/services/session-repository';

const session = await sessionRepository.createSession({
  id: 'session-123',
  tenantId: 'tenant-456',
  tenantName: 'Acme Corp',
  siteUrl: 'https://example.com',
  targetUrl: 'https://example.com/product/123',
  status: 'initializing',
  currentStage: 'proxy_selection',
});
```

### Storing Session in Redis
```typescript
import { redisSessionManager } from '@/lib/services/redis-session-manager';

await redisSessionManager.setSession(sessionId, {
  tenantId: session.tenantId,
  status: session.status,
  currentStage: session.currentStage,
  proxyUsed: null,
  startTime: session.startTime.toISOString(),
  metrics: JSON.stringify(session.metrics),
});
```

### Creating an Alert
```typescript
import { alertRepository } from '@/lib/services/alert-repository';

const alert = await alertRepository.createAlert({
  alertType: 'component_failure',
  severity: 'critical',
  title: 'Database Connection Failed',
  message: 'Unable to connect to PostgreSQL database',
  context: { error: 'Connection timeout' },
});
```

## Migration

The database migration was created and applied:
- **Migration:** `20260127053603_add_admin_dashboard_tables`
- **Location:** `prisma/migrations/20260127053603_add_admin_dashboard_tables/migration.sql`

To apply the migration in other environments:
```bash
npx prisma migrate deploy
```

## Testing

Verify the schema setup:
```bash
npx tsx lib/services/admin-dashboard/verify-schema.ts
```

## Next Steps

This data layer provides the foundation for:
1. SessionTracker service (Task 2)
2. ProxySimulator service (Task 4)
3. MetricsAggregator service (Task 5)
4. Real-time monitoring APIs (Task 6-10)
5. Admin UI components (Task 12-18)
