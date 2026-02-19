import { chromium as playwrightChromium, Browser, BrowserContext, Page } from "playwright";
import { chromium } from "playwright-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import { logger } from "../logger";
import { getAllUserAgents } from "../config/user-agents";

interface PooledContext {
  context: BrowserContext;
  inUse: boolean;
  createdAt: Date;
  lastUsedAt: Date;
  key: string;
}

interface DomainSession {
  domain: string;
  browser: Browser | null;
  contexts: Map<string, PooledContext>;
  createdAt: Date;
  lastUsedAt: Date;
  initPromise: Promise<void> | null;
}

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

interface ContextOptions {
  userAgent?: string;
  proxy?: { server: string };
  stealthOptions?: StealthOptions;
}

// Get user agents from centralized configuration
const USER_AGENTS = getAllUserAgents();

const VIEWPORTS = [
  { width: 1920, height: 1080 },
  { width: 1440, height: 900 },
  { width: 1366, height: 768 },
  { width: 1536, height: 864 },
];

const TIMEZONES = [
  "America/New_York",
  "America/Chicago",
  "America/Los_Angeles",
  "Europe/London",
  "Europe/Paris",
  "Asia/Tokyo",
  "Asia/Shanghai",
  "Australia/Sydney",
];

const LOCALES = [
  "en-US",
  "en-GB",
  "en-CA",
  "en-AU",
  "fr-FR",
  "de-DE",
  "es-ES",
  "ja-JP",
];

const globalForBrowserPool = globalThis as typeof globalThis & {
  __pricepilotBrowserPool?: BrowserPool;
};

/**
 * Browser Pool Manager
 * Domain-scoped lifecycle:
 * - one Browser per domain
 * - reusable Context pool per domain
 * - bounded context limits + cleanup
 */
export class BrowserPool {
  private static instance: BrowserPool | null = null;

  private domainSessions: Map<string, DomainSession> = new Map();
  private contextIndex: Map<BrowserContext, { domain: string; key: string }> = new Map();

  private maxContexts: number = 10;
  private maxContextsPerDomain: number = 4;
  private contextTimeout: number = 5 * 60 * 1000; // 5 minutes
  private browserIdleTimeout: number = 15 * 60 * 1000; // 15 minutes
  private cleanupInterval: NodeJS.Timeout | null = null;
  private stealthConfigured = false;
  private initialized = false;
  private domainLocks: Map<string, Promise<void>> = new Map();

  private constructor() {
    // Private constructor for singleton
  }

  /**
   * Get singleton instance
   */
  static getInstance(): BrowserPool {
    if (!BrowserPool.instance) {
      BrowserPool.instance = globalForBrowserPool.__pricepilotBrowserPool ?? new BrowserPool();
      globalForBrowserPool.__pricepilotBrowserPool = BrowserPool.instance;
    }
    return BrowserPool.instance;
  }

  /**
   * Shutdown the singleton pool (best-effort).
   */
  static async shutdown(): Promise<void> {
    if (!BrowserPool.instance && !globalForBrowserPool.__pricepilotBrowserPool) return;
    const instance = BrowserPool.instance ?? globalForBrowserPool.__pricepilotBrowserPool;
    if (!instance) return;
    await instance.close();
  }

  /**
   * Initialize the browser pool
   */
  async init(maxContexts: number = 10) {
    const nextMaxContexts = Math.max(1, maxContexts);
    const nextMaxPerDomain = Math.max(1, Math.min(5, Math.floor(nextMaxContexts / 2) || 1));
    const configChanged =
      this.maxContexts !== nextMaxContexts || this.maxContextsPerDomain !== nextMaxPerDomain;

    this.maxContexts = nextMaxContexts;
    this.maxContextsPerDomain = nextMaxPerDomain;

    this.startCleanup();
    if (!this.initialized || configChanged) {
      logger.info("[BrowserPool] Initialized domain-aware pool", {
        maxContexts: this.maxContexts,
        maxContextsPerDomain: this.maxContextsPerDomain,
      });
    }
    this.initialized = true;
  }

  /**
   * Backward-compatible API used by scraper service.
   */
  async acquireContext(
    userAgent?: string,
    proxy?: { server: string },
    stealthOptions?: StealthOptions,
    hostname?: string,
  ): Promise<BrowserContext> {
    const domain = this.normalizeDomain(hostname);
    return this.getContext(domain, { userAgent, proxy, stealthOptions });
  }

