---
description: Verify the background job concurrency tuning implementation
---

# Background Job Concurrency Verification

1. Check that `ScrapingScheduler` submits jobs without artificial delays.
2. Verify that `ScrapeOrchestrator` uses `ConcurrencyLimiter`.
3. ensuring that concurrency is limited per site.

## Steps

### 1. Check ScrapingScheduler Implementation
View `lib/services/bot-protection/scraping-scheduler.ts` and confirm:
- `setTimeout` loop is removed
- `executeScrape` calls are made concurrently (in a batch)

### 2. Check ScrapeOrchestrator Implementation
View `lib/services/bot-protection/scrape-orchestrator.ts` and confirm:
- `ConcurrencyLimiter` is imported and initialized
- `acquireSlot` is called at the beginning of `executeScrape`
- `recordResult` and `releaseSlot` are called in `finally` block

### 3. Check ConcurrencyLimiter Implementation
View `lib/services/concurrency-limiter.ts` and confirm:
- `recordResult` method exists and updates metrics
- `SiteState` has `recentResults` for tracking history

## automated check script
You can run this script to verify the logic.

```typescript
// scripts/verify-concurrency.ts
import { ConcurrencyLimiter } from '../lib/services/concurrency-limiter';

async function testConcurrency() {
    const limiter = new ConcurrencyLimiter({
        minConcurrency: 1,
        maxConcurrency: 5,
        initialConcurrency: 2
    });

    console.log('Testing ConcurrencyLimiter...');

    const site = 'example.com';

    // Acquire slot 1
    console.log('Acquiring slot 1...');
    await limiter.acquireSlot(site);
    console.log('Slot 1 acquired.');

    // Acquire slot 2
    console.log('Acquiring slot 2...');
    await limiter.acquireSlot(site);
    console.log('Slot 2 acquired.');

    // Acquire slot 3 (should block)
    console.log('Acquiring slot 3 (should wait)...');
    let slot3Acquired = false;
    const p3 = limiter.acquireSlot(site).then(() => {
        slot3Acquired = true;
        console.log('Slot 3 acquired!');
    });

    // Wait a short time to verify blocking
    await new Promise(resolve => setTimeout(resolve, 500));
    if (!slot3Acquired) {
        console.log('Confirmed: Slot 3 is waiting.');
    } else {
        console.error('FAILURE: Slot 3 acquired unexpectedly.');
    }

    // Release slot 1 to unblock slot 3
    console.log('Releasing slot 1...');
    limiter.releaseSlot(site);

    // Wait for slot 3 acquisition
    await p3;

    // Test metric recording (simulate blocks to reduce concurrency)
    console.log('Testing metric recording (simulating blocks)...');
    for (let i = 0; i < 20; i++) {
        limiter.recordResult(site, false, true, 200); // failed, blocked, 200ms response time
    }

    const currentConcurrency = limiter.getCurrentConcurrency(site);
    console.log('Current concurrency after blocks:', currentConcurrency);

    if (currentConcurrency === 1) {
        console.log('SUCCESS: Concurrency correctly reduced to 1.');
    } else {
        console.error('FAILURE: Concurrency should be 1, got', currentConcurrency);
    }
}

testConcurrency().catch(console.error);
```
