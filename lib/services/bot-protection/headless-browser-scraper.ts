/**
 * Headless Browser Scraper Implementation
 *
 * Provides JavaScript-enabled web scraping using Playwright with stealth plugins.
 * Supports browser automation, screenshot capture, and advanced bot protection evasion.
 */

import { chromium, Browser, BrowserContext, Page } from 'playwright';
import { Cookie } from './session-manager';
import { ProxyConfig } from './http-scraper';
import { BrowserPool } from './browser-pool';

/**
 * Configuration for a browser scrape request
 */
export interface BrowserScrapeConfig {
    /** Target URL to scrape */
    url: string;
    /** Optional proxy configuration */
    proxy?: ProxyConfig;
    /** User-Agent header value */
    userAgent: string;
    /** Additional HTTP headers */
    headers: Record<string, string>;
    /** Cookies to include in the request */
    cookies: Cookie[];
    /** Request timeout in milliseconds */
    timeout: number;
    /** Whether to follow redirects */
    followRedirects: boolean;
    /** CSS selector to wait for before extracting content */
    waitForSelector?: string;
    /** Time to wait in milliseconds before extracting content */
    waitForTimeout?: number;
    /** Custom JavaScript to execute on the page */
    executeScript?: string;
    /** Enable stealth mode to avoid detection */
    stealthMode: boolean;
    /** Viewport configuration */
    viewport: Viewport;
}

/**
 * Viewport configuration for browser
 */
export interface Viewport {
    /** Viewport width in pixels */
    width: number;
    /** Viewport height in pixels */
    height: number;
    /** Device scale factor (pixel ratio) */
    deviceScaleFactor: number;
    /** Whether to emulate mobile device */
    isMobile: boolean;
}

/**
 * Network request information
 */
export interface NetworkRequest {
    /** Request URL */
    url: string;
    /** HTTP method */
    method: string;
    /** Resource type (document, script, image, etc.) */
    resourceType: string;
    /** Response status code */
    status?: number;
}

/**
 * Response from a browser scrape request
 */
export interface BrowserScrapeResponse {
    /** HTTP status code */
    statusCode: number;
    /** Response headers */
    headers: Record<string, string>;
    /** Response body (HTML content) */
    body: string;
    /** Final URL after redirects (if any) */
    finalUrl: string;
    /** Redirect URL if redirected */
    redirectUrl?: string;
    /** Response time in milliseconds */
    responseTime: number;
    /** Screenshot buffer (if captured) */
    screenshot?: Buffer;
    /** Console logs from the page */
    consoleLogs: string[];
    /** Network requests made during page load */
    networkRequests: NetworkRequest[];
}

/**
 * Headless Browser Scraper class
 *
 * Executes JavaScript-enabled scraping using Playwright with stealth configuration
 * to avoid bot detection. Supports screenshot capture and network monitoring.
 * Uses browser pool for efficient resource management.
 */
export class HeadlessBrowserScraper {
    private browser: Browser | null = null;
    private context: BrowserContext | null = null;
    private browserPool: BrowserPool;
    private usePool: boolean;

    /**
     * Create a new HeadlessBrowserScraper
     *
     * @param usePool - Whether to use browser pool (default: true)
     */
    constructor(usePool: boolean = true) {
        this.usePool = usePool;
        // Use default configuration which reads from environment variables
        this.browserPool = new BrowserPool();
    }

