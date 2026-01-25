import { 
  SiteProfile, 
  getSiteProfile, 
  siteProfileManager,
  ANTI_BOT_PROFILES 
} from '../../../lib/config/site-profiles';

describe('Site Profile Manager', () => {
  beforeEach(() => {
    // Reset the manager state between tests
    (siteProfileManager as any).domainStates.clear();
  });

  describe('SiteProfile interface extensions', () => {
    test('should support rateLimit configuration', () => {
      const profile: SiteProfile = {
        strategy: 'full-js',
        selectors: {},
        waitTime: 3000,
        cacheTime: 1800,
        successRate: 0.7,
        retryCount: 2,
        rateLimit: {
          requestsPerMinute: 10,
          concurrentRequests: 2
        }
      };

      expect(profile.rateLimit).toBeDefined();
      expect(profile.rateLimit?.requestsPerMinute).toBe(10);
      expect(profile.rateLimit?.concurrentRequests).toBe(2);
    });

    test('should support sessionWarmup configuration', () => {
      const profile: SiteProfile = {
        strategy: 'full-js',
        selectors: {},
        waitTime: 3000,
        cacheTime: 1800,
        successRate: 0.7,
        retryCount: 2,
        sessionWarmup: {
          enabled: true,
          visitHomepage: true,
          visitPaths: ['/about', '/products']
        }
      };

      expect(profile.sessionWarmup).toBeDefined();
      expect(profile.sessionWarmup?.enabled).toBe(true);
      expect(profile.sessionWarmup?.visitHomepage).toBe(true);
      expect(profile.sessionWarmup?.visitPaths).toEqual(['/about', '/products']);
    });

    test('should support adaptiveDelay configuration', () => {
      const profile: SiteProfile = {
        strategy: 'full-js',
        selectors: {},
        waitTime: 3000,
        cacheTime: 1800,
        successRate: 0.7,
        retryCount: 2,
        adaptiveDelay: {
          enabled: true,
          baseDelay: 2000,
          multiplier: 1.5,
          maxDelay: 30000
        }
      };

      expect(profile.adaptiveDelay).toBeDefined();
      expect(profile.adaptiveDelay?.enabled).toBe(true);
      expect(profile.adaptiveDelay?.baseDelay).toBe(2000);
      expect(profile.adaptiveDelay?.multiplier).toBe(1.5);
      expect(profile.adaptiveDelay?.maxDelay).toBe(30000);
    });

    test('should support referrerChain configuration', () => {
      const profile: SiteProfile = {
        strategy: 'full-js',
        selectors: {},
        waitTime: 3000,
        cacheTime: 1800,
        successRate: 0.7,
        retryCount: 2,
        referrerChain: {
          enabled: true,
          startUrl: 'https://example.com'
        }
      };

      expect(profile.referrerChain).toBeDefined();
      expect(profile.referrerChain?.enabled).toBe(true);
      expect(profile.referrerChain?.startUrl).toBe('https://example.com');
    });
  });

  describe('Adaptive delay management', () => {
    test('getAdaptiveDelay returns waitTime when adaptiveDelay is disabled', () => {
      const domain = 'test.com';
      siteProfileManager.updateProfile(domain, {
        waitTime: 5000,
        adaptiveDelay: {
          enabled: false,
          baseDelay: 2000,
          multiplier: 1.0,
          maxDelay: 10000
        }
      });

      const delay = siteProfileManager.getAdaptiveDelay(domain);
      expect(delay).toBe(5000);
    });

    test('getAdaptiveDelay calculates delay with multiplier when enabled', () => {
      const domain = 'test.com';
      siteProfileManager.updateProfile(domain, {
        waitTime: 5000,
        adaptiveDelay: {
          enabled: true,
          baseDelay: 2000,
          multiplier: 1.0,
          maxDelay: 10000
        }
      });

      const delay = siteProfileManager.getAdaptiveDelay(domain);
      expect(delay).toBe(2000); // baseDelay * 1.0
    });

    test('increaseDelay multiplies delay by 1.5x', () => {
      const domain = 'test.com';
      siteProfileManager.updateProfile(domain, {
        waitTime: 5000,
        adaptiveDelay: {
          enabled: true,
          baseDelay: 2000,
          multiplier: 1.0,
          maxDelay: 10000
        }
      });

      const initialDelay = siteProfileManager.getAdaptiveDelay(domain);
      expect(initialDelay).toBe(2000);

      siteProfileManager.increaseDelay(domain);
      const increasedDelay = siteProfileManager.getAdaptiveDelay(domain);
      expect(increasedDelay).toBe(3000); // 2000 * 1.5
    });

    test('increaseDelay caps at maxDelay', () => {
      const domain = 'test.com';
      siteProfileManager.updateProfile(domain, {
        waitTime: 5000,
        adaptiveDelay: {
          enabled: true,
          baseDelay: 2000,
          multiplier: 1.0,
          maxDelay: 5000
        }
      });

      // Increase multiple times
      siteProfileManager.increaseDelay(domain);
      siteProfileManager.increaseDelay(domain);
      siteProfileManager.increaseDelay(domain);

      const delay = siteProfileManager.getAdaptiveDelay(domain);
      expect(delay).toBeLessThanOrEqual(5000);
    });

    test('decreaseDelay reduces multiplier after 10 consecutive successes', () => {
      const domain = 'test.com';
      siteProfileManager.updateProfile(domain, {
        waitTime: 5000,
        adaptiveDelay: {
          enabled: true,
          baseDelay: 2000,
          multiplier: 1.0,
          maxDelay: 10000
        }
      });

      // First increase the delay
      siteProfileManager.increaseDelay(domain);
      const increasedDelay = siteProfileManager.getAdaptiveDelay(domain);
      expect(increasedDelay).toBe(3000);

      // Call decreaseDelay 10 times
      for (let i = 0; i < 10; i++) {
        siteProfileManager.decreaseDelay(domain);
      }

      const decreasedDelay = siteProfileManager.getAdaptiveDelay(domain);
      expect(decreasedDelay).toBeLessThan(increasedDelay);
    });

    test('decreaseDelay does not go below 1.0 multiplier', () => {
      const domain = 'test.com';
      siteProfileManager.updateProfile(domain, {
        waitTime: 5000,
        adaptiveDelay: {
          enabled: true,
          baseDelay: 2000,
          multiplier: 1.0,
          maxDelay: 10000
        }
      });

      // Call decreaseDelay many times
      for (let i = 0; i < 50; i++) {
        siteProfileManager.decreaseDelay(domain);
      }

      const delay = siteProfileManager.getAdaptiveDelay(domain);
      expect(delay).toBeGreaterThanOrEqual(2000); // baseDelay * 1.0
    });

    test('increaseDelay resets consecutive successes counter', () => {
      const domain = 'test.com';
      siteProfileManager.updateProfile(domain, {
        waitTime: 5000,
        adaptiveDelay: {
          enabled: true,
          baseDelay: 2000,
          multiplier: 1.0,
          maxDelay: 10000
        }
      });

      // Build up some successes
      for (let i = 0; i < 5; i++) {
        siteProfileManager.decreaseDelay(domain);
      }

      // Increase delay (should reset counter)
      siteProfileManager.increaseDelay(domain);

      // Try to decrease - should need 10 more successes
      for (let i = 0; i < 9; i++) {
        siteProfileManager.decreaseDelay(domain);
      }

      const delayBefore = siteProfileManager.getAdaptiveDelay(domain);
      siteProfileManager.decreaseDelay(domain); // 10th success
      const delayAfter = siteProfileManager.getAdaptiveDelay(domain);

      expect(delayAfter).toBeLessThan(delayBefore);
    });
  });

  describe('Default anti-bot profiles', () => {
    test('Cloudflare profile has correct configuration', () => {
      const profile = ANTI_BOT_PROFILES['cloudflare'];
      
      expect(profile.strategy).toBe('full-js');
      expect(profile.waitTime).toBe(5000);
      expect(profile.retryCount).toBe(3);
      expect(profile.rateLimit).toEqual({
        requestsPerMinute: 10,
        concurrentRequests: 2
      });
      expect(profile.sessionWarmup?.enabled).toBe(true);
      expect(profile.adaptiveDelay?.enabled).toBe(true);
      expect(profile.referrerChain?.enabled).toBe(true);
    });

    test('PerimeterX profile has correct configuration', () => {
      const profile = ANTI_BOT_PROFILES['perimeterx'];
      
      expect(profile.strategy).toBe('full-js');
      expect(profile.waitTime).toBe(6000);
      expect(profile.retryCount).toBe(2);
      expect(profile.rateLimit).toEqual({
        requestsPerMinute: 8,
        concurrentRequests: 1
      });
      expect(profile.sessionWarmup?.visitPaths).toEqual(['/about', '/products']);
    });

    test('DataDome profile has correct configuration', () => {
      const profile = ANTI_BOT_PROFILES['datadome'];
      
      expect(profile.strategy).toBe('full-js');
      expect(profile.waitTime).toBe(7000);
      expect(profile.retryCount).toBe(2);
      expect(profile.rateLimit).toEqual({
        requestsPerMinute: 6,
        concurrentRequests: 1
      });
    });

    test('applyAntiBotProfile applies Cloudflare profile to domain', () => {
      const domain = 'protected-site.com';
      
      siteProfileManager.applyAntiBotProfile(domain, 'cloudflare');
      const profile = siteProfileManager.getProfile(domain);
      
      expect(profile.waitTime).toBe(5000);
      expect(profile.rateLimit?.requestsPerMinute).toBe(10);
      expect(profile.sessionWarmup?.enabled).toBe(true);
    });

    test('applyAntiBotProfile applies PerimeterX profile to domain', () => {
      const domain = 'protected-site.com';
      
      siteProfileManager.applyAntiBotProfile(domain, 'perimeterx');
      const profile = siteProfileManager.getProfile(domain);
      
      expect(profile.waitTime).toBe(6000);
      expect(profile.rateLimit?.requestsPerMinute).toBe(8);
    });

    test('applyAntiBotProfile applies DataDome profile to domain', () => {
      const domain = 'protected-site.com';
      
      siteProfileManager.applyAntiBotProfile(domain, 'datadome');
      const profile = siteProfileManager.getProfile(domain);
      
      expect(profile.waitTime).toBe(7000);
      expect(profile.rateLimit?.requestsPerMinute).toBe(6);
    });
  });

  describe('Helper methods', () => {
    test('getActiveRequests returns 0 for new domain', () => {
      const count = siteProfileManager.getActiveRequests('new-domain.com');
      expect(count).toBe(0);
    });

    test('incrementActiveRequests increases counter', () => {
      const domain = 'test.com';
      siteProfileManager.getProfile(domain); // Initialize
      
      siteProfileManager.incrementActiveRequests(domain);
      expect(siteProfileManager.getActiveRequests(domain)).toBe(1);
      
      siteProfileManager.incrementActiveRequests(domain);
      expect(siteProfileManager.getActiveRequests(domain)).toBe(2);
    });

    test('decrementActiveRequests decreases counter', () => {
      const domain = 'test.com';
      siteProfileManager.getProfile(domain); // Initialize
      
      siteProfileManager.incrementActiveRequests(domain);
      siteProfileManager.incrementActiveRequests(domain);
      expect(siteProfileManager.getActiveRequests(domain)).toBe(2);
      
      siteProfileManager.decrementActiveRequests(domain);
      expect(siteProfileManager.getActiveRequests(domain)).toBe(1);
    });

    test('decrementActiveRequests does not go below 0', () => {
      const domain = 'test.com';
      siteProfileManager.getProfile(domain); // Initialize
      
      siteProfileManager.decrementActiveRequests(domain);
      siteProfileManager.decrementActiveRequests(domain);
      
      expect(siteProfileManager.getActiveRequests(domain)).toBe(0);
    });

    test('updateLastRequestTime and getLastRequestTime work correctly', () => {
      const domain = 'test.com';
      siteProfileManager.getProfile(domain); // Initialize
      
      const before = Date.now();
      siteProfileManager.updateLastRequestTime(domain);
      const after = Date.now();
      
      const lastRequestTime = siteProfileManager.getLastRequestTime(domain);
      expect(lastRequestTime).toBeGreaterThanOrEqual(before);
      expect(lastRequestTime).toBeLessThanOrEqual(after);
    });

    test('getLastRequestTime returns 0 for new domain', () => {
      const time = siteProfileManager.getLastRequestTime('new-domain.com');
      expect(time).toBe(0);
    });
  });

  describe('Backward compatibility', () => {
    test('getSiteProfile still works for existing sites', () => {
      const profile = getSiteProfile('startech.com.bd');
      expect(profile.strategy).toBe('light-js');
      expect(profile.waitTime).toBe(2000);
    });

    test('getSiteProfile returns default for unknown sites', () => {
      const profile = getSiteProfile('unknown-site.com');
      expect(profile.strategy).toBe('full-js');
      expect(profile.waitTime).toBe(3000);
    });

    test('existing profiles work without new fields', () => {
      const profile = getSiteProfile('techlandbd.com');
      expect(profile.rateLimit).toBeUndefined();
      expect(profile.sessionWarmup).toBeUndefined();
      expect(profile.adaptiveDelay).toBeUndefined();
      expect(profile.referrerChain).toBeUndefined();
    });
  });
});
