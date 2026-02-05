/**
 * Strategy Adaptation Service
 * 
 * Tracks scraping success patterns and automatically adapts site configurations
 * to improve success rates. Switches to headless browser when HTTP scraping
 * consistently fails.
 * 
 * Requirements: 6.6
 */

import { logger } from '@/lib/logger';
import { prisma } from '@/lib/prisma';
import { ScrapingStrategy } from './strategy-selector';
import { ProtectionType } from './detection-engine';

/**
 * Adaptation thresholds and configuration
 */
export interface AdaptationConfig {
    /**
     * Minimum number of attempts before adapting
     */
    minAttemptsBeforeAdaptation: number;

    /**
     * Success rate threshold below which to adapt (0-1)
     */
    successRateThreshold: number;

    /**
     * Time window for analysis (hours)
     */
    analysisWindowHours: number;

    /**
     * Whether to enable automatic adaptation
     */
    enableAutoAdaptation: boolean;
}

const DEFAULT_CONFIG: AdaptationConfig = {
    minAttemptsBeforeAdaptation: 10,
    successRateThreshold: 0.5, // 50%
    analysisWindowHours: 24,
    enableAutoAdaptation: true,
};

/**
 * Pattern analysis result
 */
export interface PatternAnalysis {
    competitorWebsiteId: string;
    totalAttempts: number;
    successfulAttempts: number;
    failedAttempts: number;
    successRate: number;
    currentStrategy: ScrapingStrategy;
    recommendedStrategy: ScrapingStrategy;
    shouldAdapt: boolean;
    reasoning: string;
    protectionTypeBreakdown: Record<string, number>;
}

/**
 * StrategyAdaptationService class
 * 
 * Analyzes scraping patterns and automatically adapts strategies
 * to improve success rates.
 */
export class StrategyAdaptationService {
    private config: AdaptationConfig;

    constructor(config: Partial<AdaptationConfig> = {}) {
        this.config = { ...DEFAULT_CONFIG, ...config };
    }

    /**
     * Analyze scraping patterns for a competitor website
     * 
     * Examines recent scrape attempts to determine if strategy adaptation
     * is needed. Returns analysis with recommendations.
     * 
     * Requirements: 6.6
     * 
     * @param competitorWebsiteId - ID of the competitor website
     * @returns Pattern analysis with recommendations
     */
    async analyzePatterns(competitorWebsiteId: string): Promise<PatternAnalysis> {
        logger.info('[StrategyAdaptation] Analyzing patterns', {
            competitorWebsiteId,
        });

        // Get current configuration
        const config = await prisma.scrapingConfig.findUnique({
            where: { competitorWebsiteId },
        });

        const currentStrategy = (config?.preferredStrategy as ScrapingStrategy) || ScrapingStrategy.HTTP_CLIENT;

        // Calculate time window
        const windowStart = new Date();
        windowStart.setHours(windowStart.getHours() - this.config.analysisWindowHours);

        // Get recent scrape attempts
        const attempts = await prisma.scrapeAttempt.findMany({
            where: {
                competitorWebsiteId,
                createdAt: {
                    gte: windowStart,
                },
            },
            select: {
                success: true,
                protectionDetected: true,
                protectionType: true,
                strategy: true,
            },
        });

        // Calculate statistics
        const totalAttempts = attempts.length;
        const successfulAttempts = attempts.filter(a => a.success).length;
        const failedAttempts = totalAttempts - successfulAttempts;
        const successRate = totalAttempts > 0 ? successfulAttempts / totalAttempts : 0;

        // Analyze protection types
        const protectionTypeBreakdown: Record<string, number> = {};
        attempts.forEach(attempt => {
            if (attempt.protectionDetected && attempt.protectionType) {
                protectionTypeBreakdown[attempt.protectionType] =
                    (protectionTypeBreakdown[attempt.protectionType] || 0) + 1;
            }
        });

        // Determine if adaptation is needed
        const shouldAdapt = this.shouldAdaptStrategy(
            totalAttempts,
            successRate,
            currentStrategy,
            protectionTypeBreakdown
        );

        // Recommend new strategy
        const recommendedStrategy = shouldAdapt
            ? this.recommendStrategy(currentStrategy, protectionTypeBreakdown)
            : currentStrategy;

        // Generate reasoning
        const reasoning = this.generateReasoning(
            totalAttempts,
            successRate,
            currentStrategy,
            recommendedStrategy,
            protectionTypeBreakdown
        );

        const analysis: PatternAnalysis = {
            competitorWebsiteId,
            totalAttempts,
            successfulAttempts,
            failedAttempts,
            successRate,
            currentStrategy,
            recommendedStrategy,
            shouldAdapt,
            reasoning,
            protectionTypeBreakdown,
        };

        logger.info('[StrategyAdaptation] Pattern analysis complete', {
            competitorWebsiteId,
            successRate: `${(successRate * 100).toFixed(1)}%`,
            shouldAdapt,
            recommendedStrategy,
        });

        return analysis;
    }

