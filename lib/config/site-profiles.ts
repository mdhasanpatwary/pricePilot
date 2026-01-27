export interface SiteProfile {
  strategy: 'light-js' | 'full-js' | 'html-only';
  selectors: {
    title?: string[];
    price?: string[];
    image?: string[];
    stock?: string[];
  };
  waitTime: number;
  cacheTime: number; // in seconds
  successRate: number;
  retryCount: number;

  // New fields for advanced stealth scraping
  rateLimit?: {
    requestsPerMinute: number;
    concurrentRequests: number;
  };
  sessionWarmup?: {
    enabled: boolean;
    visitHomepage: boolean;
    visitPaths?: string[];
  };
  adaptiveDelay?: {
    enabled: boolean;
    baseDelay: number;
    multiplier: number;
    maxDelay: number;
  };
  referrerChain?: {
    enabled: boolean;
    startUrl?: string;
  };
}

export const SITE_PROFILES: Record<string, SiteProfile> = {
  'startech.com.bd': {
    strategy: 'light-js',
    selectors: {
      title: ['.p-item-name', 'h1', '.product-name'],
      price: ['.p-item-price', '.price-new', '.price'],
      stock: ['.stock-status', '.text-discontinued']
    },
    waitTime: 2000,
    cacheTime: 1800, // 30 mins
    successRate: 0.95,
    retryCount: 2
  },
  'ryans.com': {
    strategy: 'full-js',
    selectors: {
      title: ['h1.product-name', '.product-title'],
      price: ['.special-price', '.price'],
      stock: ['.availability']
    },
    waitTime: 4000, // Heavier site
    cacheTime: 900, // 15 mins (prices change often)
    successRate: 0.88,
    retryCount: 3
  },
  'techlandbd.com': {
    strategy: 'html-only',
    selectors: {
      title: ['h1.product-title'],
      price: ['.product-price'],
      stock: ['.stock-info']
    },
    waitTime: 1000,
    cacheTime: 3600, // 1 hour
    successRate: 0.90,
    retryCount: 1
  },
  'giftly.com.bd': {
    strategy: 'light-js',
    selectors: {
      title: ['h1', '.product-title', '#content h1'],
      price: ['#price-special', '.price-new', 'h2', '.product-price'],
      image: ['.product-image img', '#image', '.thumbnail img', '.image img'],
      stock: ['.stock-status', '#product .availability']
    },
    waitTime: 2000,
    cacheTime: 1800, // 30 mins
    successRate: 0.92,
    retryCount: 2
  }
};

// Default profiles for common anti-bot systems
export const ANTI_BOT_PROFILES: Record<string, Partial<SiteProfile>> = {
  'cloudflare': {
    strategy: 'full-js',
    waitTime: 5000,
    retryCount: 3,
    rateLimit: {
      requestsPerMinute: 10,
      concurrentRequests: 2
    },
    sessionWarmup: {
      enabled: true,
      visitHomepage: true
    },
    adaptiveDelay: {
      enabled: true,
      baseDelay: 3000,
      multiplier: 1.0,
      maxDelay: 30000
    },
    referrerChain: {
      enabled: true
    }
  },
  'perimeterx': {
    strategy: 'full-js',
    waitTime: 6000,
    retryCount: 2,
    rateLimit: {
      requestsPerMinute: 8,
      concurrentRequests: 1
    },
    sessionWarmup: {
      enabled: true,
      visitHomepage: true,
      visitPaths: ['/about', '/products']
    },
    adaptiveDelay: {
      enabled: true,
      baseDelay: 4000,
      multiplier: 1.0,
      maxDelay: 40000
    },
    referrerChain: {
      enabled: true
    }
  },
  'datadome': {
    strategy: 'full-js',
    waitTime: 7000,
    retryCount: 2,
    rateLimit: {
      requestsPerMinute: 6,
      concurrentRequests: 1
    },
    sessionWarmup: {
      enabled: true,
      visitHomepage: true,
      visitPaths: ['/']
    },
    adaptiveDelay: {
      enabled: true,
      baseDelay: 5000,
      multiplier: 1.0,
      maxDelay: 50000
    },
    referrerChain: {
      enabled: true
    }
  }
};