  /**
   * New domain-first API.
   */
  async getContext(domain: string, options: ContextOptions = {}): Promise<BrowserContext> {
    const normalizedDomain = this.normalizeDomain(domain);
    return this.withDomainLock(normalizedDomain, async () => {
      if (this.domainSessions.size === 0 && !this.cleanupInterval) {
        await this.init(this.maxContexts);
      }

      const session = await this.ensureDomainSession(normalizedDomain);
      session.lastUsedAt = new Date();

      const contextKey = this.getContextKey(options.userAgent, options.proxy);
      const pooled = session.contexts.get(contextKey);

      if (pooled && !pooled.inUse) {
        const isValid = await this.isContextValid(pooled.context, session.browser);
        if (isValid) {
          pooled.inUse = true;
          pooled.lastUsedAt = new Date();
          logger.info("[BrowserPool] Context reused", {
            domain: normalizedDomain,
            contextKey,
            totalDomainContexts: session.contexts.size,
          });
          return pooled.context;
        }

        await this.removeContext(normalizedDomain, contextKey, pooled, "invalid_stale");
      }

      const domainLimitReached = session.contexts.size >= this.maxContextsPerDomain;
      const globalLimitReached = this.getTotalContexts() >= this.maxContexts;

      if (domainLimitReached || globalLimitReached) {
        const evicted = domainLimitReached
          ? await this.evictOldestUnusedContext(normalizedDomain)
          : await this.evictOldestUnusedContext();

        if (!evicted) {
          logger.warn("[BrowserPool] Context pool is saturated, waiting for available context", {
            domain: normalizedDomain,
            domainContexts: session.contexts.size,
            totalContexts: this.getTotalContexts(),
            maxContexts: this.maxContexts,
            maxContextsPerDomain: this.maxContextsPerDomain,
          });
          return this.waitForAvailableContext(normalizedDomain, contextKey);
        }
      }

      const context = await this.createContext(session, options);

      const pooledContext: PooledContext = {
        context,
        inUse: true,
        createdAt: new Date(),
        lastUsedAt: new Date(),
        key: contextKey,
      };

      session.contexts.set(contextKey, pooledContext);
      this.contextIndex.set(context, { domain: normalizedDomain, key: contextKey });

      logger.info("[BrowserPool] Context created", {
        domain: normalizedDomain,
        contextKey,
        totalDomainContexts: session.contexts.size,
        totalContexts: this.getTotalContexts(),
      });

      return context;
    });
  }

  /**
   * Release by BrowserContext (backward-compatible) or by domain.
   */
  async releaseContext(target: BrowserContext | string): Promise<void> {
    if (typeof target === "string") {
      await this.releaseContextByDomain(this.normalizeDomain(target));
      return;
    }

    const index = this.contextIndex.get(target);
    if (!index) {
      logger.warn("[BrowserPool] releaseContext called for unknown context");
      return;
    }

    const session = this.domainSessions.get(index.domain);
    if (!session) return;

    const pooled = session.contexts.get(index.key);
    if (!pooled) return;

    await this.releaseSingleContext(index.domain, index.key, pooled);
  }

  /**
   * Optional helper for safe page reuse.
   * If an about:blank page exists, reuse it; otherwise create a new page.
   */
  async getPage(domain: string, options: ContextOptions = {}): Promise<{ context: BrowserContext; page: Page }> {
    const context = await this.getContext(domain, options);
    const reusable = context
      .pages()
      .find((page) => !page.isClosed() && page.url() === "about:blank");

    if (reusable) {
      return { context, page: reusable };
    }

    const page = await context.newPage();
    return { context, page };
  }

  /**
   * Release page + context safely.
   */
  async releasePage(domain: string, page: Page, context: BrowserContext): Promise<void> {
    try {
      if (!page.isClosed()) {
        await page.goto("about:blank", { waitUntil: "domcontentloaded", timeout: 5000 }).catch(() => undefined);
      }
    } catch {
      // Ignore page reset failures and continue release
    }

    await this.releaseContext(context);
    logger.info("[BrowserPool] Page released", { domain: this.normalizeDomain(domain) });
  }

