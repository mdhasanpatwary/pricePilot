---
title: "Uptime Monitoring"
description: "Monitoring system uptime and availability"
category: "system-monitoring"
author: "PricePilot Team"
lastReviewed: "2024-05-20"
tags: ["uptime", "monitoring", "availability"]
audience: "admin"
---

# System Uptime Monitoring

## Overview

PricePilot implements comprehensive uptime monitoring to ensure 99.9% system availability (SLA target). The system continuously tracks operational status, records downtime incidents, and provides detailed uptime statistics.

**SLA Target:** 99.9% uptime = maximum 43.2 minutes of downtime per month

## Architecture

### Components

1. **Uptime Tracker Service** (`lib/services/monitoring/uptime-tracker.ts`)
   - Records system heartbeats every minute
   - Tracks system status (UP, DOWN, DEGRADED)
   - Calculates uptime percentages
   - Manages downtime incidents
   - Provides SLA compliance reporting

2. **Heartbeat Cron Job** (`app/api/v1/cron/system-heartbeat/route.ts`)
   - Runs every minute via Vercel Cron
   - Performs comprehensive health checks
   - Records system status and response time
   - Detects status changes and creates incidents

3. **Uptime API** (`app/api/v1/monitoring/uptime/route.ts`)
   - Provides uptime statistics via REST API
   - Returns current status and historical data
   - Supports multiple time periods
   - Includes downtime incident details

4. **Uptime Dashboard** (`components/admin/uptime-dashboard.tsx`)
   - Visual display of uptime statistics
   - Real-time status indicator
   - SLA compliance status
   - Downtime incident history

### Database Schema

```sql
-- System uptime log (heartbeat records)
CREATE TABLE "SystemUptimeLog" (
    "id" TEXT PRIMARY KEY,
    "timestamp" TIMESTAMP NOT NULL,
    "status" TEXT NOT NULL, -- 'UP', 'DOWN', 'DEGRADED'
    "responseTime" INTEGER NOT NULL, -- milliseconds
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP NOT NULL
);

-- Downtime incidents
CREATE TABLE "DowntimeIncident" (
    "id" TEXT PRIMARY KEY,
    "startTime" TIMESTAMP NOT NULL,
    "endTime" TIMESTAMP,
    "duration" INTEGER, -- minutes
    "reason" TEXT,
    "resolved" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP NOT NULL,
    "updatedAt" TIMESTAMP NOT NULL
);
```

## System Status Types

### UP
- All critical components operational
- Database connectivity confirmed
- Response times within acceptable range
- Error rates below threshold

### DEGRADED
- System operational but with reduced performance
- Non-critical components may be unavailable
- Response times elevated but acceptable
- Error rates slightly elevated

### DOWN
- Critical components unavailable
- Database connectivity lost
- System unable to serve requests
- Requires immediate attention

## Health Checks

The heartbeat cron job performs the following checks every minute:

1. **Database Connectivity**
   - Executes test query: `SELECT 1`
   - Status: UP if successful, DOWN if failed

2. **Redis Connectivity**
   - Checks Redis configuration
   - Status: UP if configured, DEGRADED if not

3. **System Health Metrics**
   - Retrieves overall system health
   - Checks error rates and response times
   - Status: Based on monitoring dashboard health

4. **Error Rate**
   - Monitors application error count
   - Status: DEGRADED if >10 errors in 5 minutes

5. **Response Time**
   - Monitors average API response time
   - Status: DEGRADED if >1000ms average

## Uptime Calculation

### Formula

```
Uptime Percentage = (Uptime Minutes / Total Minutes) × 100
```

### Time Periods

- **Last 24 Hours:** Rolling 24-hour window
- **Last 7 Days:** Rolling 7-day window
- **Last 30 Days:** Rolling 30-day window (SLA compliance period)

### SLA Compliance

```
SLA Compliant = Uptime Percentage >= 99.9%

99.9% uptime allows:
- 43.2 minutes downtime per month
- 10.1 minutes downtime per week
- 1.44 minutes downtime per day
```

