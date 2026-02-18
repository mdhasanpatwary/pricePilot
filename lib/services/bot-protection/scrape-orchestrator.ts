/**
 * Scrape Orchestrator for Bot Protection Handling
 *
 * Coordinates the entire scraping workflow from request to result storage.
 * Integrates detection engine, proxy manager, rate limiter, session manager,
 * and scraping strategies to handle bot protection mechanisms.
 *
 * Requirements: 7.1, 7.2, 7.6
 */

import { logger } from '@/lib/logger';
import { prisma } from '@/lib/prisma';
import { ScrapeFailureType } from '@prisma/client';
import { DetectionEngine, ProtectionType, HttpResponse } from './detection-engine';
import { ProxyManager, Proxy } from './proxy-manager';
import { RateLimiter } from './rate-limiter';
import { SessionManager } from './session-manager';
import { HttpScraper, ScrapeConfig, ScrapeResponse } from './http-scraper';
import {
    HeadlessBrowserScraper,
    BrowserScrapeConfig,
    BrowserScrapeResponse,
} from './headless-browser-scraper';
import { DataExtractor, ExtractionResult } from './data-extractor';
import {
    StrategySelector,
    ScrapingStrategy,
    StrategyContext,
    FailureContext,
    SiteConfiguration,
    ScrapeAttempt,
} from './strategy-selector';
import { generateHeaders } from './header-generator';
import { UserAgentPool } from './user-agent-pool';
import { recordPriceHistoryGap } from './price-history-maintenance';
import { APIDetector } from '../api-detection/api-detector';
import { APICache, apiCache } from '../api-detection/api-cache';
import { APIExtractor } from '../api-detection/api-extractor';
import type { APIPattern, Product as APIProduct } from '@/lib/types/api-detection';
import { ConcurrencyLimiter } from '../concurrency-limiter';
import { StrategyPerformanceService } from './strategy-performance-service';
import { detectOpenCartFromUrlAndHtml } from '@/lib/services/platform-detector';

/**
 * Scrape request interface
 */
export interface ScrapeRequest {
    competitorProductId: string;
    competitorWebsiteId: string;
    url: string;
    tenantId: string;
    priority: 'high' | 'normal' | 'low';
    forceDetection?: boolean; // Force API detection even if cached pattern exists
}

/**
 * Scrape result interface
 */
export interface ScrapeResult {
    success: boolean;
    price?: number;
    currency?: string;
    protectionDetected: boolean;
    protectionType?: ProtectionType;
    attempts: number;
    finalStrategy: ScrapingStrategy;
    responseTime: number;
    timestamp: Date;
    errorMessage?: string;
    screenshot?: Buffer;
    method?: 'api' | 'html'; // Extraction method used
    apiPattern?: Partial<APIPattern>; // API pattern used (if any)
    detectionTime?: number; // Time spent on API detection
}

/**
 * ScrapeOrchestrator class
 *
 * Orchestrates the complete scraping workflow, coordinating all components
 * to handle bot protection and extract price data.
 */
export class ScrapeOrchestrator {
    private detectionEngine: DetectionEngine;
    private proxyManager: ProxyManager;
    private rateLimiter: RateLimiter;
    private sessionManager: SessionManager;
    private httpScraper: HttpScraper;
    private browserScraper: HeadlessBrowserScraper;
    private dataExtractor: DataExtractor;
    private strategySelector: StrategySelector;
    private userAgentPool: UserAgentPool;
    private apiDetector: APIDetector;
    private apiCache: APICache;
    private apiExtractor: APIExtractor;
    private concurrencyLimiter: ConcurrencyLimiter;

    constructor() {
        this.detectionEngine = new DetectionEngine();
        this.proxyManager = new ProxyManager();
        this.rateLimiter = new RateLimiter();
        this.sessionManager = new SessionManager();
        this.httpScraper = new HttpScraper();
        this.browserScraper = new HeadlessBrowserScraper(true); // Use browser pool
        this.dataExtractor = new DataExtractor();
        this.strategySelector = new StrategySelector();
        this.userAgentPool = new UserAgentPool();
        this.apiDetector = new APIDetector();
        this.apiCache = apiCache;
        this.apiExtractor = new APIExtractor();
        this.concurrencyLimiter = new ConcurrencyLimiter({
            minConcurrency: 1,
            maxConcurrency: 10,
            initialConcurrency: 3
        });
    }

    private isMissingColumnError(error: unknown): boolean {
        const msg = error instanceof Error ? error.message : String(error);
        return msg.includes('does not exist in the current database') || msg.includes('The column `(not available)` does not exist');
    }

