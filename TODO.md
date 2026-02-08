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
- **Current:** Every 24 hours
- **Configured in:** `vercel.json` cron job and scheduler API

### Platform Integrations
- **Currently Supported:** OpenCart only (fully implemented with price updates ✅)
- **Laravel:** Package exists with price update API ✅
- **Others (Shopify, WooCommerce, Magento):** Not implemented yet

---

## 🧩 Missing Parts & Refinements Needed

| Feature | Status | Notes |
| :--- | :--- | :--- |
| **Scheduled Reports** | ⏸️ Ignored | PDF/CSV email dumps - not needed for now. |
| **Shopify Integration** | 🏗️ Pending | Backend connector and price update API missing. |
| **WooCommerce Integration** | 🏗️ Pending | Backend connector and price update API missing. |
| **Magento Integration** | 🏗️ Pending | Backend connector and price update API missing. |
| **Monitoring Alerts** | 🏗️ Incomplete | Email/Slack notifications logic in `cache-alerting` is placeholder. |
| **Screenshot Storage** | 🏗️ Incomplete | S3 integration logic in `screenshot-storage` is placeholder. |

---

## �️ Technical Debt & Core Infrastructure (Backend)

*   [x] **Bot Protection Persistence**: Loaded scraping configurations, history, and rate limit states from the database. Added persistence for consecutive failures and next available time.
*   [ ] **Email Verification**: Re-enable email verification requirement in `lib/auth.ts` before production.
*   [ ] **Debug API Cleanup**: Secure or remove `/api/v1/debug/*` endpoints before public deployment.
*   [ ] **Cache Metrics Enhancement**: Implement actual response time tracking in `cache-enhanced.ts`.
*   [ ] **Code Cleanup**: Remove any remaining redundant placeholder comments (e.g., `// ...`) identifying truncated edits.

---

## �🐛 Issues
*   (None currently blocking build - System is stable)

## 📝 Tasks
* list the uncompleted features and anything which in uncompleted.
* after implement any feature or change anything, need to run build for errors


## Questions
* what's wrong things exist, in this project?
* amake menually korte hove amon ki ki kaj remaining ache?

## 💡 Feature Requests
* should care lint error warnings, test errors & build errors in code writing time
* add "If you're unsure, say you're unsure. Don't guess" in agent rule

---

http://localhost:3000/auth/login
Email: admin@pricepilot.com
Password: admin123
