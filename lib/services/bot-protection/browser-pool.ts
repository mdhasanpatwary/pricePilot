/**
 * Browser Pool Management
 * 
 * Manages a pool of browser instances to reduce overhead and improve performance.
 * Implements instance reuse, concurrent browser limits, automatic restarts, and idle timeouts.
 */

import { Browser, BrowserContext, chromium } from 'playwright';
import { BrowserScrapeConfig } from './headless-browser-scraper';

/**
 * Browser instance in the pool
 */
interface BrowserInstance {
    /** Browser instance */
    browser: Browser;
    /** Browser context */
    context: BrowserContext;
    /** Number of requests handled by this instance */
    requestCount: number;
    /** Timestamp of last use */
    lastUsed: Date;
    /** Whether instance is currently in use */
    inUse: boolean;
    /** Configuration used to launch this browser */
    config: BrowserScrapeConfig;
    /** Whether instance has been invalidated (closed/removed) */
    invalidated: boolean;
}

/**
 * Browser Pool configuration
 */
export interface BrowserPoolConfig {
    /** Maximum number of concurrent browser instances */
    maxConcurrent: number;
    /** Maximum requests per browser before restart */
    maxRequestsPerBrowser: number;
    /** Idle timeout in milliseconds before closing browser */
    idleTimeout: number;
}

/**
 * Browser Pool Manager
 * 
 * Manages a pool of browser instances with automatic lifecycle management.
 */
export class BrowserPool {
    private static instance: BrowserPool | null = null;

    /**
     * Global singleton instance.
     *
     * Why: constructing pools repeatedly can spawn multiple Chromium instances
     * (and their many subprocesses), which is expensive in local dev.
     */
    static getInstance(config?: Partial<BrowserPoolConfig>): BrowserPool {
        if (!BrowserPool.instance) {
            BrowserPool.instance = new BrowserPool(config);
        }
        return BrowserPool.instance;
    }

    /**
     * Shutdown the shared pool (best-effort).
     *
     * Used by dev scripts/workers to ensure Playwright processes don't linger
     * after SIGINT/SIGTERM.
     */
    static async shutdown(): Promise<void> {
        if (!BrowserPool.instance) return;
        const instance = BrowserPool.instance;
        BrowserPool.instance = null;
        await instance.closeAll();
    }

    private instances: BrowserInstance[] = [];
    private config: BrowserPoolConfig;
    private cleanupInterval: NodeJS.Timeout | null = null;
    private pendingCreates: Map<string, Promise<BrowserInstance>> = new Map();

    /**
     * Create a new browser pool
     * 
     * @param config - Pool configuration
     */
    constructor(config?: Partial<BrowserPoolConfig>) {
        // Use environment variables with fallbacks
        const maxConcurrent = parseInt(process.env.BROWSER_POOL_MAX_CONCURRENT || '5', 10);
        const maxRequests = parseInt(process.env.BROWSER_POOL_MAX_REQUESTS || '100', 10);
        const idleTimeout = parseInt(process.env.BROWSER_POOL_IDLE_TIMEOUT || '300000', 10);

        this.config = {
            maxConcurrent: config?.maxConcurrent ?? maxConcurrent,
            maxRequestsPerBrowser: config?.maxRequestsPerBrowser ?? maxRequests,
            idleTimeout: config?.idleTimeout ?? idleTimeout,
        };

        // Start cleanup interval
        this.startCleanupInterval();
    }

    /**
     * Acquire a browser instance from the pool
     * 
     * @param config - Browser scrape configuration
     * @returns Promise resolving to browser context
     */
    async acquire(config: BrowserScrapeConfig): Promise<BrowserContext> {
        // Try to find an available instance with matching configuration
        let instance = this.findAvailableInstance(config);

        // If we already have a matching instance (even if currently in use),
        // wait for it instead of creating a second instance for the same domain.
        if (!instance) {
            const anyMatch = this.findAnyMatchingInstance(config);
            if (anyMatch) {
                instance = await this.waitForAvailableInstance(config);
            } else if (this.instances.length < this.config.maxConcurrent) {
                // Prevent concurrent callers from creating multiple instances for the same config key.
                const key = this.getConfigKey(config);
                const pending = this.pendingCreates.get(key);
                if (pending) {
                    instance = await pending;
                } else {
                    const createPromise = this.createInstance(config).finally(() => {
                        this.pendingCreates.delete(key);
                    });
                    this.pendingCreates.set(key, createPromise);
                    instance = await createPromise;
                }
            }
        }

        // If still no instance, wait for one to become available
        if (!instance) {
            instance = await this.waitForAvailableInstance(config);
        }

        // Mark instance as in use
        instance.inUse = true;
        instance.lastUsed = new Date();
        instance.requestCount++;

        // Check if instance needs restart
        if (instance.requestCount >= this.config.maxRequestsPerBrowser) {
            // Schedule restart after current request completes
            this.scheduleRestart(instance);
        }

        return instance.context;
    }

