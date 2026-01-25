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
   * Classify proxy type based on URL or IP address
   */
  private classifyProxy(proxy: ProxyConfig): 'residential' | 'datacenter' | 'unknown' {
    if (proxy.type !== 'unknown') {
      return proxy.type;
    }

    // Simple heuristic: check if URL contains common residential proxy indicators
    const url = proxy.url.toLowerCase();
    if (url.includes('residential') || url.includes('resi')) {
      return 'residential';
    }
    if (url.includes('datacenter') || url.includes('dc')) {
      return 'datacenter';
    }

    return 'unknown';
  }

  /**
   * Get a healthy proxy for use
   * Prioritizes healthy proxies with better performance metrics
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
   * Record a successful request for a proxy
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
   * Record a failed request for a proxy
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
   * Check health of a specific proxy
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
   * Get statistics for all proxies
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
   * Get health information for a specific proxy
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
   * Stop periodic health checks
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
