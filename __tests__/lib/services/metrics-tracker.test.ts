/**
 * Unit tests for MetricsTracker service
 * Tests metrics recording, retrieval, persistence, and threshold checking
 */

import { MetricsTracker, RequestResult } from '../../../lib/services/metrics-tracker';
import { prisma } from '../../../lib/prisma';

// Mock Prisma
jest.mock('../../../lib/prisma', () => ({
  prisma: {
    scrapingMetrics: {
      create: jest.fn(),
      findMany: jest.fn(),
    },
    proxyMetrics: {
      create: jest.fn(),
      findMany: jest.fn(),
    },
  },
}));

// Mock logger
jest.mock('../../../lib/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

describe('MetricsTracker', () => {
  let tracker: MetricsTracker;

  beforeEach(() => {
    jest.clearAllMocks();
    tracker = new MetricsTracker({ autoPersist: false });
  });

  afterEach(() => {
    tracker.stopAutoPersist();
  });

  describe('recordRequest', () => {
    it('should record successful request', () => {
      const result: RequestResult = {
        success: true,
        blocked: false,
        challenged: false,
        responseTime: 150,
        statusCode: 200,
      };

      tracker.recordRequest('example.com', 'proxy1', result);

      const stats = tracker.getBufferStats();
      expect(stats.sites).toBe(1);
      expect(stats.proxies).toBe(1);
    });

    it('should record blocked request', () => {
      const result: RequestResult = {
        success: false,
        blocked: true,
        challenged: false,
        responseTime: 100,
        statusCode: 403,
      };

      tracker.recordRequest('example.com', 'proxy1', result);

      const stats = tracker.getBufferStats();
      expect(stats.sites).toBe(1);
    });

    it('should record challenged request', () => {
      const result: RequestResult = {
        success: true,
        blocked: false,
        challenged: true,
        responseTime: 5000,
        statusCode: 200,
      };

      tracker.recordRequest('example.com', 'proxy1', result);

      const stats = tracker.getBufferStats();
      expect(stats.sites).toBe(1);
    });

    it('should accumulate multiple requests', () => {
      const results: RequestResult[] = [
        { success: true, blocked: false, challenged: false, responseTime: 100, statusCode: 200 },
        { success: false, blocked: true, challenged: false, responseTime: 150, statusCode: 403 },
        { success: true, blocked: false, challenged: true, responseTime: 200, statusCode: 200 },
      ];

      for (const result of results) {
        tracker.recordRequest('example.com', 'proxy1', result);
      }

      const stats = tracker.getBufferStats();
      expect(stats.sites).toBe(1);
      expect(stats.proxies).toBe(1);
    });

    it('should track multiple sites and proxies', () => {
      tracker.recordRequest('site1.com', 'proxy1', {
        success: true,
        blocked: false,
        challenged: false,
        responseTime: 100,
        statusCode: 200,
      });

      tracker.recordRequest('site2.com', 'proxy2', {
        success: true,
        blocked: false,
        challenged: false,
        responseTime: 150,
        statusCode: 200,
      });

      const stats = tracker.getBufferStats();
      expect(stats.sites).toBe(2);
      expect(stats.proxies).toBe(2);
    });
  });

  describe('getSiteMetrics', () => {
    beforeEach(() => {
      (prisma.scrapingMetrics.findMany as jest.Mock).mockResolvedValue([]);
    });

    it('should calculate metrics from buffer', async () => {
      // Record 7 successes and 3 blocks
      for (let i = 0; i < 7; i++) {
        tracker.recordRequest('example.com', 'proxy1', {
          success: true,
          blocked: false,
          challenged: false,
          responseTime: 100,
          statusCode: 200,
        });
      }

      for (let i = 0; i < 3; i++) {
        tracker.recordRequest('example.com', 'proxy1', {
          success: false,
          blocked: true,
          challenged: false,
          responseTime: 150,
          statusCode: 403,
        });
      }

      const metrics = await tracker.getSiteMetrics('example.com', '24h');

      expect(metrics.totalRequests).toBe(10);
      expect(metrics.successfulRequests).toBe(7);
      expect(metrics.blockedRequests).toBe(3);
      expect(metrics.successRate).toBeCloseTo(0.7, 2);
      expect(metrics.blockRate).toBeCloseTo(0.3, 2);
    });

    it('should calculate average response time correctly', async () => {
      tracker.recordRequest('example.com', 'proxy1', {
        success: true,
        blocked: false,
        challenged: false,
        responseTime: 100,
        statusCode: 200,
      });

      tracker.recordRequest('example.com', 'proxy1', {
        success: true,
        blocked: false,
        challenged: false,
        responseTime: 200,
        statusCode: 200,
      });

      const metrics = await tracker.getSiteMetrics('example.com', '24h');

      expect(metrics.avgResponseTime).toBeCloseTo(150, 0);
    });

    it('should return zero metrics for unknown site', async () => {
      const metrics = await tracker.getSiteMetrics('unknown.com', '24h');

      expect(metrics.totalRequests).toBe(0);
      expect(metrics.successRate).toBe(0);
      expect(metrics.blockRate).toBe(0);
    });

    it('should combine database and buffer metrics', async () => {
      // Mock database metrics
      (prisma.scrapingMetrics.findMany as jest.Mock).mockResolvedValue([
        {
          site: 'example.com',
          timestamp: new Date(),
          totalRequests: 5,
          successfulRequests: 4,
          blockedRequests: 1,
          challengedRequests: 0,
          successRate: 0.8,
          blockRate: 0.2,
          avgResponseTime: 120,
        },
      ]);

      // Add buffer metrics
      tracker.recordRequest('example.com', 'proxy1', {
        success: true,
        blocked: false,
        challenged: false,
        responseTime: 100,
        statusCode: 200,
      });

      const metrics = await tracker.getSiteMetrics('example.com', '24h');

      expect(metrics.totalRequests).toBe(6); // 5 from DB + 1 from buffer
      expect(metrics.successfulRequests).toBe(5); // 4 from DB + 1 from buffer
    });
  });

  describe('getProxyMetrics', () => {
    beforeEach(() => {
      (prisma.proxyMetrics.findMany as jest.Mock).mockResolvedValue([]);
    });

    it('should calculate proxy metrics from buffer', async () => {
      // Record 8 successes and 2 failures
      for (let i = 0; i < 8; i++) {
        tracker.recordRequest('example.com', 'proxy1', {
          success: true,
          blocked: false,
          challenged: false,
          responseTime: 100,
          statusCode: 200,
        });
      }

      for (let i = 0; i < 2; i++) {
        tracker.recordRequest('example.com', 'proxy1', {
          success: false,
          blocked: true,
          challenged: false,
          responseTime: 150,
          statusCode: 403,
        });
      }

      const metrics = await tracker.getProxyMetrics('proxy1', '24h');

      expect(metrics.totalRequests).toBe(10);
      expect(metrics.successfulRequests).toBe(8);
      expect(metrics.failedRequests).toBe(2);
      expect(metrics.successRate).toBeCloseTo(0.8, 2);
    });

    it('should return zero metrics for unknown proxy', async () => {
      const metrics = await tracker.getProxyMetrics('unknown-proxy', '24h');

      expect(metrics.totalRequests).toBe(0);
      expect(metrics.successRate).toBe(0);
    });
  });

  describe('persistMetrics', () => {
    it('should persist site metrics to database', async () => {
      tracker.recordRequest('example.com', 'proxy1', {
        success: true,
        blocked: false,
        challenged: false,
        responseTime: 100,
        statusCode: 200,
      });

      await tracker.persistMetrics();

      expect(prisma.scrapingMetrics.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          site: 'example.com',
          totalRequests: 1,
          successfulRequests: 1,
          blockedRequests: 0,
        }),
      });
    });

    it('should persist proxy metrics to database', async () => {
      tracker.recordRequest('example.com', 'proxy1', {
        success: true,
        blocked: false,
        challenged: false,
        responseTime: 100,
        statusCode: 200,
      });

      await tracker.persistMetrics();

      expect(prisma.proxyMetrics.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          proxy: 'proxy1',
          totalRequests: 1,
          successfulRequests: 1,
          failedRequests: 0,
        }),
      });
    });

    it('should clear buffers after persistence', async () => {
      tracker.recordRequest('example.com', 'proxy1', {
        success: true,
        blocked: false,
        challenged: false,
        responseTime: 100,
        statusCode: 200,
      });

      let stats = tracker.getBufferStats();
      expect(stats.sites).toBe(1);

      await tracker.persistMetrics();

      stats = tracker.getBufferStats();
      expect(stats.sites).toBe(0);
      expect(stats.proxies).toBe(0);
    });

    it('should not persist empty buffers', async () => {
      await tracker.persistMetrics();

      expect(prisma.scrapingMetrics.create).not.toHaveBeenCalled();
      expect(prisma.proxyMetrics.create).not.toHaveBeenCalled();
    });
  });

  describe('checkThresholds', () => {
    it('should generate alert when block rate exceeds threshold', () => {
      // Create tracker with 30% threshold
      const trackerWithThreshold = new MetricsTracker({
        blockRateThreshold: 0.3,
        autoPersist: false,
      });

      // Record 6 successes and 4 blocks (40% block rate)
      for (let i = 0; i < 6; i++) {
        trackerWithThreshold.recordRequest('example.com', 'proxy1', {
          success: true,
          blocked: false,
          challenged: false,
          responseTime: 100,
          statusCode: 200,
        });
      }

      for (let i = 0; i < 4; i++) {
        trackerWithThreshold.recordRequest('example.com', 'proxy1', {
          success: false,
          blocked: true,
          challenged: false,
          responseTime: 150,
          statusCode: 403,
        });
      }

      const alerts = trackerWithThreshold.checkThresholds();

      expect(alerts.length).toBeGreaterThan(0);
      expect(alerts[0].site).toBe('example.com');
      expect(alerts[0].blockRate).toBeCloseTo(0.4, 2);
      expect(alerts[0].threshold).toBe(0.3);

      trackerWithThreshold.stopAutoPersist();
    });

    it('should not generate alert when block rate is below threshold', () => {
      const trackerWithThreshold = new MetricsTracker({
        blockRateThreshold: 0.5,
        autoPersist: false,
      });

      // Record 8 successes and 2 blocks (20% block rate)
      for (let i = 0; i < 8; i++) {
        trackerWithThreshold.recordRequest('example.com', 'proxy1', {
          success: true,
          blocked: false,
          challenged: false,
          responseTime: 100,
          statusCode: 200,
        });
      }

      for (let i = 0; i < 2; i++) {
        trackerWithThreshold.recordRequest('example.com', 'proxy1', {
          success: false,
          blocked: true,
          challenged: false,
          responseTime: 150,
          statusCode: 403,
        });
      }

      const alerts = trackerWithThreshold.checkThresholds();

      expect(alerts.length).toBe(0);

      trackerWithThreshold.stopAutoPersist();
    });

    it('should not generate alerts for sites with no requests', () => {
      const alerts = tracker.checkThresholds();

      expect(alerts.length).toBe(0);
    });
  });

  describe('edge cases', () => {
    it('should handle zero requests gracefully', async () => {
      (prisma.scrapingMetrics.findMany as jest.Mock).mockResolvedValue([]);
      
      const metrics = await tracker.getSiteMetrics('example.com', '24h');

      expect(metrics.totalRequests).toBe(0);
      expect(metrics.successRate).toBe(0);
      expect(metrics.blockRate).toBe(0);
      expect(metrics.avgResponseTime).toBe(0);
    });

    it('should handle division by zero in rate calculations', async () => {
      (prisma.scrapingMetrics.findMany as jest.Mock).mockResolvedValue([]);

      const metrics = await tracker.getSiteMetrics('example.com', '24h');

      expect(metrics.successRate).toBe(0);
      expect(metrics.blockRate).toBe(0);
      expect(isNaN(metrics.successRate)).toBe(false);
      expect(isNaN(metrics.blockRate)).toBe(false);
    });

    it('should handle auto-persist option', () => {
      const autoTracker = new MetricsTracker({
        autoPersist: true,
        persistInterval: 100,
      });

      expect(() => autoTracker.stopAutoPersist()).not.toThrow();
    });
  });
});