    /**
     * Execute a scrape request
     *
     * Coordinates all components to:
     * 1. Check for cached API pattern
     * 2. Run API detection if no cached pattern exists
     * 3. Use API extraction when pattern is available
     * 4. Fallback to HTML scraping when API fails or not found
     * 5. Load site configuration
     * 6. Select scraping strategy
     * 7. Acquire rate limit permit
     * 8. Execute scrape with selected strategy
     * 9. Analyze response for bot protection
     * 10. Extract price data if successful
     * 11. Handle failures with retry logic
     *
     * Requirements: 3.1, 4.1, 4.2, 5.2, 6.3, 6.4, 7.1, 7.2, 7.6
     *
     * @param request - Scrape request
     * @returns Promise resolving to scrape result
     */
    async executeScrape(request: ScrapeRequest): Promise<ScrapeResult> {
        const startTime = Date.now();
        const timestamp = new Date();

        logger.info('[ScrapeOrchestrator] Starting scrape', {
            competitorProductId: request.competitorProductId,
            competitorWebsiteId: request.competitorWebsiteId,
            url: request.url,
        });

        // Acquire concurrency slot
        // Requirement: 6.4
        await this.concurrencyLimiter.acquireSlot(request.competitorWebsiteId);

        let result: ScrapeResult;

        try {
            // Step 1: Check cache for API pattern (unless forced detection)
            // Requirements: 5.2, 6.3, 6.4
            let apiPattern: APIPattern | null = null;
            let detectionTime = 0;

            if (!request.forceDetection) {
                apiPattern = await this.apiCache.getPattern(request.competitorWebsiteId);

                if (apiPattern) {
                    logger.info('[ScrapeOrchestrator] Found cached API pattern', {
                        competitorWebsiteId: request.competitorWebsiteId,
                        confidenceScore: apiPattern.confidenceScore,
                    });
                }
            }

            // Step 2: Run API detection if no cached pattern
            // Requirements: 3.1, 4.1
            if (!apiPattern) {
                logger.info('[ScrapeOrchestrator] No cached API pattern, running detection', {
                    competitorWebsiteId: request.competitorWebsiteId,
                });

                const detectionStart = Date.now();

                try {
                    // Get base URL for detection (use product listing page if available)
                    const baseUrl = await this.getBaseUrlForDetection(request.competitorWebsiteId, request.url);

                    const patterns = await this.apiDetector.detectAPIs(baseUrl, {
                        timeout: 30000,
                        maxPages: 3,
                        minConfidence: 70,
                    });

                    detectionTime = Date.now() - detectionStart;

                    if (patterns.length > 0) {
                        // Use highest ranked pattern
                        const bestPattern = patterns[0];

                        logger.info('[ScrapeOrchestrator] API detection successful', {
                            competitorWebsiteId: request.competitorWebsiteId,
                            patternsFound: patterns.length,
                            confidenceScore: bestPattern.confidenceScore,
                            detectionTime,
                        });

                        // Store pattern in cache
                        // Requirement: 6.3
                        await this.apiCache.storePattern(request.competitorWebsiteId, {
                            tenantId: request.tenantId,
                            competitorWebsiteId: request.competitorWebsiteId,
                            url: bestPattern.url!,
                            method: bestPattern.method!,
                            headers: bestPattern.headers!,
                            queryParams: bestPattern.queryParams!,
                            bodyTemplate: bestPattern.bodyTemplate,
                            responseFormat: bestPattern.responseFormat!,
                            dataPath: bestPattern.dataPath!,
                            fieldMappings: bestPattern.fieldMappings!,
                            confidenceScore: bestPattern.confidenceScore!,
                            paginationPattern: bestPattern.paginationPattern,
                            successCount: 0,
                            failureCount: 0,
                            lastUsedAt: new Date(),
                        });

                        apiPattern = await this.apiCache.getPattern(request.competitorWebsiteId);
                    } else {
                        logger.info('[ScrapeOrchestrator] No API patterns discovered', {
                            competitorWebsiteId: request.competitorWebsiteId,
                            detectionTime,
                        });

                        // No need to mark website - absence of ApiPattern record indicates no API available
                        // Requirement: 4.5
                    }
                } catch (error) {
                    detectionTime = Date.now() - detectionStart;
                    logger.error('[ScrapeOrchestrator] API detection failed', {
                        competitorWebsiteId: request.competitorWebsiteId,
                        error: error instanceof Error ? error.message : 'Unknown error',
                        detectionTime,
                    });

                    // No need to mark website - absence of ApiPattern record indicates no API available
                    // Requirements: 4.1, 4.5

                    // Continue to HTML scraping fallback
                }
            }

            // Step 3: Try API extraction if pattern available
            // Requirements: 3.1, 4.2
            if (apiPattern) {
                logger.info('[ScrapeOrchestrator] Attempting API extraction', {
                    competitorWebsiteId: request.competitorWebsiteId,
                    apiUrl: apiPattern.url,
                });

                try {
                    const products = await this.apiExtractor.extractProducts(apiPattern, {
                        maxProducts: 100,
                        timeout: 60000,
                    });

                    // Find product matching the request URL
                    const matchedProduct = this.findMatchingProduct(products, request.url);

                    if (matchedProduct && matchedProduct.price > 0) {
                        // API extraction successful
                        logger.info('[ScrapeOrchestrator] API extraction successful', {
                            competitorProductId: request.competitorProductId,
                            price: matchedProduct.price,
                            currency: matchedProduct.currency,
                        });

                        // Update cache metrics
                        await this.apiCache.updateMetrics(request.competitorWebsiteId, true);

                        // Update last known good price
                        await this.updateLastKnownGoodPrice(
                            request.competitorProductId,
                            matchedProduct.price,
                            matchedProduct.currency || 'USD'
                        );

                        // Handle manual price override
                        await this.handleManualPriceOverride(
                            request.competitorProductId,
                            matchedProduct.price,
                            matchedProduct.currency || 'USD'
                        );

                        const responseTime = Date.now() - startTime;

                        // Log API attempt (structured, stored in ScrapeAttempt)
                        await this.logScrapeAttempt(
                            request,
                            {
                                success: true,
                                price: matchedProduct.price,
                                currency: matchedProduct.currency,
                                protectionDetected: false,
                                userAgent: 'api',
                                statusCode: 200,
                                responseTimeMs: responseTime,
                                responseSizeBytes: undefined,
                            },
                            'api',
                            0
                        );

                        result = {
                            success: true,
                            price: matchedProduct.price,
                            currency: matchedProduct.currency,
                            protectionDetected: false,
                            attempts: 1,
                            finalStrategy: ScrapingStrategy.HTTP_CLIENT,
                            responseTime,
                            timestamp,
                            method: 'api',
                            apiPattern,
                            detectionTime: detectionTime > 0 ? detectionTime : undefined,
                        };
                    } else {
                        logger.warn('[ScrapeOrchestrator] No matching product found in API response', {
                            competitorProductId: request.competitorProductId,
                            productsFound: products.length,
                        });

                        // Log API attempt failure (SEARCH_EMPTY / PRICE_ZERO)
                        const failureType = matchedProduct && matchedProduct.price === 0
                            ? ScrapeFailureType.PRICE_ZERO
                            : ScrapeFailureType.SEARCH_EMPTY;
                        await this.logScrapeAttempt(
                            request,
                            {
                                success: false,
                                protectionDetected: false,
                                failureType,
                                userAgent: 'api',
                                statusCode: 200,
                                responseTimeMs: Date.now() - startTime,
                                responseSizeBytes: undefined,
                                errorMessage: matchedProduct
                                    ? 'API matched product but price was 0'
                                    : 'No matching product found in API response',
                            },
                            'api',
                            0
                        );

                        // Update cache metrics as failure
                        await this.apiCache.updateMetrics(request.competitorWebsiteId, false);
                    }
                } catch (error) {
                    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                    const failureType = this.classifyExceptionFailureType(errorMessage);
                    logger.error('[ScrapeOrchestrator] API extraction failed', {
                        competitorProductId: request.competitorProductId,
                        failureType,
                        error: errorMessage,
                    });

                    await this.logScrapeAttempt(
                        request,
                        {
                            success: false,
                            protectionDetected: false,
                            failureType,
                            userAgent: 'api',
                            statusCode: undefined,
                            responseTimeMs: Date.now() - startTime,
                            responseSizeBytes: undefined,
                            errorMessage,
                        },
                        'api',
                        0
                    );

                    // Update cache metrics as failure
                    await this.apiCache.updateMetrics(request.competitorWebsiteId, false);

                    // Continue to HTML scraping fallback
                }
            }

            if (!result!) {
                // Step 4: Fallback to HTML scraping
                // Requirements: 4.1, 4.2
                logger.info('[ScrapeOrchestrator] Falling back to HTML scraping', {
                    competitorWebsiteId: request.competitorWebsiteId,
                    reason: apiPattern ? 'API extraction failed' : 'No API pattern available',
                });

                // Load site configuration
                const siteConfig = await this.loadSiteConfiguration(request.competitorWebsiteId);

                // Prefer the best-performing strategy (if known) for the first attempt.
                // This is a best-effort lookup and must not block scraping.
                try {
                    const ranked = await StrategyPerformanceService.getRankedStrategies({
                        tenantId: request.tenantId,
                        competitorWebsiteId: request.competitorWebsiteId,
                        limit: 5,
                    });
                    if (ranked.length > 0) {
                        siteConfig.preferredStrategy = ranked[0];
                    }
                } catch (error) {
                    logger.warn('[ScrapeOrchestrator] Failed to load strategy rankings', {
                        competitorWebsiteId: request.competitorWebsiteId,
                        error: error instanceof Error ? error.message : String(error),
                    });
                }

                // Initialize strategy context
                const strategyContext: StrategyContext = {
                    competitorWebsiteId: request.competitorWebsiteId,
                    siteConfig,
                    recentHistory: await this.loadRecentHistory(request.competitorWebsiteId),
                    currentAttempt: 1,
                };

                // Select initial strategy
                const strategy = this.strategySelector.selectStrategy(strategyContext);

                logger.info('[ScrapeOrchestrator] Selected initial strategy', {
                    strategy,
                    competitorWebsiteId: request.competitorWebsiteId,
                });

                // Execute scrape with retry logic
                const scrapeResult = await this.executeScrapeWithRetry(
                    request,
                    siteConfig,
                    strategy,
                    strategyContext
                );

                const responseTime = Date.now() - startTime;

                logger.info('[ScrapeOrchestrator] Scrape completed', {
                    success: scrapeResult.success,
                    attempts: scrapeResult.attempts,
                    finalStrategy: scrapeResult.finalStrategy,
                    responseTime,
                    method: 'html',
                });

                result = {
                    ...scrapeResult,
                    responseTime,
                    timestamp,
                    method: 'html',
                    detectionTime: detectionTime > 0 ? detectionTime : undefined,
                };
            }
        } catch (error) {
            const responseTime = Date.now() - startTime;
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';

            logger.error('[ScrapeOrchestrator] Scrape failed with error', {
                error: errorMessage,
                competitorProductId: request.competitorProductId,
                url: request.url,
            });

            result = {
                success: false,
                protectionDetected: false,
                attempts: 1,
                finalStrategy: ScrapingStrategy.HTTP_CLIENT,
                responseTime,
                timestamp,
                errorMessage,
                method: 'html',
            };
        } finally {
            // Record result and adjust concurrency
            // Requirement: 6.6
            this.concurrencyLimiter.recordResult(
                request.competitorWebsiteId,
                result!.success,
                result!.protectionDetected,
                Date.now() - startTime
            );

            this.concurrencyLimiter.releaseSlot(request.competitorWebsiteId);
        }

        return result;
    }

