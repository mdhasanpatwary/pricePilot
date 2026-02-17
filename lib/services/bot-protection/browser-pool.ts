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

        // If no available instance and pool not full, create new one
        if (!instance && this.instances.length < this.config.maxConcurrent) {
            instance = await this.createInstance(config);
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
     * Find an available instance with matching configuration
     * 
     * @param config - Browser scrape configuration
     * @returns Available instance or null
     */
    private findAvailableInstance(config: BrowserScrapeConfig): BrowserInstance | null {
        return this.instances.find(
            (instance) =>
                !instance.inUse &&
                instance.requestCount < this.config.maxRequestsPerBrowser &&
                this.configMatches(instance.config, config)
        ) || null;
    }

    /**
     * Check if two configurations match for instance reuse
     * 
     * @param config1 - First configuration
     * @param config2 - Second configuration
     * @returns True if configurations match
     */
    private configMatches(config1: BrowserScrapeConfig, config2: BrowserScrapeConfig): boolean {
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
            if (instance.inUse) {
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
