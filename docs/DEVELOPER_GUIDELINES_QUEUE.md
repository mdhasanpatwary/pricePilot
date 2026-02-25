# PricePilot Queue Development Guidelines

To ensure system stability, tenant fairness, and build-time safety, all developers must adhere to the following rules when working with the queue system and background services.

## 1. Architectural Boundaries (The "/app" Rule)
**CRITICAL**: Files inside the `app/` directory (routes, components, etc.) must NEVER import backend-heavy modules from `lib/queue/worker.ts` or `lib/services/*` directly.

- **Reason**: Next.js executes top-level code in the `app/` directory during static analysis at build time. Eagerly importing workers or services often triggers Redis or Database connections, causing build failures in environments (like CI/CD) where these services are unavailable.
- **Solution**: Use dynamic imports or the `ServiceProxy` pattern for accessing services from within the `app` directory.

## 2. Mandatory Tenant Fairness (The "groupId" Rule)
Every job added to a BullMQ queue MUST include a `groupId` in its job options.

- **Bad**:
  ```typescript
  await queue.add("my-job", data);
  ```
- **Good**:
  ```typescript
  await queue.add("my-job", data, { groupId: data.tenantId });
  ```
- **Reason**: `groupId` is used by the BullMQ Flow/Fairness engine to ensure that a single tenant cannot saturate all worker slots.

## 3. Concurrency Governance
Always use the `tryAcquireTenantSlot` and `decrementTenantActive` utilities when processing jobs that involve external resources (like scraping).

- Ensure slots are released in a `finally` block or via worker event listeners (`completed`, `failed`).
- Respect the `TIER_CONCURRENCY_LIMITS` defined in `lib/queue/worker.ts`.

## 4. Lazy Initialization
Avoid top-level side effects (like connecting to Redis) in `lib/` files. Use the singleton pattern with lazy initialization (e.g., `getRedisConnection()`).

## 5. Compliance Monitoring
All changes are subject to automated checks by `scripts/check-queue-compliance.ts`. Violations will block the build.
