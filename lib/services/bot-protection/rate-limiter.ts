/**
 * Rate Limiter for Bot Protection Handling
 * 
 * Implements rate limiting with exponential backoff for scraping operations.
 * Tracks per-site rate limits, consecutive failures, and enforces delays.
 * Supports configurable rate limits per site from database.
 * 
 * Requirements: 4.1, 4.4, 4.5
 */

import { logger } from '@/lib/logger';
import { prisma } from '@/lib/prisma';
import { calculateDelay } from './backoff-calculator';

/**
 * Rate limit configuration interface
 */
export interface RateLimitConfig {
    baseDelay: number; // milliseconds
    maxDelay: number; // milliseconds
    backoffMultiplier: number;
    jitterRange: number; // percentage
}

/**
 * Site rate limit state
 */
interface SiteRateLimitState {
    lastRequestTime: Date | null;
    consecutiveFailures: number;
    nextAvailableTime: Date;
    config: RateLimitConfig;
}

/**
 * Default rate limit configuration
 */
const DEFAULT_CONFIG: RateLimitConfig = {
    baseDelay: 2000, // 2 seconds
    maxDelay: 300000, // 5 minutes
    backoffMultiplier: 2.0,
    jitterRange: 20, // 20%
};

/**
 * Protection type enum for failure recording
 */
export enum ProtectionType {
    IP_BLOCK = 'ip_block',
    RATE_LIMIT = 'rate_limit',
    CAPTCHA = 'captcha',
    FAKE_DATA = 'fake_data',
    REDIRECT_BLOCK = 'redirect_block',
    DELAYED_RESPONSE = 'delayed_response',
    EMPTY_RESPONSE = 'empty_response',
    JAVASCRIPT_CHALLENGE = 'javascript_challenge',
    UNKNOWN = 'unknown'
}

/**
 * RateLimiter class
 * 
 * Manages rate limiting for scraping operations with exponential backoff.
 * Supports per-site rate limiting with configurable delays from database.
 * 
 * Requirements: 4.1, 4.4, 4.5
 */
export class RateLimiter {
    private siteStates: Map<string, SiteRateLimitState> = new Map();
    private configCache: Map<string, RateLimitConfig> = new Map();
    private configCacheTTL: number = 300000; // 5 minutes
    private configCacheTimestamps: Map<string, number> = new Map();

    /**
     * Load rate limit configuration for a competitor website from database
     * 
     * Loads configuration from scraping_configs table if available,
     * otherwise uses default configuration.
     * Implements caching to reduce database queries.
     * 
     * Requirements: 4.1, 4.4, 4.5
     * 
     * @param competitorWebsiteId - The competitor website ID
     * @returns Rate limit configuration
     */
    private async loadSiteConfig(competitorWebsiteId: string): Promise<RateLimitConfig> {
        // Check cache first
        const cached = this.configCache.get(competitorWebsiteId);
        const cacheTimestamp = this.configCacheTimestamps.get(competitorWebsiteId);

        if (cached && cacheTimestamp && Date.now() - cacheTimestamp < this.configCacheTTL) {
            logger.debug(`Using cached rate limit config for site ${competitorWebsiteId}`);
            return cached;
        }

        try {
            // Load from database
            const scrapingConfig = await prisma.scrapingConfig.findUnique({
                where: { competitorWebsiteId },
                select: {
                    baseDelayMs: true,
                    maxDelayMs: true,
                    backoffMultiplier: true,
                },
            });

            if (scrapingConfig) {
                const config: RateLimitConfig = {
                    baseDelay: scrapingConfig.baseDelayMs,
                    maxDelay: scrapingConfig.maxDelayMs,
                    backoffMultiplier: Number(scrapingConfig.backoffMultiplier),
                    jitterRange: 20, // Default jitter
                };

                // Update cache
                this.configCache.set(competitorWebsiteId, config);
                this.configCacheTimestamps.set(competitorWebsiteId, Date.now());

                logger.debug(
                    `Loaded rate limit config from database for site ${competitorWebsiteId}`,
                    { config }
                );

                return config;
            }
        } catch (error) {
            logger.error(
                `Failed to load rate limit config for site ${competitorWebsiteId}`,
                { error }
            );
        }

        // Use default config if not found or error occurred
        logger.debug(
            `Using default rate limit config for site ${competitorWebsiteId}`
        );
        return DEFAULT_CONFIG;
    }

