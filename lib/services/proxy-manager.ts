/**
 * Proxy Manager Service
 * 
 * Manages proxy pool with health monitoring, performance tracking, and automatic rotation.
 * Provides intelligent proxy selection based on health status and performance metrics.
 */

import { logger } from '../logger';

export interface ProxyConfig {
  url: string;
  type: 'residential' | 'datacenter' | 'unknown';
  username?: string;
  password?: string;
}

export interface ProxyHealth {
  proxy: ProxyConfig;
  isHealthy: boolean;
  failureCount: number;
  successCount: number;
  avgResponseTime: number;
  lastChecked: Date;
  lastSuccess: Date;
}

export interface ProxyStats {
  totalProxies: number;
  healthyProxies: number;
  avgResponseTime: number;
  successRate: number;
}

export interface ProxyManagerOptions {
  failureThreshold?: number; // Default: 3
  healthCheckInterval?: number; // Default: 300000 (5 min)
  recoveryCheckInterval?: number; // Default: 600000 (10 min)
}

interface ProxyMetrics {
  responseTime: number;
  timestamp: Date;
}

export class ProxyManager {
  private proxies: ProxyConfig[];
  private healthMap: Map<string, ProxyHealth>;
  private metricsMap: Map<string, ProxyMetrics[]>;
  private options: Required<ProxyManagerOptions>;
  private healthCheckTimer?: NodeJS.Timeout;
  private recoveryCheckTimer?: NodeJS.Timeout;

  constructor(proxies: ProxyConfig[], options?: ProxyManagerOptions) {
    this.proxies = proxies;
    this.healthMap = new Map();
    this.metricsMap = new Map();

    // Set default options
    this.options = {
      failureThreshold: options?.failureThreshold ?? 3,
      healthCheckInterval: options?.healthCheckInterval ?? 300000, // 5 minutes
      recoveryCheckInterval: options?.recoveryCheckInterval ?? 600000, // 10 minutes
    };

    // Initialize health tracking for all proxies
    this.initializeProxies();

    // Start periodic health checks
    this.startPeriodicHealthChecks();
  }

  /**
   * Initialize health tracking for all proxies
   */
  private initializeProxies(): void {
    for (const proxy of this.proxies) {
      const proxyKey = this.getProxyKey(proxy);
      this.healthMap.set(proxyKey, {
        proxy,
        isHealthy: true,
        failureCount: 0,
        successCount: 0,
        avgResponseTime: 0,
        lastChecked: new Date(),
        lastSuccess: new Date(),
      });
      this.metricsMap.set(proxyKey, []);
    }
  }

  /**
   * Get a unique key for a proxy
   */
  private getProxyKey(proxy: ProxyConfig): string {
    return proxy.url;
  }

  /**
   * Get a healthy proxy for use.
   * Prioritizes healthy proxies with better performance metrics (higher success rate, lower response time).
   * 
   * @returns A healthy proxy configuration, or null if no healthy proxies are available
   * 
   * @example
   * ```typescript
   * const proxy = await proxyManager.getHealthyProxy();
   * if (proxy) {
   *   console.log(`Using proxy: ${proxy.url}`);
   * } else {
   *   console.warn('No healthy proxies available');
   * }
   * ```
   */
  async getHealthyProxy(): Promise<ProxyConfig | null> {
    if (this.proxies.length === 0) {
      return null;
    }

    // Get all healthy proxies
    const healthyProxies = Array.from(this.healthMap.values())
      .filter(health => health.isHealthy);

    if (healthyProxies.length === 0) {
      logger.warn('No healthy proxies available');
      return null;
    }

    // Sort by performance: lower response time and higher success rate
    healthyProxies.sort((a, b) => {
      const aSuccessRate = a.successCount / (a.successCount + a.failureCount) || 0;
      const bSuccessRate = b.successCount / (b.successCount + b.failureCount) || 0;

      // Prioritize success rate, then response time
      if (Math.abs(aSuccessRate - bSuccessRate) > 0.1) {
        return bSuccessRate - aSuccessRate;
      }
      return a.avgResponseTime - b.avgResponseTime;
    });

    // Return the best performing healthy proxy
    return healthyProxies[0].proxy;
  }