export function getSiteProfile(hostname: string): SiteProfile {
  // 1. Try exact match
  if (SITE_PROFILES[hostname]) {
    return SITE_PROFILES[hostname];
  }

  // 2. Try partial match (e.g. www.ryans.com -> ryans.com)
  const key = Object.keys(SITE_PROFILES).find(k => hostname.includes(k));
  if (key) {
    return SITE_PROFILES[key];
  }

  // 3. Default Profile
  return {
    strategy: 'full-js', // Safest default
    selectors: {},
    waitTime: 3000,
    cacheTime: 1800,
    successRate: 0.7,
    retryCount: 2
  };
}

import { RateLimiter } from '../services/rate-limiter';
import { configurationManager } from '../services/config-manager';

// Site Profile Manager for adaptive delay management
interface DomainState {
  profile: SiteProfile;
  currentMultiplier: number;
  consecutiveSuccesses: number;
  lastRequestTime: number;
  activeRequests: number;
  requestQueue: Array<() => void>; // Queue for waiting requests
  navigationHistory: string[]; // Track navigation history for referrer chain
}

class SiteProfileManager {
  private domainStates: Map<string, DomainState> = new Map();
  private rateLimiter: RateLimiter = new RateLimiter();

  /**
   * Get the site profile for a domain.
   * Returns existing profile or creates a new one with defaults.
   * 
   * @param domain - Domain name (e.g., 'example.com')
   * @returns Site profile configuration
   * 
   * @example
   * ```typescript
   * const profile = siteProfileManager.getProfile('example.com');
   * console.log(`Strategy: ${profile.strategy}`);
   * console.log(`Wait time: ${profile.waitTime}ms`);
   * ```
   */
  getProfile(domain: string): SiteProfile {
    const state = this.domainStates.get(domain);
    if (state) {
      return state.profile;
    }

    // Try to get profile from ConfigurationManager first
    const configProfile = configurationManager.getSiteProfile(domain);
    const profile = configProfile || getSiteProfile(domain);

    this.domainStates.set(domain, {
      profile,
      currentMultiplier: 1.0,
      consecutiveSuccesses: 0,
      lastRequestTime: 0,
      activeRequests: 0,
      requestQueue: [],
      navigationHistory: []
    });

    return profile;
  }

  /**
   * Update a site profile with new settings.
   * Updates both ConfigurationManager (for persistence) and local state.
   * 
   * @param domain - Domain name (e.g., 'example.com')
   * @param updates - Partial profile updates to apply
   * 
   * @example
   * ```typescript
   * siteProfileManager.updateProfile('example.com', {
   *   rateLimit: {
   *     requestsPerMinute: 10,
   *     concurrentRequests: 2
   *   },
   *   adaptiveDelay: {
   *     enabled: true,
   *     baseDelay: 3000,
   *     multiplier: 1.0,
   *     maxDelay: 30000
   *   }
   * });
   * ```
   */
  updateProfile(domain: string, updates: Partial<SiteProfile>): void {
    // Update in ConfigurationManager for persistence
    configurationManager.updateSiteProfile(domain, updates);

    // Update local state
    const state = this.domainStates.get(domain);
    if (state) {
      state.profile = { ...state.profile, ...updates };
    } else {
      const profile = this.getProfile(domain);
      this.domainStates.set(domain, {
        profile: { ...profile, ...updates },
        currentMultiplier: 1.0,
        consecutiveSuccesses: 0,
        lastRequestTime: 0,
        activeRequests: 0,
        requestQueue: [],
        navigationHistory: []
      });
    }
  }

  /**
   * Get the current adaptive delay for a domain.
   * Calculates delay based on base delay and current multiplier.
   * 
   * @param domain - Domain name (e.g., 'example.com')
   * @returns Current delay in milliseconds
   * 
   * @example
   * ```typescript
   * const delay = siteProfileManager.getAdaptiveDelay('example.com');
   * await new Promise(resolve => setTimeout(resolve, delay));
   * ```
   */
  getAdaptiveDelay(domain: string): number {
    const state = this.domainStates.get(domain);
    if (!state) {
      const profile = this.getProfile(domain);
      const newState = this.domainStates.get(domain)!;
      return this.calculateDelay(profile, newState.currentMultiplier);
    }

    return this.calculateDelay(state.profile, state.currentMultiplier);
  }

