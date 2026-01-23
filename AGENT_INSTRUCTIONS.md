# 🤖 Agent Instructions for PricePilot

This file contains guidelines and context for any AI agent working on the PricePilot project. Please check this file before making significant changes.

## 🏗️ Project Architecture
- **Framework**: Next.js 14 (App Router)
- **Database**: PostgreSQL (via Prisma)
- **Styling**: Tailwind CSS (with `cn` utility)
- **State Management**: React Hooks + Server Actions / API Routes
- **Background Jobs**: BullMQ (Redis) - **Crucial for Syncing**

## 🛡️ Critical Systems
1.  **Scraping Engine (`lib/services/scraper.ts`)**:
    -   Uses Puppeteer with stealth plugins.
    -   **Dynamic Search Patterns**: Sites define their own search URL structures (stored in DB as `searchQueryPattern`).
    -   **Security**: Handles blocking (Cloudflare, etc.) by throwing `ScrapeBlockError`.
    -   **Context**: Shares a singleton `BrowserPool` to manage resources.

2.  **Sync Orchestrator (`lib/services/sync-orchestrator.ts`)**:
    -   Manages the lifecycle of scraping jobs.
    -   **Locking**: Uses `isSyncing` and `syncStartedAt` flags on the `Site` model to prevent overlapping jobs.
    -   **Termination**: Respects user stop signals by checking DB flags during loops.

3.  **Discovery Service (`lib/services/discovery.ts`)**:
    -   First phase of syncing. Finds competitor products matching user's inventory.
    -   **Parallelism**: Processes in batches.
    -   **Logs**: Writes to `SyncLog` table for real-time UI updates (The "Terminal").

## 🎨 UI/UX Guidelines
-   **Terminal Feeds**: The dashboard uses "Terminal-like" feeds to show live progress. These read from `SyncLog`.
-   **Contrast**: Ensure all text in dark mode/terminal views has sufficient contrast (e.g., `text-muted-foreground` on black backgrounds might need checking).
-   **Feedback**: Always provide toast notifications for actions (Success/Error).

## 🛑 Common Pitfalls
-   **Do NOT remove `syncStartedAt` checks**: These are vital for killing "zombie" jobs when a user stops a sync.
-   **Prisma Re-generation**: If you change `schema.prisma`, ALWAYS run `npx prisma generate` and `npx prisma db push`.
-   **Linting**: Keep code clean. Fix unused imports and types.

## 📝 Recent Changes (as of Jan 2026)
-   Added `searchQueryPattern` to `Site` and `Competitor` configs to support custom e-commerce search URLs.
-   Improved "Stop Crawler" responsiveness by clearing `syncStartedAt`.
-   Added "Golden Rule" (delayed retries) for advanced protection bypass.

---
*Happy Coding! 🚀*
