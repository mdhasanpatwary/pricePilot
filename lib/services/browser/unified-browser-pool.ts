import { chromium as playwrightChromium, Browser, BrowserContext, Page } from "playwright";
import { chromium } from "playwright-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import { logger } from "@/lib/logger";
import { getAllUserAgents } from "@/lib/config/user-agents";
import type { BrowserScrapeConfig } from "@/lib/services/bot-protection/headless-browser-scraper";

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
  proxy?: { server: string; username?: string; password?: string };
  stealthOptions?: StealthOptions;
  viewport?: { width: number; height: number; deviceScaleFactor?: number; isMobile?: boolean };
  stealthMode?: boolean;
}

interface PooledContext {
  context: BrowserContext;
  inUse: boolean;
  createdAt: Date;
  lastUsedAt: Date;
  key: string;
  browserId: string;
  requestCount: number;
}

interface DomainSession {
  domain: string;
  browserId: string | null;
  contexts: Map<string, PooledContext>;
  createdAt: Date;
  lastUsedAt: Date;
}

interface BrowserSlot {
  id: string;
  browser: Browser;
  createdAt: Date;
  lastUsedAt: Date;
  launchMode: "stealth" | "fallback";
  domains: Set<string>;
}

export interface BrowserPoolConfig {
  maxConcurrent: number;
  maxRequestsPerBrowser: number;
  idleTimeout: number;
  maxContextsPerDomain: number;
  maxGlobalContexts: number;
  acquireTimeoutMs: number;
  browserIdleTimeoutMs: number;
  maxGlobalBrowsers: number;
  maxRssMb: number;
}

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
const LOCALES = ["en-US", "en-GB", "en-CA", "en-AU", "fr-FR", "de-DE", "es-ES", "ja-JP"];

const LAUNCH_ARGS = [
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
  "--disable-background-networking",
  "--disable-background-timer-throttling",
  "--disable-backgrounding-occluded-windows",
  "--disable-breakpad",
  "--disable-component-extensions-with-background-pages",
  "--disable-features=TranslateUI,BlinkGenPropertyTrees",
  "--disable-ipc-flooding-protection",
  "--disable-renderer-backgrounding",
  "--disable-sync",
  "--metrics-recording-only",
  "--mute-audio",
  "--no-default-browser-check",
  "--disable-default-apps",
  "--disable-hang-monitor",
  "--disable-prompt-on-repost",
  "--disable-domain-reliability",
  "--disable-features=AudioServiceOutOfProcess",
];

const globalForPool = globalThis as typeof globalThis & {
  __pricepilotUnifiedBrowserPool?: BrowserPool;
};

export class BrowserPool {
  private static instance: BrowserPool | null = null;

  private domainSessions: Map<string, DomainSession> = new Map();
  private browserSlots: Map<string, BrowserSlot> = new Map();
  private contextIndex: Map<BrowserContext, { domain: string; key: string }> = new Map();
  private domainLocks: Map<string, Promise<void>> = new Map();
  private pendingBrowserCreates: Map<string, Promise<BrowserSlot>> = new Map();

  private cleanupInterval: NodeJS.Timeout | null = null;
  private stealthConfigured = false;
  private initialized = false;
  private nextBrowserId = 1;

  private config: BrowserPoolConfig;