    /**
     * Automatically adapt strategy for a competitor website
     * 
     * Analyzes patterns and updates the site configuration if adaptation
     * is recommended and auto-adaptation is enabled.
     * 
     * Requirements: 6.6
     * 
     * @param competitorWebsiteId - ID of the competitor website
     * @returns True if strategy was adapted
     */
    async adaptStrategy(competitorWebsiteId: string): Promise<boolean> {
        if (!this.config.enableAutoAdaptation) {
            logger.info('[StrategyAdaptation] Auto-adaptation disabled', {
                competitorWebsiteId,
            });
            return false;
        }

        // Analyze patterns
        const analysis = await this.analyzePatterns(competitorWebsiteId);

        // Check if adaptation is needed
        if (!analysis.shouldAdapt) {
            logger.info('[StrategyAdaptation] No adaptation needed', {
                competitorWebsiteId,
                successRate: `${(analysis.successRate * 100).toFixed(1)}%`,
            });
            return false;
        }

        // Update configuration
        try {
            await this.updateSiteConfiguration(
                competitorWebsiteId,
                analysis.recommendedStrategy
            );

            logger.info('[StrategyAdaptation] Strategy adapted successfully', {
                competitorWebsiteId,
                oldStrategy: analysis.currentStrategy,
                newStrategy: analysis.recommendedStrategy,
                reasoning: analysis.reasoning,
            });

            return true;
        } catch (error) {
            logger.error('[StrategyAdaptation] Failed to adapt strategy', {
                competitorWebsiteId,
                error: error instanceof Error ? error.message : String(error),
            });
            return false;
        }
    }

    /**
     * Batch adapt strategies for all competitor websites
     * 
     * Analyzes and adapts strategies for all active competitor websites.
     * 
     * @returns Number of sites adapted
     */
    async adaptAllSites(): Promise<number> {
        logger.info('[StrategyAdaptation] Starting batch adaptation');

        // Get all competitor websites
        const sites = await prisma.site.findMany({
            where: {
                type: 'COMPETITOR',
            },
            select: {
                id: true,
                baseUrl: true,
            },
        });

        let adaptedCount = 0;

        for (const site of sites) {
            try {
                const adapted = await this.adaptStrategy(site.id);
                if (adapted) {
                    adaptedCount++;
                }
            } catch (error) {
                logger.error('[StrategyAdaptation] Failed to adapt site', {
                    siteId: site.id,
                    baseUrl: site.baseUrl,
                    error: error instanceof Error ? error.message : String(error),
                });
            }
        }

        logger.info('[StrategyAdaptation] Batch adaptation complete', {
            totalSites: sites.length,
            adaptedCount,
        });

        return adaptedCount;
    }

