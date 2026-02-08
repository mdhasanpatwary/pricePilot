/**
 * Robots.txt Parser Component
 * 
 * Parses and caches robots.txt rules per website to ensure compliance
 * with website crawling policies. Checks disallowed paths before making requests.
 */

/**
 * Robots.txt rule
 */
interface RobotRule {
    userAgent: string;
    disallow: string[];
    allow: string[];
    crawlDelay?: number;
}

/**
 * Parsed robots.txt data
 */
interface RobotsTxt {
    rules: RobotRule[];
    sitemaps: string[];
    fetchedAt: Date;
}

/**
 * RobotsTxtParser class
 * 
 * Fetches, parses, and caches robots.txt files for websites.
 * Provides methods to check if a path is allowed for crawling.
 */
export class RobotsTxtParser {
    private cache: Map<string, RobotsTxt> = new Map();
    private cacheTTL: number = 24 * 60 * 60 * 1000; // 24 hours

    /**
     * Create a new RobotsTxtParser
     * @param cacheTTL - Cache time-to-live in milliseconds (default: 24 hours)
     */
    constructor(cacheTTL?: number) {
        if (cacheTTL) {
            this.cacheTTL = cacheTTL;
        }
    }

    /**
     * Fetch and parse robots.txt for a website
     * 
     * @param baseUrl - Base URL of the website (e.g., https://example.com)
     * @returns Parsed robots.txt data
     */
    async fetchRobotsTxt(baseUrl: string): Promise<RobotsTxt> {
        // Check cache first
        const cached = this.cache.get(baseUrl);
        if (cached) {
            const age = Date.now() - cached.fetchedAt.getTime();
            if (age < this.cacheTTL) {
                return cached;
            }
        }

        try {
            // Construct robots.txt URL
            const url = new URL('/robots.txt', baseUrl);

            // Fetch robots.txt
            const response = await fetch(url.toString(), {
                headers: {
                    'User-Agent': 'PricePilot/1.0 (API Detector)',
                },
                signal: AbortSignal.timeout(10000), // 10 second timeout
            });

            if (!response.ok) {
                // If robots.txt doesn't exist, allow all
                return this.createPermissiveRobotsTxt(baseUrl);
            }

            const content = await response.text();

            // Parse robots.txt
            const robotsTxt = this.parseRobotsTxt(content);

            // Cache the result
            this.cache.set(baseUrl, robotsTxt);

            return robotsTxt;
        } catch (error) {
            console.error(`Error fetching robots.txt for ${baseUrl}:`, error);

            // On error, return permissive rules (allow all)
            return this.createPermissiveRobotsTxt(baseUrl);
        }
    }

    /**
     * Parse robots.txt content
     * 
     * @param content - Raw robots.txt content
     * @returns Parsed robots.txt data
     */
    private parseRobotsTxt(content: string): RobotsTxt {
        const rules: RobotRule[] = [];
        const sitemaps: string[] = [];

        let currentRule: RobotRule | null = null;

        // Split into lines and process
        const lines = content.split('\n');

        for (let line of lines) {
            // Remove comments
            const commentIndex = line.indexOf('#');
            if (commentIndex !== -1) {
                line = line.substring(0, commentIndex);
            }

            // Trim whitespace
            line = line.trim();

            // Skip empty lines
            if (!line) {
                continue;
            }

            // Split into directive and value
            const colonIndex = line.indexOf(':');
            if (colonIndex === -1) {
                continue;
            }

            const directive = line.substring(0, colonIndex).trim().toLowerCase();
            const value = line.substring(colonIndex + 1).trim();

            // Process directives
            switch (directive) {
                case 'user-agent':
                    // Start a new rule
                    if (currentRule) {
                        rules.push(currentRule);
                    }
                    currentRule = {
                        userAgent: value,
                        disallow: [],
                        allow: [],
                    };
                    break;

                case 'disallow':
                    if (currentRule && value) {
                        currentRule.disallow.push(value);
                    }
                    break;

                case 'allow':
                    if (currentRule && value) {
                        currentRule.allow.push(value);
                    }
                    break;

                case 'crawl-delay':
                    if (currentRule) {
                        const delay = parseFloat(value);
                        if (!isNaN(delay)) {
                            currentRule.crawlDelay = delay;
                        }
                    }
                    break;

                case 'sitemap':
                    if (value) {
                        sitemaps.push(value);
                    }
                    break;
            }
        }

        // Add last rule
        if (currentRule) {
            rules.push(currentRule);
        }

        return {
            rules,
            sitemaps,
            fetchedAt: new Date(),
        };
    }

    /**
     * Create permissive robots.txt (allow all)
     * 
     * @param baseUrl - Base URL
     * @returns Permissive robots.txt data
     */
    private createPermissiveRobotsTxt(baseUrl: string): RobotsTxt {
        const robotsTxt: RobotsTxt = {
            rules: [
                {
                    userAgent: '*',
                    disallow: [],
                    allow: ['/'],
                },
            ],
            sitemaps: [],
            fetchedAt: new Date(),
        };

        // Cache the permissive rules
        this.cache.set(baseUrl, robotsTxt);

        return robotsTxt;
    }

