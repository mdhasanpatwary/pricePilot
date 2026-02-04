/**
 * Header Generator
 * 
 * Generates realistic HTTP headers for web scraping requests.
 * Includes randomization and support for desktop/mobile profiles.
 */

/**
 * Header profile type
 */
export type HeaderProfile = 'desktop' | 'mobile';

/**
 * Header generation options
 */
export interface HeaderOptions {
    /** User agent string */
    userAgent: string;
    /** Profile type (desktop or mobile) */
    profile: HeaderProfile;
    /** Optional referer URL */
    referer?: string;
    /** Whether to randomize header order */
    randomizeOrder?: boolean;
}

/**
 * Desktop browser headers
 */
const DESKTOP_HEADERS = {
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
    'Accept-Language': 'en-US,en;q=0.9',
    'Accept-Encoding': 'gzip, deflate, br',
    'DNT': '1',
    'Connection': 'keep-alive',
    'Upgrade-Insecure-Requests': '1',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'none',
    'Sec-Fetch-User': '?1',
    'Cache-Control': 'max-age=0',
    'sec-ch-ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
    'sec-ch-ua-mobile': '?0',
    'sec-ch-ua-platform': '"Windows"',
};

/**
 * Mobile browser headers
 */
const MOBILE_HEADERS = {
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
    'Accept-Encoding': 'gzip, deflate, br',
    'DNT': '1',
    'Connection': 'keep-alive',
    'Upgrade-Insecure-Requests': '1',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'none',
    'Sec-Fetch-User': '?1',
    'Cache-Control': 'max-age=0',
    'sec-ch-ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
    'sec-ch-ua-mobile': '?1',
    'sec-ch-ua-platform': '"Android"',
};

/**
 * Possible Accept-Language variations
 */
const ACCEPT_LANGUAGES = [
    'en-US,en;q=0.9',
    'en-US,en;q=0.9,es;q=0.8',
    'en-GB,en;q=0.9',
    'en-US,en;q=0.9,fr;q=0.8',
    'en-US,en;q=0.9,de;q=0.8',
];

/**
 * Possible platform values for sec-ch-ua-platform
 */
const DESKTOP_PLATFORMS = ['"Windows"', '"macOS"', '"Linux"'];
const MOBILE_PLATFORMS = ['"Android"', '"iOS"'];

/**
 * Generate realistic HTTP headers
 * 
 * Creates a set of HTTP headers that mimic real browser behavior,
 * including randomization to avoid detection patterns.
 * 
 * @param options - Header generation options
 * @returns Record of HTTP headers
 */
export function generateHeaders(options: HeaderOptions): Record<string, string> {
    const { userAgent, profile, referer, randomizeOrder = true } = options;

    // Select base headers based on profile
    const baseHeaders: Record<string, string> = profile === 'desktop'
        ? { ...DESKTOP_HEADERS }
        : { ...MOBILE_HEADERS };

    // Add User-Agent
    baseHeaders['User-Agent'] = userAgent;

    // Randomize Accept-Language
    baseHeaders['Accept-Language'] = ACCEPT_LANGUAGES[Math.floor(Math.random() * ACCEPT_LANGUAGES.length)];

    // Randomize platform
    if (profile === 'desktop') {
        baseHeaders['sec-ch-ua-platform'] = DESKTOP_PLATFORMS[Math.floor(Math.random() * DESKTOP_PLATFORMS.length)];
    } else {
        baseHeaders['sec-ch-ua-platform'] = MOBILE_PLATFORMS[Math.floor(Math.random() * MOBILE_PLATFORMS.length)];
    }

    // Add referer if provided
    if (referer) {
        baseHeaders['Referer'] = referer;
        baseHeaders['Sec-Fetch-Site'] = 'same-origin';
    }

    // Randomize header order if requested
    if (randomizeOrder) {
        return randomizeHeaderOrder(baseHeaders);
    }

    return baseHeaders;
}

/**
 * Randomize the order of headers
 * 
 * Real browsers don't always send headers in the same order.
 * This function shuffles the header order to mimic that behavior.
 * 
 * @param headers - Original headers
 * @returns Headers with randomized order
 */
function randomizeHeaderOrder(headers: Record<string, string>): Record<string, string> {
    const entries = Object.entries(headers);

    // Fisher-Yates shuffle
    for (let i = entries.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [entries[i], entries[j]] = [entries[j], entries[i]];
    }

    // Reconstruct object with shuffled order
    const shuffled: Record<string, string> = {};
    for (const [key, value] of entries) {
        shuffled[key] = value;
    }

    return shuffled;
}

/**
 * Generate headers for desktop browser
 * 
 * Convenience function for generating desktop headers.
 * 
 * @param userAgent - User agent string
 * @param referer - Optional referer URL
 * @returns Desktop headers
 */
export function generateDesktopHeaders(
    userAgent: string,
    referer?: string
): Record<string, string> {
    return generateHeaders({
        userAgent,
        profile: 'desktop',
        referer,
        randomizeOrder: true,
    });
}

/**
 * Generate headers for mobile browser
 * 
 * Convenience function for generating mobile headers.
 * 
 * @param userAgent - User agent string
 * @param referer - Optional referer URL
 * @returns Mobile headers
 */
export function generateMobileHeaders(
    userAgent: string,
    referer?: string
): Record<string, string> {
    return generateHeaders({
        userAgent,
        profile: 'mobile',
        referer,
        randomizeOrder: true,
    });
}

/**
 * Detect profile type from user agent
 * 
 * Analyzes the user agent string to determine if it's a mobile or desktop browser.
 * 
 * @param userAgent - User agent string
 * @returns Detected profile type
 */
export function detectProfileFromUserAgent(userAgent: string): HeaderProfile {
    const mobileKeywords = [
        'Mobile',
        'Android',
        'iPhone',
        'iPad',
        'iPod',
        'BlackBerry',
        'Windows Phone',
        'webOS',
    ];

    const lowerUA = userAgent.toLowerCase();
    const isMobile = mobileKeywords.some((keyword) =>
        lowerUA.includes(keyword.toLowerCase())
    );

    return isMobile ? 'mobile' : 'desktop';
}

/**
 * Generate headers with automatic profile detection
 * 
 * Automatically detects whether the user agent is mobile or desktop
 * and generates appropriate headers.
 * 
 * @param userAgent - User agent string
 * @param referer - Optional referer URL
 * @returns Generated headers
 */
export function generateHeadersAuto(
    userAgent: string,
    referer?: string
): Record<string, string> {
    const profile = detectProfileFromUserAgent(userAgent);
    return generateHeaders({
        userAgent,
        profile,
        referer,
        randomizeOrder: true,
    });
}