    /**
     * Execute a browser scrape request
     *
     * @param config - Browser scrape configuration
     * @returns Promise resolving to browser scrape response
     * @throws Error if request fails
     */
    async scrape(config: BrowserScrapeConfig): Promise<BrowserScrapeResponse> {
        const startTime = Date.now();
        const consoleLogs: string[] = [];
        const networkRequests: NetworkRequest[] = [];

        let page: Page | null = null;
        let context: BrowserContext | null = null;
        let usingPool = false;

        try {
            // Get browser context from pool or create new one
            if (this.usePool) {
                context = await this.browserPool.acquire(config);
                usingPool = true;
            } else {
                // Launch browser if not already running
                if (!this.browser) {
                    await this.launchBrowser(config);
                }
                context = this.context!;
            }

            // Create new page
            page = await context.newPage();

            // Set viewport
            await page.setViewportSize({
                width: config.viewport.width,
                height: config.viewport.height,
            });

            // Set extra HTTP headers
            await page.setExtraHTTPHeaders(config.headers);

            // Add cookies
            if (config.cookies.length > 0) {
                const playwrightCookies = this.convertCookies(config.cookies, config.url);
                await context.addCookies(playwrightCookies);
            }

            // Listen to console messages
            page.on('console', (msg) => {
                consoleLogs.push(`[${msg.type()}] ${msg.text()}`);
            });

            // Monitor network requests
            page.on('request', (request) => {
                networkRequests.push({
                    url: request.url(),
                    method: request.method(),
                    resourceType: request.resourceType(),
                });
            });

            page.on('response', (response) => {
                const request = networkRequests.find(r => r.url === response.url());
                if (request) {
                    request.status = response.status();
                }
            });

            // Navigate to URL
            const response = await page.goto(config.url, {
                timeout: config.timeout,
                waitUntil: 'domcontentloaded',
            });

            if (!response) {
                throw new Error('Failed to load page');
            }

            // Wait for selector if specified
            if (config.waitForSelector) {
                await page.waitForSelector(config.waitForSelector, {
                    timeout: config.timeout,
                });
            }

            // Wait for timeout if specified
            if (config.waitForTimeout) {
                await page.waitForTimeout(config.waitForTimeout);
            }

            // Execute custom JavaScript if provided
            if (config.executeScript) {
                await page.evaluate(config.executeScript);
            }

            // Get page content
            const body = await page.content();
            const finalUrl = page.url();
            const redirectUrl = finalUrl !== config.url ? finalUrl : undefined;

            // Get response headers
            const headers: Record<string, string> = {};
            const responseHeaders = response.headers();
            for (const [key, value] of Object.entries(responseHeaders)) {
                headers[key] = value;
            }

            // Capture screenshot (conditional based on environment)
            let screenshot: Buffer | undefined;
            if (process.env.SCRAPING_ENABLE_SCREENSHOTS !== 'false') {
                screenshot = await page.screenshot({
                    type: 'png',
                    fullPage: false,
                });
            }

            const responseTime = Date.now() - startTime;

            // Close page
            await page.close();

            // Release context back to pool if using pool
            if (usingPool && context) {
                await this.browserPool.release(context);
            }

            return {
                statusCode: response.status(),
                headers,
                body,
                finalUrl,
                redirectUrl,
                responseTime,
                screenshot,
                consoleLogs,
                networkRequests,
            };
        } catch (error) {
            // Close page if it was created
            if (page) {
                try {
                    await page.close();
                } catch (closeError) {
                    // Ignore close errors
                }
            }

            // Release context back to pool if using pool
            if (usingPool && context) {
                try {
                    await this.browserPool.release(context);
                } catch (releaseError) {
                    // Ignore release errors
                }
            }

            // Handle timeout errors
            if (error instanceof Error && error.message.includes('Timeout')) {
                throw new Error(`Browser request timeout after ${config.timeout}ms`);
            }

            // Re-throw other errors
            throw error;
        }
    }