    /**
     * Check if a path is allowed for crawling
     * 
     * @param baseUrl - Base URL of the website
     * @param path - Path to check (e.g., /api/products)
     * @param userAgent - User agent string (default: PricePilot)
     * @returns True if path is allowed, false if disallowed
     */
    async isPathAllowed(
        baseUrl: string,
        path: string,
        userAgent: string = 'PricePilot'
    ): Promise<boolean> {
        // Fetch robots.txt (from cache if available)
        const robotsTxt = await this.fetchRobotsTxt(baseUrl);

        // Find applicable rules for the user agent
        const applicableRules = this.findApplicableRules(robotsTxt.rules, userAgent);

        // Check if path is allowed
        return this.checkPathAllowed(path, applicableRules);
    }

    /**
     * Find applicable rules for a user agent
     * 
     * Rules are matched in order of specificity:
     * 1. Exact user agent match
     * 2. Wildcard (*) match
     * 
     * @param rules - All robots.txt rules
     * @param userAgent - User agent string
     * @returns Applicable rules
     */
    private findApplicableRules(rules: RobotRule[], userAgent: string): RobotRule[] {
        const lowerUserAgent = userAgent.toLowerCase();
        const applicableRules: RobotRule[] = [];

        // First, find exact matches
        for (const rule of rules) {
            if (rule.userAgent.toLowerCase() === lowerUserAgent) {
                applicableRules.push(rule);
            }
        }

        // If no exact matches, find wildcard matches
        if (applicableRules.length === 0) {
            for (const rule of rules) {
                if (rule.userAgent === '*') {
                    applicableRules.push(rule);
                }
            }
        }

        // If still no matches, allow all
        if (applicableRules.length === 0) {
            applicableRules.push({
                userAgent: '*',
                disallow: [],
                allow: ['/'],
            });
        }

        return applicableRules;
    }

    /**
     * Check if a path is allowed based on rules
     * 
     * @param path - Path to check
     * @param rules - Applicable rules
     * @returns True if allowed, false if disallowed
     */
    private checkPathAllowed(path: string, rules: RobotRule[]): boolean {
        // Normalize path
        if (!path.startsWith('/')) {
            path = '/' + path;
        }

        // Check each rule
        for (const rule of rules) {
            // Check allow rules first (they take precedence)
            for (const allowPattern of rule.allow) {
                if (this.matchesPattern(path, allowPattern)) {
                    return true;
                }
            }

            // Check disallow rules
            for (const disallowPattern of rule.disallow) {
                if (this.matchesPattern(path, disallowPattern)) {
                    return false;
                }
            }
        }

        // If no rules matched, allow by default
        return true;
    }

    /**
     * Check if a path matches a robots.txt pattern
     * 
     * Supports wildcards:
     * - * matches any sequence of characters
     * - $ matches end of path
     * 
     * @param path - Path to check
     * @param pattern - Robots.txt pattern
     * @returns True if path matches pattern
     */
    private matchesPattern(path: string, pattern: string): boolean {
        // Empty pattern matches nothing
        if (!pattern) {
            return false;
        }

        // Exact match
        if (pattern === path) {
            return true;
        }

        // Pattern with $ (end of path)
        if (pattern.endsWith('$')) {
            const patternWithoutDollar = pattern.slice(0, -1);
            return path === patternWithoutDollar;
        }

        // Pattern with * (wildcard)
        if (pattern.includes('*')) {
            // Convert pattern to regex
            const regexPattern = pattern
                .replace(/[.+?^${}()|[\]\\]/g, '\\$&') // Escape special regex chars
                .replace(/\*/g, '.*'); // Replace * with .*

            const regex = new RegExp('^' + regexPattern);
            return regex.test(path);
        }

        // Prefix match (default behavior)
        return path.startsWith(pattern);
    }

    /**
     * Get crawl delay for a website
     * 
     * @param baseUrl - Base URL of the website
     * @param userAgent - User agent string (default: PricePilot)
     * @returns Crawl delay in seconds, or null if not specified
     */
    async getCrawlDelay(
        baseUrl: string,
        userAgent: string = 'PricePilot'
    ): Promise<number | null> {
        const robotsTxt = await this.fetchRobotsTxt(baseUrl);
        const applicableRules = this.findApplicableRules(robotsTxt.rules, userAgent);

        // Return the first crawl delay found
        for (const rule of applicableRules) {
            if (rule.crawlDelay !== undefined) {
                return rule.crawlDelay;
            }
        }

        return null;
    }

    /**
     * Clear cache for a specific website or all websites
     * 
     * @param baseUrl - Base URL to clear, or undefined to clear all
     */
    clearCache(baseUrl?: string): void {
        if (baseUrl) {
            this.cache.delete(baseUrl);
        } else {
            this.cache.clear();
        }
    }

    /**
     * Get cache size
     * 
     * @returns Number of cached robots.txt entries
     */
    getCacheSize(): number {
        return this.cache.size;
    }
}
