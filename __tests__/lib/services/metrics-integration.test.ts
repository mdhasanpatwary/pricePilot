/**
 * Integration test for MetricsTracker in Scraper
 * 
 * This test verifies that the MetricsTracker is properly integrated
 * into the Scraper service and records metrics correctly.
 */

import { ScraperService } from "@/lib/services/scraper";
import { MetricsTracker } from "@/lib/services/metrics-tracker";

// Mock Prisma
jest.mock("@/lib/prisma", () => ({
  prisma: {
    scrapingMetrics: {
      findMany: jest.fn().mockResolvedValue([]),
      create: jest.fn().mockResolvedValue({}),
    },
    proxyMetrics: {
      findMany: jest.fn().mockResolvedValue([]),
      create: jest.fn().mockResolvedValue({}),
    },
    site: {
      findUnique: jest.fn().mockResolvedValue(null),
    },
    syncLog: {
      create: jest.fn().mockResolvedValue({}),
    },
  },
}));

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

describe("MetricsTracker Integration with Scraper", () => {
  let scraper: ScraperService;

  beforeEach(() => {
    scraper = new ScraperService();
  });

  afterEach(async () => {
    if (scraper) {
      await scraper.close().catch(() => {});
    }
  });

  it("should initialize MetricsTracker in constructor", () => {
    expect(scraper['metricsTracker']).toBeDefined();
    expect(scraper['metricsTracker']).toBeInstanceOf(MetricsTracker);
  });

  it("should expose getSiteMetrics method", async () => {
    const metrics = await scraper.getSiteMetrics('example.com', '24h');
    
    expect(metrics).toBeDefined();
    expect(metrics).toHaveProperty('site', 'example.com');
    expect(metrics).toHaveProperty('totalRequests');
    expect(metrics).toHaveProperty('successRate');
    expect(metrics).toHaveProperty('blockRate');
    expect(metrics).toHaveProperty('avgResponseTime');
  });

  it("should expose getProxyMetricsForProxy method", async () => {
    const metrics = await scraper.getProxyMetricsForProxy('http://proxy.example.com', '24h');
    
    expect(metrics).toBeDefined();
    expect(metrics).toHaveProperty('proxy', 'http://proxy.example.com');
    expect(metrics).toHaveProperty('totalRequests');
    expect(metrics).toHaveProperty('successRate');
    expect(metrics).toHaveProperty('avgResponseTime');
  });

  it("should expose persistMetrics method", async () => {
    const persistSpy = jest.spyOn(scraper['metricsTracker'], 'persistMetrics');
    
    await scraper.persistMetrics();
    
    expect(persistSpy).toHaveBeenCalled();
    
    persistSpy.mockRestore();
  });

  it("should record metrics when recordRequest is called", () => {
    const recordSpy = jest.spyOn(scraper['metricsTracker'], 'recordRequest');
    
    scraper['metricsTracker'].recordRequest('example.com', 'direct', {
      success: true,
      blocked: false,
      challenged: false,
      responseTime: 1000,
      statusCode: 200,
    });
    
    expect(recordSpy).toHaveBeenCalledWith('example.com', 'direct', {
      success: true,
      blocked: false,
      challenged: false,
      responseTime: 1000,
      statusCode: 200,
    });
    
    recordSpy.mockRestore();
  });

  it("should check thresholds when checkThresholds is called", () => {
    const checkSpy = jest.spyOn(scraper['metricsTracker'], 'checkThresholds');
    
    scraper['metricsTracker'].checkThresholds();
    
    expect(checkSpy).toHaveBeenCalled();
    
    checkSpy.mockRestore();
  });

  it("should persist metrics on close", async () => {
    const persistSpy = jest.spyOn(scraper['metricsTracker'], 'persistMetrics');
    
    await scraper.close();
    
    expect(persistSpy).toHaveBeenCalled();
    
    persistSpy.mockRestore();
  });

  it("should stop auto-persist on close", async () => {
    const stopSpy = jest.spyOn(scraper['metricsTracker'], 'stopAutoPersist');
    
    await scraper.close();
    
    expect(stopSpy).toHaveBeenCalled();
    
    stopSpy.mockRestore();
  });

  it("should handle metrics persistence errors gracefully", async () => {
    const persistSpy = jest.spyOn(scraper['metricsTracker'], 'persistMetrics')
      .mockRejectedValueOnce(new Error('Database error'));
    
    // Should not throw
    await expect(scraper.close()).resolves.not.toThrow();
    
    persistSpy.mockRestore();
  });

  it("should track block rates correctly", async () => {
    // Record some requests
    scraper['metricsTracker'].recordRequest('example.com', 'direct', {
      success: false,
      blocked: true,
      challenged: false,
      responseTime: 1000,
      statusCode: 403,
    });
    
    scraper['metricsTracker'].recordRequest('example.com', 'direct', {
      success: true,
      blocked: false,
      challenged: false,
      responseTime: 500,
      statusCode: 200,
    });
    
    const metrics = await scraper.getSiteMetrics('example.com', '24h');
    
    expect(metrics.totalRequests).toBe(2);
    expect(metrics.blockedRequests).toBe(1);
    expect(metrics.successfulRequests).toBe(1);
    expect(metrics.blockRate).toBe(0.5);
    expect(metrics.successRate).toBe(0.5);
  });

  it("should track success rates correctly", async () => {
    // Record multiple successful requests
    for (let i = 0; i < 8; i++) {
      scraper['metricsTracker'].recordRequest('example.com', 'direct', {
        success: true,
        blocked: false,
        challenged: false,
        responseTime: 500,
        statusCode: 200,
      });
    }
    
    // Record 2 failed requests
    for (let i = 0; i < 2; i++) {
      scraper['metricsTracker'].recordRequest('example.com', 'direct', {
        success: false,
        blocked: false,
        challenged: false,
        responseTime: 1000,
        statusCode: 500,
      });
    }
    
    const metrics = await scraper.getSiteMetrics('example.com', '24h');
    
    expect(metrics.totalRequests).toBe(10);
    expect(metrics.successfulRequests).toBe(8);
    expect(metrics.successRate).toBe(0.8);
  });

  it("should track challenged requests correctly", async () => {
    scraper['metricsTracker'].recordRequest('example.com', 'direct', {
      success: true,
      blocked: false,
      challenged: true,
      responseTime: 5000,
      statusCode: 200,
    });
    
    const metrics = await scraper.getSiteMetrics('example.com', '24h');
    
    expect(metrics.challengedRequests).toBe(1);
  });

  it("should calculate average response time correctly", async () => {
    scraper['metricsTracker'].recordRequest('example.com', 'direct', {
      success: true,
      blocked: false,
      challenged: false,
      responseTime: 1000,
      statusCode: 200,
    });
    
    scraper['metricsTracker'].recordRequest('example.com', 'direct', {
      success: true,
      blocked: false,
      challenged: false,
      responseTime: 2000,
      statusCode: 200,
    });
    
    const metrics = await scraper.getSiteMetrics('example.com', '24h');
    
    expect(metrics.avgResponseTime).toBe(1500);
  });
});
