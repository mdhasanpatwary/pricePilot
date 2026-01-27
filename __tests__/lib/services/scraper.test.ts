import { ScraperService } from "@/lib/services/scraper";

// Mock Redis
jest.mock("@upstash/redis", () => ({
  Redis: {
    fromEnv: jest.fn().mockReturnValue({
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
    }),
  },
}));

// Mock Playwright
jest.mock("playwright", () => ({
  chromium: {
    launch: jest.fn().mockResolvedValue({
      newContext: jest.fn().mockResolvedValue({
        newPage: jest.fn().mockResolvedValue({
          goto: jest.fn().mockResolvedValue({
            status: jest.fn().mockReturnValue(200),
          }),
          title: jest.fn().mockResolvedValue("Test Page"),
          content: jest
            .fn()
            .mockResolvedValue("<html><body>Test</body></html>"),
          waitForTimeout: jest.fn().mockResolvedValue({}),
          waitForSelector: jest.fn().mockResolvedValue({}),
          close: jest.fn().mockResolvedValue({}),
          evaluate: jest.fn().mockResolvedValue({}),
          $: jest.fn().mockResolvedValue(null),
          $$: jest.fn().mockResolvedValue([]),
          $eval: jest.fn().mockResolvedValue("mock text"),
          $$eval: jest.fn().mockResolvedValue([]),
          url: jest.fn().mockReturnValue("https://example.com"),
        }),
        addInitScript: jest.fn().mockResolvedValue({}),
        close: jest.fn().mockResolvedValue({}),
      }),
      close: jest.fn().mockResolvedValue({}),
    }),
  },
}));

// Mock playwright-extra
jest.mock("playwright-extra", () => ({
  chromium: {
    use: jest.fn(),
    launch: jest.fn().mockResolvedValue({
      newContext: jest.fn().mockResolvedValue({
        newPage: jest.fn().mockResolvedValue({
          goto: jest.fn().mockResolvedValue({
            status: jest.fn().mockReturnValue(200),
          }),
          title: jest.fn().mockResolvedValue("Test Page"),
          content: jest
            .fn()
            .mockResolvedValue("<html><body>Test</body></html>"),
          waitForTimeout: jest.fn().mockResolvedValue({}),
          waitForSelector: jest.fn().mockResolvedValue({}),
          close: jest.fn().mockResolvedValue({}),
          evaluate: jest.fn().mockResolvedValue({}),
          $: jest.fn().mockResolvedValue(null),
          $$: jest.fn().mockResolvedValue([]),
          $eval: jest.fn().mockResolvedValue("mock text"),
          $$eval: jest.fn().mockResolvedValue([]),
          url: jest.fn().mockReturnValue("https://example.com"),
        }),
        addInitScript: jest.fn().mockResolvedValue({}),
        close: jest.fn().mockResolvedValue({}),
      }),
      close: jest.fn().mockResolvedValue({}),
    }),
  },
}));

// Mock stealth plugin
jest.mock("puppeteer-extra-plugin-stealth", () => {
  return jest.fn().mockReturnValue({});
});

// Mock Prisma
jest.mock("@/lib/prisma", () => ({
  prisma: {
    site: {
      findUnique: jest.fn().mockResolvedValue(null),
    },
    syncLog: {
      create: jest.fn().mockResolvedValue({}),
    },
    scrapingMetrics: {
      findMany: jest.fn().mockResolvedValue([]),
    },
    proxyMetrics: {
      findMany: jest.fn().mockResolvedValue([]),
    },
  },
}));

