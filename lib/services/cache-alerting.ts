/**
 * Cache Alerting Service
 * 
 * Handles alerting for cache health issues based on monitoring thresholds.
 * Integrates with notification systems to send alerts when issues are detected.
 * 
 * Requirements: 4.5, 10.4, 10.6
 */

import { logger } from "@/lib/logger";
import { cacheMonitoringService, Alert, CacheHealth } from "./cache-monitoring";

export interface AlertConfig {
    enabled: boolean;
    hitRateThreshold: number;      // Default: 0.6 (60%)
    memoryUsageThreshold: number;  // Default: 0.8 (80%)
    responseTimeThreshold: number; // Default: 100ms
    connectivityCheckEnabled: boolean;
    notificationChannels: ('email' | 'slack' | 'webhook' | 'log')[];
}

export interface AlertHistory {
    alertId: string;
    timestamp: Date;
    level: 'info' | 'warning' | 'error';
    metric: string;
    message: string;
    value?: number;
    threshold?: number;
    resolved: boolean;
    resolvedAt?: Date;
}

export class CacheAlertingService {
    private config: AlertConfig;
    private alertHistory: Map<string, AlertHistory> = new Map();
    private lastAlertTime: Map<string, Date> = new Map();
    private readonly ALERT_COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes

    constructor(config?: Partial<AlertConfig>) {
        this.config = {
            enabled: true,
            hitRateThreshold: 0.6,
            memoryUsageThreshold: 0.8,
            responseTimeThreshold: 100,
            connectivityCheckEnabled: true,
            notificationChannels: ['log'],
            ...config,
        };

        logger.info('[CacheAlerting] Initialized with config', {
            enabled: this.config.enabled,
            hitRateThreshold: `${this.config.hitRateThreshold * 100}%`,
            memoryUsageThreshold: `${this.config.memoryUsageThreshold * 100}%`,
            responseTimeThreshold: `${this.config.responseTimeThreshold}ms`,
        });
    }

    /**
     * Check cache health and send alerts if issues detected
     * Requirement 4.5: Alert when hit rate falls below 60%
     * Requirement 10.4: Alert when memory usage exceeds 80%
     * Requirement 10.6: Alert on Redis connectivity failures
     */
    async checkAndAlert(): Promise<void> {
        if (!this.config.enabled) {
            return;
        }

        try {
            // Get current health status
            const health = await cacheMonitoringService.getHealthStatus();

            // Process alerts from monitoring service
            if (health.alerts && health.alerts.length > 0) {
                for (const alert of health.alerts) {
                    await this.processAlert(alert, health);
                }
            }

            // Check Redis connectivity
            if (this.config.connectivityCheckEnabled && health.status === 'unhealthy') {
                await this.sendConnectivityAlert(health);
            }

            // Check cache operation performance
            await this.checkPerformance();

            // Resolve any alerts that are no longer active
            await this.resolveInactiveAlerts(health);
        } catch (error) {
            logger.error('[CacheAlerting] Error checking cache health', { error });
        }
    }

    /**
     * Process an alert from the monitoring service
     */
    private async processAlert(alert: Alert, health: CacheHealth): Promise<void> {
        const alertKey = `${alert.metric || 'general'}_${alert.level}`;

        // Check cooldown to prevent alert spam
        if (this.isInCooldown(alertKey)) {
            return;
        }

        // Create alert history entry
        const alertHistory: AlertHistory = {
            alertId: `${alertKey}_${Date.now()}`,
            timestamp: new Date(),
            level: alert.level,
            metric: alert.metric || 'general',
            message: alert.message,
            value: alert.value,
            threshold: alert.threshold,
            resolved: false,
        };

        this.alertHistory.set(alertKey, alertHistory);
        this.lastAlertTime.set(alertKey, new Date());

        // Send alert through configured channels
        await this.sendAlert(alertHistory, health);
    }

    /**
     * Send connectivity alert when Redis is unreachable
     * Requirement 10.6: Alert on Redis connectivity failures
     */
    private async sendConnectivityAlert(health: CacheHealth): Promise<void> {
        const alertKey = 'redis_connectivity_error';

        if (this.isInCooldown(alertKey)) {
            return;
        }

        const alertHistory: AlertHistory = {
            alertId: `${alertKey}_${Date.now()}`,
            timestamp: new Date(),
            level: 'error',
            metric: 'connectivity',
            message: `Redis connectivity failed: ${health.error || 'Unknown error'}`,
            resolved: false,
        };

        this.alertHistory.set(alertKey, alertHistory);
        this.lastAlertTime.set(alertKey, new Date());

        await this.sendAlert(alertHistory, health);
    }