    /**
     * Retry a failed scrape request
     *
     * Used for manual retry or scheduled retry of previously failed scrapes.
     *
     * Requirements: 7.2, 7.6
     *
     * @param request - Scrape request
     * @returns Promise resolving to scrape result
     */
    async retryFailedScrape(request: ScrapeRequest): Promise<ScrapeResult> {
        logger.info('[ScrapeOrchestrator] Retrying failed scrape', {
            competitorProductId: request.competitorProductId,
            url: request.url,
        });

        // Execute as new scrape request
        return this.executeScrape(request);
    }

    /**
     * Execute scrape with retry logic
     *
     * Implements retry logic with strategy adaptation based on failures.
     *
     * Requirements: 7.2, 7.6
     *
     * @param request - Scrape request
     * @param siteConfig - Site configuration
     * @param initialStrategy - Initial scraping strategy
     * @param strategyContext - Strategy context
     * @returns Promise resolving to scrape result
     */
    private async executeScrapeWithRetry(
        request: ScrapeRequest,
        siteConfig: SiteConfiguration,
        initialStrategy: ScrapingStrategy,
        strategyContext: StrategyContext
    ): Promise<ScrapeResult> {
        let currentStrategy = initialStrategy;
        let attemptNumber = 1;
        let lastProtectionType: ProtectionType | undefined;
        let lastErrorMessage: string | undefined;
        let lastScreenshot: Buffer | undefined;

        // Retry loop
        while (attemptNumber <= siteConfig.maxRetries) {
            logger.info('[ScrapeOrchestrator] Executing attempt', {
                attemptNumber,
                maxRetries: siteConfig.maxRetries,
                strategy: currentStrategy,
                competitorWebsiteId: request.competitorWebsiteId,
            });

            try {
                // Acquire rate limit permit
                await this.rateLimiter.acquirePermit(request.competitorWebsiteId);

                // Execute scrape with current strategy
                const attemptResult = await this.executeSingleAttempt(
                    request,
                    siteConfig,
                    currentStrategy
                );

                // Log attempt
                await this.logScrapeAttempt(request, attemptResult, currentStrategy, attemptNumber);

                // Check if successful
                if (attemptResult.success) {
                    // Record success in rate limiter
                    await this.rateLimiter.recordSuccess(request.competitorWebsiteId);

                    // Record proxy success if used
                    if (attemptResult.proxyId) {
                        await this.proxyManager.markProxySuccess(
                            attemptResult.proxyId,
                            request.competitorWebsiteId
                        );
                    }

                    // Update last known good price
                    if (attemptResult.price) {
                        await this.updateLastKnownGoodPrice(
                            request.competitorProductId,
                            attemptResult.price,
                            attemptResult.currency || 'USD'
                        );
                    }

                    // Handle manual price override if applicable
                    if (attemptResult.price) {
                        await this.handleManualPriceOverride(
                            request.competitorProductId,
                            attemptResult.price,
                            attemptResult.currency || 'USD'
                        );
                    }

                    logger.info('[ScrapeOrchestrator] Scrape successful', {
                        attemptNumber,
                        strategy: currentStrategy,
                        price: attemptResult.price,
                    });

                    return {
                        success: true,
                        price: attemptResult.price,
                        currency: attemptResult.currency,
                        protectionDetected: attemptResult.protectionDetected,
                        protectionType: attemptResult.protectionType,
                        attempts: attemptNumber,
                        finalStrategy: currentStrategy,
                        responseTime: 0, // Will be set by caller
                        timestamp: new Date(),
                        screenshot: attemptResult.screenshot,
                    };
                }

                // Attempt failed, record failure
                lastProtectionType = attemptResult.protectionType;
                lastErrorMessage = attemptResult.errorMessage;
                lastScreenshot = attemptResult.screenshot;

                // Record failure in rate limiter
                await this.rateLimiter.recordFailure(
                    request.competitorWebsiteId,
                    attemptResult.protectionType
                );

                // Record proxy failure if used
                if (attemptResult.proxyId) {
                    await this.proxyManager.markProxyFailed(
                        attemptResult.proxyId,
                        request.competitorWebsiteId
                    );
                }

                // Check if we should retry
                if (attemptNumber >= siteConfig.maxRetries) {
                    logger.warn('[ScrapeOrchestrator] Max retries reached', {
                        attemptNumber,
                        maxRetries: siteConfig.maxRetries,
                    });
                    break;
                }

                // Select retry strategy
                const failureContext: FailureContext = {
                    ...strategyContext,
                    currentAttempt: attemptNumber + 1,
                    lastProtectionType: attemptResult.protectionType || ProtectionType.UNKNOWN,
                    lastStrategy: currentStrategy,
                };

                const retryStrategy = this.strategySelector.selectRetryStrategy(failureContext);

                if (!retryStrategy) {
                    logger.warn('[ScrapeOrchestrator] No retry strategy available', {
                        lastProtectionType: attemptResult.protectionType,
                        attemptNumber,
                    });
                    break;
                }

                currentStrategy = retryStrategy;
                attemptNumber++;

                logger.info('[ScrapeOrchestrator] Retrying with new strategy', {
                    attemptNumber,
                    newStrategy: currentStrategy,
                    lastProtectionType: attemptResult.protectionType,
                });
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                lastErrorMessage = errorMessage;
                const failureType = this.classifyExceptionFailureType(errorMessage);

                logger.error('[ScrapeOrchestrator] Attempt failed with error', {
                    attemptNumber,
                    strategy: currentStrategy,
                    failureType,
                    error: errorMessage,
                });

                await this.logScrapeAttempt(
                    request,
                    {
                        success: false,
                        protectionDetected: false,
                        failureType,
                        proxyId: undefined,
                        userAgent: 'unknown',
                        statusCode: undefined,
                        responseTimeMs: 0,
                        responseSizeBytes: 0,
                        errorMessage,
                    },
                    currentStrategy,
                    attemptNumber
                );

                // Record failure
                await this.rateLimiter.recordFailure(request.competitorWebsiteId);

                // Check if we should retry
                if (attemptNumber >= siteConfig.maxRetries) {
                    break;
                }

                attemptNumber++;
            }
        }

        // All retries exhausted
        logger.error('[ScrapeOrchestrator] All retries exhausted', {
            attempts: attemptNumber,
            lastProtectionType,
            lastErrorMessage,
        });

        // Record price history gap to maintain continuity
        await recordPriceHistoryGap(
            request.competitorProductId,
            lastProtectionType || 'scraping_failed'
        );

        return {
            success: false,
            protectionDetected: lastProtectionType !== undefined,
            protectionType: lastProtectionType,
            attempts: attemptNumber,
            finalStrategy: currentStrategy,
            responseTime: 0, // Will be set by caller
            timestamp: new Date(),
            errorMessage: lastErrorMessage || 'All retry attempts failed',
            screenshot: lastScreenshot,
        };
    }