    /**
     * Capture screenshot of a URL
     *
     * @param url - URL to capture
     * @returns Promise resolving to screenshot buffer
     * @throws Error if capture fails
     */
    async captureScreenshot(url: string): Promise<Buffer> {
        let page: Page | null = null;

        try {
            // Launch browser if not already running
            if (!this.browser) {
                const defaultConfig: BrowserScrapeConfig = {
                    url,
                    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                    headers: {},
                    cookies: [],
                    timeout: 30000,
                    followRedirects: true,
                    stealthMode: true,
                    viewport: {
                        width: 1920,
                        height: 1080,
                        deviceScaleFactor: 1,
                        isMobile: false,
                    },
                };
                await this.launchBrowser(defaultConfig);
            }

            // Create new page
            page = await this.context!.newPage();

            // Navigate to URL
            await page.goto(url, {
                timeout: 30000,
                waitUntil: 'domcontentloaded',
            });

            // Capture screenshot (conditional based on environment)
            let screenshot: Buffer;
            if (process.env.SCRAPING_ENABLE_SCREENSHOTS !== 'false') {
                screenshot = await page.screenshot({
                    type: 'png',
                    fullPage: true,
                });
            } else {
                // Return empty buffer if screenshots disabled
                screenshot = Buffer.from([]);
            }

            // Close page
            await page.close();

            return screenshot;
        } catch (error) {
            // Close page if it was created
            if (page) {
                try {
                    await page.close();
                } catch (closeError) {
                    // Ignore close errors
                }
            }

            throw error;
        }
    }

