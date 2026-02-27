# Phase 4 – Scraper Runtime Hardening

As cluster scale grows, we need a more robust way of tracking browser capacity and
protecting individual workers from runaway memory use.  Phase 4 focuses on
heartbeat-based aggregation, improved metrics, and memory guards.

## Heartbeat-based node aggregation

Previous releases used a shared Redis hash (`pp:browsers:active_nodes`) that each
node updated with its current browser count.  This approach suffered from stale
entries when nodes crashed and required manual pruning.

### New design

- Each instance writes its own heartbeat key:
  `pp:browsers:node_heartbeat:<instanceId>` containing a small JSON blob
  `{count:<n>}`.  The key has a short TTL (30 s) and is refreshed every 15 s.
- Capacity calculations scan `pp:browsers:node_heartbeat:*` and sum the counts.
  Expired keys are automatically ignored; liveness is implicit in key existence.
- Global-cap enforcement (`checkGlobalBrowserCap()`) now uses this aggregation
  logic and throws when the cluster-wide total meets or exceeds
  `MAX_GLOBAL_BROWSERS`.
- Shutdown and cleanup routines remove the individual heartbeat key instead of
  touching a shared hash.
- The monitoring service no longer prunes a shared hash; it simply cleans up
  any malformed heartbeat entries if found.

This change satisfies several Phase 4 TODOs:

- Replace static browser count hash with heartbeat-based aggregation.
- Add expiry-based node aggregation.
- Verify active-worker liveness before counting.

## Metrics enhancements

To support observability and post‑mortem analysis:

- `OperationalMetricsService.recordBrowserCount(nodeId, count)` stores the
  latest per-node browser count in the minute-bucket metrics namespace.
- `OperationalMetricsService.recordMemorySnapshot(rssMb)` records a simple RSS
  snapshot each time a browser context is acquired.
- Heartbeat logic emits a browser count metric during each interval.
- Scraper code (via `BrowserPool.getContext()`) records a memory snapshot for
  every ``getContext`` call, providing a per-job view of RSS.

These additions lay the groundwork for later dashboards and alert rules (Phase 6).

## Memory guards and worker restart policy

Workers now track RSS against both absolute caps and delta thresholds:

- `WORKER_MAX_RSS_MB` is a hard limit that triggers a graceful restart when
  exceeded.
- `WORKER_RSS_WARN_MB` logs a warning when the warning threshold is hit.
- `WORKER_RSS_DELTA_MB` (new) causes a restart if the RSS jumps by the
  configured amount between monitoring intervals; useful for detecting memory
  leaks introduced by a single batch of work.

The delta logic is active only if the environment variable is set to a
positive value.

## Rolling restart windows

To prevent thundering herd during coordinated worker restarts (e.g., when many
instances hit a memory limit around the same time), workers can apply a random
startup jitter:

- `WORKER_RESTART_WINDOW_MS`: If set to a positive value, each worker delays its
  startup by a random interval within this window.  For example,
  `WORKER_RESTART_WINDOW_MS=60000` spreads restarts across a 60-second window,
  preventing all workers from restarting simultaneously.
- When a restart is triggered (via RSS cap or delta), the worker schedules a
  graceful shutdown with the same jitter logic to spread the restart wave.

## Tenant isolation in browser contexts

The browser pool now **includes tenant ID in the context key**, ensuring that
contexts from different tenants are never reused:

- Each context is keyed by `{userAgent}_{proxy}_{stealth}_{tenantId}` instead of
  the previous `{userAgent}_{proxy}_{stealth}`.
- This prevents:
  - **Cookie leakage** between tenants (each tenant gets its own context with its
    own cookie jar).
  - **Proxy rotation misalignment** (each tenant's proxy sequence is isolated).
  - **Context pollution** (stale data from one tenant's scraping doesn't bleed
    into another tenant's session).
- Scraper methods now propagate tenant IDs through internal calls so they reach
  `acquireContext()` and enforce isolation.

## Upcoming work

Optional enhancements for future phases:

- Per-tenant browser pool metrics and alerts.
- Cross-tenant cookie/proxy isolation testing in CI.
- Tenant-aware circuit breaker policies.

With the heartbeat, metrics, memory guards, and tenant isolation in place, the
system is significantly more robust for multi-tenant cluster deployments. Future
phases will build on these foundations to provide deeper observability and
automated incident response.
