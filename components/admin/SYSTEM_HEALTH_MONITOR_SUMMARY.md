# SystemHealthMonitor Component Summary

## Overview
The SystemHealthMonitor component provides comprehensive system health monitoring, diagnostic execution, and alert management capabilities for the admin dashboard. It displays real-time status of critical system components, allows running diagnostics, and manages system alerts.

## Requirements Addressed
- **11.1**: Display status for database, Redis cache, proxy pool (browser pool), and circuit breakers
- **11.2**: Alert admin immediately when system components fail with severity level and impact assessment
- **11.3**: Show response times, throughput, error rates, and resource utilization
- **11.4**: Warn admin when capacity limits are approached with current usage
- **11.5**: Execute connectivity tests, latency checks, and functional validation for all components

## Features

### 1. Overall System Status
- Visual indicator showing overall system health (healthy/degraded/unhealthy)
- Summary message describing system state
- Status badge for quick identification
- Last refresh timestamp

### 2. Component Status Display
Monitors four critical system components:
- **Database**: Connection status, query performance, response time
- **Redis Cache**: Connection status, ping latency, read/write operations
- **Browser Pool**: Usage statistics, capacity monitoring
- **Circuit Breakers**: State monitoring (open/closed/half-open)

Each component card shows:
- Status indicator (healthy/degraded/unhealthy)
- Component-specific metrics
- Response times
- Usage statistics with progress bars
- Detailed information in expandable sections

### 3. Alert Management
- Display of unacknowledged system alerts
- Severity-based categorization (critical/warning/info)
- Alert details including:
  - Alert type and title
  - Descriptive message
  - Timestamp
  - Context information
- One-click alert acknowledgment
- Badge showing count of active alerts

### 4. Diagnostic Execution
- On-demand comprehensive system diagnostics
- Four diagnostic categories:
  - **Database Tests**: Connection, query performance, table accessibility
  - **Redis Tests**: Ping, read/write operations, memory info
  - **Connectivity Tests**: Internal service connectivity
  - **Performance Tests**: Database and Redis latency measurements

Diagnostic results include:
- Overall status per category (passed/failed/warning)
- Individual test results with status indicators
- Execution time for each test
- Error messages for failed tests
- Total diagnostic execution time

### 5. Auto-Refresh
- Configurable refresh interval (default: 30 seconds)
- Automatic polling for health status and alerts
- Manual refresh button for immediate updates
- Loading states during data fetching

## Component Structure

```
SystemHealthMonitor
├── Header (title, last refresh, action buttons)
├── Overall Status Card
└── Tabs
    ├── Components Tab
    │   └── Component Cards (Database, Redis, Browser Pool, Circuit Breakers)
    ├── Alerts Tab
    │   └── Alert Cards (with acknowledgment)
    └── Diagnostics Tab
        ├── Diagnostic Summary
        └── Detailed Test Results
```

## API Endpoints Used

### Health Check
- **GET** `/api/v1/admin/health`
- Returns comprehensive system health status
- Includes all component health checks

### Alerts
- **GET** `/api/v1/admin/alerts?acknowledged=false`
- Returns unacknowledged system alerts
- Supports filtering by severity and acknowledgment status

### Acknowledge Alert
- **POST** `/api/v1/admin/alerts/[id]/acknowledge`
- Marks an alert as acknowledged
- Records who acknowledged and when

### Diagnostics
- **POST** `/api/v1/admin/diagnostics`
- Runs comprehensive system diagnostics
- Returns detailed test results for all categories

## Props

```typescript
interface SystemHealthMonitorProps {
    refreshInterval?: number; // default: 30000ms (30 seconds)
}
```

## Usage

```tsx
import { SystemHealthMonitor } from "@/components/admin/system-health-monitor";

export default function HealthPage() {
    return <SystemHealthMonitor refreshInterval={30000} />;
}
```

## Visual Design

### Status Indicators
- **Healthy**: Green background, CheckCircle2 icon
- **Degraded**: Yellow background, AlertTriangle icon
- **Unhealthy**: Red background, XCircle icon

### Alert Severity
- **Critical**: Red background, high priority
- **Warning**: Yellow background, medium priority
- **Info**: Blue background, low priority

### Diagnostic Status
- **Passed**: Green CheckCircle2 icon
- **Warning**: Yellow AlertTriangle icon
- **Failed**: Red XCircle icon

## Performance Considerations

1. **Auto-refresh**: Uses configurable polling interval to balance freshness with server load
2. **Lazy loading**: Diagnostics only run on-demand, not automatically
3. **Efficient updates**: Only fetches changed data during refresh
4. **Loading states**: Shows appropriate loading indicators during async operations

## Accessibility

- Semantic HTML structure
- ARIA labels on interactive elements
- Keyboard navigation support
- Color-blind friendly status indicators (icons + colors)
- Screen reader friendly status messages

## Future Enhancements

1. **Real-time updates**: WebSocket support for instant alert notifications
2. **Historical trends**: Charts showing component health over time
3. **Alert filtering**: Advanced filtering by type, severity, date range
4. **Diagnostic scheduling**: Automated periodic diagnostic runs
5. **Export functionality**: Export diagnostic results and alert history
6. **Performance metrics**: Detailed performance graphs and trends
7. **Capacity planning**: Predictive analytics for capacity warnings

## Related Components

- `MetricsDashboard`: Overall platform metrics and analytics
- `RealTimeMonitor`: Live scraping session monitoring
- `TenantDebugView`: Tenant-specific debugging information

## Files Created

1. `components/admin/system-health-monitor.tsx` - Main component
2. `app/api/v1/admin/alerts/route.ts` - Alerts API endpoint
3. `app/api/v1/admin/alerts/[id]/acknowledge/route.ts` - Alert acknowledgment endpoint
4. `app/admin/health/page.tsx` - Health monitoring page
5. `components/admin/SYSTEM_HEALTH_MONITOR_SUMMARY.md` - This documentation

## Testing Recommendations

### Unit Tests
- Component rendering with different health states
- Alert acknowledgment functionality
- Diagnostic execution and result display
- Auto-refresh behavior
- Error handling for API failures

### Integration Tests
- Health check API integration
- Alert fetching and acknowledgment flow
- Diagnostic execution end-to-end
- Real-time updates and polling

### Property-Based Tests
- **Property 52**: Health check completeness - verify all components are checked
- **Property 53**: Component failure alerting - verify alerts are generated for failures
- **Property 56**: Diagnostic execution completeness - verify all diagnostic tests run

## Notes

- The component uses the existing `SystemHealthService` for health checks
- Alert management uses the `AlertRepository` for database operations
- Diagnostics run comprehensive tests across all system components
- The UI is fully responsive and works on mobile devices
- Dark mode is fully supported with appropriate color schemes
