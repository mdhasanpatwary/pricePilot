# Price Approval Workflow - Visual Flow

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         SYNC PROCESS                             │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  1. Scrape Competitor Prices                                     │
│     • Visit competitor sites                                     │
│     • Extract product prices                                     │
│     • Update competitor product records                          │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  2. Evaluate Pricing Rules                                       │
│     • Load active pricing rules                                  │
│     • Compare your prices vs competitors                         │
│     • Calculate recommended prices                               │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  3. Queue Price Changes (NEW!)                                   │
│     • Create PendingPriceChange records                          │
│     • Set expiration (7 days)                                    │
│     • Send notification to tenant                                │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    MANUAL REVIEW REQUIRED                        │
│                                                                   │
│  Tenant visits: /dashboard/price-approvals                       │
└─────────────────────────────────────────────────────────────────┘
                              │
                    ┌─────────┴─────────┐
                    ▼                   ▼
        ┌───────────────────┐   ┌───────────────────┐
        │   APPROVE         │   │   REJECT          │
        └───────────────────┘   └───────────────────┘
                    │                   │
                    ▼                   ▼
        ┌───────────────────┐   ┌───────────────────┐
        │ Update Product    │   │ Keep Current      │
        │ Push to Store     │   │ Price             │
        │ Record History    │   │ Mark Rejected     │
        └───────────────────┘   └───────────────────┘
```

## Data Flow

```
┌──────────────┐
│   Product    │
│   (Your      │
│   Store)     │
└──────┬───────┘
       │
       │ has many
       ▼
┌──────────────────────┐
│  PendingPriceChange  │
│  ─────────────────── │
│  • currentPrice      │
│  • recommendedPrice  │
│  • reason            │
│  • status            │
│  • expiresAt         │
└──────┬───────────────┘
       │
       │ belongs to
       ▼
┌──────────────┐
│   Tenant     │
└──────────────┘
```

## Status Lifecycle

```
┌─────────┐
│ PENDING │ ◄─── Created by sync process
└────┬────┘
     │
     ├──────────────┐
     │              │
     ▼              ▼
┌──────────┐   ┌──────────┐
│ APPROVED │   │ REJECTED │
└──────────┘   └──────────┘
     │              │
     │              │
     ▼              ▼
  Applied      Discarded
  to Store
     
     │
     ▼ (after 7 days)
┌─────────┐
│ EXPIRED │ ◄─── Cleaned up by cron
└─────────┘
```

## User Journey

```
┌─────────────────────────────────────────────────────────────────┐
│  STEP 1: Notification                                            │
│  ─────────────────────────────────────────────────────────────  │
│  "Sync complete! 15 price changes queued for your review."      │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  STEP 2: Navigate to Dashboard                                   │
│  ─────────────────────────────────────────────────────────────  │
│  Dashboard → Price Approvals                                     │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  STEP 3: Review Changes                                          │
│  ─────────────────────────────────────────────────────────────  │
│  ┌────────────────────────────────────────────────────────┐    │
│  │ Product: iPhone 15 Pro                                  │    │
│  │ Current: $999.00 → Recommended: $949.00 (-5%)          │    │
│  │ Reason: Undercut competitor by $50.00                  │    │
│  │ Rule: UNDERCUT                                          │    │
│  │ [Approve] [Reject]                                      │    │
│  └────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
                              │
                    ┌─────────┴─────────┐
                    ▼                   ▼
┌─────────────────────────────┐   ┌─────────────────────────────┐
│  STEP 4A: Approve           │   │  STEP 4B: Reject            │
│  ─────────────────────────  │   │  ─────────────────────────  │
│  Click "Approve"            │   │  Click "Reject"             │
│  ↓                          │   │  ↓                          │
│  Price updated in store     │   │  Price stays unchanged      │
│  ↓                          │   │  ↓                          │
│  Success notification       │   │  Rejection recorded         │
└─────────────────────────────┘   └─────────────────────────────┘
```

## API Request Flow

```
┌──────────────┐
│   Browser    │
└──────┬───────┘
       │
       │ GET /api/v1/price-approvals?status=PENDING
       ▼
┌──────────────────────┐
│   API Endpoint       │
│   ───────────────    │
│   • Authenticate     │
│   • Validate tenant  │
│   • Query database   │
└──────┬───────────────┘
       │
       │ Returns: { changes: [...], pagination: {...} }
       ▼
┌──────────────┐
│   Browser    │
│   Displays   │
│   Changes    │
└──────┬───────┘
       │
       │ POST /api/v1/price-approvals
       │ { action: "approve", changeIds: [...] }
       ▼
┌──────────────────────┐
│   API Endpoint       │
│   ───────────────    │
│   • Validate IDs     │
│   • Apply changes    │
│   • Push to store    │
└──────┬───────────────┘
       │
       │ Returns: { updated: 5, failed: 0 }
       ▼