    /**
     * Execute a single scrape attempt with the specified strategy
     *
     * @param request - Scrape request
     * @param siteConfig - Site configuration
     * @param strategy - Scraping strategy to use
     * @returns Promise resolving to attempt result
     */
    private async executeSingleAttempt(
        request: ScrapeRequest,
        siteConfig: SiteConfiguration,
        strategy: ScrapingStrategy
    ): Promise<AttemptResult> {
        const userAgent = this.userAgentPool.getRandomUserAgent();
        let proxy: Proxy | null = null;

        try {
            // Get proxy if strategy requires it
            proxy = this.shouldUseProxy(strategy)
                ? await this.proxyManager.getProxy(request.competitorWebsiteId)
                : null;

            // Get cookies
            const cookies = await this.sessionManager.getCookies(request.competitorWebsiteId);

            // Execute based on strategy
            if (this.isHttpStrategy(strategy)) {
                return this.executeHttpScrape(request, siteConfig, proxy, userAgent, cookies);
            } else {
                return this.executeBrowserScrape(request, siteConfig, strategy, proxy, userAgent, cookies);
            }
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            const failureType = this.classifyExceptionFailureType(errorMessage);

            logger.error('[ScrapeOrchestrator] Failed before executing scrape strategy', {
                competitorWebsiteId: request.competitorWebsiteId,
                url: request.url,
                strategy,
                failureType,
                error: errorMessage,
            });

            return {
                success: false,
                protectionDetected: false,
                failureType,
                proxyId: proxy?.id,
                errorMessage,
                statusCode: undefined,
                responseTimeMs: 0,
                userAgent,
                responseSizeBytes: 0,
            };
        }
    }

