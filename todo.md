# PricePilot System Hardening TODO

## Phase 0 - Immediate Containment (24-48 Hours)
- [x] Remove all `/api/debug/*` routes from production code paths.
- [x] Remove scraper/debug playground endpoints from production code paths.
- [x] Add `INTERNAL_MODE=true` gate for internal diagnostics.
- [x] Enforce strict admin middleware on all internal diagnostics endpoints.
- [x] Ensure production build excludes debug routes entirely.
- [ ] Add CI test to scan API route tree and fail if auth wrapper is missing (except explicit public allowlist).

## Phase 0 - Fail-Closed Policy
- [x] Define and document subsystem failure policy matrix.
- [x] Enforce fail-closed in Auth flows.
- [x] Enforce fail-closed in Cron flows.
- [x] Enforce fail-closed in Admin flows.
- [x] Keep Scraper flows fail-soft with controlled degradation.
- [x] Keep Analytics flows fail-soft with controlled degradation.

## Phase 1 - Authentication & Authorization Hardening
- [x] Build centralized wrappers: `requireAuth()`, `requireAdmin()`, `requireTenantContext()`
- [x] Refactor API routes to use centralized wrappers (Proof of Concept: `admin/active-sessions`, `products`)
- [x] Define tenant context invariant and validation (Derivation from session only)
- [x] Reject tenant ID from request body/query (Fail-closed injection prevention)
- [x] Add CI route coverage audits (Updated `scan-api-auth.ts`)

## Phase 2 - Queue & Concurrency Hardening
- [x] Redesign queue accounting model with explicit states:
  - [x] `queued` (metric recorded at enqueue)
  - [x] `active` (worker hooks)
  - [x] `delayed` (backpressure logic)
  - [x] `retrying` (failure handler)
  - [x] `completed` (existing)
  - [x] `failed_terminal` (classification on final failure)
  - [x] `dead_letter` (DLQ enqueue event)
- [x] Ensure delayed jobs are excluded from backlog pressure metrics (snapshot ignores them).
- [x] Enforce validated tenant ID on all enqueue calls.
- [x] Add assertion layer in `enqueueWithBackpressure()` for tenant ID integrity.
- [x] Remove any user ID fallback used as tenant identifier (no implicit system/user mixing).
- [x] Implement Dead Letter Queue (`pricepilot:dead-letter`).
- [x] Define terminal failure classification rules (basic check: attempts exhausted).
- [x] Route terminal failures to DLQ.
- [x] Add DLQ monitoring dashboards and alerts. *(script+metric recorded)*
- [x] Add retry classification by error type. *(transient/permanent/validation/rate-limit)*
- [x] Add max retry policy per error type. *(adjusted during enqueue/increment)*
- [x] Add protection-incident cooldown windows. *(Redis key with TTL)*
- [x] Prevent infinite delayed requeue loops. *(repeat-delay guard implemented)*

## Phase 3 - Distributed Lock Hardening
- [ ] Implement token-based lock acquire (`SET key value NX PX ttl`).
- [ ] Implement Lua compare-and-delete lock release.
- [ ] Add lock refresh/heartbeat for long-running cron tasks.
- [ ] Abort job if lock refresh fails.
- [ ] Define lock policy when Redis is unavailable:
- [ ] Critical cron: abort.
- [ ] Analytics cron: skip.
- [ ] Cleanup cron: skip.
- [ ] Remove fail-open lock execution in cron paths.

## Phase 4 - Scraper Runtime Hardening
- [ ] Replace shared static browser count hash with heartbeat-based aggregation.
- [ ] Add expiry-based node aggregation for browser capacity.
- [ ] Verify active-worker liveness before counting node capacity.
- [ ] Add per-job memory snapshot metric.
- [ ] Add worker kill/restart threshold for memory delta breaches.
- [ ] Add rolling restart window for scraper workers.
- [ ] Validate scraper context isolation across tenants.
- [ ] Validate cookie jar isolation across tenants.
- [ ] Validate proxy rotation isolation per tenant.

## Phase 5 - Analytics Isolation & Stability
- [ ] Remove O(n^2) operations from request path.
- [ ] Precompute heavy analytics and persist materialized summaries.
- [ ] Serve dashboard reads in near constant time.
- [ ] Replace `skip/take` with cursor-based keyset pagination.
- [ ] Replace Redis `KEYS` usage with `SCAN` or versioned namespace keys.

## Phase 6 - Observability & Detection
- [ ] Add metric: per-tenant queue depth.
- [ ] Add metric: delayed vs active job ratio.
- [ ] Add metric: retry rate per job type.
- [ ] Add metric: worker RSS memory.
- [ ] Add metric: browser count per node.
- [ ] Add metric: cron execution duration.
- [ ] Add metric: DLQ growth rate.
- [ ] Add alert: tenant queue depth upward drift.
- [ ] Add alert: retry spike by job type.
- [ ] Add alert: DLQ threshold breach.
- [ ] Add alert: memory slope increase over 1h.

## Phase 7 - Security Hardening Layer
- [ ] Enforce rate limits by tenant, IP, and endpoint class.
- [ ] Add SSRF protections for any retained scraper playground path:
- [ ] Outbound domain allowlist.
- [ ] Block private/internal IP ranges.
- [ ] Block metadata endpoints.
- [ ] Enforce environment separation:
- [ ] Exclude debug routes in production builds.
- [ ] Disallow `INTERNAL_MODE` in production runtime.
- [ ] Fail CI if debug code is imported in production bundles.

## Phase 8 - Chaos & Failure Testing
- [ ] Simulate Redis unavailability.
- [ ] Simulate worker crash mid-job.
- [ ] Simulate browser crash during scrape.
- [ ] Simulate network timeout flood.
- [ ] Simulate anti-bot protection spike.
- [ ] Simulate high-scale tenant (100k products).
- [ ] Capture behavior and document pass/fail criteria per scenario.

## Target Scores
- [ ] Security >= 8.5
- [ ] Queue Stability >= 8.0
- [ ] Scraper Stability >= 8.0
- [ ] Scalability >= 7.5
- [ ] Observability >= 8.0
- [ ] Overall >= 8.0

## Delivery Controls
- [ ] CI hardening checks enabled and blocking.
- [ ] Run `yarn lint` clean.
- [ ] Run `yarn build` clean.
- [ ] Create release checklist for hardening rollout.