## Downtime Incident Management

### Incident Creation

When system status changes from UP to DOWN or DEGRADED:
1. New incident record created
2. Start time recorded
3. Reason captured (if available)
4. Status set to unresolved

### Incident Resolution

When system status changes from DOWN/DEGRADED to UP:
1. Most recent unresolved incident found
2. End time recorded
3. Duration calculated (in minutes)
4. Status set to resolved

### Incident Tracking

All incidents include:
- Unique incident ID
- Start and end timestamps
- Duration in minutes
- Reason/error message
- Resolution status

## API Endpoints

### Get Uptime Statistics

```http
GET /api/v1/monitoring/uptime?period=30&includeIncidents=true
Authorization: Bearer <token>
```

**Query Parameters:**
- `period` (optional): Time period in days (1-365, default: 30)
- `includeIncidents` (optional): Include downtime incidents (default: false)

**Response:**
```json
{
  "success": true,
  "data": {
    "currentStatus": "UP",
    "stats": {
      "period": "30 days",
      "totalMinutes": 43200,
      "uptimeMinutes": 43157,
      "downtimeMinutes": 43,
      "uptimePercentage": 99.900,
      "slaCompliant": true,
      "incidents": 2,
      "avgResponseTime": 145.5
    },
    "periods": {
      "last24Hours": { ... },
      "last7Days": { ... },
      "last30Days": { ... }
    },
    "slaTarget": 99.9,
    "slaCompliant": true,
    "incidents": [
      {
        "id": "incident-123",
        "startTime": "2026-02-01T10:30:00Z",
        "endTime": "2026-02-01T10:45:00Z",
        "duration": 15,
        "reason": "Database connection timeout",
        "resolved": true
      }
    ]
  }
}
```

### Record Heartbeat (Cron Only)

```http
POST /api/v1/cron/system-heartbeat
Authorization: Bearer <cron-secret>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "status": "UP",
    "responseTime": 125,
    "timestamp": "2026-02-04T12:00:00Z",
    "checks": {
      "database": { "status": "UP" },
      "redis": { "status": "UP" },
      "metrics": { "status": "UP" },
      "errorRate": { "status": "UP" },
      "responseTime": { "status": "UP" }
    }
  }
}
```

## Monitoring Dashboard

### Access

Navigate to: **Admin → Monitoring → Uptime**

### Features

1. **Current Status Indicator**
   - Real-time system status
   - Visual status badge (green/yellow/red)
   - Last update timestamp

2. **SLA Compliance Alert**
   - Green alert if compliant
   - Red alert if not meeting target
   - Current uptime percentage

3. **Uptime Statistics Cards**
   - Last 24 hours uptime
   - Last 7 days uptime
   - Last 30 days uptime
   - Downtime duration for each period
   - Incident count for each period

4. **Performance Metrics**
   - Average response time
   - Total uptime minutes
   - Visual trend indicators

5. **Downtime Incident History**
   - Chronological list of incidents
   - Start/end timestamps
   - Duration and reason
   - Resolution status

### Auto-Refresh

Dashboard automatically refreshes every 60 seconds to display current data.

## Cron Configuration

### Vercel Cron Setup

```json
{
  "crons": [
    {
      "path": "/api/v1/cron/system-heartbeat",
      "schedule": "* * * * *"
    }
  ]
}
```

**Schedule:** Every minute (`* * * * *`)

### Environment Variables

```env
# Required for cron authentication
CRON_SECRET=your-secure-cron-secret

# Required for Redis-based tracking
UPSTASH_REDIS_REST_URL=https://your-redis-url
UPSTASH_REDIS_REST_TOKEN=your-redis-token
```

## Data Retention

### Heartbeat Logs

- **Redis:** 30 days (for fast access)
- **Database:** Indefinite (for historical analysis)

### Downtime Incidents

- **Database:** Indefinite (for compliance reporting)

### Cleanup