  private calculateDelay(profile: SiteProfile, multiplier: number): number {
    if (!profile.adaptiveDelay?.enabled) {
      return profile.waitTime;
    }

    const delay = profile.adaptiveDelay.baseDelay * multiplier;
    return Math.min(delay, profile.adaptiveDelay.maxDelay);
  }

  /**
   * Increase delay multiplier for a domain.
   * Called when receiving 429 status or block detection.
   * Multiplies current delay by 1.5x.
   * 
   * @param domain - Domain name (e.g., 'example.com')
   * 
   * @example
   * ```typescript
   * if (response.status === 429) {
   *   siteProfileManager.increaseDelay('example.com');
   * }
   * ```
   */
  increaseDelay(domain: string): void {
    const state = this.domainStates.get(domain);
    if (!state) {
      this.getProfile(domain);
      return this.increaseDelay(domain);
    }

    // Increase multiplier by 1.5x on 429 or block detection
    state.currentMultiplier *= 1.5;
    state.consecutiveSuccesses = 0;

    // Cap multiplier at reasonable maximum
    if (state.profile.adaptiveDelay?.enabled) {
      const maxMultiplier = state.profile.adaptiveDelay.maxDelay / state.profile.adaptiveDelay.baseDelay;
      state.currentMultiplier = Math.min(state.currentMultiplier, maxMultiplier);
    }
  }

  /**
   * Decrease delay multiplier for a domain.
   * Called after consecutive successful responses.
   * Multiplies current delay by 0.9x after 10 consecutive successes.
   * 
   * @param domain - Domain name (e.g., 'example.com')
   * 
   * @example
   * ```typescript
   * if (response.ok) {
   *   siteProfileManager.decreaseDelay('example.com');
   * }
   * ```
   */
  decreaseDelay(domain: string): void {
    const state = this.domainStates.get(domain);
    if (!state) {
      this.getProfile(domain);
      return;
    }

    state.consecutiveSuccesses++;

    // Decrease multiplier by 0.9x after 10 consecutive successes
    if (state.consecutiveSuccesses >= 10) {
      state.currentMultiplier *= 0.9;
      state.consecutiveSuccesses = 0;

      // Don't go below 1.0
      state.currentMultiplier = Math.max(state.currentMultiplier, 1.0);
    }
  }

  // Helper methods for rate limiting and concurrent request tracking
  getActiveRequests(domain: string): number {
    const state = this.domainStates.get(domain);
    return state?.activeRequests ?? 0;
  }

  incrementActiveRequests(domain: string): void {
    const state = this.domainStates.get(domain);
    if (state) {
      state.activeRequests++;
    }
  }

  decrementActiveRequests(domain: string): void {
    const state = this.domainStates.get(domain);
    if (state && state.activeRequests > 0) {
      state.activeRequests--;
    }
  }

  updateLastRequestTime(domain: string): void {
    const state = this.domainStates.get(domain);
    if (state) {
      state.lastRequestTime = Date.now();
    }
  }

  getLastRequestTime(domain: string): number {
    const state = this.domainStates.get(domain);
    return state?.lastRequestTime ?? 0;
  }

  /**
   * Apply a pre-configured anti-bot profile to a domain.
   * Uses ConfigurationManager to apply and persist the profile.
   * 
   * @param domain - Domain name (e.g., 'example.com')
   * @param antiBotSystem - Anti-bot system type ('cloudflare', 'perimeterx', or 'datadome')
   * 
   * @example
   * ```typescript
   * // Apply Cloudflare profile
   * siteProfileManager.applyAntiBotProfile('example.com', 'cloudflare');
   * ```
   */
  applyAntiBotProfile(domain: string, antiBotSystem: 'cloudflare' | 'perimeterx' | 'datadome'): void {
    // Use ConfigurationManager to apply anti-bot profile
    configurationManager.applyAntiBotProfile(domain, antiBotSystem);

    // Refresh local state
    const updatedProfile = configurationManager.getSiteProfile(domain);
    if (updatedProfile) {
      const state = this.domainStates.get(domain);
      if (state) {
        state.profile = updatedProfile;
      }
    }
  }

