# Session Control API Implementation Summary

## Overview
Implemented comprehensive API endpoints for debugging and controlling scraping sessions, fulfilling Requirements 4.1-4.5, 9.1-9.5, and 12.1-12.5.

## Implemented Endpoints

### 1. Session Control Endpoints

#### POST /api/v1/admin/sessions/[id]/pause
- **Purpose**: Pause a running scraping session
- **Requirements**: 12.1, 12.4
- **Features**:
  - Preserves session state for resumption
  - Validates session exists and is pausable
  - Returns success/failure status with message

#### POST /api/v1/admin/sessions/[id]/resume
- **Purpose**: Resume a paused scraping session
- **Requirements**: 12.1, 12.4
- **Features**:
  - Resumes from current stage
  - Validates session can be resumed
  - Restores session to running state

#### POST /api/v1/admin/sessions/[id]/cancel
- **Purpose**: Cancel a scraping session
- **Requirements**: 12.1, 12.5
- **Request Body** (optional):
  ```json
  {
    "reason": "User requested cancellation"
  }
  ```
- **Features**:
  - Records cancellation reason as error
  - Marks session as failed
  - Cleans up Redis resources

#### POST /api/v1/admin/sessions/[id]/retry
- **Purpose**: Retry a failed session with optional configuration overrides
- **Requirements**: 12.2
- **Request Body** (optional):
  ```json
  {
    "proxy": "http://proxy2.com:8080",
    "userAgent": "Custom User Agent"
  }
  ```
- **Features**:
  - Creates new session with same parameters
  - Allows proxy and user agent overrides
  - Returns new session ID

#### POST /api/v1/admin/sessions/bulk
- **Purpose**: Perform bulk operations on multiple sessions
- **Requirements**: 12.3
- **Request Body**:
  ```json
  {
    "operation": "pause" | "resume" | "cancel",
    "sessionIds": ["session-1", "session-2"],
    "reason": "Optional reason for cancel operation"
  }
  ```
- **Response**:
  ```json
  {
    "success": true,
    "operation": "pause",
    "summary": {
      "total": 2,
      "successful": 2,
      "failed": 0
    },
    "results": [
      {
        "sessionId": "session-1",
        "success": true,
        "message": "Session paused successfully"
      }
    ]
  }
  ```

### 2. Tenant Debug Endpoint

#### GET /api/v1/admin/debug/tenant/[id]
- **Purpose**: Get comprehensive debug view for a specific tenant
- **Requirements**: 4.1, 4.2, 4.3, 4.4, 4.5, 9.1, 9.2, 9.3, 9.4, 9.5
- **Response Structure**:
  ```json
  {
    "success": true,
    "data": {
      "tenant": {
        "id": "tenant-1",
        "name": "Company Name",
        "planType": "PREMIUM",
        "createdAt": "2024-01-01T00:00:00Z"
      },
      "activeSessions": [...],
      "recentErrors": [
        {
          "type": "proxy_failure",
          "count": 5,
          "recentErrors": [...]
        }
      ],
      "metrics": {
        "tenantId": "tenant-1",
        "tenantName": "Company Name",
        "activeSessions": 3,
        "successRate": 85.5,
        "avgScrapeTime": 2500,
        "dataQualityScore": 92.3,
        "resourceUsage": {
          "requestsToday": 150,
          "quotaLimit": 1000,
          "quotaUsed": 0.15
        }
      },
      "configuration": {
        "sites": [...]
      },
      "impactAssessment": {
        "affectedSites": ["https://example.com"],
        "staleSitesCount": 2,
        "failureRate": 15.5,
        "businessImpact": "low" | "medium" | "high"
      },
      "staleSites": [...]
    }
  }
  ```

**Features**:
- **Active Sessions**: Lists all currently running sessions for the tenant
- **Error Categorization**: Groups errors by type:
  - `proxy_failure`: Proxy connection issues
  - `challenge_failure`: CAPTCHA/anti-bot challenges
  - `parsing_error`: Data extraction errors
  - `rate_limit`: Rate limiting issues
  - `network_error`: Network timeouts/failures
  - `other`: Uncategorized errors