    /**
     * Launch browser with configuration
     *
     * @param config - Browser scrape configuration
     */
    private async launchBrowser(config: BrowserScrapeConfig): Promise<void> {
        // Build launch options with CPU/Memory optimizations
        const launchOptions: any = {
            headless: true,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--disable-gpu',
                '--disable-blink-features=AutomationControlled',

                // CPU and Memory optimizations
                '--disable-background-networking',
                '--disable-background-timer-throttling',
                '--disable-backgrounding-occluded-windows',
                '--disable-breakpad',
                '--disable-component-extensions-with-background-pages',
                '--disable-extensions',
                '--disable-features=TranslateUI,BlinkGenPropertyTrees',
                '--disable-ipc-flooding-protection',
                '--disable-renderer-backgrounding',
                '--disable-sync',
                '--metrics-recording-only',
                '--mute-audio',
                '--no-first-run',
                '--no-default-browser-check',
                '--disable-default-apps',
                '--disable-hang-monitor',
                '--disable-prompt-on-repost',
                '--disable-domain-reliability',
                '--disable-features=AudioServiceOutOfProcess',
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
        this.browser = await chromium.launch(launchOptions);

        // Randomize viewport dimensions if stealth mode enabled
        const viewport = config.stealthMode
            ? this.randomizeViewport(config.viewport)
            : config.viewport;

        // Create context with stealth configuration
        const contextOptions: any = {
            userAgent: config.userAgent,
            viewport: {
                width: viewport.width,
                height: viewport.height,
            },
            deviceScaleFactor: viewport.deviceScaleFactor,
            isMobile: viewport.isMobile,
            hasTouch: viewport.isMobile,
            // Randomize locale and timezone for stealth
            locale: config.stealthMode ? this.getRandomLocale() : 'en-US',
            timezoneId: config.stealthMode ? this.getRandomTimezone() : 'America/New_York',
        };

        this.context = await this.browser.newContext(contextOptions);

        // Apply stealth configuration to context
        if (config.stealthMode) {
            await this.applyStealthConfiguration(this.context);
        }
    }

    /**
     * Apply stealth configuration to browser context
     *
     * @param context - Browser context
     */
    private async applyStealthConfiguration(context: BrowserContext): Promise<void> {
        // Override navigator properties to hide automation
        await context.addInitScript(() => {
            // Override webdriver property
            Object.defineProperty(navigator, 'webdriver', {
                get: () => false,
            });

            // Override plugins to appear as real browser
            Object.defineProperty(navigator, 'plugins', {
                get: () => [
                    {
                        0: { type: 'application/x-google-chrome-pdf', suffixes: 'pdf', description: 'Portable Document Format' },
                        description: 'Portable Document Format',
                        filename: 'internal-pdf-viewer',
                        length: 1,
                        name: 'Chrome PDF Plugin',
                    },
                    {
                        0: { type: 'application/pdf', suffixes: 'pdf', description: 'Portable Document Format' },
                        description: 'Portable Document Format',
                        filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai',
                        length: 1,
                        name: 'Chrome PDF Viewer',
                    },
                ],
            });

            // Override languages
            Object.defineProperty(navigator, 'languages', {
                get: () => ['en-US', 'en'],
            });

            // Override permissions
            const originalQuery = window.navigator.permissions.query;
            window.navigator.permissions.query = (parameters: any) => (
                parameters.name === 'notifications'
                    ? Promise.resolve({ state: 'denied' } as PermissionStatus)
                    : originalQuery(parameters)
            );

            // Override chrome property
            (window as any).chrome = {
                runtime: {},
            };

            // Randomize canvas fingerprint
            const originalToDataURL = HTMLCanvasElement.prototype.toDataURL;
            HTMLCanvasElement.prototype.toDataURL = function (type?: string) {
                const context = this.getContext('2d');
                if (context) {
                    // Add slight noise to canvas
                    const imageData = context.getImageData(0, 0, this.width, this.height);
                    for (let i = 0; i < imageData.data.length; i += 4) {
                        imageData.data[i] += Math.floor(Math.random() * 3) - 1;
                    }
                    context.putImageData(imageData, 0, 0);
                }
                return originalToDataURL.call(this, type);
            };
        });
    }

    /**
     * Randomize viewport dimensions for stealth
     *
     * @param viewport - Original viewport configuration
     * @returns Randomized viewport
     */
    private randomizeViewport(viewport: Viewport): Viewport {
        // Add random variation to dimensions (±50 pixels)
        const widthVariation = Math.floor(Math.random() * 100) - 50;
        const heightVariation = Math.floor(Math.random() * 100) - 50;

        return {
            width: Math.max(800, viewport.width + widthVariation),
            height: Math.max(600, viewport.height + heightVariation),
            deviceScaleFactor: viewport.deviceScaleFactor,
            isMobile: viewport.isMobile,
        };
    }

    /**
     * Get random locale for stealth
     *
     * @returns Random locale string
     */
    private getRandomLocale(): string {
        const locales = [
            'en-US',
            'en-GB',
            'en-CA',
            'en-AU',
            'de-DE',
            'fr-FR',
            'es-ES',
            'it-IT',
        ];
        return locales[Math.floor(Math.random() * locales.length)];
    }

    /**
     * Get random timezone for stealth
     *
     * @returns Random timezone string
     */
    private getRandomTimezone(): string {
        const timezones = [
            'America/New_York',
            'America/Chicago',
            'America/Denver',
            'America/Los_Angeles',
            'Europe/London',
            'Europe/Paris',
            'Europe/Berlin',
            'Asia/Tokyo',
        ];
        return timezones[Math.floor(Math.random() * timezones.length)];
    }

    /**
     * Convert cookies to Playwright format
     *
     * @param cookies - Array of cookies
     * @param url - URL for cookie domain extraction
     * @returns Playwright cookies
     */
    private convertCookies(cookies: Cookie[], url: string): any[] {
        const urlObj = new URL(url);
        const domain = urlObj.hostname;

        return cookies.map((cookie) => ({
            name: cookie.name,
            value: cookie.value,
            domain: cookie.domain || domain,
            path: cookie.path || '/',
            expires: cookie.expires ? Math.floor(cookie.expires.getTime() / 1000) : -1,
            httpOnly: cookie.httpOnly,
            secure: cookie.secure,
            sameSite: cookie.sameSite || 'Lax',
        }));
    }

    /**
     * Close browser and cleanup resources
     */
    async close(): Promise<void> {
        // Close browser pool
        if (this.usePool) {
            await this.browserPool.closeAll();
        }

        // Close standalone browser if used
        if (this.context) {
            await this.context.close();
            this.context = null;
        }

        if (this.browser) {
            await this.browser.close();
            this.browser = null;
        }
    }

    /**
     * Get browser pool statistics
     *
     * @returns Pool statistics or null if not using pool
     */
    getPoolStats(): {
        totalInstances: number;
        inUseInstances: number;
        availableInstances: number;
        maxConcurrent: number;
    } | null {
        if (this.usePool) {
            return this.browserPool.getStats();
        }
        return null;
    }
}