    /**
     * Determine if strategy should be adapted
     * 
     * @param totalAttempts - Total number of attempts
     * @param successRate - Success rate (0-1)
     * @param currentStrategy - Current scraping strategy
     * @param protectionTypeBreakdown - Protection type counts
     * @returns True if strategy should be adapted
     */
    private shouldAdaptStrategy(
        totalAttempts: number,
        successRate: number,
        currentStrategy: ScrapingStrategy,
        protectionTypeBreakdown: Record<string, number>
    ): boolean {
        // Need minimum attempts before adapting
        if (totalAttempts < this.config.minAttemptsBeforeAdaptation) {
            return false;
        }

        // Success rate below threshold
        if (successRate < this.config.successRateThreshold) {
            return true;
        }

        // Check for specific protection types that require browser
        const requiresBrowser = this.requiresBrowserStrategy(protectionTypeBreakdown);
        if (requiresBrowser && !this.isBrowserStrategy(currentStrategy)) {
            return true;
        }

        return false;
    }

    /**
     * Recommend a new strategy based on patterns
     * 
     * @param currentStrategy - Current scraping strategy
     * @param protectionTypeBreakdown - Protection type counts
     * @returns Recommended strategy
     */
    private recommendStrategy(
        currentStrategy: ScrapingStrategy,
        protectionTypeBreakdown: Record<string, number>
    ): ScrapingStrategy {
        // Check if JavaScript challenge is common
        const jsChallenge = protectionTypeBreakdown[ProtectionType.JAVASCRIPT_CHALLENGE] || 0;
        const captcha = protectionTypeBreakdown[ProtectionType.CAPTCHA] || 0;

        // If JavaScript challenges or CAPTCHAs are common, use stealth browser
        if (jsChallenge > 0 || captcha > 0) {
            return ScrapingStrategy.STEALTH_BROWSER;
        }

        // Check if IP blocking is common
        const ipBlock = protectionTypeBreakdown[ProtectionType.IP_BLOCK] || 0;
        if (ipBlock > 0) {
            // If already using browser, add proxy
            if (this.isBrowserStrategy(currentStrategy)) {
                return ScrapingStrategy.HEADLESS_WITH_PROXY;
            }
            // Otherwise, try HTTP with proxy first
            return ScrapingStrategy.HTTP_WITH_PROXY;
        }

        // Check if fake data is common (requires browser to execute JS)
        const fakeData = protectionTypeBreakdown[ProtectionType.FAKE_DATA] || 0;
        if (fakeData > 0) {
            return ScrapingStrategy.HEADLESS_BROWSER;
        }

        // Default progression: HTTP -> HTTP+Proxy -> Browser -> Browser+Proxy -> Stealth
        switch (currentStrategy) {
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
                return ScrapingStrategy.STEALTH_BROWSER;
            default:
                return ScrapingStrategy.HTTP_CLIENT;
        }
    }

    /**
     * Check if protection types require browser strategy
     * 
     * @param protectionTypeBreakdown - Protection type counts
     * @returns True if browser strategy is required
     */
    private requiresBrowserStrategy(protectionTypeBreakdown: Record<string, number>): boolean {
        const jsChallenge = protectionTypeBreakdown[ProtectionType.JAVASCRIPT_CHALLENGE] || 0;
        const captcha = protectionTypeBreakdown[ProtectionType.CAPTCHA] || 0;
        const fakeData = protectionTypeBreakdown[ProtectionType.FAKE_DATA] || 0;

        return jsChallenge > 0 || captcha > 0 || fakeData > 0;
    }

    /**
     * Check if strategy is browser-based
     * 
     * @param strategy - Scraping strategy
     * @returns True if browser-based
     */
    private isBrowserStrategy(strategy: ScrapingStrategy): boolean {
        return (
            strategy === ScrapingStrategy.HEADLESS_BROWSER ||
            strategy === ScrapingStrategy.HEADLESS_WITH_PROXY ||
            strategy === ScrapingStrategy.STEALTH_BROWSER
        );
    }

