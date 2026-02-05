---
title: "Price Approval Guide"
description: "Complete guide to the price approval workflow"
category: "pricing"
tags: ["pricing", "approval", "workflow"]
audience: "tenant"
---

# Price Approval Guide

## What is Price Approval?

Price Approval is a safety feature that prevents automatic price changes to your store. Instead of immediately updating prices, PricePilot queues all price changes for your review and approval.

## Why Use Price Approval?

- **Control**: You decide which price changes to apply
- **Safety**: No surprise price updates
- **Flexibility**: Approve some changes, reject others
- **Transparency**: See exactly why each price change is recommended

## How It Works

### 1. Automatic Sync
PricePilot runs its normal sync process:
- Scrapes competitor prices
- Evaluates your pricing rules
- Calculates recommended prices

### 2. Changes Queued
Instead of immediately updating your store, all price changes are:
- Saved to a pending approval queue
- Visible in your dashboard
- Held for up to 7 days

### 3. Review & Approve
You review each change and decide:
- **Approve**: Apply the price change to your store
- **Reject**: Keep the current price
- **Ignore**: Let it expire after 7 days

### 4. Store Update
Only approved changes are pushed to your store.

## Using the Price Approval Dashboard

### Access
Navigate to: **Dashboard → Price Approvals**

### View Pending Changes
Each pending change shows:
- Product name and image
- Current price
- Recommended price
- Percentage change (increase/decrease)
- Reason for the change
- Which pricing rule triggered it
- When it was created
- When it expires

### Approve Changes

**Single Approval:**
1. Click "Approve" button on any change
2. Confirm the action
3. Price is immediately updated in your store

**Bulk Approval:**
1. Check the boxes next to multiple changes
2. Click "Approve Selected (X)"
3. All selected changes are applied at once

### Reject Changes

**Single Rejection:**
1. Click "Reject" button on any change
2. Change is marked as rejected
3. Your current price remains unchanged

**Bulk Rejection:**
1. Check the boxes next to multiple changes
2. Click "Reject Selected (X)"
3. All selected changes are rejected

### Select All
Click "Select All" to quickly select all pending changes on the current page.

## Understanding Price Changes

### Price Increase (Red Badge)
- Shows as `+X%`
- Usually triggered by:
  - Competitor out of stock
  - Inventory hike rules
  - Margin protection rules

### Price Decrease (Green Badge)
- Shows as `-X%`
- Usually triggered by:
  - Competitor price drop
  - Undercut rules
  - Match competitor rules

### Change Reason
Each change includes a reason like:
- "Undercut competitor by $5.00"
- "Match competitor price"
- "Competitor is Out of Stock. Increasing price by 10%"
- "Be 5% cheaper than competitor"

## Expiration

### 7-Day Window
- Changes expire after 7 days
- Expired changes are automatically marked
- You can still view expired changes for reference

### Why Expiration?
- Competitor prices may have changed
- Recommendations become outdated
- Keeps your queue clean and relevant

## Best Practices

### Daily Review
Check your pending approvals daily to:
- Stay competitive
- Catch opportunities quickly
- Keep your queue manageable

### Bulk Operations
Use bulk approve/reject for:
- Similar products
- Trusted pricing rules
- Small percentage changes

### Individual Review
Review individually for:
- Large price changes
- High-value products
- Unusual recommendations

### Set Pricing Rules Wisely
Configure your pricing rules to:
- Generate fewer unnecessary changes
- Focus on important products
- Match your business strategy

## Notifications

You'll receive notifications when:
- New price changes are queued
- Sync completes with pending approvals
- Changes are about to expire (coming soon)

## API Access

Developers can access the approval system via API:

### Get Pending Changes
```bash
GET /api/v1/price-approvals?status=PENDING&page=1&limit=50
```

### Approve Changes
```bash
POST /api/v1/price-approvals
{
  "action": "approve",
  "changeIds": ["id1", "id2"]
}
```

### Reject Changes
```bash
POST /api/v1/price-approvals
{
  "action": "reject",
  "changeIds": ["id3"]
}
```

## Troubleshooting

### No Pending Changes?
- Check if sync has run recently
- Verify pricing rules are active
- Ensure products are matched with competitors

### Changes Not Applying?
- Check your store integration is connected
- Verify API token is valid
- Check sync logs for errors

### Too Many Pending Changes?
- Review your pricing rules
- Increase thresholds to reduce noise
- Use bulk operations to clear queue

## FAQ

**Q: Can I disable the approval workflow?**
A: Not currently. This is a safety feature to prevent unwanted price changes.

**Q: What happens to expired changes?**
A: They're marked as expired but kept for audit purposes. They won't be applied.

**Q: Can I approve changes automatically?**
A: Not yet, but auto-approval rules are planned (e.g., auto-approve if change < 5%).

**Q: How do I know which changes to approve?**
A: Review the reason, check competitor prices, and consider your business goals.

**Q: Can I undo an approval?**
A: No, once approved and pushed to your store, you'll need to manually adjust the price.

**Q: Do rejected changes come back?**
A: No, but the next sync may generate a new recommendation if conditions still apply.

## Support

Need help? Contact support or check:
- [Documentation](/docs)
- [API Reference](/dashboard/developers/docs)
- [Pricing Rules Guide](/docs/pricing-rules)
