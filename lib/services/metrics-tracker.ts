/**
 * Metrics Tracker Service
 * 
 * Tracks and persists scraping metrics including:
 * - Block rates and success rates per site
 * - Proxy performance metrics
 * - Request outcomes and response times
 * 
 * Requirements: 6.1, 6.2, 6.5, 6.6, 6.7
 */

import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';

export interface RequestResult {
  success: boolean;
  blocked: boolean;
  challenged: boolean;
  responseTime: number;
  statusCode: number;
}

export interface ScrapingMetrics {
  site: string;
  timestamp: Date;
  totalRequests: number;
  successfulRequests: number;
  blockedRequests: number;
  challengedRequests: number;
  successRate: number;
  blockRate: number;
  avgResponseTime: number;
}

export interface ProxyMetrics {
  proxy: string;
  timestamp: Date;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  avgResponseTime: number;
  successRate: number;
}

export interface ThresholdAlert {
  site: string;
  proxy: string;
  blockRate: number;
  threshold: number;
  message: string;
}

interface SiteMetricsBuffer {
  totalRequests: number;
  successfulRequests: number;
  blockedRequests: number;
  challengedRequests: number;
  responseTimes: number[];
  lastUpdated: Date;
}

interface ProxyMetricsBuffer {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  responseTimes: number[];
  lastUpdated: Date;
}

export interface MetricsTrackerOptions {
  blockRateThreshold?: number; // Default: 0.3 (30%)
  solveRateThreshold?: number; // Default: 0.7 (70%)
  persistInterval?: number; // Default: 300000 (5 minutes)
  autoPersist?: boolean; // Default: true
  alertsEnabled?: boolean; // Default: true
}

export class MetricsTracker {
  private siteMetrics: Map<string, SiteMetricsBuffer> = new Map();
  private proxyMetrics: Map<string, ProxyMetricsBuffer> = new Map();
  private blockRateThreshold: number;
  private solveRateThreshold: number;
  private persistInterval: number;
  private autoPersist: boolean;
  private alertsEnabled: boolean;
  private persistTimer?: NodeJS.Timeout;
  private alertedSites: Set<string> = new Set(); // Track sites we've already alerted for

  constructor(options: MetricsTrackerOptions = {}) {
    this.blockRateThreshold = options.blockRateThreshold ?? 0.3;
    this.solveRateThreshold = options.solveRateThreshold ?? 0.7;
    this.persistInterval = options.persistInterval ?? 300000; // 5 minutes
    this.autoPersist = options.autoPersist ?? true;
    this.alertsEnabled = options.alertsEnabled ?? true;

    if (this.autoPersist) {
      this.startAutoPersist();
    }
  }

  /**
   * Record a request outcome for metrics tracking.
   * Updates both site and proxy metrics buffers.
   * 
   * @param site - Domain or site identifier
   * @param proxy - Proxy identifier (URL or name)
   * @param result - Request outcome details
   * 
   * @example
   * ```typescript
   * tracker.recordRequest('example.com', 'proxy1', {
   *   success: true,
   *   blocked: false,
   *   challenged: false,
   *   responseTime: 250,
   *   statusCode: 200
   * });
   * ```
   */
  recordRequest(site: string, proxy: string, result: RequestResult): void {
    // Update site metrics
    let siteBuffer = this.siteMetrics.get(site);
    if (!siteBuffer) {
      siteBuffer = {
        totalRequests: 0,
        successfulRequests: 0,
        blockedRequests: 0,
        challengedRequests: 0,
        responseTimes: [],
        lastUpdated: new Date(),
      };
      this.siteMetrics.set(site, siteBuffer);
    }

    siteBuffer.totalRequests++;
    if (result.success) {
      siteBuffer.successfulRequests++;
    }
    if (result.blocked) {
      siteBuffer.blockedRequests++;
    }
    if (result.challenged) {
      siteBuffer.challengedRequests++;
    }
    siteBuffer.responseTimes.push(result.responseTime);
    siteBuffer.lastUpdated = new Date();

    // Update proxy metrics
    let proxyBuffer = this.proxyMetrics.get(proxy);
    if (!proxyBuffer) {
      proxyBuffer = {
        totalRequests: 0,
        successfulRequests: 0,
        failedRequests: 0,
        responseTimes: [],
        lastUpdated: new Date(),
      };
      this.proxyMetrics.set(proxy, proxyBuffer);
    }

    proxyBuffer.totalRequests++;
    if (result.success) {
      proxyBuffer.successfulRequests++;
    } else {
      proxyBuffer.failedRequests++;
    }
    proxyBuffer.responseTimes.push(result.responseTime);
    proxyBuffer.lastUpdated = new Date();
  }