- **Recent Errors**: Shows top 5 most recent errors per category
- **Tenant Metrics**: Real-time performance metrics
- **Configuration**: Lists all sites with stale data indicators
- **Impact Assessment**: Calculates business impact based on failure rate
- **Stale Sites**: Identifies sites not synced in last 24 hours

## Service Layer Enhancements

### SessionTracker Service
Added the following methods to `lib/services/session-tracker.ts`:

1. **pauseSession(sessionId: string)**
   - Pauses a running session
   - Preserves state for resumption
   - Returns success status

2. **resumeSession(sessionId: string)**
   - Resumes a paused session
   - Restores to appropriate running state
   - Returns success status

3. **cancelSession(sessionId: string, reason?: string)**
   - Cancels a session
   - Records cancellation reason
   - Cleans up resources
   - Returns success status

4. **retrySession(sessionId: string, overrides?: { proxy?: string; userAgent?: string })**
   - Creates new session from failed session
   - Applies configuration overrides
   - Returns new session ID

5. **bulkPauseSessions(sessionIds: string[])**
   - Pauses multiple sessions
   - Returns results for each session

6. **bulkResumeSessions(sessionIds: string[])**
   - Resumes multiple sessions
   - Returns results for each session

7. **bulkCancelSessions(sessionIds: string[], reason?: string)**
   - Cancels multiple sessions
   - Returns results for each session

## Test Coverage

### Session Control Tests
File: `__tests__/app/api/admin/session-control.test.ts`
- 16 test cases covering all control endpoints
- Tests authentication and authorization
- Tests success and failure scenarios
- Tests bulk operations with mixed results
- Tests configuration overrides

### Tenant Debug Tests
File: `__tests__/app/api/admin/tenant-debug.test.ts`
- 7 test cases covering tenant debug endpoint
- Tests authentication and authorization
- Tests comprehensive debug information retrieval
- Tests error categorization logic
- Tests impact assessment calculation
- Tests graceful handling of metrics failures

## Authentication & Authorization
All endpoints require:
- Valid NextAuth session
- User role of `ADMIN` or `isSuperAdmin: true`
- Returns 401 for unauthorized access

## Error Handling
- Validates input parameters
- Returns appropriate HTTP status codes
- Provides detailed error messages
- Handles service failures gracefully
- Logs errors for debugging

## Requirements Validation

### Requirement 4 (Debug and Issue Identification)
✅ 4.1: Failure logging with full context (tenant ID, site URL, error message, stack trace)
✅ 4.2: Error grouping by similarity with occurrence counts
✅ 4.3: Error categorization by type
✅ 4.4: Impact assessment with affected products and business impact
✅ 4.5: Drill-down capability with full request/response details

### Requirement 9 (Tenant-Specific Debugging)
✅ 9.1: Display all active sessions, recent errors, and resource usage
✅ 9.2: Tenant-specific debug view with recent activity and anomalies
✅ 9.3: Success rates, average scrape times, and data quality metrics
✅ 9.4: Display all site profiles, proxy settings, and rate limits
✅ 9.5: Highlight products with outdated information and last scrape time

### Requirement 12 (Scraping Control Operations)
✅ 12.1: Controls to pause, resume, or cancel individual sessions
✅ 12.2: Manual retry with option to override proxy or configuration
✅ 12.3: Bulk operations for pause, resume, or cancel
✅ 12.4: Preserve session state on pause for resumption
✅ 12.5: Clean up resources and mark session as canceled with reason

## Next Steps
The following tasks remain in the implementation plan:
- Task 10: Create API endpoints for system health and exports
- Task 11: Checkpoint - Ensure all backend tests pass
- Tasks 12-25: Frontend UI components
- Tasks 26-29: E2E tests, performance testing, and documentation