  /**
   * Record a successful request for a proxy.
   * Updates success count, response time metrics, and may restore unhealthy proxies.
   * 
   * @param proxy - The proxy configuration that was used
   * @param responseTime - Response time in milliseconds
   * 
   * @example
   * ```typescript
   * const startTime = Date.now();
   * // ... make request with proxy ...
   * const responseTime = Date.now() - startTime;
   * proxyManager.recordSuccess(proxy, responseTime);
   * ```
   */
  recordSuccess(proxy: ProxyConfig, responseTime: number): void {
    const proxyKey = this.getProxyKey(proxy);
    const health = this.healthMap.get(proxyKey);

    if (!health) {
      logger.warn(`Proxy not found in health map: ${proxyKey}`);
      return;
    }

    // Update success count
    health.successCount++;
    health.lastSuccess = new Date();

    // Update average response time
    const metrics = this.metricsMap.get(proxyKey) || [];
    metrics.push({ responseTime, timestamp: new Date() });

    // Keep only last 100 metrics
    if (metrics.length > 100) {
      metrics.shift();
    }
    this.metricsMap.set(proxyKey, metrics);

    // Calculate new average
    const totalResponseTime = metrics.reduce((sum, m) => sum + m.responseTime, 0);
    health.avgResponseTime = totalResponseTime / metrics.length;

    // Reset failure count on success
    if (health.failureCount > 0) {
      health.failureCount = Math.max(0, health.failureCount - 1);
    }

    // Mark as healthy if it was unhealthy
    if (!health.isHealthy && health.failureCount < this.options.failureThreshold) {
      health.isHealthy = true;
      logger.info(`Proxy recovered: ${proxyKey}`);
    }

    this.healthMap.set(proxyKey, health);
  }

  /**
   * Record a failed request for a proxy.
   * Updates failure count and may mark the proxy as unhealthy if threshold is exceeded.
   * 
   * @param proxy - The proxy configuration that failed
   * @param _error - The error that occurred (logged for debugging)
   * 
   * @example
   * ```typescript
   * try {
   *   // ... make request with proxy ...
   * } catch (error) {
   *   proxyManager.recordFailure(proxy, error);
   * }
   * ```
   */
  recordFailure(proxy: ProxyConfig, _error: Error): void {
    const proxyKey = this.getProxyKey(proxy);
    const health = this.healthMap.get(proxyKey);

    if (!health) {
      logger.warn(`Proxy not found in health map: ${proxyKey}`);
      return;
    }

    // Update failure count
    health.failureCount++;
    health.lastChecked = new Date();

    // Mark as unhealthy if threshold exceeded
    if (health.failureCount >= this.options.failureThreshold) {
      health.isHealthy = false;
      logger.warn(`Proxy marked unhealthy: ${proxyKey} (failures: ${health.failureCount})`);
    }

    this.healthMap.set(proxyKey, health);
  }

  /**
   * Check health of a specific proxy.
   * Updates the proxy's health status based on current failure count.
   * 
   * @param proxy - The proxy configuration to check
   * @returns True if the proxy is healthy, false otherwise
   * 
   * @example
   * ```typescript
   * const isHealthy = await proxyManager.checkProxyHealth(proxy);
   * console.log(`Proxy ${proxy.url} is ${isHealthy ? 'healthy' : 'unhealthy'}`);
   * ```
   */
  async checkProxyHealth(proxy: ProxyConfig): Promise<boolean> {
    const proxyKey = this.getProxyKey(proxy);
    const health = this.healthMap.get(proxyKey);

    if (!health) {
      return false;
    }

    // Simple health check: proxy is healthy if failure count is below threshold
    const isHealthy = health.failureCount < this.options.failureThreshold;
    health.isHealthy = isHealthy;
    health.lastChecked = new Date();
    this.healthMap.set(proxyKey, health);

    return isHealthy;
  }

