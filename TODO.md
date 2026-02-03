# 📋 PricePilot Roadmap & Master Plan

> **Last Updated:** January 2026
> **Version:** 1.0.0 (Beta)
Note: don't execute the todo.md task from your own decision. ask me first.

The agent MUST acknowledge this file before acting.

---

## 🎯 System Overview (CLARIFIED)

### Main Goal
PricePilot is a competitive pricing automation platform for e-commerce businesses. It automatically monitors competitor prices and adjusts store prices based on intelligent rules.

### Core Flow
1. **Get products from your store** → Sync product catalog via API ✅
2. **Search & scrape competitor products** → Find matching products on competitor sites ✅
3. **Analyze & match** → Use SKU/model matching or manual matching ✅
4. **Apply pricing rules** → Calculate optimal prices based on user-defined strategies ✅
5. **Update store prices** → ✅ **MANUAL APPROVAL REQUIRED** (see `/dashboard/price-approvals`)

### Scraping Frequency
- **Current:** Every 24 hours (not 15 minutes as mentioned in docs)
- **Configured in:** `vercel.json` cron job and scheduler API

### Platform Integrations
- **Currently Supported:** OpenCart only (fully implemented with price updates ✅)
- **Laravel:** Package exists with price update API ✅
- **Others (Shopify, WooCommerce, Magento):** Not implemented yet

---

## 🧩 Missing Parts & Refinements Needed

| Feature | Status | Notes |
| :--- | :--- | :--- |
| **API Docs** | ✅ Complete | OpenAPI 3.0 spec + Interactive Reference at `/dashboard/developers/docs`. |
| **Scheduled Reports** | ⏸️ Ignored | PDF/CSV email dumps - not needed for now. |
| **Manual Approval Workflow** | ✅ **COMPLETE** | Manual review/approval step added before updating store prices. Tenant can review and approve/reject price changes in `/dashboard/price-approvals`. See `PRICE_APPROVAL_WORKFLOW.md` for details. |
| **Scraping Log Management** | ✅ Complete | Automatic log clearing when new scraping starts + manual "Clear Logs" button. See `SCRAPING_LOG_CLEAR_FIX.md` for details. |
| **Result Selection Logic** | ✅ Documented | Comprehensive documentation added in `docs/RESULT_SELECTION_LOGIC.md`. Uses weighted scoring algorithm with 7 criteria. Includes improvement recommendations. |

---

## 🐛 Issues

## 📝 Tasks
* list the uncompleted features and anything which in uncompleted.
* after implement any feature or change anything need to run build for errors


## Questions
* what's wrong things exist in this project?
* amake menually korte hove amon ki ki kaj remaining ache?
* competitor site advanced bot protection service, ip block kore, fake price দেখায়, empty response দেয়, random redirect, delayed response (timeout), CAPTCHA (worst). ei case gulote amra kon strategy follow kortechi? debuggin & user ke proper msg ki dicci?

## 💡 Feature Requests
* should care lint error warnings, test errors & build errors in code writing time
* add "If you're unsure, say you're unsure. Don't guess" in agent rule
* Auto-approval rules (e.g., auto-approve if change < 5%)
* Email notifications for pending approvals
* Approval delegation to team members
* maybe we need 2 separate documentation for tenant(/docs) & admin(/admin-docs).(will be agent rule(after complete any task or change anything need to update real documentation)).

## 📝 Recent Completions

### ✅ Manual Price Approval Workflow (January 2026)
**Problem:** Prices were automatically pushed to stores without tenant review.

**Solution:** Added manual approval queue where all price changes require explicit approval before being applied.

**Key Features:**
- Dashboard at `/dashboard/price-approvals` for reviewing changes
- Bulk approve/reject operations
- 7-day expiration for pending changes
- Clear reasoning for each price change
- Audit trail of who approved/rejected what

**Migration Required:**
```bash
npx prisma generate
npx prisma migrate dev --name add_price_approval_workflow
```

**Documentation:**
- `PRICE_APPROVAL_WORKFLOW.md` - Technical implementation details
- `MIGRATION_GUIDE_PRICE_APPROVAL.md` - Step-by-step migration guide
- `docs/PRICE_APPROVAL_GUIDE.md` - User guide

---

## 📚 Documentation Enhancement Plan

### Overview
The `/docs` section needs updates to reflect current features and correct information about the system.

### Missing Documentation Pages

#### 1. OpenCart Integration Guide
**Priority:** HIGH  
**Location:** `app/(docs)/docs/opencart/page.tsx`  
**Content Needed:**
- Installation steps for OpenCart module (.ocmod.zip)
- API token configuration
- Product sync setup
- Price update workflow
- Troubleshooting common issues
- Version compatibility (OpenCart 3.x, 4.x)

#### 2. Price Approval Workflow Guide
**Priority:** HIGH  
**Location:** `app/(docs)/docs/features/price-approvals/page.tsx`  
**Content Needed:**
- Overview of manual approval process
- How to review pending price changes
- Bulk approve/reject operations
- Understanding price change reasoning
- Expiration policy (7 days)
- Best practices for approval workflows

#### 3. Auto-Approval Rules Guide
**Priority:** MEDIUM  
**Location:** `app/(docs)/docs/features/auto-approval/page.tsx`  
**Content Needed:**
- Creating auto-approval rules
- Rule conditions and thresholds
- Priority and conflict resolution
- Testing rules before activation
- Monitoring rule performance
- Safety constraints

