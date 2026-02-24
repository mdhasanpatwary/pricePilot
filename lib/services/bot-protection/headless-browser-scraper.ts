/**
 * Headless Browser Scraper Implementation
 *
 * Provides JavaScript-enabled web scraping using Playwright.
 * Uses centralized BrowserPool for all browser lifecycle handling.
 */

import { BrowserContext, Page } from 'playwright';
import { Cookie } from './session-manager';
import { ProxyConfig } from './http-scraper';
import { BrowserPool } from './browser-pool';

/**
 * Configuration for a browser scrape request
 */
export interface BrowserScrapeConfig {
  /** Target URL to scrape */
  url: string;
  /** Stable domain key for context reuse */
  domainKey?: string;
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
  width: number;
  height: number;
  deviceScaleFactor: number;
  isMobile: boolean;
}

/**
 * Network request information
 */
export interface NetworkRequest {
  url: string;
  method: string;
  resourceType: string;
  status?: number;
}

/**
 * Response from a browser scrape request
 */
export interface BrowserScrapeResponse {
  statusCode: number;
  headers: Record<string, string>;
  body: string;
  finalUrl: string;
  redirectUrl?: string;
  responseTime: number;
  screenshot?: Buffer;
  consoleLogs: string[];
  networkRequests: NetworkRequest[];
  contextCreated?: boolean;
}

export class HeadlessBrowserScraper {
  private readonly browserPool: BrowserPool;

  constructor(_usePool: boolean = true) {
    this.browserPool = BrowserPool.getInstance();
  }

  async scrape(config: BrowserScrapeConfig): Promise<BrowserScrapeResponse> {
    const startTime = Date.now();
    const consoleLogs: string[] = [];
    const networkRequests: NetworkRequest[] = [];

    let page: Page | null = null;
    let context: BrowserContext | null = null;
    let statusCodeForInvalidation: number | null = null;
    let contextCreated: boolean | undefined;

    try {
      context = await this.browserPool.acquire(config);
      contextCreated = (context as any).__pp_contextCreatedForRequest === true;

      page = await context.newPage();

      await page.setViewportSize({
        width: config.viewport.width,
        height: config.viewport.height,
      });

      await page.setExtraHTTPHeaders(config.headers);

      if (config.cookies.length > 0) {
        const playwrightCookies = this.convertCookies(config.cookies, config.url);
        await context.addCookies(playwrightCookies);
      }

      page.on('console', (msg) => {
        consoleLogs.push(`[${msg.type()}] ${msg.text()}`);
      });

      page.on('request', (request) => {
        networkRequests.push({
          url: request.url(),
          method: request.method(),
          resourceType: request.resourceType(),
        });
      });

      page.on('response', (response) => {
        const request = networkRequests.find((r) => r.url === response.url());
        if (request) {
          request.status = response.status();
        }
      });

      await page.waitForTimeout(this.randomJitterMs(50, 180));

      const response = await page.goto(config.url, {
        timeout: config.timeout,
        waitUntil: 'domcontentloaded',
      });

      if (!response) {
        throw new Error('Failed to load page');
      }

      statusCodeForInvalidation = response.status();

      if (config.waitForSelector) {
        await page.waitForSelector(config.waitForSelector, {
          timeout: config.timeout,
        });
      }

      if (config.waitForTimeout) {
        await page.waitForTimeout(config.waitForTimeout);
      }

      if (config.executeScript) {
        await page.evaluate(config.executeScript);
      }

      const body = await page.content();
      const finalUrl = page.url();
      const redirectUrl = finalUrl !== config.url ? finalUrl : undefined;

      const headers: Record<string, string> = {};
      const responseHeaders = response.headers();
      for (const [key, value] of Object.entries(responseHeaders)) {
        headers[key] = value;
      }

      let screenshot: Buffer | undefined;
      if (process.env.SCRAPING_ENABLE_SCREENSHOTS !== 'false') {
        screenshot = await page.screenshot({
          type: 'png',
          fullPage: false,
        });
      }

      const responseTime = Date.now() - startTime;
      await page.close();

      if (statusCodeForInvalidation === 403 || statusCodeForInvalidation === 429) {
        await this.browserPool.invalidate(context);
      } else {
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
        contextCreated,
      };
    } catch (error) {
      if (page) {
        try {
          await page.close();
        } catch {
          // Ignore close errors
        }
      }

      if (context) {
        const msg = error instanceof Error ? error.message : String(error);
        const lower = (msg || '').toLowerCase();
        const looksLikeCrash =
          lower.includes('target closed') ||
          lower.includes('browser has disconnected') ||
          lower.includes('has been closed') ||
          lower.includes('crashed');

        try {
          if (looksLikeCrash) {
            await this.browserPool.invalidate(context);
          } else {
            await this.browserPool.release(context);
          }
        } catch {
          // Ignore pool errors
        }
      }

      if (error instanceof Error && error.message.includes('Timeout')) {
        throw new Error(`Browser request timeout after ${config.timeout}ms`);
      }

      throw error;
    }
  }