    /**
     * Acquire permission to make a request to a competitor website
     * 
     * Enforces delay based on:
     * - Minimum delay between requests (per-site configuration)
     * - Exponential backoff for consecutive failures
     * - Jitter randomization
     * 
     * Loads per-site configuration from database if available.
     * 
     * Requirements: 4.1, 4.4, 4.5
     * 
     * @param competitorWebsiteId - The competitor website ID
     * @param config - Optional rate limit configuration (uses site config or default if not provided)
     * @returns Promise that resolves when permission is granted
     */
    async acquirePermit(
        competitorWebsiteId: string,
        config?: RateLimitConfig
    ): Promise<void> {
        // Load site-specific config if not provided
        if (!config) {
            config = await this.loadSiteConfig(competitorWebsiteId);
        }

        const state = this.getOrCreateState(competitorWebsiteId, config);
        const now = new Date();

        // Calculate required delay based on consecutive failures
        const delay = this.calculateDelay(state.consecutiveFailures, config);

        // Calculate next available time based on last request time
        const nextAvailable = new Date(
            (state.lastRequestTime?.getTime() || 0) + delay
        );

        // Update next available time
        state.nextAvailableTime = nextAvailable;

        // Wait if necessary
        const waitTime = nextAvailable.getTime() - now.getTime();
        if (waitTime > 0) {
            logger.debug(
                `Rate limiting: waiting ${waitTime}ms for site ${competitorWebsiteId}`,
                {
                    consecutiveFailures: state.consecutiveFailures,
                    delay,
                    baseDelay: config.baseDelay,
                    maxDelay: config.maxDelay,
                }
            );
            await new Promise((resolve) => setTimeout(resolve, waitTime));
        }

        // Update last request time
        state.lastRequestTime = new Date();

        logger.debug(`Permit acquired for site ${competitorWebsiteId}`, {
            consecutiveFailures: state.consecutiveFailures,
            delay,
            config,
        });
    }

    /**
     * Record a failure for a competitor website
     * 
     * Increments consecutive failure count, which increases backoff delay.
     * Increases delay more aggressively for rate limit failures.
     * 
     * Requirements: 4.1, 4.4, 4.5
     * 
     * @param competitorWebsiteId - The competitor website ID
     * @param protectionType - Optional protection type detected (increases delay for rate limits)
     */
    async recordFailure(
        competitorWebsiteId: string,
        protectionType?: ProtectionType
    ): Promise<void> {
        // Load site-specific config
        const config = await this.loadSiteConfig(competitorWebsiteId);
        const state = this.getOrCreateState(competitorWebsiteId, config);

        // Increment failure count
        state.consecutiveFailures += 1;

        // If rate limit detected, increase delay more aggressively
        if (protectionType === ProtectionType.RATE_LIMIT) {
            // Add extra penalty for rate limit failures
            state.consecutiveFailures += 1;

            logger.info(
                `Recorded rate limit failure for site ${competitorWebsiteId}`,
                {
                    consecutiveFailures: state.consecutiveFailures,
                    protectionType,
                }
            );
        } else {
            logger.info(
                `Recorded failure for site ${competitorWebsiteId}`,
                {
                    consecutiveFailures: state.consecutiveFailures,
                    protectionType: protectionType || 'unknown',
                }
            );
        }
    }

