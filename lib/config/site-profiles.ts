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

// Site Profile Manager for adaptive delay management
interface DomainState {
  profile: SiteProfile;
  currentMultiplier: number;
  consecutiveSuccesses: number;
  lastRequestTime: number;
  activeRequests: number;
}

class SiteProfileManager {
  private domainStates: Map<string, DomainState> = new Map();

  getProfile(domain: string): SiteProfile {
    const state = this.domainStates.get(domain);
    if (state) {
      return state.profile;
    }
    
    const profile = getSiteProfile(domain);
    this.domainStates.set(domain, {
      profile,
      currentMultiplier: 1.0,
      consecutiveSuccesses: 0,
      lastRequestTime: 0,
      activeRequests: 0
    });
    
    return profile;
  }

  updateProfile(domain: string, updates: Partial<SiteProfile>): void {
    const state = this.domainStates.get(domain);
    if (state) {
      state.profile = { ...state.profile, ...updates };
    } else {
      const profile = getSiteProfile(domain);
      this.domainStates.set(domain, {
        profile: { ...profile, ...updates },
        currentMultiplier: 1.0,
        consecutiveSuccesses: 0,
        lastRequestTime: 0,
        activeRequests: 0
      });
    }
  }

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

  // Apply anti-bot profile to a domain
  applyAntiBotProfile(domain: string, antiBotSystem: 'cloudflare' | 'perimeterx' | 'datadome'): void {
    const antiBotProfile = ANTI_BOT_PROFILES[antiBotSystem];
    
    if (antiBotProfile) {
      this.updateProfile(domain, antiBotProfile);
    }
  }
}

// Export singleton instance
export const siteProfileManager = new SiteProfileManager();
