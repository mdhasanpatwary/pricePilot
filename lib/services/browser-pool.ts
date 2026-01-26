import { chromium as playwrightChromium, Browser, BrowserContext } from "playwright";
import { chromium } from "playwright-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import { logger } from "../logger";

interface PooledContext {
  context: BrowserContext;
  inUse: boolean;
  createdAt: Date;
  lastUsedAt: Date;
}

const USER_AGENTS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:122.0) Gecko/20100101 Firefox/122.0",
];

const VIEWPORTS = [
  { width: 1920, height: 1080 },
  { width: 1440, height: 900 },
  { width: 1366, height: 768 },
  { width: 1536, height: 864 },
];

const TIMEZONES = [
  'America/New_York',
  'America/Chicago',
  'America/Los_Angeles',
  'Europe/London',
  'Europe/Paris',
  'Asia/Tokyo',
  'Asia/Shanghai',
  'Australia/Sydney',
];

const LOCALES = [
  'en-US',
  'en-GB',
  'en-CA',
  'en-AU',
  'fr-FR',
  'de-DE',
  'es-ES',
  'ja-JP',
];

interface StealthOptions {
  canvas?: boolean;
  webgl?: boolean;
  audio?: boolean;
  fonts?: boolean;
  webrtc?: boolean;
  timezone?: boolean;
  locale?: boolean;
  battery?: boolean;
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