  /**
   * Get site metrics for a specific time range.
   * Aggregates metrics from database and in-memory buffer.
   * 
   * @param site - Domain or site identifier
   * @param timeRange - Time range for metrics ('24h' or '7d')
   * @returns Aggregated scraping metrics for the site
   * 
   * @example
   * ```typescript
   * const metrics = await tracker.getSiteMetrics('example.com', '24h');
   * console.log(`Success rate: ${(metrics.successRate * 100).toFixed(1)}%`);
   * console.log(`Block rate: ${(metrics.blockRate * 100).toFixed(1)}%`);
   * console.log(`Avg response time: ${metrics.avgResponseTime.toFixed(0)}ms`);
   * ```
   */
  async getSiteMetrics(site: string, timeRange: '24h' | '7d'): Promise<ScrapingMetrics> {
    const now = new Date();
    const startTime = new Date(now);

    if (timeRange === '24h') {
      startTime.setHours(now.getHours() - 24);
    } else {
      startTime.setDate(now.getDate() - 7);
    }

    // Get metrics from database
    const dbMetrics = await prisma.scrapingMetrics.findMany({
      where: {
        site,
        timestamp: {
          gte: startTime,
        },
      },
      orderBy: {
        timestamp: 'desc',
      },
    });

    // Include in-memory buffer for current period
    const buffer = this.siteMetrics.get(site);

    // Aggregate all metrics
    let totalRequests = 0;
    let successfulRequests = 0;
    let blockedRequests = 0;
    let challengedRequests = 0;
    let totalResponseTime = 0;
    let responseCount = 0;

    for (const metric of dbMetrics) {
      totalRequests += metric.totalRequests;
      successfulRequests += metric.successfulRequests;
      blockedRequests += metric.blockedRequests;
      challengedRequests += metric.challengedRequests;
      totalResponseTime += metric.avgResponseTime * metric.totalRequests;
      responseCount += metric.totalRequests;
    }

    // Add buffer data
    if (buffer) {
      totalRequests += buffer.totalRequests;
      successfulRequests += buffer.successfulRequests;
      blockedRequests += buffer.blockedRequests;
      challengedRequests += buffer.challengedRequests;

      if (buffer.responseTimes.length > 0) {
        const bufferTotal = buffer.responseTimes.reduce((sum, time) => sum + time, 0);
        totalResponseTime += bufferTotal;
        responseCount += buffer.responseTimes.length;
      }
    }

    // Calculate rates
    const successRate = totalRequests > 0 ? successfulRequests / totalRequests : 0;
    const blockRate = totalRequests > 0 ? blockedRequests / totalRequests : 0;
    const avgResponseTime = responseCount > 0 ? totalResponseTime / responseCount : 0;

    return {
      site,
      timestamp: now,
      totalRequests,
      successfulRequests,
      blockedRequests,
      challengedRequests,
      successRate,
      blockRate,
      avgResponseTime,
    };
  }