  private constructor(config?: Partial<BrowserPoolConfig>) {
    const maxConcurrent = parseInt(process.env.BROWSER_POOL_MAX_CONCURRENT || "5", 10);
    const maxRequests = parseInt(process.env.BROWSER_POOL_MAX_REQUESTS || "100", 10);
    const idleTimeout = parseInt(process.env.BROWSER_POOL_IDLE_TIMEOUT || String(5 * 60 * 1000), 10);
    const maxContextsPerDomain = parseInt(process.env.BROWSER_POOL_MAX_CONTEXTS_PER_DOMAIN || "3", 10);
    const maxGlobalContexts = parseInt(process.env.BROWSER_POOL_MAX_CONTEXTS || "10", 10);
    const acquireTimeoutMs = parseInt(process.env.BROWSER_POOL_ACQUIRE_TIMEOUT || "15000", 10);
    const browserIdleTimeoutMs = parseInt(process.env.BROWSER_POOL_BROWSER_IDLE_TIMEOUT || String(15 * 60 * 1000), 10);
    const maxGlobalBrowsers = parseInt(process.env.BROWSER_POOL_MAX_BROWSERS || String(maxConcurrent), 10);
    const maxRssMb = parseInt(process.env.BROWSER_POOL_MAX_RSS_MB || "0", 10);

    this.config = {
      maxConcurrent: config?.maxConcurrent ?? maxConcurrent,
      maxRequestsPerBrowser: config?.maxRequestsPerBrowser ?? maxRequests,
      idleTimeout: config?.idleTimeout ?? idleTimeout,
      maxContextsPerDomain: config?.maxContextsPerDomain ?? maxContextsPerDomain,
      maxGlobalContexts: config?.maxGlobalContexts ?? maxGlobalContexts,
      acquireTimeoutMs: config?.acquireTimeoutMs ?? acquireTimeoutMs,
      browserIdleTimeoutMs: config?.browserIdleTimeoutMs ?? browserIdleTimeoutMs,
      maxGlobalBrowsers: config?.maxGlobalBrowsers ?? maxGlobalBrowsers,
      maxRssMb: config?.maxRssMb ?? maxRssMb,
    };
  }

  static getInstance(config?: Partial<BrowserPoolConfig>): BrowserPool {
    if (!BrowserPool.instance) {
      BrowserPool.instance = globalForPool.__pricepilotUnifiedBrowserPool ?? new BrowserPool(config);
      globalForPool.__pricepilotUnifiedBrowserPool = BrowserPool.instance;
    }
    return BrowserPool.instance;
  }

  static async shutdown(): Promise<void> {
    if (!BrowserPool.instance && !globalForPool.__pricepilotUnifiedBrowserPool) return;
    const instance = BrowserPool.instance ?? globalForPool.__pricepilotUnifiedBrowserPool;
    if (!instance) return;
    await instance.closeAll();
  }

  async init(maxContexts: number = this.config.maxGlobalContexts): Promise<void> {
    this.config.maxGlobalContexts = Math.max(1, maxContexts);
    this.config.maxContextsPerDomain = Math.max(
      1,
      Math.min(this.config.maxContextsPerDomain, this.config.maxGlobalContexts),
    );
    this.startCleanup();

    if (!this.initialized) {
      logger.info("[UnifiedBrowserPool] Initialized", {
        maxGlobalContexts: this.config.maxGlobalContexts,
        maxContextsPerDomain: this.config.maxContextsPerDomain,
        maxGlobalBrowsers: this.config.maxGlobalBrowsers,
      });
    }

    this.initialized = true;
  }

  async acquire(config: BrowserScrapeConfig): Promise<BrowserContext> {
    const domain = this.resolveDomain(config.domainKey, config.url);
    const proxyServer =
      config.proxy && config.proxy.host
        ? `${config.proxy.protocol}://${config.proxy.host}:${config.proxy.port}`
        : undefined;

    const context = await this.getContext(domain, {
      userAgent: config.userAgent,
      proxy: proxyServer
        ? {
            server: proxyServer,
            username: config.proxy?.username,
            password: config.proxy?.password,
          }
        : undefined,
      stealthMode: config.stealthMode,
      viewport: config.viewport,
    });

    return context;
  }

  async acquireContext(
    userAgent?: string,
    proxy?: { server: string; username?: string; password?: string },
    stealthOptions?: StealthOptions,
    hostname?: string,
  ): Promise<BrowserContext> {
    const domain = this.normalizeDomain(hostname);
    return this.getContext(domain, { userAgent, proxy, stealthOptions });
  }