    try {
      // Try to use playwright-extra with stealth plugin
      chromium.use(StealthPlugin());

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
          "--disable-infobars",
          "--window-position=0,0",
          "--disable-extensions",
        ],
      });

      logger.info(`[BrowserPool] Initialized with playwright-extra stealth (max ${maxContexts} contexts)`);
    } catch (error) {
      // Fallback to basic stealth if playwright-extra fails
      logger.warn("[BrowserPool] Failed to initialize with playwright-extra, falling back to basic stealth", { error });

      this.browser = await playwrightChromium.launch({
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
          "--disable-infobars",
          "--window-position=0,0",
          "--disable-extensions",
        ],
      });

      logger.info(`[BrowserPool] Initialized with basic stealth (max ${maxContexts} contexts)`);
    }

    // Start cleanup interval
    this.startCleanup();
  }

  /**
   * Acquire a browser context from the pool
   */
  async acquireContext(
    userAgent?: string,
    proxy?: { server: string },
    stealthOptions?: StealthOptions,
  ): Promise<BrowserContext> {
    if (!this.browser) {
      await this.init();
    }

    // Try to find an available context with matching config
    const contextKey = this.getContextKey(userAgent, proxy);
    const pooled = this.contexts.get(contextKey);

    if (pooled && !pooled.inUse) {
      // Check if context is still valid before reusing
      try {
        // Try to get pages to verify context is still open
        const pages = pooled.context.pages();
        // Also verify the browser is still connected
        if (pages && this.browser && this.browser.isConnected()) {
          pooled.inUse = true;
          pooled.lastUsedAt = new Date();
          logger.info(`[BrowserPool] Reusing context: ${contextKey}`);
          return pooled.context;
        } else {
          // Context or browser is not valid
          logger.warn(`[BrowserPool] Context ${contextKey} is invalid (browser disconnected or no pages), removing from pool`);
          this.contexts.delete(contextKey);
        }
      } catch (error) {
        // Context is closed, remove it from pool
        logger.warn(`[BrowserPool] Context ${contextKey} was closed, removing from pool`);
        this.contexts.delete(contextKey);
      }
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
        return this.waitForAvailableContext(userAgent, proxy, stealthOptions);
      }
    }

    // Default stealth options - all enabled by default
    const stealth: StealthOptions = {
      canvas: true,
      webgl: true,
      audio: true,
      fonts: true,
      webrtc: true,
      timezone: true,
      locale: true,
      battery: true,
      ...stealthOptions,
    };

    // Randomize Fingerprints
    const selectedUA = userAgent || USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
    const viewport = VIEWPORTS[Math.floor(Math.random() * VIEWPORTS.length)];
    const deviceScaleFactor = Math.random() > 0.5 ? 2 : 1;
    const isWin = selectedUA.includes("Windows");
    const platform = isWin ? "Win32" : (selectedUA.includes("Mac") ? "MacIntel" : "Linux x86_64");

    // Randomize timezone and locale if enabled
    const timezone = stealth.timezone ? TIMEZONES[Math.floor(Math.random() * TIMEZONES.length)] : 'Asia/Dhaka';
    const locale = stealth.locale ? LOCALES[Math.floor(Math.random() * LOCALES.length)] : 'en-US';

    // Create new context with realistic fingerprints
    const context = await this.browser!.newContext({
      userAgent: selectedUA,
      proxy,
      viewport,
      deviceScaleFactor,
      hasTouch: false,
      locale,
      timezoneId: timezone,
      extraHTTPHeaders: {
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
        'Accept-Language': `${locale},${locale.split('-')[0]};q=0.9`,
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache',
        'Sec-Ch-Ua': isWin ? '"Not A(Brand";v="99", "Google Chrome";v="121", "Chromium";v="121"' : '"Not A(Brand";v="99", "Chromium";v="121"',
        'Sec-Ch-Ua-Mobile': '?0',
        'Sec-Ch-Ua-Platform': isWin ? '"Windows"' : (platform.includes("Mac") ? '"macOS"' : '"Linux"'),
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Sec-Fetch-User': '?1',
        'Upgrade-Insecure-Requests': '1',
      }
    });

    // Advanced Stealth Init Scripts
    await context.addInitScript(({ plat, stealthOpts }: { plat: string, stealthOpts: StealthOptions }) => {
      // 1. Mask Webdriver
      Object.defineProperty(navigator, 'webdriver', { get: () => undefined });

      // 2. Mask Platform
      Object.defineProperty(navigator, 'platform', { get: () => plat });

      // 3. Mask Plugins
      Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });

      // 4. Canvas fingerprinting protection
      if (stealthOpts.canvas) {
        const originalToDataURL = HTMLCanvasElement.prototype.toDataURL;
        // const originalToBlob = HTMLCanvasElement.prototype.toBlob; // Reserved for future use
        const originalGetImageData = CanvasRenderingContext2D.prototype.getImageData;

        // Add noise to canvas data
        const addNoise = (data: Uint8ClampedArray) => {
          const noise = Math.random() * 0.1;
          for (let i = 0; i < data.length; i += 4) {
            data[i] = Math.min(255, data[i] + Math.floor(noise * 10));
            data[i + 1] = Math.min(255, data[i + 1] + Math.floor(noise * 10));
            data[i + 2] = Math.min(255, data[i + 2] + Math.floor(noise * 10));
          }
        };

        HTMLCanvasElement.prototype.toDataURL = function (...args: any[]) {
          const context = this.getContext('2d');
          if (context) {
            const imageData = context.getImageData(0, 0, this.width, this.height);
            addNoise(imageData.data);
            context.putImageData(imageData, 0, 0);
          }
          return originalToDataURL.apply(this, args as [type?: string, quality?: number]);
        };

        CanvasRenderingContext2D.prototype.getImageData = function (...args: any[]) {
          const imageData = originalGetImageData.apply(this, args as [sx: number, sy: number, sw: number, sh: number, settings?: ImageDataSettings]);
          addNoise(imageData.data);
          return imageData;
        };
      }

      // 5. WebGL Vendor/Renderer masking
      if (stealthOpts.webgl) {
        const getParameter = HTMLCanvasElement.prototype.getContext;
        (HTMLCanvasElement.prototype as any).getContext = function (type: any, attributes: any) {
          const context = getParameter.apply(this, [type, attributes]);
          if (type === 'webgl' || type === 'experimental-webgl' || type === 'webgl2') {
            const originalGetParameter = (context as any).getParameter;
            (context as any).getParameter = function (parameter: any) {
              // UNMASKED_VENDOR_WEBGL
              if (parameter === 37445) return 'Google Inc. (Intel)';
              // UNMASKED_RENDERER_WEBGL
              if (parameter === 37446) return 'ANGLE (Intel, Intel(R) UHD Graphics (0x00009BC4) Direct3D11 vs_5_0 ps_5_0, D3D11)';
              return originalGetParameter.apply(this, [parameter]);
            };
          }
          return context;
        };
      }

      // 6. Audio context fingerprinting protection
      if (stealthOpts.audio) {
        const AudioContext = (window as any).AudioContext || (window as any).webkitAudioContext;
        if (AudioContext) {
          const originalCreateOscillator = AudioContext.prototype.createOscillator;
          AudioContext.prototype.createOscillator = function () {
            const oscillator = originalCreateOscillator.apply(this, arguments);
            const originalStart = oscillator.start;
            oscillator.start = function (...args: any[]) {
              // Add slight randomization to audio timing
              const noise = Math.random() * 0.0001;
              if (args[0] !== undefined) {
                args[0] = args[0] + noise;
              }
              return originalStart.apply(this, args);
            };
            return oscillator;
          };
        }
      }

      // 7. Font fingerprinting protection
      if (stealthOpts.fonts) {
        // Mask font enumeration by returning consistent font list
        const originalOffsetWidth = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetWidth');
        const originalOffsetHeight = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetHeight');

        if (originalOffsetWidth && originalOffsetHeight) {
          Object.defineProperty(HTMLElement.prototype, 'offsetWidth', {
            get: function () {
              const width = originalOffsetWidth.get?.call(this);
              // Add small random variation to prevent font-based fingerprinting
              return width ? width + (Math.random() - 0.5) * 0.01 : width;
            }
          });

          Object.defineProperty(HTMLElement.prototype, 'offsetHeight', {
            get: function () {
              const height = originalOffsetHeight.get?.call(this);
              return height ? height + (Math.random() - 0.5) * 0.01 : height;
            }
          });
        }
      }

      // 8. WebRTC leak prevention
      if (stealthOpts.webrtc) {
        if (navigator.mediaDevices) {
          (navigator.mediaDevices as any).getUserMedia = function () {
            return Promise.reject(new Error('Permission denied'));
          };
        }

        // Block RTCPeerConnection
        (window as any).RTCPeerConnection = undefined;
        (window as any).webkitRTCPeerConnection = undefined;
        (window as any).mozRTCPeerConnection = undefined;
      }

      // 9. Battery API masking
      if (stealthOpts.battery) {
        if ('getBattery' in navigator) {
          (navigator as any).getBattery = () => Promise.resolve({
            charging: true,
            chargingTime: 0,
            dischargingTime: Infinity,
            level: 1,
            addEventListener: () => { },
            removeEventListener: () => { },
            dispatchEvent: () => true,
          });
        }
      }

      // 10. Chrome runtime masking
      (window as any).chrome = {
        runtime: {},
        loadTimes: function () { },
        csi: function () { },
        app: {}
      };

      // 11. Permissions masking
      const originalQuery = window.navigator.permissions.query;
      (window.navigator.permissions as any).query = (parameters: any) => (
        parameters.name === 'notifications' ?
          Promise.resolve({ state: Notification.permission }) :
          originalQuery(parameters)
      );

    }, { plat: platform, stealthOpts: stealth });

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
    _stealthOptions?: StealthOptions,
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
