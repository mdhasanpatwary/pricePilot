# 🤖 Agent Instructions for PricePilot

This file is the **single source of truth** for any AI agent working on PricePilot.
Failure to follow this document is considered a **critical error**.

If instructions conflict, follow the section with the **higher priority**.

---

# 🧠 0. Agent Behavior Contract (HIGHEST PRIORITY)

These rules override all other instructions.

## 🔒 Core Truth & Honesty
1. If you are uncertain, you MUST explicitly say: **"I'm not sure"**.
   - Guessing, fabricating, or confident speculation is forbidden.

2. You MUST NOT claim an issue is fixed unless you can explain:
   - what was broken
   - what changed
   - why that change fixes THIS codebase (not a generic case)

3. You MUST NOT hallucinate:
   - files, APIs, configs, environment variables
   - logs, errors, outputs, or runtime behavior
   If something is missing, ask for it.

---

## 🧠 Debugging Protocol (MANDATORY)
4. You MUST NOT skip a bug.
   - If blocked, stop and explain **where** and **why** you are blocked.

5. Debugging MUST follow this order:
   - Observation
   - Root cause hypothesis
   - Evidence from existing code
   - Minimal fix
   - Why it works

6. No refactoring, cleanup, or optimization unless explicitly requested.
   - Fix the failing behavior only.

---

## 📦 Context & Assumptions
7. You MUST NOT assume:
   - framework version
   - router type (App / Pages)
   - environment (dev / prod)
   - infrastructure setup
   Ask **one precise question** if needed.

8. Avoid vague language:
   - "usually"
   - "often"
   - "in most cases"
   This repository is the only source of truth.

---

## 🧪 Verification Requirements
9. Every proposed fix MUST include a validation method.
   Example:
   > "This works because X changes Y, which prevents Z from occurring."

10. If multiple root causes are possible:
    - List them
    - Rank by likelihood
    - Do NOT choose randomly.

---

## 🧑‍💻 Collaboration Mode
11. Act as a **senior reviewer**, not an auto-solver.
    - Challenge unclear logic
    - Push back on unsafe changes

12. If blocked, ask **ONE** precise, high-signal question.
    - No multi-question dumps.

---

## 🚫 Forbidden Actions
13. You MUST NOT:
    - Mark tasks as "done" without confirmation
    - Invent errors, logs, or outputs
    - Hide uncertainty behind confident language

---

# 🏗️ 1. Project Architecture

- **Framework**: Next.js 14+ (App Router)
- **Database**: PostgreSQL (via Prisma)
- **Styling**: Tailwind CSS (with `cn` utility)
- **State Management**: React Hooks + Server Actions / API Routes
- **Background Jobs**: BullMQ (Redis) — **CRITICAL for syncing**

---

# 📜 2. Operating Procedures (Rules of Engagement)

## Safety & Quality
- **Pre-Commit**: All changes MUST pass:
  - `yarn lint`
  - `yarn test`
  - `yarn build`

- **Database**:
  - Run `npx prisma db push` or `npx prisma migrate dev` after schema changes
  - Verify database connectivity
  - Always run `npx prisma generate` after schema updates

- **Validation**:
  - All API inputs MUST be validated using **Zod**
  - Schemas live in `lib/validation/schemas.ts`

- **Sanitization**:
  - Sanitize all string inputs to prevent XSS

- **Code Hygiene**:
  - Remove unused variables, imports, and dead code immediately
  - Delete commented-out legacy blocks
  - Avoid obvious comments
  - If you touch a file, clean nearby legacy debris

---

## Error Handling
- **User Feedback**: Use `sonner` for toast notifications
- **Logging**:
  - `SyncLog` → scraping & syncing
  - `TenantAuditLog` → admin actions
- **Graceful Failure**:
  - Detect and log HTML error responses (Cloudflare / Maintenance pages)
  - Provide descriptive internal logs

---

## Directory Structure
- `app/api/v1/...` → REST API endpoints
- `app/dashboard/...` → Tenant dashboard
- `components/ui/...` → shadcn/ui reusable components
- `lib/services/...` → Core business logic
- `lib/queue/...` → BullMQ workers & queues

---

# 🧱 3. Component Standards (shadcn/ui)

**MANDATORY**

- Do NOT use raw HTML for UI primitives (`<button>`, `<input>`, etc.)
- Always use components from `@/components/ui`
- Use `cn()` for class merging
- Use `lucide-react` for icons

**Missing Component Rule**
- If a component does not exist:
  - Create it in `components/ui`
  - Follow the shadcn/ui pattern
  - THEN use it

---

# 🛡️ 4. Critical Systems

## A. Scraping Engine (`lib/services/scraper.ts`)
- Uses Puppeteer with stealth plugins
- Weighted scoring:
  - Title match
  - Brand
  - Price logic
  - Image presence
- Uses `getSiteProfile` for site-specific tuning
- Throws `ScrapeBlockError` on detection
- Relies on `BrowserPool`

---

## B. Sync Orchestrator (`lib/services/sync-orchestrator.ts`)
- Manages job lifecycle
- Prevents overlap using:
  - `isSyncing`
  - `syncStartedAt`
- Zombie job killer:
  - Detects stagnation
  - Stops jobs via DB flags

⚠️ **NEVER remove `syncStartedAt` checks**

---

## C. Discovery Service (`lib/services/discovery.ts`)
- Matches competitor products
- Writes progress to `SyncLog`
- Powers Terminal-style UI feeds

---

# 🎨 5. UI / UX Guidelines

- Visual tone: **Vibrant, smooth, premium**
- Use glassmorphism and gradients where appropriate
- Terminal feeds must be high-contrast
- Use `lucide-react` icons consistently

---

# 🛑 6. Common Pitfalls

- Do NOT remove sync locking logic
- Always regenerate Prisma client after schema changes
- Heavy processing MUST run in BullMQ workers
- Never run scrapers in API routes

---

# 📝 7. Recent Changes & Features

- Added `specifications` (JSONB) to `Product`
- Advanced tech spec filtering in `GET /api/v1/products`
- `TechProductValidator` for bad data detection
- `searchQueryPattern` allows site-specific search URLs

---

*Follow these instructions to maintain PricePilot’s stability, correctness, and premium quality.*