    /**
     * Generate reasoning for adaptation decision
     * 
     * @param _totalAttempts - Total attempts
     * @param successRate - Success rate
     * @param currentStrategy - Current strategy
     * @param recommendedStrategy - Recommended strategy
     * @param protectionTypeBreakdown - Protection type counts
     * @returns Reasoning string
     */
    private generateReasoning(
        _totalAttempts: number,
        successRate: number,
        currentStrategy: ScrapingStrategy,
        recommendedStrategy: ScrapingStrategy,
        protectionTypeBreakdown: Record<string, number>
    ): string {
        if (currentStrategy === recommendedStrategy) {
            return `Current strategy (${currentStrategy}) is performing well with ${(successRate * 100).toFixed(1)}% success rate.`;
        }

        const reasons: string[] = [];

        // Success rate reason
        if (successRate < this.config.successRateThreshold) {
            reasons.push(
                `Success rate (${(successRate * 100).toFixed(1)}%) is below threshold (${(this.config.successRateThreshold * 100).toFixed(1)}%)`
            );
        }

        // Protection type reasons
        const jsChallenge = protectionTypeBreakdown[ProtectionType.JAVASCRIPT_CHALLENGE] || 0;
        const captcha = protectionTypeBreakdown[ProtectionType.CAPTCHA] || 0;
        const ipBlock = protectionTypeBreakdown[ProtectionType.IP_BLOCK] || 0;
        const fakeData = protectionTypeBreakdown[ProtectionType.FAKE_DATA] || 0;

        if (jsChallenge > 0) {
            reasons.push(`Detected ${jsChallenge} JavaScript challenges`);
        }
        if (captcha > 0) {
            reasons.push(`Detected ${captcha} CAPTCHA challenges`);
        }
        if (ipBlock > 0) {
            reasons.push(`Detected ${ipBlock} IP blocks`);
        }
        if (fakeData > 0) {
            reasons.push(`Detected ${fakeData} fake data responses`);
        }

        const reasonText = reasons.join('; ');
        return `Adapting from ${currentStrategy} to ${recommendedStrategy}. Reasons: ${reasonText}`;
    }

    /**
     * Update site configuration with new strategy
     * 
     * @param competitorWebsiteId - ID of the competitor website
     * @param strategy - New scraping strategy
     */
    private async updateSiteConfiguration(
        competitorWebsiteId: string,
        strategy: ScrapingStrategy
    ): Promise<void> {
        // Check if configuration exists
        const existing = await prisma.scrapingConfig.findUnique({
            where: { competitorWebsiteId },
        });

        if (existing) {
            // Update existing configuration
            await prisma.scrapingConfig.update({
                where: { competitorWebsiteId },
                data: {
                    preferredStrategy: strategy,
                    requiresJavascript: this.isBrowserStrategy(strategy),
                    updatedAt: new Date(),
                },
            });
        } else {
            // Create new configuration
            // Get tenant ID from site
            const site = await prisma.site.findUnique({
                where: { id: competitorWebsiteId },
                select: { tenantId: true },
            });

            if (!site) {
                throw new Error(`Site not found: ${competitorWebsiteId}`);
            }

            await prisma.scrapingConfig.create({
                data: {
                    tenantId: site.tenantId,
                    competitorWebsiteId,
                    preferredStrategy: strategy,
                    requiresJavascript: this.isBrowserStrategy(strategy),
                    priceSelectors: ['[itemprop="price"]', '.price', '.product-price'],
                },
            });
        }

        logger.info('[StrategyAdaptation] Configuration updated', {
            competitorWebsiteId,
            strategy,
        });
    }
}

/**
 * Run strategy adaptation for all sites (for cron execution)
 * 
 * Example cron schedule: 0 *\/6 * * * (every 6 hours)
 */
export async function runStrategyAdaptation(): Promise<number> {
    const service = new StrategyAdaptationService();
    return await service.adaptAllSites();
}