┌──────────────┐
│   Browser    │
│   Shows      │
│   Success    │
└──────────────┘
```

## Database Operations

```
┌─────────────────────────────────────────────────────────────────┐
│  CREATE (During Sync)                                            │
│  ─────────────────────────────────────────────────────────────  │
│  INSERT INTO PendingPriceChange (                                │
│    productId, tenantId, currentPrice, recommendedPrice,          │
│    reason, appliedRule, status, expiresAt                        │
│  ) VALUES (...)                                                  │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  READ (Dashboard View)                                           │
│  ─────────────────────────────────────────────────────────────  │
│  SELECT * FROM PendingPriceChange                                │
│  WHERE tenantId = ? AND status = 'PENDING'                       │
│  ORDER BY createdAt DESC                                         │
│  LIMIT 50 OFFSET 0                                               │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  UPDATE (Approval)                                               │
│  ─────────────────────────────────────────────────────────────  │
│  BEGIN TRANSACTION;                                              │
│    UPDATE Product SET currentPrice = ? WHERE id = ?;             │
│    INSERT INTO PriceHistory (productId, price) VALUES (?, ?);    │
│    UPDATE PendingPriceChange                                     │
│      SET status = 'APPROVED', reviewedAt = NOW(),                │
│          reviewedBy = ?                                          │
│      WHERE id = ?;                                               │
│  COMMIT;                                                         │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  CLEANUP (Cron Job)                                              │
│  ─────────────────────────────────────────────────────────────  │
│  UPDATE PendingPriceChange                                       │
│  SET status = 'EXPIRED'                                          │
│  WHERE status = 'PENDING' AND expiresAt < NOW()                  │
└─────────────────────────────────────────────────────────────────┘
```

## Security Flow

```
┌──────────────┐
│   Request    │
└──────┬───────┘
       │
       ▼
┌──────────────────────┐
│  Authentication      │
│  ─────────────────   │
│  • Check session     │
│  • Verify user       │
└──────┬───────────────┘
       │
       ▼
┌──────────────────────┐
│  Authorization       │
│  ─────────────────   │
│  • Check tenant ID   │
│  • Verify ownership  │
└──────┬───────────────┘
       │
       ▼
┌──────────────────────┐
│  Validation          │
│  ─────────────────   │
│  • Validate input    │
│  • Check status      │
└──────┬───────────────┘
       │
       ▼
┌──────────────────────┐
│  Execution           │
│  ─────────────────   │
│  • Process request   │
│  • Update database   │
└──────┬───────────────┘
       │
       ▼
┌──────────────┐
│   Response   │
└──────────────┘
```

## Cron Job Schedule

```
Time (UTC)    Job                              Action
─────────────────────────────────────────────────────────────
00:00         /api/cron/global-sync            Run full sync
                                                ↓
                                                Queue price changes

02:00         /api/v1/cron/cleanup-expired     Mark expired changes
              -approvals                        ↓
                                                PENDING → EXPIRED
```

## Error Handling

```
┌─────────────────────────────────────────────────────────────────┐
│  Approval Request                                                │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
                    ┌─────────────────┐
                    │  Validate Input │
                    └────────┬────────┘
                             │
                    ┌────────┴────────┐
                    │                 │
                    ▼                 ▼
            ┌───────────┐      ┌──────────┐
            │  Valid    │      │ Invalid  │
            └─────┬─────┘      └────┬─────┘
                  │                 │
                  ▼                 ▼
        ┌─────────────────┐   ┌──────────────┐
        │ Check Ownership │   │ Return 400   │
        └────────┬────────┘   │ Bad Request  │
                 │            └──────────────┘
        ┌────────┴────────┐
        │                 │
        ▼                 ▼
  ┌──────────┐     ┌──────────┐
  │  Owned   │     │ Not Owned│
  └────┬─────┘     └────┬─────┘
       │                │
       ▼                ▼
┌─────────────┐   ┌──────────────┐
│ Apply       │   │ Return 403   │
│ Changes     │   │ Forbidden    │
└──────┬──────┘   └──────────────┘
       │
       ▼
┌─────────────────┐
│ Return Success  │
└─────────────────┘
```

## Performance Considerations

```
┌─────────────────────────────────────────────────────────────────┐
│  Database Indexes                                                │
│  ─────────────────────────────────────────────────────────────  │
│  • (tenantId, status) - Fast filtering                          │
│  • (productId) - Quick lookups                                  │
│  • (expiresAt) - Efficient cleanup                              │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  Pagination                                                      │
│  ─────────────────────────────────────────────────────────────  │
│  • Default: 50 items per page                                   │
│  • Prevents loading thousands of records                        │
│  • Improves UI responsiveness                                   │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  Bulk Operations                                                 │
│  ─────────────────────────────────────────────────────────────  │
│  • Process multiple changes in one request                      │
│  • Reduces API calls                                            │
│  • Faster for users                                             │
└─────────────────────────────────────────────────────────────────┘
```

---

This visual flow diagram helps understand how the price approval workflow operates at different levels - from high-level system architecture to detailed database operations.