  /**
   * Acquire a slot for concurrent request limiting.
   * Waits if the concurrent request limit is reached.
   * Must be paired with releaseConcurrentSlot() in a try-finally block.
   * 
   * @param domain - Domain name (e.g., 'example.com')
   * 
   * @example
   * ```typescript
   * await siteProfileManager.acquireConcurrentSlot('example.com');
   * try {
   *   // Make request
   * } finally {
   *   siteProfileManager.releaseConcurrentSlot('example.com');
   * }
   * ```
   */
  async acquireConcurrentSlot(domain: string): Promise<void> {
    const profile = this.getProfile(domain);

    if (!profile.rateLimit?.concurrentRequests) {
      // No concurrent limit configured
      return;
    }

    const state = this.domainStates.get(domain)!;
    const limit = profile.rateLimit.concurrentRequests;

    // If under limit, increment and proceed
    if (state.activeRequests < limit) {
      state.activeRequests++;
      return;
    }

    // Otherwise, queue the request
    return new Promise<void>((resolve) => {
      state.requestQueue.push(() => {
        state.activeRequests++;
        resolve();
      });
    });
  }

  /**
   * Release a concurrent request slot.
   * Processes the next queued request if any.
   * Should be called in a finally block after acquireConcurrentSlot().
   * 
   * @param domain - Domain name (e.g., 'example.com')
   * 
   * @example
   * ```typescript
   * await siteProfileManager.acquireConcurrentSlot('example.com');
   * try {
   *   // Make request
   * } finally {
   *   siteProfileManager.releaseConcurrentSlot('example.com');
   * }
   * ```
   */
  releaseConcurrentSlot(domain: string): void {
    const state = this.domainStates.get(domain);
    if (!state) return;

    state.activeRequests = Math.max(0, state.activeRequests - 1);

    // Process next queued request if any
    const nextRequest = state.requestQueue.shift();
    if (nextRequest) {
      nextRequest();
    }
  }

  /**
   * Wait for rate limit to allow request.
   * Uses token bucket algorithm to enforce requests-per-minute limits.
   * 
   * @param domain - Domain name (e.g., 'example.com')
   * 
   * @example
   * ```typescript
   * await siteProfileManager.waitForRateLimit('example.com');
   * // Now safe to make request
   * ```
   */
  async waitForRateLimit(domain: string): Promise<void> {
    const profile = this.getProfile(domain);

    if (!profile.rateLimit) {
      return; // No rate limiting configured
    }

    await this.rateLimiter.waitForToken(domain, {
      requestsPerMinute: profile.rateLimit.requestsPerMinute,
      maxBurst: profile.rateLimit.requestsPerMinute
    });
  }

  /**
   * Check if rate limit allows request without waiting
   */
  canMakeRequest(domain: string): boolean {
    const profile = this.getProfile(domain);

    if (!profile.rateLimit) {
      return true; // No rate limiting configured
    }

    return this.rateLimiter.hasToken(domain, {
      requestsPerMinute: profile.rateLimit.requestsPerMinute,
      maxBurst: profile.rateLimit.requestsPerMinute
    });
  }

  /**
   * Track navigation to a URL for referrer chain
   */
  trackNavigation(domain: string, url: string): void {
    const state = this.domainStates.get(domain);
    if (!state) {
      this.getProfile(domain);
      return this.trackNavigation(domain, url);
    }

    // Add to navigation history
    state.navigationHistory.push(url);

    // Keep only last 10 URLs to avoid memory issues
    if (state.navigationHistory.length > 10) {
      state.navigationHistory.shift();
    }
  }

  /**
   * Get the referrer URL for the next request
   * Returns the last visited URL in the navigation chain
   */
  getReferrer(domain: string): string | undefined {
    const state = this.domainStates.get(domain);
    if (!state || state.navigationHistory.length === 0) {
      return undefined;
    }

    // Return the last URL in the history
    return state.navigationHistory[state.navigationHistory.length - 1];
  }

  /**
   * Clear navigation history for a domain
   */
  clearNavigationHistory(domain: string): void {
    const state = this.domainStates.get(domain);
    if (state) {
      state.navigationHistory = [];
    }
  }
}

// Export singleton instance
export const siteProfileManager = new SiteProfileManager();