    /**
     * Release a browser instance back to the pool
     * 
     * @param context - Browser context to release
     */
    async release(context: BrowserContext): Promise<void> {
        const instance = this.instances.find((i) => i.context === context);
        if (instance) {
            instance.inUse = false;
            instance.lastUsed = new Date();
        }
    }

    /**
     * Invalidate a context (and its browser) and remove from pool.
     *
     * Used when we detect a hard failure (browser crash) or clear bot block (403/429),
     * so the next acquire gets a fresh context.
     */
    async invalidate(context: BrowserContext): Promise<void> {
        const instance = this.instances.find((i) => i.context === context);
        if (!instance) return;

        instance.invalidated = true;
        instance.inUse = false;

        try {
            await instance.context.close();
        } catch (error) {
            // Ignore close errors
        }

        try {
            await instance.browser.close();
        } catch (error) {
            // Ignore close errors
        }

        const index = this.instances.indexOf(instance);
        if (index > -1) {
            this.instances.splice(index, 1);
        }
    }

    async invalidateByDomainKey(domainKey: string): Promise<void> {
        const contextsToInvalidate = this.instances
            .filter((i) => !i.invalidated && this.getDomainKey(i.config) === domainKey)
            .map((i) => i.context);

        for (const ctx of contextsToInvalidate) {
            await this.invalidate(ctx);
        }
    }

    /**
     * Find an available instance with matching configuration
     * 
     * @param config - Browser scrape configuration
     * @returns Available instance or null
     */
    private findAvailableInstance(config: BrowserScrapeConfig): BrowserInstance | null {
        return this.instances.find(
            (instance) =>
                !instance.invalidated &&
                !instance.inUse &&
                instance.requestCount < this.config.maxRequestsPerBrowser &&
                this.configMatches(instance.config, config)
        ) || null;
    }

    /**
     * Find any matching instance (available or in use).
     *
     * Why: enforce "one context per domain" by waiting instead of creating
     * additional instances for the same domain key.
     */
    private findAnyMatchingInstance(config: BrowserScrapeConfig): BrowserInstance | null {
        return (
            this.instances.find(
                (instance) => !instance.invalidated && this.configMatches(instance.config, config)
            ) || null
        );
    }

    /**
     * Check if two configurations match for instance reuse
     * 
     * @param config1 - First configuration
     * @param config2 - Second configuration
     * @returns True if configurations match
     */
    private configMatches(config1: BrowserScrapeConfig, config2: BrowserScrapeConfig): boolean {
        const domain1 = this.getDomainKey(config1);
        const domain2 = this.getDomainKey(config2);
        if (domain1 !== domain2) return false;

        // Keep UA stable within a domain context; mixing UAs inside one context is inconsistent.
        if (config1.userAgent !== config2.userAgent) return false;

        // Match on proxy configuration
        const proxy1 = config1.proxy;
        const proxy2 = config2.proxy;

        if (proxy1 && proxy2) {
            return (
                proxy1.host === proxy2.host &&
                proxy1.port === proxy2.port &&
                proxy1.protocol === proxy2.protocol
            );
        }

        // Both must have no proxy to match
        return !proxy1 && !proxy2;
    }

    private getDomainKey(config: BrowserScrapeConfig): string {
        if (config.domainKey) return config.domainKey;
        try {
            return new URL(config.url).hostname;
        } catch {
            return '';
        }
    }

    private getConfigKey(config: BrowserScrapeConfig): string {
        const domain = this.getDomainKey(config);
        const ua = config.userAgent || '';
        const proxy = config.proxy
            ? `${config.proxy.protocol}://${config.proxy.host}:${config.proxy.port}`
            : 'no-proxy';
        return `${domain}|${proxy}|${ua}`;
    }

    /**
     * Create a new browser instance
     * 
     * @param config - Browser scrape configuration
     * @returns Promise resolving to new instance
     */
    private async createInstance(config: BrowserScrapeConfig): Promise<BrowserInstance> {
        // Build launch options
        const launchOptions: any = {
            headless: true,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--disable-gpu',
                '--disable-blink-features=AutomationControlled',
            ],
        };

