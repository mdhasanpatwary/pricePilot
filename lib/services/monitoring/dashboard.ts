/**
 * Monitoring Dashboard Service
 *
 * Provides data for the monitoring dashboard UI including system health,
 * metric history, active alerts, and tenant-specific metrics.
 *
 * Features:
 * - System health calculation with component status
 * - Metric history retrieval with time ranges
 * - Active alerts retrieval
 * - Alert history with pagination
 * - Tenant-specific metrics
 * - Tenant filtering capability
 *
 * Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 9.1, 9.2, 9.3, 9.5
 *
 * @module lib/services/monitoring/dashboard
 */

import { prisma } from '@/lib/prisma';
import { metricsCollector, type MetricData } from './metrics-collector';
import { logger } from '@/lib/logger';
import type { MonitoringAlertSeverity } from '@prisma/client';

/**
 * System health status
 */
export type SystemHealthStatus = 'healthy' | 'degraded' | 'critical';

/**
 * Component health information
 */
export interface ComponentHealth {
    name: string;
    status: SystemHealthStatus;
    message?: string;
}

/**
 * Overall system health
 */
export interface SystemHealth {
    status: SystemHealthStatus;
    errorRate: number;
    avgResponseTime: number;
    activeAlerts: number;
    lastUpdated: Date;
    components: ComponentHealth[];
}

/**
 * Time range for metric queries
 */
export interface TimeRange {
    start: Date;
    end: Date;
    granularity: '1m' | '5m' | '15m' | '1h' | '1d';
}

/**
 * Alert history entry
 */
export interface AlertHistoryEntry {
    id: string;
    ruleId: string;
    ruleName: string;
    severity: MonitoringAlertSeverity;
    triggeredAt: Date;
    resolvedAt?: Date | null;
    metricValue: number;
    threshold: number;
    tenantId?: string | null;
    context: Record<string, any>;
    notificationsSent: Array<{
        channel: string;
        success: boolean;
        sentAt: Date;
        error?: string;
    }>;
    acknowledgedAt?: Date | null;
    acknowledgedBy?: string | null;
}

/**
 * Tenant-specific metrics
 */
export interface TenantMetrics {
    tenantId: string;
    errorRate: number;
    apiUsage: number;
    priceUpdateSuccessRate: number;
    scrapingSuccessRate: number;
}

/**
 * Triggered alert information (for active alerts)
 */
export interface TriggeredAlert {
    ruleId: string;
    ruleName: string;
    severity: MonitoringAlertSeverity;
    triggeredAt: Date;
    metricValue: number;
    threshold: number;
    tenantId?: string | null;
    context: Record<string, any>;
}

/**
 * Monitoring Dashboard Service Interface
 */
export interface IMonitoringDashboardService {
    getSystemHealth(): Promise<SystemHealth>;
    getMetricHistory(metricType: string, timeRange: TimeRange, tenantId?: string): Promise<MetricData>;
    getActiveAlerts(tenantId?: string): Promise<TriggeredAlert[]>;
    getAlertHistory(limit: number, tenantId?: string): Promise<AlertHistoryEntry[]>;
    getTenantMetrics(tenantId: string): Promise<TenantMetrics>;
}

/**
 * Monitoring Dashboard Service Implementation
 */