    /**
     * Execute HTTP-based scrape
     *
     * @param request - Scrape request
     * @param siteConfig - Site configuration
     * @param proxy - Proxy to use (if any)
     * @param userAgent - User agent string
     * @param cookies - Cookies to include
     * @returns Promise resolving to attempt result
     */
    private async executeHttpScrape(
        request: ScrapeRequest,
        siteConfig: SiteConfiguration,
        proxy: Proxy | null,
        userAgent: string,
        cookies: any[]
    ): Promise<AttemptResult> {
        // Generate headers
        const headers = generateHeaders({
            userAgent,
            profile: 'desktop',
            randomizeOrder: true,
        });

        // Build scrape config
        const scrapeConfig: ScrapeConfig = {
            url: request.url,
            proxy: proxy ? {
                host: proxy.host,
                port: proxy.port,
                protocol: proxy.protocol,
                username: proxy.username,
                password: proxy.password,
            } : undefined,
            userAgent,
            headers,
            cookies,
            timeout: 30000, // 30 seconds
            followRedirects: true,
        };

        // Execute scrape
        let response: ScrapeResponse;
        try {
            response = await this.httpScraper.scrape(scrapeConfig);
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            const failureType = this.classifyExceptionFailureType(errorMessage);

            logger.error('[ScrapeOrchestrator] HTTP scrape threw error', {
                competitorWebsiteId: request.competitorWebsiteId,
                url: request.url,
                failureType,
                error: errorMessage,
            });

            return {
                success: false,
                protectionDetected: false,
                failureType,
                proxyId: proxy?.id,
                errorMessage,
                statusCode: undefined,
                responseTimeMs: 0,
                userAgent,
                responseSizeBytes: 0,
            };
        }

        // Store cookies
        if (response.headers['set-cookie']) {
            const parsedCookies = this.sessionManager.parseCookiesFromHeaders(response.headers);
            if (parsedCookies.length > 0) {
                // Set domain from URL if not set
                const urlObj = new URL(request.url);
                parsedCookies.forEach(cookie => {
                    if (!cookie.domain) {
                        cookie.domain = urlObj.hostname;
                    }
                });
                await this.sessionManager.updateCookies(request.competitorWebsiteId, parsedCookies);
            }
        }

        // Analyze response
        return await this.analyzeResponse(request, siteConfig, response, userAgent, proxy?.id);
    }

    /**
     * Execute browser-based scrape
     *
     * @param request - Scrape request
     * @param siteConfig - Site configuration
     * @param strategy - Scraping strategy
     * @param proxy - Proxy to use (if any)
     * @param userAgent - User agent string
     * @param cookies - Cookies to include
     * @returns Promise resolving to attempt result
     */
    private async executeBrowserScrape(
        request: ScrapeRequest,
        siteConfig: SiteConfiguration,
        strategy: ScrapingStrategy,
        proxy: Proxy | null,
        userAgent: string,
        cookies: any[]
    ): Promise<AttemptResult> {
        // Generate headers
        const headers = generateHeaders({
            userAgent,
            profile: 'desktop',
            randomizeOrder: true,
        });

        // Build browser scrape config
        const browserConfig: BrowserScrapeConfig = {
            url: request.url,
            proxy: proxy ? {
                host: proxy.host,
                port: proxy.port,
                protocol: proxy.protocol,
                username: proxy.username,
                password: proxy.password,
            } : undefined,
            userAgent,
            headers,
            cookies,
            timeout: 60000, // 60 seconds for browser
            followRedirects: true,
            stealthMode: strategy === ScrapingStrategy.STEALTH_BROWSER,
            viewport: {
                width: 1920,
                height: 1080,
                deviceScaleFactor: 1,
                isMobile: false,
            },
        };

        // Execute browser scrape
        let response: BrowserScrapeResponse;
        try {
            response = await this.browserScraper.scrape(browserConfig);
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            const failureType = this.classifyExceptionFailureType(errorMessage);

            logger.error('[ScrapeOrchestrator] Browser scrape threw error', {
                competitorWebsiteId: request.competitorWebsiteId,
                url: request.url,
                strategy,
                failureType,
                error: errorMessage,
            });

            return {
                success: false,
                protectionDetected: false,
                failureType,
                proxyId: proxy?.id,
                screenshot: undefined,
                errorMessage,
                statusCode: undefined,
                responseTimeMs: 0,
                userAgent,
                responseSizeBytes: 0,
            };
        }

        // Store cookies from browser context
        // Note: Browser cookies are handled by Playwright context

        // Analyze response
        return await this.analyzeResponse(request, siteConfig, response, userAgent, proxy?.id, response.screenshot);
    }