  /**
   * Get pool statistics
   */
  getStats() {
    let total = 0;
    let inUse = 0;

    for (const session of this.domainSessions.values()) {
      total += session.contexts.size;
      inUse += Array.from(session.contexts.values()).filter((c) => c.inUse).length;
    }

    return {
      total,
      inUse,
      available: total - inUse,
      maxContexts: this.maxContexts,
      domains: this.domainSessions.size,
      maxContextsPerDomain: this.maxContextsPerDomain,
    };
  }

  /**
   * Close all contexts and browsers.
   */
  async close() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }

    const closeTasks: Promise<void>[] = [];

    for (const [domain, session] of this.domainSessions.entries()) {
      for (const [key, pooled] of session.contexts.entries()) {
        closeTasks.push(
          pooled.context.close().catch((error) => {
            logger.error("[BrowserPool] Failed to close context during shutdown", { domain, key, error });
          }),
        );
      }

      if (session.browser) {
        closeTasks.push(
          session.browser.close().catch((error) => {
            logger.error("[BrowserPool] Failed to close browser during shutdown", { domain, error });
          }),
        );
      }
    }

    await Promise.allSettled(closeTasks);

    this.domainSessions.clear();
    this.contextIndex.clear();

    BrowserPool.instance = null;
    globalForBrowserPool.__pricepilotBrowserPool = undefined;

    logger.info("[BrowserPool] Pool shutdown complete");
  }

  private async ensureDomainSession(domain: string): Promise<DomainSession> {
    let session = this.domainSessions.get(domain);

    if (!session) {
      session = {
        domain,
        browser: null,
        contexts: new Map(),
        createdAt: new Date(),
        lastUsedAt: new Date(),
        initPromise: null,
      };
      this.domainSessions.set(domain, session);
    }

    if (session.browser && session.browser.isConnected()) {
      return session;
    }

    if (session.initPromise) {
      await session.initPromise;
      if (session.browser && session.browser.isConnected()) {
        return session;
      }
    }

    session.initPromise = this.createBrowserForDomain(session).finally(() => {
      session!.initPromise = null;
    });

    await session.initPromise;
    return session;
  }

  private async createBrowserForDomain(session: DomainSession): Promise<void> {
    if (!this.stealthConfigured) {
      chromium.use(StealthPlugin());
      this.stealthConfigured = true;
    }

    try {
      session.browser = await chromium.launch({
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

      logger.info("[BrowserPool] Browser created with playwright-extra stealth", {
        domain: session.domain,
      });
      return;
    } catch (error) {
      logger.warn("[BrowserPool] Stealth browser init failed, falling back to playwright chromium", {
        domain: session.domain,
        error,
      });
    }

    session.browser = await playwrightChromium.launch({
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

    logger.info("[BrowserPool] Browser created with playwright chromium", {
      domain: session.domain,
    });
  }

  private async createContext(session: DomainSession, options: ContextOptions): Promise<BrowserContext> {
    if (!session.browser || !session.browser.isConnected()) {
      throw new Error(`Browser is not available for domain ${session.domain}`);
    }

    const stealth: StealthOptions = {
      canvas: true,
      webgl: true,
      audio: true,
      fonts: true,
      webrtc: true,
      timezone: true,
      locale: true,
      battery: true,
      ...options.stealthOptions,
    };

    const selectedUA = options.userAgent || USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
    const viewport = VIEWPORTS[Math.floor(Math.random() * VIEWPORTS.length)];
    const deviceScaleFactor = Math.random() > 0.5 ? 2 : 1;
    const isWin = selectedUA.includes("Windows");
    const platform = isWin ? "Win32" : selectedUA.includes("Mac") ? "MacIntel" : "Linux x86_64";

    const timezone = stealth.timezone
      ? TIMEZONES[Math.floor(Math.random() * TIMEZONES.length)]
      : "Asia/Dhaka";
    const locale = stealth.locale
      ? LOCALES[Math.floor(Math.random() * LOCALES.length)]
      : "en-US";

    const context = await session.browser.newContext({
      userAgent: selectedUA,
      proxy: options.proxy,
      viewport,
      deviceScaleFactor,
      hasTouch: false,
      locale,
      timezoneId: timezone,
      extraHTTPHeaders: {
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
        "Accept-Language": `${locale},${locale.split("-")[0]};q=0.9`,
        "Cache-Control": "no-cache",
        Pragma: "no-cache",
        "Sec-Ch-Ua": isWin
          ? '"Not A(Brand";v="99", "Google Chrome";v="121", "Chromium";v="121"'
          : '"Not A(Brand";v="99", "Chromium";v="121"',
        "Sec-Ch-Ua-Mobile": "?0",
        "Sec-Ch-Ua-Platform": isWin ? '"Windows"' : platform.includes("Mac") ? '"macOS"' : '"Linux"',
        "Sec-Fetch-Dest": "document",
        "Sec-Fetch-Mode": "navigate",
        "Sec-Fetch-Site": "none",
        "Sec-Fetch-User": "?1",
        "Upgrade-Insecure-Requests": "1",
      },
    });

    await context.addInitScript(
      ({ plat, stealthOpts }: { plat: string; stealthOpts: StealthOptions }) => {
        Object.defineProperty(navigator, "webdriver", { get: () => undefined });
        Object.defineProperty(navigator, "platform", { get: () => plat });
        Object.defineProperty(navigator, "plugins", { get: () => [1, 2, 3, 4, 5] });

        if (stealthOpts.canvas) {
          const originalToDataURL = HTMLCanvasElement.prototype.toDataURL;
          const originalGetImageData = CanvasRenderingContext2D.prototype.getImageData;

          const addNoise = (data: Uint8ClampedArray) => {
            const noise = Math.random() * 0.1;
            for (let i = 0; i < data.length; i += 4) {
              data[i] = Math.min(255, data[i] + Math.floor(noise * 10));
              data[i + 1] = Math.min(255, data[i + 1] + Math.floor(noise * 10));
              data[i + 2] = Math.min(255, data[i + 2] + Math.floor(noise * 10));
            }
          };

          HTMLCanvasElement.prototype.toDataURL = function (...args: any[]) {
            const canvasCtx = this.getContext("2d");
            if (canvasCtx) {
              const imageData = canvasCtx.getImageData(0, 0, this.width, this.height);
              addNoise(imageData.data);
              canvasCtx.putImageData(imageData, 0, 0);
            }
            return originalToDataURL.apply(this, args as [type?: string, quality?: number]);
          };

          CanvasRenderingContext2D.prototype.getImageData = function (...args: any[]) {
            const imageData = originalGetImageData.apply(this, args as [
              sx: number,
              sy: number,
              sw: number,
              sh: number,
              settings?: ImageDataSettings,
            ]);
            addNoise(imageData.data);
            return imageData;
          };
        }

        if (stealthOpts.webgl) {
          const originalGetContext = HTMLCanvasElement.prototype.getContext;
          (HTMLCanvasElement.prototype as any).getContext = function (type: any, attributes: any) {
            const canvasCtx = originalGetContext.apply(this, [type, attributes]);
            if (type === "webgl" || type === "experimental-webgl" || type === "webgl2") {
              const originalGetParameter = (canvasCtx as any).getParameter;
              (canvasCtx as any).getParameter = function (parameter: any) {
                if (parameter === 37445) return "Google Inc. (Intel)";
                if (parameter === 37446)
                  return "ANGLE (Intel, Intel(R) UHD Graphics (0x00009BC4) Direct3D11 vs_5_0 ps_5_0, D3D11)";
                return originalGetParameter.apply(this, [parameter]);
              };
            }
            return canvasCtx;
          };
        }

        if (stealthOpts.audio) {
          const AudioContextCtor = (window as any).AudioContext || (window as any).webkitAudioContext;
          if (AudioContextCtor) {
            const originalCreateOscillator = AudioContextCtor.prototype.createOscillator;
            AudioContextCtor.prototype.createOscillator = function () {
              const oscillator = originalCreateOscillator.apply(this, arguments as any);
              const originalStart = oscillator.start;
              oscillator.start = function (...args: any[]) {
                const noise = Math.random() * 0.0001;
                if (args[0] !== undefined) args[0] = args[0] + noise;
                return originalStart.apply(this, args);
              };
              return oscillator;
            };
          }
        }

        if (stealthOpts.fonts) {
          const originalOffsetWidth = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "offsetWidth");
          const originalOffsetHeight = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "offsetHeight");

          if (originalOffsetWidth && originalOffsetHeight) {
            Object.defineProperty(HTMLElement.prototype, "offsetWidth", {
              get: function () {
                const width = originalOffsetWidth.get?.call(this);
                return width ? width + (Math.random() - 0.5) * 0.01 : width;
              },
            });

            Object.defineProperty(HTMLElement.prototype, "offsetHeight", {
              get: function () {
                const height = originalOffsetHeight.get?.call(this);
                return height ? height + (Math.random() - 0.5) * 0.01 : height;
              },
            });
          }
        }

        if (stealthOpts.webrtc) {
          if (navigator.mediaDevices) {
            (navigator.mediaDevices as any).getUserMedia = function () {
              return Promise.reject(new Error("Permission denied"));
            };
          }

          (window as any).RTCPeerConnection = undefined;
          (window as any).webkitRTCPeerConnection = undefined;
          (window as any).mozRTCPeerConnection = undefined;
        }

        if (stealthOpts.battery && "getBattery" in navigator) {
          (navigator as any).getBattery = () =>
            Promise.resolve({
              charging: true,
              chargingTime: 0,
              dischargingTime: Infinity,
              level: 1,
              addEventListener: () => {
                return;
              },
              removeEventListener: () => {
                return;
              },
              dispatchEvent: () => true,
            });
        }

        (window as any).chrome = {
          runtime: {},
          loadTimes: function () {
            return;
          },
          csi: function () {
            return;
          },
          app: {},
        };

        const originalQuery = window.navigator.permissions.query;
        (window.navigator.permissions as any).query = (parameters: any) =>
          parameters.name === "notifications"
            ? Promise.resolve({ state: Notification.permission })
            : originalQuery(parameters);
      },
      { plat: platform, stealthOpts: stealth },
    );

    return context;
  }

  private async releaseContextByDomain(domain: string): Promise<void> {
    const session = this.domainSessions.get(domain);
    if (!session) return;

    const releasable = Array.from(session.contexts.entries())
      .filter(([, pooled]) => pooled.inUse)
      .sort((a, b) => b[1].lastUsedAt.getTime() - a[1].lastUsedAt.getTime())[0];

    if (!releasable) return;

    const [key, pooled] = releasable;
    await this.releaseSingleContext(domain, key, pooled);
  }

  private async releaseSingleContext(domain: string, key: string, pooled: PooledContext): Promise<void> {
    try {
      const pages = pooled.context.pages();
      for (const page of pages) {
        try {
          if (page.isClosed()) continue;
          if (page.url() === "about:blank") continue;
          await page.close({ runBeforeUnload: false }).catch(() => undefined);
        } catch {
          // ignore page close issues during release
        }
      }
    } catch (error) {
      logger.warn("[BrowserPool] Failed to cleanup pages during context release", { domain, key, error });
    }

    pooled.inUse = false;
    pooled.lastUsedAt = new Date();

    logger.info("[BrowserPool] Context released", {
      domain,
      contextKey: key,
    });
  }

  private async isContextValid(context: BrowserContext, browser: Browser | null): Promise<boolean> {
    try {
      if (!browser || !browser.isConnected()) return false;
      context.pages();
      return true;
    } catch {
      return false;
    }
  }

  private normalizeDomain(domain?: string): string {
    const normalized = (domain || "generic").trim().toLowerCase();
    return normalized || "generic";
  }

  private getContextKey(userAgent?: string, proxy?: { server: string }): string {
    const ua = userAgent || "default";
    const proxyServer = proxy?.server || "none";
    return `${ua.substring(0, 16)}_${proxyServer}`;
  }

  private getTotalContexts(): number {
    let total = 0;
    for (const session of this.domainSessions.values()) {
      total += session.contexts.size;
    }
    return total;
  }

  private async waitForAvailableContext(domain: string, preferredKey: string): Promise<BrowserContext> {
    return new Promise((resolve) => {
      const checkInterval = setInterval(async () => {
        const session = this.domainSessions.get(domain);
        if (!session) {
          clearInterval(checkInterval);
          resolve(await this.getContext(domain));
          return;
        }

        const preferred = session.contexts.get(preferredKey);
        if (preferred && !preferred.inUse) {
          preferred.inUse = true;
          preferred.lastUsedAt = new Date();
          clearInterval(checkInterval);
          logger.info("[BrowserPool] Context reused after wait", { domain, contextKey: preferredKey });
          resolve(preferred.context);
          return;
        }

        for (const [key, pooled] of session.contexts.entries()) {
          if (!pooled.inUse) {
            pooled.inUse = true;
            pooled.lastUsedAt = new Date();
            clearInterval(checkInterval);
            logger.info("[BrowserPool] Context reused after wait", { domain, contextKey: key });
            resolve(pooled.context);
            return;
          }
        }
      }, 100);
    });
  }

  private async withDomainLock<T>(domain: string, fn: () => Promise<T>): Promise<T> {
    const previous = this.domainLocks.get(domain) || Promise.resolve();
    let releaseCurrent: () => void = () => undefined;
    const current = new Promise<void>((resolve) => {
      releaseCurrent = resolve;
    });
    const lockToken = previous.then(() => current);
    this.domainLocks.set(domain, lockToken);

    await previous;
    try {
      return await fn();
    } finally {
      releaseCurrent();
      if (this.domainLocks.get(domain) === lockToken) {
        this.domainLocks.delete(domain);
      }
    }
  }

  private async evictOldestUnusedContext(preferredDomain?: string): Promise<boolean> {
    let selected: { domain: string; key: string; pooled: PooledContext } | null = null;

    const sessions = preferredDomain
      ? [[preferredDomain, this.domainSessions.get(preferredDomain)] as const]
      : (Array.from(this.domainSessions.entries()) as Array<[string, DomainSession]>);

    for (const [domain, maybeSession] of sessions) {
      const session = maybeSession;
      if (!session) continue;

      for (const [key, pooled] of session.contexts.entries()) {
        if (pooled.inUse) continue;

        if (!selected || pooled.lastUsedAt.getTime() < selected.pooled.lastUsedAt.getTime()) {
          selected = { domain, key, pooled };
        }
      }
    }

    if (!selected) return false;

    await this.removeContext(selected.domain, selected.key, selected.pooled, "evicted");
    return true;
  }

  private async removeContext(
    domain: string,
    key: string,
    pooled: PooledContext,
    reason: "evicted" | "stale" | "invalid_stale",
  ): Promise<void> {
    try {
      await pooled.context.close();
    } catch (error) {
      logger.warn("[BrowserPool] Failed to close context during removal", { domain, key, reason, error });
    }

    const session = this.domainSessions.get(domain);
    if (session) {
      session.contexts.delete(key);
      this.contextIndex.delete(pooled.context);
    }

    logger.info("[BrowserPool] Context removed", {
      domain,
      contextKey: key,
      reason,
    });
  }

  private startCleanup() {
    if (this.cleanupInterval) return;

    this.cleanupInterval = setInterval(async () => {
      const now = Date.now();
      const staleContextTasks: Array<Promise<void>> = [];
      const idleDomains: string[] = [];

      for (const [domain, session] of this.domainSessions.entries()) {
        session.lastUsedAt = new Date(
          Math.max(
            session.lastUsedAt.getTime(),
            ...Array.from(session.contexts.values()).map((c) => c.lastUsedAt.getTime()),
            session.createdAt.getTime(),
          ),
        );

        for (const [key, pooled] of session.contexts.entries()) {
          if (!pooled.inUse && now - pooled.lastUsedAt.getTime() > this.contextTimeout) {
            staleContextTasks.push(this.removeContext(domain, key, pooled, "stale"));
          }
        }

        if (session.contexts.size === 0 && now - session.lastUsedAt.getTime() > this.browserIdleTimeout) {
          idleDomains.push(domain);
        }
      }

      await Promise.allSettled(staleContextTasks);

      for (const domain of idleDomains) {
        const session = this.domainSessions.get(domain);
        if (!session) continue;
        if (session.contexts.size > 0) continue;

        if (session.browser) {
          try {
            await session.browser.close();
            logger.info("[BrowserPool] Idle domain browser closed", { domain });
          } catch (error) {
            logger.warn("[BrowserPool] Failed closing idle domain browser", { domain, error });
          }
        }

        this.domainSessions.delete(domain);
      }
    }, 60000);
  }
}
