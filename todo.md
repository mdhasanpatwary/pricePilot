# PricePilot System Hardening TODO

## Phase 0 - Immediate Containment (24-48 Hours)
- [x] Remove all `/api/debug/*` routes from production code paths.
- [x] Remove scraper/debug playground endpoints from production code paths.
- [x] Add `INTERNAL_MODE=true` gate for internal diagnostics.
- [x] Enforce strict admin middleware on all internal diagnostics endpoints.
- [x] Ensure production build excludes debug routes entirely.
- [ ] Add CI test to scan API route tree and fail if auth wrapper is missing (except explicit public allowlist).

## Phase 0 - Fail-Closed Policy
- [ ] Define and document subsystem failure policy matrix.
- [ ] Enforce fail-closed in Auth flows.
- [ ] Enforce fail-closed in Cron flows.
- [ ] Enforce fail-closed in Admin flows.
- [ ] Keep Scraper flows fail-soft with controlled degradation.
- [ ] Keep Analytics flows fail-soft with controlled degradation.

## Phase 1 - Authentication & Authorization Hardening
- [ ] Build centralized wrappers: `requireAuth()`, `requireAdmin()`, `requireTenantContext()`.
- [ ] Refactor API routes to use centralized wrappers only.
- [ ] Remove per-route ad hoc session/role checks.
- [ ] Define tenant context invariant: `request.tenantId` mandatory and immutable downstream.
- [ ] Ensure tenant context is derived only from authenticated session.
- [ ] Validate tenant context against database for every authenticated request path.
- [ ] Reject tenant ID from request body.
- [ ] Reject tenant ID from query string.
- [ ] Add CI route coverage audit for auth wrappers.
- [ ] Add CI route coverage audit for admin role checks on `/admin` routes.

## Phase 2 - Queue & Concurrency Hardening
- [ ] Redesign queue accounting model with explicit states:
- [ ] `queued`
- [ ] `active`
- [ ] `delayed`
- [ ] `retrying`
- [ ] `completed`
- [ ] `failed_terminal`
- [ ] `dead_letter`
- [ ] Ensure delayed jobs are excluded from backlog pressure metrics.
- [ ] Enforce validated tenant ID on all enqueue calls.
- [ ] Add assertion layer in `enqueueWithBackpressure()` for tenant ID integrity.
- [ ] Remove any user ID fallback used as tenant identifier.
- [ ] Implement Dead Letter Queue (`pricepilot:dead-letter`).
- [ ] Define terminal failure classification rules (permanent block, structural, validation).
- [ ] Route terminal failures to DLQ.
- [ ] Add DLQ monitoring dashboards and alerts.
- [ ] Add retry classification by error type.
- [ ] Add max retry policy per error type.
- [ ] Add protection-incident cooldown windows.
- [ ] Prevent infinite delayed requeue loops.

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
