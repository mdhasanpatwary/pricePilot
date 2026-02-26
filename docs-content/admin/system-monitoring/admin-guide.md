---
title: "Admin Guide"
description: "Comprehensive administrative guide"
category: "system-monitoring"
author: "PricePilot Team"
lastReviewed: "2024-05-20"
tags: ["admin", "guide", "operations"]
audience: "admin"
relatedDocs: ["/docs/troubleshooting/admin-guide.md"]
---

# Admin Dashboard User Guide

## Overview

This guide provides step-by-step instructions for using the PricePilot admin monitoring dashboards. These tools help platform administrators monitor system health, track performance, and configure scraping behavior.

> **Note**: For the enhanced admin dashboard features (Real-Time Monitoring Hub, Proxy Simulator, Session Control, etc.), see the [Admin Dashboard Enhancement Guide](./ADMIN_DASHBOARD_ENHANCEMENT_GUIDE.md).

## Table of Contents

1. [Getting Started](#getting-started)
2. [Proxy Health Dashboard](#proxy-health-dashboard)
3. [Challenge Detection Dashboard](#challenge-detection-dashboard)
4. [Scraping Metrics Dashboard](#scraping-metrics-dashboard)
5. [Real-Time Monitor](#real-time-monitor)
6. [Human Simulation Settings](#human-simulation-settings)
7. [Site Profile Management](#site-profile-management)
8. [Alert Management](#alert-management)
9. [Best Practices](#best-practices)
10. [Troubleshooting](#troubleshooting)

## Related Documentation

- [Admin Dashboard Enhancement Guide](./ADMIN_DASHBOARD_ENHANCEMENT_GUIDE.md) - Enhanced features and capabilities
- [Admin API Reference](./ADMIN_API_REFERENCE.md) - Complete API documentation
- [Admin Troubleshooting Guide](./ADMIN_TROUBLESHOOTING_GUIDE.md) - Detailed troubleshooting procedures
- [Admin Dashboard Deployment](./ADMIN_DASHBOARD_DEPLOYMENT.md) - Deployment instructions

---

## Getting Started

### Accessing Admin Dashboards

1. Log in to PricePilot with an admin account
2. Navigate to the Admin Panel from the main navigation
3. Select the desired dashboard from the admin menu

### Dashboard Navigation

All admin dashboards are located under `/admin/`:

**Main Hubs:**
- Monitoring Hub: `/admin/monitoring` - Live monitoring, session control, health, debug, diagnostics
- Analytics Hub: `/admin/analytics` - Dashboard, scraper status, metrics, proxy health, challenges

**Management:**
- Tenants: `/admin/tenants`
- Users: `/admin/users`
- Alerts: `/admin/alerts`

**Scraping Engine:**
- Proxy Simulator: `/admin/simulator`
- Scraper Profiles: `/admin/scraper-profiles`
- Site Profiles: `/admin/site-profiles`
- Human Simulation: `/admin/human-simulation`
- Engine Playground: `/admin/playground`

**Other:**
- Audit Search: `/admin/audit`
- Business Setup: `/admin/business-setup`
- Task Scheduler: `/admin/scheduler`
- Maintenance: `/admin/maintenance/backups`

---

## Proxy Health Dashboard

### Purpose

Monitor the health and performance of your proxy pool to ensure reliable scraping operations.

### Key Metrics

**Overview Statistics**:
- **Total Proxies**: Number of configured proxies
- **Healthy Proxies**: Proxies with success rate > 70%
- **Unhealthy Proxies**: Proxies with success rate < 70%
- **Average Success Rate**: Overall proxy pool performance
- **Average Response Time**: Average proxy response time

**Per-Proxy Metrics**:
- URL and type (residential/datacenter)
- Health status indicator
- Success/failure counts
- Success rate percentage
- Average response time
- Last checked timestamp

### How to Use

1. **Review Overview**: Check the summary cards at the top for overall proxy pool health
2. **Identify Issues**: Look for proxies marked as unhealthy (red indicator)
3. **Analyze Performance**: Sort by success rate or response time to find problematic proxies
4. **Filter by Time**: Use the time range selector to view historical performance
5. **Refresh Data**: Click the refresh button to get the latest metrics

### Taking Action

**When a proxy is unhealthy**:
1. Note the proxy URL
2. Check if it's a temporary issue by viewing 7-day metrics
3. If consistently unhealthy, consider replacing the proxy
4. Contact your proxy provider if multiple proxies are failing

**When response times are high**:
1. Check if it's specific to certain proxies or system-wide
2. Consider using faster proxies for time-sensitive scraping
3. Adjust concurrent request limits to reduce load

---

## Challenge Detection Dashboard

### Purpose

Monitor how effectively the system detects and solves anti-bot challenges across all sites.

### Key Metrics

**Summary Statistics**:
- **Total Challenges**: Challenges detected across all sites
- **Average Solve Rate**: Overall challenge solving success
- **Most Common Type**: Most frequently encountered challenge
- **Sites with Issues**: Sites with solve rate < 30%

**Per-Site Metrics**:
- Site domain
- Total challenges detected
- Challenges solved vs failed
- Solve rate percentage
- Breakdown by challenge type

### How to Use

1. **Review Summary**: Check overall challenge handling performance
2. **Identify Problem Sites**: Look for sites with warning indicators (low solve rate)
3. **Analyze Challenge Types**: Review the pie chart to see which challenges are most common
4. **Track Trends**: Use the line chart to monitor solve rate changes over time
5. **Filter by Time**: Select different time ranges to identify patterns

### Taking Action

**When solve rate is low (<30%)**:
1. Check which challenge type is causing issues
2. Review the site profile for that domain
3. Consider applying an anti-bot template (Cloudflare, PerimeterX, etc.)
4. Increase challenge wait timeout if challenges are timing out
5. Contact support if issues persist

**When a new challenge type appears**:
1. Note the challenge type and affected site
2. Check if the system supports this challenge type
3. Consider manual intervention or CAPTCHA solving service
4. Report to development team for potential support addition

---

## Scraping Metrics Dashboard

### Purpose

Get a comprehensive view of scraping performance across all sites and tenants.

### Key Metrics

**Platform-Wide**:
- **Total Requests**: All scraping requests
- **Average Success Rate**: Overall scraping success
- **Average Block Rate**: Overall blocking rate
- **Active Sites**: Sites with recent activity

**Per-Site Metrics**:
- Site domain and tenant
- Total requests and successful requests
- Block rate and success rate
- Average response time
- Last scrape timestamp
- Status indicator (healthy/degraded/critical)

### How to Use

1. **Review Platform Metrics**: Check overall system performance
2. **Sort by Block Rate**: Identify sites with high blocking
3. **View Trends**: Use charts to visualize performance over time
4. **Export Data**: Download metrics for offline analysis
5. **Drill Down**: Click on a site to view detailed proxy performance

### Taking Action

**When block rate is high (>30%)**:
1. Identify the affected site
2. Check proxy health for that site
3. Review and adjust the site profile:
   - Increase delays
   - Reduce concurrent requests
   - Enable session warmup
4. Apply appropriate anti-bot template
5. Monitor for improvement

**When success rate is low (<70%)**:
1. Check if it's a proxy issue or site-specific
2. Review challenge detection stats for the site
3. Verify the site is still accessible
4. Check for recent changes to the target site
5. Adjust scraping strategy as needed

### Exporting Data

1. Click the "Export" button
2. Choose format (CSV or JSON)
3. Data will download with current filters applied
4. Filename includes timestamp for easy tracking

---

## Real-Time Monitor

### Purpose

View live scraping activity and monitor active sessions in real-time.

### Key Metrics

**Aggregate Statistics**:
- **Active Sessions**: Currently running scraping sessions
- **Requests Per Minute**: Current request rate
- **Average Session Duration**: Typical session length

**Per-Session Details**:
- Site domain and tenant name
- Start time and duration
- Requests completed vs total
- Current status
- Proxy being used
- Challenge status (if applicable)

### How to Use

1. **Monitor Active Sessions**: View all currently running scraping operations
2. **Check Status**: Identify sessions that are stuck or failing
3. **Filter Sessions**: Use filters to focus on specific tenants or sites
4. **Auto-Refresh**: Toggle auto-refresh on/off (default: 5 seconds)
5. **View Details**: Click on a session to see more information

### Session Statuses

- **Running**: Actively scraping, everything normal
- **Waiting Challenge**: Detected challenge, waiting for resolution
- **Completed**: Successfully finished
- **Failed**: Encountered error and stopped

### Taking Action

**When a session is stuck in "Waiting Challenge"**:
1. Note the challenge type
2. Check challenge stats for that site
3. If timeout is approaching, consider manual intervention
4. Review challenge handler configuration

**When multiple sessions are failing**:
1. Check proxy health dashboard
2. Review system health metrics
3. Check for site-wide issues
4. Verify database connectivity

---

## Human Simulation Settings

### Purpose

Configure global human behavior simulation parameters to improve stealth effectiveness.

### Configuration Options

**Typing Simulation**:
- **Min Delay**: Minimum time between keystrokes (10-500ms)
- **Max Delay**: Maximum time between keystrokes (50-1000ms)
- **Recommended**: 50-150ms (mimics human typing)

**Action Pauses**:
- **Min Delay**: Minimum pause between actions (50-1000ms)
- **Max Delay**: Maximum pause between actions (100-5000ms)
- **Recommended**: 100-2000ms (natural pauses)

**Mouse Movement**:
- **Enabled**: Enable natural mouse movement simulation
- **Natural Curves**: Use Bezier curves for realistic movement
- **Recommended**: Both enabled

**Form Interaction**:
- **Pause Between Fields**: Delay when moving between form fields (100-2000ms)
- **Simulate Corrections**: Simulate typing mistakes and corrections
- **Recommended**: 500ms pause, corrections enabled

### How to Use

1. **Review Current Settings**: Check the current configuration values
2. **Adjust Sliders**: Move sliders to set desired delay ranges
3. **Enable/Disable Features**: Toggle mouse movement and corrections
4. **Check Recommendations**: Green indicators show optimal values
5. **Save Changes**: Click "Save Settings" to apply
6. **Reset if Needed**: Use "Reset to Defaults" to restore recommended values

### Best Practices

- Start with recommended values
- Adjust gradually based on block rates
- Higher delays = more stealth but slower scraping
- Lower delays = faster scraping but higher detection risk
- Monitor metrics after changes to measure impact

---

## Site Profile Management

### Purpose

Create and manage custom scraping configurations for specific sites.

### Profile Configuration

**Rate Limiting**:
- **Requests Per Minute**: Maximum requests per minute (1-60)
- **Concurrent Requests**: Simultaneous requests allowed (1-10)

**Adaptive Delays**:
- **Min Delay**: Minimum delay between requests (100-10000ms)
- **Max Delay**: Maximum delay between requests (500-30000ms)
- **Multiplier**: Delay adjustment factor (1.0-5.0)

**Session Warmup**:
- **Enabled**: Visit pages before scraping target content
- **Paths**: URLs to visit during warmup (e.g., ["/", "/products"])

**Referrer Chain**:
- **Enabled**: Maintain realistic referrer headers

### How to Use

1. **View Profiles**: See all configured site profiles
2. **Add New Profile**: Click "Add New Profile"
3. **Select Template**: Choose from pre-built templates or start from scratch
4. **Configure Settings**: Adjust rate limits, delays, and warmup
5. **Save Profile**: Click "Save" to apply
6. **Edit/Delete**: Modify or remove existing profiles

### Pre-Built Templates

**Cloudflare Template**:
- 10 requests/minute
- 2 concurrent requests
- 3-5 second delays
- Homepage warmup enabled
- Best for: Cloudflare-protected sites

**PerimeterX Template**:
- 8 requests/minute
- 1 concurrent request
- 4-6 second delays
- Multi-path warmup
- Best for: PerimeterX-protected sites

**DataDome Template**:
- 6 requests/minute
- 1 concurrent request
- 5-8 second delays
- Homepage warmup
- Best for: DataDome-protected sites

### Best Practices

- Start with a template for known anti-bot systems
- Test with conservative settings first
- Gradually increase rate limits if performance is good
- Enable session warmup for aggressive anti-bot systems
- Monitor metrics after applying profiles

---

## Alert Management

### Purpose

Stay informed about critical system issues and take timely action.

### Alert Types

**Critical Alerts** (🔴):
- All proxies unhealthy
- System-wide failures
- Requires immediate action

**Warning Alerts** (⚠️):
- High block rate (>30%)
- Low solve rate (<30%)
- Proxy failures
- Requires attention

**Info Alerts** (ℹ️):
- General notifications
- Status updates
- For awareness

### How to Use

1. **Check Badge**: Navigation shows unacknowledged alert count
2. **View Alerts**: Navigate to Alerts page
3. **Filter Alerts**: Filter by severity or acknowledged status
4. **Review Details**: Click on alert to see full information
5. **Acknowledge**: Mark alerts as reviewed
6. **Take Action**: Follow recommendations in alert message

### Common Alerts and Actions

**"All proxies unhealthy"**:
1. Check proxy health dashboard
2. Verify proxy credentials
3. Contact proxy provider
4. Add backup proxies if available

**"High block rate detected for [site]"**:
1. Review scraping metrics for the site
2. Check site profile configuration
3. Increase delays or reduce rate
4. Enable session warmup
5. Apply anti-bot template

**"Low challenge solve rate for [site]"**:
1. Check challenge stats dashboard
2. Review challenge types
3. Increase challenge timeout
4. Consider manual CAPTCHA solving
5. Contact support if persistent

---

## Best Practices

### Daily Monitoring Routine

1. **Check Alerts**: Review any new alerts first
2. **Proxy Health**: Verify proxy pool is healthy
3. **Scraping Metrics**: Check overall success and block rates
4. **Challenge Stats**: Monitor solve rates
5. **Active Sessions**: Verify no stuck sessions

### Weekly Review

1. **Trend Analysis**: Review 7-day metrics for patterns
2. **Proxy Performance**: Identify consistently poor proxies
3. **Site Profiles**: Adjust profiles based on performance
4. **Challenge Handling**: Review solve rates by challenge type
5. **Export Data**: Download metrics for reporting

### Performance Optimization

1. **Start Conservative**: Use higher delays initially
2. **Monitor Results**: Track metrics after changes
3. **Adjust Gradually**: Make small incremental changes
4. **Test Thoroughly**: Verify improvements before scaling
5. **Document Changes**: Keep notes on what works

### Security Considerations

1. **Rotate Proxies**: Replace proxies regularly
2. **Monitor Patterns**: Watch for unusual activity
3. **Review Logs**: Check for suspicious behavior
4. **Update Profiles**: Keep site profiles current
5. **Audit Access**: Review admin access logs

---

## Troubleshooting

### Dashboard Not Loading

**Symptoms**: Dashboard shows loading spinner indefinitely

**Solutions**:
1. Check browser console for errors
2. Verify admin authentication
3. Check API endpoint status
4. Clear browser cache and reload
5. Try different browser

### Data Not Updating

**Symptoms**: Metrics show stale data

**Solutions**:
1. Click manual refresh button
2. Check auto-refresh is enabled
3. Verify API endpoints are responding
4. Check database connectivity
5. Review application logs

### Configuration Changes Not Applied

**Symptoms**: Changes don't take effect

**Solutions**:
1. Verify changes were saved successfully
2. Check for validation errors
3. Ensure new sessions are started (changes don't affect active sessions)
4. Review application logs
5. Restart scraping service if necessary

### High Memory Usage

**Symptoms**: Dashboard becomes slow or unresponsive

**Solutions**:
1. Close unused browser tabs
2. Disable auto-refresh temporarily
3. Filter data to reduce dataset size
4. Clear browser cache
5. Use pagination for large lists

### Export Failing

**Symptoms**: Export button doesn't download file

**Solutions**:
1. Check browser download settings
2. Verify sufficient disk space
3. Try smaller dataset (use filters)
4. Try different export format
5. Check browser console for errors

---

## Support

For additional help:

- **Documentation**: [docs.pricepilot.com](http://localhost:3000/docs)
- **Email**: support@pricepilot.com
- **Live Chat**: Available in dashboard
- **Community**: [community.pricepilot.com](http://localhost:3000/community)

---

*Last Updated: January 26, 2026*