  async getContext(domain: string, options: ContextOptions = {}): Promise<BrowserContext> {
    const normalizedDomain = this.normalizeDomain(domain);

    if (!this.initialized) {
      await this.init(this.config.maxGlobalContexts);
    }

    return this.withDomainLock(normalizedDomain, async () => {
      const session = this.ensureDomainSession(normalizedDomain);
      session.lastUsedAt = new Date();

      const contextKey = this.getContextKey(options.userAgent, options.proxy, options.stealthMode);
      const pooled = session.contexts.get(contextKey);

      if (pooled && !pooled.inUse) {
        const slot = this.browserSlots.get(pooled.browserId);
        const isValid = await this.isContextValid(pooled.context, slot?.browser || null);
        if (isValid) {
          pooled.inUse = true;
          pooled.lastUsedAt = new Date();
          pooled.requestCount += 1;
          session.lastUsedAt = new Date();
          if (slot) slot.lastUsedAt = new Date();
          (pooled.context as any).__pp_contextCreatedForRequest = pooled.requestCount === 1;
          return pooled.context;
        }

        await this.removeContext(normalizedDomain, contextKey, pooled, "invalid_stale");
      }

      const domainLimitReached = session.contexts.size >= this.config.maxContextsPerDomain;
      const globalLimitReached = this.getTotalContexts() >= this.config.maxGlobalContexts;

      if (domainLimitReached || globalLimitReached) {
        const evicted = domainLimitReached
          ? await this.evictOldestUnusedContext(normalizedDomain)
          : await this.evictOldestUnusedContext();

        if (!evicted) {
          return this.waitForAvailableContext(normalizedDomain, contextKey, this.config.acquireTimeoutMs);
        }
      }

      const slot = await this.ensureBrowserSlotForDomain(normalizedDomain);
      const context = await this.createContext(slot.browser, options);

      const pooledContext: PooledContext = {
        context,
        inUse: true,
        createdAt: new Date(),
        lastUsedAt: new Date(),
        key: contextKey,
        browserId: slot.id,
        requestCount: 1,
      };

      session.contexts.set(contextKey, pooledContext);
      this.contextIndex.set(context, { domain: normalizedDomain, key: contextKey });
      slot.domains.add(normalizedDomain);
      slot.lastUsedAt = new Date();

      (context as any).__pp_contextCreatedForRequest = true;

      logger.info("[UnifiedBrowserPool] Context created", {
        domain: normalizedDomain,
        contextKey,
        browserId: slot.id,
        domainContexts: session.contexts.size,
        totalContexts: this.getTotalContexts(),
      });

      return context;
    });
  }

  async release(context: BrowserContext): Promise<void> {
    await this.releaseContext(context);
  }

  async releaseContext(target: BrowserContext | string): Promise<void> {
    if (typeof target === "string") {
      await this.releaseContextByDomain(this.normalizeDomain(target));
      return;
    }

    const index = this.contextIndex.get(target);
    if (!index) {
      logger.warn("[UnifiedBrowserPool] releaseContext called for unknown context");
      return;
    }

    const session = this.domainSessions.get(index.domain);
    if (!session) return;

    const pooled = session.contexts.get(index.key);
    if (!pooled) return;

    await this.releaseSingleContext(index.domain, index.key, pooled);
  }

  async invalidate(context: BrowserContext): Promise<void> {
    const index = this.contextIndex.get(context);
    if (!index) return;

    const session = this.domainSessions.get(index.domain);
    if (!session) return;

    const pooled = session.contexts.get(index.key);
    if (!pooled) return;

    await this.removeContext(index.domain, index.key, pooled, "invalidated");
  }

  async invalidateByDomainKey(domainKey: string): Promise<void> {
    const domain = this.normalizeDomain(domainKey);
    const session = this.domainSessions.get(domain);
    if (!session) return;

    const removals = Array.from(session.contexts.entries()).map(([key, pooled]) =>
      this.removeContext(domain, key, pooled, "invalidated"),
    );

    await Promise.allSettled(removals);
  }

  async getPage(domain: string, options: ContextOptions = {}): Promise<{ context: BrowserContext; page: Page }> {
    const context = await this.getContext(domain, options);
    const reusable = context.pages().find((page) => !page.isClosed() && page.url() === "about:blank");

    if (reusable) {
      return { context, page: reusable };
    }

    const page = await context.newPage();
    return { context, page };
  }

  async releasePage(domain: string, page: Page, context: BrowserContext): Promise<void> {
    try {
      if (!page.isClosed()) {
        await page.goto("about:blank", { waitUntil: "domcontentloaded", timeout: 5000 }).catch(() => undefined);
      }
    } catch {
      // Ignore page reset failures
    }

    await this.releaseContext(context);
    logger.info("[UnifiedBrowserPool] Page released", { domain: this.normalizeDomain(domain) });
  }

