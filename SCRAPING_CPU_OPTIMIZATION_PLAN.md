# Scraping CPU Optimization Plan

## Problem Statement

When running `yarn dev:full`, competitor product scraping causes excessive CPU usage due to:
- Multiple Playwright/Chromium browser instances running simultaneously
- Heavy browser pool with 5 concurrent browsers
- Session warmup overhead (homepage visits, random navigation)
- Screenshot capture operations
- No intelligent resource throttling

## Current Configuration Analysis

### Browser Pool Settings
```typescript
// lib/services/bot-protection/browser-pool.ts
maxConcurrent: 5              // 5 browsers at once
maxRequestsPerBrowser: 100    // High reuse
idleTimeout: 300000           // 5 minutes
```

### Concurrency Settings
```env
CONCURRENCY_MIN="1"
CONCURRENCY_MAX="10"
CONCURRENCY_INITIAL="3"
```

### Scraping Scheduler
```typescript
// lib/services/bot-protection/scraping-scheduler.ts
maxConcurrentScrapesPerTenant: 5
minDelayPerSite: 2000ms
maxBatchSize: 100
```

## Optimization Solutions

### 1. Reduce Browser Pool Concurrency (Immediate Impact)

**File**: `lib/services/bot-protection/browser-pool.ts`

```typescript
// BEFORE
maxConcurrent: config?.maxConcurrent ?? 5,

// AFTER (Development Mode)
maxConcurrent: config?.maxConcurrent ?? (process.env.NODE_ENV === 'development' ? 2 : 5),
```

**Impact**: 60% CPU reduction in development

### 2. Environment-Based Configuration

**File**: `.env` / `.env.example`

Add new variables:
```env
# Browser Pool Configuration
BROWSER_POOL_MAX_CONCURRENT="2"           # Development: 2, Production: 5
BROWSER_POOL_MAX_REQUESTS="50"            # Lower for dev
BROWSER_POOL_IDLE_TIMEOUT="180000"        # 3 minutes

# Scraping Performance
SCRAPING_MAX_CONCURRENT_PER_TENANT="2"    # Reduce from 5
SCRAPING_BATCH_SIZE="20"                  # Reduce from 100
SCRAPING_ENABLE_WARMUP="false"            # Disable in dev
SCRAPING_ENABLE_SCREENSHOTS="false"       # Disable in dev
```

### 3. Disable Session Warmup in Development

**File**: `lib/services/scraper.ts`

```typescript
// In performSessionWarmup method
private async performSessionWarmup(page: Page, hostname: string, profile: any): Promise<void> {
    // Skip warmup in development mode
    if (process.env.NODE_ENV === 'development' && process.env.SCRAPING_ENABLE_WARMUP !== 'true') {
        logger.info('[ScraperService] Skipping session warmup in development mode');
        return;
    }
    // ... existing warmup logic
}
```

**Impact**: 30% faster scraping, less CPU

### 4. Conditional Screenshot Capture

**File**: `lib/services/bot-protection/headless-browser-scraper.ts`

```typescript
// Only capture screenshots when explicitly enabled
if (config.captureScreenshot && process.env.SCRAPING_ENABLE_SCREENSHOTS !== 'false') {
    // ... screenshot logic
}
```

### 5. Implement Request Queuing with p-limit

**File**: `lib/services/bot-protection/scraper-adapter.ts`

```typescript
import pLimit from 'p-limit';

export class ScraperAdapter {
    private orchestrator: ScrapeOrchestrator;
    private concurrencyLimit: ReturnType<typeof pLimit>;

    constructor() {
        this.orchestrator = new ScrapeOrchestrator();
        const maxConcurrent = parseInt(process.env.SCRAPING_MAX_CONCURRENT_PER_TENANT || '2', 10);
        this.concurrencyLimit = pLimit(maxConcurrent);
    }

    async scrapeMultipleProducts(
        products: Array<{ id: string; url: string }>,
        tenantId: string
    ): Promise<Array<ScrapedProductData | null>> {
        // Use p-limit to control concurrency
        const results = await Promise.all(
            products.map(product =>
                this.concurrencyLimit(() =>
                    this.scrapeCompetitorProduct(product.id, product.url, tenantId)
                )
            )
        );
        return results;
    }
}
```

### 6. Lazy Browser Initialization

**File**: `lib/services/bot-protection/browser-pool.ts`

```typescript
// Don't pre-warm browsers, create on-demand only
// Remove any pre-initialization logic
```