    /**
     * Analyze scrape response and extract price data
     *
     * @param _request - Scrape request (unused for now)
     * @param siteConfig - Site configuration
     * @param response - Scrape response
     * @param proxyId - Proxy ID used (if any)
     * @param screenshot - Screenshot buffer (if any)
     * @returns Attempt result
     */
    private async analyzeResponse(
        request: ScrapeRequest,
        siteConfig: SiteConfiguration,
        response: ScrapeResponse | BrowserScrapeResponse,
        userAgent: string,
        proxyId?: string,
        screenshot?: Buffer
    ): Promise<AttemptResult> {
        // Convert response to HttpResponse for detection
        const httpResponse: HttpResponse = {
            statusCode: response.statusCode,
            headers: response.headers,
            body: response.body,
            redirectUrl: response.redirectUrl,
            responseTime: response.responseTime,
            finalUrl: response.finalUrl,
        };

        // Detect bot protection
        const detection = this.detectionEngine.analyzeResponse(httpResponse);

        // Best-effort platform detection (OpenCart) to enable optimized defaults.
        // Never block scraping on detection/DB issues.
        try {
            const urlForDetection = httpResponse.finalUrl || request.url;
            if (detectOpenCartFromUrlAndHtml({ url: urlForDetection, html: response.body })) {
                const domain = new URL(urlForDetection).hostname;
                const existing = await prisma.domainProfile.findUnique({ where: { domain } });
                if (!existing || !existing.platformType) {
                    await prisma.domainProfile.upsert({
                        where: { domain },
                        create: {
                            domain,
                            platformType: 'OPENCART',
                        },
                        update: {
                            platformType: 'OPENCART',
                        },
                    });
                }
            }
        } catch (error) {
            logger.debug('[ScrapeOrchestrator] Platform detection failed', {
                competitorWebsiteId: request.competitorWebsiteId,
                error: error instanceof Error ? error.message : String(error),
            });
        }

        // If protection detected, return failure
        if (detection.protectionDetected) {
            return {
                success: false,
                protectionDetected: true,
                protectionType: detection.protectionType,
                failureType: ScrapeFailureType.BOT_BLOCKED,
                proxyId,
                screenshot,
                errorMessage: detection.reasoning,
                statusCode: response.statusCode,
                responseTimeMs: response.responseTime,
                userAgent,
                responseSizeBytes: response.body.length,
            };
        }

        // Try to extract price
        const extraction: ExtractionResult = this.dataExtractor.extractPrice(
            response.body,
            siteConfig.customSelectors
        );

        // Check if extraction successful
        if (extraction.success && extraction.price) {
            return {
                success: true,
                price: extraction.price,
                currency: extraction.currency,
                protectionDetected: false,
                proxyId,
                screenshot,
                statusCode: response.statusCode,
                responseTimeMs: response.responseTime,
                userAgent,
                responseSizeBytes: response.body.length,
            };
        }

        // Extraction failed
        const failureType = this.classifyExtractionFailure(extraction, response.statusCode);
        const errorMessage = extraction.error
            ? `Failed to extract price: ${extraction.error}`
            : 'Failed to extract price from response';

        return {
            success: false,
            protectionDetected: false,
            failureType,
            proxyId,
            screenshot,
            errorMessage,
            statusCode: response.statusCode,
            responseTimeMs: response.responseTime,
            userAgent,
            responseSizeBytes: response.body.length,
        };
    }

    private classifyExtractionFailure(extraction: ExtractionResult, statusCode: number): ScrapeFailureType {
        // Non-OK responses are navigation issues unless we explicitly detected bot protection earlier.
        if (statusCode >= 400) {
            if (statusCode === 403 || statusCode === 429) return ScrapeFailureType.BOT_BLOCKED;
            if (statusCode === 408) return ScrapeFailureType.TIMEOUT;
            return ScrapeFailureType.NAVIGATION_FAILED;
        }

        // DataExtractor now returns structured error messages for parse/validation failures.
        const err = (extraction.error || '').toLowerCase();

        if (err.includes('parsed to 0')) return ScrapeFailureType.PRICE_ZERO;
        if (err.includes('failed to parse')) return ScrapeFailureType.PARSE_FAILED;
        if (err.includes('failed validation')) return ScrapeFailureType.PARSE_FAILED;
        if (err.includes('no price found')) return ScrapeFailureType.STRUCTURE_CHANGED;

        // Default: structure changed is the safest classification when selectors produced no valid price.
        return ScrapeFailureType.STRUCTURE_CHANGED;
    }

    private classifyExceptionFailureType(errorMessage: string): ScrapeFailureType {
        const msg = (errorMessage || '').toLowerCase();

        if (msg.includes('timeout') || msg.includes('timed out') || msg.includes('time out')) {
            return ScrapeFailureType.TIMEOUT;
        }

        // If upstream code marks blocks explicitly, honor it.
        if (msg.includes('blocked') || msg.includes('captcha') || msg.includes('cloudflare')) {
            return ScrapeFailureType.BOT_BLOCKED;
        }

        if (
            msg.includes('econnrefused') ||
            msg.includes('enotfound') ||
            msg.includes('eai_again') ||
            msg.includes('econnreset') ||
            msg.includes('connection refused') ||
            msg.includes('net::err') ||
            msg.includes('failed to fetch') ||
            msg.includes('dns')
        ) {
            return ScrapeFailureType.NAVIGATION_FAILED;
        }

        return ScrapeFailureType.PARSE_FAILED;
    }

    /**
     * Check if strategy should use proxy
     *
     * @param strategy - Scraping strategy
     * @returns True if proxy should be used
     */
    private shouldUseProxy(strategy: ScrapingStrategy): boolean {
        return (
            strategy === ScrapingStrategy.HTTP_WITH_PROXY ||
            strategy === ScrapingStrategy.HEADLESS_WITH_PROXY
        );
    }

    /**
     * Check if strategy is HTTP-based
     *
     * @param strategy - Scraping strategy
     * @returns True if HTTP-based
     */
    private isHttpStrategy(strategy: ScrapingStrategy): boolean {
        return (
            strategy === ScrapingStrategy.HTTP_CLIENT ||
            strategy === ScrapingStrategy.HTTP_WITH_PROXY
        );
    }