  healthCheck(): { healthy: boolean; reasons: string[]; stats: ReturnType<BrowserPool["getStats"]> } {
    const stats = this.getStats();
    const reasons: string[] = [];
    const contextUtil = stats.maxContexts > 0 ? stats.inUse / stats.maxContexts : 0;
    const browserUtil = stats.maxGlobalBrowsers > 0 ? stats.totalBrowsers / stats.maxGlobalBrowsers : 0;

    if (contextUtil > 0.95) reasons.push("context_capacity_near_exhaustion");
    if (browserUtil > 0.95) reasons.push("browser_capacity_near_exhaustion");
    if (this.config.maxRssMb > 0 && stats.memoryRssMb > this.config.maxRssMb) reasons.push("memory_threshold_exceeded");

    return {
      healthy: reasons.length === 0,
      reasons,
      stats,
    };
  }

  getStats() {
    let totalContexts = 0;
    let inUseContexts = 0;

    for (const session of this.domainSessions.values()) {
      totalContexts += session.contexts.size;
      inUseContexts += Array.from(session.contexts.values()).filter((c) => c.inUse).length;
    }

    const totalBrowsers = this.browserSlots.size;
    const inUseBrowsers = new Set<string>(
      Array.from(this.domainSessions.values())
        .flatMap((session) => Array.from(session.contexts.values()).filter((ctx) => ctx.inUse).map((ctx) => ctx.browserId)),
    ).size;

    const memoryRssMb = Math.round(process.memoryUsage().rss / 1024 / 1024);

    return {
      total: totalContexts,
      inUse: inUseContexts,
      available: totalContexts - inUseContexts,
      maxContexts: this.config.maxGlobalContexts,
      domains: this.domainSessions.size,
      maxContextsPerDomain: this.config.maxContextsPerDomain,
      totalBrowsers,
      inUseBrowsers,
      availableBrowsers: Math.max(0, totalBrowsers - inUseBrowsers),
      maxGlobalBrowsers: this.config.maxGlobalBrowsers,
      memoryRssMb,
      // Backward compatibility for bot-protection stats consumers
      totalInstances: totalBrowsers,
      inUseInstances: inUseBrowsers,
      availableInstances: Math.max(0, totalBrowsers - inUseBrowsers),
      maxConcurrent: this.config.maxGlobalBrowsers,
    };
  }

  async close(): Promise<void> {
    await this.closeAll();
  }

  async closeAll(): Promise<void> {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }

    const closeTasks: Promise<void>[] = [];

    for (const [domain, session] of this.domainSessions.entries()) {
      for (const [key, pooled] of session.contexts.entries()) {
        closeTasks.push(
          pooled.context.close().catch((error) => {
            logger.warn("[UnifiedBrowserPool] Failed to close context during shutdown", { domain, key, error });
          }),
        );
      }
    }

    for (const slot of this.browserSlots.values()) {
      closeTasks.push(
        slot.browser.close().catch((error) => {
          logger.warn("[UnifiedBrowserPool] Failed to close browser during shutdown", { browserId: slot.id, error });
        }),
      );
    }

    await Promise.allSettled(closeTasks);

    this.domainSessions.clear();
    this.browserSlots.clear();
    this.contextIndex.clear();
    this.domainLocks.clear();
    this.pendingBrowserCreates.clear();

    BrowserPool.instance = null;
    globalForPool.__pricepilotUnifiedBrowserPool = undefined;

