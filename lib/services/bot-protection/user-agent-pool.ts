/**
 * User Agent Pool and Rotation
 * 
 * Maintains a pool of real browser user agents and provides rotation
 * functionality to avoid detection patterns.
 */

/**
 * User agent type
 */
export type UserAgentType = 'desktop' | 'mobile';

export interface UserAgentOutcome {
    success: boolean;
    failureType?: 'PARTIAL' | 'PRICE_ZERO' | 'PARSE_FAILED' | 'STRUCTURE_CHANGED' | 'BOT_BLOCKED' | 'TIMEOUT' | 'OTHER';
}

/**
 * Desktop user agents (Chrome, Firefox, Safari, Edge)
 * Updated with current browser versions as of 2024
 */
const DESKTOP_USER_AGENTS: string[] = [
    // Chrome on Windows
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36',

    // Chrome on macOS
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36',

    // Chrome on Linux
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',

    // Firefox on Windows
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:120.0) Gecko/20100101 Firefox/120.0',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:119.0) Gecko/20100101 Firefox/119.0',

    // Firefox on macOS
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:121.0) Gecko/20100101 Firefox/121.0',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:120.0) Gecko/20100101 Firefox/120.0',

    // Firefox on Linux
    'Mozilla/5.0 (X11; Linux x86_64; rv:121.0) Gecko/20100101 Firefox/121.0',
    'Mozilla/5.0 (X11; Linux x86_64; rv:120.0) Gecko/20100101 Firefox/120.0',

    // Safari on macOS
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',

    // Edge on Windows
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36 Edg/119.0.0.0',

    // Edge on macOS
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36 Edg/119.0.0.0',

    // Opera on Windows
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 OPR/106.0.0.0',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36 OPR/105.0.0.0',

    // Brave on Windows
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
];

/**
 * Mobile user agents (iOS Safari, Android Chrome)
 */
const MOBILE_USER_AGENTS: string[] = [
    // iPhone Safari
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Mobile/15E148 Safari/604.1',
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Mobile/15E148 Safari/604.1',
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
    'Mozilla/5.0 (iPhone; CPU iPhone OS 16_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.7 Mobile/15E148 Safari/604.1',

    // iPad Safari
    'Mozilla/5.0 (iPad; CPU OS 17_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Mobile/15E148 Safari/604.1',
    'Mozilla/5.0 (iPad; CPU OS 17_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Mobile/15E148 Safari/604.1',

    // Android Chrome
    'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.6099.144 Mobile Safari/537.36',
    'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.6045.193 Mobile Safari/537.36',
    'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.6099.144 Mobile Safari/537.36',
    'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.6045.193 Mobile Safari/537.36',

    // Samsung Internet
    'Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/23.0 Chrome/115.0.0.0 Mobile Safari/537.36',
    'Mozilla/5.0 (Linux; Android 13; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/23.0 Chrome/115.0.0.0 Mobile Safari/537.36',

    // Android Firefox
    'Mozilla/5.0 (Android 14; Mobile; rv:121.0) Gecko/121.0 Firefox/121.0',
    'Mozilla/5.0 (Android 13; Mobile; rv:121.0) Gecko/121.0 Firefox/121.0',

    // iPhone Chrome
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/120.0.6099.119 Mobile/15E148 Safari/604.1',
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/119.0.6045.169 Mobile/15E148 Safari/604.1',

    // iPhone Firefox
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) FxiOS/121.0 Mobile/15E148 Safari/605.1.15',
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) FxiOS/120.0 Mobile/15E148 Safari/605.1.15',

    // iPad Chrome
    'Mozilla/5.0 (iPad; CPU OS 17_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/120.0.6099.119 Mobile/15E148 Safari/604.1',
    'Mozilla/5.0 (iPad; CPU OS 17_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/119.0.6045.169 Mobile/15E148 Safari/604.1',

    // Android Edge
    'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36 EdgA/120.0.0.0',
    'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Mobile Safari/537.36 EdgA/119.0.0.0',

    // Android Opera
    'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36 OPR/76.0.0.0',
    'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Mobile Safari/537.36 OPR/75.0.0.0',
];

/**
 * User Agent Pool Manager
 * 
 * Manages a pool of user agents and provides rotation functionality.
 */
export class UserAgentPool {
    private desktopAgents: string[];
    private mobileAgents: string[];
    private lastUsedIndex: Map<UserAgentType, number>;
    private stickyAgents: Map<string, string>;
    private userAgentScores: Map<string, number>;

    constructor() {
        this.desktopAgents = [...DESKTOP_USER_AGENTS];
        this.mobileAgents = [...MOBILE_USER_AGENTS];
        this.lastUsedIndex = new Map([
            ['desktop', -1],
            ['mobile', -1],
        ]);
        this.stickyAgents = new Map();
        this.userAgentScores = new Map();
    }

