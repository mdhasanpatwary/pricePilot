---
title: "Monitoring UI"
description: "Using the monitoring user interface"
category: "system-monitoring"
tags: ["monitoring", "ui", "dashboard"]
audience: "admin"
relatedDocs: ["/docs/troubleshooting/monitoring-ui.md"]
---

# Stealth Monitoring UI

## Overview

The Stealth Monitoring UI provides comprehensive dashboards and management interfaces for monitoring and configuring PricePilot's advanced stealth scraping capabilities. These features are available in both the Admin Panel (for platform administrators) and Tenant Panel (for individual tenants).

## Table of Contents

1. [Admin Panel Features](#admin-panel-features)
2. [Tenant Panel Features](#tenant-panel-features)
3. [API Endpoints](#api-endpoints)
4. [Configuration Guide](#configuration-guide)
5. [Troubleshooting](#troubleshooting)

---

## Admin Panel Features

### 2. Proxy Health Dashboard

**Location**: `/admin/analytics?tab=proxies`

Monitor the health and performance of your proxy pool in real-time.

**Features**:
- **Overview Statistics**: Total proxies, healthy count, unhealthy count, average success rate
- **Proxy List**: Detailed view of each proxy with:
  - URL and type (residential/datacenter)
  - Health status with visual indicators
  - Success/failure counts and success rate
  - Average response time
  - Last checked timestamp
- **Time Range Filtering**: View metrics for 24 hours, 7 days, or 30 days
- **Manual Refresh**: Update proxy health data on demand

**Usage**:
1. Navigate to Admin Panel → Proxy Health
2. Review the overview statistics at the top
3. Scroll through the proxy list to identify unhealthy proxies
4. Use the time range selector to view historical performance
5. Click refresh to get the latest data

**Health Status Indicators**:
- 🟢 **Healthy**: Success rate > 70%, responding normally
- 🔴 **Unhealthy**: Success rate < 70% or multiple consecutive failures
- ⚠️ **Degraded**: Success rate between 50-70%

### 3. Challenge Detection Dashboard

**Location**: `/admin/analytics?tab=challenges`

Monitor anti-bot challenge detection and solve rates across all sites.

**Features**:
- **Summary Statistics**: Total challenges, average solve rate, most common challenge type
- **Site Breakdown**: Per-site challenge statistics including:
  - Total challenges detected
  - Challenges solved vs failed
  - Solve rate percentage
  - Challenge type distribution
- **Challenge Type Analysis**: Breakdown by type (Cloudflare, reCAPTCHA, Turnstile, PerimeterX, DataDome)
- **Solve Rate Trends**: Line chart showing solve rates over time
- **Warning Indicators**: Highlights sites with solve rates below 30%

**Usage**:
1. Navigate to Admin Panel → Challenge Stats
2. Review the summary to understand overall challenge handling
3. Identify sites with low solve rates (marked with warning indicators)
4. Analyze challenge type distribution to understand which systems are most common
5. Use time range filtering to track improvements or degradation

**When to Take Action**:
- Solve rate < 30%: Consider adjusting site profile or enabling fallback strategies
- Sudden drop in solve rate: May indicate changes to the target site's anti-bot system
- High challenge volume: Consider reducing request rate or improving stealth settings

### 4. Scraping Metrics Dashboard

**Location**: `/admin/analytics?tab=metrics`

Comprehensive view of scraping performance across all sites and tenants.

**Features**:
- **Platform-Wide Metrics**: Total requests, average success rate, average block rate
- **Site-Level Metrics**: Detailed statistics per site:
  - Total requests and successful requests
  - Block rate and success rate
  - Average response time
  - Last scrape timestamp
  - Status indicator (healthy/degraded/critical)
- **Trend Charts**: Visualize success rate and block rate over time
- **Data Export**: Export metrics to CSV or JSON format
- **Drill-Down**: Click on a site to view detailed proxy performance

**Usage**:
1. Navigate to Admin Panel → Scraping Metrics
2. Review platform-wide statistics
3. Sort sites by block rate to identify problematic sites
4. Use trend charts to identify patterns
5. Export data for offline analysis or reporting

**Status Indicators**:
- 🟢 **Healthy**: Block rate < 10%, success rate > 90%
- 🟡 **Degraded**: Block rate 10-30%, success rate 70-90%
- 🔴 **Critical**: Block rate > 30%, success rate < 70%

### 1. Real-Time Scraping Monitor

**Location**: `/admin/monitoring?tab=live`

Live view of active scraping sessions with real-time updates.

**Features**:
- **Active Sessions**: List of currently running scraping sessions
- **Session Details**: For each session:
  - Site domain and tenant name
  - Start time and duration
  - Requests completed vs total
  - Current status (running/waiting/completed/failed)
  - Proxy being used
  - Challenge status (if applicable)
- **Auto-Refresh**: Updates every 5 seconds automatically
- **Aggregate Statistics**: Total active sessions, requests per minute
- **Filtering**: Filter by tenant or site

**Usage**:
1. Navigate to Admin Panel → Monitor
2. View active sessions in real-time
3. Monitor for sessions stuck in "waiting_challenge" status
4. Use filters to focus on specific tenants or sites
5. Toggle auto-refresh on/off as needed

**Session Statuses**:
- **Running**: Actively scraping
- **Waiting Challenge**: Detected challenge, waiting for resolution
- **Completed**: Successfully finished
- **Failed**: Encountered error and stopped

### 5. Human Simulation Settings

**Location**: `/admin/human-simulation`

Configure global human behavior simulation parameters.

**Features**:
- **Typing Simulation**: Set min/max typing delays (milliseconds)
- **Action Pauses**: Configure pause durations between actions
- **Mouse Movement**: Enable/disable natural mouse movement
- **Form Interaction**: Configure form filling behavior
- **Recommended Ranges**: Visual indicators showing optimal values
- **Validation**: Real-time validation of input ranges
- **Apply Changes**: Updates take effect immediately without restart

**Usage**:
1. Navigate to Admin Panel → Human Simulation
2. Adjust sliders to set desired delay ranges
3. Enable/disable mouse movement and corrections
4. Review recommended ranges (shown in green)
5. Click "Save Settings" to apply changes
6. Use "Reset to Defaults" to restore recommended values

**Recommended Settings**:
- Typing delay: 50-150ms (mimics human typing speed)
- Action pause: 100-2000ms (natural pauses between actions)
- Mouse movement: Enabled (adds realism)
- Form corrections: Enabled (simulates typos and corrections)

### 6. Site Profile Management

**Location**: `/admin/site-profiles`

Create and manage per-site scraping configurations.

**Features**:
- **Profile List**: View all configured site profiles
- **Profile Templates**: Pre-configured profiles for common anti-bot systems:
  - Cloudflare
  - PerimeterX
  - DataDome
- **Profile Editor**: Configure:
  - Rate limits (requests per minute)
  - Concurrent request limits
  - Adaptive delay settings
  - Session warmup paths
  - Referrer chain tracking
- **Validation**: Ensures configuration values are valid
- **Immediate Application**: Changes apply to new scraping sessions instantly

**Usage**:
1. Navigate to Admin Panel → Site Profiles
2. Click "Add New Profile" to create a profile
3. Select a template or start from scratch
4. Configure rate limits and delays
5. Enable session warmup if needed
6. Save the profile
7. The profile will be automatically applied to matching domains

**Profile Templates**:

**Cloudflare Profile**:
- 10 requests/minute
- 2 concurrent requests
- 3s base delay with 1.5x multiplier
- Session warmup enabled

**PerimeterX Profile**:
- 8 requests/minute
- 1 concurrent request
- 4s base delay with 2.0x multiplier
- Multi-path warmup

**DataDome Profile**:
- 6 requests/minute
- 1 concurrent request
- 5s base delay with 2.5x multiplier
- Homepage warmup

### 7. Alert Management

**Location**: `/admin/alerts`

View and manage system alerts for critical issues.

**Features**:
- **Alert List**: All alerts with severity indicators
- **Filtering**: Filter by severity (critical/warning/info) and acknowledged status
- **Alert Details**: Each alert shows:
  - Severity level
  - Alert message
  - Affected site or proxy
  - Timestamp
  - Acknowledgment status
- **Acknowledge Action**: Mark alerts as acknowledged
- **Unacknowledged Count**: Badge in navigation showing pending alerts

**Usage**:
1. Navigate to Admin Panel → Alerts
2. Review unacknowledged alerts (shown at top)
3. Click on an alert to view details
4. Click "Acknowledge" to mark as reviewed
5. Use filters to view historical alerts

**Alert Types**:
- 🔴 **Critical**: All proxies unhealthy, immediate action required
- ⚠️ **Warning**: High block rate (>30%), low solve rate (<30%)
- ℹ️ **Info**: General notifications and status updates

---

## Tenant Panel Features

### 1. Tenant Metrics Dashboard

**Location**: `/dashboard/metrics`

View scraping performance metrics for your configured sites.

**Features**:
- **Overview Cards**: Tenant-wide success rate, block rate, total requests
- **Site Health Cards**: Status for each configured site
- **Challenge Detection**: Summary of challenges encountered
- **Recommendations**: Actionable suggestions when issues are detected
- **Time Range Filtering**: 24 hours, 7 days, or 30 days
- **Status Legend**: Explanation of health indicators

**Usage**:
1. Navigate to Dashboard → Metrics
2. Review overall success and block rates
3. Check individual site health cards
4. Follow recommendations for sites with issues
5. Use time range selector to view trends

**Recommendations Examples**:
- "High block rate detected - consider adjusting delays"
- "Challenge solve rate low - contact support for assistance"
- "All systems healthy - no action needed"

### 2. Site Configuration

**Location**: `/dashboard/site-config`

Configure scraping settings for your sites within plan limits.

**Features**:
- **Site List**: All your configured sites
- **Configuration Options**:
  - Enable/disable session warmup
  - Set minimum and maximum delays
  - View allowed ranges based on your plan
- **Impact Preview**: Shows estimated effect on scraping speed and stealth
- **Validation**: Ensures settings are within plan limits
- **Immediate Application**: Changes apply to future scraping sessions

**Usage**:
1. Navigate to Dashboard → Site Config
2. Select a site to configure
3. Toggle session warmup on/off
4. Adjust delay sliders within allowed ranges
5. Review impact preview
6. Click "Save Configuration"

**Plan Limits**:
- **Basic**: 1-5 second delays, no warmup
- **Premium**: 0.5-3 second delays, warmup allowed
- **Pro**: 0.1-2 second delays, full warmup control

---

## API Endpoints

### Admin Endpoints

#### GET /api/v1/admin/proxy-health

Fetch proxy health data with optional time range filtering.

**Query Parameters**:
- `timeRange`: `24h` | `7d` | `30d` (optional, default: `24h`)

**Response**:
```json
{
  "stats": {
    "totalProxies": 10,
    "healthyProxies": 8,
    "unhealthyProxies": 2,
    "avgSuccessRate": 0.85,
    "avgResponseTime": 250
  },
  "proxies": [
    {
      "url": "http://proxy1.example.com:8080",
      "type": "residential",
      "isHealthy": true,
      "successCount": 450,
      "failureCount": 50,
      "successRate": 0.90,
      "avgResponseTime": 230,
      "lastChecked": "2026-01-26T10:30:00Z"
    }
  ]
}
```

#### GET /api/v1/admin/challenge-stats

Fetch challenge detection statistics.

**Query Parameters**:
- `timeRange`: `24h` | `7d` | `30d` (optional, default: `24h`)

**Response**:
```json
{
  "summary": {
    "totalChallenges": 150,
    "avgSolveRate": 0.75,
    "mostCommonType": "cloudflare",
    "sitesWithIssues": 2
  },
  "sites": [
    {
      "site": "example.com",
      "totalChallenges": 50,
      "solvedChallenges": 40,
      "failedChallenges": 10,
      "solveRate": 0.80,
      "challengeTypes": [
        {
          "type": "cloudflare",
          "count": 30,
          "solveRate": 0.85
        }
      ]
    }
  ]
}
```

#### GET /api/v1/admin/scraping-metrics

Fetch scraping performance metrics.

**Query Parameters**:
- `timeRange`: `24h` | `7d` | `30d` (optional, default: `24h`)

**Response**:
```json
{
  "summary": {
    "totalRequests": 10000,
    "avgSuccessRate": 0.88,
    "avgBlockRate": 0.12,
    "activeSites": 25
  },
  "sites": [
    {
      "site": "example.com",
      "tenant": "tenant-123",
      "totalRequests": 500,
      "successfulRequests": 450,
      "blockedRequests": 50,
      "successRate": 0.90,
      "blockRate": 0.10,
      "avgResponseTime": 280,
      "lastScrapeAt": "2026-01-26T10:45:00Z"
    }
  ]
}
```

#### GET /api/v1/admin/active-sessions

Fetch real-time scraping session data.

**Response**:
```json
{
  "stats": {
    "activeSessions": 5,
    "requestsPerMinute": 45,
    "avgSessionDuration": 120
  },
  "sessions": [
    {
      "id": "session-123",
      "site": "example.com",
      "tenant": "tenant-456",
      "startTime": "2026-01-26T10:40:00Z",
      "requestsCompleted": 25,
      "requestsTotal": 50,
      "status": "running",
      "currentProxy": "http://proxy1.example.com:8080",
      "challengeType": null,
      "challengeStatus": null
    }
  ]
}
```

#### GET /api/v1/admin/human-simulation-config

Fetch current human simulation configuration.

**Response**:
```json
{
  "config": {
    "typing": {
      "minDelay": 50,
      "maxDelay": 150
    },
    "actionPause": {
      "minDelay": 100,
      "maxDelay": 2000
    },
    "mouseMovement": {
      "enabled": true,
      "naturalCurves": true
    },
    "formInteraction": {
      "pauseBetweenFields": 500,
      "simulateCorrections": true
    }
  }
}
```

#### POST /api/v1/admin/human-simulation-config

Update human simulation configuration.

**Request Body**:
```json
{
  "config": {
    "typing": {
      "minDelay": 60,
      "maxDelay": 140
    },
    "actionPause": {
      "minDelay": 150,
      "maxDelay": 1800
    },
    "mouseMovement": {
      "enabled": true,
      "naturalCurves": true
    },
    "formInteraction": {
      "pauseBetweenFields": 600,
      "simulateCorrections": true
    }
  }
}
```

**Response**:
```json
{
  "success": true,
  "config": { /* updated config */ }
}
```

#### GET /api/v1/admin/site-profiles

Fetch all site profiles and templates.

**Response**:
```json
{
  "profiles": [
    {
      "id": "profile-123",
      "domain": "example.com",
      "requestsPerMinute": 10,
      "concurrentRequests": 2,
      "minDelay": 1000,
      "maxDelay": 3000,
      "delayMultiplier": 1.5,
      "sessionWarmupEnabled": true,
      "sessionWarmupPaths": ["/", "/products"],
      "referrerChainEnabled": true
    }
  ],
  "templates": [
    {
      "name": "Cloudflare",
      "profile": { /* template config */ }
    }
  ]
}
```

#### POST /api/v1/admin/site-profiles

Create or update a site profile.

**Request Body**:
```json
{
  "profile": {
    "domain": "example.com",
    "requestsPerMinute": 10,
    "concurrentRequests": 2,
    "minDelay": 1000,
    "maxDelay": 3000,
    "delayMultiplier": 1.5,
    "sessionWarmupEnabled": true,
    "sessionWarmupPaths": ["/", "/products"],
    "referrerChainEnabled": true
  }
}
```

**Response**:
```json
{
  "success": true,
  "profile": { /* created/updated profile */ }
}
```

#### DELETE /api/v1/admin/site-profiles/:id

Delete a site profile.

**Response**:
```json
{
  "success": true
}
```

#### GET /api/v1/admin/alerts

Fetch alerts with optional filtering.

**Query Parameters**:
- `acknowledged`: `true` | `false` (optional)
- `severity`: `critical` | `warning` | `info` (optional)

**Response**:
```json
{
  "alerts": [
    {
      "id": "alert-123",
      "severity": "critical",
      "type": "proxy_failure",
      "message": "All proxies unhealthy",
      "site": null,
      "proxyUrl": null,
      "acknowledged": false,
      "acknowledgedAt": null,
      "createdAt": "2026-01-26T10:00:00Z"
    }
  ],
  "unacknowledgedCount": 3
}
```

#### POST /api/v1/admin/alerts/:id/acknowledge

Acknowledge an alert.

**Response**:
```json
{
  "success": true,
  "alert": { /* updated alert */ }
}
```

### Tenant Endpoints

#### GET /api/v1/tenant/scraping-metrics

Fetch tenant-specific scraping metrics.

**Query Parameters**:
- `timeRange`: `24h` | `7d` | `30d` (optional, default: `24h`)

**Authentication**: Requires tenant authentication

**Response**:
```json
{
  "metrics": {
    "overallSuccessRate": 0.88,
    "overallBlockRate": 0.12,
    "totalRequests": 1000,
    "avgResponseTime": 300,
    "sites": [
      {
        "domain": "competitor1.com",
        "successRate": 0.90,
        "blockRate": 0.10,
        "lastSync": "2026-01-26T10:30:00Z",
        "status": "healthy",
        "challenges": {
          "detected": 10,
          "solved": 9
        }
      }
    ]
  }
}
```

#### GET /api/v1/tenant/site-config

Fetch tenant site configurations.

**Authentication**: Requires tenant authentication

**Response**:
```json
{
  "sites": [
    {
      "siteId": "site-123",
      "domain": "competitor1.com",
      "sessionWarmup": true,
      "delays": {
        "min": 1000,
        "max": 3000
      },
      "allowedRanges": {
        "minDelay": 500,
        "maxDelay": 5000
      }
    }
  ]
}
```

#### PATCH /api/v1/tenant/site-config/:siteId

Update site configuration.

**Authentication**: Requires tenant authentication and site ownership

**Request Body**:
```json
{
  "sessionWarmup": true,
  "delays": {
    "min": 1500,
    "max": 2500
  }
}
```

**Response**:
```json
{
  "success": true,
  "config": { /* updated config */ }
}
```

---

## Configuration Guide

### Setting Up Proxy Health Monitoring

1. Ensure proxies are configured in environment variables or database
2. ProxyManager service automatically tracks health
3. View health status in Admin Panel → Proxy Health
4. Set up alerts for proxy failures in Admin Panel → Alerts

### Configuring Challenge Handling

1. Navigate to Admin Panel → Site Profiles
2. Select or create a profile for the target site
3. Choose appropriate anti-bot template (Cloudflare, PerimeterX, etc.)
4. Adjust solve rate threshold if needed
5. Monitor solve rates in Admin Panel → Challenge Stats

### Optimizing Scraping Performance

1. **Monitor Metrics**: Check Admin Panel → Scraping Metrics daily
2. **Identify Issues**: Look for sites with high block rates (>30%)
3. **Adjust Settings**:
   - Increase delays in site profile
   - Enable session warmup
   - Reduce concurrent requests
4. **Test Changes**: Monitor metrics after adjustments
5. **Iterate**: Continue adjusting until block rate < 10%

### Tenant Configuration Best Practices

1. **Start Conservative**: Use higher delays initially
2. **Monitor Results**: Check Dashboard → Metrics regularly
3. **Adjust Gradually**: Decrease delays slowly if performance is good
4. **Enable Warmup**: For sites with aggressive anti-bot systems
5. **Follow Recommendations**: Act on suggestions in metrics dashboard

---

## Troubleshooting

### High Block Rates

**Symptoms**: Block rate > 30% in scraping metrics

**Solutions**:
1. Check proxy health - replace unhealthy proxies
2. Increase delays in site profile
3. Enable session warmup
4. Reduce concurrent requests
5. Apply appropriate anti-bot profile template

### Low Challenge Solve Rates

**Symptoms**: Solve rate < 30% in challenge stats

**Solutions**:
1. Increase challenge wait timeout
2. Check if challenge type is supported
3. Review human simulation settings
4. Consider manual CAPTCHA solving service
5. Contact support for assistance

### Proxy Pool Issues

**Symptoms**: Most proxies showing as unhealthy

**Solutions**:
1. Verify proxy credentials are correct
2. Check proxy provider status
3. Test proxies manually
4. Add more residential proxies
5. Replace consistently failing proxies

### Session Stuck in "Waiting Challenge"

**Symptoms**: Sessions remain in waiting_challenge status for extended periods

**Solutions**:
1. Check challenge solve rates for the site
2. Increase challenge timeout in configuration
3. Review challenge handler logs
4. Consider enabling fallback strategy
5. Contact support if issue persists

### Metrics Not Updating

**Symptoms**: Dashboard shows stale data

**Solutions**:
1. Click refresh button to manually update
2. Check if auto-refresh is enabled
3. Verify API endpoints are responding
4. Check browser console for errors
5. Clear browser cache and reload

### Configuration Changes Not Applied

**Symptoms**: Changes to site profiles or human simulation settings don't take effect

**Solutions**:
1. Verify changes were saved successfully
2. Check for validation errors
3. Ensure new scraping sessions are started (changes don't affect active sessions)
4. Review application logs for errors
5. Restart scraping service if necessary

---

## Performance Considerations

### Dashboard Loading

- Dashboards use server-side rendering for initial load
- Client-side updates for real-time data
- Pagination for large datasets (>100 items)
- Caching for frequently accessed data

### Real-Time Updates

- Monitor page auto-refreshes every 5 seconds
- Other dashboards refresh every 30 seconds
- WebSocket support planned for future release
- Toggle auto-refresh to reduce server load

### Data Export

- Export limited to 10,000 records per request
- Large exports may take several seconds
- Exports are generated on-demand (not cached)
- Consider filtering data before export

---

## Security Considerations

### Authentication

- All admin endpoints require admin role
- Tenant endpoints require tenant authentication
- API tokens are validated on every request
- Sessions expire after 24 hours of inactivity

### Data Access

- Tenants can only access their own data
- Admin actions are logged for audit
- Proxy credentials are masked in UI
- Sensitive data is encrypted at rest

### Rate Limiting

- API endpoints are rate-limited per user
- Admin endpoints: 100 requests/minute
- Tenant endpoints: 60 requests/minute
- Exceeded limits return 429 status code

---

## Future Enhancements

- WebSocket-based real-time updates
- Advanced filtering and search
- Custom dashboard builder
- Email/Slack notifications
- Historical data comparison
- Predictive analytics
- Mobile app
- Bulk operations
- A/B testing for configurations

---

## Support

For questions or issues with the monitoring UI:

- **Documentation**: [docs.pricepilot.com](http://localhost:3000/docs)
- **Email**: support@pricepilot.com
- **Live Chat**: Available in dashboard (Premium & Pro plans)

---

*Last Updated: January 26, 2026*
