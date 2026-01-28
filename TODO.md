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

## 💡 Feature Requests
* should care lint error warnings, test errors & build errors in code writing time
* add "If you're unsure, say you're unsure. Don't guess" in agent rule
* Auto-approval rules (e.g., auto-approve if change < 5%)
* Email notifications for pending approvals
* Approval delegation to team members

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

## 📝 Tasks
* ~~system er main kaj ki? kototuku done hoice? remaining ki ache? system er goal ki?~~ ✅ CLARIFIED ABOVE
* update main documentation at /docs to reflect 24-hour scraping frequency