/**
 * Configuration Manager Service
 * 
 * Manages loading, validation, and runtime updates of scraping configuration.
 * Handles proxy configuration from environment variables and site profile management.
 */

import { logger } from '../logger';
import { ProxyConfig } from './proxy-manager';
import { SiteProfile } from '../config/site-profiles';

export interface ScraperConfig {
    proxies: ProxyConfig[];
    siteProfiles: Record<string, SiteProfile>;
    globalDefaults: {
        maxRetries: number;
        timeout: number;
        userAgents: string[];
    };
}

export interface ConfigValidationResult {
    isValid: boolean;
    errors: string[];
    warnings: string[];
}

export class ConfigurationManager {
    private static instance: ConfigurationManager;
    private config: ScraperConfig;
    private configListeners: Array<(config: ScraperConfig) => void> = [];

    private constructor() {
        this.config = this.loadInitialConfig();
    }

    /**
     * Get singleton instance
     */
    static getInstance(): ConfigurationManager {
        if (!ConfigurationManager.instance) {
            ConfigurationManager.instance = new ConfigurationManager();
        }
        return ConfigurationManager.instance;
    }

    /**
     * Load initial configuration from environment and defaults
     */
    private loadInitialConfig(): ScraperConfig {
        logger.info('[ConfigurationManager] Loading initial configuration');

        const config: ScraperConfig = {
            proxies: this.loadProxyConfiguration(),
            siteProfiles: {}, // Start with empty, will be populated lazily or via updates
            globalDefaults: {
                maxRetries: parseInt(process.env.SCRAPER_MAX_RETRIES || '3', 10),
                timeout: parseInt(process.env.SCRAPER_TIMEOUT || '30000', 10),
                userAgents: this.loadUserAgents(),
            },
        };

        // Validate configuration on startup
        const validation = this.validateConfiguration(config);

        if (!validation.isValid) {
            logger.error('[ConfigurationManager] Configuration validation failed', {
                errors: validation.errors,
            });

            // Log each error individually
            validation.errors.forEach(error => {
                logger.error(`[ConfigurationManager] Configuration error: ${error}`);
            });
        }

        // Log warnings
        validation.warnings.forEach(warning => {
            logger.warn(`[ConfigurationManager] Configuration warning: ${warning}`);
        });

        if (validation.isValid) {
            logger.info('[ConfigurationManager] Configuration loaded successfully', {
                proxyCount: config.proxies.length,
                siteProfileCount: Object.keys(config.siteProfiles).length,
            });
        }

        return config;
    }

    /**
     * Load proxy configuration from SCRAPER_PROXIES environment variable
     * Format: "http://proxy1:port,http://proxy2:port,http://user:pass@proxy3:port"
     */
    private loadProxyConfiguration(): ProxyConfig[] {
        const proxyEnv = process.env.SCRAPER_PROXIES;

        if (!proxyEnv || proxyEnv.trim() === '') {
            logger.info('[ConfigurationManager] No proxy configuration found in SCRAPER_PROXIES');
            return [];
        }

        const proxyUrls = proxyEnv
            .split(',')
            .map(p => p.trim())
            .filter(Boolean);

        const proxies: ProxyConfig[] = [];

        for (const url of proxyUrls) {
            try {
                const proxyConfig = this.parseProxyUrl(url);
                proxies.push(proxyConfig);
            } catch (error) {
                logger.error(`[ConfigurationManager] Failed to parse proxy URL: ${url}`, { error });
            }
        }

        logger.info(`[ConfigurationManager] Loaded ${proxies.length} proxies from environment`);
        return proxies;
    }

