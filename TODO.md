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
| **API Docs** | ✅ Complete | OpenAPI 3.0 spec + Interactive Reference at `/dashboard/developers/docs`. |
| **Scheduled Reports** | ❌ Missing | Cannot schedule PDF/CSV dumps via email. |

---



## 🔮 6. Future Roadmap
*   **v1.1**: Real-time WebSocket updates for the dashboard.
*   **v1.2**: "Smart Pricing" AI suggestions (predictive undercutting).
*   **v2.0**: Multi-currency support & Global tax handling.