    /**
     * Record a success for a competitor website
     * 
     * Resets consecutive failure count, reducing backoff delay.
     * 
     * Requirements: 4.1, 4.4
     * 
     * @param competitorWebsiteId - The competitor website ID
     */
    async recordSuccess(competitorWebsiteId: string): Promise<void> {
        // Load site-specific config
        const config = await this.loadSiteConfig(competitorWebsiteId);
        const state = this.getOrCreateState(competitorWebsiteId, config);
        const previousFailures = state.consecutiveFailures;
        state.consecutiveFailures = 0;

        if (previousFailures > 0) {
            logger.info(
                `Recorded success for site ${competitorWebsiteId}, reset failure count`,
                { previousFailures }
            );
        }
    }

    /**
     * Get the next available time for a request to a competitor website
     * 
     * Requirements: 4.1, 4.4
     * 
     * @param competitorWebsiteId - The competitor website ID
     * @returns The next available time for a request
     */
    async getNextAvailableTime(competitorWebsiteId: string): Promise<Date> {
        const state = this.siteStates.get(competitorWebsiteId);

        if (!state) {
            // No state means no previous requests, available immediately
            return new Date();
        }

        return state.nextAvailableTime;
    }

    /**
     * Calculate delay based on consecutive failures and configuration
     * 
     * Uses the backoff calculator to implement exponential backoff with jitter.
     * 
     * Requirements: 4.2, 4.3, 4.6
     * 
     * @param consecutiveFailures - Number of consecutive failures
     * @param config - Rate limit configuration
     * @returns Calculated delay in milliseconds
     */
    private calculateDelay(
        consecutiveFailures: number,
        config: RateLimitConfig
    ): number {
        return calculateDelay(consecutiveFailures, config);
    }

    /**
     * Get or create rate limit state for a competitor website
     * 
     * @param competitorWebsiteId - The competitor website ID
     * @param config - Rate limit configuration
     * @returns Site rate limit state
     */
    private getOrCreateState(
        competitorWebsiteId: string,
        config: RateLimitConfig
    ): SiteRateLimitState {
        let state = this.siteStates.get(competitorWebsiteId);

        if (!state) {
            state = {
                lastRequestTime: null,
                consecutiveFailures: 0,
                nextAvailableTime: new Date(),
                config,
            };
            this.siteStates.set(competitorWebsiteId, state);
        } else {
            // Update config if provided
            state.config = config;
        }

        return state;
    }

    /**
     * Reset rate limit state for a specific competitor website
     * 
     * Clears both state and cached configuration.
     * 
     * @param competitorWebsiteId - The competitor website ID
     */
    reset(competitorWebsiteId: string): void {
        this.siteStates.delete(competitorWebsiteId);
        this.configCache.delete(competitorWebsiteId);
        this.configCacheTimestamps.delete(competitorWebsiteId);
        logger.debug(`Reset rate limit state for site ${competitorWebsiteId}`);
    }

    /**
     * Reset all rate limit states and cached configurations
     */
    resetAll(): void {
        this.siteStates.clear();
        this.configCache.clear();
        this.configCacheTimestamps.clear();
        logger.debug('Reset all rate limit states');
    }

    /**
     * Clear cached configuration for a specific competitor website
     * 
     * Forces reload of configuration from database on next request.
     * Useful when configuration is updated.
     * 
     * Requirements: 4.5
     * 
     * @param competitorWebsiteId - The competitor website ID
     */
    clearConfigCache(competitorWebsiteId: string): void {
        this.configCache.delete(competitorWebsiteId);
        this.configCacheTimestamps.delete(competitorWebsiteId);
        logger.debug(`Cleared config cache for site ${competitorWebsiteId}`);
    }

    /**
     * Clear all cached configurations
     * 
     * Forces reload of all configurations from database on next requests.
     */
    clearAllConfigCache(): void {
        this.configCache.clear();
        this.configCacheTimestamps.clear();
        logger.debug('Cleared all config cache');
    }

    /**
     * Get current consecutive failure count for a competitor website
     * 
     * @param competitorWebsiteId - The competitor website ID
     * @returns Consecutive failure count
     */
    getConsecutiveFailures(competitorWebsiteId: string): number {
        const state = this.siteStates.get(competitorWebsiteId);
        return state?.consecutiveFailures || 0;
    }
}