#### 4. Monitoring & Alerting Guide
**Priority:** MEDIUM  
**Location:** `app/(docs)/docs/features/monitoring/page.tsx`  
**Content Needed:**
- Dashboard overview at `/admin/monitoring`
- Setting up alert rules
- Notification channels (email, webhook)
- Alert severity levels
- Metric types and thresholds
- Troubleshooting alerts

#### 5. Scraping & Bot Protection
**Priority:** HIGH  
**Location:** `app/(docs)/docs/features/scraping/page.tsx`  
**Content Needed:**
- How scraping works (24-hour frequency)
- Handling bot protection (CAPTCHA, IP blocks)
- Proxy rotation strategies
- Rate limiting and delays
- Error handling and retries
- Debugging scraping failures
- Site profile configuration

#### 6. Product Matching Guide
**Priority:** MEDIUM  
**Location:** `app/(docs)/docs/features/matching/page.tsx`  
**Content Needed:**
- Automatic matching algorithms (SKU, brand+model, fuzzy)
- Manual matching workflow
- Match confidence scores
- Reviewing and correcting matches
- Duplicate detection
- Best practices for product data

#### 7. Admin Dashboard Guide
**Priority:** LOW  
**Location:** `app/(docs)/docs/admin/page.tsx`  
**Content Needed:**
- Admin features overview
- Tenant management
- User management
- System health monitoring
- Performance metrics
- Audit logs
- Maintenance tasks

### Updates to Existing Pages

#### 1. Quick Start Guide (`/docs/quickstart`)
**Changes Needed:**
- Update scraping frequency: "24 hours" not "15 minutes"
- Add step for price approval workflow
- Mention OpenCart as primary supported platform
- Update Laravel integration status
- Add link to price approval guide

#### 2. Laravel Integration (`/docs/laravel`)
**Changes Needed:**
- Clarify current implementation status
- Add price update API documentation
- Include webhook setup for real-time updates
- Add troubleshooting section
- Update version compatibility

#### 3. API Overview (`/docs/api`)
**Changes Needed:**
- Add link to interactive API docs at `/dashboard/developers/docs`
- Mention OpenAPI 3.0 specification
- Add rate limiting information (24-hour scraping cycle)
- Include webhook documentation
- Add examples for price approval API

#### 4. FAQ Page (`/docs/faq`)
**Changes Needed:**
- Add Q&A about scraping frequency
- Add Q&A about price approval workflow
- Add Q&A about bot protection handling
- Add Q&A about OpenCart vs Laravel support
- Add Q&A about manual vs auto-approval

### Navigation Updates

#### Sidebar (`docs-shell.tsx`)
**Changes Needed:**
- Add "OpenCart" under Integrations
- Remove "Soon" badge from implemented features
- Add "Features" section items:
  - Price Approvals (remove "Soon")
  - Auto-Approval Rules (remove "Soon")
  - Product Matching (new)
  - Scraping & Bot Protection (new)
  - Monitoring & Alerts (new)
- Add "Admin" section (new):
  - Admin Dashboard
  - Tenant Management
  - System Health

### Implementation Steps

1. **Phase 1: Critical Updates (Do First)**
   - Update Quick Start with correct scraping frequency
   - Create OpenCart integration guide
   - Create Price Approval workflow guide
   - Create Scraping & Bot Protection guide
   - Update FAQ with common questions

2. **Phase 2: Feature Documentation**
   - Create Auto-Approval Rules guide
   - Create Product Matching guide
   - Create Monitoring & Alerting guide
   - Update API documentation with new endpoints

3. **Phase 3: Admin & Advanced**
   - Create Admin Dashboard guide
   - Add advanced troubleshooting guides
   - Add performance optimization guides
   - Add security best practices

### Content Style Guidelines

**Follow these principles for all documentation:**
- Clear, concise language (no fluff)
- Step-by-step instructions with code examples
- Screenshots/diagrams where helpful
- Callout boxes for warnings and tips
- Consistent formatting with existing pages
- Mobile-responsive design
- Dark/light theme support
- Searchable content structure

### Technical Requirements

**Component Reuse:**
- Use existing `<CodeBlock>` component for code samples
- Use existing `<Callout>` component for warnings/tips
- Use existing card/layout patterns from other docs pages
- Maintain consistent typography and spacing

**Navigation:**
- Update `sidebarLinks` array in `docs-shell.tsx`
- Remove "Soon" badges from completed features
- Add new sections as needed
- Ensure all links work correctly

### Success Criteria

- [ ] All implemented features have documentation
- [ ] Scraping frequency correctly stated as 24 hours
- [ ] OpenCart integration fully documented
- [ ] Price approval workflow clearly explained
- [ ] Bot protection strategies documented
- [ ] FAQ answers common user questions
- [ ] Navigation reflects current feature set
- [ ] All code examples tested and working
- [ ] Mobile-responsive on all pages
- [ ] Dark/light themes work correctly

### Estimated Effort

- **Phase 1:** ~4-6 hours (critical updates)
- **Phase 2:** ~3-4 hours (feature docs)
- **Phase 3:** ~2-3 hours (admin/advanced)
- **Total:** ~9-13 hours

---