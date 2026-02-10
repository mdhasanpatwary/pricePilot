import { Page } from "playwright";
import { logger } from "../logger";
import { BrowserPool } from "./browser-pool";
import { prisma } from "@/lib/prisma";
import { TECH_BRANDS } from "../data/brands";
import { getSiteProfile, siteProfileManager } from "../config/site-profiles";
import { CacheService } from "./cache";
import { TechProductValidator } from "./validation";
import { HumanSimulation } from "./human-simulation";
import { ProxyManager, ProxyConfig } from "./proxy-manager";
import { ChallengeHandler } from "./challenge-handler";
import { MetricsTracker } from "./metrics-tracker";
import { configurationManager } from "./config-manager";
import { RetryStrategy, RetryContext } from "./retry-strategy";
import { RetryQueueService } from "./retry-queue";
import { ConcurrencyLimiter } from "./concurrency-limiter";
import { CaptchaSolver } from "./captcha-solver";
import { getAllUserAgents, getRandomUserAgentExcluding } from "../config/user-agents";
import { getUserAgentTracker } from "./user-agent-tracker";
import { sessionTracker } from "./session-tracker";
import { ExternalServiceError, RateLimitError, AppError } from "../utils/error-handler";

interface ScrapedProduct {
  title: string;
  price: number;
  currency: string;
  sku?: string;
  brand?: string;
  model?: string;
  url: string;
  inStock: boolean;
  imageUrl?: string;
  specifications?: Record<string, string>;
}

export class ScrapeBlockError extends Error {
  constructor(public provider: string, public url: string, public isAdvanced: boolean = false) {
    super(`BLOCKED: ${provider} at ${url}`);
    this.name = "ScrapeBlockError";
  }
}

/**
 * Adapter function for backward compatibility with new error handling system
 * Wraps ScrapeBlockError into the new AppError hierarchy
 */
import type { AppError as AppErrorType, ErrorOptions as ErrorOptionsType } from '../utils/error-handler';

/**
 * Wraps a ScrapeBlockError into the new error handling system
 * Maps to ExternalServiceError since scraping is an external service concern
 * 
 * @param originalError - The original ScrapeBlockError
 * @param context - Additional context to include
 * @returns AppError instance wrapping the original error
 */
export function wrapScrapeBlockError(
  originalError: ScrapeBlockError,
  context?: Partial<ErrorOptionsType['context']>
): AppErrorType {
  // Dynamic import to avoid circular dependencies
  const { ExternalServiceError } = require('../utils/error-handler');

  return new ExternalServiceError(
    originalError.provider,
    `Scraping blocked by ${originalError.provider}`,
    {
      userMessage: originalError.isAdvanced
        ? `Unable to access ${originalError.provider}. The website has advanced protection. Please check your configuration or contact support.`
        : `Unable to access ${originalError.provider}. The website may be blocking automated requests. Please try again later.`,
      developerMessage: originalError.message,
      cause: originalError,
      context: {
        ...context,
        operation: 'scraping',
        metadata: {
          provider: originalError.provider,
          url: originalError.url,
          isAdvanced: originalError.isAdvanced,
        },
      },
      isRetryable: !originalError.isAdvanced, // Only retry if not advanced blocking
      retryAfter: originalError.isAdvanced ? undefined : 300, // 5 minutes for simple blocks
    }
  );
}

// Domain-specific search URL builders
const SEARCH_STRATEGIES: Record<
  string,
  (baseUrl: string, query: string) => string
> = {
  // StarTech: /product/search?search=QUERY
  "startech.com.bd": (baseUrl, query) =>
    `${baseUrl.replace(/\/$/, "")}/product/search?search=${encodeURIComponent(query)}`,

  // Ryans: /search?q=QUERY (uses + for spaces)
  "ryans.com": (baseUrl, query) =>
    `${baseUrl.replace(/\/$/, "")}/search?q=${encodeURIComponent(query).replace(/%20/g, "+")}`,

  // Ryans Alias
  "ryanscomputers.com": (baseUrl, query) =>
    `${baseUrl.replace(/\/$/, "")}/search?q=${encodeURIComponent(query).replace(/%20/g, "+")}`,

  // TechLandBD: /search/advance/product/result/QUERY
  "techlandbd.com": (baseUrl, query) =>
    `${baseUrl.replace(/\/$/, "")}/search/advance/product/result/${encodeURIComponent(query).replace(/%20/g, "+")}`,

  "techland.com.bd": (baseUrl, query) =>
    `${baseUrl.replace(/\/$/, "")}/search/advance/product/result/${encodeURIComponent(query).replace(/%20/g, "+")}`,
};

// Default Fallback: /search?q=QUERY
const DEFAULT_STRATEGY = (baseUrl: string, query: string) =>
  `${baseUrl.replace(/\/$/, "")}/search?q=${encodeURIComponent(query)}`;

// Get user agents from centralized configuration
const USER_AGENTS = getAllUserAgents();

export class ScraperService {
  private browserPool: BrowserPool;
  private proxies: string[] = [];
  private proxyIndex: number = 0;
  private proxyManager: ProxyManager | null = null;
  private challengeHandler: ChallengeHandler;
  private metricsTracker: MetricsTracker;
  private retryStrategy: RetryStrategy;
  private retryQueueService: RetryQueueService;
  private concurrencyLimiter: ConcurrencyLimiter;
  private captchaSolver: CaptchaSolver | null = null;

  constructor() {
    this.browserPool = BrowserPool.getInstance();
    this.challengeHandler = new ChallengeHandler();
    this.metricsTracker = new MetricsTracker();
    this.retryQueueService = RetryQueueService.getInstance();
    this.retryStrategy = new RetryStrategy({
      maxRetries: 3,
      initialDelay: 1000,
      maxDelay: 30000,
      backoffMultiplier: 2,
      jitter: true,
    });
    this.concurrencyLimiter = new ConcurrencyLimiter({
      minConcurrency: parseInt(process.env.CONCURRENCY_MIN || '1', 10),
      maxConcurrency: parseInt(process.env.CONCURRENCY_MAX || '10', 10),
      initialConcurrency: parseInt(process.env.CONCURRENCY_INITIAL || '3', 10),
    });

    // Initialize CaptchaSolver if enabled
    const captchaEnabled = process.env.CAPTCHA_SOLVER_ENABLED === 'true';
    const captchaApiKey = process.env.CAPTCHA_SOLVER_API_KEY;

    if (captchaEnabled && captchaApiKey) {
      this.captchaSolver = new CaptchaSolver({
        apiKey: captchaApiKey,
        timeout: parseInt(process.env.CAPTCHA_SOLVER_TIMEOUT || '120000', 10),
      });
      logger.info('[ScraperService] CaptchaSolver initialized');
    } else {
      logger.info('[ScraperService] CaptchaSolver disabled or API key not configured');
    }

    // Load configuration from ConfigurationManager
    const config = configurationManager.getConfiguration();

    if (config.proxies.length > 0) {
      this.proxies = config.proxies.map(p => p.url);
      logger.info(
        `[ScraperService] Initialized with ${this.proxies.length} proxies from ConfigurationManager.`,
      );

      // Initialize ProxyManager with proxies from configuration
      this.proxyManager = new ProxyManager(config.proxies);
      logger.info(`[ScraperService] ProxyManager initialized with ${config.proxies.length} proxies`);
    } else {
      logger.info('[ScraperService] No proxies configured, operating in direct mode');
    }

    // Register for configuration changes
    configurationManager.onConfigChange((newConfig) => {
      this.handleConfigurationChange(newConfig);
    });
  }

  /**
   * Handle configuration changes at runtime
   */
  private handleConfigurationChange(newConfig: any): void {
    logger.info('[ScraperService] Configuration changed, updating proxy manager');

    // Update proxies
    if (newConfig.proxies.length > 0) {
      this.proxies = newConfig.proxies.map((p: ProxyConfig) => p.url);

      // Recreate ProxyManager with new proxies
      if (this.proxyManager) {
        this.proxyManager.destroy();
      }
      this.proxyManager = new ProxyManager(newConfig.proxies);
      logger.info(`[ScraperService] ProxyManager updated with ${newConfig.proxies.length} proxies`);
    } else {
      // No proxies configured
      if (this.proxyManager) {
        this.proxyManager.destroy();
        this.proxyManager = null;
      }
      this.proxies = [];
      logger.info('[ScraperService] Proxies removed, operating in direct mode');
    }
  }

  /**
   * Check if an error is a network-related error that should be retried
   * Requirement 9.1: Identify transient network failures
   */
  private isNetworkError(error: any): boolean {
    if (!error) return false;

    const errorMessage = error.message?.toLowerCase() || '';
    const networkErrorPatterns = [
      'econnrefused',
      'econnreset',
      'etimedout',
      'enetunreach',
      'ehostunreach',
      'network',
      'timeout',
      'socket hang up',
      'fetch failed',
    ];

    return networkErrorPatterns.some(pattern => errorMessage.includes(pattern));
  }

  /**
   * Get the next proxy in rotation
   * Uses ProxyManager if available, otherwise falls back to simple rotation
   */
  private async getNextProxy(): Promise<{ url: string; config: ProxyConfig | null }> {
    if (this.proxyManager) {
      const proxyConfig = await this.proxyManager.getHealthyProxy();
      if (proxyConfig) {
        return { url: proxyConfig.url, config: proxyConfig };
      }
      logger.warn('[ScraperService] No healthy proxies available from ProxyManager');
      return { url: '', config: null };
    }

    // Fallback to simple rotation if ProxyManager not available
    if (this.proxies.length === 0) {
      return { url: '', config: null };
    }
    const url = this.proxies[this.proxyIndex];
    this.proxyIndex = (this.proxyIndex + 1) % this.proxies.length;
    return { url, config: null };
  }

  /**
   * Get next user agent, excluding the previous one if provided
   * This ensures user agent rotation on retry attempts
   * Requirements: 9.1, 9.3
   */
  private getNextUserAgent(previousUserAgent?: string): string {
    if (!previousUserAgent) {
      return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
    }

    // Use centralized function to exclude previous user agent
    return getRandomUserAgentExcluding(previousUserAgent);
  }

  /**
   * Initialize the browser pool
   */
  async init() {
    const maxContexts = parseInt(process.env.SCRAPER_MAX_CONTEXTS || "10", 10);
    await this.browserPool.init(maxContexts);
  }

  /**
   * Close the browser pool (usually called on shutdown)
   */
  async close() {
    // Persist any remaining metrics before closing
    await this.metricsTracker.persistMetrics().catch((error) => {
      logger.error('Failed to persist metrics on close', { error });
    });

    this.metricsTracker.stopAutoPersist();

    await this.browserPool.close();
    if (this.proxyManager) {
      this.proxyManager.destroy();
    }
  }

  /**
   * Get pool statistics
   */
  getPoolStats() {
    return this.browserPool.getStats();
  }

  /**
   * Adjust concurrency based on recent site metrics
   * Called after each request to dynamically adapt to site behavior
   * Requirement 6.6
   */
  private async adjustConcurrencyForSite(hostname: string, statusCode: number): Promise<void> {
    try {
      // Get recent metrics for the site
      const metrics = await this.metricsTracker.getSiteMetrics(hostname, '24h');

      if (!metrics || metrics.totalRequests === 0) {
        return; // Not enough data yet
      }

      // Handle immediate rate limit (HTTP 429)
      // Requirement 6.1
      if (statusCode === 429) {
        this.concurrencyLimiter.reduceImmediately(hostname, 'HTTP 429 Rate Limit');
        return;
      }

      // Calculate metrics for adjustment
      const siteMetrics = {
        blockRate: metrics.blockRate,
        successRate: metrics.successRate,
        avgResponseTime: metrics.avgResponseTime,
        recentRequests: metrics.totalRequests,
      };

      // Adjust concurrency based on metrics
      this.concurrencyLimiter.adjustConcurrency(hostname, siteMetrics);
    } catch (error) {
      logger.error(`[ScraperService] Failed to adjust concurrency for ${hostname}`, { error });
    }
  }

