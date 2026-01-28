# 🎯 PricePilot System Clarification

> **Date:** January 28, 2026
> **Purpose:** Clarify system goals, current status, and refinements needed

---

## 📌 System Goal

**PricePilot is a competitive pricing automation platform for e-commerce businesses.**

It helps online merchants stay competitive by:
1. Automatically monitoring competitor prices
2. Applying intelligent pricing rules
3. Updating store prices via API integrations

---

## 🔄 Main Workflow

```
┌─────────────────────────────────────────────────────────────┐
│                     PRICEPILOT WORKFLOW                      │
└─────────────────────────────────────────────────────────────┘

1. SYNC PRODUCTS FROM YOUR STORE
   ↓
   • Fetch product catalog via API (OpenCart/Laravel)
   • Store in PricePilot database
   • Extract: name, SKU, price, brand, model

2. SEARCH & SCRAPE COMPETITOR PRODUCTS
   ↓
   • Search competitor sites for matching products
   • Use advanced stealth scraping (proxies, human simulation)
   • Extract: title, price, availability, specs

3. ANALYZE & MATCH PRODUCTS
   ↓
   • Auto-match by SKU (exact match)
   • Auto-match by Brand + Model
   • Manual matching (user override)

4. APPLY PRICING RULES
   ↓
   • Undercut: Stay below competitor by X%
   • Match: Same price as competitor
   • Margin Lock: Maintain minimum profit
   • Threshold: Set min/max boundaries

5. UPDATE STORE PRICES
   ↓
   • Push price changes back to store via API
   • Log all changes for audit trail
   • Send notifications if configured
```

---

## ⏰ Scraping Frequency

### CLARIFICATION: 24 Hours, NOT 15 Minutes

**Current Implementation:**
- Scraping runs **every 24 hours** (daily)
- Configured in `vercel.json` cron job: `"schedule": "0 0 * * *"`
- Scheduler API shows: `"Every 24 hours"`

**Documentation Status:**
- ✅ All documentation has been updated to reflect 24-hour frequency
- ✅ UI components updated to show correct schedule
- ✅ Integration guides updated

**Configuration Files:**
```json
// vercel.json
{
  "crons": [
    {
      "path": "/api/cron/global-sync",
      "schedule": "0 0 * * *"  // Daily at midnight
    }
  ]
}
```

```typescript
// app/api/v1/admin/scheduler/route.ts
{
  id: "sync-all",
  name: "Global Price Sync",
  schedule: "Every 24 hours",  // Correct
  ...
}
```

---

## 🔌 Platform Integrations

### Current Status

| Platform | Status | Notes |
|----------|--------|-------|
| **OpenCart** | ✅ Fully Implemented | Complete extension with API endpoints, admin panel, sync functionality, **price update API working** |
| **Laravel** | ⚠️ Package Exists | Integration package available with **price update API**, but not primary focus |
| **Shopify** | ❌ Not Implemented | Mentioned in docs but not built |
| **WooCommerce** | ❌ Not Implemented | Mentioned in docs but not built |
| **Magento** | ❌ Not Implemented | Mentioned in docs but not built |
| **PrestaShop** | ❌ Not Implemented | Mentioned in docs but not built |
| **BigCommerce** | ❌ Not Implemented | Mentioned in docs but not built |

### OpenCart Integration Details

**Location:** `integrations/opencart/`

**Features:**
- ✅ API endpoints for product sync
- ✅ API endpoints for price updates
- ✅ Admin panel for configuration
- ✅ Token-based authentication
- ✅ Variant/option price support
- ✅ Image synchronization
- ✅ Category synchronization
- ✅ Special pricing support
- ✅ Notification system

**Completion Checkpoints:**
- CHECKPOINT_20_FINAL_SUMMARY.md
- TASK_21_2_VARIANT_PRICE_UPDATE_COMPLETE.md
- TASK_22_IMAGE_SYNC_COMPLETE.md
- TASK_23_CATEGORY_SYNC_COMPLETE.md
- TASK_24_SPECIAL_PRICING_COMPLETE.md
- TASK_25_NOTIFICATION_SYSTEM_COMPLETE.md