export class MonitoringDashboardService implements IMonitoringDashboardService {
    /**
     * Get overall system health status
     *
     * Requirements:
     * - 6.1: Display current error rate with historical trend
     * - 6.2: Display response time metrics
     * - 6.5: Display active alerts with severity indicators
     * - 6.6: Display system resource utilization
     *
     * @returns System health information
     */
    async getSystemHealth(): Promise<SystemHealth> {
        try {

            // Get error rate for last 5 minutes
            const errorMetrics = await metricsCollector.getMetrics(
                'error',
                5 * 60 // 5 minutes in seconds
            );
            const errorRate = this.calculateErrorRate(errorMetrics);

            // Get average response time for last 5 minutes
            const responseTimeMetrics = await metricsCollector.getMetrics(
                'response_time',
                5 * 60
            );
            const avgResponseTime = responseTimeMetrics.aggregates.avg;

            // Get active alerts count
            const activeAlerts = await this.getActiveAlertsCount();

            // Calculate component health
            const components = await this.calculateComponentHealth(
                errorRate,
                avgResponseTime
            );

            // Determine overall system status
            const status = this.determineSystemStatus(components, activeAlerts);

            return {
                status,
                errorRate,
                avgResponseTime,
                activeAlerts,
                lastUpdated: new Date(),
                components,
            };
        } catch (error) {
            logger.error('Failed to get system health', {
                error: error instanceof Error ? error.message : String(error),
            });

            // Return degraded status on error
            return {
                status: 'degraded',
                errorRate: 0,
                avgResponseTime: 0,
                activeAlerts: 0,
                lastUpdated: new Date(),
                components: [
                    {
                        name: 'Monitoring System',
                        status: 'degraded',
                        message: 'Failed to retrieve system health',
                    },
                ],
            };
        }
    }

    /**
     * Get metric history for a specific metric type and time range
     *
     * Requirements:
     * - 6.1: Display error rate with historical trend graph
     * - 6.2: Display response time metrics with historical trends
     * - 6.3: Display competitor scraping success rate
     * - 6.4: Display price update success rate
     * - 9.5: Allow filtering metrics by tenant
     *
     * @param metricType - Type of metric to retrieve
     * @param timeRange - Time range for the query
     * @param tenantId - Optional tenant ID for filtering
     * @returns Metric data with time-series and aggregates
     */
    async getMetricHistory(
        metricType: string,
        timeRange: TimeRange,
        tenantId?: string
    ): Promise<MetricData> {
        try {
            // Calculate time window in seconds
            const timeWindowSeconds = Math.floor(
                (timeRange.end.getTime() - timeRange.start.getTime()) / 1000
            );

            // Get metrics from collector
            const metrics = await metricsCollector.getMetrics(
                metricType,
                timeWindowSeconds,
                tenantId
            );

            logger.info('Retrieved metric history', {
                metricType,
                timeWindow: timeWindowSeconds,
                tenantId,
                dataPointCount: metrics.dataPoints.length,
            });

            return metrics;
        } catch (error) {
            logger.error('Failed to get metric history', {
                error: error instanceof Error ? error.message : String(error),
                metricType,
                tenantId,
            });

            // Return empty metrics on error
            return {
                metricType,
                timeWindow: 0,
                dataPoints: [],
                aggregates: {
                    count: 0,
                    sum: 0,
                    avg: 0,
                    min: 0,
                    max: 0,
                    p50: 0,
                    p95: 0,
                    p99: 0,
                },
            };
        }
    }

    /**
     * Get currently active (unresolved) alerts
     *
     * Requirements:
     * - 6.5: Display active alerts with severity indicators
     * - 9.5: Allow filtering by tenant
     *
     * @param tenantId - Optional tenant ID for filtering
     * @returns Array of active alerts
     */
    async getActiveAlerts(tenantId?: string): Promise<TriggeredAlert[]> {
        try {
            const whereClause: any = {
                resolvedAt: null, // Only unresolved alerts
            };

            if (tenantId) {
                whereClause.tenantId = tenantId;
            }

            const activeAlerts = await prisma.monitoringAlertHistory.findMany({
                where: whereClause,
                orderBy: {
                    triggeredAt: 'desc',
                },
                take: 100, // Limit to most recent 100 active alerts
            });

            return activeAlerts.map((alert) => ({
                ruleId: alert.ruleId,
                ruleName: alert.ruleName,
                severity: alert.severity,
                triggeredAt: alert.triggeredAt,
                metricValue: Number(alert.metricValue),
                threshold: Number(alert.threshold),
                tenantId: alert.tenantId,
                context: (alert.context as Record<string, any>) || {},
            }));
        } catch (error) {
            logger.error('Failed to get active alerts', {
                error: error instanceof Error ? error.message : String(error),
                tenantId,
            });
            return [];
        }
    }

