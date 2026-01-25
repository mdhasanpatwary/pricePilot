import { chromium, Browser, BrowserContext } from "playwright";
import { logger } from "../logger";

interface PooledContext {
  context: BrowserContext;
  inUse: boolean;
  createdAt: Date;
  lastUsedAt: Date;
}

/**
 * Browser Pool Manager
 * Manages a pool of browser contexts to prevent memory leaks and improve performance
 */
export class BrowserPool {
  private static instance: BrowserPool | null = null;
  private browser: Browser | null = null;
  private contexts: Map<string, PooledContext> = new Map();
  private maxContexts: number = 10;
  private contextTimeout: number = 5 * 60 * 1000; // 5 minutes
  private cleanupInterval: NodeJS.Timeout | null = null;

  private constructor() {
    // Private constructor for singleton
  }

  /**
   * Get singleton instance
   */
  static getInstance(): BrowserPool {
    if (!BrowserPool.instance) {
      BrowserPool.instance = new BrowserPool();
    }
    return BrowserPool.instance;
  }

  /**
   * Initialize the browser pool
   */
  async init(maxContexts: number = 10) {
    if (this.browser) {
      logger.info("[BrowserPool] Already initialized");
      return;
    }

    this.maxContexts = maxContexts;
    this.browser = await chromium.launch({
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
        "--disable-blink-features=AutomationControlled",
        "--ignore-certificate-errors",
        "--no-first-run",
        "--no-service-autorun",
        "--password-store=basic",
      ],
    });

    logger.info(`[BrowserPool] Initialized with max ${maxContexts} contexts`);

