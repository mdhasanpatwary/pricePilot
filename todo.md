# PricePilot System Hardening TODO
- Lock-aware job scheduling (prioritize lock holders)- Distributed lock queue (multiple waiters)- Lock contention dashboards- Per-lock metrics and alerting## Future Enhancements- [ ] Document runbook for lock debugging- [ ] Set up alerts for lock acquisition failures- [ ] Verify job deduplication (no parallel execution)- [ ] Monitor logs for lock contention- [ ] Update all cron endpoints to use `withCronLock`- [ ] Deploy distributed lock service## Rollout Checklist- ✅ Heartbeat refresh in background- ✅ Job abort/skip based on type and availability- ✅ Job execution with automatic lock- ✅ Lock refresh extends TTL- ✅ Lock release requires matching token- ✅ Lock acquire fails when held- ✅ Lock acquire succeeds when freeTest scenarios covered:```node lib/queue/lock-heartbeat.test.ts# Unit tests for heartbeat servicenode lib/queue/distributed-lock.test.ts# Unit tests for lock service```bashRun the test suites:## Testing```LOCK_HEARTBEAT_INTERVAL="120000"    # 2 minute refresh interval# Heartbeat interval (for long-running jobs)CRON_LOCK_CLEANUP_TTL="900000"      # 15 minutes for cleanupCRON_LOCK_ANALYTICS_TTL="600000"    # 10 minutes for analyticsCRON_LOCK_CRITICAL_TTL="1800000"    # 30 minutes for critical jobs# Distributed Lock TTLs (in milliseconds)```bashAdd to `.env.example`:## Environment Configuration- Job skip/abort decisions- Lock-related lifecycle transitions (acquire, release, refresh)The system emits events via `OperationalMetricsService`:### Metrics```[CronLock] Job skipped                    → ANALYTICS/CLEANUP skipped[CronLock] Distributed lock error         → CRITICAL job aborted[DistributedLock] Could not acquire lock  → Triggered failure policy[DistributedLock] Lock already held       → Another instance owns it[DistributedLock] Lock released           → Job completed[DistributedLock] Lock acquired           → Job starting```Look for these log patterns:### Logs```# (returns ms until expiry, -1 if no expiry, -2 if missing)redis-cli PTTL pp:cron:my-job# Check TTL# (returns token if held, nil if free)redis-cli GET pp:cron:my-job# Check if lock is held```bash### View Lock Status## Monitoring & Debugging```T4m+1s K2 attempts acquire → succeeds       K2: LOCKEDT4m    K1 job completes, releases lock     K1: UNLOCKEDT2m    K1 refreshes lock (TTL=+5m)          K1: LOCKED (extended)T3     K3 attempts acquire → fails          K3: BLOCKED → SKIPT1     K2 attempts acquire → fails          K2: BLOCKED → SKIPT0     K1 acquires lock (TTL=5m)            K1: LOCKED----   -----                                 ------Time   Event                                 Status```Example timeline with 3 instances (K1, K2, K3):4. **Automatic cleanup** via Redis TTL when holder crashes3. **Non-holders** either abort (CRITICAL) or skip (ANALYTICS/CLEANUP)2. **Lock holders** can refresh to extend duration1. **Only one instance** holds the lock at any timeIn Kubernetes/multi-instance setups, the system ensures:## Multi-Instance Deployments```}  await DistributedLockService.releaseLock(handle);} finally {  return result;  }    await DistributedLockService.refreshLock(handle, 10 * 60 * 1000);  if (jobStillRunning) {  // Refresh if needed  const result = await executeJob();  // Job worktry {}  return;  logger.info("Lock unavailable, skipping job");if (!handle) {});  jobType: "ANALYTICS",  ttlMs: 10 * 60 * 1000,  lockKey: "pp:job:custom",const handle = await DistributedLockService.acquireLock({```typescriptFor complex scenarios:### Pattern 3: Manual Lock Management```}  }    await DistributedLockService.releaseLock(handle);    await stopHeartbeat();  } finally {    await doLongWork();    // Do work  try {  });    abortOnFailure: true,   // Abort if refresh fails    interval: 2 * 60 * 1000,  const stopHeartbeat = startLockHeartbeat(handle, {  // Start heartbeat: refresh every 2 minutes  if (!handle) throw new Error("Cannot acquire lock");  });    jobType: "CRITICAL",    ttlMs: 5 * 60 * 1000,  // 5 minute initial TTL    lockKey: "pp:job:long-task",  const handle = await DistributedLockService.acquireLock({async function processLongRunningJob() {import { startLockHeartbeat } from "@/lib/queue/lock-heartbeat";import { DistributedLockService } from "@/lib/queue/distributed-lock";```typescriptFor jobs that may exceed their initial TTL:### Pattern 2: Long-Running Job with Heartbeat```}  );    15 * 60 * 1000       // 15 minute TTL    handlePOST,    "pp:cron:my-job",    // Lock key    "CRITICAL",          // Job type    req,  return withCronLock(export async function POST(req: NextRequest) {}  return NextResponse.json({ success: true });  // Job logic hereasync function handlePOST(req: NextRequest) {import { withCronLock } from "@/lib/middleware/cron-auth";// app/api/v1/cron/my-job/route.ts```typescriptUse `withCronLock` middleware for HTTP cron endpoints:### Pattern 1: Cron Endpoints with Automatic Lock## Usage Patterns```end  return 0else  return redis.call("PEXPIRE", lockKey, newTtlMs)if redis.call("GET", lockKey) == token then```luaFor long-running jobs, heartbeat can renew the lock:### Lock Refresh```end  return 0else  return redis.call("DEL", lockKey)if redis.call("GET", lockKey) == token then```luaEnsures only the lock holder can release:### Lua Safe Release```);  ttlMs  "PX",       // Milliseconds TTL  "NX",       // Only set if not exists  token,      // Unique token per lock holder  lockKey,const result = await redis.set(```typescriptUses Redis `SET` with NX flag:### Token-Based Acquire## Implementation Details| CLEANUP | ✗ or Held | - | **SKIP** (returns null) || CLEANUP | ✓ | - | Executes with lock || ANALYTICS | ✗ or Held | - | **SKIP** (returns null) || ANALYTICS | ✓ | - | Executes with lock || CRITICAL | ✗ or Held | - | **ABORT** (throws error) || CRITICAL | ✓ | - | Executes with lock ||----------|-----------------|-----------|----------|| Job Type | Redis Available | Lock Held | Behavior |Based on job criticality, the system enforces different policies when locks are unavailable:### Failure Policies```);  { ttlMs: 30000 }  async (handle) => { /* job logic */ },  lockKey,  jobType,const result = await DistributedLockService.executeWithLock(// Execute job with automatic lock managementawait DistributedLockService.refreshLock(handle, newTtlMs);// Refresh for long-running jobsawait DistributedLockService.releaseLock(handle);// Safe release (token-based)});  jobType: "CRITICAL" | "ANALYTICS" | "CLEANUP",  ttlMs: 30 * 60 * 1000,  lockKey: "pp:cron:job-name",const handle = await DistributedLockService.acquireLock({// Token-based acquire```typescriptThe `DistributedLockService` provides the core lock management:### Lock Service## ArchitecturePhase 3 implements token-based distributed locks for cron jobs to prevent concurrent execution in multi-instance deployments. This ensures data consistency and prevents race conditions across the entire cluster.## Overview## Phase 0 - Immediate Containment (24-48 Hours)
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
- [x] Implement token-based lock acquire (`SET key value NX PX ttl`).
- [x] Implement Lua compare-and-delete lock release.
- [x] Add lock refresh/heartbeat for long-running cron tasks.
- [x] Abort job if lock refresh fails.
- [x] Define lock policy when Redis is unavailable:
  - [x] Critical cron: abort.
  - [x] Analytics cron: skip.
  - [x] Cleanup cron: skip.
- [x] Remove fail-open lock execution in cron paths (via explicit policy enforcement).

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