  /**
   * Get proxy metrics for a specific time range.
   * Aggregates metrics from database and in-memory buffer.
   * 
   * @param proxy - Proxy identifier (URL or name)
   * @param timeRange - Time range for metrics ('24h' or '7d')
   * @returns Aggregated proxy performance metrics
   * 
   * @example
   * ```typescript
   * const metrics = await tracker.getProxyMetrics('proxy1', '24h');
   * console.log(`Success rate: ${(metrics.successRate * 100).toFixed(1)}%`);
   * console.log(`Avg response time: ${metrics.avgResponseTime.toFixed(0)}ms`);
   * ```
   */
  async getProxyMetrics(proxy: string, timeRange: '24h' | '7d'): Promise<ProxyMetrics> {
    const now = new Date();
    const startTime = new Date(now);

    if (timeRange === '24h') {
      startTime.setHours(now.getHours() - 24);
    } else {
      startTime.setDate(now.getDate() - 7);
    }

    // Get metrics from database
    const dbMetrics = await prisma.proxyMetrics.findMany({
      where: {
        proxy,
        timestamp: {
          gte: startTime,
        },
      },
      orderBy: {
        timestamp: 'desc',
      },
    });

    // Include in-memory buffer
    const buffer = this.proxyMetrics.get(proxy);

    // Aggregate all metrics
    let totalRequests = 0;
    let successfulRequests = 0;
    let failedRequests = 0;
    let totalResponseTime = 0;
    let responseCount = 0;

    for (const metric of dbMetrics) {
      totalRequests += metric.totalRequests;
      successfulRequests += metric.successfulRequests;
      failedRequests += metric.failedRequests;
      totalResponseTime += metric.avgResponseTime * metric.totalRequests;
      responseCount += metric.totalRequests;
    }

    // Add buffer data
    if (buffer) {
      totalRequests += buffer.totalRequests;
      successfulRequests += buffer.successfulRequests;
      failedRequests += buffer.failedRequests;

      if (buffer.responseTimes.length > 0) {
        const bufferTotal = buffer.responseTimes.reduce((sum, time) => sum + time, 0);
        totalResponseTime += bufferTotal;
        responseCount += buffer.responseTimes.length;
      }
    }

    // Calculate rates
    const successRate = totalRequests > 0 ? successfulRequests / totalRequests : 0;
    const avgResponseTime = responseCount > 0 ? totalResponseTime / responseCount : 0;

    return {
      proxy,
      timestamp: now,
      totalRequests,
      successfulRequests,
      failedRequests,
      avgResponseTime,
      successRate,
    };
  }

  /**
   * Persist metrics to database.
   * Flushes in-memory buffers to database and clears buffers.
   * Called automatically if autoPersist is enabled.
   * 
   * @throws Error if database persistence fails
   * 
   * @example
   * ```typescript
   * // Manual persistence
   * await tracker.persistMetrics();
   * 
   * // Or enable auto-persistence
   * const tracker = new MetricsTracker({ autoPersist: true });
   * ```
   */
  async persistMetrics(): Promise<void> {
    try {
      const now = new Date();

      // Persist site metrics
      for (const [site, buffer] of this.siteMetrics.entries()) {
        if (buffer.totalRequests === 0) continue;

        const successRate = buffer.successfulRequests / buffer.totalRequests;
        const blockRate = buffer.blockedRequests / buffer.totalRequests;
        const avgResponseTime = buffer.responseTimes.length > 0
          ? buffer.responseTimes.reduce((sum, time) => sum + time, 0) / buffer.responseTimes.length
          : 0;

        await prisma.scrapingMetrics.create({
          data: {
            site,
            timestamp: now,
            totalRequests: buffer.totalRequests,
            successfulRequests: buffer.successfulRequests,
            blockedRequests: buffer.blockedRequests,
            challengedRequests: buffer.challengedRequests,
            successRate,
            blockRate,
            avgResponseTime,
          },
        });
      }

      // Persist proxy metrics
      for (const [proxy, buffer] of this.proxyMetrics.entries()) {
        if (buffer.totalRequests === 0) continue;

        const successRate = buffer.successfulRequests / buffer.totalRequests;
        const avgResponseTime = buffer.responseTimes.length > 0
          ? buffer.responseTimes.reduce((sum, time) => sum + time, 0) / buffer.responseTimes.length
          : 0;

        await prisma.proxyMetrics.create({
          data: {
            proxy,
            timestamp: now,
            totalRequests: buffer.totalRequests,
            successfulRequests: buffer.successfulRequests,
            failedRequests: buffer.failedRequests,
            avgResponseTime,
            successRate,
          },
        });
      }

      // Check and create alerts after persisting metrics
      await this.checkAndCreateAlerts();

      // Clear buffers after persistence
      this.siteMetrics.clear();
      this.proxyMetrics.clear();

      logger.info('Metrics persisted successfully', {
        timestamp: now.toISOString(),
      });
    } catch (error) {
      logger.error('Failed to persist metrics', { error });
      throw error;
    }
  }

