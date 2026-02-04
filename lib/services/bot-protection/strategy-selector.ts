/**
 * Strategy Selector for Bot Protection Handling
 * 
 * Selects appropriate scraping strategies based on site configuration,
 * history, and previous failures. Implements retry strategy selection
 * based on detected protection types.
 * 
 * Requirements: 7.1, 7.3, 7.4, 7.5, 7.7
 */

import { logger } from '@/lib/logger';
import { ProtectionType } from './detection-engine';

/**
 * Available scraping strategies
 */
export enum ScrapingStrategy {
    HTTP_CLIENT = 'http_client',
    HTTP_WITH_PROXY = 'http_with_proxy',
    HEADLESS_BROWSER = 'headless_browser',
    HEADLESS_WITH_PROXY = 'headless_with_proxy',
    STEALTH_BROWSER = 'stealth_browser'
}

/**
 * Rate limit configuration interface
 */
export interface RateLimitConfig {
    baseDelay: number;
    maxDelay: number;
    backoffMultiplier: number;
    jitterRange: number;
}

/**
 * Selector configuration for price extraction
 */
export interface SelectorConfig {
    priceSelectors: string[];
    currencySelector?: string;
    fallbackRegex?: string;
}

/**
 * Site configuration for scraping
 */
export interface SiteConfiguration {
    preferredStrategy: ScrapingStrategy;
    requiresJavaScript: boolean;
    rateLimit: RateLimitConfig;
    proxyRequired: boolean;
    customSelectors: SelectorConfig;
    maxRetries: number;
}

/**
 * Scrape attempt information
 */
export interface ScrapeAttempt {
    id: string;
    strategy: ScrapingStrategy;
    success: boolean;
    protectionDetected: boolean;
    protectionType?: ProtectionType;
    timestamp: Date;
}

/**
 * Context for strategy selection
 */
export interface StrategyContext {
    competitorWebsiteId: string;
    siteConfig: SiteConfiguration;
    recentHistory: ScrapeAttempt[];
    currentAttempt: number;
}

/**
 * Context for retry strategy selection after failure
 */
export interface FailureContext extends StrategyContext {
    lastProtectionType: ProtectionType;
    lastStrategy: ScrapingStrategy;
}

/**
 * StrategySelector class
 * 
 * Responsible for selecting appropriate scraping strategies based on
 * site configuration, history, and failure types.
 */
export class StrategySelector {
    /**
     * Select strategy for a scrape attempt
     * 
     * For first attempt, uses configured preferred strategy.
     * For subsequent attempts, considers history and failure patterns.
     * 
     * Requirements: 7.1
     * 
     * @param context - Strategy selection context
     * @returns Selected scraping strategy
     */
    selectStrategy(context: StrategyContext): ScrapingStrategy {
        logger.debug('[StrategySelector] Selecting strategy', {
            competitorWebsiteId: context.competitorWebsiteId,
            currentAttempt: context.currentAttempt,
            preferredStrategy: context.siteConfig.preferredStrategy,
        });

        // First attempt: use configured preferred strategy
        if (context.currentAttempt === 1) {
            const strategy = context.siteConfig.preferredStrategy;
            logger.info('[StrategySelector] First attempt, using preferred strategy', {
                strategy,
                competitorWebsiteId: context.competitorWebsiteId,
            });
            return strategy;
        }

        // Subsequent attempts: analyze recent history
        // If site requires JavaScript, prefer browser-based strategies
        if (context.siteConfig.requiresJavaScript) {
            // Check if we've tried headless browser yet
            const triedHeadless = context.recentHistory.some(
                attempt => attempt.strategy === ScrapingStrategy.HEADLESS_BROWSER ||
                    attempt.strategy === ScrapingStrategy.HEADLESS_WITH_PROXY ||
                    attempt.strategy === ScrapingStrategy.STEALTH_BROWSER
            );

            if (!triedHeadless) {
                logger.info('[StrategySelector] Site requires JavaScript, trying headless browser', {
                    competitorWebsiteId: context.competitorWebsiteId,
                });
                return context.siteConfig.proxyRequired
                    ? ScrapingStrategy.HEADLESS_WITH_PROXY
                    : ScrapingStrategy.HEADLESS_BROWSER;
            }
        }

        // Check if proxy is required but not yet used
        if (context.siteConfig.proxyRequired) {
            const triedProxy = context.recentHistory.some(
                attempt => attempt.strategy === ScrapingStrategy.HTTP_WITH_PROXY ||
                    attempt.strategy === ScrapingStrategy.HEADLESS_WITH_PROXY
            );

            if (!triedProxy) {
                logger.info('[StrategySelector] Proxy required, trying with proxy', {
                    competitorWebsiteId: context.competitorWebsiteId,
                });
                return ScrapingStrategy.HTTP_WITH_PROXY;
            }
        }

        // Default: return preferred strategy
        return context.siteConfig.preferredStrategy;
    }