        // Add proxy if provided
        if (config.proxy) {
            launchOptions.proxy = {
                server: `${config.proxy.protocol}://${config.proxy.host}:${config.proxy.port}`,
                username: config.proxy.username,
                password: config.proxy.password,
            };
        }

        // Launch browser
        const browser = await chromium.launch(launchOptions);

        // Create context
        const contextOptions: any = {
            userAgent: config.userAgent,
            viewport: {
                width: config.viewport.width,
                height: config.viewport.height,
            },
            deviceScaleFactor: config.viewport.deviceScaleFactor,
            isMobile: config.viewport.isMobile,
            hasTouch: config.viewport.isMobile,
        };

        const context = await browser.newContext(contextOptions);

        // Create instance
        const instance: BrowserInstance = {
            browser,
            context,
            requestCount: 0,
            lastUsed: new Date(),
            inUse: false,
            config,
            invalidated: false,
        };

        this.instances.push(instance);

        return instance;
    }

    /**
     * Wait for an available instance
     * 
     * @param config - Browser scrape configuration
     * @returns Promise resolving to available instance
     */
    private async waitForAvailableInstance(config: BrowserScrapeConfig): Promise<BrowserInstance> {
        return new Promise((resolve) => {
            const checkInterval = setInterval(() => {
                const instance = this.findAvailableInstance(config);
                if (instance) {
                    clearInterval(checkInterval);
                    resolve(instance);
                }
            }, 100);
        });
    }

    /**
     * Schedule instance restart after current request
     * 
     * @param instance - Instance to restart
     */
    private scheduleRestart(instance: BrowserInstance): void {
        // Wait for instance to be released
        const checkInterval = setInterval(async () => {
            if (instance.invalidated) {
                clearInterval(checkInterval);
                return;
            }
            if (!instance.inUse) {
                clearInterval(checkInterval);
                await this.restartInstance(instance);
            }
        }, 100);
    }

    /**
     * Restart a browser instance
     * 
     * @param instance - Instance to restart
     */
    private async restartInstance(instance: BrowserInstance): Promise<void> {
        try {
            if (instance.invalidated) return;

            // Close context and browser
            await instance.context.close();
            await instance.browser.close();

            // Remove from pool
            const index = this.instances.indexOf(instance);
            if (index > -1) {
                this.instances.splice(index, 1);
            }

            // Create new instance with same configuration
            await this.createInstance(instance.config);
        } catch (error) {
            console.error('Error restarting browser instance:', error);
        }
    }

    /**
     * Start cleanup interval to close idle browsers
     */
    private startCleanupInterval(): void {
        this.cleanupInterval = setInterval(() => {
            this.cleanupIdleInstances();
        }, 60000); // Check every minute
    }

    /**
     * Clean up idle browser instances
     */
    private async cleanupIdleInstances(): Promise<void> {
        const now = new Date();

        for (const instance of this.instances) {
            // Skip instances in use
            if (instance.inUse || instance.invalidated) {
                continue;
            }

            // Check if instance is idle
            const idleTime = now.getTime() - instance.lastUsed.getTime();
            if (idleTime > this.config.idleTimeout) {
                try {
                    await instance.context.close();
                    await instance.browser.close();

                    // Remove from pool
                    const index = this.instances.indexOf(instance);
                    if (index > -1) {
                        this.instances.splice(index, 1);
                    }
                } catch (error) {
                    console.error('Error closing idle browser instance:', error);
                }
            }
        }
    }

    /**
     * Close all browser instances and cleanup
     */
    async closeAll(): Promise<void> {
        // Stop cleanup interval
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
            this.cleanupInterval = null;
        }

        // Close all instances
        for (const instance of this.instances) {
            try {
                await instance.context.close();
                await instance.browser.close();
            } catch (error) {
                console.error('Error closing browser instance:', error);
            }
        }

        this.instances = [];
    }

    /**
     * Get pool statistics
     * 
     * @returns Pool statistics
     */
    getStats(): {
        totalInstances: number;
        inUseInstances: number;
        availableInstances: number;
        maxConcurrent: number;
    } {
        return {
            totalInstances: this.instances.length,
            inUseInstances: this.instances.filter((i) => i.inUse).length,
            availableInstances: this.instances.filter((i) => !i.inUse).length,
            maxConcurrent: this.config.maxConcurrent,
        };
    }
}
