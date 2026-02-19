# Multi-Worker Soak Test Runbook (2 -> 3 Workers)

This runbook validates that PricePilot can safely run multiple worker instances with Redis-backed coordination.

## Scope

Checks covered by automation (`yarn verify:multi-worker`):

1. Retry queue atomic claim duplicate-safety
2. Tenant concurrency Redis limiter enforcement
3. Distributed site concurrency guard behavior
4. BullMQ `jobId` dedupe behavior
5. Global fail-open rate-limit propagation via Redis key

## Prerequisites

1. Redis reachable from worker host
2. `DATABASE_URL` and `REDIS_URL` configured (`.env` or environment)
3. Dependencies installed (`yarn install`)
4. PM2 installed for process-level soak (`pm2 -v`)

## Phase 0: Baseline Validation (single process)

From repo root:

```bash
yarn lint
yarn build
yarn verify:multi-worker
```

Pass criteria:

1. `verify:multi-worker` summary shows `Failed: 0`

## Phase 1: Start 2 Worker Instances (PM2)

`start-worker.ts` enforces single-instance in non-production unless explicitly disabled.
Set `WORKER_SINGLE_INSTANCE=false` for this test.

```bash
export NODE_ENV=production
export WORKER_SINGLE_INSTANCE=false

pm2 delete pricepilot-worker || true
pm2 start ecosystem.config.js --only pricepilot-worker --env production
pm2 scale pricepilot-worker 2
pm2 list
```

Confirm:

1. `pricepilot-worker` has `2` online instances

## Phase 2: Run Soak at 2 Workers

Quick soak (10 iterations):

```bash
yarn soak:multi-worker
```

Custom soak (example: 30 iterations, 3s gap):

```bash
bash scripts/run-multi-worker-soak.sh 30 3
```

Custom soak with explicit per-iteration timeout (example: 50 iterations, 2s gap, 180s timeout each):

```bash
bash scripts/run-multi-worker-soak.sh 50 2 180
```

Pass criteria:

1. Script exits `0`
2. Summary shows `Failed: 0`
3. No repeated duplicate-processing errors in worker logs

Useful logs:

```bash
pm2 logs pricepilot-worker --lines 200
```

## Phase 3: Scale to 3 Workers

```bash
pm2 scale pricepilot-worker 3
pm2 list
```

Confirm:

1. `pricepilot-worker` has `3` online instances

Then run heavier soak:

```bash
bash scripts/run-multi-worker-soak.sh 50 2 180
```

Pass criteria:

1. Exit code `0`
2. `Failed: 0`
3. No lock contention explosions or repeated duplicate claim symptoms

## Optional Runtime Health Checks During Soak

Queue status endpoint:

```bash
curl -s http://localhost:3000/api/v1/admin/queue-status | jq .
```

Tenant concurrency counters endpoint:

```bash
curl -s http://localhost:3000/api/v1/admin/scraping/tenant-concurrency | jq .
```

## Rollback (if failures appear)

Immediate stabilization:

```bash
pm2 scale pricepilot-worker 1
pm2 restart pricepilot-worker
```

Then re-run baseline:

```bash
yarn verify:multi-worker
```

## Expected Outputs

`yarn verify:multi-worker` should print:

1. `Total checks: 5`
2. `Passed: 5`
3. `Failed: 0`

`bash scripts/run-multi-worker-soak.sh` should print summary with:

1. `Failed: 0`

## Notes

1. `Atomic retry claim` may not claim all seeded rows in one contention round; the key condition is no duplicate claim and accounting consistency.
2. If your environment uses strict auth on admin APIs, add auth headers/cookies for optional curl checks.