    /**
     * Select retry strategy based on failure type
     * 
     * Implements strategy escalation based on detected protection:
     * - IP block → switch proxy
     * - Rate limit → increase delay (handled by rate limiter)
     * - Fake data → upgrade to headless browser
     * - JavaScript challenge → use stealth browser
     * - CAPTCHA → no retry (return null)
     * 
     * Requirements: 7.1, 7.3, 7.4, 7.5, 7.7
     * 
     * @param failureContext - Failure context with protection type
     * @returns Selected retry strategy or null if retries exhausted
     */
    selectRetryStrategy(failureContext: FailureContext): ScrapingStrategy | null {
        logger.debug('[StrategySelector] Selecting retry strategy', {
            competitorWebsiteId: failureContext.competitorWebsiteId,
            lastProtectionType: failureContext.lastProtectionType,
            lastStrategy: failureContext.lastStrategy,
            currentAttempt: failureContext.currentAttempt,
            maxRetries: failureContext.siteConfig.maxRetries,
        });

        // Check if max retries exceeded
        if (failureContext.currentAttempt >= failureContext.siteConfig.maxRetries) {
            logger.warn('[StrategySelector] Max retries exceeded, giving up', {
                competitorWebsiteId: failureContext.competitorWebsiteId,
                currentAttempt: failureContext.currentAttempt,
                maxRetries: failureContext.siteConfig.maxRetries,
            });
            return null;
        }

        // CAPTCHA detected: no retry (Requirement 7.7)
        if (failureContext.lastProtectionType === ProtectionType.CAPTCHA) {
            logger.warn('[StrategySelector] CAPTCHA detected, cannot retry', {
                competitorWebsiteId: failureContext.competitorWebsiteId,
            });
            return null;
        }

        // IP block: switch to proxy or different proxy (Requirement 7.3)
        if (failureContext.lastProtectionType === ProtectionType.IP_BLOCK) {
            return this.handleIpBlockRetry(failureContext);
        }

        // Rate limit: keep same strategy, rate limiter will handle delay (Requirement 7.4)
        if (failureContext.lastProtectionType === ProtectionType.RATE_LIMIT) {
            logger.info('[StrategySelector] Rate limit detected, keeping same strategy', {
                competitorWebsiteId: failureContext.competitorWebsiteId,
                strategy: failureContext.lastStrategy,
            });
            return failureContext.lastStrategy;
        }

        // Fake data: upgrade to headless browser (Requirement 7.5)
        if (failureContext.lastProtectionType === ProtectionType.FAKE_DATA) {
            return this.handleFakeDataRetry(failureContext);
        }

        // JavaScript challenge: use stealth browser
        if (failureContext.lastProtectionType === ProtectionType.JAVASCRIPT_CHALLENGE) {
            return this.handleJavaScriptChallengeRetry(failureContext);
        }

        // Redirect block: try with proxy
        if (failureContext.lastProtectionType === ProtectionType.REDIRECT_BLOCK) {
            return this.handleRedirectBlockRetry(failureContext);
        }

        // Empty response or delayed response: try headless browser
        if (
            failureContext.lastProtectionType === ProtectionType.EMPTY_RESPONSE ||
            failureContext.lastProtectionType === ProtectionType.DELAYED_RESPONSE
        ) {
            return this.handleEmptyOrDelayedRetry(failureContext);
        }

        // Unknown protection: escalate strategy
        return this.escalateStrategy(failureContext);
    }