    logger.info("[UnifiedBrowserPool] Pool shutdown complete");
  }

  private ensureDomainSession(domain: string): DomainSession {
    const existing = this.domainSessions.get(domain);
    if (existing) return existing;

    const session: DomainSession = {
      domain,
      browserId: null,
      contexts: new Map(),
      createdAt: new Date(),
      lastUsedAt: new Date(),
    };

    this.domainSessions.set(domain, session);
    return session;
  }

  private async ensureBrowserSlotForDomain(domain: string): Promise<BrowserSlot> {
    const session = this.ensureDomainSession(domain);
    if (session.browserId) {
      const currentSlot = this.browserSlots.get(session.browserId);
      if (currentSlot && currentSlot.browser.isConnected()) {
        currentSlot.lastUsedAt = new Date();
        return currentSlot;
      }
      session.browserId = null;
    }

    const candidate = this.pickLeastLoadedBrowser();
    if (candidate) {
      session.browserId = candidate.id;
      candidate.domains.add(domain);
      candidate.lastUsedAt = new Date();
      return candidate;
    }

    if (this.browserSlots.size >= this.config.maxGlobalBrowsers) {
      const freed = await this.evictIdleBrowser();
      if (!freed) {
        const waited = await this.waitForBrowserCapacity(this.config.acquireTimeoutMs);
        if (!waited) {
          throw new Error("Browser pool capacity exhausted: no browser slot available");
        }
      }
    }

    const creationKey = `${domain}:${this.nextBrowserId}`;
    const pending = this.pendingBrowserCreates.get(creationKey);
    if (pending) {
      const slot = await pending;
      session.browserId = slot.id;
      slot.domains.add(domain);
      return slot;
    }

    const createPromise = this.createBrowserSlot().finally(() => {
      this.pendingBrowserCreates.delete(creationKey);
    });
    this.pendingBrowserCreates.set(creationKey, createPromise);

    const slot = await createPromise;
    session.browserId = slot.id;
    slot.domains.add(domain);
    return slot;
  }

  private async createBrowserSlot(): Promise<BrowserSlot> {
    if (!this.stealthConfigured) {
      chromium.use(StealthPlugin());
      this.stealthConfigured = true;
    }

    let browser: Browser;
    let launchMode: BrowserSlot["launchMode"] = "stealth";

    try {
      browser = await chromium.launch({
        headless: true,
        args: LAUNCH_ARGS,
      });
    } catch (error) {
      logger.warn("[UnifiedBrowserPool] Stealth launch failed; falling back to playwright chromium", { error });
      browser = await playwrightChromium.launch({
        headless: true,
        args: LAUNCH_ARGS,
      });
      launchMode = "fallback";
    }

    const id = `b-${this.nextBrowserId++}`;
    const slot: BrowserSlot = {
      id,
      browser,
      createdAt: new Date(),
      lastUsedAt: new Date(),
      launchMode,
      domains: new Set(),
    };

    this.browserSlots.set(id, slot);

    logger.info("[UnifiedBrowserPool] Browser slot created", {
      browserId: id,
      launchMode,
      totalBrowsers: this.browserSlots.size,
      maxGlobalBrowsers: this.config.maxGlobalBrowsers,
    });

    return slot;
  }

  private pickLeastLoadedBrowser(): BrowserSlot | null {
    if (this.browserSlots.size === 0) return null;

    const active = Array.from(this.browserSlots.values()).filter((slot) => slot.browser.isConnected());
    if (active.length === 0) return null;

    active.sort((a, b) => {
      const aLoad = this.getActiveContextCountForBrowser(a.id);
      const bLoad = this.getActiveContextCountForBrowser(b.id);
      if (aLoad !== bLoad) return aLoad - bLoad;
      return a.lastUsedAt.getTime() - b.lastUsedAt.getTime();
    });

    return active[0] || null;
  }

  private getActiveContextCountForBrowser(browserId: string): number {
    let count = 0;
    for (const session of this.domainSessions.values()) {
      for (const pooled of session.contexts.values()) {
        if (pooled.browserId === browserId && pooled.inUse) count += 1;
      }
    }
    return count;
  }

  private async createContext(browser: Browser, options: ContextOptions): Promise<BrowserContext> {
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
    const viewport =
      options.viewport || VIEWPORTS[Math.floor(Math.random() * VIEWPORTS.length)] || { width: 1366, height: 768 };
    const deviceScaleFactor = options.viewport?.deviceScaleFactor ?? (Math.random() > 0.5 ? 2 : 1);
    const isMobile = options.viewport?.isMobile ?? false;

    const isWin = selectedUA.includes("Windows");
    const platform = isWin ? "Win32" : selectedUA.includes("Mac") ? "MacIntel" : "Linux x86_64";

    const timezone = stealth.timezone
      ? TIMEZONES[Math.floor(Math.random() * TIMEZONES.length)]
      : "America/New_York";
    const locale = stealth.locale ? LOCALES[Math.floor(Math.random() * LOCALES.length)] : "en-US";

    const context = await browser.newContext({
      userAgent: selectedUA,
      proxy: options.proxy,
      viewport: {
        width: Math.max(800, viewport.width),
        height: Math.max(600, viewport.height),
      },
      deviceScaleFactor,
      isMobile,
      hasTouch: isMobile,
      locale,
      timezoneId: timezone,
      extraHTTPHeaders: {
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
        "Accept-Language": `${locale},${locale.split("-")[0]};q=0.9`,
        "Cache-Control": "no-cache",
        Pragma: "no-cache",
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
          HTMLCanvasElement.prototype.toDataURL = function (...args: any[]) {
            const canvasCtx = this.getContext("2d");
            if (canvasCtx) {
              const imageData = canvasCtx.getImageData(0, 0, this.width, this.height);
              for (let i = 0; i < imageData.data.length; i += 4) {
                imageData.data[i] = Math.min(255, imageData.data[i] + Math.floor(Math.random() * 3) - 1);
              }
              canvasCtx.putImageData(imageData, 0, 0);
            }
            return originalToDataURL.apply(this, args as [type?: string, quality?: number]);
          };
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
              addEventListener: () => undefined,
              removeEventListener: () => undefined,
              dispatchEvent: () => true,
            });
        }

        (window as any).chrome = { runtime: {} };
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
          // ignore page close issues
        }
      }
    } catch (error) {
      logger.warn("[UnifiedBrowserPool] Failed to cleanup pages during release", { domain, key, error });
    }

    if (pooled.requestCount >= this.config.maxRequestsPerBrowser) {
      await this.removeContext(domain, key, pooled, "recycled");
      return;
    }

    pooled.inUse = false;
    pooled.lastUsedAt = new Date();

    const session = this.domainSessions.get(domain);
    if (session) session.lastUsedAt = pooled.lastUsedAt;

    const slot = this.browserSlots.get(pooled.browserId);
    if (slot) slot.lastUsedAt = pooled.lastUsedAt;
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

  private resolveDomain(domainKey: string | undefined, url: string): string {
    if (domainKey && domainKey.trim()) return this.normalizeDomain(domainKey);

    try {
      return this.normalizeDomain(new URL(url).hostname);
    } catch {
      return "generic";
    }
  }

  private getContextKey(
    userAgent?: string,
    proxy?: { server: string; username?: string; password?: string },
    stealthMode?: boolean,
  ): string {
    const ua = userAgent || "default";
    const proxyServer = proxy?.server || "none";
    const stealth = stealthMode === false ? "nostealth" : "stealth";
    return `${ua.substring(0, 24)}_${proxyServer}_${stealth}`;
  }

  private getTotalContexts(): number {
    let total = 0;
    for (const session of this.domainSessions.values()) {
      total += session.contexts.size;
    }
    return total;
  }

  private async waitForAvailableContext(
    domain: string,
    preferredKey: string,
    timeoutMs: number,
  ): Promise<BrowserContext> {
    return new Promise((resolve, reject) => {
      const start = Date.now();
      const checkInterval = setInterval(async () => {
        if (Date.now() - start > timeoutMs) {
          clearInterval(checkInterval);
          reject(new Error(`Timed out waiting for browser context in domain ${domain}`));
          return;
        }

        const session = this.domainSessions.get(domain);
        if (!session) {
          clearInterval(checkInterval);
          try {
            resolve(await this.getContext(domain));
          } catch (error) {
            reject(error);
          }
          return;
        }

        const preferred = session.contexts.get(preferredKey);
        if (preferred && !preferred.inUse) {
          preferred.inUse = true;
          preferred.requestCount += 1;
          preferred.lastUsedAt = new Date();
          (preferred.context as any).__pp_contextCreatedForRequest = preferred.requestCount === 1;
          clearInterval(checkInterval);
          resolve(preferred.context);
          return;
        }

        for (const pooled of session.contexts.values()) {
          if (!pooled.inUse) {
            pooled.inUse = true;
            pooled.requestCount += 1;
            pooled.lastUsedAt = new Date();
            (pooled.context as any).__pp_contextCreatedForRequest = pooled.requestCount === 1;
            clearInterval(checkInterval);
            resolve(pooled.context);
            return;
          }
        }
      }, 100);
    });
  }

  private async waitForBrowserCapacity(timeoutMs: number): Promise<boolean> {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      if (this.browserSlots.size < this.config.maxGlobalBrowsers) return true;
      const evicted = await this.evictIdleBrowser();
      if (evicted) return true;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    return false;
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
    reason: "evicted" | "stale" | "invalid_stale" | "invalidated" | "recycled" | "memory_guard",
  ): Promise<void> {
    try {
      await pooled.context.close();
    } catch (error) {
      logger.warn("[UnifiedBrowserPool] Failed to close context", { domain, key, reason, error });
    }

    const session = this.domainSessions.get(domain);
    if (session) {
      session.contexts.delete(key);
      session.lastUsedAt = new Date();
      if (session.contexts.size === 0) {
        session.browserId = null;
      }
    }

    this.contextIndex.delete(pooled.context);

    const slot = this.browserSlots.get(pooled.browserId);
    if (slot) {
      slot.lastUsedAt = new Date();
      if (session?.contexts.size === 0) {
        slot.domains.delete(domain);
      }
    }
  }

  private async evictIdleBrowser(): Promise<boolean> {
    const idleCandidates = Array.from(this.browserSlots.values())
      .filter((slot) => this.getTotalContextsForBrowser(slot.id) === 0)
      .sort((a, b) => a.lastUsedAt.getTime() - b.lastUsedAt.getTime());

    const selected = idleCandidates[0];
    if (!selected) return false;

    try {
      await selected.browser.close();
    } catch (error) {
      logger.warn("[UnifiedBrowserPool] Failed to close idle browser", { browserId: selected.id, error });
    }

    this.browserSlots.delete(selected.id);

    for (const session of this.domainSessions.values()) {
      if (session.browserId === selected.id) {
        session.browserId = null;
      }
    }

    return true;
  }

  private getTotalContextsForBrowser(browserId: string): number {
    let count = 0;
    for (const session of this.domainSessions.values()) {
      for (const ctx of session.contexts.values()) {
        if (ctx.browserId === browserId) count += 1;
      }
    }
    return count;
  }

  private startCleanup(): void {
    if (this.cleanupInterval) return;

    this.cleanupInterval = setInterval(async () => {
      try {
        const now = Date.now();
        const staleContextTasks: Array<Promise<void>> = [];

        for (const [domain, session] of this.domainSessions.entries()) {
          for (const [key, pooled] of session.contexts.entries()) {
            if (!pooled.inUse && now - pooled.lastUsedAt.getTime() > this.config.idleTimeout) {
              staleContextTasks.push(this.removeContext(domain, key, pooled, "stale"));
            }
          }

          if (session.contexts.size === 0 && now - session.lastUsedAt.getTime() > this.config.browserIdleTimeoutMs) {
            session.browserId = null;
          }
        }

        await Promise.allSettled(staleContextTasks);

        // Close browsers that no longer host any context and have been idle.
        for (const slot of Array.from(this.browserSlots.values())) {
          const hasContexts = this.getTotalContextsForBrowser(slot.id) > 0;
          const idleMs = now - slot.lastUsedAt.getTime();
          if (!hasContexts && idleMs > this.config.browserIdleTimeoutMs) {
            try {
              await slot.browser.close();
            } catch (error) {
              logger.warn("[UnifiedBrowserPool] Failed to close idle browser", { browserId: slot.id, error });
            }
            this.browserSlots.delete(slot.id);
          }
        }

        if (this.config.maxRssMb > 0) {
          await this.runMemoryGuard();
        }
      } catch (error) {
        logger.warn("[UnifiedBrowserPool] Cleanup cycle failed", { error });
      }
    }, 60000);
  }

  private async runMemoryGuard(): Promise<void> {
    const rssMb = Math.round(process.memoryUsage().rss / 1024 / 1024);
    if (rssMb <= this.config.maxRssMb) return;

    const candidates: Array<{ domain: string; key: string; pooled: PooledContext }> = [];
    for (const [domain, session] of this.domainSessions.entries()) {
      for (const [key, pooled] of session.contexts.entries()) {
        if (!pooled.inUse) {
          candidates.push({ domain, key, pooled });
        }
      }
    }

    candidates.sort((a, b) => a.pooled.lastUsedAt.getTime() - b.pooled.lastUsedAt.getTime());

    // Evict a bounded number per cycle to avoid thrashing.
    const evictCount = Math.max(1, Math.min(3, Math.ceil(candidates.length / 4)));
    const targets = candidates.slice(0, evictCount);

    for (const candidate of targets) {
      await this.removeContext(candidate.domain, candidate.key, candidate.pooled, "memory_guard");
    }

    logger.warn("[UnifiedBrowserPool] Memory guard evicted idle contexts", {
      rssMb,
      thresholdMb: this.config.maxRssMb,
      evicted: targets.length,
    });
  }
}