    /**
     * Check cache operation performance
     * Requirement 10.6: Alert when cache operations take longer than 100ms
     */
    private async checkPerformance(): Promise<void> {
        try {
            const { healthy, latency } = await cacheMonitoringService.checkPerformance();

            if (!healthy && latency > this.config.responseTimeThreshold) {
                const alertKey = 'cache_performance_slow';

                if (this.isInCooldown(alertKey)) {
                    return;
                }

                const alertHistory: AlertHistory = {
                    alertId: `${alertKey}_${Date.now()}`,
                    timestamp: new Date(),
                    level: 'warning',
                    metric: 'responseTime',
                    message: `Cache operations slow: ${latency}ms (threshold: ${this.config.responseTimeThreshold}ms)`,
                    value: latency,
                    threshold: this.config.responseTimeThreshold,
                    resolved: false,
                };

                this.alertHistory.set(alertKey, alertHistory);
                this.lastAlertTime.set(alertKey, new Date());

                await this.sendAlert(alertHistory);
            }
        } catch (error) {
            logger.error('[CacheAlerting] Error checking performance', { error });
        }
    }

    /**
     * Send alert through configured notification channels
     */
    private async sendAlert(alert: AlertHistory, health?: CacheHealth): Promise<void> {
        const channels = this.config.notificationChannels;

        for (const channel of channels) {
            try {
                switch (channel) {
                    case 'log':
                        this.logAlert(alert, health);
                        break;

                    case 'email':
                        await this.sendEmailAlert(alert, health);
                        break;

                    case 'slack':
                        await this.sendSlackAlert(alert, health);
                        break;

                    case 'webhook':
                        await this.sendWebhookAlert(alert, health);
                        break;

                    default:
                        logger.warn('[CacheAlerting] Unknown notification channel', { channel });
                }
            } catch (error) {
                logger.error('[CacheAlerting] Error sending alert', { channel, error });
            }
        }
    }

    /**
     * Log alert to console/logger
     */
    private logAlert(alert: AlertHistory, health?: CacheHealth): void {
        const logLevel = alert.level === 'error' ? 'error' :
            alert.level === 'warning' ? 'warn' : 'info';

        logger[logLevel]('[CacheAlerting] Cache Alert', {
            alertId: alert.alertId,
            metric: alert.metric,
            message: alert.message,
            value: alert.value,
            threshold: alert.threshold,
            health: health ? {
                status: health.status,
                hitRate: health.performance?.hitRate,
                memoryUsage: health.redis?.memoryUsagePercent,
            } : undefined,
        });
    }

    /**
     * Send email alert
     */
    private async sendEmailAlert(alert: AlertHistory, health?: CacheHealth): Promise<void> {
        try {
            const subject = `[${alert.level.toUpperCase()}] Cache Alert: ${alert.metric}`;
            const body = this.formatAlertEmail(alert, health);

            // TODO: Implement email notification through NotificationService
            // For now, just log the alert
            logger.warn('[CacheAlerting] Email alert (not implemented)', {
                alertId: alert.alertId,
                subject,
                body
            });
        } catch (error) {
            logger.error('[CacheAlerting] Failed to send email alert', { error });
        }
    }

    /**
     * Send Slack alert
     */
    private async sendSlackAlert(alert: AlertHistory, health?: CacheHealth): Promise<void> {
        try {
            const message = this.formatAlertSlack(alert, health);

            // TODO: Implement Slack notification through NotificationService
            // For now, just log the alert
            logger.warn('[CacheAlerting] Slack alert (not implemented)', {
                alertId: alert.alertId,
                message
            });
        } catch (error) {
            logger.error('[CacheAlerting] Failed to send Slack alert', { error });
        }
    }