    /**
     * Handle retry strategy for IP block
     * 
     * Switches to proxy-based strategy or different proxy.
     * 
     * @param context - Failure context
     * @returns Retry strategy
     */
    private handleIpBlockRetry(context: FailureContext): ScrapingStrategy | null {
        logger.info('[StrategySelector] Handling IP block retry', {
            competitorWebsiteId: context.competitorWebsiteId,
            lastStrategy: context.lastStrategy,
        });

        // If not using proxy, switch to proxy
        if (
            context.lastStrategy === ScrapingStrategy.HTTP_CLIENT ||
            context.lastStrategy === ScrapingStrategy.HEADLESS_BROWSER
        ) {
            const strategy = context.lastStrategy === ScrapingStrategy.HTTP_CLIENT
                ? ScrapingStrategy.HTTP_WITH_PROXY
                : ScrapingStrategy.HEADLESS_WITH_PROXY;

            logger.info('[StrategySelector] Switching to proxy strategy', {
                competitorWebsiteId: context.competitorWebsiteId,
                newStrategy: strategy,
            });
            return strategy;
        }

        // Already using proxy, proxy manager will select different proxy
        // Keep same strategy
        logger.info('[StrategySelector] Already using proxy, will try different proxy', {
            competitorWebsiteId: context.competitorWebsiteId,
            strategy: context.lastStrategy,
        });
        return context.lastStrategy;
    }

    /**
     * Handle retry strategy for fake data detection
     * 
     * Upgrades to headless browser with different fingerprint.
     * 
     * @param context - Failure context
     * @returns Retry strategy
     */
    private handleFakeDataRetry(context: FailureContext): ScrapingStrategy | null {
        logger.info('[StrategySelector] Handling fake data retry', {
            competitorWebsiteId: context.competitorWebsiteId,
            lastStrategy: context.lastStrategy,
        });

        // If using HTTP client, upgrade to headless browser
        if (
            context.lastStrategy === ScrapingStrategy.HTTP_CLIENT ||
            context.lastStrategy === ScrapingStrategy.HTTP_WITH_PROXY
        ) {
            const strategy = context.siteConfig.proxyRequired
                ? ScrapingStrategy.HEADLESS_WITH_PROXY
                : ScrapingStrategy.HEADLESS_BROWSER;

            logger.info('[StrategySelector] Upgrading to headless browser', {
                competitorWebsiteId: context.competitorWebsiteId,
                newStrategy: strategy,
            });
            return strategy;
        }

        // Already using headless browser, try stealth mode
        if (
            context.lastStrategy === ScrapingStrategy.HEADLESS_BROWSER ||
            context.lastStrategy === ScrapingStrategy.HEADLESS_WITH_PROXY
        ) {
            logger.info('[StrategySelector] Upgrading to stealth browser', {
                competitorWebsiteId: context.competitorWebsiteId,
            });
            return ScrapingStrategy.STEALTH_BROWSER;
        }

        // Already tried stealth, no more options
        logger.warn('[StrategySelector] Already tried stealth browser, no more options', {
            competitorWebsiteId: context.competitorWebsiteId,
        });
        return null;
    }

    /**
     * Handle retry strategy for JavaScript challenge
     * 
     * Uses stealth browser to bypass challenge.
     * 
     * @param context - Failure context
     * @returns Retry strategy
     */
    private handleJavaScriptChallengeRetry(context: FailureContext): ScrapingStrategy | null {
        logger.info('[StrategySelector] Handling JavaScript challenge retry', {
            competitorWebsiteId: context.competitorWebsiteId,
            lastStrategy: context.lastStrategy,
        });

        // If not using stealth browser, upgrade to it
        if (context.lastStrategy !== ScrapingStrategy.STEALTH_BROWSER) {
            logger.info('[StrategySelector] Upgrading to stealth browser', {
                competitorWebsiteId: context.competitorWebsiteId,
            });
            return ScrapingStrategy.STEALTH_BROWSER;
        }

        // Already using stealth browser, no more options
        logger.warn('[StrategySelector] Already using stealth browser, no more options', {
            competitorWebsiteId: context.competitorWebsiteId,
        });
        return null;
    }