    /**
     * Load site configuration from database
     *
     * @param _competitorWebsiteId - Competitor website ID (unused for now)
     * @returns Site configuration
     */
    private async loadSiteConfiguration(competitorWebsiteId: string): Promise<SiteConfiguration> {
        try {
            const config = await prisma.scrapingConfig.findUnique({
                where: { competitorWebsiteId },
            });

            if (config) {
                return {
                    preferredStrategy: config.preferredStrategy as ScrapingStrategy,
                    requiresJavaScript: config.requiresJavascript,
                    rateLimit: {
                        baseDelay: config.baseDelayMs,
                        maxDelay: config.maxDelayMs,
                        backoffMultiplier: Number(config.backoffMultiplier),
                        jitterRange: 20, // Default jitter
                    },
                    proxyRequired: config.proxyRequired,
                    customSelectors: {
                        priceSelectors: (config.priceSelectors as string[]) || ['.price', '[itemprop="price"]', '.product-price'],
                        currencySelector: config.currencySelector || undefined,
                        fallbackRegex: config.fallbackRegex || undefined,
                    },
                    maxRetries: config.maxRetries,
                };
            }
        } catch (error) {
            logger.error('[ScrapeOrchestrator] Failed to load site configuration', { competitorWebsiteId, error });
        }

        // Optimized defaults for detected platforms (DomainProfile).
        try {
            const site = await prisma.site.findUnique({
                where: { id: competitorWebsiteId },
                select: { baseUrl: true },
            });
            if (site?.baseUrl) {
                const domain = new URL(site.baseUrl).hostname;
                const dp = await prisma.domainProfile.findUnique({
                    where: { domain },
                    select: { platformType: true },
                });

                if (dp?.platformType === 'OPENCART') {
                    return {
                        // Lightweight mode by default
                        preferredStrategy: ScrapingStrategy.HTTP_CLIENT,
                        requiresJavaScript: false,
                        rateLimit: {
                            baseDelay: 1200,
                            maxDelay: 60000,
                            backoffMultiplier: 2.0,
                            jitterRange: 20,
                        },
                        // Skip proxy unless needed (retry logic can still escalate to proxy strategies)
                        proxyRequired: false,
                        // Predefined selector templates for OpenCart
                        customSelectors: {
                            priceSelectors: [
                                '.price-new',
                                '.price',
                                '#content .list-unstyled h2',
                                '#product-product .list-unstyled h2',
                                '[itemprop="price"]',
                                '[data-price]',
                                'meta[property="product:price:amount"]',
                                'meta[property="og:price:amount"]',
                            ],
                        },
                        maxRetries: 2,
                    };
                }
            }
        } catch (error) {
            logger.debug('[ScrapeOrchestrator] Failed to load DomainProfile for optimized defaults', {
                competitorWebsiteId,
                error: error instanceof Error ? error.message : String(error),
            });
        }

        // Default configuration if not found
        return {
            preferredStrategy: ScrapingStrategy.HTTP_CLIENT,
            requiresJavaScript: false,
            rateLimit: {
                baseDelay: 2000,
                maxDelay: 300000,
                backoffMultiplier: 2.0,
                jitterRange: 20,
            },
            proxyRequired: false,
            customSelectors: {
                priceSelectors: ['.price', '[itemprop="price"]', '.product-price'],
            },
            maxRetries: 3,
        };
    }

    /**
     * Load recent scrape history for a competitor website
     *
     * @param _competitorWebsiteId - Competitor website ID (unused for now)
     * @returns Recent scrape attempts
     */
    private async loadRecentHistory(competitorWebsiteId: string): Promise<ScrapeAttempt[]> {
        try {
            const history = await prisma.scrapeAttempt.findMany({
                where: { competitorWebsiteId },
                orderBy: { createdAt: 'desc' },
                take: 5,
            });

            return history.map(h => ({
                id: h.id,
                strategy: h.strategy as ScrapingStrategy,
                success: h.success,
                protectionDetected: h.protectionDetected,
                protectionType: h.protectionType as ProtectionType,
                timestamp: h.createdAt,
            }));
        } catch (error) {
            logger.error('[ScrapeOrchestrator] Failed to load recent history', { competitorWebsiteId, error });
            return [];
        }
    }

    /**
     * Log scrape attempt to database
     *
     * @param result - Attempt result
     * @param strategy - Strategy used
     * @param attemptNumber - Attempt number
     */
    private async logScrapeAttempt(
        request: ScrapeRequest,
        result: AttemptResult,
        strategy: string,
        attemptNumber: number
    ): Promise<void> {
        try {
            const baseData = {
                tenantId: request.tenantId,
                competitorProductId: request.competitorProductId,
                competitorWebsiteId: request.competitorWebsiteId,
                url: request.url,
                strategy: strategy,
                proxyId: result.proxyId,
                userAgent: result.userAgent,
                success: result.success,
                protectionDetected: result.protectionDetected,
                protectionType: result.protectionType,
                statusCode: result.statusCode,
                responseTimeMs: result.responseTimeMs,
                responseSizeBytes: result.responseSizeBytes,
                errorMessage: result.errorMessage,
                attemptNumber: attemptNumber,
            } as const;

            let scrapeAttempt: { id: string };
            try {
                scrapeAttempt = await prisma.scrapeAttempt.create({
                    data: {
                        ...baseData,
                        failureType: result.failureType,
                    },
                    select: { id: true },
                });
            } catch (error) {
                if (!this.isMissingColumnError(error)) throw error;

                // DB schema not migrated yet: retry without failureType to avoid crashing.
                scrapeAttempt = await prisma.scrapeAttempt.create({
                    data: baseData,
                    select: { id: true },
                });
            }

            if (result.protectionDetected && result.protectionType) {
                await prisma.protectionDetection.create({
                    data: {
                        scrapeAttemptId: scrapeAttempt.id,
                        protectionType: result.protectionType,
                        confidence: 100, // Hardcoded for now, detection engine could provide this
                        indicators: {}, // Hardcoded for now
                        reasoning: result.errorMessage,
                    },
                });
            }

            logger.debug('[ScrapeOrchestrator] Logged scrape attempt to database', {
                id: scrapeAttempt.id,
                strategy,
                success: result.success,
            });
        } catch (error) {
            logger.error('[ScrapeOrchestrator] Failed to log scrape attempt', { error });
        }
    }

    /**
     * Update last known good price on successful scrape
     *
     * Stores the last successfully scraped price with timestamp.
     * This allows the system to display the last known good price
     * when current scraping fails.
     *
     * Requirements: 14.1
     *
     * @param competitorProductId - ID of the competitor product
     * @param price - Successfully scraped price
     * @param currency - Price currency
     */
    async updateLastKnownGoodPrice(
        competitorProductId: string,
        price: number,
        currency: string
    ): Promise<void> {
        try {
            logger.info('[ScrapeOrchestrator] Updating last known good price', {
                competitorProductId,
                price,
                currency,
            });

            await prisma.product.update({
                where: { id: competitorProductId },
                data: {
                    lastKnownGoodPrice: price,
                    lastKnownGoodPriceAt: new Date(),
                    lastKnownGoodCurrency: currency,
                },
            });

            logger.info('[ScrapeOrchestrator] Last known good price updated successfully', {
                competitorProductId,
                price,
            });
        } catch (error) {
            logger.error('[ScrapeOrchestrator] Error updating last known good price', {
                competitorProductId,
                error: error instanceof Error ? error.message : 'Unknown error',
            });
            // Don't throw - this is a non-critical operation
        }
    }

