# 🤖 Agent Instructions for PricePilot

This file serves as the **single source of truth** for any AI agent working on PricePilot. It combines project context, architecture, and operational rules.

## 🏗️ 1. Project Architecture
- **Framework**: Next.js 14+ (App Router)
- **Database**: PostgreSQL (via Prisma)
- **Styling**: Tailwind CSS (with `cn` utility)
- **State Management**: React Hooks + Server Actions / API Routes
- **Background Jobs**: BullMQ (Redis) - **Crucial for Syncing**

## 📜 2. Operating Procedures (Rules of Engagement)
### Safety & Quality
- **Pre-Commit**: Any changes must pass `yarn lint`, `yarn test`, and `yarn build`.
- **Database**: Run `npx prisma db push` or `npx prisma migrate dev` after schema changes. Verify connectivity.
- **Validation**: All API inputs MUST be validated using **Zod** (schemas in `lib/validation/schemas.ts`).
- **Sanitization**: Sanitize string inputs to prevent XSS.
- **Code Hygiene**:
  - **Remove Dead Code**: Delete unused variables, imports, and commented-out code blocks immediately.
  - **No Fluff Comments**: Avoid comments that state the obvious (e.g., `// Import React`). Only comment complex logic.
  - **Clean Up**: If you modify a file, take a moment to remove any legacy debris around your changes.

### Error Handling
- **User Feedback**: Use `sonner` for toast notifications.
- **Logs**: Record system activity in `SyncLog` (scrapers) and `TenantAuditLog` (admin actions).
- **Graceful Failure**: If an external API returns HTML errors (Cloudflare/Maintenance), catch it and log a descriptive error.

### Directory Structure
- `app/api/v1/...`: REST API endpoints.
- `app/dashboard/...`: Tenant-specific dashboard features.
- `components/ui/...`: **Shadcn UI Reusable Components** (Button, Input, etc.).
- `lib/services/...`: Core business logic (Scraper, Sync, Discovery).
- `lib/queue/...`: Worker and Queue definitions.

## 🧱 3. Component Standards (shadcn/ui)
**MANDATORY**: Do NOT write raw HTML elements (e.g., `<button className="...">`) for UI primitives.
-   **Structure**: Use components from `@/components/ui`.
-   **Styling**: Use the `cn()` utility for class merging.
-   **Icons**: Use `lucide-react`.
-   **If a component is missing**: Create it in `components/ui` following the Shadcn pattern before using it.

## 🛡️ 4. Critical Systems
### A. Scraping Engine (`lib/services/scraper.ts`)
-   Uses Puppeteer with stealth plugins.
-   **Weighted Scoring**: selects products based on Title Match, Brand, Price Logic, and Image presence.
-   **Profiles**: Uses `getSiteProfile` to adjust wait times/selectors per site (e.g., StarTech vs Ryans).
-   **Security**: Throws `ScrapeBlockError` on blocks. Relies on `BrowserPool`.

### B. Sync Orchestrator (`lib/services/sync-orchestrator.ts`)
-   Manages job lifecycles.
-   **Locking**: Checks `isSyncing` and `syncStartedAt` on `Site` model to prevent overlaps.
-   **Zombie Killing**: If a job is stagnant or user requested stop, the orchestrator kills it based on DB flags.

### C. Discovery Service (`lib/services/discovery.ts`)
-   Finds competitor products matching user's inventory.
-   Writes to `SyncLog` for the "Terminal" UI effects.

## 🎨 4. UI/UX Guidelines
-   **Rich Aesthetics**: "Vibrant, smooth, premium". Use glassmorphism/gradients where appropriate.
-   **Terminal Feeds**: The dashboard uses console-style feeds for sync progress. Ensure high contrast.
-   **Icons**: Use `lucide-react`.

## 🛑 5. Common Pitfalls
-   **Do NOT remove `syncStartedAt` checks**: Vital for process control.
-   **Schema Changes**: Always regenerate client (`npx prisma generate`).
-   **Background Processing**: Scrapers and heavy imports MUST utilize BullMQ workers.

## 📝 6. Recent Changes & Features
-   **Tech Specs**: Added `specifications` (JSONB) to Product model for RAM/Storage filtering.
-   **Advanced Filters**: Enhanced `GET /api/v1/products` to filter by tech specs.
-   **Validation**: Implemented `TechProductValidator` to flag bad data.
-   **Custom Search Patterns**: `searchQueryPattern` in DB allows defining search URLs per site.

---
*Follow these instructions to maintain PricePilot's stability and premium quality.*