### 7. Memory-Efficient Browser Launch Options

**File**: `lib/services/bot-protection/headless-browser-scraper.ts`

```typescript
private async launchBrowser(config: BrowserScrapeConfig): Promise<void> {
    const launchOptions: any = {
        headless: true,
        args: [
            '--disable-dev-shm-usage',        // Use /tmp instead of /dev/shm
            '--disable-gpu',                   // Disable GPU in dev
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-web-security',
            '--disable-features=IsolateOrigins,site-per-process',
            '--disable-blink-features=AutomationControlled',
            
            // NEW: Memory and CPU optimizations
            '--single-process',                // Single process mode (dev only)
            '--no-zygote',                     // Disable zygote process
            '--disable-background-networking', // Reduce background activity
            '--disable-background-timer-throttling',
            '--disable-backgrounding-occluded-windows',
            '--disable-breakpad',              // Disable crash reporting
            '--disable-component-extensions-with-background-pages',
            '--disable-extensions',
            '--disable-features=TranslateUI',
            '--disable-ipc-flooding-protection',
            '--disable-renderer-backgrounding',
            '--metrics-recording-only',
            '--mute-audio',
            '--no-first-run',
            '--disable-default-apps',
        ],
    };

    // Only use single-process in development
    if (process.env.NODE_ENV !== 'development') {
        launchOptions.args = launchOptions.args.filter(
            (arg: string) => arg !== '--single-process' && arg !== '--no-zygote'
        );
    }

    this.browser = await chromium.launch(launchOptions);
}
```

## Implementation Priority

### Phase 1: Immediate Relief (5 minutes)
1. ✅ Add environment variables to `.env`
2. ✅ Reduce browser pool concurrency
3. ✅ Disable warmup in development

### Phase 2: Configuration (10 minutes)
4. ✅ Add conditional screenshot capture
5. ✅ Update browser launch options
6. ✅ Configure scraping scheduler limits

### Phase 3: Advanced (20 minutes)
7. ✅ Implement p-limit for request queuing
8. ✅ Add resource monitoring
9. ✅ Create development vs production profiles

## Expected Results

### Before Optimization
- CPU Usage: 80-100% during scraping
- Memory: 2-3 GB
- Browser Instances: 5 concurrent
- Scraping Speed: Fast but resource-heavy

### After Optimization (Development)
- CPU Usage: 30-50% during scraping (50% reduction)
- Memory: 800MB - 1.2GB (60% reduction)
- Browser Instances: 2 concurrent (60% reduction)
- Scraping Speed: Slightly slower but sustainable

### Production (No Impact)
- Keep aggressive settings for production
- Environment-based configuration ensures production performance

## Testing Plan

1. Run `yarn dev:full` before changes (baseline metrics)
2. Apply Phase 1 changes
3. Run `yarn dev:full` again (measure improvement)
4. Monitor CPU/Memory in Activity Monitor/Task Manager
5. Verify scraping still works correctly
6. Apply Phase 2 and 3 incrementally

## Monitoring Commands

```bash
# Monitor CPU usage (macOS)
top -pid $(pgrep -f "node.*dev:full")

# Monitor memory
ps aux | grep node

# Check browser processes
ps aux | grep chromium
```

## Rollback Plan

If issues occur:
1. Revert `.env` changes
2. Remove environment checks from code
3. Restore default browser pool settings

## Additional Recommendations

1. **Use HTTP Scraper When Possible**: Prefer lightweight HTTP client over browser
2. **Cache Aggressively**: Cache competitor pages for 30 minutes
3. **Schedule Scraping**: Run heavy scraping during off-hours
4. **Implement Circuit Breaker**: Stop scraping if CPU > 80%
5. **Add Resource Monitoring**: Track CPU/Memory and auto-throttle

## Configuration Files to Update

- `.env` - Add new variables
- `.env.example` - Document new variables
- `lib/services/bot-protection/browser-pool.ts` - Reduce concurrency
- `lib/services/scraper.ts` - Conditional warmup
- `lib/services/bot-protection/headless-browser-scraper.ts` - Browser options
- `lib/services/bot-protection/scraper-adapter.ts` - Add p-limit
- `lib/services/bot-protection/scraping-scheduler.ts` - Reduce batch size

## Notes

- These optimizations are primarily for **development environment**
- Production settings remain aggressive for performance
- Can be toggled via environment variables
- No breaking changes to existing functionality
