# 📋 PricePilot Roadmap & Master Plan

> **Last Updated:** January 2026
> **Version:** 1.0.0 (Beta)
> **Status:** Core Engine Operational / Production Hardening

---

## 🏗 1. Current State Overview

### **What is Implemented**
*   **Core Engine**: Multi-tenant architecture with robust `Prisma` schema (Tenants, Products, Pricing Rules).
*   **Scraper**: Playwright-based scraper with retry logic, proxy support, and site-specific strategies (StarTech, Ryans).
*   **Orchestration**: `BullMQ` based job queue for syncs and notifications, running in a separate worker process.
*   **Dashboard**: Next.js 16 App Router UI with real-time stats, skeleton loading, and comprehensive product filtering.
*   **Auth & Security**: NextAuth.js (v4) with role-based access; Middleware-based rate limiting (`Upstash`).

### **Tech Stack Health**
*   **Frontend**: Excellent. Modern Next.js 16, TailwindCSS v4, and Radix UI primitives.
*   **Backend**: Solid. Server Actions + API Routes pattern is consistent.
*   **Database**: Well-modeled PostgreSQL schema.
*   **Testing**: comprehensive `TESTING.md` exists, but coverage needs verification on critical paths.

### **Strengths**
*   **Modular Services**: `SyncOrchestrator`, `ScraperService`, `RulesEngine` are well-separated.
*   **Testing Culture**: dedicated `e2e` and `__tests__` directories with clear documentation.
*   **Performance Awareness**: `next.config.ts` includes `standalone` output and strict headers.

---

## 🧩 3. Missing Parts (The "Gap")

| Feature | Status | Notes |
| :--- | :--- | :--- |
| **Alert Center** | ✅ COMPLETED | Added UI to configure monitoring rules (Price drops, stock status) and Sentinel logic. |
| **Scheduled Reports** | ❌ Missing | Cannot schedule PDF/CSV dumps via email. |
| **Onboarding** | ❌ Missing | No `driver.js` tour as originally planned. |
| **API Docs** | ⚠️ Partial | `DOCUMENTATION.md` is good, but no Swagger/OpenAPI spec for integrations. |

---

## 🛠 4. Actionable Recommendations

1.  ~~**Operation "Speak Up" (Fix Notifications)**~~: ✅ **COMPLETED**
    *   ~~Implement the `notificationProcessor` in `lib/queue/worker.ts`.~~
    *   ~~Integrate a provider like Resend or SendGrid (using SMTP).~~
    *   ~~Add Slack Webhook support for real-time alerts.~~
    *   Added Super Admin configuration UI for SMTP and Slack credentials.

2.  ~~**Standardize Logging**~~: ✅ **COMPLETED**
    *   ~~Refactor `ScraperService` to inject `Logger`.~~
    *   ~~Ensure logs flow to a persistent store (or stdout in JSON format) for production monitoring.~~

3.  ~~**Browser Resource Pool**~~: ✅ **COMPLETED**
    *   ~~Implement a singleton browser instance in the worker that is reused across jobs, rather than launching/closing per scrape.~~
    *   Implemented `BrowserPool` with context pooling, automatic cleanup, and configurable limits.

4.  ~~**Rename & Refactor**~~: ✅ **COMPLETED**
    *   ~~Rename `/dashboard/reports` to `/dashboard/catalog` or `/dashboard/products`.~~
    *   Renamed to `/dashboard/products` to match UI title.
    *   Create a true `/dashboard/analytics` or `/dashboard/reports` for downloadable summaries (Pending).

---

## ✅ 5. Prioritized TODO List

### **Phase 1: Immediate Fixes (P0 - Quick Wins)**
- [x] **Worker Implementation**: Implemented `notificationProcessor` in `lib/queue/worker.ts` for Email/Slack alerts.
- [x] **Logger Refactor**: Replace `console.log` with `logger.info` in `ScraperService` and `SyncOrchestrator`.
- [x] **Fix Reports Route**: Renamed `/dashboard/reports` to `/dashboard/products` to fix identity confusion.

### **Phase 2: Stability & core Features (P1)**
- [ ] **Alert Center UI**: Build `/dashboard/alerts` for users to check notification history and configure channels.
- [x] **Browser Pooling**: Optimize `ScraperService` to reuse browser contexts.
- [ ] **Onboarding Flow**: Implement `driver.js` or custom tour for new tenants.

### **Phase 3: Scalability & Growth (P2)**
- [ ] **Scheduled Reports**: Create a cron-based job to generate and email weekly PDF summaries.
- [ ] **API Keys Management**: UI for users to generate/revoke their own API tokens for the external API.
- [ ] **Webhook UI**: Interface for users to register their own webhooks (e.g., "POST to my server when price changes").

---

## 🔮 6. Future Roadmap
*   **v1.1**: Real-time WebSocket updates for the dashboard.
*   **v1.2**: "Smart Pricing" AI suggestions (predictive undercutting).
*   **v2.0**: Multi-currency support & Global tax handling.