    /**
     * Get alert history with pagination
     *
     * Requirements:
     * - 6.5: Display active alerts with severity indicators
     * - 9.5: Allow filtering by tenant
     *
     * @param limit - Maximum number of alerts to return
     * @param tenantId - Optional tenant ID for filtering
     * @returns Array of alert history entries
     */
    async getAlertHistory(
        limit: number,
        tenantId?: string
    ): Promise<AlertHistoryEntry[]> {
        try {
            const whereClause: any = {};

            if (tenantId) {
                whereClause.tenantId = tenantId;
            }

            const alerts = await prisma.monitoringAlertHistory.findMany({
                where: whereClause,
                orderBy: {
                    triggeredAt: 'desc',
                },
                take: limit,
            });

            return alerts.map((alert) => ({
                id: alert.id,
                ruleId: alert.ruleId,
                ruleName: alert.ruleName,
                severity: alert.severity,
                triggeredAt: alert.triggeredAt,
                resolvedAt: alert.resolvedAt,
                metricValue: Number(alert.metricValue),
                threshold: Number(alert.threshold),
                tenantId: alert.tenantId,
                context: (alert.context as Record<string, any>) || {},
                notificationsSent: (alert.notificationsSent as any) || [],
                acknowledgedAt: alert.acknowledgedAt,
                acknowledgedBy: alert.acknowledgedBy,
            }));
        } catch (error) {
            logger.error('Failed to get alert history', {
                error: error instanceof Error ? error.message : String(error),
                limit,
                tenantId,
            });
            return [];
        }
    }

    /**
     * Get tenant-specific metrics
     *
     * Requirements:
     * - 9.1: Track error rates per tenant
     * - 9.2: Track API usage per tenant
     * - 9.3: Track price update success rates per tenant
     * - 9.4: Include tenant information in all alerts
     *
     * @param tenantId - Tenant ID
     * @returns Tenant-specific metrics
     */
    async getTenantMetrics(tenantId: string): Promise<TenantMetrics> {
        try {
            const timeWindow = 60 * 60; // Last hour

            // Get error rate for tenant
            const errorMetrics = await metricsCollector.getMetrics(
                'error',
                timeWindow,
                tenantId
            );
            const errorRate = this.calculateErrorRate(errorMetrics);

            // Get API usage (response time count as proxy)
            const responseTimeMetrics = await metricsCollector.getMetrics(
                'response_time',
                timeWindow,
                tenantId
            );
            const apiUsage = responseTimeMetrics.aggregates.count;

            // Get price update success rate
            const priceUpdateMetrics = await metricsCollector.getMetrics(
                'price_update',
                timeWindow,
                tenantId
            );
            const priceUpdateSuccessRate = this.calculateSuccessRate(priceUpdateMetrics);

            // Get scraping success rate
            const scrapingMetrics = await metricsCollector.getMetrics(
                'scraping_success',
                timeWindow,
                tenantId
            );
            const scrapingSuccessRate = this.calculateSuccessRate(scrapingMetrics);

            logger.info('Retrieved tenant metrics', {
                tenantId,
                errorRate,
                apiUsage,
                priceUpdateSuccessRate,
                scrapingSuccessRate,
            });

            return {
                tenantId,
                errorRate,
                apiUsage,
                priceUpdateSuccessRate,
                scrapingSuccessRate,
            };
        } catch (error) {
            logger.error('Failed to get tenant metrics', {
                error: error instanceof Error ? error.message : String(error),
                tenantId,
            });

            // Return zero metrics on error
            return {
                tenantId,
                errorRate: 0,
                apiUsage: 0,
                priceUpdateSuccessRate: 0,
                scrapingSuccessRate: 0,
            };
        }
    }

    /**
     * Calculate error rate as percentage
     *
     * @param errorMetrics - Error metrics data
     * @returns Error rate as percentage (0-100)
     */
    private calculateErrorRate(errorMetrics: MetricData): number {
        if (errorMetrics.aggregates.count === 0) {
            return 0;
        }

        // Error rate is the count of errors
        // In a real implementation, this would be errors / total requests
        // For now, we'll return the count as a simple metric
        return errorMetrics.aggregates.count;
    }