  /**
   * Check thresholds and generate alerts.
   * Returns alerts for sites where block rate exceeds the configured threshold.
   * Also logs warnings for threshold violations.
   * 
   * @returns Array of threshold alerts
   * 
   * @example
   * ```typescript
   * const alerts = tracker.checkThresholds();
   * for (const alert of alerts) {
   *   console.warn(alert.message);
   *   // Send notification, trigger fallback, etc.
   * }
   * ```
   */
  checkThresholds(): ThresholdAlert[] {
    const alerts: ThresholdAlert[] = [];

    for (const [site, buffer] of this.siteMetrics.entries()) {
      if (buffer.totalRequests === 0) continue;

      const blockRate = buffer.blockedRequests / buffer.totalRequests;

      if (blockRate > this.blockRateThreshold) {
        // Find which proxies contributed to this site's blocks
        const proxiesUsed = Array.from(this.proxyMetrics.keys());

        for (const proxy of proxiesUsed) {
          const alert: ThresholdAlert = {
            site,
            proxy,
            blockRate,
            threshold: this.blockRateThreshold,
            message: `Block rate for ${site} exceeds threshold: ${(blockRate * 100).toFixed(1)}% (threshold: ${(this.blockRateThreshold * 100).toFixed(1)}%)`,
          };
          alerts.push(alert);

          logger.warn('Block rate threshold exceeded', {
            site,
            proxy,
            blockRate: (blockRate * 100).toFixed(1) + '%',
            threshold: (this.blockRateThreshold * 100).toFixed(1) + '%',
            totalRequests: buffer.totalRequests,
            blockedRequests: buffer.blockedRequests,
          });
        }
      }
    }

    return alerts;
  }

  /**
   * Start automatic persistence
   */
  private startAutoPersist(): void {
    this.persistTimer = setInterval(() => {
      this.persistMetrics().catch((error) => {
        logger.error('Auto-persist failed', { error });
      });
    }, this.persistInterval);
  }

  /**
   * Stop automatic persistence.
   * Should be called when the MetricsTracker is no longer needed.
   * 
   * @example
   * ```typescript
   * // When shutting down
   * tracker.stopAutoPersist();
   * await tracker.persistMetrics(); // Final flush
   * ```
   */
  stopAutoPersist(): void {
    if (this.persistTimer) {
      clearInterval(this.persistTimer);
      this.persistTimer = undefined;
    }
  }

  /**
   * Get current in-memory buffer stats (for debugging).
   * Returns the number of sites and proxies with buffered metrics.
   * 
   * @returns Buffer statistics
   * 
   * @example
   * ```typescript
   * const stats = tracker.getBufferStats();
   * console.log(`Buffering metrics for ${stats.sites} sites and ${stats.proxies} proxies`);
   * ```
   */
  getBufferStats(): { sites: number; proxies: number } {
    return {
      sites: this.siteMetrics.size,
      proxies: this.proxyMetrics.size,
    };
  }

  /**
   * Create an alert when block rate exceeds threshold.
   * Persists alert to database for admin visibility.
   * 
   * @param site - Site domain where high block rate was detected
   * @param blockRate - Current block rate (0-1)
   * @param totalRequests - Total requests made to the site
   * @param blockedRequests - Number of blocked requests
   * 
   * Requirements: 12.1, 12.7
   */
  private async createBlockRateAlert(
    site: string,
    blockRate: number,
    totalRequests: number,
    blockedRequests: number
  ): Promise<void> {
    try {
      // Check if we've already alerted for this site recently
      if (this.alertedSites.has(`block_rate_${site}`)) {
        return;
      }

      await prisma.alert.create({
        data: {
          severity: 'critical',
          type: 'high_block_rate',
          message: `High block rate detected for ${site}: ${(blockRate * 100).toFixed(1)}% (${blockedRequests}/${totalRequests} requests blocked)`,
          site,
          acknowledged: false,
        },
      });

      // Mark as alerted to avoid duplicate alerts
      this.alertedSites.add(`block_rate_${site}`);

      logger.warn('Block rate alert created', {
        site,
        blockRate: (blockRate * 100).toFixed(1) + '%',
        totalRequests,
        blockedRequests,
      });
    } catch (error) {
      logger.error('Failed to create block rate alert', { error, site });
    }
  }

  /**
   * Create an alert when all proxies are unhealthy.
   * Persists critical alert to database.
   * 
   * @param totalProxies - Total number of proxies in the pool
   * 
   * Requirements: 12.2, 12.7
   */
  async createAllProxiesUnhealthyAlert(totalProxies: number): Promise<void> {
    if (!this.alertsEnabled) return;

    try {
      // Check if we've already alerted for this condition
      if (this.alertedSites.has('all_proxies_unhealthy')) {
        return;
      }

      await prisma.alert.create({
        data: {
          severity: 'critical',
          type: 'proxy_failure',
          message: `All proxies are unhealthy (${totalProxies} proxies). Scraping operations may fail.`,
          acknowledged: false,
        },
      });

      // Mark as alerted
      this.alertedSites.add('all_proxies_unhealthy');

      logger.error('All proxies unhealthy alert created', {
        totalProxies,
      });
    } catch (error) {
      logger.error('Failed to create all proxies unhealthy alert', { error });
    }
  }

