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
