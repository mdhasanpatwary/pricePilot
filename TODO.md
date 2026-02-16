# PricePilot - Project Status

## 🚀 Current Status


---

## 🎯 System Improvement Opportunities
- [ done ] Split `/api/v1/competitors` into lightweight list API + separate logs/progress API to reduce query weight.
- [ ] Implement a formal sync UI state machine (`IDLE/STARTING/RUNNING/STOPPING/STOPPED`) to remove stop/force-sync race conditions.
- [ ] Apply dynamic caching policy for competitors endpoints (bypass cache during active sync, enable cache when idle).
- [ ] Run DB index audit for sync-heavy paths (`Site`, `SyncLog`, `ProductMatch`) and add missing targeted indexes.
- [ ] Optimize duplicate detection from O(n²) to blocking + batched/background processing for large catalogs.
- [ ] Add stronger idempotency tokens/version checks in sync orchestration to prevent duplicate/ghost worker execution.
- [ ] Improve Redis fallback with circuit breaker + periodic health recovery checks.
- [ ] Isolate build-time side effects (DB/Redis initializers) across services to keep CI/build logs clean.
- [ ] Introduce strict API response DTO normalization (`site` vs `Site`) to prevent frontend shape regressions.
- [ ] Add endpoint SLO observability (p50/p95/p99 latency and error budgets) for top APIs.
- [ ] Tune background job concurrency/backpressure per domain/site for bot-protected targets.
- [ ] Add Playwright E2E regression suite for critical flows (`force sync`, `stop sync`, `price approvals`, `duplicates`).

---