  async captureScreenshot(url: string): Promise<Buffer> {
    const config: BrowserScrapeConfig = {
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

    let context: BrowserContext | null = null;
    let page: Page | null = null;

    try {
      context = await this.browserPool.acquire(config);
      page = await context.newPage();

      await page.goto(url, {
        timeout: 30000,
        waitUntil: 'domcontentloaded',
      });

      let screenshot: Buffer;
      if (process.env.SCRAPING_ENABLE_SCREENSHOTS !== 'false') {
        screenshot = await page.screenshot({
          type: 'png',
          fullPage: true,
        });
      } else {
        screenshot = Buffer.from([]);
      }

      await page.close();
      await this.browserPool.release(context);
      return screenshot;
    } catch (error) {
      if (page) {
        try {
          await page.close();
        } catch {
          // Ignore close errors
        }
      }

      if (context) {
        try {
          await this.browserPool.invalidate(context);
        } catch {
          // Ignore pool errors
        }
      }

      throw error;
    }
  }

  private convertCookies(cookies: Cookie[], url: string): any[] {
    const urlObj = new URL(url);
    const domain = urlObj.hostname;
    const toPlaywrightExpires = (value: unknown): number => {
      if (value === null || value === undefined) return -1;

      if (value instanceof Date) {
        const ts = value.getTime();
        return Number.isFinite(ts) ? Math.floor(ts / 1000) : -1;
      }

      if (typeof value === 'number') {
        if (!Number.isFinite(value) || value <= 0) return -1;
        // Support both milliseconds and seconds inputs.
        const ms = value > 1e12 ? value : value * 1000;
        return Math.floor(ms / 1000);
      }

      if (typeof value === 'string') {
        const parsed = new Date(value).getTime();
        return Number.isFinite(parsed) ? Math.floor(parsed / 1000) : -1;
      }

      return -1;
    };

    return cookies.map((cookie) => ({
      name: cookie.name,
      value: cookie.value,
      domain: cookie.domain || domain,
      path: cookie.path || '/',
      expires: toPlaywrightExpires(cookie.expires),
      httpOnly: cookie.httpOnly,
      secure: cookie.secure,
      sameSite: cookie.sameSite || 'Lax',
    }));
  }

  async close(): Promise<void> {
    await this.browserPool.closeAll();
  }

  getPoolStats(): {
    totalInstances: number;
    inUseInstances: number;
    availableInstances: number;
    maxConcurrent: number;
  } {
    return this.browserPool.getStats();
  }

  async invalidateDomainContext(domainKey: string): Promise<void> {
    await this.browserPool.invalidateByDomainKey(domainKey);
  }

  async warmupSession(config: BrowserScrapeConfig, warmupUrl: string): Promise<void> {
    let page: Page | null = null;
    let context: BrowserContext | null = null;

    try {
      context = await this.browserPool.acquire({
        ...config,
        url: warmupUrl,
      });
      page = await context.newPage();
      await page.setExtraHTTPHeaders(config.headers);
      await page.waitForTimeout(this.randomJitterMs(100, 260));
      await page.goto(warmupUrl, {
        timeout: Math.min(config.timeout, 15000),
        waitUntil: 'domcontentloaded',
      });
      await page.waitForTimeout(this.randomJitterMs(120, 320));
    } catch {
      // Warmup is best-effort; main scrape flow must continue.
    } finally {
      if (page) {
        try {
          await page.close();
        } catch {
          // Ignore close errors
        }
      }
      if (context) {
        try {
          await this.browserPool.release(context);
        } catch {
          // Ignore pool release errors
        }
      }
    }
  }

  private randomJitterMs(minMs: number, maxMs: number): number {
    return Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
  }
}