    /**
     * Check for manual prices and replace with scraped price on success
     *
     * When automated scraping successfully retrieves a price for a product
     * that has a manually entered price, this method replaces the manual
     * price with the scraped price and maintains history.
     *
     * Requirements: 13.5, 13.6
     *
     * @param competitorProductId - ID of the competitor product
     * @param scrapedPrice - Successfully scraped price
     * @param currency - Price currency
     */
    async handleManualPriceOverride(
        competitorProductId: string,
        scrapedPrice: number,
        currency: string
    ): Promise<void> {
        try {
            // Check if product has a manual price
            const product = await prisma.product.findUnique({
                where: { id: competitorProductId },
                select: {
                    id: true,
                    isManualPrice: true,
                    manualPrice: true,
                    currentPrice: true,
                    title: true,
                },
            });

            if (!product) {
                logger.warn('[ScrapeOrchestrator] Product not found for manual price override', {
                    competitorProductId,
                });
                return;
            }

            // If product has a manual price, replace it with scraped price
            if (product.isManualPrice && product.manualPrice) {
                logger.info('[ScrapeOrchestrator] Replacing manual price with scraped price', {
                    competitorProductId,
                    manualPrice: product.manualPrice.toString(),
                    scrapedPrice,
                    productTitle: product.title,
                });

                // Update product to use scraped price
                await prisma.product.update({
                    where: { id: competitorProductId },
                    data: {
                        currentPrice: scrapedPrice,
                        currency: currency,
                        isManualPrice: false,
                        // Keep manual price fields for history
                        // manualPrice, manualPriceEnteredBy, manualPriceEnteredAt remain unchanged
                        updatedAt: new Date(),
                    },
                });

                // Create price history entry for the scraped price
                await prisma.priceHistory.create({
                    data: {
                        productId: competitorProductId,
                        price: scrapedPrice,
                        recordedAt: new Date(),
                    },
                });

                logger.info('[ScrapeOrchestrator] Manual price successfully replaced', {
                    competitorProductId,
                    newPrice: scrapedPrice,
                });
            }
        } catch (error) {
            logger.error('[ScrapeOrchestrator] Error handling manual price override', {
                competitorProductId,
                error: error instanceof Error ? error.message : 'Unknown error',
            });
            // Don't throw - this is a non-critical operation
        }
    }

    /**
     * Cleanup resources
     */
    async cleanup(): Promise<void> {
        await this.browserScraper.close();
    }

    /**
     * Get base URL for API detection
     * 
     * Tries to get a product listing page URL for better API detection.
     * Falls back to the product URL if no listing page is available.
     * 
     * @param competitorWebsiteId - Competitor website ID
     * @param productUrl - Product URL
     * @returns Base URL for detection
     */
    private async getBaseUrlForDetection(competitorWebsiteId: string, productUrl: string): Promise<string> {
        try {
            // Try to get the base URL from Site (competitor website)
            const website = await prisma.site.findUnique({
                where: { id: competitorWebsiteId },
                select: { baseUrl: true },
            });

            if (website?.baseUrl) {
                // Use base URL with a common product listing path
                const baseUrl = website.baseUrl.replace(/\/$/, '');

                // Try common listing paths
                const listingPaths = ['/products', '/shop', '/catalog', '/store'];

                for (const path of listingPaths) {
                    const testUrl = `${baseUrl}${path}`;

                    // Quick check if path exists
                    try {
                        const response = await fetch(testUrl, { method: 'HEAD', signal: AbortSignal.timeout(5000) });
                        if (response.ok) {
                            logger.info('[ScrapeOrchestrator] Found product listing page', {
                                url: testUrl,
                            });
                            return testUrl;
                        }
                    } catch {
                        // Continue to next path
                    }
                }

                // If no listing page found, use base URL
                return baseUrl;
            }
        } catch (error) {
            logger.warn('[ScrapeOrchestrator] Failed to get base URL for detection', {
                error: error instanceof Error ? error.message : 'Unknown error',
            });
        }

        // Fallback to product URL
        return productUrl;
    }

    /**
     * Find matching product in API response
     * 
     * Attempts to match a product from the API response to the requested URL.
     * Uses URL matching, SKU matching, or takes the first product if only one is returned.
     * 
     * @param products - Products from API response
     * @param requestUrl - Requested product URL
     * @returns Matching product or null
     */
    private findMatchingProduct(products: APIProduct[], requestUrl: string): APIProduct | null {
        if (products.length === 0) {
            return null;
        }

        // If only one product, return it
        if (products.length === 1) {
            return products[0];
        }

        // Try to match by URL
        const urlMatch = products.find(p => p.url && requestUrl.includes(p.url));
        if (urlMatch) {
            return urlMatch;
        }

        // Try to match by SKU in URL
        const urlParts = requestUrl.split('/');
        const lastPart = urlParts[urlParts.length - 1];

        const skuMatch = products.find(p => {
            if (!p.sku) return false;
            return lastPart.includes(p.sku) || p.sku.includes(lastPart);
        });

        if (skuMatch) {
            return skuMatch;
        }

        // Return first product as fallback
        logger.warn('[ScrapeOrchestrator] Could not match product, using first result', {
            requestUrl,
            productsCount: products.length,
        });

        return products[0];
    }
}

/**
 * Internal attempt result interface
 */
interface AttemptResult {
    success: boolean;
    price?: number;
    currency?: string;
    protectionDetected: boolean;
    protectionType?: ProtectionType;
    failureType?: ScrapeFailureType;
    proxyId?: string;
    screenshot?: Buffer;
    errorMessage?: string;
    statusCode?: number;
    responseTimeMs?: number;
    userAgent: string;
    responseSizeBytes?: number;
}
