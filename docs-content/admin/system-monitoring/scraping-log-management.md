---
title: "Scraping Log Management"
description: "Managing and analyzing scraping logs"
category: "system-monitoring"
tags: ["scraping", "logs", "management"]
audience: "admin"
---

# Scraping Log Management Guide

## Overview

PricePilot provides automatic and manual log management to ensure clean, focused views of scraping sessions. This guide explains how the log clearing functionality works and how to use it effectively.

## Features

### 1. Automatic Log Clearing

When a new scraping session starts, the system automatically clears completed and failed sessions for that tenant. This ensures you always see fresh logs without manual intervention.

**How it works:**
- Triggered automatically when `scrapeProductPageWithTracking()` is called
- Clears only completed and failed sessions
- Preserves active/running sessions
- Tenant-specific (only clears logs for the current tenant)
- Non-blocking (scraping continues even if clearing fails)

**Example:**
```typescript
// When you start scraping, logs are automatically cleared
const result = await scraperService.scrapeProductPageWithTracking(
  'https://example.com/product',
  'tenant-123',
  'site-456',
  'product-789',
  'My Store'
);
// Old completed/failed sessions for tenant-123 are now cleared
```

### 2. Manual Log Clearing

The Real-Time Monitor provides a "Clear Logs" button for manual log management.

**Location:** Admin Dashboard → Monitoring → Real-Time Monitor

**Features:**
- One-click clearing with confirmation dialog
- Respects tenant filter (clears only selected tenant's logs)
- Shows success message with count of cleared sessions
- Automatic refresh after clearing
- Error handling with user feedback

**How to use:**
1. Navigate to Real-Time Monitor
2. (Optional) Select a specific tenant from the filter
3. Click "Clear Logs" button
4. Confirm the action in the dialog
5. View success message showing number of cleared sessions

## API Reference

### Clear Sessions Endpoint

**Endpoint:** `POST /api/v1/admin/sessions/clear`

**Authentication:** Requires admin role

**Request Body:**
```json
{
  "tenantId": "tenant-123"  // Optional: clear only this tenant's logs
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "cleared": 5,
    "message": "Successfully cleared 5 completed/failed session(s)"
  }
}
```

**Example Usage:**
```typescript
// Clear all completed/failed sessions
const response = await fetch('/api/v1/admin/sessions/clear', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({})
});

// Clear for specific tenant
const response = await fetch('/api/v1/admin/sessions/clear', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ tenantId: 'tenant-123' })
});
```

## Programmatic Usage

### Using SessionTracker

```typescript
import { sessionTracker } from '@/lib/services/session-tracker';

// Clear completed sessions for a specific tenant
const count = await sessionTracker.clearCompletedSessions('tenant-123');
console.log(`Cleared ${count} sessions`);

// Clear all completed sessions (all tenants)
const totalCount = await sessionTracker.clearCompletedSessions();
console.log(`Cleared ${totalCount} sessions across all tenants`);
```

### Using SessionRepository

```typescript
import { sessionRepository } from '@/lib/services/session-repository';

// Direct database operation
const count = await sessionRepository.clearCompletedSessions('tenant-123');
```

## What Gets Cleared

### Cleared Sessions
- Sessions with status: `completed`
- Sessions with status: `failed`

### Preserved Sessions
- Sessions with status: `initializing`
- Sessions with status: `running`
- Sessions with status: `waiting_challenge`

### Storage Locations
- **PostgreSQL:** Deleted from `scraping_sessions` table
- **Redis:** Removed from tenant session sets and cache

## Best Practices

### 1. Let Auto-Clear Handle It
The automatic clearing feature is designed to handle most use cases. You typically don't need to manually clear logs.

### 2. Use Manual Clear for Debugging
Manual clearing is useful when:
- Testing scraping functionality
- Cleaning up after debugging sessions
- Preparing for a demo or presentation
- Investigating specific tenant issues

### 3. Tenant Filtering
When debugging a specific tenant:
1. Select the tenant in the filter
2. Clear logs to remove old data
3. Start new scraping session
4. Monitor fresh logs

### 4. Regular Cleanup
For production environments, consider:
- Using the automatic cleanup feature (runs on session start)
- Scheduling periodic cleanup via cron job
- Setting up retention policies for old sessions

## Troubleshooting

### Logs Not Clearing

**Problem:** Old logs still visible after starting new scraping

**Solutions:**
1. Check if auto-clear is enabled in scraper service
2. Verify tenant ID is correct
3. Check logs for clearing errors
4. Try manual clear via UI

### Clear Operation Fails

**Problem:** "Clear Logs" button shows error

**Solutions:**
1. Check authentication (must be admin)
2. Verify database connection
3. Check Redis connection
4. Review server logs for detailed error

### Sessions Reappear After Clearing

**Problem:** Cleared sessions show up again

**Possible Causes:**
1. Active sessions completing after clear
2. Redis cache not properly cleared
3. Multiple browser tabs with stale data

**Solutions:**
1. Refresh the page
2. Clear browser cache
3. Check Redis connection
4. Verify session status before clearing

## Performance Considerations

### Database Impact
- Clearing uses `DELETE` operation with indexed filters
- Minimal impact on database performance
- Runs asynchronously (doesn't block scraping)

### Redis Impact
- Removes entries from Redis sets
- Clears cached session data
- Fast operation (< 100ms typically)

### UI Impact
- Automatic refresh after clearing
- Loading states prevent duplicate operations
- Success messages provide feedback

## Security

### Authentication
- Requires admin role for API access
- Session-based authentication
- CSRF protection enabled

### Authorization
- Admins can clear any tenant's logs
- Regular users cannot access clear functionality
- Audit logging for all clear operations

### Data Protection
- Confirmation required for manual clearing
- Soft delete option available (future enhancement)
- Backup recommendations before bulk operations

## Monitoring

### Logs
All clearing operations are logged:
```
[SessionTracker] Completed sessions cleared { count: 5, tenantId: 'tenant-123' }
[ScraperService] Auto-cleared 5 completed/failed sessions for tenant tenant-123
```

### Metrics
Track clearing operations:
- Number of sessions cleared
- Clearing frequency
- Errors during clearing
- Time taken for clearing

## Future Enhancements

### Planned Features
1. **Scheduled Cleanup:** Cron job for automatic cleanup
2. **Retention Policies:** Configure how long to keep completed sessions
3. **Selective Clearing:** Clear by date range or specific criteria
4. **Archive Feature:** Archive instead of delete
5. **Bulk Operations:** Clear logs for multiple tenants at once

### Configuration Options (Future)
```typescript
// Example future configuration
{
  autoClear: {
    enabled: true,
    retentionDays: 7,
    statuses: ['completed', 'failed'],
    schedule: '0 0 * * *' // Daily at midnight
  }
}
```

## Related Documentation

- [Session Tracking](./SESSION_TRACKING.md)
- [Real-Time Monitoring](./MONITORING_UI.md)
- [Admin Dashboard Guide](./ADMIN_GUIDE.md)
- [API Reference](./ADMIN_API_REFERENCE.md)

## Support

For issues or questions:
1. Check server logs for detailed errors
2. Review this documentation
3. Contact system administrator
4. File a bug report with reproduction steps