**Price Update Implementation:**
- ✅ API endpoint: `/index.php?route=api/pricepilot/update`
- ✅ Bulk update endpoint: `/index.php?route=api/pricepilot/bulk-update`
- ✅ PriceService for updating product prices
- ✅ Validation and error handling
- ✅ Logging and audit trail
- ✅ Support for store-specific pricing
- ✅ Support for variant/option prices

**Laravel Integration:**
- ✅ API endpoint: `/api/pricepilot/update`
- ✅ Token-based authentication
- ✅ Event firing on price updates
- ✅ Configurable table/column mapping

---

## ⚠️ Refinements Needed

### 1. Scraping Log Management

**Issue:**
When a new scraping session starts, previous logs should be cleared and only new session logs should be displayed.

**Current Behavior:**
- Logs accumulate across sessions
- Hard to distinguish between old and new scraping attempts
- UI shows mixed logs from multiple sessions

**Desired Behavior:**
- Clear previous session logs when new scraping starts
- Show only current session logs in real-time
- Archive old logs for historical reference (don't delete permanently)

**Implementation Location:**
- `lib/services/session-tracker.ts` - Session management
- `lib/services/scraper.ts` - Scraping service
- Admin monitoring dashboards

---

### 2. Result Selection Logic

**Issue:**
When scraper searches a competitor site and gets multiple results, the logic for selecting the "best" match needs to be documented and potentially improved.

**Current Implementation:**
The scraper uses multiple extraction strategies in order:
1. JSON-LD structured data
2. Open Graph meta tags
3. CSS selectors (site-specific)
4. Heuristic extraction (fallback)

**Questions to Answer:**
- How does the system choose between multiple search results?
- What scoring/ranking algorithm is used?
- How are confidence levels calculated?
- What happens when multiple products match the search query?

**Potential Improvements:**
- Implement confidence scoring for matches
- Add fuzzy matching for product names
- Consider price range validation
- Add brand/model verification
- Log match quality metrics

**Files to Review:**
- `lib/services/scraper.ts` - Main scraping logic
- `lib/services/matching.ts` - Product matching service
- `lib/services/validation.ts` - Product validation

---

## 💰 Price Update Implementation (VERIFIED ✅)

### Overview
**YES, price updates to stores are fully implemented and working!**

The system automatically pushes price changes back to your store after applying pricing rules.

### Price Update Flow

```
┌─────────────────────────────────────────────────────────────┐
│                  PRICE UPDATE WORKFLOW                       │
└─────────────────────────────────────────────────────────────┘

1. SCRAPE COMPETITOR PRICES
   ↓
   • Get latest prices from competitor sites
   • Store in database

2. APPLY PRICING RULES
   ↓
   • RulesEngine.executePriceChanges()
   • Calculate new prices based on rules
   • Update local database

3. PUSH TO EXTERNAL STORE (AUTOMATED)
   ↓
   • SyncService.syncProductsToStore()
   • ⚠️ **NO APPROVAL STEP - PUSHES AUTOMATICALLY**
   • For each product with price change:
     - OpenCart: POST to /api/pricepilot/update
     - Laravel: POST to /api/pricepilot/update
   • Update store prices via API

4. LOG & NOTIFY
   ↓
   • Create price history record
   • Log update in audit trail
   • Send notification to user
```

### Implementation Details

**1. Automated Price Push (After Scraping)**
- **Location:** `lib/services/sync-orchestrator.ts`
- **Trigger:** After pricing rules are applied
- **Code:**
```typescript
// After applying pricing rules
for (const site of userSites) {
  if (site.platform === "OPENCART" || site.platform === "LARAVEL") {
    await SyncService.syncProductsToStore(site.id);
  }
}
```

**2. Manual Bulk Update (User-Triggered)**
- **API Endpoint:** `POST /api/v1/price-update/bulk`
- **Location:** `app/api/v1/price-update/bulk/route.ts`
- **Service:** `UpdateExecutionService.executeBulkUpdate()`
- **Features:**
  - Update multiple products at once
  - Apply fixed or percentage-based pricing
  - Set minimum price safety valve
  - Transaction-based (atomic updates)

**3. OpenCart Price Update API**
- **Endpoint:** `/index.php?route=api/pricepilot/update`
- **Method:** POST
- **Authentication:** API token
- **Payload:**
```json
{
  "product_id": "123",
  "price": "99.99",
  "store_id": 0  // optional
}
```
- **Features:**
  - Validates product ID and price
  - Updates product price in OpenCart database
  - Supports variant/option prices
  - Returns old and new price
  - Logs all updates

**4. Laravel Price Update API**
- **Endpoint:** `/api/pricepilot/update`
- **Method:** POST
- **Authentication:** X-PricePilot-Token header
- **Payload:**
```json
{
  "product_id": "123",
  "price": "99.99"
}
```
- **Features:**
  - Configurable table/column mapping
  - Fires Laravel events on update
  - Logs all changes
  - Supports custom logic via events

### Code Locations

**Core Services:**
- `lib/services/sync.ts` - `syncProductsToStore()`, `updateOpenCartPrice()`, `updateLaravelPrice()`
- `lib/services/execution.ts` - `executeBulkUpdate()` (manual updates)
- `lib/services/rules-engine.ts` - `executePriceChanges()` (apply rules)
- `lib/services/sync-orchestrator.ts` - Orchestrates the full sync flow

**API Endpoints:**
- `app/api/v1/price-update/bulk/route.ts` - Manual bulk update endpoint
- `integrations/opencart/catalog/controller/api/pricepilot.php` - OpenCart update endpoint
- `integrations/laravel/src/Http/Controllers/PricePilotController.php` - Laravel update endpoint

**Database Tracking:**
- `PriceUpdateLog` - Logs all update attempts (success/failure)
- `PriceHistory` - Historical price tracking
- `AuditLog` - Audit trail for compliance

### Error Handling

**Retry Logic:**
- Automatic retry with exponential backoff
- Rate limit detection (429 status)
- Loop detection (508 status)
- Timeout handling (10 second timeout)

**Failure Handling:**
- Failed updates are logged in `PriceUpdateLog`
- Error details stored for debugging
- User notifications on failures
- Manual retry available

### Verification

**How to Test:**
1. Set up OpenCart or Laravel integration
2. Configure pricing rules
3. Run sync: `POST /api/v1/admin/scheduler` with `action: "run"`, `taskId: "sync-all"`
4. Check store prices - they should update automatically
5. Check logs in admin dashboard

**Monitoring:**
- Admin Dashboard → Monitoring → Real-Time Monitor
- View active sync sessions
- See price update status
- Check error logs

---

## ❌ CRITICAL MISSING FEATURE: Manual Approval Workflow

### Current Behavior (PROBLEM)

**Prices are automatically pushed to stores WITHOUT tenant approval!**

After scraping and applying pricing rules, the system immediately pushes price changes to the store:

```typescript
// lib/services/sync-orchestrator.ts (lines 333-337)
for (const site of userSites) {
  if (site.platform === "OPENCART" || site.platform === "LARAVEL") {
    await SyncService.syncProductsToStore(site.id);  // ⚠️ NO APPROVAL CHECK
  }
}
```

**This means:**
- Tenant has NO chance to review price changes
- Prices update automatically after every sync
- No manual control over which prices to apply
- Risky for business - could push incorrect prices

### Required Solution

**Add a manual approval workflow:**

1. **After pricing rules are applied:**
   - Save recommended price changes to database
   - Mark as "PENDING_APPROVAL"
   - Do NOT push to store yet

2. **Show approval UI to tenant:**
   - Display list of pending price changes
   - Show: Product, Current Price, New Price, Change %, Reason
   - Allow tenant to:
     - ✅ Approve individual changes
     - ❌ Reject individual changes
     - ✅ Approve all
     - ❌ Reject all

3. **Only push approved changes:**
   - When tenant clicks "Approve"
   - Mark as "APPROVED"
   - Then call `SyncService.syncProductsToStore()`
   - Push only approved prices to store

### Implementation Requirements

**1. Database Schema Changes:**

Add new table `PendingPriceChange`:
```prisma
model PendingPriceChange {
  id              String   @id @default(uuid())
  productId       String
  tenantId        String
  currentPrice    Decimal  @db.Decimal(10, 2)
  recommendedPrice Decimal @db.Decimal(10, 2)
  changePercent   Decimal  @db.Decimal(5, 2)
  reason          String   // e.g., "Undercut competitor by 5%"
  ruleId          String?  // Which pricing rule triggered this
  status          PriceChangeStatus @default(PENDING)
  reviewedBy      String?
  reviewedAt      DateTime?
  createdAt       DateTime @default(now())
  expiresAt       DateTime // Auto-expire after 24 hours
  
  product         Product  @relation(...)
  tenant          Tenant   @relation(...)
  
  @@index([tenantId, status])
  @@index([expiresAt])
}

enum PriceChangeStatus {
  PENDING
  APPROVED
  REJECTED
  EXPIRED
}
```

**2. Service Layer Changes:**

```typescript
// lib/services/sync-orchestrator.ts
// BEFORE (current - wrong):
await SyncService.syncProductsToStore(site.id);

// AFTER (correct):
await PriceApprovalService.createPendingChanges(recommendations);
// Don't push to store yet - wait for approval
```

**3. New Service: PriceApprovalService**

```typescript
// lib/services/price-approval.ts
export class PriceApprovalService {
  // Create pending price changes
  static async createPendingChanges(recommendations) {
    // Save to PendingPriceChange table
    // Set status = PENDING
    // Set expiresAt = now + 24 hours
  }
  
  // Get pending changes for tenant
  static async getPendingChanges(tenantId) {
    // Return all PENDING changes
  }
  
  // Approve price changes
  static async approveChanges(changeIds, userId) {
    // Update status = APPROVED
    // Set reviewedBy, reviewedAt
    // Push to store via SyncService
  }
  
  // Reject price changes
  static async rejectChanges(changeIds, userId) {
    // Update status = REJECTED
    // Don't push to store
  }
  
  // Auto-expire old pending changes
  static async expirePendingChanges() {
    // Update status = EXPIRED where expiresAt < now
  }
}
```

**4. API Endpoints:**

```typescript
// app/api/v1/price-approvals/route.ts
GET  /api/v1/price-approvals        // List pending changes
POST /api/v1/price-approvals/approve // Approve selected changes
POST /api/v1/price-approvals/reject  // Reject selected changes
```

**5. UI Component:**

```typescript
// app/dashboard/price-approvals/page.tsx
// Show table of pending price changes
// Checkboxes to select changes
// "Approve Selected" button
// "Reject Selected" button
// "Approve All" button
```

**6. Settings Toggle:**

Add tenant setting to enable/disable auto-approval:

```prisma
model Tenant {
  // ... existing fields
  autoApprovePrices Boolean @default(false)
}
```

If `autoApprovePrices = true`, skip approval workflow (current behavior)
If `autoApprovePrices = false`, require manual approval (new behavior)

### User Flow

```
1. System scrapes competitor prices (every 24 hours)
   ↓
2. Apply pricing rules
   ↓
3. Create pending price changes (status = PENDING)
   ↓
4. Send notification to tenant: "5 price changes pending approval"
   ↓
5. Tenant reviews changes in dashboard
   ↓
6. Tenant approves/rejects changes
   ↓
7. System pushes ONLY approved changes to store
   ↓
8. Send notification: "3 prices updated, 2 rejected"
```

### Benefits

- ✅ Tenant has full control over price changes
- ✅ Can review before applying
- ✅ Prevents accidental price updates
- ✅ Audit trail of who approved what
- ✅ Can reject bad recommendations
- ✅ Optional auto-approval for advanced users

### Priority

**HIGH PRIORITY** - This is a critical business feature. Automatically pushing prices without approval is risky and could cause financial loss.

---

## 📊 Current System Status

### ✅ Completed Features

**Core Scraping Engine:**
- ✅ Advanced stealth capabilities (proxies, user agents, human simulation)
- ✅ Challenge detection and handling (Cloudflare, PerimeterX, DataDome)
- ✅ Captcha solving integration (2Captcha)
- ✅ Retry queue with exponential backoff
- ✅ Concurrency limiting and rate limiting
- ✅ Session tracking and lifecycle management
- ✅ Metrics tracking and aggregation

**Multi-Tenant Architecture:**
- ✅ JWT-based authentication
- ✅ Role-based access control (Admin, Tenant)
- ✅ Tenant isolation and data security
- ✅ API key management

**Admin Monitoring:**
- ✅ Real-time scraping monitor
- ✅ Proxy health dashboard
- ✅ Challenge statistics dashboard
- ✅ Scraping metrics dashboard
- ✅ System health monitor
- ✅ Tenant debug view

**Integrations:**
- ✅ OpenCart extension (fully featured)
- ✅ Laravel package (basic implementation)

**Pricing Engine:**
- ✅ Rules engine (undercut, match, margin lock, threshold)
- ✅ Execution engine for price updates
- ✅ **Automated price push to stores (OpenCart & Laravel)**
- ✅ Manual bulk update via API
- ✅ Audit logging
- ✅ Price history tracking

**Analytics:**
- ✅ Position summary (cheapest/neutral/expensive)
- ✅ Price trend charts
- ✅ Competitor comparison
- ✅ Performance metrics

### ⏸️ Ignored Features (Not Needed Now)

- ❌ Scheduled reports (PDF/CSV email dumps)
- ❌ Multi-currency support (planned for v2.0)
- ❌ AI-powered dynamic pricing (planned for v1.2)

### ⚠️ Needs Refinement

- ⚠️ Scraping log management (clear old logs on new session)
- ⚠️ Result selection logic (document and improve matching algorithm)
- ⚠️ Documentation updates (fix 15-minute vs 24-hour discrepancy)
- ❌ **CRITICAL: Manual Approval Workflow Missing** - Prices are automatically pushed to stores without tenant review/approval

---

## 📝 Action Items

### High Priority

1. **Update Documentation**
   - Fix scraping frequency in README.md (15 min → 24 hours)
   - Fix scraping frequency in DOCUMENTATION.md (15 min → 24 hours)
   - Update all references to supported platforms (only OpenCart is fully implemented)

2. **Scraping Log Management**
   - Implement log clearing on new session start
   - Add session-based log filtering in UI
   - Archive old logs instead of deleting

3. **Document Result Selection Logic**
   - Document current matching algorithm
   - Add confidence scoring system
   - Implement match quality metrics

### Medium Priority

4. **Integration Site Data Updates**
   - Document how integration site data gets updated
   - Add API documentation for sync endpoints
   - Create troubleshooting guide

5. **Error Handling**
   - Add more descriptive error messages
   - Improve retry logic feedback
   - Add user-friendly error explanations

### Low Priority

6. **Testing**
   - Remove pre-commit test requirement
   - Add lint/build error checking during development
   - Improve test coverage for matching logic

---

## 🔍 Technical Details

### Scraping Architecture

**Components:**
- `ScraperService` - Main scraping orchestrator
- `BrowserPool` - Manages Playwright browser contexts
- `ProxyManager` - Handles proxy rotation and health
- `ChallengeHandler` - Detects and handles anti-bot challenges
- `CaptchaSolver` - Solves captchas using 2Captcha API
- `MetricsTracker` - Tracks scraping performance
- `SessionTracker` - Tracks scraping session lifecycle
- `RetryStrategy` - Handles retry logic with exponential backoff
- `ConcurrencyLimiter` - Limits concurrent requests per site

**Stealth Features:**
- User agent rotation
- Proxy rotation with health checks
- Human behavior simulation (mouse, scroll, typing)
- Session warmup (visit homepage before target page)
- Referrer chain tracking
- Adaptive delays based on site response
- Challenge detection and solving

**Extraction Strategies:**
1. JSON-LD structured data (highest priority)
2. Open Graph meta tags
3. Site-specific CSS selectors
4. Heuristic extraction (fallback)

---

## 📚 Related Documentation

- [README.md](README.md) - Main project overview
- [DOCUMENTATION.md](DOCUMENTATION.md) - User documentation
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) - System architecture
- [docs/STEALTH_SCRAPING.md](docs/STEALTH_SCRAPING.md) - Scraping features
- [docs/ADMIN_GUIDE.md](docs/ADMIN_GUIDE.md) - Admin dashboard guide
- [TODO.md](TODO.md) - Task tracking and roadmap

---

## 🎯 Summary

**PricePilot is a production-ready competitive pricing automation platform** with:
- ✅ Robust scraping engine with advanced stealth capabilities
- ✅ Full OpenCart integration
- ✅ Multi-tenant SaaS architecture
- ✅ Comprehensive admin monitoring
- ✅ Intelligent pricing rules engine

**Key Clarifications:**
- Scraping runs **every 24 hours** (not 15 minutes)
- Only **OpenCart** is fully implemented (not all platforms mentioned in docs)
- Two refinements needed: log management and result selection logic

**Next Steps:**
1. Update documentation to reflect actual implementation
2. Implement scraping log management improvements
3. Document and improve result selection algorithm
