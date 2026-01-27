/**
 * User Agent Configuration
 * 
 * Centralized user agent pool for web scraping operations.
 * Includes diverse user agents across Chrome, Firefox, and Safari
 * on Windows, macOS, and Linux platforms.
 * 
 * Requirements: 9.2
 */

export interface UserAgentInfo {
    userAgent: string;
    browser: 'Chrome' | 'Firefox' | 'Safari';
    os: 'Windows' | 'macOS' | 'Linux';
}

/**
 * Pool of diverse user agents for rotation
 * Includes at least 10 different user agents representing Chrome, Firefox, and Safari
 * across different OS versions (Windows, macOS, Linux)
 */
export const USER_AGENTS: UserAgentInfo[] = [
    // Chrome on Windows
    {
        userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
        browser: 'Chrome',
        os: 'Windows'
    },
    {
        userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        browser: 'Chrome',
        os: 'Windows'
    },
    {
        userAgent: "Mozilla/5.0 (Windows NT 11.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36",
        browser: 'Chrome',
        os: 'Windows'
    },

    // Chrome on macOS
    {
        userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        browser: 'Chrome',
        os: 'macOS'
    },
    {
        userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 13_5_1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
        browser: 'Chrome',
        os: 'macOS'
    },

    // Chrome on Linux
    {
        userAgent: "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36",
        browser: 'Chrome',
        os: 'Linux'
    },
    {
        userAgent: "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        browser: 'Chrome',
        os: 'Linux'
    },

    // Firefox on Windows
    {
        userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:122.0) Gecko/20100101 Firefox/122.0",
        browser: 'Firefox',
        os: 'Windows'
    },
    {
        userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0",
        browser: 'Firefox',
        os: 'Windows'
    },

    // Firefox on macOS
    {
        userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:122.0) Gecko/20100101 Firefox/122.0",
        browser: 'Firefox',
        os: 'macOS'
    },
    {
        userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 13.5; rv:121.0) Gecko/20100101 Firefox/121.0",
        browser: 'Firefox',
        os: 'macOS'
    },

    // Firefox on Linux
    {
        userAgent: "Mozilla/5.0 (X11; Linux x86_64; rv:122.0) Gecko/20100101 Firefox/122.0",
        browser: 'Firefox',
        os: 'Linux'
    },

    // Safari on macOS
    {
        userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15",
        browser: 'Safari',
        os: 'macOS'
    },
    {
        userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 13_5_1) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.5 Safari/605.1.15",
        browser: 'Safari',
        os: 'macOS'
    },
];

/**
 * Get a random user agent from the pool
 */
export function getRandomUserAgent(): string {
    const randomIndex = Math.floor(Math.random() * USER_AGENTS.length);
    return USER_AGENTS[randomIndex].userAgent;
}

/**
 * Get a random user agent excluding a specific one
 * Useful for retry scenarios where we want to rotate user agents
 * 
 * Requirements: 9.3
 */
export function getRandomUserAgentExcluding(excludeUserAgent: string): string {
    const availableUserAgents = USER_AGENTS.filter(ua => ua.userAgent !== excludeUserAgent);

    if (availableUserAgents.length === 0) {
        // Fallback if all filtered out (shouldn't happen with 14 user agents)
        return getRandomUserAgent();
    }

    const randomIndex = Math.floor(Math.random() * availableUserAgents.length);
    return availableUserAgents[randomIndex].userAgent;
}

/**
 * Get user agent info by user agent string
 */
export function getUserAgentInfo(userAgent: string): UserAgentInfo | undefined {
    return USER_AGENTS.find(ua => ua.userAgent === userAgent);
}

/**
 * Get all user agent strings (for backward compatibility)
 */
export function getAllUserAgents(): string[] {
    return USER_AGENTS.map(ua => ua.userAgent);
}
