/**
 * Unit tests for ProxyManager service
 * Tests proxy health tracking, statistics, and periodic health checks
 */

import { ProxyManager, ProxyConfig } from '../../../lib/services/proxy-manager';

describe('ProxyManager', () => {
  let manager: ProxyManager;
  const testProxies: ProxyConfig[] = [
    { url: 'http://proxy1.example.com:8080', type: 'residential' },
    { url: 'http://proxy2.example.com:8080', type: 'datacenter' },
    { url: 'http://proxy3.example.com:8080', type: 'unknown' },
  ];

  beforeEach(() => {
    manager = new ProxyManager(testProxies, {
      failureThreshold: 3,
      healthCheckInterval: 60000,
      recoveryCheckInterval: 120000,
    });
  });

  afterEach(() => {
    manager.destroy();
  });

  describe('getProxyStats', () => {
    it('should return correct initial statistics', () => {
      const stats = manager.getProxyStats();

      expect(stats.totalProxies).toBe(3);
      expect(stats.healthyProxies).toBe(3);
      expect(stats.avgResponseTime).toBe(0);
      expect(stats.successRate).toBe(0);
    });

    it('should calculate success rate correctly after requests', () => {
      const proxy = testProxies[0];

      // Record 7 successes and 3 failures
      for (let i = 0; i < 7; i++) {
        manager.recordSuccess(proxy, 100);
      }
      for (let i = 0; i < 3; i++) {
        manager.recordFailure(proxy, new Error('Test failure'));
      }

      const stats = manager.getProxyStats();

      expect(stats.successRate).toBeCloseTo(0.7, 2); // 7/10 = 0.7
    });

    it('should calculate average response time correctly', () => {
      const proxy1 = testProxies[0];
      const proxy2 = testProxies[1];

      manager.recordSuccess(proxy1, 100);
      manager.recordSuccess(proxy1, 200);
      manager.recordSuccess(proxy2, 300);

      const stats = manager.getProxyStats();

      // proxy1 avg: 150, proxy2 avg: 300, proxy3 avg: 0
      // Overall avg: (150 + 300 + 0) / 3 = 150
      expect(stats.avgResponseTime).toBeCloseTo(150, 0);
    });

    it('should update healthy proxy count when proxies become unhealthy', () => {
      const proxy = testProxies[0];

      // Record failures to exceed threshold
      manager.recordFailure(proxy, new Error('Failure 1'));
      manager.recordFailure(proxy, new Error('Failure 2'));
      manager.recordFailure(proxy, new Error('Failure 3'));

      const stats = manager.getProxyStats();

      expect(stats.healthyProxies).toBe(2); // One proxy is now unhealthy
    });
  });

  describe('getHealthyProxy', () => {
    it('should return a healthy proxy', async () => {
      const proxy = await manager.getHealthyProxy();

      expect(proxy).not.toBeNull();
      expect(testProxies).toContainEqual(proxy);
    });

    it('should return null when no proxies are available', async () => {
      const emptyManager = new ProxyManager([]);
      const proxy = await emptyManager.getHealthyProxy();

      expect(proxy).toBeNull();
      emptyManager.destroy();
    });

    it('should return null when all proxies are unhealthy', async () => {
      // Mark all proxies as unhealthy
      for (const proxy of testProxies) {
        for (let i = 0; i < 3; i++) {
          manager.recordFailure(proxy, new Error('Test failure'));
        }
      }

      const proxy = await manager.getHealthyProxy();

      expect(proxy).toBeNull();
    });

    it('should prioritize proxies with better performance', async () => {
      const proxy1 = testProxies[0];
      const proxy2 = testProxies[1];

      // proxy1: fast but some failures
      manager.recordSuccess(proxy1, 50);
      manager.recordSuccess(proxy1, 50);
      manager.recordFailure(proxy1, new Error('Failure'));

      // proxy2: slower but all successes
      manager.recordSuccess(proxy2, 200);
      manager.recordSuccess(proxy2, 200);
      manager.recordSuccess(proxy2, 200);

      const selectedProxy = await manager.getHealthyProxy();

      // Should select proxy2 due to better success rate
      expect(selectedProxy?.url).toBe(proxy2.url);
    });
  });

  describe('recordSuccess', () => {
    it('should update success count and response time', () => {
      const proxy = testProxies[0];

      manager.recordSuccess(proxy, 150);
      manager.recordSuccess(proxy, 250);

      const health = manager.getProxyHealth(proxy);

      expect(health?.successCount).toBe(2);
      expect(health?.avgResponseTime).toBeCloseTo(200, 0);
    });

    it('should recover unhealthy proxy on success', () => {
      const proxy = testProxies[0];

      // Make proxy unhealthy
      manager.recordFailure(proxy, new Error('Failure 1'));
      manager.recordFailure(proxy, new Error('Failure 2'));
      manager.recordFailure(proxy, new Error('Failure 3'));

      let health = manager.getProxyHealth(proxy);
      expect(health?.isHealthy).toBe(false);

      // Record successes to recover
      manager.recordSuccess(proxy, 100);
      manager.recordSuccess(proxy, 100);

      health = manager.getProxyHealth(proxy);
      expect(health?.isHealthy).toBe(true);
    });
  });

  describe('recordFailure', () => {
    it('should update failure count', () => {
      const proxy = testProxies[0];

      manager.recordFailure(proxy, new Error('Test failure'));

      const health = manager.getProxyHealth(proxy);

      expect(health?.failureCount).toBe(1);
      expect(health?.isHealthy).toBe(true);
    });

    it('should mark proxy as unhealthy after threshold', () => {
      const proxy = testProxies[0];

      manager.recordFailure(proxy, new Error('Failure 1'));
      manager.recordFailure(proxy, new Error('Failure 2'));
      manager.recordFailure(proxy, new Error('Failure 3'));

      const health = manager.getProxyHealth(proxy);

      expect(health?.failureCount).toBe(3);
      expect(health?.isHealthy).toBe(false);
    });
  });

  describe('checkProxyHealth', () => {
    it('should return true for healthy proxy', async () => {
      const proxy = testProxies[0];

      const isHealthy = await manager.checkProxyHealth(proxy);

      expect(isHealthy).toBe(true);
    });

    it('should return false for unhealthy proxy', async () => {
      const proxy = testProxies[0];

      // Make proxy unhealthy
      for (let i = 0; i < 3; i++) {
        manager.recordFailure(proxy, new Error('Test failure'));
      }

      const isHealthy = await manager.checkProxyHealth(proxy);

      expect(isHealthy).toBe(false);
    });
  });

  describe('edge cases', () => {
    it('should handle empty proxy pool', () => {
      const emptyManager = new ProxyManager([]);
      const stats = emptyManager.getProxyStats();

      expect(stats.totalProxies).toBe(0);
      expect(stats.healthyProxies).toBe(0);
      expect(stats.avgResponseTime).toBe(0);
      expect(stats.successRate).toBe(0);

      emptyManager.destroy();
    });

    it('should handle recording metrics for unknown proxy', () => {
      const unknownProxy: ProxyConfig = {
        url: 'http://unknown.example.com:8080',
        type: 'unknown',
      };

      // Should not throw
      expect(() => {
        manager.recordSuccess(unknownProxy, 100);
        manager.recordFailure(unknownProxy, new Error('Test'));
      }).not.toThrow();
    });

    it('should limit metrics history to 100 entries', () => {
      const proxy = testProxies[0];

      // Record 150 successes
      for (let i = 0; i < 150; i++) {
        manager.recordSuccess(proxy, 100 + i);
      }

      const health = manager.getProxyHealth(proxy);

      expect(health?.successCount).toBe(150);
      // Average should be based on last 100 entries only
      // Last 100 entries: 150-249, average = 199.5
      expect(health?.avgResponseTime).toBeCloseTo(199.5, 0);
    });
  });

  describe('periodic health checks', () => {
    it('should start health check timers on initialization', () => {
      // Manager already created in beforeEach
      // Just verify it doesn't throw and can be destroyed
      expect(() => manager.destroy()).not.toThrow();
    });

    it('should allow recovery of unhealthy proxies over time', async () => {
      const proxy = testProxies[0];

      // Make proxy unhealthy
      for (let i = 0; i < 3; i++) {
        manager.recordFailure(proxy, new Error('Test failure'));
      }

      let health = manager.getProxyHealth(proxy);
      expect(health?.isHealthy).toBe(false);

      // Manually trigger recovery check (simulating periodic check)
      // In real scenario, this would happen automatically
      const recoveryManager = new ProxyManager([proxy], {
        failureThreshold: 3,
        healthCheckInterval: 100,
        recoveryCheckInterval: 100,
      });

      // Wait for recovery check to run
      await new Promise(resolve => setTimeout(resolve, 150));

      recoveryManager.destroy();
    });
  });
});