    /**
     * Parse a proxy URL into ProxyConfig
     * Supports formats:
     * - http://host:port
     * - http://username:password@host:port
     * - socks5://host:port
     */
    private parseProxyUrl(url: string): ProxyConfig {
        try {
            const parsed = new URL(url);

            const config: ProxyConfig = {
                url: url,
                type: this.classifyProxyType(parsed.hostname),
            };

            // Extract username and password if present
            if (parsed.username) {
                config.username = decodeURIComponent(parsed.username);
            }
            if (parsed.password) {
                config.password = decodeURIComponent(parsed.password);
            }

            return config;
        } catch (error) {
            throw new Error(`Invalid proxy URL format: ${url}`);
        }
    }

    /**
     * Classify proxy type based on IP address or hostname
     * This is a simple heuristic - can be enhanced with IP range checks
     */
    private classifyProxyType(hostname: string): 'residential' | 'datacenter' | 'unknown' {
        // Simple heuristic: if hostname contains certain keywords, classify as residential
        const residentialKeywords = ['residential', 'resi', 'mobile', 'isp'];
        const datacenterKeywords = ['datacenter', 'dc', 'server', 'cloud'];

        const lowerHostname = hostname.toLowerCase();

        if (residentialKeywords.some(keyword => lowerHostname.includes(keyword))) {
            return 'residential';
        }

        if (datacenterKeywords.some(keyword => lowerHostname.includes(keyword))) {
            return 'datacenter';
        }

        // Check if it's a private IP (datacenter)
        if (this.isPrivateIP(hostname)) {
            return 'datacenter';
        }

        return 'unknown';
    }

    /**
     * Check if an IP address is private (datacenter)
     */
    private isPrivateIP(hostname: string): boolean {
        const privateRanges = [
            /^10\./,
            /^172\.(1[6-9]|2[0-9]|3[0-1])\./,
            /^192\.168\./,
            /^127\./,
            /^localhost$/i,
        ];

        return privateRanges.some(range => range.test(hostname));
    }