    /**
     * Send webhook alert
     */
    private async sendWebhookAlert(alert: AlertHistory, health?: CacheHealth): Promise<void> {
        try {
            const webhookUrl = process.env.ALERT_WEBHOOK_URL;
            if (!webhookUrl) {
                logger.warn('[CacheAlerting] Webhook URL not configured');
                return;
            }

            const payload = {
                alert,
                health,
                timestamp: new Date().toISOString(),
            };

            await fetch(webhookUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });

            logger.info('[CacheAlerting] Webhook alert sent', { alertId: alert.alertId });
        } catch (error) {
            logger.error('[CacheAlerting] Failed to send webhook alert', { error });
        }
    }

    /**
     * Format alert for email
     */
    private formatAlertEmail(alert: AlertHistory, health?: CacheHealth): string {
        let body = `Cache Alert Detected\n\n`;
        body += `Alert ID: ${alert.alertId}\n`;
        body += `Level: ${alert.level.toUpperCase()}\n`;
        body += `Metric: ${alert.metric}\n`;
        body += `Message: ${alert.message}\n`;
        body += `Timestamp: ${alert.timestamp.toISOString()}\n\n`;

        if (alert.value !== undefined) {
            body += `Current Value: ${alert.value}\n`;
        }
        if (alert.threshold !== undefined) {
            body += `Threshold: ${alert.threshold}\n`;
        }

        if (health) {
            body += `\nCache Health Status:\n`;
            body += `Status: ${health.status}\n`;
            if (health.redis) {
                body += `Redis Connected: ${health.redis.connected}\n`;
                body += `Memory Usage: ${health.redis.memoryUsagePercent * 100}%\n`;
            }
            if (health.performance) {
                body += `Hit Rate: ${(health.performance.hitRate * 100).toFixed(1)}%\n`;
                body += `Total Keys: ${health.performance.totalKeys}\n`;
            }
        }

        return body;
    }

    /**
     * Format alert for Slack
     */
    private formatAlertSlack(alert: AlertHistory, health?: CacheHealth): string {
        const emoji = alert.level === 'error' ? '🔴' :
            alert.level === 'warning' ? '⚠️' : 'ℹ️';

        let message = `${emoji} *Cache Alert: ${alert.metric}*\n`;
        message += `${alert.message}\n`;

        if (alert.value !== undefined && alert.threshold !== undefined) {
            message += `Value: ${alert.value} | Threshold: ${alert.threshold}\n`;
        }

        if (health?.performance) {
            message += `\nHit Rate: ${(health.performance.hitRate * 100).toFixed(1)}% | `;
            message += `Keys: ${health.performance.totalKeys}`;
        }

        return message;
    }

    /**
     * Check if alert is in cooldown period
     */
    private isInCooldown(alertKey: string): boolean {
        const lastAlert = this.lastAlertTime.get(alertKey);
        if (!lastAlert) {
            return false;
        }

        const timeSinceLastAlert = Date.now() - lastAlert.getTime();
        return timeSinceLastAlert < this.ALERT_COOLDOWN_MS;
    }

    /**
     * Resolve alerts that are no longer active
     */
    private async resolveInactiveAlerts(health: CacheHealth): Promise<void> {
        const activeMetrics = new Set(
            health.alerts?.map(a => a.metric || 'general') || []
        );

        for (const [, alert] of this.alertHistory.entries()) {
            if (!alert.resolved && !activeMetrics.has(alert.metric)) {
                alert.resolved = true;
                alert.resolvedAt = new Date();

                logger.info('[CacheAlerting] Alert resolved', {
                    alertId: alert.alertId,
                    metric: alert.metric,
                    duration: alert.resolvedAt.getTime() - alert.timestamp.getTime(),
                });
            }
        }
    }

    /**
     * Get alert history
     */
    getAlertHistory(limit: number = 100): AlertHistory[] {
        return Array.from(this.alertHistory.values())
            .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
            .slice(0, limit);
    }

    /**
     * Get active alerts
     */
    getActiveAlerts(): AlertHistory[] {
        return Array.from(this.alertHistory.values())
            .filter(alert => !alert.resolved)
            .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    }

    /**
     * Clear alert history
     */
    clearHistory(): void {
        this.alertHistory.clear();
        this.lastAlertTime.clear();
        logger.info('[CacheAlerting] Alert history cleared');
    }

    /**
     * Update configuration
     */
    updateConfig(config: Partial<AlertConfig>): void {
        this.config = { ...this.config, ...config };
        logger.info('[CacheAlerting] Configuration updated', { config: this.config });
    }

    /**
     * Get current configuration
     */
    getConfig(): AlertConfig {
        return { ...this.config };
    }
}

// Export singleton instance
export const cacheAlertingService = new CacheAlertingService({
    enabled: process.env.CACHE_ALERTING_ENABLED !== 'false',
    notificationChannels: ['log'], // Default to log only, can be configured via env
});