  /**
   * Record metrics and user agent tracking for a request
   * Helper method to centralize tracking logic
   * Requirements: 5.1, 9.4
   */
  private recordRequestMetrics(
    hostname: string,
    proxyUrl: string,
    userAgent: string,
    success: boolean,
    blocked: boolean,
    challenged: boolean,
    responseTime: number,
    statusCode: number
  ): void {
    // Record metrics
    this.metricsTracker.recordRequest(hostname, proxyUrl || 'direct', {
      success,
      blocked,
      challenged,
      responseTime,
      statusCode,
    });

    // Track user agent success rate
    // Requirement 9.4
    getUserAgentTracker().recordRequest(userAgent, success);
  }

  /**
   * Get proxy statistics (if ProxyManager is enabled)
   */
  getProxyStats() {
    if (this.proxyManager) {
      return this.proxyManager.getProxyStats();
    }
    return null;
  }

  /**
   * Get user agent statistics
   * Requirements: 9.4
   */
  getUserAgentStats() {
    return getUserAgentTracker().getSummary();
  }

  /**
   * Get concurrency statistics
   */
  getConcurrencyStats() {
    return this.concurrencyLimiter.getStats();
  }

  /**
   * Get challenge statistics for a specific site
   */
  getChallengeStats(site: string) {
    return this.challengeHandler.getChallengeStats(site);
  }

  /**
   * Get site metrics for a specific time range
   */
  async getSiteMetrics(site: string, timeRange: '24h' | '7d' = '24h') {
    return this.metricsTracker.getSiteMetrics(site, timeRange);
  }

  /**
   * Get proxy metrics for a specific time range (if using MetricsTracker)
   */
  async getProxyMetricsForProxy(proxy: string, timeRange: '24h' | '7d' = '24h') {
    return this.metricsTracker.getProxyMetrics(proxy, timeRange);
  }

  /**
   * Manually persist metrics
   */
  async persistMetrics() {
    return this.metricsTracker.persistMetrics();
  }

  /**
   * Scrape a competitor product page with retry logic and human simulation
   * Requirements: 6.2, 6.5, 6.8, 6.9, 8.3, 9.1, 9.2
   */
  async scrapeProductPage(url: string): Promise<ScrapedProduct | null> {
    // Extract hostname for context (used in error metadata)
    let hostname = 'unknown';

    try {
      await this.init();

      try {
        hostname = new URL(url).hostname;
      } catch (error) {
        // Requirement 6.5: Throw ExternalServiceError for invalid URLs
        throw new ExternalServiceError(
          'Unknown',
          'Invalid product URL provided',
          {
            cause: error as Error,
            context: {
              operation: 'scrapeProductPage',
              metadata: { url },
            },
            isRetryable: false,
          }
        );
      }

      // Use RetryStrategy to handle retries with exponential backoff
      return await this.retryStrategy.executeWithRetry(
        async (context: RetryContext) => {
          return this._scrapeProductPageInternal(url, context);
        },
        (error: Error) => {
          // Maintain compatibility with existing ScrapeBlockError (Requirement 8.3)
          if (error instanceof ScrapeBlockError) {
            // Wrap ScrapeBlockError in ExternalServiceError for consistency
            // but preserve the original error as cause
            const wrappedError = new ExternalServiceError(
              error.provider,
              `Scraping blocked by ${error.provider}`,
              {
                cause: error,
                context: {
                  operation: 'scrapeProductPage',
                  metadata: { url, provider: error.provider, isAdvanced: error.isAdvanced },
                },
                isRetryable: true, // Requirement 9.1: Mark transient errors as retryable
                retryAfter: 60, // Retry after 60 seconds
              }
            );
            throw wrappedError;
          }

          // Use the RetryStrategy's error classification
          return this.retryStrategy.shouldRetryError(error);
        }
      );
    } catch (error) {
      // Requirement 6.8: Include operation name in context
      // Requirement 6.9: Preserve original error as cause

      // If already an AppError, re-throw with additional context
      if (error instanceof AppError) {
        // Add operation context if not already present
        if (!error.context.operation) {
          error.context.operation = 'scrapeProductPage';
        }
        if (!error.context.metadata?.url) {
          error.context.metadata = { ...error.context.metadata, url, hostname };
        }
        throw error;
      }

      // Wrap unexpected errors in ExternalServiceError
      // Requirement 6.2: Wrap scraper errors in appropriate AppError subclass
      throw new ExternalServiceError(
        'Scraper',
        'Failed to scrape product page',
        {
          cause: error as Error,
          context: {
            operation: 'scrapeProductPage',
            metadata: { url, hostname },
          },
          isRetryable: this.isNetworkError(error), // Requirement 9.1: Mark network errors as retryable
        }
      );
    }
  }

  /**
   * Scrape a product page with retry queue integration
   * If immediate retries fail, adds the request to the retry queue for later processing
   * Implements Requirements 8.1, 8.5, 6.2, 6.8, 6.9
   * 
   * @param url Product URL to scrape
   * @param tenantId Tenant ID
   * @param siteId Site ID
   * @param productId Product ID
   * @param tenantName Optional tenant name for session tracking
   * @returns Scraped product data or null
   */
  async scrapeProductPageWithRetryQueue(
    url: string,
    tenantId: string,
    siteId: string,
    productId: string,
    tenantName?: string
  ): Promise<ScrapedProduct | null> {
    try {
      // Attempt to scrape with immediate retries and session tracking
      const result = await this.scrapeProductPageWithTracking(
        url,
        tenantId,
        siteId,
        productId,
        tenantName
      );
      return result;
    } catch (error) {
      // All immediate retries exhausted, add to retry queue
      // Requirement 6.8: Include operation name in context
      const errorMessage = error instanceof Error ? error.message : String(error);

      logger.warn(
        `[ScraperService] All immediate retries exhausted for ${url}, adding to retry queue`,
        { error: errorMessage, productId, tenantId }
      );

      try {
        await this.retryQueueService.addToRetryQueue({
          tenantId,
          siteId,
          productId,
          url,
          error: errorMessage,
        });

        logger.info(`[ScraperService] Added product ${productId} to retry queue`);
      } catch (queueError) {
        logger.error(
          `[ScraperService] Failed to add product ${productId} to retry queue`,
          { error: queueError }
        );

        // Wrap queue error in ExternalServiceError
        // Requirement 6.2: Wrap errors in appropriate AppError subclass
        throw new ExternalServiceError(
          'RetryQueue',
          'Failed to add product to retry queue',
          {
            cause: queueError as Error,
            context: {
              operation: 'scrapeProductPageWithRetryQueue',
              tenantId,
              metadata: { url, productId, siteId },
            },
            isRetryable: false,
          }
        );
      }

      // Return null to indicate failure (original behavior preserved)
      return null;
    }
  }

  /**
   * Scrape a product page with session tracking
   * Creates a session, tracks all lifecycle stages, and completes the session
   * Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 6.2, 6.8, 6.9
   * 
   * @param url Product URL to scrape
   * @param tenantId Tenant ID
   * @param _siteId Site ID (unused but required for interface compatibility)
   * @param _productId Product ID (unused but required for interface compatibility)
   * @param tenantName Optional tenant name for session tracking
   * @returns Scraped product data or null
   */
  async scrapeProductPageWithTracking(
    url: string,
    tenantId: string,
    _siteId: string,
    _productId: string,
    tenantName?: string
  ): Promise<ScrapedProduct | null> {
    try {
      await this.init();

      // Extract hostname for session tracking
      let siteUrl: string;
      let hostname: string;
      try {
        const urlObj = new URL(url);
        siteUrl = `${urlObj.protocol}//${urlObj.hostname}`;
        hostname = urlObj.hostname;
      } catch (error) {
        logger.error(`[ScraperService] Invalid URL: ${url}`, { error });

        // Requirement 6.5: Throw ExternalServiceError for invalid URLs
        throw new ExternalServiceError(
          'Unknown',
          'Invalid product URL provided',
          {
            cause: error as Error,
            context: {
              operation: 'scrapeProductPageWithTracking',
              tenantId,
              metadata: { url },
            },
            isRetryable: false,
          }
        );
      }

      // Get tenant name if not provided
      const displayTenantName = tenantName || tenantId;

      // Auto-clear completed/failed sessions for this tenant before starting new scraping
      // This ensures only fresh logs are shown for the new session
      try {
        const clearedCount = await sessionTracker.clearCompletedSessions(tenantId);
        if (clearedCount > 0) {
          logger.info(`[ScraperService] Auto-cleared ${clearedCount} completed/failed sessions for tenant ${tenantId}`);
        }
      } catch (error) {
        // Don't fail the scraping operation if clearing fails
        logger.warn(`[ScraperService] Failed to auto-clear sessions for tenant ${tenantId}`, { error });
      }

      // Create session for tracking
      // Requirement 2.1: Session initialization with target URL, proxy, and tenant info
      const sessionId = await sessionTracker.createSession(
        tenantId,
        displayTenantName,
        siteUrl,
        url
      );

      try {
        // Use RetryStrategy to handle retries with exponential backoff
        const result = await this.retryStrategy.executeWithRetry(
          async (context: RetryContext) => {
            return this._scrapeProductPageInternalWithTracking(url, context, sessionId);
          },
          (error: Error) => {
            // Record error in session
            sessionTracker.recordError(sessionId, error);

            // Maintain compatibility with existing ScrapeBlockError (Requirement 8.3)
            if (error instanceof ScrapeBlockError) {
              // Wrap ScrapeBlockError in ExternalServiceError for consistency
              const wrappedError = new ExternalServiceError(
                error.provider,
                `Scraping blocked by ${error.provider}`,
                {
                  cause: error,
                  context: {
                    operation: 'scrapeProductPageWithTracking',
                    tenantId,
                    metadata: { url, hostname, provider: error.provider, isAdvanced: error.isAdvanced },
                  },
                  isRetryable: true, // Requirement 9.1: Mark transient errors as retryable
                  retryAfter: 60,
                }
              );
              throw wrappedError;
            }

            // Use the RetryStrategy's error classification
            return this.retryStrategy.shouldRetryError(error);
          }
        );

        // Complete session successfully
        // Requirement 2.5: Session completion with final status and data quality metrics
        await sessionTracker.completeSession(sessionId, true, {
          extractedData: result,
        });

        return result;
      } catch (error) {
        // Record final error
        await sessionTracker.recordError(sessionId, error as Error);

        // Complete session with failure
        await sessionTracker.completeSession(sessionId, false);

        // Requirement 6.8: Include operation name in context
        // Requirement 6.9: Preserve original error as cause

        // If already an AppError, re-throw with additional context
        if (error instanceof AppError) {
          // Add tenant context if not already present
          if (!error.context.tenantId) {
            error.context.tenantId = tenantId;
          }
          if (!error.context.operation) {
            error.context.operation = 'scrapeProductPageWithTracking';
          }
          if (!error.context.metadata?.url) {
            error.context.metadata = { ...error.context.metadata, url, hostname };
          }
          throw error;
        }

        // Wrap unexpected errors in ExternalServiceError
        // Requirement 6.2: Wrap scraper errors in appropriate AppError subclass
        throw new ExternalServiceError(
          'Scraper',
          'Failed to scrape product page with tracking',
          {
            cause: error as Error,
            context: {
              operation: 'scrapeProductPageWithTracking',
              tenantId,
              metadata: { url, hostname },
            },
            isRetryable: this.isNetworkError(error), // Requirement 9.1: Mark network errors as retryable
          }
        );
      }
    } catch (error) {
      // Outer catch for initialization errors
      // Requirement 6.2: Wrap errors in appropriate AppError subclass
      if (error instanceof AppError) {
        throw error;
      }

      throw new ExternalServiceError(
        'Scraper',
        'Failed to initialize scraping with tracking',
        {
          cause: error as Error,
          context: {
            operation: 'scrapeProductPageWithTracking',
            tenantId,
            metadata: { url },
          },
          isRetryable: false,
        }
      );
    }
  }