  /**
   * Get statistics for all proxies in the pool.
   * Provides aggregate metrics including total proxies, healthy count, average response time, and success rate.
   * 
   * @returns Aggregate proxy statistics
   * 
   * @example
   * ```typescript
   * const stats = proxyManager.getProxyStats();
   * console.log(`${stats.healthyProxies}/${stats.totalProxies} proxies healthy`);
   * console.log(`Average response time: ${stats.avgResponseTime.toFixed(0)}ms`);
   * console.log(`Success rate: ${(stats.successRate * 100).toFixed(1)}%`);
   * ```
   */
  getProxyStats(): ProxyStats {
    const allHealth = Array.from(this.healthMap.values());

    if (allHealth.length === 0) {
      return {
        totalProxies: 0,
        healthyProxies: 0,
        avgResponseTime: 0,
        successRate: 0,
      };
    }

    const healthyProxies = allHealth.filter(h => h.isHealthy).length;

    // Calculate average response time across all proxies
    const totalResponseTime = allHealth.reduce((sum, h) => sum + h.avgResponseTime, 0);
    const avgResponseTime = totalResponseTime / allHealth.length;

    // Calculate overall success rate
    const totalSuccess = allHealth.reduce((sum, h) => sum + h.successCount, 0);
    const totalRequests = allHealth.reduce((sum, h) => sum + h.successCount + h.failureCount, 0);
    const successRate = totalRequests > 0 ? totalSuccess / totalRequests : 0;

    return {
      totalProxies: allHealth.length,
      healthyProxies,
      avgResponseTime,
      successRate,
    };
  }

  /**
   * Get health information for a specific proxy.
   * Returns detailed health metrics including failure/success counts and response times.
   * 
   * @param proxy - The proxy configuration to query
   * @returns Detailed health information, or null if proxy not found
   * 
   * @example
   * ```typescript
   * const health = proxyManager.getProxyHealth(proxy);
   * if (health) {
   *   console.log(`Failures: ${health.failureCount}, Successes: ${health.successCount}`);
   *   console.log(`Avg response time: ${health.avgResponseTime.toFixed(0)}ms`);
   * }
   * ```
   */
  getProxyHealth(proxy: ProxyConfig): ProxyHealth | null {
    const proxyKey = this.getProxyKey(proxy);
    return this.healthMap.get(proxyKey) || null;
  }

  /**
   * Start periodic health checks
   */
  private startPeriodicHealthChecks(): void {
    // Periodic health check for all proxies
    this.healthCheckTimer = setInterval(() => {
      this.performHealthChecks();
    }, this.options.healthCheckInterval);

    // Periodic recovery check for unhealthy proxies
    this.recoveryCheckTimer = setInterval(() => {
      this.performRecoveryChecks();
    }, this.options.recoveryCheckInterval);
  }

  /**
   * Perform health checks on all proxies
   */
  private async performHealthChecks(): Promise<void> {
    logger.info('Performing periodic health checks on all proxies');

    for (const proxy of this.proxies) {
      await this.checkProxyHealth(proxy);
    }

    const stats = this.getProxyStats();
    logger.info(`Proxy health check complete: ${stats.healthyProxies}/${stats.totalProxies} healthy`);
  }

  /**
   * Perform recovery checks on unhealthy proxies
   */
  private async performRecoveryChecks(): Promise<void> {
    logger.info('Performing recovery checks on unhealthy proxies');

    const unhealthyProxies = Array.from(this.healthMap.values())
      .filter(health => !health.isHealthy);

    for (const health of unhealthyProxies) {
      // Reduce failure count to give proxy a chance to recover
      if (health.failureCount > 0) {
        health.failureCount = Math.max(0, health.failureCount - 1);

        // Mark as healthy if failure count drops below threshold
        if (health.failureCount < this.options.failureThreshold) {
          health.isHealthy = true;
          const proxyKey = this.getProxyKey(health.proxy);
          logger.info(`Proxy recovered during recovery check: ${proxyKey}`);
        }

        this.healthMap.set(this.getProxyKey(health.proxy), health);
      }
    }
  }

  /**
   * Stop periodic health checks and cleanup resources.
   * Should be called when the ProxyManager is no longer needed.
   * 
   * @example
   * ```typescript
   * // When shutting down
   * proxyManager.destroy();
   * ```
   */
  destroy(): void {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
    }
    if (this.recoveryCheckTimer) {
      clearInterval(this.recoveryCheckTimer);
    }
  }
}
