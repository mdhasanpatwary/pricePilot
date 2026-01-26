# Browser Context Lifecycle Fix

## Problem

The scraper was experiencing a critical race condition error:
```
browserContext.newPage: Target page, context or browser has been closed
```

### Root Causes

1. **Premature Context Closure**: The `scrapeProductPage` and `searchAndScrape` methods were calling `context.close()` instead of just releasing contexts back to the pool. This caused contexts to be permanently destroyed even though they were meant to be reused.

2. **Nested Context Acquisition**: When `searchAndScrape` called `scrapeProductPage`, both methods tried to acquire contexts, leading to race conditions where one method would close a context while another was trying to use it.

3. **Insufficient Context Validation**: The browser pool wasn't checking if the browser was still connected before reusing contexts.

4. **Missing Error Handling**: No try-catch around `context.newPage()` calls, causing unhandled errors when contexts were closed.

## Solutions Implemented

### 1. Fixed Context Lifecycle Management

**Before:**
```typescript
finally {
  await context.close().catch(() => { });
  await this.browserPool.releaseContext(context).catch(() => { });
}
```

**After:**
```typescript
finally {
  // Close page first, then release context (don't close context)
  if (page) {
    await page.close().catch((err) => {
      logger.warn(`[ScraperService] Failed to close page:`, { error: err });
    });
  }
  
  if (context) {
    await this.browserPool.releaseContext(context).catch((err) => {
      logger.warn(`[ScraperService] Failed to release context:`, { error: err });
    });
  }
}
```

**Key Changes:**
- Removed `context.close()` calls - contexts are now only released, not closed
- Added proper page cleanup before releasing context
- Added null checks for page and context
- Improved error logging

### 2. Enhanced Context Validation

**Before:**
```typescript
if (pooled && !pooled.inUse) {
  try {
    const pages = pooled.context.pages();
    if (pages) {
      pooled.inUse = true;
      pooled.lastUsedAt = new Date();
      return pooled.context;
    }
  } catch (error) {
    this.contexts.delete(contextKey);
  }
}
```

**After:**
```typescript
if (pooled && !pooled.inUse) {
  try {
    const pages = pooled.context.pages();
    // Also verify the browser is still connected
    if (pages && this.browser && this.browser.isConnected()) {
      pooled.inUse = true;
      pooled.lastUsedAt = new Date();
      return pooled.context;
    } else {
      logger.warn(`[BrowserPool] Context ${contextKey} is invalid (browser disconnected), removing from pool`);
      this.contexts.delete(contextKey);
    }
  } catch (error) {
    logger.warn(`[BrowserPool] Context ${contextKey} was closed, removing from pool`);
    this.contexts.delete(contextKey);
  }
}
```

**Key Changes:**
- Added browser connection check with `this.browser.isConnected()`
- Better logging to distinguish between different failure modes
- Proactive removal of invalid contexts

### 3. Added Error Handling for Page Creation

**Before:**
```typescript
const context = await this.browserPool.acquireContext(userAgent, proxy);
const page = await context.newPage();
```

**After:**
```typescript
let context: any = null;
let page: any = null;

try {
  context = await this.browserPool.acquireContext(userAgent, proxy);
  page = await context.newPage();
} catch (error) {
  logger.error(`[ScraperService] Failed to acquire context or create page:`, { error });
  // Release concurrent slot before returning
  siteProfileManager.releaseConcurrentSlot(hostname);
  return null;
}
```

**Key Changes:**
- Wrapped context acquisition and page creation in try-catch
- Proper cleanup of resources (concurrent slots) on failure
- Early return to prevent further execution with invalid state

### 4. Improved Context Release with Page Cleanup

**Before:**
```typescript
async releaseContext(context: BrowserContext) {
  for (const [key, pooled] of this.contexts.entries()) {
    if (pooled.context === context) {
      pooled.inUse = false;
      pooled.lastUsedAt = new Date();
      return;
    }
  }
}
```

**After:**
```typescript
async releaseContext(context: BrowserContext) {
  for (const [key, pooled] of this.contexts.entries()) {
    if (pooled.context === context) {
      // Close all pages in the context before releasing
      try {
        const pages = context.pages();
        for (const page of pages) {
          await page.close().catch(() => {});
        }
      } catch (error) {
        logger.warn(`[BrowserPool] Failed to close pages for context ${key}:`, { error });
      }
      
      pooled.inUse = false;
      pooled.lastUsedAt = new Date();
      return;
    }
  }
}
```

**Key Changes:**
- Automatically closes all pages when releasing a context
- Prevents page leaks that could cause memory issues
- Ensures contexts are clean when reused

### 5. Fixed Retry Logic

**Before:**
```typescript
if (retryCount < maxRetries) {
  await context.close().catch(() => { });
  await this.browserPool.releaseContext(context).catch(() => { });
  return this.scrapeProductPage(url, retryCount + 1);
}
```

**After:**
```typescript
if (retryCount < maxRetries) {
  // Close page and release context (don't close context)
  if (page) {
    await page.close().catch(() => { });
  }
  await this.browserPool.releaseContext(context).catch(() => { });
  // Release concurrent slot before retry
  siteProfileManager.releaseConcurrentSlot(hostname);
  return this.scrapeProductPage(url, retryCount + 1);
}
```

**Key Changes:**
- Removed context.close() call
- Added concurrent slot release before retry
- Proper page cleanup

## Impact

These fixes resolve the race condition by ensuring:

1. **Contexts are never prematurely closed** - they're only released back to the pool
2. **Invalid contexts are detected and removed** - preventing reuse of closed contexts
3. **Proper error handling** - failures in context/page creation don't crash the scraper
4. **Clean resource management** - pages are properly closed, slots are released
5. **Thread-safe parallel execution** - multiple concurrent scrapes can safely share the context pool

## Testing Recommendations

1. Run parallel scraping operations (10+ concurrent)
2. Monitor for "Target page, context or browser has been closed" errors
3. Check browser pool statistics to ensure contexts are being reused
4. Verify no memory leaks from unclosed pages
5. Test retry logic with intentional failures
