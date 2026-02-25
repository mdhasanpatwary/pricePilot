# PricePilot - Project Status

## 🚀 Current Status


---

## 🎯 System Improvement Opportunities
- [ done ] Split `/api/v1/competitors` into lightweight list API + separate logs/progress API to reduce query weight.
- [ done ] Implement a formal sync UI state machine (`IDLE/STARTING/RUNNING/STOPPING/STOPPED`) to remove stop/force-sync race conditions.
- [ done ] Apply dynamic caching policy for competitors endpoints (bypass cache during active sync, enable cache when idle).
- [ done ] Run DB index audit for sync-heavy paths (`Site`, `SyncLog`, `ProductMatch`) and add missing targeted indexes.
- [ done ] Optimize duplicate detection from O(n²) to blocking + batched/background processing for large catalogs.
- [ done ] Add stronger idempotency tokens/version checks in sync orchestration to prevent duplicate/ghost worker execution.
- [ done ] Improve Redis fallback with circuit breaker + periodic health recovery checks.
- [ done ] Isolate build-time side effects (DB/Redis initializers) across services to keep CI/build logs clean.
- [ done ] Introduce strict API response DTO normalization (`site` vs `Site`) to prevent frontend shape regressions.
- [ done ] Add endpoint SLO observability (p50/p95/p99 latency and error budgets) for top APIs.
- [ done ] Tune background job concurrency/backpressure per domain/site for bot-protected targets.
- [ done ] Add Playwright E2E regression suite for critical flows (`force sync`, `stop sync`, `price approvals`, `duplicates`).

---

## 🧪 Production Hardening Experiments (Pending)
- [x] Production reliability tuning: worker concurrency optimization.
  - Scope: set worker concurrency to `1.5x–2x GLOBAL_MAX_ACTIVE` with `GLOBAL_MAX_ACTIVE=10`.
  - Run: `50 jobs / 10 tenants` stress test.
  - Measure: queue wait `p50/p95`, limiter requeue denials, memory RSS peak, throughput.
  - Tune: adjust concurrency up/down to minimize denial churn while maintaining throughput.
  - Deliverable: optimized concurrency value + env/config recommendation with rationale.

- [x] Chaos resiliency audit: Redis outage recovery validation.
  - Scope: simulate Redis disconnect during `5–10` active scrape jobs.
  - Verify: stale global permits self-release after lease expiry; no permanently lost jobs; no active permit count above `GLOBAL_MAX_ACTIVE`.
  - Report: counter mismatch incidents + mitigation recommendations (lease expiry window, cleanup cadence, atomic Lua paths).

- [x] System stress validation: worker memory guard behavior under realistic load.
  - Prereq: Redis preflight passes.
  - Scope: induce high RSS via concurrent browser contexts and heavy scrape jobs.
  - Verify: `BROWSER_POOL_MAX_RSS_MB` enforcement, graceful worker restart, browser/context cleanup, no stale global permits.
  - Deliverable: max safe RSS per worker + recommended guard thresholds.

- [x] Distributed capacity planning: safe tenant concurrency envelope.
  - Fixed worker concurrency target: `15–20`.
  - Run staggered bursts for `10`, `30`, `50` tenants.
  - Measure: queue wait `p50/p95`, requeue denials, max RSS.
  - Deliverable:
    - Max tenants to keep `p95 < 5s`.
    - Scaling strategy for `50–100` tenants (more workers, Redis scaling/sharding, queue partitioning).
    - Report table: `tenants | p50 wait | p95 wait | max RSS | denials`.

---