    /**
     * Get a random user agent of the specified type
     * 
     * @param type - User agent type (desktop or mobile)
     * @returns Random user agent string
     */
    getRandomUserAgent(type: UserAgentType = 'desktop', key?: string): string {
        return this.getWeightedUserAgent(type, key);
    }

    /**
     * Get the next user agent in rotation
     * 
     * Rotates through user agents sequentially to ensure variety
     * across consecutive requests.
     * 
     * @param type - User agent type (desktop or mobile)
     * @returns Next user agent string in rotation
     */
    getNextUserAgent(type: UserAgentType = 'desktop'): string {
        const agents = type === 'desktop' ? this.desktopAgents : this.mobileAgents;
        const lastIndex = this.lastUsedIndex.get(type) || -1;
        const nextIndex = (lastIndex + 1) % agents.length;

        this.lastUsedIndex.set(type, nextIndex);
        return agents[nextIndex];
    }

    /**
     * Get a sticky user agent for a stable key (e.g., per-domain per job).
     *
     * Why: browser contexts are reused per domain, and mixing multiple UAs inside
     * a single context is inconsistent and can increase detection.
     */
    getStickyUserAgent(key: string, type: UserAgentType = 'desktop'): string {
        const existing = this.stickyAgents.get(key);
        if (existing) return existing;

        const ua = this.getWeightedUserAgent(type, key);
        this.stickyAgents.set(key, ua);
        return ua;
    }

    invalidateStickyUserAgent(key: string): void {
        this.stickyAgents.delete(key);
    }

    recordOutcome(key: string, userAgent: string, outcome: UserAgentOutcome): void {
        const scoreKey = this.getScoreKey(key, userAgent);
        const currentScore = this.userAgentScores.get(scoreKey) ?? 1.0;
        let delta = 0;

        if (outcome.success) {
            // Count only full successful scrape as a success signal.
            delta = 0.25;
        } else {
            switch (outcome.failureType) {
                case 'PRICE_ZERO':
                    delta = -0.35;
                    break;
                case 'PARSE_FAILED':
                case 'STRUCTURE_CHANGED':
                    delta = -0.25;
                    break;
                case 'BOT_BLOCKED':
                case 'TIMEOUT':
                    delta = -0.45;
                    break;
                case 'PARTIAL':
                    delta = -0.2;
                    break;
                default:
                    delta = -0.15;
                    break;
            }
        }

        const nextScore = Math.min(5, Math.max(0.1, currentScore + delta));
        this.userAgentScores.set(scoreKey, nextScore);
    }

    /**
     * Get all user agents of a specific type
     * 
     * @param type - User agent type (desktop or mobile)
     * @returns Array of user agent strings
     */
    getAllUserAgents(type: UserAgentType): string[] {
        return type === 'desktop' ? [...this.desktopAgents] : [...this.mobileAgents];
    }

    /**
     * Get total count of user agents
     * 
     * @param type - Optional type filter
     * @returns Count of user agents
     */
    getCount(type?: UserAgentType): number {
        if (type === 'desktop') return this.desktopAgents.length;
        if (type === 'mobile') return this.mobileAgents.length;
        return this.desktopAgents.length + this.mobileAgents.length;
    }

    /**
     * Shuffle user agents to randomize rotation order
     * 
     * Useful to avoid predictable patterns in user agent rotation.
     */
    shuffle(): void {
        this.desktopAgents = this.shuffleArray(this.desktopAgents);
        this.mobileAgents = this.shuffleArray(this.mobileAgents);
        this.lastUsedIndex.set('desktop', -1);
        this.lastUsedIndex.set('mobile', -1);
        this.stickyAgents.clear();
    }

    private getWeightedUserAgent(type: UserAgentType, key?: string): string {
        const agents = type === 'desktop' ? this.desktopAgents : this.mobileAgents;
        if (agents.length === 0) {
            throw new Error('No user agents available');
        }

        // Exploration to avoid converging too aggressively.
        if (Math.random() < 0.2 || !key) {
            const randomIndex = Math.floor(Math.random() * agents.length);
            return agents[randomIndex];
        }

        let totalWeight = 0;
        const weights = agents.map((ua) => {
            const score = this.userAgentScores.get(this.getScoreKey(key, ua)) ?? 1.0;
            const weight = Math.max(0.05, score);
            totalWeight += weight;
            return weight;
        });

        let pick = Math.random() * totalWeight;
        for (let i = 0; i < agents.length; i++) {
            pick -= weights[i];
            if (pick <= 0) return agents[i];
        }

        return agents[agents.length - 1];
    }

    private getScoreKey(key: string, userAgent: string): string {
        return `${key}::${userAgent}`;
    }

    /**
     * Fisher-Yates shuffle algorithm
     * 
     * @param array - Array to shuffle
     * @returns Shuffled array
     */
    private shuffleArray<T>(array: T[]): T[] {
        const shuffled = [...array];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        return shuffled;
    }
}

// Export singleton instance
export const userAgentPool = new UserAgentPool();