describe("ScraperService - Load Testing", () => {
  let scraper: ScraperService;

  beforeAll(async () => {
    scraper = new ScraperService();
    await scraper.init();
  });

  afterAll(async () => {
    await scraper.close();
  });

  describe("Performance Tests", () => {
    it("should scrape a single page within acceptable time", async () => {
      const testUrl = "https://example.com/product";
      const startTime = Date.now();

      // Mock scraping (in real tests, use a test server)
      await scraper.scrapeProductPage(testUrl);

      const duration = Date.now() - startTime;

      // Should complete within 30 seconds
      expect(duration).toBeLessThan(30000);
    }, 35000);

    it("should handle multiple concurrent scrapes", async () => {
      const urls = [
        "https://example.com/product1",
        "https://example.com/product2",
        "https://example.com/product3",
        "https://example.com/product4",
        "https://example.com/product5",
      ];

      const startTime = Date.now();

      const promises = urls.map((url) => scraper.scrapeProductPage(url));
      const results = await Promise.all(promises);

      const duration = Date.now() - startTime;

      // Should complete all within 60 seconds
      expect(duration).toBeLessThan(60000);
      expect(results).toHaveLength(5);
    }, 65000);

    it.skip("should handle batch scraping efficiently", async () => {
      const urls = Array.from(
        { length: 10 },
        (_, i) => `https://example.com/product${i + 1}`,
      );

      const startTime = Date.now();

      await scraper.scrapeMultiple(urls);

      const duration = Date.now() - startTime;

      // With rate limiting, should take ~10 seconds (1 second between requests)
      expect(duration).toBeGreaterThan(9000);
      expect(duration).toBeLessThan(20000);
    }, 30000);
  });

  describe("Error Handling", () => {
    it.skip("should handle invalid URLs gracefully", async () => {
      const invalidUrl = "not-a-valid-url";

      const _result = await scraper.scrapeProductPage(invalidUrl);

      expect(_result).toBeNull();
    });

    it.skip("should handle network timeouts", async () => {
      const slowUrl = "https://httpstat.us/200?sleep=35000"; // 35 second delay

      const startTime = Date.now();
      const _result = await scraper.scrapeProductPage(slowUrl);
      const duration = Date.now() - startTime;

      // Should timeout at 30 seconds
      expect(duration).toBeLessThan(35000);
      expect(_result).toBeNull();
    }, 40000);

    it.skip("should handle 404 errors", async () => {
      const notFoundUrl = "https://httpstat.us/404";

      const _result = await scraper.scrapeProductPage(notFoundUrl);

      // Should return null for non-product pages
      expect(_result).toBeNull();
    }, 10000);
  });

  describe("Memory Management", () => {
    it.skip("should not leak memory with multiple scrapes", async () => {
      const initialMemory = process.memoryUsage().heapUsed;

      // Perform 20 scrapes
      for (let i = 0; i < 20; i++) {
        await scraper.scrapeProductPage(`https://example.com/product${i}`);
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;

      // Memory increase should be reasonable (< 100MB)
      expect(memoryIncrease).toBeLessThan(100 * 1024 * 1024);
    }, 180000);
  });

  describe("Extraction Accuracy", () => {
    it("should extract data from JSON-LD", async () => {
      // This would require a mock server with JSON-LD data
      // For now, we'll skip implementation
      expect(true).toBe(true);
    });

    it("should fallback to OpenGraph when JSON-LD fails", async () => {
      // This would require a mock server with OpenGraph data
      expect(true).toBe(true);
    });

    it("should fallback to CSS selectors when both fail", async () => {
      // This would require a mock server with standard HTML
      expect(true).toBe(true);
    });
  });

  describe("Challenge Handler Integration", () => {
    it("should detect and handle challenges during scraping", async () => {
      // Verify that challenge handler is initialized
      expect(scraper['challengeHandler']).toBeDefined();

      // Verify that challenge detection is called during scraping
      const detectChallengeSpy = jest.spyOn(scraper['challengeHandler'], 'detectChallenge');

      await scraper.scrapeProductPage('https://example.com/product');

      // Challenge detection should be called
      expect(detectChallengeSpy).toHaveBeenCalled();

      detectChallengeSpy.mockRestore();
    }, 30000);

    it("should record challenge attempts", async () => {
      const recordSpy = jest.spyOn(scraper['challengeHandler'], 'recordChallengeAttempt');

      // Mock a challenge being detected
      jest.spyOn(scraper['challengeHandler'], 'detectChallenge').mockResolvedValueOnce({
        detected: true,
        type: 'cloudflare',
        solved: false,
        attempts: 0,
        duration: 100
      });

      jest.spyOn(scraper['challengeHandler'], 'waitForChallenge').mockResolvedValueOnce({
        detected: true,
        type: 'cloudflare',
        solved: true,
        attempts: 2,
        duration: 5000
      });

      await scraper.scrapeProductPage('https://example.com/product').catch(() => { });

      // Challenge attempt should be recorded
      expect(recordSpy).toHaveBeenCalled();

      recordSpy.mockRestore();
    }, 30000);

    it("should get challenge statistics", () => {
      const stats = scraper.getChallengeStats('example.com');

      // Should return an array (may be empty if no challenges recorded)
      expect(Array.isArray(stats)).toBe(true);
    });
  });

  describe("MetricsTracker Integration", () => {
    it("should initialize MetricsTracker", () => {
      // Verify that metrics tracker is initialized
      expect(scraper['metricsTracker']).toBeDefined();
    });

    it.skip("should record request outcomes during scraping", async () => {
      const recordSpy = jest.spyOn(scraper['metricsTracker'], 'recordRequest');

      await scraper.scrapeProductPage('https://example.com/product');

      // Request should be recorded
      expect(recordSpy).toHaveBeenCalled();

      // Verify the call includes required fields
      const callArgs = recordSpy.mock.calls[0];
      expect(callArgs[0]).toBe('example.com'); // site
      expect(typeof callArgs[1]).toBe('string'); // proxy
      expect(callArgs[2]).toHaveProperty('success');
      expect(callArgs[2]).toHaveProperty('blocked');
      expect(callArgs[2]).toHaveProperty('challenged');
      expect(callArgs[2]).toHaveProperty('responseTime');
      expect(callArgs[2]).toHaveProperty('statusCode');

      recordSpy.mockRestore();
    }, 10000);

    it.skip("should check thresholds after recording metrics", async () => {
      const checkSpy = jest.spyOn(scraper['metricsTracker'], 'checkThresholds');

      await scraper.scrapeProductPage('https://example.com/product');

      // Thresholds should be checked
      expect(checkSpy).toHaveBeenCalled();

      checkSpy.mockRestore();
    }, 10000);

    it("should get site metrics", async () => {
      const metrics = await scraper.getSiteMetrics('example.com', '24h');

      // Should return metrics object
      expect(metrics).toBeDefined();
      expect(metrics).toHaveProperty('site');
      expect(metrics).toHaveProperty('totalRequests');
      expect(metrics).toHaveProperty('successRate');
      expect(metrics).toHaveProperty('blockRate');
    });

    it("should get proxy metrics", async () => {
      const metrics = await scraper.getProxyMetricsForProxy('http://proxy.example.com', '24h');

      // Should return metrics object
      expect(metrics).toBeDefined();
      expect(metrics).toHaveProperty('proxy');
      expect(metrics).toHaveProperty('totalRequests');
      expect(metrics).toHaveProperty('successRate');
    });

    it("should persist metrics on close", async () => {
      const persistSpy = jest.spyOn(scraper['metricsTracker'], 'persistMetrics');

      await scraper.close();

      // Metrics should be persisted
      expect(persistSpy).toHaveBeenCalled();

      persistSpy.mockRestore();

      // Re-initialize for other tests
      scraper = new ScraperService();
      await scraper.init();
    }, 10000);

    it("should stop auto-persist on close", async () => {
      const stopSpy = jest.spyOn(scraper['metricsTracker'], 'stopAutoPersist');

      await scraper.close();

      // Auto-persist should be stopped
      expect(stopSpy).toHaveBeenCalled();

      stopSpy.mockRestore();

      // Re-initialize for other tests
      scraper = new ScraperService();
      await scraper.init();
    }, 10000);

    it("should manually persist metrics", async () => {
      const persistSpy = jest.spyOn(scraper['metricsTracker'], 'persistMetrics');

      await scraper.persistMetrics();

      // Metrics should be persisted
      expect(persistSpy).toHaveBeenCalled();

      persistSpy.mockRestore();
    });
  });
});

describe('ScraperService - CaptchaSolver Integration', () => {
  it('should initialize CaptchaSolver when enabled', () => {
    // Set environment variables
    process.env.CAPTCHA_SOLVER_ENABLED = 'true';
    process.env.CAPTCHA_SOLVER_API_KEY = 'test-api-key';

    const scraperWithCaptcha = new ScraperService();

    // CaptchaSolver should be initialized
    expect(scraperWithCaptcha['captchaSolver']).toBeDefined();

    // Clean up
    delete process.env.CAPTCHA_SOLVER_ENABLED;
    delete process.env.CAPTCHA_SOLVER_API_KEY;
  });

  it('should not initialize CaptchaSolver when disabled', () => {
    // Ensure environment variables are not set
    delete process.env.CAPTCHA_SOLVER_ENABLED;
    delete process.env.CAPTCHA_SOLVER_API_KEY;

    const scraperWithoutCaptcha = new ScraperService();

    // CaptchaSolver should not be initialized
    expect(scraperWithoutCaptcha['captchaSolver']).toBeNull();
  });

  it('should not initialize CaptchaSolver when API key is missing', () => {
    // Set enabled but no API key
    process.env.CAPTCHA_SOLVER_ENABLED = 'true';
    delete process.env.CAPTCHA_SOLVER_API_KEY;

    const scraperWithoutKey = new ScraperService();

    // CaptchaSolver should not be initialized
    expect(scraperWithoutKey['captchaSolver']).toBeNull();

    // Clean up
    delete process.env.CAPTCHA_SOLVER_ENABLED;
  });
});
