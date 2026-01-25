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
  persistInterval?: number; // Default: 300000 (5 minutes)
  autoPersist?: boolean; // Default: true
}

export class MetricsTracker {
  private siteMetrics: Map<string, SiteMetricsBuffer> = new Map();
  private proxyMetrics: Map<string, ProxyMetricsBuffer> = new Map();
  private blockRateThreshold: number;
  private persistInterval: number;
  private autoPersist: boolean;
  private persistTimer?: NodeJS.Timeout;

  constructor(options: MetricsTrackerOptions = {}) {
    this.blockRateThreshold = options.blockRateThreshold ?? 0.3;
    this.persistInterval = options.persistInterval ?? 300000; // 5 minutes
    this.autoPersist = options.autoPersist ?? true;

    if (this.autoPersist) {
      this.startAutoPersist();
    }
  }

  /**
   * Record a request outcome
   * Requirements: 6.1, 6.2
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
   * Get site metrics for a specific time range
   * Requirements: 6.5
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
   * Get proxy metrics for a specific time range
   * Requirements: 6.5
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
   * Persist metrics to database
   * Requirements: 6.6
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
   * Check thresholds and generate alerts
   * Requirements: 6.7
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
   * Stop automatic persistence
   */
  stopAutoPersist(): void {
    if (this.persistTimer) {
      clearInterval(this.persistTimer);
      this.persistTimer = undefined;
    }
  }

  /**
   * Get current in-memory buffer stats (for debugging)
   */
  getBufferStats(): { sites: number; proxies: number } {
    return {
      sites: this.siteMetrics.size,
      proxies: this.proxyMetrics.size,
    };
  }
}
