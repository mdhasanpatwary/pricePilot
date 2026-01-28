# Price Approval Workflow Implementation

## Overview
Implemented a manual approval workflow for price changes to prevent automatic price updates without tenant review.

## Problem
Previously, the system automatically pushed price changes to stores without any approval step, which could lead to unwanted price updates.

## Solution
Added a pending approval queue where all price changes are held for manual review before being applied to the store.

---

## Database Changes

### New Table: `PendingPriceChange`
Stores price change recommendations awaiting approval.

**Fields:**
- `id` - Unique identifier
- `productId` - Reference to the product
- `tenantId` - Reference to the tenant
- `currentPrice` - Current product price
- `recommendedPrice` - Recommended new price
- `reason` - Explanation for the price change
- `appliedRule` - Which pricing rule triggered this change
- `status` - PENDING | APPROVED | REJECTED | EXPIRED
- `createdAt` - When the change was created
- `reviewedAt` - When it was reviewed
- `reviewedBy` - Email of the reviewer
- `expiresAt` - When the change expires (7 days by default)

### New Enum: `ApprovalStatus`
- `PENDING` - Awaiting review
- `APPROVED` - Approved and applied
- `REJECTED` - Rejected by user
- `EXPIRED` - Expired without action

---

## Code Changes

### 1. Rules Engine (`lib/services/rules-engine.ts`)

**Modified:**
- `executePriceChanges()` - Now queues changes instead of auto-applying
  - Returns `{ queued, failed }` instead of `{ updated, failed }`
  - Creates `PendingPriceChange` records
  - Updates existing pending changes if they exist

**Added:**
- `applyApprovedChanges(changeIds, reviewedBy)` - Applies approved changes
  - Updates product prices
  - Records price history
  - Dispatches webhooks
  - Sends notifications
  - Marks changes as APPROVED

- `rejectPendingChanges(changeIds, reviewedBy)` - Rejects changes
  - Marks changes as REJECTED

- `cleanupExpiredChanges()` - Marks expired changes
  - Runs via cron job
  - Changes PENDING → EXPIRED after 7 days

### 2. Sync Orchestrator (`lib/services/sync-orchestrator.ts`)

**Modified:**
- `processFullSync()` - Updated to queue instead of push
  - Removed automatic store sync
  - Updated notification messages
  - Returns `queued` count instead of `updated`

- `processSiteSync()` - Updated to queue instead of push
  - Removed automatic store sync after rules evaluation
  - Updated log messages to mention approval

### 3. API Endpoints

**Created: `/api/v1/price-approvals`**

**GET** - Fetch pending price changes
- Query params: `status`, `page`, `limit`
- Returns paginated list of pending changes with product details

**POST** - Approve or reject changes
- Body: `{ action: "approve" | "reject", changeIds: string[] }`
- Validates tenant ownership
- Applies approved changes and pushes to stores
- Returns success/failure counts

**Created: `/api/v1/cron/cleanup-expired-approvals`**
- Runs daily at 2 AM
- Marks expired pending changes
- Requires `CRON_SECRET` authorization

### 4. Dashboard Page

**Created: `/dashboard/price-approvals`**

Features:
- View all pending price changes
- See current vs recommended prices
- Visual indicators for price increases/decreases
- Bulk select and approve/reject
- Individual approve/reject buttons
- Shows reason and applied rule
- Displays expiration time
- Real-time updates after actions

---

## User Flow

### Before (Auto-Push)
1. Sync runs → Scrapes competitor prices
2. Rules engine evaluates → Calculates new prices
3. **Prices automatically pushed to store** ❌
4. No review or approval step

### After (Manual Approval)
1. Sync runs → Scrapes competitor prices
2. Rules engine evaluates → Calculates new prices
3. **Changes queued in `PendingPriceChange` table** ✅
4. Tenant receives notification
5. **Tenant reviews changes in dashboard** ✅
6. **Tenant approves/rejects each change** ✅
7. Only approved changes pushed to store
8. Rejected changes are discarded
9. Expired changes (7 days) auto-marked as expired

---

## Configuration

### Environment Variables
Add to `.env`:
```bash
CRON_SECRET=your-secret-key-here
```

### Vercel Cron Jobs
Updated `vercel.json`:
```json
{
  "crons": [
    {
      "path": "/api/cron/global-sync",
      "schedule": "0 0 * * *"
    },
    {
      "path": "/api/v1/cron/cleanup-expired-approvals",
      "schedule": "0 2 * * *"
    }
  ]
}
```

---

## Migration Steps

1. **Run Database Migration:**
   ```bash
   npx prisma migrate dev --name add_price_approval_workflow
   ```

2. **Generate Prisma Client:**
   ```bash
   npx prisma generate
   ```

3. **Set Environment Variable:**
   Add `CRON_SECRET` to your `.env` file

4. **Deploy:**
   ```bash
   vercel --prod
   ```

5. **Test:**
   - Run a sync
   - Check `/dashboard/price-approvals`
   - Approve/reject some changes
   - Verify store updates only happen after approval

---

## API Examples

### Fetch Pending Changes
```bash
GET /api/v1/price-approvals?status=PENDING&page=1&limit=50
```

### Approve Changes
```bash
POST /api/v1/price-approvals
Content-Type: application/json

{
  "action": "approve",
  "changeIds": ["change-id-1", "change-id-2"]
}
```

### Reject Changes
```bash
POST /api/v1/price-approvals
Content-Type: application/json

{
  "action": "reject",
  "changeIds": ["change-id-3"]
}
```

---

## Benefits

✅ **No Surprise Price Changes** - All changes require explicit approval
✅ **Review Before Apply** - See exactly what will change and why
✅ **Bulk Operations** - Approve/reject multiple changes at once
✅ **Audit Trail** - Track who approved/rejected what and when
✅ **Expiration Safety** - Old recommendations expire automatically
✅ **Flexible Control** - Approve some, reject others
✅ **Clear Reasoning** - See which rule triggered each change

---

## Future Enhancements

- [ ] Add approval rules (auto-approve if change < 5%)
- [ ] Email notifications for pending approvals
- [ ] Approval delegation (assign to team members)
- [ ] Scheduled approvals (approve at specific time)
- [ ] Approval history dashboard
- [ ] Export pending changes to CSV
- [ ] Mobile app for quick approvals
- [ ] Slack integration for approval requests

---

## Testing Checklist

- [ ] Run sync and verify changes are queued
- [ ] View pending changes in dashboard
- [ ] Approve a single change
- [ ] Reject a single change
- [ ] Bulk approve multiple changes
- [ ] Bulk reject multiple changes
- [ ] Verify approved changes push to store
- [ ] Verify rejected changes don't push
- [ ] Wait 7 days and verify expiration (or manually test)
- [ ] Check audit trail in database
- [ ] Test with multiple tenants (isolation)

---

## Notes

- Changes expire after 7 days by default (configurable)
- Only PENDING changes can be approved/rejected
- Approved changes immediately push to connected stores
- Rejected changes are kept for audit purposes
- Expired changes are marked but not deleted
- All actions are logged with reviewer email
- Tenant isolation is enforced at API level