  /**
   * Create an alert when challenge solve rate drops below threshold.
   * Persists warning alert to database.
   * 
   * @param site - Site domain where low solve rate was detected
   * @param solveRate - Current solve rate (0-1)
   * @param totalChallenges - Total challenges encountered
   * @param solvedChallenges - Number of successfully solved challenges
   * 
   * Requirements: 12.3, 12.7
   */
  async createLowSolveRateAlert(
    site: string,
    solveRate: number,
    totalChallenges: number,
    solvedChallenges: number
  ): Promise<void> {
    if (!this.alertsEnabled) return;

    try {
      // Check if we've already alerted for this site recently
      if (this.alertedSites.has(`solve_rate_${site}`)) {
        return;
      }

      await prisma.alert.create({
        data: {
          severity: 'warning',
          type: 'low_solve_rate',
          message: `Low challenge solve rate for ${site}: ${(solveRate * 100).toFixed(1)}% (${solvedChallenges}/${totalChallenges} challenges solved)`,
          site,
          acknowledged: false,
        },
      });

      // Mark as alerted
      this.alertedSites.add(`solve_rate_${site}`);

      logger.warn('Low solve rate alert created', {
        site,
        solveRate: (solveRate * 100).toFixed(1) + '%',
        totalChallenges,
        solvedChallenges,
      });
    } catch (error) {
      logger.error('Failed to create low solve rate alert', { error, site });
    }
  }

  /**
   * Check metrics and create alerts if thresholds are exceeded.
   * Should be called periodically or after metrics updates.
   * 
   * @param proxyStats - Optional proxy statistics to check for all proxies unhealthy
   * 
   * Requirements: 12.1, 12.2, 12.3
   */
  async checkAndCreateAlerts(proxyStats?: { totalProxies: number; healthyProxies: number }): Promise<void> {
    if (!this.alertsEnabled) return;

    try {
      // Check block rates for all sites
      for (const [site, buffer] of this.siteMetrics.entries()) {
        if (buffer.totalRequests === 0) continue;

        const blockRate = buffer.blockedRequests / buffer.totalRequests;

        // Create alert if block rate exceeds threshold
        if (blockRate > this.blockRateThreshold) {
          await this.createBlockRateAlert(
            site,
            blockRate,
            buffer.totalRequests,
            buffer.blockedRequests
          );
        }
      }

      // Check if all proxies are unhealthy
      if (proxyStats && proxyStats.totalProxies > 0 && proxyStats.healthyProxies === 0) {
        await this.createAllProxiesUnhealthyAlert(proxyStats.totalProxies);
      }

      // Check challenge solve rates
      const now = new Date();
      const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

      // Get recent challenge attempts grouped by site
      const challengeStats = await prisma.challengeAttempt.groupBy({
        by: ['site'],
        where: {
          timestamp: {
            gte: oneDayAgo,
          },
        },
        _count: {
          _all: true,
        },
      });

      // Check solve rate for each site
      for (const stat of challengeStats) {
        const totalChallenges = stat._count._all;

        // Count solved challenges separately
        const solvedCount = await prisma.challengeAttempt.count({
          where: {
            site: stat.site,
            timestamp: {
              gte: oneDayAgo,
            },
            solved: true,
          },
        });
        const solvedChallenges = solvedCount;
        const solveRate = totalChallenges > 0 ? solvedChallenges / totalChallenges : 1;

        // Create alert if solve rate is below threshold
        if (solveRate < this.solveRateThreshold && totalChallenges >= 5) {
          await this.createLowSolveRateAlert(
            stat.site,
            solveRate,
            totalChallenges,
            solvedChallenges
          );
        }
      }
    } catch (error) {
      logger.error('Failed to check and create alerts', { error });
    }
  }

  /**
   * Clear alert tracking for a specific site or condition.
   * Allows alerts to be created again for the same condition.
   * 
   * @param key - Alert key to clear (e.g., 'block_rate_example.com', 'all_proxies_unhealthy')
   */
  clearAlertTracking(key: string): void {
    this.alertedSites.delete(key);
  }

  /**
   * Clear all alert tracking.
   * Allows all alerts to be created again.
   */
  clearAllAlertTracking(): void {
    this.alertedSites.clear();
  }
}
