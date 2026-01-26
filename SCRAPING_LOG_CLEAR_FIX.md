# Scraping Log Clear on New Session - Implementation

## Problem
When a new scraping/sync session started, previous logs were not being deleted. This caused old logs from previous sessions to remain visible in both tenant and admin UI consoles, making it confusing to track the current session's progress.

## Solution
Implemented automatic log clearing when a new sync session starts. Previous `SyncLog` entries are now deleted before creating new log entries for the current session.

## Changes Made

### 1. Full Tenant Sync (`lib/services/sync-orchestrator.ts`)
**Location:** `processFullSync` method (around line 175)

**Change:** Added log deletion for all competitor sites before dispatching sync jobs:
```typescript
// Clear previous logs for all competitor sites before starting new session
for (const site of competitorSites) {
  await prisma.syncLog.deleteMany({ where: { siteId: site.id } });
}
```

**Impact:** When admin triggers a full tenant sync, all competitor site logs are cleared first.

### 2. Single Site Sync (`lib/services/sync-orchestrator.ts`)
**Location:** `processSiteSync` method (around line 449)

**Status:** ✅ Already implemented correctly
```typescript
await prisma.syncLog.deleteMany({ where: { siteId } });
```

**Impact:** When a single competitor site sync is triggered, its logs are cleared first.

### 3. User Store Sync (`lib/services/sync.ts`)
**Location:** `syncSite` method (around line 43)

**Change:** Added log deletion before starting user store sync:
```typescript
// Clear previous logs before starting new sync session
await prisma.syncLog.deleteMany({ where: { siteId } });
```

**Impact:** When a user store (OpenCart, Laravel, Shopify, etc.) sync is triggered, its logs are cleared first.

## UI Impact

### Tenant UI (`/dashboard/connections`)
- The terminal-style console now shows only the current session's logs
- When sync starts, previous logs are cleared
- Users see a clean log stream for each new sync session

### Admin UI (`/admin/monitor`)
- The sync monitor shows only current session logs
- Each site's log history is cleared when a new sync starts
- Easier to track real-time progress without old log clutter

## Log Display Locations

1. **Tenant Dashboard - Connections Page**
   - File: `app/dashboard/connections/page.tsx`
   - Shows logs in a terminal-style console
   - Displays logs for syncing stores with real-time updates

2. **Admin Dashboard - Sync Monitor**
   - File: `app/admin/monitor/page.tsx`
   - API: `app/api/v1/admin/sync-monitor/route.ts`
   - Shows logs for all active sync sessions across all tenants

3. **Competitors Page**
   - File: `app/dashboard/competitors/page.tsx`
   - API: `app/api/v1/competitors/route.ts`
   - Shows logs for competitor sites

## Database Schema
```prisma
model SyncLog {
  id        String   @id @default(uuid())
  siteId    String
  message   String
  level     String   @default("INFO")
  createdAt DateTime @default(now())
  site      Site     @relation(fields: [siteId], references: [id], onDelete: Cascade)
}
```

## Testing Recommendations

1. **Test Full Tenant Sync:**
   - Start a full sync from admin panel
   - Verify all competitor site logs are cleared
   - Check that new logs appear cleanly

2. **Test Single Site Sync:**
   - Trigger sync for a single competitor site
   - Verify previous logs for that site are cleared
   - Confirm new logs display correctly

3. **Test User Store Sync:**
   - Sync a user store (e.g., Laravel, OpenCart)
   - Verify previous logs are cleared
   - Check terminal console shows only new logs

4. **Test Multiple Concurrent Syncs:**
   - Start syncs for multiple sites
   - Verify each site's logs are independent
   - Confirm logs don't mix between sites

## Notes

- Log deletion is scoped to individual sites (by `siteId`)
- Logs are deleted atomically before new session starts
- Old logs are permanently deleted (not archived)
- Log retention policy still applies (configured via `RETENTION_SYNC_LOG_DAYS`)
- The `onDelete: Cascade` in schema ensures logs are deleted when sites are deleted

## Related Files

- `lib/services/sync-orchestrator.ts` - Main sync orchestration logic
- `lib/services/sync.ts` - User store sync logic
- `app/dashboard/connections/page.tsx` - Tenant UI console
- `app/admin/monitor/page.tsx` - Admin UI monitor
- `prisma/schema.prisma` - Database schema
