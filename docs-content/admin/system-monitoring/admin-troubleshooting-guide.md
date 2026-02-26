---
title: "Admin Troubleshooting Guide"
description: "Comprehensive troubleshooting guide for system administrators"
category: "system-monitoring"
author: "PricePilot Team"
lastReviewed: "2024-05-20"
tags: ["troubleshooting", "admin", "guide"]
audience: "admin"
---

# Admin Dashboard Troubleshooting Guide

## Overview

This guide provides solutions to common issues encountered when using the enhanced admin dashboard. It covers troubleshooting steps, diagnostic procedures, and resolution strategies.

## Table of Contents

1. [Dashboard Issues](#dashboard-issues)
2. [Real-Time Monitoring Issues](#real-time-monitoring-issues)
3. [Session Control Issues](#session-control-issues)
4. [Proxy Simulator Issues](#proxy-simulator-issues)
5. [Metrics and Analytics Issues](#metrics-and-analytics-issues)
6. [Export Issues](#export-issues)
7. [Performance Issues](#performance-issues)
8. [System Health Issues](#system-health-issues)
9. [Data Inconsistency Issues](#data-inconsistency-issues)
10. [Authentication and Authorization Issues](#authentication-and-authorization-issues)

---

## Dashboard Issues

### Dashboard Not Loading

**Symptoms**:
- Blank page or infinite loading spinner
- Dashboard components not rendering
- Error messages in browser console

**Diagnostic Steps**:
1. Open browser developer console (F12)
2. Check for JavaScript errors
3. Check Network tab for failed API requests
4. Verify authentication status
5. Check browser compatibility

**Solutions**:

**Solution 1: Clear Browser Cache**
```bash
# Chrome/Edge
Ctrl+Shift+Delete → Clear browsing data

# Firefox
Ctrl+Shift+Delete → Clear recent history
```

**Solution 2: Check Authentication**
- Verify you're logged in as admin
- Check session hasn't expired
- Try logging out and back in
- Clear cookies and re-authenticate

**Solution 3: Check API Endpoints**
```bash
# Test API connectivity
curl -X GET "https://your-domain.com/api/v1/admin/health" \
  -H "Cookie: next-auth.session-token=<token>"
```

**Solution 4: Browser Compatibility**
- Use latest Chrome, Firefox, Edge, or Safari
- Disable browser extensions temporarily
- Try incognito/private mode


### Dashboard Shows Stale Data

**Symptoms**:
- Metrics not updating
- Old session data displayed
- Timestamps show old dates

**Diagnostic Steps**:
1. Check auto-refresh is enabled
2. Verify last update timestamp
3. Check browser console for errors
4. Test manual refresh button

**Solutions**:

**Solution 1: Enable Auto-Refresh**
- Toggle auto-refresh switch to ON
- Set refresh interval (5-60 seconds)
- Verify refresh indicator is active

**Solution 2: Manual Refresh**
- Click refresh button
- Use Ctrl+R to reload page
- Check if data updates

**Solution 3: Check Redis Connection**
```bash
# Test Redis connectivity
redis-cli ping
# Should return: PONG

# Check Redis memory
redis-cli info memory
```

**Solution 4: Clear Cache**
```bash
# Clear Redis cache
redis-cli FLUSHDB

# Restart application
pm2 restart pricepilot
```

---

## Real-Time Monitoring Issues

### Sessions Not Appearing in Monitor

**Symptoms**:
- Active sessions not shown
- Session list is empty
- Missing expected sessions

**Diagnostic Steps**:
1. Verify sessions are actually running
2. Check tenant filter settings
3. Check status filter
4. Review application logs

**Solutions**:

**Solution 1: Check Filters**
- Clear all filters
- Verify tenant filter is not excluding sessions
- Check status filter includes "running"

**Solution 2: Verify Session Tracking**
```bash
# Check Redis for active sessions
redis-cli KEYS "session:*"

# Check session data
redis-cli HGETALL "session:session_abc123"
```


**Solution 3: Check SessionTracker Service**
```bash
# Check application logs
tail -f logs/application.log | grep SessionTracker

# Verify service is running
pm2 list | grep pricepilot
```

**Solution 4: Restart Services**
```bash
# Restart application
pm2 restart pricepilot

# Restart Redis
sudo systemctl restart redis
```

### Session Details Not Loading

**Symptoms**:
- Click on session shows loading spinner
- Session detail modal is empty
- Error message displayed

**Solutions**:

**Solution 1: Verify Session ID**
- Check session ID is valid
- Verify session hasn't expired
- Check session exists in database

**Solution 2: Check API Response**
```bash
# Test session API
curl -X GET "https://your-domain.com/api/v1/admin/sessions/session_abc123" \
  -H "Cookie: next-auth.session-token=<token>"
```

**Solution 3: Check Database**
```sql
-- Query session from database
SELECT * FROM scraping_sessions WHERE id = 'session_abc123';
```

---

## Session Control Issues

### Cannot Pause/Resume Sessions

**Symptoms**:
- Control buttons not working
- Error messages when clicking controls
- Session state not changing

**Diagnostic Steps**:
1. Check session is in controllable state
2. Verify admin permissions
3. Check for conflicting operations
4. Review error messages

**Solutions**:

**Solution 1: Check Session State**
- Verify session is in "running" state for pause
- Verify session is in "paused" state for resume
- Check session hasn't already completed

**Solution 2: Verify Permissions**
```bash
# Check user role
SELECT role FROM users WHERE id = 'user_id';
# Should return: 'admin' or 'super_admin'
```


**Solution 3: Check for Locks**
```bash
# Check Redis for session locks
redis-cli GET "lock:session:session_abc123"

# Clear lock if stuck
redis-cli DEL "lock:session:session_abc123"
```

**Solution 4: Review Logs**
```bash
# Check for control operation errors
tail -f logs/application.log | grep "session control"
```

### Bulk Operations Failing

**Symptoms**:
- Bulk operations timeout
- Some sessions succeed, others fail
- Inconsistent results

**Solutions**:

**Solution 1: Reduce Batch Size**
- Select fewer sessions (max 50)
- Process in smaller batches
- Wait between batches

**Solution 2: Check Individual Sessions**
- Verify each session is controllable
- Check for sessions in invalid states
- Remove problematic sessions from selection

**Solution 3: Increase Timeout**
```javascript
// In configuration
{
  bulkOperationTimeout: 60000 // 60 seconds
}
```

---

## Proxy Simulator Issues

### Simulation Not Starting

**Symptoms**:
- Simulation stuck on "Starting"
- No progress shown
- Timeout errors

**Diagnostic Steps**:
1. Check simulation configuration
2. Verify proxy pool is configured
3. Check resource availability
4. Review error messages

**Solutions**:

**Solution 1: Validate Configuration**
- Verify all required fields are filled
- Check proxy URLs are valid
- Ensure request count is reasonable (< 1000)
- Verify target site is accessible

**Solution 2: Check Resource Limits**
```bash
# Check concurrent simulations
redis-cli GET "simulator:active_count"

# Should be < max_concurrent_simulations (default: 5)
```


**Solution 3: Clear Stuck Simulations**
```bash
# Clear active simulation count
redis-cli DEL "simulator:active_count"

# Remove stuck simulation locks
redis-cli KEYS "simulator:lock:*" | xargs redis-cli DEL
```

### Simulation Results Incomplete

**Symptoms**:
- Missing request data
- Incomplete summary statistics
- No recommendations shown

**Solutions**:

**Solution 1: Check Simulation Completion**
```bash
# Query simulation status
curl -X GET "https://your-domain.com/api/v1/admin/simulator/results/sim_xyz789"
```

**Solution 2: Review Simulation Logs**
```bash
# Check for simulation errors
tail -f logs/simulator.log | grep "sim_xyz789"
```

**Solution 3: Re-run Simulation**
- Use same configuration
- Check for consistent results
- Compare with previous runs

---

## Metrics and Analytics Issues

### Metrics Show Zero or Null Values

**Symptoms**:
- Dashboard shows 0 for all metrics
- Null values in charts
- "No data available" messages

**Diagnostic Steps**:
1. Check if data exists in database
2. Verify time range selection
3. Check metric calculation logic
4. Review database queries

**Solutions**:

**Solution 1: Verify Data Exists**
```sql
-- Check for recent sessions
SELECT COUNT(*) FROM scraping_sessions 
WHERE start_time > NOW() - INTERVAL '24 hours';

-- Check for metrics data
SELECT COUNT(*) FROM metrics_tracker
WHERE created_at > NOW() - INTERVAL '24 hours';
```

**Solution 2: Adjust Time Range**
- Select longer time range
- Check if data exists for selected period
- Try "Last 7 days" or "Last 30 days"

**Solution 3: Recalculate Metrics**
```bash
# Trigger metrics recalculation
curl -X POST "https://your-domain.com/api/v1/admin/metrics/recalculate" \
  -H "Cookie: next-auth.session-token=<token>"
```


### Charts Not Rendering

**Symptoms**:
- Empty chart areas
- "Loading..." never completes
- Chart errors in console

**Solutions**:

**Solution 1: Check Data Format**
- Verify API returns valid data
- Check data structure matches chart requirements
- Review browser console for errors

**Solution 2: Clear Chart Cache**
```javascript
// In browser console
localStorage.removeItem('chartCache');
location.reload();
```

**Solution 3: Update Chart Library**
```bash
# Update dependencies
npm update recharts
npm update chart.js
```

---

## Export Issues

### Export Not Downloading

**Symptoms**:
- Click export button, nothing happens
- Download starts but fails
- File is corrupted

**Diagnostic Steps**:
1. Check browser download settings
2. Verify disk space
3. Check file size limits
4. Review browser console

**Solutions**:

**Solution 1: Check Browser Settings**
- Verify downloads are allowed
- Check download location is writable
- Disable popup blockers
- Try different browser

**Solution 2: Reduce Export Size**
- Apply filters to reduce data
- Select shorter time range
- Export in smaller batches
- Use CSV instead of PDF for large datasets

**Solution 3: Check Server Limits**
```bash
# Check export file size
ls -lh /tmp/exports/

# Check disk space
df -h

# Check memory usage
free -h
```


### Export Takes Too Long

**Symptoms**:
- Export process times out
- Browser shows "waiting for response"
- Server becomes unresponsive

**Solutions**:

**Solution 1: Use Async Export**
- Request export via API
- Receive download link when ready
- Check email for completion notification

**Solution 2: Optimize Query**
```sql
-- Add indexes for export queries
CREATE INDEX idx_sessions_export ON scraping_sessions(start_time, tenant_id);
CREATE INDEX idx_metrics_export ON metrics_tracker(created_at);
```

**Solution 3: Increase Timeout**
```javascript
// In configuration
{
  exportTimeout: 300000 // 5 minutes
}
```

---

## Performance Issues

### Dashboard Slow to Load

**Symptoms**:
- Long initial load time (> 5 seconds)
- Slow page transitions
- Laggy interactions

**Diagnostic Steps**:
1. Check network speed
2. Measure page load time
3. Profile JavaScript performance
4. Check database query times

**Solutions**:

**Solution 1: Enable Caching**
```javascript
// In configuration
{
  enableMetricsCache: true,
  cacheTimeout: 60000 // 1 minute
}
```

**Solution 2: Optimize Database Queries**
```sql
-- Add missing indexes
CREATE INDEX idx_sessions_status ON scraping_sessions(status);
CREATE INDEX idx_sessions_tenant ON scraping_sessions(tenant_id);

-- Analyze query performance
EXPLAIN ANALYZE SELECT * FROM scraping_sessions WHERE status = 'running';
```

**Solution 3: Reduce Data Load**
- Decrease default page size
- Apply filters by default
- Use pagination
- Lazy load components


### High Memory Usage

**Symptoms**:
- Browser tab uses excessive memory
- Browser becomes slow or crashes
- "Out of memory" errors

**Solutions**:

**Solution 1: Reduce Auto-Refresh Frequency**
- Increase refresh interval to 30-60 seconds
- Disable auto-refresh when not actively monitoring
- Close unused dashboard tabs

**Solution 2: Clear Browser Data**
```bash
# Clear browser cache and data
# Chrome: Settings → Privacy → Clear browsing data
# Select: Cached images and files, Cookies
```

**Solution 3: Optimize Component Rendering**
- Use virtual scrolling for long lists
- Implement pagination
- Lazy load images and charts
- Unmount inactive components

---

## System Health Issues

### Component Showing as Unhealthy

**Symptoms**:
- Red status indicator
- Health check failures
- Component unavailable

**Diagnostic Steps**:
1. Check component logs
2. Verify service is running
3. Test connectivity
4. Check resource usage

**Solutions by Component**:

**Database (PostgreSQL)**:
```bash
# Check PostgreSQL status
sudo systemctl status postgresql

# Check connections
psql -U postgres -c "SELECT count(*) FROM pg_stat_activity;"

# Check slow queries
psql -U postgres -c "SELECT query, state FROM pg_stat_activity WHERE state != 'idle';"

# Restart if needed
sudo systemctl restart postgresql
```

**Cache (Redis)**:
```bash
# Check Redis status
sudo systemctl status redis

# Check memory usage
redis-cli info memory

# Check connected clients
redis-cli info clients

# Restart if needed
sudo systemctl restart redis
```


**Proxy Pool**:
```bash
# Check proxy health
curl -X GET "https://your-domain.com/api/v1/admin/metrics/dashboard" | jq '.data.proxies'

# Test individual proxy
curl -x http://proxy1.example.com:8080 https://httpbin.org/ip

# Review proxy logs
tail -f logs/proxy-manager.log
```

### Alerts Not Triggering

**Symptoms**:
- No alerts despite issues
- Alert count shows 0
- Missing expected notifications

**Solutions**:

**Solution 1: Check Alert Configuration**
```javascript
// Verify alert thresholds
{
  alerts: {
    proxyFailureThreshold: 0.3,
    challengeFailureThreshold: 0.3,
    blockRateThreshold: 0.3
  }
}
```

**Solution 2: Verify Alert Service**
```bash
# Check alert service logs
tail -f logs/alert-service.log

# Test alert creation
curl -X POST "https://your-domain.com/api/v1/admin/alerts/test"
```

**Solution 3: Check Notification Settings**
- Verify email settings
- Check webhook configuration
- Test notification delivery

---

## Data Inconsistency Issues

### Session Count Mismatch

**Symptoms**:
- Redis count differs from database
- Active sessions count incorrect
- Missing sessions in history

**Solutions**:

**Solution 1: Sync Redis and Database**
```bash
# Count active sessions in Redis
redis-cli KEYS "session:*" | wc -l

# Count in database
psql -U postgres -d pricepilot -c "SELECT COUNT(*) FROM scraping_sessions WHERE status IN ('running', 'paused');"

# Sync if mismatch
npm run sync-sessions
```

**Solution 2: Clean Up Stale Sessions**
```bash
# Remove expired sessions from Redis
redis-cli KEYS "session:*" | while read key; do
  ttl=$(redis-cli TTL "$key")
  if [ "$ttl" -eq -1 ]; then
    redis-cli DEL "$key"
  fi
done
```


### Metrics Don't Match Reality

**Symptoms**:
- Success rate seems wrong
- Proxy health doesn't match observations
- Challenge solve rate incorrect

**Solutions**:

**Solution 1: Recalculate Metrics**
```bash
# Trigger full metrics recalculation
npm run recalculate-metrics

# Or via API
curl -X POST "https://your-domain.com/api/v1/admin/metrics/recalculate"
```

**Solution 2: Check Data Sources**
```sql
-- Verify source data
SELECT 
  COUNT(*) as total,
  SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as successful,
  SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed
FROM scraping_sessions
WHERE start_time > NOW() - INTERVAL '24 hours';
```

**Solution 3: Clear Metric Cache**
```bash
# Clear Redis metric cache
redis-cli DEL "metrics:realtime"
redis-cli DEL "metrics:dashboard"
```

---

## Authentication and Authorization Issues

### "Unauthorized" Errors

**Symptoms**:
- 401 Unauthorized responses
- Redirected to login page
- API requests fail

**Solutions**:

**Solution 1: Re-authenticate**
- Log out completely
- Clear cookies
- Log back in
- Verify admin role

**Solution 2: Check Session**
```bash
# Verify session in database
psql -U postgres -d pricepilot -c "SELECT * FROM sessions WHERE user_id = 'user_id';"

# Check session expiry
redis-cli TTL "session:session_token"
```

**Solution 3: Verify Admin Role**
```sql
-- Check user role
SELECT id, email, role FROM users WHERE id = 'user_id';
-- Role should be 'admin' or 'super_admin'
```


### "Forbidden" Errors

**Symptoms**:
- 403 Forbidden responses
- "Insufficient permissions" messages
- Some features not accessible

**Solutions**:

**Solution 1: Verify Permissions**
```sql
-- Check user permissions
SELECT u.email, u.role, p.permission_name
FROM users u
LEFT JOIN user_permissions p ON u.id = p.user_id
WHERE u.id = 'user_id';
```

**Solution 2: Grant Admin Permissions**
```sql
-- Update user role to admin
UPDATE users SET role = 'admin' WHERE id = 'user_id';

-- Or use script
npm run promote-admin user@example.com
```

**Solution 3: Check Feature Flags**
```javascript
// Verify feature is enabled
{
  features: {
    adminDashboard: true,
    sessionControl: true,
    proxySimulator: true
  }
}
```

---

## Diagnostic Commands

### Quick Health Check

```bash
#!/bin/bash
# health-check.sh

echo "=== System Health Check ==="

# Check PostgreSQL
echo "PostgreSQL:"
pg_isready && echo "✓ Running" || echo "✗ Not running"

# Check Redis
echo "Redis:"
redis-cli ping > /dev/null && echo "✓ Running" || echo "✗ Not running"

# Check Application
echo "Application:"
pm2 list | grep pricepilot && echo "✓ Running" || echo "✗ Not running"

# Check Disk Space
echo "Disk Space:"
df -h | grep -E "/$|/var"

# Check Memory
echo "Memory:"
free -h

# Check Active Sessions
echo "Active Sessions:"
redis-cli KEYS "session:*" | wc -l
```


### Performance Profiling

```bash
#!/bin/bash
# profile-performance.sh

echo "=== Performance Profile ==="

# Database query times
echo "Slow Queries:"
psql -U postgres -d pricepilot -c "
  SELECT query, mean_exec_time, calls 
  FROM pg_stat_statements 
  ORDER BY mean_exec_time DESC 
  LIMIT 10;
"

# Redis memory usage
echo "Redis Memory:"
redis-cli info memory | grep used_memory_human

# Application metrics
echo "Application Metrics:"
curl -s "http://localhost:3000/api/v1/admin/metrics/dashboard" | jq '.data.platform'

# Response times
echo "API Response Times:"
curl -w "@curl-format.txt" -o /dev/null -s "http://localhost:3000/api/v1/admin/sessions"
```

### Log Analysis

```bash
#!/bin/bash
# analyze-logs.sh

echo "=== Log Analysis ==="

# Error count
echo "Errors (last hour):"
grep -c "ERROR" logs/application.log | tail -1000

# Most common errors
echo "Top Errors:"
grep "ERROR" logs/application.log | awk '{print $NF}' | sort | uniq -c | sort -rn | head -10

# Session failures
echo "Session Failures:"
grep "session.*failed" logs/application.log | wc -l

# Proxy failures
echo "Proxy Failures:"
grep "proxy.*failed" logs/proxy-manager.log | wc -l
```

---

## Getting Support

### Before Contacting Support

1. **Gather Information**:
   - Error messages and stack traces
   - Browser console logs
   - Network request/response logs
   - Steps to reproduce
   - Screenshots or screen recordings

2. **Run Diagnostics**:
   - Execute health check script
   - Run performance profiling
   - Analyze logs
   - Check system resources

3. **Try Common Solutions**:
   - Clear cache and cookies
   - Restart services
   - Check configuration
   - Review documentation


### Support Channels

**Email Support**:
- Email: support@pricepilot.com
- Include: Error details, logs, screenshots
- Response time: 24-48 hours

**Live Chat**:
- Available in dashboard
- Hours: 9 AM - 5 PM EST
- For urgent issues

**Community Forum**:
- URL: community.pricepilot.com
- Search existing topics
- Post detailed questions

**GitHub Issues**:
- URL: github.com/pricepilot/pricepilot
- For bug reports
- Include reproduction steps

### Emergency Contacts

**Critical System Outage**:
- Phone: +1-555-SUPPORT
- Available 24/7
- For production-down scenarios

**Security Issues**:
- Email: security@pricepilot.com
- Encrypted: Use PGP key
- Response time: < 4 hours

---

## Preventive Maintenance

### Daily Tasks

- Check system health dashboard
- Review active alerts
- Monitor resource usage
- Check for stuck sessions
- Review error logs

### Weekly Tasks

- Analyze performance trends
- Review proxy health
- Check database size
- Clean up old data
- Update documentation

### Monthly Tasks

- Review and optimize queries
- Update dependencies
- Backup configuration
- Capacity planning
- Security audit

---

*Last Updated: January 27, 2026*
*Version: 2.0.0*
