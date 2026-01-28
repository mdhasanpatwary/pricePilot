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
    proxyHealth: {
      findUnique: jest.fn(),
    },
    challengeAttempt: {
      findMany: jest.fn(),
      groupBy: jest.fn(),
      count: jest.fn(),
    },
    alert: {
      create: jest.fn(),
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

  describe('getSiteAnalytics', () => {
    beforeEach(() => {
      (prisma.scrapingMetrics.findMany as jest.Mock).mockResolvedValue([]);
    });

    it('should return comprehensive site analytics with 1h time range', async () => {
      const mockMetrics = [
        {
          site: 'example.com',
          timestamp: new Date('2024-01-01T10:00:00Z'),
          totalRequests: 10,
          successfulRequests: 7,
          blockedRequests: 2,
          challengedRequests: 1,
          successRate: 0.7,
          blockRate: 0.2,
          avgResponseTime: 150,
        },
      ];
      (prisma.scrapingMetrics.findMany as jest.Mock).mockResolvedValue(mockMetrics);

      const analytics = await tracker.getSiteAnalytics('example.com', '1h');

      expect(analytics.site).toBe('example.com');
      expect(analytics.timeRange).toBe('1h');
      expect(analytics.totalRequests).toBe(10);
      expect(analytics.successRate).toBeCloseTo(0.7, 2);
      expect(analytics.blockRate).toBeCloseTo(0.2, 2);
      expect(analytics.challengeRate).toBeCloseTo(0.1, 2);
      expect(analytics.requestsByHour).toBeDefined();
      expect(analytics.topFailureReasons).toBeDefined();
    });

    it('should group requests by hour for trending', async () => {
      const mockMetrics = [
        {
          site: 'example.com',
          timestamp: new Date('2024-01-01T10:00:00Z'),
          totalRequests: 5,
          successfulRequests: 4,
          blockedRequests: 1,
          challengedRequests: 0,
          successRate: 0.8,
          blockRate: 0.2,
          avgResponseTime: 150,
        },
        {
          site: 'example.com',
          timestamp: new Date('2024-01-01T11:00:00Z'),
          totalRequests: 8,
          successfulRequests: 6,
          blockedRequests: 2,
          challengedRequests: 0,
          successRate: 0.75,
          blockRate: 0.25,
          avgResponseTime: 160,
        },
      ];
      (prisma.scrapingMetrics.findMany as jest.Mock).mockResolvedValue(mockMetrics);

      const analytics = await tracker.getSiteAnalytics('example.com', '24h');

      expect(analytics.requestsByHour.length).toBeGreaterThan(0);
      expect(analytics.requestsByHour[0]).toHaveProperty('hour');
      expect(analytics.requestsByHour[0]).toHaveProperty('count');
    });

    it('should identify top failure reasons', async () => {
      const mockMetrics = [
        {
          site: 'example.com',
          timestamp: new Date(),
          totalRequests: 10,
          successfulRequests: 5,
          blockedRequests: 3,
          challengedRequests: 2,
          successRate: 0.5,
          blockRate: 0.3,
          avgResponseTime: 150,
        },
      ];
      (prisma.scrapingMetrics.findMany as jest.Mock).mockResolvedValue(mockMetrics);

      const analytics = await tracker.getSiteAnalytics('example.com', '24h');

      expect(analytics.topFailureReasons.length).toBeGreaterThan(0);
      expect(analytics.topFailureReasons[0]).toHaveProperty('reason');
      expect(analytics.topFailureReasons[0]).toHaveProperty('count');
      // Should be sorted by count descending
      if (analytics.topFailureReasons.length > 1) {
        expect(analytics.topFailureReasons[0].count).toBeGreaterThanOrEqual(
          analytics.topFailureReasons[1].count
        );
      }
    });
  });

  describe('getProxyAnalytics', () => {
    beforeEach(() => {
      (prisma.proxyMetrics.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.proxyHealth.findUnique as jest.Mock).mockResolvedValue({
        proxyUrl: 'proxy1',
        proxyType: 'residential',
        isHealthy: true,
      });
      (prisma.scrapingMetrics.findMany as jest.Mock).mockResolvedValue([]);
    });

    it('should return comprehensive proxy analytics', async () => {
      const mockMetrics = [
        {
          proxy: 'proxy1',
          timestamp: new Date(),
          totalRequests: 20,
          successfulRequests: 16,
          failedRequests: 4,
          avgResponseTime: 200,
          successRate: 0.8,
        },
      ];
      (prisma.proxyMetrics.findMany as jest.Mock).mockResolvedValue(mockMetrics);

      const analytics = await tracker.getProxyAnalytics('proxy1', '24h');

      expect(analytics.proxy).toBe('proxy1');
      expect(analytics.proxyType).toBe('residential');
      expect(analytics.timeRange).toBe('24h');
      expect(analytics.totalRequests).toBe(20);
      expect(analytics.successRate).toBeCloseTo(0.8, 2);
      expect(analytics.requestsBySite).toBeDefined();
    });

    it('should group requests by site', async () => {
      const mockProxyMetrics = [
        {
          proxy: 'proxy1',
          timestamp: new Date(),
          totalRequests: 20,
          successfulRequests: 16,
          failedRequests: 4,
          avgResponseTime: 200,
          successRate: 0.8,
        },
      ];
      const mockSiteMetrics = [
        {
          site: 'site1.com',
          timestamp: new Date(),
          totalRequests: 10,
          successfulRequests: 8,
          blockedRequests: 2,
          challengedRequests: 0,
          successRate: 0.8,
          blockRate: 0.2,
          avgResponseTime: 150,
        },
        {
          site: 'site2.com',
          timestamp: new Date(),
          totalRequests: 5,
          successfulRequests: 4,
          blockedRequests: 1,
          challengedRequests: 0,
          successRate: 0.8,
          blockRate: 0.2,
          avgResponseTime: 180,
        },
      ];
      (prisma.proxyMetrics.findMany as jest.Mock).mockResolvedValue(mockProxyMetrics);
      (prisma.scrapingMetrics.findMany as jest.Mock).mockResolvedValue(mockSiteMetrics);

      const analytics = await tracker.getProxyAnalytics('proxy1', '24h');

      expect(analytics.requestsBySite.length).toBe(2);
      expect(analytics.requestsBySite[0]).toHaveProperty('site');
      expect(analytics.requestsBySite[0]).toHaveProperty('count');
      expect(analytics.requestsBySite[0]).toHaveProperty('successRate');
      // Should be sorted by count descending
      expect(analytics.requestsBySite[0].count).toBeGreaterThanOrEqual(
        analytics.requestsBySite[1].count
      );
    });

    it('should default to datacenter type if proxy health not found', async () => {
      (prisma.proxyHealth.findUnique as jest.Mock).mockResolvedValue(null);

      const analytics = await tracker.getProxyAnalytics('unknown-proxy', '24h');

      expect(analytics.proxyType).toBe('datacenter');
    });
  });

  describe('getChallengeAnalytics', () => {
    beforeEach(() => {
      (prisma.challengeAttempt.findMany as jest.Mock).mockResolvedValue([]);
    });

    it('should return comprehensive challenge analytics', async () => {
      const mockChallenges = [
        {
          id: '1',
          site: 'example.com',
          challengeType: 'Cloudflare',
          solved: true,
          duration: 2000,
          timestamp: new Date(),
        },
        {
          id: '2',
          site: 'example.com',
          challengeType: 'reCAPTCHA',
          solved: true,
          duration: 3000,
          timestamp: new Date(),
        },
        {
          id: '3',
          site: 'example.com',
          challengeType: 'Cloudflare',
          solved: false,
          duration: 5000,
          timestamp: new Date(),
        },
      ];
      (prisma.challengeAttempt.findMany as jest.Mock).mockResolvedValue(mockChallenges);

      const analytics = await tracker.getChallengeAnalytics('24h');

      expect(analytics.timeRange).toBe('24h');
      expect(analytics.totalChallenges).toBe(3);
      expect(analytics.solvedChallenges).toBe(2);
      expect(analytics.failedChallenges).toBe(1);
      expect(analytics.solveRate).toBeCloseTo(0.667, 2);
      expect(analytics.avgSolveTime).toBeCloseTo(2500, 0); // Average of 2000 and 3000
    });

    it('should group challenges by type', async () => {
      const mockChallenges = [
        {
          id: '1',
          site: 'example.com',
          challengeType: 'Cloudflare',
          solved: true,
          duration: 2000,
          timestamp: new Date(),
        },
        {
          id: '2',
          site: 'example.com',
          challengeType: 'Cloudflare',
          solved: false,
          duration: 3000,
          timestamp: new Date(),
        },
        {
          id: '3',
          site: 'example.com',
          challengeType: 'reCAPTCHA',
          solved: true,
          duration: 2500,
          timestamp: new Date(),
        },
      ];
      (prisma.challengeAttempt.findMany as jest.Mock).mockResolvedValue(mockChallenges);

      const analytics = await tracker.getChallengeAnalytics('24h');

      expect(analytics.challengesByType.length).toBe(2);
      expect(analytics.challengesByType[0]).toHaveProperty('type');
      expect(analytics.challengesByType[0]).toHaveProperty('count');
      expect(analytics.challengesByType[0]).toHaveProperty('solveRate');
      // Cloudflare should have 2 challenges (1 solved, 1 failed) = 50% solve rate
      const cloudflare = analytics.challengesByType.find(c => c.type === 'Cloudflare');
      expect(cloudflare?.count).toBe(2);
      expect(cloudflare?.solveRate).toBeCloseTo(0.5, 2);
    });

    it('should group challenges by site', async () => {
      const mockChallenges = [
        {
          id: '1',
          site: 'site1.com',
          challengeType: 'Cloudflare',
          solved: true,
          duration: 2000,
          timestamp: new Date(),
        },
        {
          id: '2',
          site: 'site2.com',
          challengeType: 'reCAPTCHA',
          solved: true,
          duration: 3000,
          timestamp: new Date(),
        },
        {
          id: '3',
          site: 'site1.com',
          challengeType: 'Cloudflare',
          solved: false,
          duration: 2500,
          timestamp: new Date(),
        },
      ];
      (prisma.challengeAttempt.findMany as jest.Mock).mockResolvedValue(mockChallenges);

      const analytics = await tracker.getChallengeAnalytics('24h');

      expect(analytics.challengesBySite.length).toBe(2);
      expect(analytics.challengesBySite[0]).toHaveProperty('site');
      expect(analytics.challengesBySite[0]).toHaveProperty('count');
      expect(analytics.challengesBySite[0]).toHaveProperty('solveRate');
      // site1.com should have 2 challenges (1 solved, 1 failed) = 50% solve rate
      const site1 = analytics.challengesBySite.find(s => s.site === 'site1.com');
      expect(site1?.count).toBe(2);
      expect(site1?.solveRate).toBeCloseTo(0.5, 2);
    });

    it('should handle zero challenges', async () => {
      (prisma.challengeAttempt.findMany as jest.Mock).mockResolvedValue([]);

      const analytics = await tracker.getChallengeAnalytics('24h');

      expect(analytics.totalChallenges).toBe(0);
      expect(analytics.solveRate).toBe(0);
      expect(analytics.avgSolveTime).toBe(0);
      expect(analytics.challengesByType.length).toBe(0);
      expect(analytics.challengesBySite.length).toBe(0);
    });
  });

  describe('getTopFailingSites', () => {
    beforeEach(() => {
      (prisma.scrapingMetrics.findMany as jest.Mock).mockResolvedValue([]);
    });

    it('should return top failing sites sorted by failure rate', async () => {
      const mockMetrics = [
        {
          site: 'site1.com',
          timestamp: new Date(),
          totalRequests: 100,
          successfulRequests: 50,
          blockedRequests: 30,
          challengedRequests: 20,
          successRate: 0.5,
          blockRate: 0.3,
          avgResponseTime: 150,
        },
        {
          site: 'site2.com',
          timestamp: new Date(),
          totalRequests: 100,
          successfulRequests: 80,
          blockedRequests: 10,
          challengedRequests: 10,
          successRate: 0.8,
          blockRate: 0.1,
          avgResponseTime: 120,
        },
        {
          site: 'site3.com',
          timestamp: new Date(),
          totalRequests: 100,
          successfulRequests: 30,
          blockedRequests: 40,
          challengedRequests: 30,
          successRate: 0.3,
          blockRate: 0.4,
          avgResponseTime: 180,
        },
      ];
      (prisma.scrapingMetrics.findMany as jest.Mock).mockResolvedValue(mockMetrics);

      const topFailing = await tracker.getTopFailingSites(10, '24h');

      expect(topFailing.length).toBe(3);
      expect(topFailing[0].site).toBe('site3.com'); // Highest failure rate (70%)
      expect(topFailing[0].failureRate).toBeCloseTo(0.7, 2);
      expect(topFailing[1].site).toBe('site1.com'); // Second highest (50%)
      expect(topFailing[2].site).toBe('site2.com'); // Lowest (20%)
      // Verify sorted by failure rate descending
      expect(topFailing[0].failureRate).toBeGreaterThanOrEqual(topFailing[1].failureRate);
      expect(topFailing[1].failureRate).toBeGreaterThanOrEqual(topFailing[2].failureRate);
    });

    it('should respect the limit parameter', async () => {
      const mockMetrics = Array.from({ length: 15 }, (_, i) => ({
        site: `site${i}.com`,
        timestamp: new Date(),
        totalRequests: 100,
        successfulRequests: 50,
        blockedRequests: 30,
        challengedRequests: 20,
        successRate: 0.5,
        blockRate: 0.3,
        avgResponseTime: 150,
      }));
      (prisma.scrapingMetrics.findMany as jest.Mock).mockResolvedValue(mockMetrics);

      const topFailing = await tracker.getTopFailingSites(5, '24h');

      expect(topFailing.length).toBe(5);
    });

    it('should include buffer data', async () => {
      (prisma.scrapingMetrics.findMany as jest.Mock).mockResolvedValue([]);

      // Add some buffer data
      for (let i = 0; i < 5; i++) {
        tracker.recordRequest('buffer-site.com', 'proxy1', {
          success: false,
          blocked: true,
          challenged: false,
          responseTime: 100,
          statusCode: 403,
        });
      }

      const topFailing = await tracker.getTopFailingSites(10, '24h');

      expect(topFailing.length).toBe(1);
      expect(topFailing[0].site).toBe('buffer-site.com');
      expect(topFailing[0].failureRate).toBe(1); // 100% failure
    });
  });

  describe('getTopFailingProxies', () => {
    beforeEach(() => {
      (prisma.proxyMetrics.findMany as jest.Mock).mockResolvedValue([]);
    });

    it('should return top failing proxies sorted by failure rate', async () => {
      const mockMetrics = [
        {
          proxy: 'proxy1',
          timestamp: new Date(),
          totalRequests: 100,
          successfulRequests: 50,
          failedRequests: 50,
          avgResponseTime: 150,
          successRate: 0.5,
        },
        {
          proxy: 'proxy2',
          timestamp: new Date(),
          totalRequests: 100,
          successfulRequests: 80,
          failedRequests: 20,
          avgResponseTime: 120,
          successRate: 0.8,
        },
        {
          proxy: 'proxy3',
          timestamp: new Date(),
          totalRequests: 100,
          successfulRequests: 30,
          failedRequests: 70,
          avgResponseTime: 180,
          successRate: 0.3,
        },
      ];
      (prisma.proxyMetrics.findMany as jest.Mock).mockResolvedValue(mockMetrics);

      const topFailing = await tracker.getTopFailingProxies(10, '24h');

      expect(topFailing.length).toBe(3);
      expect(topFailing[0].proxy).toBe('proxy3'); // Highest failure rate (70%)
      expect(topFailing[0].failureRate).toBeCloseTo(0.7, 2);
      expect(topFailing[1].proxy).toBe('proxy1'); // Second highest (50%)
      expect(topFailing[2].proxy).toBe('proxy2'); // Lowest (20%)
      // Verify sorted by failure rate descending
      expect(topFailing[0].failureRate).toBeGreaterThanOrEqual(topFailing[1].failureRate);
      expect(topFailing[1].failureRate).toBeGreaterThanOrEqual(topFailing[2].failureRate);
    });

    it('should respect the limit parameter', async () => {
      const mockMetrics = Array.from({ length: 15 }, (_, i) => ({
        proxy: `proxy${i}`,
        timestamp: new Date(),
        totalRequests: 100,
        successfulRequests: 50,
        failedRequests: 50,
        avgResponseTime: 150,
        successRate: 0.5,
      }));
      (prisma.proxyMetrics.findMany as jest.Mock).mockResolvedValue(mockMetrics);

      const topFailing = await tracker.getTopFailingProxies(5, '24h');

      expect(topFailing.length).toBe(5);
    });

    it('should include buffer data', async () => {
      (prisma.proxyMetrics.findMany as jest.Mock).mockResolvedValue([]);

      // Add some buffer data
      for (let i = 0; i < 5; i++) {
        tracker.recordRequest('example.com', 'buffer-proxy', {
          success: false,
          blocked: true,
          challenged: false,
          responseTime: 100,
          statusCode: 403,
        });
      }

      const topFailing = await tracker.getTopFailingProxies(10, '24h');

      expect(topFailing.length).toBe(1);
      expect(topFailing[0].proxy).toBe('buffer-proxy');
      expect(topFailing[0].failureRate).toBe(1); // 100% failure
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

  describe('Alert Generation', () => {
    beforeEach(() => {
      (prisma.alert.create as jest.Mock).mockResolvedValue({});
      (prisma.challengeAttempt.groupBy as jest.Mock).mockResolvedValue([]);
      (prisma.challengeAttempt.count as jest.Mock).mockResolvedValue(0);
    });

    describe('createProxyFailureAlert', () => {
      it('should create alert when proxy failure rate exceeds 50%', async () => {
        await tracker.createProxyFailureAlert('proxy1', 0.6, 100, 60);

        expect(prisma.alert.create).toHaveBeenCalledWith({
          data: expect.objectContaining({
            severity: 'warning',
            type: 'proxy_failure',
            message: expect.stringContaining('proxy1'),
            proxyUrl: 'proxy1',
            acknowledged: false,
          }),
        });
      });

      it('should not create duplicate alerts for same proxy', async () => {
        await tracker.createProxyFailureAlert('proxy1', 0.6, 100, 60);
        await tracker.createProxyFailureAlert('proxy1', 0.6, 100, 60);

        expect(prisma.alert.create).toHaveBeenCalledTimes(1);
      });

      it('should respect alertsEnabled flag', async () => {
        const disabledTracker = new MetricsTracker({
          alertsEnabled: false,
          autoPersist: false,
        });

        await disabledTracker.createProxyFailureAlert('proxy1', 0.6, 100, 60);

        expect(prisma.alert.create).not.toHaveBeenCalled();

        disabledTracker.stopAutoPersist();
      });
    });

    describe('checkAndCreateAlerts', () => {
      it('should check proxy failure rates and create alerts', async () => {
        // Record 6 failures and 4 successes (60% failure rate)
        for (let i = 0; i < 6; i++) {
          tracker.recordRequest('example.com', 'proxy1', {
            success: false,
            blocked: true,
            challenged: false,
            responseTime: 100,
            statusCode: 403,
          });
        }

        for (let i = 0; i < 4; i++) {
          tracker.recordRequest('example.com', 'proxy1', {
            success: true,
            blocked: false,
            challenged: false,
            responseTime: 100,
            statusCode: 200,
          });
        }

        await tracker.checkAndCreateAlerts();

        // Should create proxy failure alert (60% > 50% threshold)
        expect(prisma.alert.create).toHaveBeenCalledWith({
          data: expect.objectContaining({
            severity: 'warning',
            type: 'proxy_failure',
            proxyUrl: 'proxy1',
          }),
        });
      });

      it('should not create proxy alert when failure rate is below threshold', async () => {
        // Record 3 failures and 7 successes (30% failure rate)
        for (let i = 0; i < 3; i++) {
          tracker.recordRequest('example.com', 'proxy1', {
            success: false,
            blocked: true,
            challenged: false,
            responseTime: 100,
            statusCode: 403,
          });
        }

        for (let i = 0; i < 7; i++) {
          tracker.recordRequest('example.com', 'proxy1', {
            success: true,
            blocked: false,
            challenged: false,
            responseTime: 100,
            statusCode: 200,
          });
        }

        await tracker.checkAndCreateAlerts();

        // Should not create proxy failure alert (30% < 50% threshold)
        const proxyFailureCalls = (prisma.alert.create as jest.Mock).mock.calls.filter(
          call => call[0].data.type === 'proxy_failure' && call[0].data.proxyUrl === 'proxy1'
        );
        expect(proxyFailureCalls.length).toBe(0);
      });

      it('should check both block rates and proxy failure rates', async () => {
        // Create high block rate for site (40%)
        for (let i = 0; i < 6; i++) {
          tracker.recordRequest('example.com', 'proxy1', {
            success: true,
            blocked: false,
            challenged: false,
            responseTime: 100,
            statusCode: 200,
          });
        }

        for (let i = 0; i < 4; i++) {
          tracker.recordRequest('example.com', 'proxy1', {
            success: false,
            blocked: true,
            challenged: false,
            responseTime: 100,
            statusCode: 403,
          });
        }

        // Create high failure rate for proxy2 (60%)
        for (let i = 0; i < 6; i++) {
          tracker.recordRequest('example.com', 'proxy2', {
            success: false,
            blocked: true,
            challenged: false,
            responseTime: 100,
            statusCode: 403,
          });
        }

        for (let i = 0; i < 4; i++) {
          tracker.recordRequest('example.com', 'proxy2', {
            success: true,
            blocked: false,
            challenged: false,
            responseTime: 100,
            statusCode: 200,
          });
        }

        await tracker.checkAndCreateAlerts();

        // Should create both block rate alert and proxy failure alert
        expect(prisma.alert.create).toHaveBeenCalledWith({
          data: expect.objectContaining({
            severity: 'critical',
            type: 'high_block_rate',
            site: 'example.com',
          }),
        });

        expect(prisma.alert.create).toHaveBeenCalledWith({
          data: expect.objectContaining({
            severity: 'warning',
            type: 'proxy_failure',
            proxyUrl: 'proxy2',
          }),
        });
      });

      it('should check all proxies unhealthy condition', async () => {
        await tracker.checkAndCreateAlerts({
          totalProxies: 5,
          healthyProxies: 0,
        });

        expect(prisma.alert.create).toHaveBeenCalledWith({
          data: expect.objectContaining({
            severity: 'critical',
            type: 'proxy_failure',
            message: expect.stringContaining('All proxies are unhealthy'),
          }),
        });
      });

      it('should respect alertsEnabled flag', async () => {
        const disabledTracker = new MetricsTracker({
          alertsEnabled: false,
          autoPersist: false,
        });

        // Record high failure rate
        for (let i = 0; i < 8; i++) {
          disabledTracker.recordRequest('example.com', 'proxy1', {
            success: false,
            blocked: true,
            challenged: false,
            responseTime: 100,
            statusCode: 403,
          });
        }

        await disabledTracker.checkAndCreateAlerts();

        expect(prisma.alert.create).not.toHaveBeenCalled();

        disabledTracker.stopAutoPersist();
      });
    });

    describe('clearAlertTracking', () => {
      it('should allow alerts to be created again after clearing', async () => {
        await tracker.createProxyFailureAlert('proxy1', 0.6, 100, 60);
        expect(prisma.alert.create).toHaveBeenCalledTimes(1);

        // Try to create again - should be blocked
        await tracker.createProxyFailureAlert('proxy1', 0.6, 100, 60);
        expect(prisma.alert.create).toHaveBeenCalledTimes(1);

        // Clear tracking
        tracker.clearAlertTracking('proxy_failure_proxy1');

        // Should be able to create again
        await tracker.createProxyFailureAlert('proxy1', 0.6, 100, 60);
        expect(prisma.alert.create).toHaveBeenCalledTimes(2);
      });

      it('should clear all alert tracking', async () => {
        await tracker.createProxyFailureAlert('proxy1', 0.6, 100, 60);
        await tracker.createAllProxiesUnhealthyAlert(5);

        expect(prisma.alert.create).toHaveBeenCalledTimes(2);

        // Clear all tracking
        tracker.clearAllAlertTracking();

        // Should be able to create both again
        await tracker.createProxyFailureAlert('proxy1', 0.6, 100, 60);
        await tracker.createAllProxiesUnhealthyAlert(5);

        expect(prisma.alert.create).toHaveBeenCalledTimes(4);
      });
    });
  });
});