    /**
     * Handle retry strategy for redirect block
     * 
     * Tries with proxy to get different IP.
     * 
     * @param context - Failure context
     * @returns Retry strategy
     */
    private handleRedirectBlockRetry(context: FailureContext): ScrapingStrategy | null {
        logger.info('[StrategySelector] Handling redirect block retry', {
            competitorWebsiteId: context.competitorWebsiteId,
            lastStrategy: context.lastStrategy,
        });

        // If not using proxy, switch to proxy
        if (
            context.lastStrategy === ScrapingStrategy.HTTP_CLIENT ||
            context.lastStrategy === ScrapingStrategy.HEADLESS_BROWSER
        ) {
            const strategy = context.lastStrategy === ScrapingStrategy.HTTP_CLIENT
                ? ScrapingStrategy.HTTP_WITH_PROXY
                : ScrapingStrategy.HEADLESS_WITH_PROXY;

            logger.info('[StrategySelector] Switching to proxy strategy', {
                competitorWebsiteId: context.competitorWebsiteId,
                newStrategy: strategy,
            });
            return strategy;
        }

        // Already using proxy, try headless browser if not already
        if (context.lastStrategy === ScrapingStrategy.HTTP_WITH_PROXY) {
            logger.info('[StrategySelector] Upgrading to headless browser with proxy', {
                competitorWebsiteId: context.competitorWebsiteId,
            });
            return ScrapingStrategy.HEADLESS_WITH_PROXY;
        }

        // No more options
        return null;
    }

    /**
     * Handle retry strategy for empty or delayed response
     * 
     * Tries headless browser to handle dynamic content.
     * 
     * @param context - Failure context
     * @returns Retry strategy
     */
    private handleEmptyOrDelayedRetry(context: FailureContext): ScrapingStrategy | null {
        logger.info('[StrategySelector] Handling empty/delayed response retry', {
            competitorWebsiteId: context.competitorWebsiteId,
            lastStrategy: context.lastStrategy,
        });

        // If using HTTP client, upgrade to headless browser
        if (
            context.lastStrategy === ScrapingStrategy.HTTP_CLIENT ||
            context.lastStrategy === ScrapingStrategy.HTTP_WITH_PROXY
        ) {
            const strategy = context.siteConfig.proxyRequired
                ? ScrapingStrategy.HEADLESS_WITH_PROXY
                : ScrapingStrategy.HEADLESS_BROWSER;

            logger.info('[StrategySelector] Upgrading to headless browser', {
                competitorWebsiteId: context.competitorWebsiteId,
                newStrategy: strategy,
            });
            return strategy;
        }

        // Already using headless browser, no more options
        logger.warn('[StrategySelector] Already using headless browser, no more options', {
            competitorWebsiteId: context.competitorWebsiteId,
        });
        return null;
    }

    /**
     * Escalate strategy for unknown protection type
     * 
     * Progressively tries more sophisticated strategies.
     * 
     * @param context - Failure context
     * @returns Retry strategy
     */
    private escalateStrategy(context: FailureContext): ScrapingStrategy | null {
        logger.info('[StrategySelector] Escalating strategy for unknown protection', {
            competitorWebsiteId: context.competitorWebsiteId,
            lastStrategy: context.lastStrategy,
        });

        // Escalation path: HTTP_CLIENT → HTTP_WITH_PROXY → HEADLESS_BROWSER → HEADLESS_WITH_PROXY → STEALTH_BROWSER

        switch (context.lastStrategy) {
            case ScrapingStrategy.HTTP_CLIENT:
                return ScrapingStrategy.HTTP_WITH_PROXY;

            case ScrapingStrategy.HTTP_WITH_PROXY:
                return ScrapingStrategy.HEADLESS_BROWSER;

            case ScrapingStrategy.HEADLESS_BROWSER:
                return ScrapingStrategy.HEADLESS_WITH_PROXY;

            case ScrapingStrategy.HEADLESS_WITH_PROXY:
                return ScrapingStrategy.STEALTH_BROWSER;

            case ScrapingStrategy.STEALTH_BROWSER:
                // Already at highest level
                logger.warn('[StrategySelector] Already at highest strategy level', {
                    competitorWebsiteId: context.competitorWebsiteId,
                });
                return null;

            default:
                return null;
        }
    }
}