Consider implementing cleanup for old heartbeat logs:
- Archive logs older than 90 days
- Keep aggregated statistics indefinitely

## Alerting Integration

### SLA Breach Alerts

When uptime falls below 99.9%:
1. Critical alert triggered
2. Email notification sent to admins
3. Slack notification (if configured)
4. Alert logged in monitoring system

### Downtime Alerts

When system goes DOWN:
1. Immediate critical alert
2. Notification to on-call team
3. Incident created in tracking system

## Best Practices

### 1. Monitor Regularly

- Check uptime dashboard daily
- Review incident reports weekly
- Analyze trends monthly

### 2. Investigate Incidents

- Document root cause for each incident
- Implement fixes to prevent recurrence
- Update incident records with findings

### 3. Maintain SLA

- Keep uptime above 99.9% target
- Plan maintenance during low-traffic periods
- Use maintenance windows for updates

### 4. Optimize Performance

- Monitor response times
- Optimize slow queries
- Scale resources as needed

### 5. Test Disaster Recovery

- Regularly test backup systems
- Verify incident detection works
- Practice recovery procedures

## Troubleshooting

### Heartbeat Not Recording

**Symptoms:** No recent heartbeat logs

**Solutions:**
1. Check Vercel Cron configuration
2. Verify CRON_SECRET environment variable
3. Check cron job logs in Vercel dashboard
4. Ensure database connectivity

### False Downtime Detection

**Symptoms:** System marked DOWN but actually operational

**Solutions:**
1. Review health check thresholds
2. Check database connection pool
3. Verify Redis connectivity
4. Adjust timeout settings

### SLA Not Met

**Symptoms:** Uptime below 99.9%

**Solutions:**
1. Review downtime incidents
2. Identify recurring issues
3. Implement preventive measures
4. Scale infrastructure if needed

## Maintenance Windows

### Scheduling Maintenance

1. Plan maintenance during low-traffic periods
2. Notify users in advance
3. Create maintenance window record
4. Exclude maintenance time from SLA calculation

### Maintenance Window API

```typescript
// Create maintenance window
await prisma.monitoringMaintenanceWindow.create({
  data: {
    name: "Database Upgrade",
    description: "PostgreSQL version upgrade",
    startTime: new Date("2026-02-10T02:00:00Z"),
    endTime: new Date("2026-02-10T04:00:00Z"),
    isActive: true
  }
});
```

## Reporting

### Monthly Uptime Report

Generate monthly reports including:
- Overall uptime percentage
- Total downtime minutes
- Number of incidents
- Average response time
- SLA compliance status
- Incident summaries

### Export Data

```typescript
// Export uptime data for reporting
const stats = await uptimeTracker.getUptimeStats(30);
const incidents = await uptimeTracker.getDowntimeIncidents(30);

// Generate CSV or PDF report
```

## Integration with Monitoring System

The uptime tracker integrates with the existing monitoring system:

1. **Metrics Collection:** Uptime data feeds into metrics collector
2. **Alert Rules:** SLA breaches trigger monitoring alerts
3. **Dashboard:** Uptime stats displayed in monitoring dashboard
4. **Notifications:** Downtime incidents sent via notification system

## Future Enhancements

### Planned Features

1. **Regional Uptime Tracking**
   - Track uptime by geographic region
   - Multi-region deployment support

2. **Component-Level Uptime**
   - Track uptime for individual services
   - API endpoint-specific uptime

3. **Predictive Analytics**
   - Predict potential downtime
   - Proactive alerting

4. **Public Status Page**
   - Customer-facing status page
   - Real-time uptime display
   - Incident communication

5. **Advanced Reporting**
   - Custom report generation
   - Trend analysis
   - Capacity planning insights

## Support

For issues or questions about uptime monitoring:

1. Check this documentation
2. Review monitoring dashboard
3. Check system logs
4. Contact DevOps team

---

**Last Updated:** February 4, 2026  
**Version:** 1.0  
**Maintained By:** DevOps Team