  /**
   * Internal method to scrape a product page (single attempt)
   * Called by RetryStrategy with retry context for proxy/user agent rotation
   */
  private async _scrapeProductPageInternal(
    url: string,
    retryContext: RetryContext
  ): Promise<ScrapedProduct | null> {
    const proxyResult = await this.getNextProxy();
    const proxyUrl = proxyResult.url;
    const proxyConfig = proxyResult.config;
    // Rotate user agent on each retry attempt
    const userAgent = this.getNextUserAgent(retryContext.previousUserAgent);
    const proxy = proxyUrl ? { server: proxyUrl } : undefined;

    if (proxyUrl) {
      logger.info(`[ScraperService] Attempt ${retryContext.attempt} using proxy for ${url}: ${proxyUrl}`);
    }

    // Extract hostname for rate limiting
    let hostname: string;
    try {
      hostname = new URL(url).hostname;
    } catch (error) {
      logger.error(`[ScraperService] Invalid URL: ${url}`, { error });
      return null;
    }

    // Enforce rate limiting before acquiring browser context
    await siteProfileManager.waitForRateLimit(hostname);

    // Acquire concurrent request slot using ConcurrencyLimiter
    // Requirement 6.6
    await this.concurrencyLimiter.acquireSlot(hostname);

    // Acquire context from pool
    const startTime = Date.now();
    let context: any = null;
    let page: any = null;

    try {
      context = await this.browserPool.acquireContext(userAgent, proxy);
      page = await context.newPage();
    } catch (error) {
      logger.error(`[ScraperService] Failed to acquire context or create page for ${url}:`, { error });
      // Release concurrent slot before throwing
      this.concurrencyLimiter.releaseSlot(hostname);
      throw error; // Throw to trigger retry
    }

    // Cache Key
    const cacheKey = `product:${url}`;
    const cache = CacheService.getInstance();

    // 1. Try Cache (only on first attempt)
    if (retryContext.attempt === 1) {
      const cached = await cache.get<ScrapedProduct>(cacheKey);
      if (cached) {
        logger.info(`[ScraperService] ⚡ Cache hit for ${url}`);
        // Close page and release context (don't close context)
        if (page) {
          await page.close().catch(() => { });
        }
        await this.browserPool.releaseContext(context).catch(() => { });
        // Release concurrent slot
        this.concurrencyLimiter.releaseSlot(hostname);
        return cached;
      }
    }

    let wasBlocked = false;
    let wasChallenged = false;
    let statusCode = 0;

    try {
      const profile = getSiteProfile(hostname);

      // Session warmup if enabled
      if (profile.sessionWarmup?.enabled) {
        await this.performSessionWarmup(page, hostname, profile);
      }

      if (profile.strategy !== 'full-js') {
        try {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 5000);
          const preFlight = await fetch(url, { method: "HEAD", signal: controller.signal });
          clearTimeout(timeout);
          if (!preFlight.ok && preFlight.status !== 403 && preFlight.status !== 429) {
            logger.warn(`[Scraper] 🛑 Pre-flight failed: ${preFlight.status} for ${url}.`);
            return null;
          }
        } catch (e) {
          logger.warn(`[Scraper] Pre-flight net error: ${e}.`);
        }
      }

      // 1. Navigate with referrer chain if enabled
      const referrer = profile.referrerChain?.enabled ? siteProfileManager.getReferrer(hostname) : undefined;

      if (referrer) {
        await page.setExtraHTTPHeaders({ 'Referer': referrer });
      }

      const response = await page.goto(url, {
        waitUntil: profile.strategy === 'full-js' ? 'networkidle' : 'domcontentloaded',
        timeout: 30000,
      });

      // Track this navigation for future referrer chain
      if (profile.referrerChain?.enabled) {
        siteProfileManager.trackNavigation(hostname, url);
      }

      statusCode = response?.status() || 0;

      // Requirement 9.2: Throw RateLimitError for HTTP 429
      if (statusCode === 429) {
        // Extract retry-after header if available
        const retryAfterHeader = response?.headers()['retry-after'];
        const retryAfter = retryAfterHeader ? parseInt(retryAfterHeader, 10) : 60;

        throw new RateLimitError(
          profile.rateLimit?.requestsPerMinute || 10,
          60,
          {
            context: {
              operation: 'scrapeProductPage',
              metadata: { url, hostname, statusCode },
            },
            retryAfter,
          }
        );
      }

      // 2. Challenge Detection and Handling
      const challengeResult = await this.challengeHandler.detectChallenge(page);

      if (challengeResult.detected) {
        wasChallenged = true;
        logger.info(`[ScraperService] Challenge detected: ${challengeResult.type} on ${hostname}`);

        // Wait for challenge to complete
        const waitResult = await this.challengeHandler.waitForChallenge(page, 60000);

        // Record challenge attempt
        this.challengeHandler.recordChallengeAttempt(hostname, waitResult);

        if (!waitResult.solved) {
          wasBlocked = true;
          logger.warn(`[ScraperService] Challenge not solved for ${hostname}`);

          // Record metrics for failed challenge
          const responseTime = Date.now() - startTime;
          this.recordRequestMetrics(
            hostname,
            proxyUrl,
            userAgent,
            false, // success
            true,  // blocked
            true,  // challenged
            responseTime,
            statusCode
          );

          // Adjust concurrency based on metrics
          await this.adjustConcurrencyForSite(hostname, statusCode);

          // Check thresholds and log alerts
          this.metricsTracker.checkThresholds();

          // Record proxy failure if using ProxyManager
          if (proxyConfig && this.proxyManager) {
            this.proxyManager.recordFailure(proxyConfig, new Error(`Challenge not solved: ${waitResult.type}`));
          }

          // Check if fallback should be triggered
          if (this.challengeHandler.shouldTriggerFallback(hostname)) {
            logger.warn(`[ScraperService] Fallback strategy triggered for ${hostname}`);
          }

          // Update retry context for rotation
          retryContext.previousProxy = proxyUrl;
          retryContext.previousUserAgent = userAgent;

          throw new ScrapeBlockError(waitResult.type, url, true);
        }

        logger.info(`[ScraperService] Challenge solved successfully for ${hostname}`);
      }

      // 2.5. Captcha Detection and Solving
      // After challenge detection, check for captcha type
      // Requirements 4.1, 4.2, 4.3
      if (this.captchaSolver) {
        const captchaRequest = await this.captchaSolver.detectCaptchaType(page);

        if (captchaRequest) {
          logger.info(`[ScraperService] Captcha detected: ${captchaRequest.type} on ${hostname}`);

          // Attempt to solve captcha with retry logic (up to 3 attempts)
          // Requirement 4.4
          let captchaSolved = false;
          const maxCaptchaAttempts = 3;

          for (let captchaAttempt = 1; captchaAttempt <= maxCaptchaAttempts; captchaAttempt++) {
            logger.info(`[ScraperService] Attempting to solve captcha (attempt ${captchaAttempt}/${maxCaptchaAttempts})`);

            // Solve captcha using 2Captcha API
            // Requirement 4.1, 4.2
            const solveResult = await this.captchaSolver.solveCaptcha(captchaRequest, hostname);

            if (solveResult.success && solveResult.token) {
              logger.info(`[ScraperService] Captcha solved successfully in ${solveResult.solveTime}ms (cost: $${solveResult.cost.toFixed(4)})`);

              // Inject solution token into page
              // Requirement 4.3
              await this.captchaSolver.injectSolution(page, solveResult.token, captchaRequest.type);

              // Wait for page to reload/update after solution injection
              await page.waitForTimeout(2000);

              // Verify captcha was cleared by checking if it's still present
              const recheckCaptcha = await this.captchaSolver.detectCaptchaType(page);
              if (!recheckCaptcha) {
                captchaSolved = true;
                logger.info(`[ScraperService] Captcha cleared successfully`);

                // Record successful captcha solve as a challenge attempt
                // Requirement 10.1, 10.2
                this.challengeHandler.recordChallengeAttempt(hostname, {
                  detected: true,
                  type: captchaRequest.type as any,
                  solved: true,
                  attempts: captchaAttempt,
                  duration: solveResult.solveTime,
                });

                break;
              } else {
                logger.warn(`[ScraperService] Captcha still present after solution injection`);
              }
            } else {
              logger.warn(`[ScraperService] Captcha solve failed: ${solveResult.error}`);
            }
          }

          // If all captcha solve attempts failed, mark request as blocked
          // Requirement 4.4
          if (!captchaSolved) {
            wasBlocked = true;
            logger.error(`[ScraperService] All captcha solve attempts failed for ${hostname}`);

            // Record failed captcha solve as a challenge attempt
            // Requirement 10.1, 10.2
            this.challengeHandler.recordChallengeAttempt(hostname, {
              detected: true,
              type: captchaRequest.type as any,
              solved: false,
              attempts: maxCaptchaAttempts,
              duration: Date.now() - startTime,
            });

            // Record metrics for failed captcha
            const responseTime = Date.now() - startTime;
            this.recordRequestMetrics(
              hostname,
              proxyUrl,
              userAgent,
              false, // success
              true,  // blocked
              true,  // challenged
              responseTime,
              statusCode
            );

            // Adjust concurrency based on metrics
            await this.adjustConcurrencyForSite(hostname, statusCode);

            // Check thresholds and log alerts
            this.metricsTracker.checkThresholds();

            // Record proxy failure if using ProxyManager
            if (proxyConfig && this.proxyManager) {
              this.proxyManager.recordFailure(proxyConfig, new Error(`Captcha solve failed after ${maxCaptchaAttempts} attempts`));
            }

            // Update retry context for rotation
            retryContext.previousProxy = proxyUrl;
            retryContext.previousUserAgent = userAgent;

            throw new ScrapeBlockError('captcha', url, true);
          }
        }
      }

      // 3. Security Analysis
      const securityInfo = await this.analyzeSecurity(page, response);
      if (securityInfo.isBlocked) {
        wasBlocked = true;
        logger.warn(`[ScraperService] 🛡️ BLOCKED by ${securityInfo.provider} at ${url} (Attempt ${retryContext.attempt})`);

        // Record metrics for blocked request
        const responseTime = Date.now() - startTime;
        this.recordRequestMetrics(
          hostname,
          proxyUrl,
          userAgent,
          false, // success
          true,  // blocked
          wasChallenged,
          responseTime,
          statusCode
        );

        // Adjust concurrency based on metrics
        await this.adjustConcurrencyForSite(hostname, statusCode);

        // Check thresholds and log alerts
        this.metricsTracker.checkThresholds();

        // Record proxy failure if using ProxyManager
        if (proxyConfig && this.proxyManager) {
          this.proxyManager.recordFailure(proxyConfig, new Error(`Blocked by ${securityInfo.provider}`));
        }

        // Update retry context for rotation
        retryContext.previousProxy = proxyUrl;
        retryContext.previousUserAgent = userAgent;

        throw new ScrapeBlockError(securityInfo.provider, url, securityInfo.isAdvanced);
      }

      // 4. Enhanced Human Simulation
      logger.info(`[ScraperService] 🖱️ Performing enhanced human simulation for ${hostname}`);

      // Random pause before starting interactions
      await HumanSimulation.randomPause(300, 800);

      // Simulate natural mouse movement
      await HumanSimulation.simulateMouseMove(page);

      // Random pause between actions
      await HumanSimulation.randomPause(200, 600);

      // Simulate scrolling behavior
      await HumanSimulation.simulateScroll(page);

      // Random pause between actions
      await HumanSimulation.randomPause(300, 900);

      // Simulate tab focus to appear more human-like
      await HumanSimulation.simulateTabFocus(page);

      // Final random pause before extraction
      await HumanSimulation.randomPause(400, 1000);

      // Wait for profile specific time
      await page.waitForTimeout(profile.waitTime);

      // 5. Extraction Strategies
      // ... (JSON-LD, OG, CSS, Heuristics)
      const jsonLdData = await this.extractFromJsonLd(page);
      if (jsonLdData && jsonLdData.price > 0) {
        const result = {
          ...jsonLdData,
          url,
          specifications: this.parseSpecifications(jsonLdData.title, jsonLdData.specifications),
        };
        const validation = TechProductValidator.validateProduct(result);
        if (!validation.isValid) logger.warn(`[Scraper] Validation Warning: ${validation.errors.join(",")}`);
        await cache.set(cacheKey, result, profile.cacheTime);

        // Record successful metrics
        const responseTime = Date.now() - startTime;
        this.recordRequestMetrics(
          hostname,
          proxyUrl,
          userAgent,
          true,  // success
          false, // blocked
          wasChallenged,
          responseTime,
          statusCode
        );

        // Adjust concurrency based on metrics
        await this.adjustConcurrencyForSite(hostname, statusCode);

        // Record proxy success if using ProxyManager
        if (proxyConfig && this.proxyManager) {
          this.proxyManager.recordSuccess(proxyConfig, responseTime);
        }

        return result;
      }

      const ogData = await this.extractFromOpenGraph(page);
      if (ogData && ogData.price > 0) {
        const result = {
          ...ogData,
          url,
          specifications: this.parseSpecifications(ogData.title),
        };
        await cache.set(cacheKey, result, profile.cacheTime);

        // Record successful metrics
        const responseTime = Date.now() - startTime;
        this.recordRequestMetrics(
          hostname,
          proxyUrl,
          userAgent,
          true,  // success
          false, // blocked
          wasChallenged,
          responseTime,
          statusCode
        );

        // Adjust concurrency based on metrics
        await this.adjustConcurrencyForSite(hostname, statusCode);

        // Record proxy success if using ProxyManager
        if (proxyConfig && this.proxyManager) {
          this.proxyManager.recordSuccess(proxyConfig, responseTime);
        }

        return result;
      }

      const cssData = await this.extractFromSelectors(page);
      if (cssData && cssData.price > 0) {
        const result = {
          ...cssData,
          url,
          specifications: this.parseSpecifications(cssData.title),
        };
        await cache.set(cacheKey, result, profile.cacheTime);

        // Record successful metrics
        const responseTime = Date.now() - startTime;
        this.recordRequestMetrics(
          hostname,
          proxyUrl,
          userAgent,
          true,  // success
          false, // blocked
          wasChallenged,
          responseTime,
          statusCode
        );

        // Adjust concurrency based on metrics
        await this.adjustConcurrencyForSite(hostname, statusCode);

        // Record proxy success if using ProxyManager
        if (proxyConfig && this.proxyManager) {
          this.proxyManager.recordSuccess(proxyConfig, responseTime);
        }

        return result;
      }

      const heuristicData = await this.extractFromHeuristics(page);
      if (heuristicData && heuristicData.price > 0) {
        const result = {
          ...heuristicData,
          url,
          specifications: this.parseSpecifications(heuristicData.title),
        };
        await cache.set(cacheKey, result, profile.cacheTime);

        // Record successful metrics
        const responseTime = Date.now() - startTime;
        this.recordRequestMetrics(
          hostname,
          proxyUrl,
          userAgent,
          true,  // success
          false, // blocked
          wasChallenged,
          responseTime,
          statusCode
        );

        // Adjust concurrency based on metrics
        await this.adjustConcurrencyForSite(hostname, statusCode);

        // Record proxy success if using ProxyManager
        if (proxyConfig && this.proxyManager) {
          this.proxyManager.recordSuccess(proxyConfig, responseTime);
        }

        return result;
      }

      // No data extracted - record as failed request
      const responseTime = Date.now() - startTime;
      this.recordRequestMetrics(
        hostname,
        proxyUrl,
        userAgent,
        false, // success
        false, // blocked
        wasChallenged,
        responseTime,
        statusCode
      );

      // Adjust concurrency based on metrics
      await this.adjustConcurrencyForSite(hostname, statusCode);

      return null;
    } catch (error) {
      // Record metrics for error
      const errorResponseTime = Date.now() - startTime;
      this.recordRequestMetrics(
        hostname,
        proxyUrl,
        userAgent,
        false, // success
        wasBlocked,
        wasChallenged,
        errorResponseTime,
        statusCode
      );

      // Adjust concurrency based on metrics
      await this.adjustConcurrencyForSite(hostname, statusCode);

      // Check thresholds and log alerts
      this.metricsTracker.checkThresholds();

      // Record proxy failure if using ProxyManager
      if (proxyConfig && this.proxyManager && !(error instanceof ScrapeBlockError)) {
        this.proxyManager.recordFailure(proxyConfig, error as Error);
      }

      // Update retry context for rotation
      retryContext.previousProxy = proxyUrl;
      retryContext.previousUserAgent = userAgent;

      throw error; // Re-throw to let RetryStrategy handle it
    } finally {
      // Close page first, then release context (don't close context)
      if (page) {
        await page.close().catch((err: Error) => {
          logger.warn(`[ScraperService] Failed to close page for ${url}:`, { error: err });
        });
      }

      if (context) {
        await this.browserPool.releaseContext(context).catch((err: Error) => {
          logger.warn(`[ScraperService] Failed to release context for ${url}:`, { error: err });
        });
      }

      // Release concurrent request slot
      this.concurrencyLimiter.releaseSlot(hostname);
    }
  }

  /**
   * Internal method to scrape a product page with session tracking (single attempt)
   * Called by RetryStrategy with retry context for proxy/user agent rotation
   * Tracks all lifecycle stages in the session
   * Requirements: 2.1, 2.2, 2.3, 2.4, 2.5
   */
  private async _scrapeProductPageInternalWithTracking(
    url: string,
    retryContext: RetryContext,
    sessionId: string
  ): Promise<ScrapedProduct | null> {
    const navigationStartTime = Date.now();

    // Requirement 2.1: Track proxy selection
    const proxyResult = await this.getNextProxy();
    const proxyUrl = proxyResult.url;
    const proxyConfig = proxyResult.config;

    // Rotate user agent on each retry attempt
    const userAgent = this.getNextUserAgent(retryContext.previousUserAgent);
    const proxy = proxyUrl ? { server: proxyUrl } : undefined;

    // Update session with proxy selection
    await sessionTracker.updateStage(sessionId, 'proxy_selection', {
      proxy: proxyUrl || 'direct',
      userAgent,
    });

    if (proxyUrl) {
      logger.info(`[ScraperService] Attempt ${retryContext.attempt} using proxy for ${url}: ${proxyUrl}`);
    }

    // Extract hostname for rate limiting
    let hostname: string;
    try {
      hostname = new URL(url).hostname;
    } catch (error) {
      logger.error(`[ScraperService] Invalid URL: ${url}`, { error });
      await sessionTracker.recordError(sessionId, error as Error);
      return null;
    }

    // Enforce rate limiting before acquiring browser context
    await siteProfileManager.waitForRateLimit(hostname);

    // Acquire concurrent request slot using ConcurrencyLimiter
    await this.concurrencyLimiter.acquireSlot(hostname);

    // Acquire context from pool
    const startTime = Date.now();
    let context: any = null;
    let page: any = null;

    try {
      context = await this.browserPool.acquireContext(userAgent, proxy);
      page = await context.newPage();
    } catch (error) {
      logger.error(`[ScraperService] Failed to acquire context or create page for ${url}:`, { error });
      await sessionTracker.recordError(sessionId, error as Error);
      // Release concurrent slot before throwing
      this.concurrencyLimiter.releaseSlot(hostname);
      throw error; // Throw to trigger retry
    }

    // Cache Key
    const cacheKey = `product:${url}`;
    const cache = CacheService.getInstance();

    // 1. Try Cache (only on first attempt)
    if (retryContext.attempt === 1) {
      const cached = await cache.get<ScrapedProduct>(cacheKey);
      if (cached) {
        logger.info(`[ScraperService] ⚡ Cache hit for ${url}`);
        // Close page and release context
        if (page) {
          await page.close().catch(() => { });
        }
        await this.browserPool.releaseContext(context).catch(() => { });
        // Release concurrent slot
        this.concurrencyLimiter.releaseSlot(hostname);
        return cached;
      }
    }

    let wasBlocked = false;
    let wasChallenged = false;
    let statusCode = 0;
    let challengeSolveStartTime = 0;
    let extractionStartTime = 0;

    try {
      const profile = getSiteProfile(hostname);

      // Session warmup if enabled
      if (profile.sessionWarmup?.enabled) {
        await this.performSessionWarmup(page, hostname, profile);
      }

      if (profile.strategy !== 'full-js') {
        try {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 5000);
          const preFlight = await fetch(url, { method: "HEAD", signal: controller.signal });
          clearTimeout(timeout);
          if (!preFlight.ok && preFlight.status !== 403 && preFlight.status !== 429) {
            logger.warn(`[Scraper] 🛑 Pre-flight failed: ${preFlight.status} for ${url}.`);
            return null;
          }
        } catch (e) {
          logger.warn(`[Scraper] Pre-flight net error: ${e}.`);
        }
      }

      // Requirement 2.2: Track navigation
      await sessionTracker.updateStage(sessionId, 'navigation', {
        requestsCompleted: 0,
        requestsTotal: 1,
      });

      // 1. Navigate with referrer chain if enabled
      const referrer = profile.referrerChain?.enabled ? siteProfileManager.getReferrer(hostname) : undefined;

      if (referrer) {
        await page.setExtraHTTPHeaders({ 'Referer': referrer });
      }

      const response = await page.goto(url, {
        waitUntil: profile.strategy === 'full-js' ? 'networkidle' : 'domcontentloaded',
        timeout: 30000,
      });

      const navigationTime = Date.now() - navigationStartTime;

      // Track this navigation for future referrer chain
      if (profile.referrerChain?.enabled) {
        siteProfileManager.trackNavigation(hostname, url);
      }

      statusCode = response?.status() || 0;

      // Requirement 9.2: Throw RateLimitError for HTTP 429
      if (statusCode === 429) {
        // Extract retry-after header if available
        const retryAfterHeader = response?.headers()['retry-after'];
        const retryAfter = retryAfterHeader ? parseInt(retryAfterHeader, 10) : 60;

        throw new RateLimitError(
          profile.rateLimit?.requestsPerMinute || 10,
          60,
          {
            context: {
              operation: 'scrapeProductPageWithTracking',
              metadata: { url, hostname, statusCode },
            },
            retryAfter,
          }
        );
      }

      // Update session with navigation complete
      await sessionTracker.updateStage(sessionId, 'navigation', {
        requestsCompleted: 1,
        requestsTotal: 1,
        metrics: { navigationTime },
      });

      // Requirement 2.3: Track challenge detection
      const challengeResult = await this.challengeHandler.detectChallenge(page);

      if (challengeResult.detected) {
        wasChallenged = true;
        challengeSolveStartTime = Date.now();

        logger.info(`[ScraperService] Challenge detected: ${challengeResult.type} on ${hostname}`);

        // Update session with challenge detection
        await sessionTracker.updateStage(sessionId, 'challenge_detection', {
          challengeType: challengeResult.type,
          challengeStatus: 'waiting',
        });

        // Wait for challenge to complete
        await sessionTracker.updateStage(sessionId, 'challenge_solving', {
          challengeType: challengeResult.type,
          challengeStatus: 'solving',
        });

        const waitResult = await this.challengeHandler.waitForChallenge(page, 60000);

        const challengeSolveTime = Date.now() - challengeSolveStartTime;

        // Record challenge attempt
        this.challengeHandler.recordChallengeAttempt(hostname, waitResult);

        if (!waitResult.solved) {
          wasBlocked = true;
          logger.warn(`[ScraperService] Challenge not solved for ${hostname}`);

          // Update session with failed challenge
          await sessionTracker.updateStage(sessionId, 'challenge_solving', {
            challengeType: waitResult.type,
            challengeStatus: 'failed',
            metrics: { challengeSolveTime },
          });

          // Record metrics for failed challenge
          const responseTime = Date.now() - startTime;
          this.recordRequestMetrics(
            hostname,
            proxyUrl,
            userAgent,
            false, // success
            true,  // blocked
            true,  // challenged
            responseTime,
            statusCode
          );

          // Adjust concurrency based on metrics
          await this.adjustConcurrencyForSite(hostname, statusCode);

          // Check thresholds and log alerts
          this.metricsTracker.checkThresholds();

          // Record proxy failure if using ProxyManager
          if (proxyConfig && this.proxyManager) {
            this.proxyManager.recordFailure(proxyConfig, new Error(`Challenge not solved: ${waitResult.type}`));
          }

          // Check if fallback should be triggered
          if (this.challengeHandler.shouldTriggerFallback(hostname)) {
            logger.warn(`[ScraperService] Fallback strategy triggered for ${hostname}`);
          }

          // Update retry context for rotation
          retryContext.previousProxy = proxyUrl;
          retryContext.previousUserAgent = userAgent;

          throw new ScrapeBlockError(waitResult.type, url, true);
        }

        // Update session with solved challenge
        await sessionTracker.updateStage(sessionId, 'challenge_solving', {
          challengeType: waitResult.type,
          challengeStatus: 'solved',
          metrics: { challengeSolveTime },
        });

        logger.info(`[ScraperService] Challenge solved successfully for ${hostname}`);
      }

      // 2.5. Captcha Detection and Solving
      if (this.captchaSolver) {
        const captchaRequest = await this.captchaSolver.detectCaptchaType(page);

        if (captchaRequest) {
          wasChallenged = true;
          challengeSolveStartTime = Date.now();

          logger.info(`[ScraperService] Captcha detected: ${captchaRequest.type} on ${hostname}`);

          // Update session with captcha detection
          await sessionTracker.updateStage(sessionId, 'challenge_detection', {
            challengeType: captchaRequest.type,
            challengeStatus: 'waiting',
          });

          // Attempt to solve captcha with retry logic (up to 3 attempts)
          let captchaSolved = false;
          const maxCaptchaAttempts = 3;

          await sessionTracker.updateStage(sessionId, 'challenge_solving', {
            challengeType: captchaRequest.type,
            challengeStatus: 'solving',
          });

          for (let captchaAttempt = 1; captchaAttempt <= maxCaptchaAttempts; captchaAttempt++) {
            logger.info(`[ScraperService] Attempting to solve captcha (attempt ${captchaAttempt}/${maxCaptchaAttempts})`);

            // Solve captcha using 2Captcha API
            const solveResult = await this.captchaSolver.solveCaptcha(captchaRequest, hostname);

            if (solveResult.success && solveResult.token) {
              logger.info(`[ScraperService] Captcha solved successfully in ${solveResult.solveTime}ms (cost: ${solveResult.cost.toFixed(4)})`);

              // Inject solution token into page
              await this.captchaSolver.injectSolution(page, solveResult.token, captchaRequest.type);

              // Wait for page to reload/update after solution injection
              await page.waitForTimeout(2000);

              // Verify captcha was cleared by checking if it's still present
              const recheckCaptcha = await this.captchaSolver.detectCaptchaType(page);
              if (!recheckCaptcha) {
                captchaSolved = true;
                const challengeSolveTime = Date.now() - challengeSolveStartTime;

                logger.info(`[ScraperService] Captcha cleared successfully`);

                // Update session with solved captcha
                await sessionTracker.updateStage(sessionId, 'challenge_solving', {
                  challengeType: captchaRequest.type,
                  challengeStatus: 'solved',
                  metrics: { challengeSolveTime },
                });

                // Record successful captcha solve as a challenge attempt
                this.challengeHandler.recordChallengeAttempt(hostname, {
                  detected: true,
                  type: captchaRequest.type as any,
                  solved: true,
                  attempts: captchaAttempt,
                  duration: solveResult.solveTime,
                });

                break;
              } else {
                logger.warn(`[ScraperService] Captcha still present after solution injection`);
              }
            } else {
              logger.warn(`[ScraperService] Captcha solve failed: ${solveResult.error}`);
            }
          }

          // If all captcha solve attempts failed, mark request as blocked
          if (!captchaSolved) {
            wasBlocked = true;
            const challengeSolveTime = Date.now() - challengeSolveStartTime;

            logger.error(`[ScraperService] All captcha solve attempts failed for ${hostname}`);

            // Update session with failed captcha
            await sessionTracker.updateStage(sessionId, 'challenge_solving', {
              challengeType: captchaRequest.type,
              challengeStatus: 'failed',
              metrics: { challengeSolveTime },
            });

            // Record failed captcha solve as a challenge attempt
            this.challengeHandler.recordChallengeAttempt(hostname, {
              detected: true,
              type: captchaRequest.type as any,
              solved: false,
              attempts: maxCaptchaAttempts,
              duration: Date.now() - startTime,
            });

            // Record metrics for failed captcha
            const responseTime = Date.now() - startTime;
            this.recordRequestMetrics(
              hostname,
              proxyUrl,
              userAgent,
              false, // success
              true,  // blocked
              true,  // challenged
              responseTime,
              statusCode
            );

            // Adjust concurrency based on metrics
            await this.adjustConcurrencyForSite(hostname, statusCode);

            // Check thresholds and log alerts
            this.metricsTracker.checkThresholds();

            // Record proxy failure if using ProxyManager
            if (proxyConfig && this.proxyManager) {
              this.proxyManager.recordFailure(proxyConfig, new Error(`Captcha solve failed after ${maxCaptchaAttempts} attempts`));
            }

            // Update retry context for rotation
            retryContext.previousProxy = proxyUrl;
            retryContext.previousUserAgent = userAgent;

            throw new ScrapeBlockError('captcha', url, true);
          }
        }
      }

      // 3. Security Analysis
      const securityInfo = await this.analyzeSecurity(page, response);
      if (securityInfo.isBlocked) {
        wasBlocked = true;
        logger.warn(`[ScraperService] 🛡️ BLOCKED by ${securityInfo.provider} at ${url} (Attempt ${retryContext.attempt})`);

        // Record metrics for blocked request
        const responseTime = Date.now() - startTime;
        this.recordRequestMetrics(
          hostname,
          proxyUrl,
          userAgent,
          false, // success
          true,  // blocked
          wasChallenged,
          responseTime,
          statusCode
        );

        // Adjust concurrency based on metrics
        await this.adjustConcurrencyForSite(hostname, statusCode);

        // Check thresholds and log alerts
        this.metricsTracker.checkThresholds();

        // Record proxy failure if using ProxyManager
        if (proxyConfig && this.proxyManager) {
          this.proxyManager.recordFailure(proxyConfig, new Error(`Blocked by ${securityInfo.provider}`));
        }

        // Update retry context for rotation
        retryContext.previousProxy = proxyUrl;
        retryContext.previousUserAgent = userAgent;

        throw new ScrapeBlockError(securityInfo.provider, url, securityInfo.isAdvanced);
      }

      // 4. Enhanced Human Simulation
      logger.info(`[ScraperService] 🖱️ Performing enhanced human simulation for ${hostname}`);

      // Random pause before starting interactions
      await HumanSimulation.randomPause(300, 800);

      // Simulate natural mouse movement
      await HumanSimulation.simulateMouseMove(page);

      // Random pause between actions
      await HumanSimulation.randomPause(200, 600);

      // Simulate scrolling behavior
      await HumanSimulation.simulateScroll(page);

      // Random pause between actions
      await HumanSimulation.randomPause(300, 900);

      // Simulate tab focus to appear more human-like
      await HumanSimulation.simulateTabFocus(page);

      // Final random pause before extraction
      await HumanSimulation.randomPause(400, 1000);

      // Wait for profile specific time
      await page.waitForTimeout(profile.waitTime);

      // Requirement 2.4: Track data extraction
      extractionStartTime = Date.now();
      await sessionTracker.updateStage(sessionId, 'data_extraction');

      // 5. Extraction Strategies
      const jsonLdData = await this.extractFromJsonLd(page);
      if (jsonLdData && jsonLdData.price > 0) {
        const extractionTime = Date.now() - extractionStartTime;
        const result = {
          ...jsonLdData,
          url,
          specifications: this.parseSpecifications(jsonLdData.title, jsonLdData.specifications),
        };
        const validation = TechProductValidator.validateProduct(result);
        if (!validation.isValid) logger.warn(`[Scraper] Validation Warning: ${validation.errors.join(",")}`);
        await cache.set(cacheKey, result, profile.cacheTime);

        // Update session with extraction complete
        await sessionTracker.updateStage(sessionId, 'validation', {
          extractedData: result,
          metrics: { extractionTime },
        });

        // Record successful metrics
        const responseTime = Date.now() - startTime;
        this.recordRequestMetrics(
          hostname,
          proxyUrl,
          userAgent,
          true,  // success
          false, // blocked
          wasChallenged,
          responseTime,
          statusCode
        );

        // Adjust concurrency based on metrics
        await this.adjustConcurrencyForSite(hostname, statusCode);

        // Record proxy success if using ProxyManager
        if (proxyConfig && this.proxyManager) {
          this.proxyManager.recordSuccess(proxyConfig, responseTime);
        }

        return result;
      }

      const ogData = await this.extractFromOpenGraph(page);
      if (ogData && ogData.price > 0) {
        const extractionTime = Date.now() - extractionStartTime;
        const result = {
          ...ogData,
          url,
          specifications: this.parseSpecifications(ogData.title),
        };
        await cache.set(cacheKey, result, profile.cacheTime);

        // Update session with extraction complete
        await sessionTracker.updateStage(sessionId, 'validation', {
          extractedData: result,
          metrics: { extractionTime },
        });

        // Record successful metrics
        const responseTime = Date.now() - startTime;
        this.recordRequestMetrics(
          hostname,
          proxyUrl,
          userAgent,
          true,  // success
          false, // blocked
          wasChallenged,
          responseTime,
          statusCode
        );

        // Adjust concurrency based on metrics
        await this.adjustConcurrencyForSite(hostname, statusCode);

        // Record proxy success if using ProxyManager
        if (proxyConfig && this.proxyManager) {
          this.proxyManager.recordSuccess(proxyConfig, responseTime);
        }

        return result;
      }

      const cssData = await this.extractFromSelectors(page);
      if (cssData && cssData.price > 0) {
        const extractionTime = Date.now() - extractionStartTime;
        const result = {
          ...cssData,
          url,
          specifications: this.parseSpecifications(cssData.title),
        };
        await cache.set(cacheKey, result, profile.cacheTime);

        // Update session with extraction complete
        await sessionTracker.updateStage(sessionId, 'validation', {
          extractedData: result,
          metrics: { extractionTime },
        });

        // Record successful metrics
        const responseTime = Date.now() - startTime;
        this.recordRequestMetrics(
          hostname,
          proxyUrl,
          userAgent,
          true,  // success
          false, // blocked
          wasChallenged,
          responseTime,
          statusCode
        );

        // Adjust concurrency based on metrics
        await this.adjustConcurrencyForSite(hostname, statusCode);

        // Record proxy success if using ProxyManager
        if (proxyConfig && this.proxyManager) {
          this.proxyManager.recordSuccess(proxyConfig, responseTime);
        }

        return result;
      }

      const heuristicData = await this.extractFromHeuristics(page);
      if (heuristicData && heuristicData.price > 0) {
        const extractionTime = Date.now() - extractionStartTime;
        const result = {
          ...heuristicData,
          url,
          specifications: this.parseSpecifications(heuristicData.title),
        };
        await cache.set(cacheKey, result, profile.cacheTime);

        // Update session with extraction complete
        await sessionTracker.updateStage(sessionId, 'validation', {
          extractedData: result,
          metrics: { extractionTime },
        });

        // Record successful metrics
        const responseTime = Date.now() - startTime;
        this.recordRequestMetrics(
          hostname,
          proxyUrl,
          userAgent,
          true,  // success
          false, // blocked
          wasChallenged,
          responseTime,
          statusCode
        );

        // Adjust concurrency based on metrics
        await this.adjustConcurrencyForSite(hostname, statusCode);

        // Record proxy success if using ProxyManager
        if (proxyConfig && this.proxyManager) {
          this.proxyManager.recordSuccess(proxyConfig, responseTime);
        }

        return result;
      }

      // No data extracted - record as failed request
      const responseTime = Date.now() - startTime;
      this.recordRequestMetrics(
        hostname,
        proxyUrl,
        userAgent,
        false, // success
        false, // blocked
        wasChallenged,
        responseTime,
        statusCode
      );

      // Adjust concurrency based on metrics
      await this.adjustConcurrencyForSite(hostname, statusCode);

      return null;
    } catch (error) {
      // Requirement 2.5: Track errors
      await sessionTracker.recordError(sessionId, error as Error);

      // Record metrics for error
      const errorResponseTime = Date.now() - startTime;
      this.recordRequestMetrics(
        hostname,
        proxyUrl,
        userAgent,
        false, // success
        wasBlocked,
        wasChallenged,
        errorResponseTime,
        statusCode
      );

      // Adjust concurrency based on metrics
      await this.adjustConcurrencyForSite(hostname, statusCode);

      // Check thresholds and log alerts
      this.metricsTracker.checkThresholds();

      // Record proxy failure if using ProxyManager
      if (proxyConfig && this.proxyManager && !(error instanceof ScrapeBlockError)) {
        this.proxyManager.recordFailure(proxyConfig, error as Error);
      }

      // Update retry context for rotation
      retryContext.previousProxy = proxyUrl;
      retryContext.previousUserAgent = userAgent;

      throw error; // Re-throw to let RetryStrategy handle it
    } finally {
      // Close page first, then release context (don't close context)
      if (page) {
        await page.close().catch((err: Error) => {
          logger.warn(`[ScraperService] Failed to close page for ${url}:`, { error: err });
        });
      }

      if (context) {
        await this.browserPool.releaseContext(context).catch((err: Error) => {
          logger.warn(`[ScraperService] Failed to release context for ${url}:`, { error: err });
        });
      }

      // Release concurrent request slot
      this.concurrencyLimiter.releaseSlot(hostname);
    }
  }

  /**
   * Perform session warmup by visiting homepage and configured paths
   * This makes the scraping session appear more natural
   */
  private async performSessionWarmup(page: Page, hostname: string, profile: any): Promise<void> {
    // Skip warmup if disabled via environment variable
    if (process.env.SCRAPING_ENABLE_WARMUP === 'false') {
      logger.info(`[ScraperService] ⏭️  Skipping session warmup for ${hostname} (disabled via env)`);
      return;
    }

    try {
      logger.info(`[ScraperService] 🔥 Performing session warmup for ${hostname}`);

      const protocol = page.url().startsWith('https') ? 'https' : 'http';
      const baseUrl = `${protocol}://${hostname}`;

      // Visit homepage if configured
      if (profile.sessionWarmup.visitHomepage) {
        const homepageUrl = profile.referrerChain?.startUrl || baseUrl;

        await page.goto(homepageUrl, {
          waitUntil: 'domcontentloaded',
          timeout: 15000
        }).catch((error) => {
          logger.warn(`[ScraperService] Homepage warmup failed: ${error.message}`);
        });

        // Track navigation for referrer chain
        if (profile.referrerChain?.enabled) {
          siteProfileManager.trackNavigation(hostname, homepageUrl);
        }

        // Realistic delay after homepage visit
        await HumanSimulation.randomPause(1000, 3000);

        // Simulate some human behavior on homepage
        await HumanSimulation.simulateMouseMove(page).catch(() => { });
        await HumanSimulation.randomPause(500, 1500);
        await HumanSimulation.simulateScroll(page).catch(() => { });
        await HumanSimulation.randomPause(800, 2000);
      }

      // Visit additional warmup paths if configured
      if (profile.sessionWarmup.visitPaths && profile.sessionWarmup.visitPaths.length > 0) {
        for (const path of profile.sessionWarmup.visitPaths) {
          const warmupUrl = `${baseUrl}${path}`;

          await page.goto(warmupUrl, {
            waitUntil: 'domcontentloaded',
            timeout: 15000
          }).catch((error) => {
            logger.warn(`[ScraperService] Warmup path ${path} failed: ${error.message}`);
          });

          // Track navigation for referrer chain
          if (profile.referrerChain?.enabled) {
            siteProfileManager.trackNavigation(hostname, warmupUrl);
          }

          // Realistic delay between warmup pages
          await HumanSimulation.randomPause(1500, 3500);

          // Simulate human behavior
          await HumanSimulation.simulateMouseMove(page).catch(() => { });
          await HumanSimulation.randomPause(400, 1000);
        }
      }

      logger.info(`[ScraperService] ✅ Session warmup completed for ${hostname}`);
    } catch (error) {
      logger.warn(`[ScraperService] Session warmup error for ${hostname}:`, { error });
      // Don't fail the scraping if warmup fails
    }
  }

  /**
   * Identifies anti-bot protection and security providers
   */
  /**
   * Helper to parse tech specs from title or extra data
   * (RAM, Storage, etc.)
   */
  private parseSpecifications(title: string, rawSpecs?: Record<string, string>): Record<string, string> {
    const specs: Record<string, string> = { ...rawSpecs };
    // 1. RAM Logic (e.g. 8GB, 16GB)
    if (!specs.ram) {
      const ramCheck = title.match(/(\d{1,3})\s*(GB)\s*(RAM|DDR\d|Memory)/i);
      if (ramCheck) {
        specs.ram = `${ramCheck[1]}GB`;
      } else {
        const simpleRam = title.match(/\b(\d{1,3})\s*GB\b/i);
        if (simpleRam) {
          const val = parseInt(simpleRam[1]);
          if (val <= 64) specs.ram = `${val}GB`;
        }
      }
    }
    // 2. Storage Logic (e.g. 256GB SSD)
    if (!specs.storage) {
      const storageMatch = title.match(/(\d{1,4})\s*(GB|TB)\s*(SSD|HDD|NVMe|Gen4)/i);
      if (storageMatch) {
        let val = storageMatch[1];
        let unit = storageMatch[2].toUpperCase();
        specs.storage = `${val}${unit}`;
        if (storageMatch[3]) specs.storage += ` ${storageMatch[3]}`;
      }
    }
    // 3. Processor Logic
    if (!specs.processor) {
      const procMatch = title.match(/(core\s*i\d|ryzen\s*\d|m1|m2|m3|celeron|pentium)/i);
      if (procMatch) {
        specs.processor = procMatch[0].replace(/\s+/g, " ");
      }
    }
    return specs;
  }

  /**
   * Identifies anti-bot protection and security providers
   */
  private async analyzeSecurity(page: Page, response: any) {
    const status = response?.status ? response.status() : null;
    const title = (await page.title()).toLowerCase();
    const content = (await page.content()).toLowerCase();

    // Safely extract headers - handle both real responses and mocks
    let headers: Record<string, string> = {};
    try {
      if (response?.headers && typeof response.headers === 'function') {
        headers = response.headers() || {};
      } else if (response?.headers && typeof response.headers === 'object') {
        headers = response.headers;
      }
    } catch {
      headers = {};
    }

    let provider = "NONE";
    let isBlocked = false;
    let isAdvanced = false;

    const captchaKeywords = ["captcha", "verify you are human", "robot check", "hcaptcha", "recaptcha"];
    const accessDeniedKeywords = ["access denied", "permission denied", "forbidden", "blocked"];

    const hasCaptcha = captchaKeywords.some(kw => content.includes(kw) || title.includes(kw));
    const hasAccessDenied = accessDeniedKeywords.some(kw => content.includes(kw) || title.includes(kw));

    if (title.includes("cloudflare") || content.includes("cf-browser-verification") || headers['server'] === 'cloudflare') {
      provider = "CLOUDFLARE";
      if (status === 403 || status === 503 || title.includes("just a moment")) isBlocked = true;
      isAdvanced = true; // Cloudflare is always treated as advanced
    } else if (content.includes("perimeterx") || content.includes("px-captcha")) {
      provider = "PERIMETERX";
      isBlocked = true;
      isAdvanced = true;
    } else if (content.includes("datadome") || headers['x-datadome-response']) {
      provider = "DATADOME";
      isBlocked = status === 403;
      isAdvanced = true;
    } else if (status === 403 || status === 429 || hasCaptcha || hasAccessDenied) {
      provider = hasCaptcha ? "CAPTCHA" : (hasAccessDenied ? "ACCESS_DENIED" : "GENERIC_WA_BLOCK");
      isBlocked = true;
      isAdvanced = true;
    } else if (status === 200 && (title.includes("trusted retail computer store") || title === "techland bd")) {
      // SILENT BLOCK: Redirected to Home page but status is 200
      const currentUrl = page.url();
      if (currentUrl.includes("search") || currentUrl.includes("route=")) {
        provider = "SILENT_HOME_REDIRECT";
        isBlocked = true;
        isAdvanced = true;
      }
    }

    return { provider, isBlocked, isAdvanced, status };
  }

  /**
   * Dynamic Heuristic Extraction: Analyzes the page to find product data without static selectors
   */
  private async extractFromHeuristics(page: Page): Promise<Omit<ScrapedProduct, "url"> | null> {
    try {
      return await page.evaluate(() => {
        // 1. Find Title: Usually the largest <h1> or <h2> tag in the top 50% of the page
        const headings = Array.from(document.querySelectorAll('h1, h2'));
        let bestTitle = "";
        let maxFontSize = 0;

        for (const h of headings) {
          const style = window.getComputedStyle(h);
          const size = parseFloat(style.fontSize);
          const text = h.textContent?.trim() || "";

          // Exclude nav symbols, menus, etc.
          if (text.length > 10 && text.length < 200 && size > maxFontSize) {
            const rect = h.getBoundingClientRect();
            if (rect.top < window.innerHeight * 0.8) { // Must be in visible-ish upper area
              bestTitle = text;
              maxFontSize = size;
            }
          }
        }

        // 2. Find Price: Look for text containing currency symbols or "৳", "TK", "$"
        // Score elements by their proximity to the title and visual prominence
        const allElements = Array.from(document.querySelectorAll('span, div, b, p, strong, td'));
        const pricePattern = /([৳\$]|TK|BDT)\s?([\d,]+\.?\d*)|([\d,]+\.?\d*)\s?([৳\$]|TK|BDT)/i;

        let bestPriceMatch: string | null = null;
        let highestPriceScore = 0;

        for (const el of allElements) {
          const text = el.textContent?.trim() || "";
          if (text.length < 30 && pricePattern.test(text)) {
            // Calculate a visibility/proximity score
            const style = window.getComputedStyle(el);
            if (style.display === 'none' || style.visibility === 'hidden') continue;

            let score = parseFloat(style.fontSize) || 12;

            // Bold price is better
            if (style.fontWeight === 'bold' || parseInt(style.fontWeight) >= 600) score += 10;
            // Primary colored price (usually red or orange in BD) is better
            if (style.color.includes('rgb(2') || style.color.includes('rgb(1')) score += 5;

            if (score > highestPriceScore) {
              highestPriceScore = score;
              bestPriceMatch = text;
            }
          }
        }

        if (!bestTitle || !bestPriceMatch) return null;

        // Extract numbers only for price
        const numericPrice = parseFloat(bestPriceMatch.replace(/[^0-9.]/g, ''));

        return {
          title: bestTitle,
          price: numericPrice || 0,
          currency: "BDT",
          inStock: true, // Default to true if title/price found
          imageUrl: undefined
        };
      });
    } catch (e) {
      return null;
    }
  }

  /**
   * Extract product data from JSON-LD structured data
   */
  private async extractFromJsonLd(
    page: Page,
  ): Promise<Omit<ScrapedProduct, "url"> | null> {
    try {
      const jsonLd = await page.evaluate(() => {
        const scripts = Array.from(
          document.querySelectorAll('script[type="application/ld+json"]'),
        );
        for (const script of scripts) {
          try {
            const data = JSON.parse(script.textContent || "");
            if (
              data["@type"] === "Product" ||
              data["@type"]?.includes("Product")
            ) {
              return data;
            }
          } catch (e) {
            continue;
          }
        }
        return null;
      });

      if (!jsonLd) return null;

      const price = parseFloat(
        jsonLd.offers?.price || jsonLd.offers?.[0]?.price || "0",
      );

      return {
        title: jsonLd.name || "",
        price,
        currency:
          jsonLd.offers?.priceCurrency ||
          jsonLd.offers?.[0]?.priceCurrency ||
          "USD",
        sku: jsonLd.sku || jsonLd.gtin || undefined,
        brand: jsonLd.brand?.name || jsonLd.brand || undefined,
        model: jsonLd.model || undefined,
        inStock:
          jsonLd.offers?.availability?.includes("InStock") ||
          jsonLd.offers?.[0]?.availability?.includes("InStock") ||
          true,
        imageUrl: jsonLd.image?.[0] || jsonLd.image || undefined,
      };
    } catch (error) {
      return null;
    }
  }

  /**
   * Extract product data from OpenGraph meta tags
   */
  private async extractFromOpenGraph(
    page: Page,
  ): Promise<Omit<ScrapedProduct, "url"> | null> {
    try {
      const ogData = await page.evaluate(() => {
        const getMeta = (property: string) => {
          const meta = document.querySelector(`meta[property="${property}"]`);
          return meta?.getAttribute("content") || "";
        };

        return {
          title: getMeta("og:title") || getMeta("product:title"),
          price: getMeta("product:price:amount") || getMeta("og:price:amount"),
          currency:
            getMeta("product:price:currency") || getMeta("og:price:currency"),
          brand: getMeta("product:brand"),
          availability:
            getMeta("og:availability") ||
            getMeta("product:availability") ||
            getMeta("product:availability:status"),
          image: getMeta("og:image") || getMeta("product:image"),
        };
      });

      if (!ogData.title || !ogData.price) return null;

      return {
        title: ogData.title,
        price: parseFloat(ogData.price),
        currency: ogData.currency || "USD",
        brand: ogData.brand || undefined,
        inStock:
          ogData.availability !== "oos" &&
            ogData.availability !== "out of stock" &&
            ogData.availability !== "instock"
            ? true
            : ogData.availability === "instock",
        imageUrl: ogData.image || undefined,
      };
    } catch (error) {
      return null;
    }
  }

  /**
   * Extract product data using common CSS selectors
   */
  private async extractFromSelectors(
    page: Page,
  ): Promise<Omit<ScrapedProduct, "url"> | null> {
    try {
      const data = await page.evaluate(() => {
        // Common title selectors
        const titleSelectors = [
          'h1[itemprop="name"]',
          "h1.product-title",
          "h1.product-name",
          ".product-title h1",
          "h1",
        ];

        // Common price selectors
        const priceSelectors = [
          '[itemprop="price"]',
          ".price",
          ".product-price",
          ".current-price",
          "span.price",
          ".price-value",
          ".p-item-price", // Startech
          ".special-price", // Ryans
          ".rp-product-price", // Ryans New
          ".actual-price",
          ".price-new",
          ".regular-price",
          "#price-special",
          ".main-price",
        ];

        // Common stock selectors
        const oosSelectors = [
          ".out-of-stock",
          ".sold-out",
          ".unavailable",
          ".stock-out",
          ".stock-status",
          ".discontinued",
          ".upcoming",
          ".text-discontinued", // Startech specific
          ".p-item-stock", // Generic
        ];

        // Common image selectors
        const imageSelectors = [
          'img[itemprop="image"]',
          ".product-image img",
          ".product-gallery img",
          ".main-image img",
          "#main-image",
          ".main-product-image img",
          ".product-main-image img",
          "#image", // OpenCart
          ".thumbnail img", // OpenCart thumbnails
        ];

        // Brand and Model extraction (OpenCart specific)
        const brandSelectors = [
          'a[href*="manufacturer"]', // OpenCart brand link
          '.manufacturer a',
          '[itemprop="brand"]',
          '.product-brand',
        ];

        const modelSelectors = [
          '.product-model',
          '[itemprop="model"]',
        ];

        const getTextContent = (selectors: string[]) => {
          for (const selector of selectors) {
            const el = document.querySelector(selector);
            if (el?.textContent?.trim()) {
              return el.textContent.trim();
            }
          }
          return "";
        };

        // Extract brand and model from product info list (OpenCart)
        const extractFromProductInfo = () => {
          const listItems = document.querySelectorAll('.list-unstyled li, .product-info li, ul li');
          let brand = "";
          let model = "";

          listItems.forEach(li => {
            const text = li.textContent || "";
            // OpenCart typically shows "Brand: BrandName" or "Model: ModelName"
            if (text.toLowerCase().includes('brand:')) {
              const brandMatch = text.split(':');
              if (brandMatch.length > 1) {
                brand = brandMatch[1].trim();
              }
            }
            if (text.toLowerCase().includes('model:')) {
              const modelMatch = text.split(':');
              if (modelMatch.length > 1) {
                model = modelMatch[1].trim();
              }
            }
          });

          return { brand, model };
        };

        const productInfo = extractFromProductInfo();

        const stockText = getTextContent(oosSelectors).toLowerCase();
        const oosKeywords = [
          "out of stock",
          "sold out",
          "discontinued",
          "upcoming",
          "not available",
          "stock out",
          "coming soon",
          "pre-order",
          "pre order",
          "call for price",
        ];
        const isActuallyOos =
          oosKeywords.some((kw) => stockText.includes(kw)) ||
          oosSelectors.some((s) => {
            const el = document.querySelector(s);
            return (
              el &&
              (el.classList.contains("out-of-stock") ||
                el.classList.contains("discontinued") ||
                el.classList.contains("upcoming"))
            );
          });

        // Check for "coming soon" or "pre-order" status
        const isComingSoon = stockText.includes("coming soon") || stockText.includes("upcoming");
        const isPreOrder = stockText.includes("pre-order") || stockText.includes("pre order");

        const imageSrc = (() => {
          for (const selector of imageSelectors) {
            const el = document.querySelector(selector) as HTMLImageElement;
            if (el) {
              const src =
                el.getAttribute("data-src") ||
                el.getAttribute("data-lazy-src") ||
                el.src;
              if (
                src &&
                !src.includes("placeholder") &&
                !src.startsWith("data:")
              ) {
                return src;
              }
            }
          }
          // Fallback: search for any image in a product container that looks like a main image
          const possibleContainers = [
            ".product-image",
            ".product-gallery",
            ".main-image",
            "main",
            "article",
          ];
          for (const containerSelector of possibleContainers) {
            const container = document.querySelector(containerSelector);
            if (container) {
              const images = Array.from(container.querySelectorAll("img"));
              for (const img of images) {
                const src = img.getAttribute("data-src") || img.src;
                if (src && img.width > 200 && !src.includes("placeholder"))
                  return src;
              }
            }
          }
          return undefined;
        })();

        return {
          title: getTextContent(titleSelectors),
          priceText: getTextContent(priceSelectors),
          brand: productInfo.brand || getTextContent(brandSelectors),
          model: productInfo.model || getTextContent(modelSelectors),
          isOos: isActuallyOos,
          isComingSoon,
          isPreOrder,
          stockText, // Return raw stock text for debugging
          imageUrl: imageSrc,
        };
      });

      if (!data.title) return null;

      // Extract numeric price from text
      let price = 0;
      if (data.priceText) {
        const priceMatch = data.priceText.replace(/,/g, '').match(/\d+\.?\d*/);
        if (priceMatch) {
          price = parseFloat(priceMatch[0]);
        }
      }

      // If price is 0 but product exists, check stock status
      if (price === 0 && data.title) {
        logger.warn(`[ScraperService] Price = 0 detected. Stock status: "${data.stockText}"`);

        if (data.isComingSoon) {
          logger.info(`[ScraperService] Product is "Coming Soon" - marking as out of stock`);
        } else if (data.isPreOrder) {
          logger.info(`[ScraperService] Product is "Pre-Order" - marking as out of stock`);
        } else if (data.isOos) {
          logger.info(`[ScraperService] Product is "Out of Stock"`);
        } else {
          logger.error(`[ScraperService] Price extraction failed - no valid price found`);
        }
      }

      return {
        title: data.title,
        price: price > 0 ? price : 0,
        currency: "USD", // Default assumption
        brand: data.brand || undefined,
        model: data.model || undefined,
        inStock: !data.isOos && price > 0,
        imageUrl: data.imageUrl,
      };
    } catch (error) {
      return null;
    }
  }

  /**
   * Batch scrape multiple URLs
   */
  async scrapeMultiple(urls: string[]): Promise<ScrapedProduct[]> {
    await this.init();

    const results: ScrapedProduct[] = [];

    for (const url of urls) {
      const product = await this.scrapeProductPage(url);
      if (product) {
        results.push(product);
      }

      // Rate limiting: wait between requests
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    return results;
  }

  /**
   * Attempt to find and scrape a product on a site using a search query
   */
  /**
   * Sanitize search query to improve match rates
   */
  private sanitizeQuery(query: string): string {
    if (!query) return "";

    // 1. Decode common HTML entities
    let cleaned = query
      .replace(/&quot;/g, '"')
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&apos;/g, "'")
      .replace(/&#39;/g, "'");

    // 2. Remove specifications in parentheses e.g. "Product Name (8GB/256GB)" -> "Product Name"
    cleaned = cleaned.replace(/\(.*?\)/g, " ");

    // 3. Remove common suffix junk that breaks search engines
    cleaned = cleaned.replace(/["'(){}\[\]]/g, " ");
    cleaned = cleaned.replace(/\s+/g, " ").trim();

    return cleaned;
  }

  /**
   * Attempt to find and scrape a product on a site using a search query
   */
  async searchAndScrape(
    baseUrl: string,
    query: string,
    siteId?: string,
  ): Promise<ScrapedProduct | null> {
    await this.init();
    const userAgent = USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];

    let context: any = null;
    let page: any = null;

    try {
      context = await this.browserPool.acquireContext(userAgent);
      page = await context.newPage();
    } catch (error) {
      logger.error(`[ScraperService] Failed to acquire context or create page for search:`, { error });
      return null;
    }

    const log = async (message: string, level: "INFO" | "WARN" | "ERROR" | "SUCCESS" = "INFO") => {
      if (siteId) {
        await prisma.syncLog.create({
          data: { siteId, message, level }
        }).catch(() => { });
      }
    };

    try {
      // 0. Clean retry flags from the search term
      const actualQuery = query.replace("__RETRY__", "").trim();

      // 1. Sanitize query
      const cleanQuery = this.sanitizeQuery(actualQuery);
      logger.info(
        `[ScraperService] Original query: "${query}" -> Sanitized: "${cleanQuery}"`,
      );

      // 2. Resolve Search Strategy
      const hostname = new URL(baseUrl).hostname.toLowerCase();

      // Find matching strategy by checking if hostname contains the key
      const strategyKey = Object.keys(SEARCH_STRATEGIES).find((domain) =>
        hostname.includes(domain),
      );
      let searchUrl: string | null = null;
      let usedCustomPattern = false;

      // Try to find a custom search pattern from the database if siteId is present
      if (siteId) {
        const site = await prisma.site.findUnique({
          where: { id: siteId },
          select: { searchQueryPattern: true },
        });

        if (site?.searchQueryPattern) {
          const pattern = site.searchQueryPattern;

          // If the pattern itself is a full URL, use it as base. Otherwise, append to baseUrl.
          let baseUrlToUse = baseUrl.replace(/\/$/, "");
          if (pattern.startsWith("http")) {
            // If pattern is absolute, we ignore the passed baseUrl for the search part 
            // but we still need to process the query replacement.
            baseUrlToUse = "";
          }

          // Standard placeholder replacement: {query} or {q}
          if (pattern.includes("{query}")) {
            searchUrl = (baseUrlToUse + pattern).replace(
              "{query}",
              encodeURIComponent(cleanQuery).replace(/%20/g, "+"),
            );
          } else if (pattern.includes("{q}")) {
            searchUrl = (baseUrlToUse + pattern).replace(
              "{q}",
              encodeURIComponent(cleanQuery).replace(/%20/g, "+"),
            );
          } else {
            // Fallback: If no placeholder, just append query (rare)
            searchUrl = baseUrlToUse + pattern + encodeURIComponent(cleanQuery);
          }
          usedCustomPattern = true;
        }
      }

      if (!searchUrl) {
        const buildUrl = strategyKey
          ? SEARCH_STRATEGIES[strategyKey]
          : DEFAULT_STRATEGY;
        searchUrl = buildUrl(baseUrl, cleanQuery);
      }

      logger.info(
        `[ScraperService] Searching: ${searchUrl} (Strategy: ${usedCustomPattern ? "Database Pattern" : (strategyKey || "Default")})`,
      );
      await log(`🔍 Searching: ${searchUrl}`, "INFO");

      // Add small random delay before navigation (more human-like)
      await page.waitForTimeout(Math.random() * 1000 + 500); // 500-1500ms

      // Ryans/Startech are heavy on JS, use networkidle if possible or longer wait
      const response = await page.goto(searchUrl, {
        waitUntil: "domcontentloaded",
        timeout: 30000,
      });

      // --- NEW: Security Pre-check ---
      const securityInfo = await this.analyzeSecurity(page, response);
      if (securityInfo.isBlocked) {
        const msg = `🛡️[Scraper] Blocked by ${securityInfo.provider} at ${hostname} `;
        logger.warn(`[ScraperService] ${msg} `);
        await log(msg, "WARN");

        // Try to wait for Cloudflare challenge before throwing error
        if (securityInfo.provider === "CLOUDFLARE") {
          logger.info("[ScraperService] Waiting for Cloudflare challenge to complete...");
          await page.waitForTimeout(8000); // Wait longer for challenge

          // Check if challenge was solved
          const recheckSecurity = await this.analyzeSecurity(page, response);
          if (!recheckSecurity.isBlocked) {
            logger.info("[ScraperService] ✅ Cloudflare challenge passed!");
          } else {
            // Still blocked, throw error
            throw new ScrapeBlockError(securityInfo.provider, searchUrl, true);
          }
        } else if (securityInfo.isAdvanced) {
          throw new ScrapeBlockError(securityInfo.provider, searchUrl, true);
        }
      }

      // Wait for results to render (critical for CSR sites like Ryans/Startech)
      try {
        await page.waitForSelector('.product-thumb, .p-item, .product-box, .p-item-details, .card, .product-item, .search-result', { timeout: 8000 });
      } catch (e) {
        // Fallback to static wait if specific selectors don't show up
        await page.waitForTimeout(4000);
      }

      // 2.5 Enhanced Human Simulation for Search Page
      logger.info(`[ScraperService] 🖱️ Simulating enhanced human behavior on search results for ${hostname}`);

      // Random pause before starting interactions
      await HumanSimulation.randomPause(200, 600);

      // Simulate natural mouse movement
      await HumanSimulation.simulateMouseMove(page);

      // Random pause between actions
      await HumanSimulation.randomPause(150, 400);

      // Simulate scrolling to view results
      await HumanSimulation.simulateScroll(page);

      // Random pause to simulate reading/reviewing results
      await HumanSimulation.randomPause(500, 1200);

      // Simulate hovering over product items (if they exist)
      const productSelectors = [
        '.product-thumb a',
        '.p-item a',
        '.product-box a',
        '.card a',
        '.product-item a'
      ];

      for (const selector of productSelectors) {
        const elements = await page.$$(selector);
        if (elements.length > 0) {
          // Hover over 1-2 random product items
          const hoverCount = Math.min(elements.length, Math.floor(Math.random() * 2) + 1);
          for (let i = 0; i < hoverCount; i++) {
            const randomIndex = Math.floor(Math.random() * Math.min(elements.length, 5));
            try {
              await HumanSimulation.hoverElement(page, `${selector}:nth-child(${randomIndex + 1})`);
              await HumanSimulation.randomPause(300, 800);
            } catch (e) {
              // Continue if hover fails
            }
          }
          break; // Found products, no need to try other selectors
        }
      }

      // 3. Look for links that might be products (heuristics)
      let productLink = await this.evaluateProductLink(page, cleanQuery);

      if (productLink) {
        logger.info(`[ScraperService] ✅ Direct search found product link: ${productLink} `);
      } else {
        logger.warn(`[ScraperService] ⚠️ Direct search returned no results for: "${cleanQuery}"`);
      }

      if (productLink) {
        logger.info(`[ScraperService] 🎯 Scraping product page: ${productLink} `);

        // Simulate hovering over the product link before navigating
        // This makes the behavior more human-like
        try {
          const linkElement = await page.$(`a[href="${productLink}"]`);
          if (linkElement) {
            await HumanSimulation.hoverElement(page, `a[href="${productLink}"]`);
            await HumanSimulation.randomPause(200, 500);
          }
        } catch (e) {
          // Continue even if hover fails
        }

        return await this.scrapeProductPage(productLink);
      }

      // Fallback Strategy: Query Simplification
      if (!query.includes("__RETRY__") && cleanQuery.split(" ").length > 3) {
        logger.info(`[ScraperService] 🔄 No results.Attempting query simplification...`);

        const stopWords = [
          "with", "graphics", "processor", "edition", "gaming", "desktop",
          "casing", "monitor", "series", "feature", "rgb", "tower", "color",
          "function", "multi", "inch", "usb", "wireless", "bluetooth"
        ];
        const words = cleanQuery.split(" ");
        const coreWords = words.filter(
          (w) => !stopWords.includes(w.toLowerCase()) && w.length > 2,
        );

        const smartQuery = coreWords.slice(0, 4).join(" ");

        if (smartQuery !== cleanQuery && smartQuery.length > 5) {
          logger.info(`[ScraperService] 📝 Simplified query: "${cleanQuery}" → "${smartQuery}"`);
          return this.searchAndScrape(baseUrl, smartQuery + "__RETRY__");
        }
      }

      logger.error(`[ScraperService] ❌ All strategies exhausted for: "${cleanQuery}"`);
      return null;
    } catch (error) {
      if (error instanceof ScrapeBlockError) throw error;
      logger.error(`[ScraperService] Search failed for ${query}: `, { error });
      return null;
    } finally {
      // Close page first, then release context (don't close context)
      if (page) {
        await page.close().catch((err: Error) => {
          logger.warn(`[ScraperService] Failed to close search page: `, { error: err });
        });
      }

      if (context) {
        await this.browserPool.releaseContext(context).catch((err: Error) => {
          logger.warn(`[ScraperService] Failed to release search context: `, { error: err });
        });
      }
    }
  }

  /**
   * Helper to identify product links on a results page using Weighted Scoring
   */
  private async evaluateProductLink(page: Page, query?: string): Promise<string | null> {
    // Pass TECH_BRANDS to the browser context
    return await page.evaluate(({ q, brands }) => {
      const candidates: Array<{
        href: string;
        text: string;
        score: number;
        reasons: string[];
      }> = [];

      const links = Array.from(document.querySelectorAll("a"));

      // Helper to normalize text
      const clean = (str: string) => str.toLowerCase().replace(/[^a-z0-9]/g, "");

      links.forEach((a, index) => {
        const href = a.href.toLowerCase();
        const text = a.textContent?.trim() || "";
        const lowerText = text.toLowerCase();

        // 1. Basic Filtering (Fail Fast)
        if (text.length < 4 && !href.includes("product_id=")) return;
        if (href.includes("javascript:") || href.includes("#")) return;

        // Skip navigation/sort/compare links
        const isJunk =
          href.includes("sort=") || href.includes("limit=") ||
          href.includes("page=") || href.includes("order=") ||
          href.includes("compare") || href.includes("wishlist") ||
          href.includes("/account") || href.includes("/checkout");

        if (isJunk) return;

        let score = 0;
        const reasons: string[] = [];

        // 2. Container Score (20% Weight)
        const productContainer =
          a.closest(".product-thumb") ||
          a.closest(".product-layout") ||
          a.closest(".product-box") ||
          a.closest(".card") ||
          a.closest(".p-item") ||
          a.closest(".product-item") ||
          a.closest(".main-products") ||
          a.closest(".product-list") ||
          a.closest(".search-result");

        if (productContainer) {
          score += 20;
          reasons.push("In Product Container");

          // --- NEW: Price Detection ---
          // Check if parent container has something that looks like money
          if (productContainer.textContent && /([$\u09F3\u20B9]|BDT|TK)\s?\d+/i.test(productContainer.textContent)) {
            score += 15;
            reasons.push("Price Detected Nearby");
          }
        }

        // --- NEW: Image Quality Check ---
        const img = a.querySelector("img");
        if (img) {
          score += 10;
          reasons.push("Has Image");
          // Bonus: Alt text matches query?
          if (q && img.alt) {
            const altClean = clean(img.alt);
            const qClean = clean(q);
            if (altClean.includes(qClean) || qClean.includes(altClean)) {
              score += 15;
              reasons.push("Image Alt Match");
            }
          }
        }

        // --- NEW: Text Quality Score ---
        if (text.length > 10 && text.length < 150) {
          // Sweet spot for titles
          score += 5;
        } else if (text.length < 5) {
          // "Buy", "More", "View" usually short
          score -= 5;
        }

        // 3. Query Match Score (40% Weight)
        if (q) {
          const queryWords = q.toLowerCase().split(/\s+/).filter(w => w.length > 2);
          if (queryWords.length > 0) {
            const matchCount = queryWords.filter(w => lowerText.includes(w) || href.includes(w)).length;
            const matchRatio = matchCount / queryWords.length;

            // Boost for full matches
            const boost = matchRatio === 1 ? 40 : (matchRatio * 30);
            score += boost;
            reasons.push(`Query Match: ${Math.round(matchRatio * 100)}% `);

            // Special penalty: If query has words, but link text has NONE of them, strict penalty
            if (matchCount === 0 && !productContainer) {
              score -= 50;
            }
          }
        }

        // 4. URL Structure Score (20% Weight)
        const isProductUrl =
          href.includes("/product/") ||
          href.includes("/p/") ||
          href.includes("/item/") ||
          (href.includes("/details/") && !href.includes("search"));

        if (isProductUrl) {
          score += 20;
          reasons.push("Product URL Pattern");
        } else if (href.split('/').length > 4) {
          // Deeper links are often products
          score += 5;
        }

        // 5. Brand Match Bonus (20% Weight)
        if (q && brands) {
          let queryBrand: string | null = null;
          const qClean = clean(q);

          // Identify brand in query
          for (const [key, data] of Object.entries(brands as Record<string, { aliases: string[] }>)) {
            if (data.aliases.some(alias => qClean.includes(clean(alias)))) {
              queryBrand = key;
              break;
            }
          }

          if (queryBrand) {
            const brandData = (brands as any)[queryBrand];
            // Check if link text contains the brand
            const linkHasBrand = brandData.aliases.some((alias: string) => clean(lowerText).includes(clean(alias)));

            if (linkHasBrand) {
              score += 20;
              reasons.push(`Brand Match(${queryBrand})`);
            }
          }
        }

        // 6. Position Score (Small bias to top results)
        // Top 5 results get a small boost
        if (index < 5) {
          score += (5 - index);
        }

        // Threshold to be considered a candidate
        if (score > 10) {
          candidates.push({ href: a.href, text: text, score, reasons });
        }
      });

      // Sort by score descending
      candidates.sort((a, b) => b.score - a.score);

      // Return top candidate or null
      return candidates.length > 0 ? candidates[0].href : null;

    }, { q: query, brands: TECH_BRANDS });
  }

  // Helper to handle the magic retry suffix transparently if needed,
  // currently we just strip it in sanitizeQuery or handle it in the recursive call logic.
  // Actually, sanitizeQuery will strip the underscores if we aren't careful,
  // but since we call sanitizeQuery INSIDE searchAndScrape, we need to pass the retry flag differently
  // OR just trust the length check logic if we don't pass a flag.
  // But to be safe, let's just use the words length check logic and valid recursion.
  // We'll strip the flag in sanitizeQuery if it exists to keep the search clean.

}