    /**
     * Load user agents from environment or use defaults
     */
    private loadUserAgents(): string[] {
        const userAgentEnv = process.env.SCRAPER_USER_AGENTS;

        if (userAgentEnv) {
            return userAgentEnv.split('|').map(ua => ua.trim()).filter(Boolean);
        }

        // Default user agents
        return [
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:122.0) Gecko/20100101 Firefox/122.0',
        ];
    }

    /**
     * Validate configuration
     */
    validateConfiguration(config: ScraperConfig): ConfigValidationResult {
        const errors: string[] = [];
        const warnings: string[] = [];

        // Validate proxies
        for (const proxy of config.proxies) {
            if (!proxy.url) {
                errors.push('Proxy configuration missing URL');
            }

            try {
                new URL(proxy.url);
            } catch {
                errors.push(`Invalid proxy URL: ${proxy.url}`);
            }

            // Warn if proxy type is unknown
            if (proxy.type === 'unknown') {
                warnings.push(`Proxy type unknown for: ${proxy.url}`);
            }
        }

        // Validate site profiles
        for (const [domain, profile] of Object.entries(config.siteProfiles)) {
            // Validate strategy
            if (!['light-js', 'full-js', 'html-only'].includes(profile.strategy)) {
                errors.push(`Invalid strategy for ${domain}: ${profile.strategy}`);
            }

            // Validate wait time
            if (profile.waitTime < 0) {
                errors.push(`Invalid waitTime for ${domain}: ${profile.waitTime}`);
            }

            // Validate cache time
            if (profile.cacheTime < 0) {
                errors.push(`Invalid cacheTime for ${domain}: ${profile.cacheTime}`);
            }

            // Validate retry count
            if (profile.retryCount < 0) {
                errors.push(`Invalid retryCount for ${domain}: ${profile.retryCount}`);
            }

            // Validate rate limit if present
            if (profile.rateLimit) {
                if (profile.rateLimit.requestsPerMinute <= 0) {
                    errors.push(`Invalid requestsPerMinute for ${domain}: ${profile.rateLimit.requestsPerMinute}`);
                }
                if (profile.rateLimit.concurrentRequests <= 0) {
                    errors.push(`Invalid concurrentRequests for ${domain}: ${profile.rateLimit.concurrentRequests}`);
                }
            }

            // Validate adaptive delay if present
            if (profile.adaptiveDelay) {
                if (profile.adaptiveDelay.baseDelay < 0) {
                    errors.push(`Invalid baseDelay for ${domain}: ${profile.adaptiveDelay.baseDelay}`);
                }
                if (profile.adaptiveDelay.multiplier <= 0) {
                    errors.push(`Invalid multiplier for ${domain}: ${profile.adaptiveDelay.multiplier}`);
                }
                if (profile.adaptiveDelay.maxDelay < profile.adaptiveDelay.baseDelay) {
                    errors.push(`maxDelay must be >= baseDelay for ${domain}`);
                }
            }
        }

        // Validate global defaults
        if (config.globalDefaults.maxRetries < 0) {
            errors.push(`Invalid maxRetries: ${config.globalDefaults.maxRetries}`);
        }

        if (config.globalDefaults.timeout <= 0) {
            errors.push(`Invalid timeout: ${config.globalDefaults.timeout}`);
        }

        if (config.globalDefaults.userAgents.length === 0) {
            warnings.push('No user agents configured, using defaults');
        }

        return {
            isValid: errors.length === 0,
            errors,
            warnings,
        };
    }

    /**
     * Get current configuration
     */
    getConfiguration(): ScraperConfig {
        return { ...this.config };
    }

    /**
     * Get proxy configuration
     */
    getProxies(): ProxyConfig[] {
        return [...this.config.proxies];
    }

    /**
     * Get site profile for a domain
     */
    getSiteProfile(domain: string): SiteProfile | null {
        return this.config.siteProfiles[domain] || null;
    }

    /**
     * Get all site profiles
     */
    getAllSiteProfiles(): Record<string, SiteProfile> {
        return { ...this.config.siteProfiles };
    }

    /**
     * Update site profile at runtime
     * Validates the update before applying
     */
    updateSiteProfile(domain: string, updates: Partial<SiteProfile>): ConfigValidationResult {
        logger.info(`[ConfigurationManager] Updating site profile for ${domain}`);

        // Get existing profile or create new one
        const existingProfile = this.config.siteProfiles[domain] || this.getDefaultProfile();
        const updatedProfile = { ...existingProfile, ...updates };

        // Validate the updated profile
        const tempConfig = {
            ...this.config,
            siteProfiles: {
                ...this.config.siteProfiles,
                [domain]: updatedProfile,
            },
        };

        const validation = this.validateConfiguration(tempConfig);

        if (validation.isValid) {
            // Apply the update
            this.config.siteProfiles[domain] = updatedProfile;
            logger.info(`[ConfigurationManager] Site profile updated for ${domain}`);

            // Notify listeners
            this.notifyConfigChange();
        } else {
            logger.error(`[ConfigurationManager] Failed to update site profile for ${domain}`, {
                errors: validation.errors,
            });
        }

        return validation;
    }

    /**
     * Add or update multiple site profiles at runtime
     */
    updateSiteProfiles(profiles: Record<string, Partial<SiteProfile>>): ConfigValidationResult {
        logger.info(`[ConfigurationManager] Updating ${Object.keys(profiles).length} site profiles`);

        const updatedProfiles: Record<string, SiteProfile> = { ...this.config.siteProfiles };

        for (const [domain, updates] of Object.entries(profiles)) {
            const existingProfile = updatedProfiles[domain] || this.getDefaultProfile();
            updatedProfiles[domain] = { ...existingProfile, ...updates };
        }

        // Validate all updates
        const tempConfig = {
            ...this.config,
            siteProfiles: updatedProfiles,
        };

        const validation = this.validateConfiguration(tempConfig);

        if (validation.isValid) {
            // Apply all updates
            this.config.siteProfiles = updatedProfiles;
            logger.info(`[ConfigurationManager] ${Object.keys(profiles).length} site profiles updated`);

            // Notify listeners
            this.notifyConfigChange();
        } else {
            logger.error('[ConfigurationManager] Failed to update site profiles', {
                errors: validation.errors,
            });
        }

        return validation;
    }

    /**
     * Remove a site profile
     */
    removeSiteProfile(domain: string): void {
        if (this.config.siteProfiles[domain]) {
            delete this.config.siteProfiles[domain];
            logger.info(`[ConfigurationManager] Site profile removed for ${domain}`);

            // Notify listeners
            this.notifyConfigChange();
        }
    }

    /**
     * Apply an anti-bot profile to a domain
     */
    applyAntiBotProfile(domain: string, antiBotSystem: 'cloudflare' | 'perimeterx' | 'datadome'): ConfigValidationResult {
        logger.info(`[ConfigurationManager] Applying ${antiBotSystem} profile to ${domain}`);

        // Lazy load ANTI_BOT_PROFILES to avoid circular dependency
        const { ANTI_BOT_PROFILES } = require('../config/site-profiles');
        const antiBotProfile = ANTI_BOT_PROFILES[antiBotSystem];

        if (!antiBotProfile) {
            return {
                isValid: false,
                errors: [`Unknown anti-bot system: ${antiBotSystem}`],
                warnings: [],
            };
        }

        return this.updateSiteProfile(domain, antiBotProfile);
    }

    /**
     * Get default site profile
     */
    private getDefaultProfile(): SiteProfile {
        return {
            strategy: 'full-js',
            selectors: {},
            waitTime: 3000,
            cacheTime: 1800,
            successRate: 0.7,
            retryCount: 2,
        };
    }

    /**
     * Register a listener for configuration changes
     */
    onConfigChange(listener: (config: ScraperConfig) => void): () => void {
        this.configListeners.push(listener);

        // Return unsubscribe function to avoid listener leaks in short-lived services
        return () => {
            this.configListeners = this.configListeners.filter((l) => l !== listener);
        };
    }

    /**
     * Notify all listeners of configuration change
     */
    private notifyConfigChange(): void {
        const config = this.getConfiguration();
        this.configListeners.forEach(listener => {
            try {
                listener(config);
            } catch (error) {
                logger.error('[ConfigurationManager] Error in config change listener', { error });
            }
        });
    }

    /**
     * Reload configuration from environment
     * Useful for hot-reloading configuration without restart
     */
    reloadConfiguration(): ConfigValidationResult {
        logger.info('[ConfigurationManager] Reloading configuration from environment');

        const newConfig = this.loadInitialConfig();
        const validation = this.validateConfiguration(newConfig);

        if (validation.isValid) {
            this.config = newConfig;
            logger.info('[ConfigurationManager] Configuration reloaded successfully');

            // Notify listeners
            this.notifyConfigChange();
        } else {
            logger.error('[ConfigurationManager] Failed to reload configuration', {
                errors: validation.errors,
            });
        }

        return validation;
    }

    /**
     * Export configuration as JSON
     */
    exportConfiguration(): string {
        return JSON.stringify(this.config, null, 2);
    }

    /**
     * Import configuration from JSON
     */
    importConfiguration(json: string): ConfigValidationResult {
        try {
            const imported = JSON.parse(json) as ScraperConfig;
            const validation = this.validateConfiguration(imported);

            if (validation.isValid) {
                this.config = imported;
                logger.info('[ConfigurationManager] Configuration imported successfully');

                // Notify listeners
                this.notifyConfigChange();
            } else {
                logger.error('[ConfigurationManager] Failed to import configuration', {
                    errors: validation.errors,
                });
            }

            return validation;
        } catch (error) {
            return {
                isValid: false,
                errors: [`Failed to parse JSON: ${error}`],
                warnings: [],
            };
        }
    }
}

// Export singleton instance
export const configurationManager = ConfigurationManager.getInstance();