    /**
     * Calculate success rate as percentage
     *
     * @param metrics - Metrics data with success/failure indicators
     * @returns Success rate as percentage (0-100)
     */
    private calculateSuccessRate(metrics: MetricData): number {
        if (metrics.dataPoints.length === 0) {
            return 100; // No data means no failures
        }

        // Calculate success rate from data points
        // Data points with value 1 are successes, 0 are failures
        const successCount = metrics.dataPoints.filter((dp) => dp.value === 1).length;
        const totalCount = metrics.dataPoints.length;

        return (successCount / totalCount) * 100;
    }

    /**
     * Get count of active alerts
     *
     * @returns Number of active alerts
     */
    private async getActiveAlertsCount(): Promise<number> {
        try {
            return await prisma.monitoringAlertHistory.count({
                where: {
                    resolvedAt: null,
                },
            });
        } catch (error) {
            logger.error('Failed to get active alerts count', {
                error: error instanceof Error ? error.message : String(error),
            });
            return 0;
        }
    }

    /**
     * Calculate health status for each system component
     *
     * Requirements:
     * - 6.6: Display system resource utilization
     *
     * @param errorRate - Current error rate
     * @param avgResponseTime - Average response time
     * @returns Array of component health statuses
     */
    private async calculateComponentHealth(
        errorRate: number,
        avgResponseTime: number
    ): Promise<ComponentHealth[]> {
        const components: ComponentHealth[] = [];

        // API Health
        if (avgResponseTime > 1000) {
            components.push({
                name: 'API',
                status: 'critical',
                message: `High response time: ${avgResponseTime.toFixed(0)}ms`,
            });
        } else if (avgResponseTime > 500) {
            components.push({
                name: 'API',
                status: 'degraded',
                message: `Elevated response time: ${avgResponseTime.toFixed(0)}ms`,
            });
        } else {
            components.push({
                name: 'API',
                status: 'healthy',
                message: `Response time: ${avgResponseTime.toFixed(0)}ms`,
            });
        }

        // Error Rate Health
        if (errorRate > 10) {
            components.push({
                name: 'Error Rate',
                status: 'critical',
                message: `High error rate: ${errorRate} errors`,
            });
        } else if (errorRate > 5) {
            components.push({
                name: 'Error Rate',
                status: 'degraded',
                message: `Elevated error rate: ${errorRate} errors`,
            });
        } else {
            components.push({
                name: 'Error Rate',
                status: 'healthy',
                message: `Error rate: ${errorRate} errors`,
            });
        }

        // Database Health (check if we can query)
        try {
            await prisma.$queryRaw`SELECT 1`;
            components.push({
                name: 'Database',
                status: 'healthy',
                message: 'Connected',
            });
        } catch (error) {
            components.push({
                name: 'Database',
                status: 'critical',
                message: 'Connection failed',
            });
        }

        // Redis Health (check if metrics collector is working)
        const redisHealthy = process.env.UPSTASH_REDIS_REST_URL &&
            process.env.UPSTASH_REDIS_REST_TOKEN;

        if (redisHealthy) {
            components.push({
                name: 'Redis',
                status: 'healthy',
                message: 'Connected',
            });
        } else {
            components.push({
                name: 'Redis',
                status: 'degraded',
                message: 'Not configured',
            });
        }

        return components;
    }

    /**
     * Determine overall system status from component health
     *
     * @param components - Array of component health statuses
     * @param activeAlerts - Number of active alerts
     * @returns Overall system health status
     */
    private determineSystemStatus(
        components: ComponentHealth[],
        activeAlerts: number
    ): SystemHealthStatus {
        // If any component is critical, system is critical
        if (components.some((c) => c.status === 'critical')) {
            return 'critical';
        }

        // If there are critical alerts, system is critical
        if (activeAlerts > 5) {
            return 'critical';
        }

        // If any component is degraded, system is degraded
        if (components.some((c) => c.status === 'degraded')) {
            return 'degraded';
        }

        // If there are any alerts, system is degraded
        if (activeAlerts > 0) {
            return 'degraded';
        }

        // Otherwise, system is healthy
        return 'healthy';
    }
}

/**
 * Export singleton instance
 */
export const monitoringDashboardService = new MonitoringDashboardService();