    // Start cleanup interval
    this.startCleanup();
  }

  /**
   * Acquire a browser context from the pool
   */
  async acquireContext(
    userAgent?: string,
    proxy?: { server: string },
  ): Promise<BrowserContext> {
    if (!this.browser) {
      await this.init();
    }

    // Try to find an available context with matching config
    const contextKey = this.getContextKey(userAgent, proxy);
    const pooled = this.contexts.get(contextKey);

    if (pooled && !pooled.inUse) {
      pooled.inUse = true;
      pooled.lastUsedAt = new Date();
      logger.info(`[BrowserPool] Reusing context: ${contextKey}`);
      return pooled.context;
    }

    // Check if we've hit the pool limit
    if (this.contexts.size >= this.maxContexts) {
      // Try to evict an unused context
      const evicted = await this.evictOldestUnusedContext();
      if (!evicted) {
        logger.warn(
          "[BrowserPool] Pool limit reached, waiting for available context",
        );
        // Wait for a context to become available
        return this.waitForAvailableContext(userAgent, proxy);
      }
    }

    // Create new context with realistic fingerprints
    const context = await this.browser!.newContext({
      userAgent:
        userAgent ||
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
      proxy,
      viewport: { width: 1920, height: 1080 },
      deviceScaleFactor: 1,
      hasTouch: false,
      locale: 'en-US',
      timezoneId: 'Asia/Dhaka',
      extraHTTPHeaders: {
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
        'Accept-Language': 'en-US,en;q=0.9',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache',
        'Sec-Ch-Ua': '"Not A(Brand";v="99", "Google Chrome";v="121", "Chromium";v="121"',
        'Sec-Ch-Ua-Mobile': '?0',
        'Sec-Ch-Ua-Platform': '"Windows"',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Sec-Fetch-User': '?1',
        'Upgrade-Insecure-Requests': '1',
      }
    });

    // Stealth: Disable webdriver property
    await context.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', {
        get: () => undefined,
      });
    });

    const pooledContext: PooledContext = {
      context,
      inUse: true,
      createdAt: new Date(),
      lastUsedAt: new Date(),
    };

    this.contexts.set(contextKey, pooledContext);
    logger.info(
      `[BrowserPool] Created new context: ${contextKey} (${this.contexts.size}/${this.maxContexts})`,
    );

    return context;
  }

  /**
   * Release a browser context back to the pool
   */
  async releaseContext(context: BrowserContext) {
    for (const [key, pooled] of this.contexts.entries()) {
      if (pooled.context === context) {
        pooled.inUse = false;
        pooled.lastUsedAt = new Date();
        logger.info(`[BrowserPool] Released context: ${key}`);
        return;
      }
    }
  }

  /**
   * Generate a unique key for context configuration
   */
  private getContextKey(
    userAgent?: string,
    proxy?: { server: string },
  ): string {
    const ua = userAgent || "default";
    const proxyServer = proxy?.server || "none";
    return `${ua.substring(0, 20)}_${proxyServer}`;
  }

  /**
   * Wait for an available context
   */
  private async waitForAvailableContext(
    userAgent?: string,
    proxy?: { server: string },
  ): Promise<BrowserContext> {
    return new Promise((resolve) => {
      const checkInterval = setInterval(async () => {
        const contextKey = this.getContextKey(userAgent, proxy);
        const pooled = this.contexts.get(contextKey);

        if (pooled && !pooled.inUse) {
          clearInterval(checkInterval);
          pooled.inUse = true;
          pooled.lastUsedAt = new Date();
          resolve(pooled.context);
        } else {
          // Check if any context is available
          for (const [, ctx] of this.contexts.entries()) {
            if (!ctx.inUse) {
              clearInterval(checkInterval);
              ctx.inUse = true;
              ctx.lastUsedAt = new Date();
              resolve(ctx.context);
              return;
            }
          }
        }
      }, 100);
    });
  }

  /**
   * Evict the oldest unused context
   */
  private async evictOldestUnusedContext(): Promise<boolean> {
    let oldestKey: string | null = null;
    let oldestTime = Date.now();

    for (const [key, pooled] of this.contexts.entries()) {
      if (!pooled.inUse && pooled.lastUsedAt.getTime() < oldestTime) {
        oldestKey = key;
        oldestTime = pooled.lastUsedAt.getTime();
      }
    }

    if (oldestKey) {
      const pooled = this.contexts.get(oldestKey)!;
      try {
        await pooled.context.close();
        this.contexts.delete(oldestKey);
        logger.info(`[BrowserPool] Evicted context: ${oldestKey}`);
      } catch (error) {
        logger.error(`[BrowserPool] Failed to evict context ${oldestKey}:`, { error });
        // Force remove from pool even if close failed
        this.contexts.delete(oldestKey);
      }
      return true;
    }

    return false;
  }

  /**
   * Start periodic cleanup of stale contexts
   */
  private startCleanup() {
    if (this.cleanupInterval) return;

    this.cleanupInterval = setInterval(async () => {
      const now = Date.now();
      const toRemove: string[] = [];

      for (const [key, pooled] of this.contexts.entries()) {
        if (
          !pooled.inUse &&
          now - pooled.lastUsedAt.getTime() > this.contextTimeout
        ) {
          toRemove.push(key);
        }
      }

      for (const key of toRemove) {
        const pooled = this.contexts.get(key)!;
        try {
          await pooled.context.close();
          this.contexts.delete(key);
          logger.info(`[BrowserPool] Cleaned up stale context: ${key}`);
        } catch (error) {
          logger.error(`[BrowserPool] Failed to close context ${key}:`, { error });
          // Force remove from pool even if close failed to prevent memory leak
          this.contexts.delete(key);
        }
      }

      if (toRemove.length > 0) {
        logger.info(
          `[BrowserPool] Cleanup completed: removed ${toRemove.length} stale contexts`,
        );
      }
    }, 60000); // Run every minute
  }

  /**
   * Get pool statistics
   */
  getStats() {
    const total = this.contexts.size;
    const inUse = Array.from(this.contexts.values()).filter(
      (c) => c.inUse,
    ).length;
    const available = total - inUse;

    return {
      total,
      inUse,
      available,
      maxContexts: this.maxContexts,
    };
  }

  /**
   * Close all contexts and the browser
   */
  async close() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }

    const closePromises: Promise<void>[] = [];
    for (const [key, pooled] of this.contexts.entries()) {
      closePromises.push(
        pooled.context.close().catch((error) => {
          logger.error(`[BrowserPool] Failed to close context ${key}:`, { error });
        })
      );
    }

    // Wait for all contexts to close (or fail) before proceeding
    await Promise.allSettled(closePromises);
    this.contexts.clear();

    if (this.browser) {
      try {
        await this.browser.close();
        this.browser = null;
        logger.info("[BrowserPool] Browser closed");
      } catch (error) {
        logger.error("[BrowserPool] Failed to close browser:", { error });
        this.browser = null; // Force null even if close failed
      }
    }

    BrowserPool.instance = null;
  }
}
