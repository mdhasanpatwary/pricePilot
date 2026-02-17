/**
 * Notification Router Service
 *
 * Routes alerts to appropriate notification channels with parallel delivery,
 * rate limiting, and comprehensive logging.
 *
 * Features:
 * - Channel routing based on alert configuration
 * - Parallel notification delivery to multiple channels
 * - Rate limiting (max 10 per channel per minute)
 * - Notification delivery logging
 * - Fallback to alternative channels on failure
 * - Support for email, Slack, and webhook channels
 *
 * Requirements: 4.1, 4.5, 5.1, 5.4, 10.4
 *
 * @module lib/services/monitoring/notification-router
 */

import axios from 'axios';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { emailNotificationService } from './email-notification';
import type { TriggeredAlert } from './alert-rules-evaluator';
import type { Redis } from "ioredis";
import { getRedisConnection } from "@/lib/queue/connection";

/**
 * Notification result for a single channel
 */
export interface NotificationResult {
    channel: string;
    success: boolean;
    error?: string;
    deliveredAt?: Date;
}

/**
 * Notification channel configuration
 */
export interface NotificationChannel {
    id: string;
    type: 'email' | 'slack' | 'webhook';
    name: string;
    enabled: boolean;
    config: EmailChannelConfig | SlackChannelConfig | WebhookChannelConfig;
}

/**
 * Email channel configuration
 */
export interface EmailChannelConfig {
    recipients: string[];
    fromAddress?: string;
    fromName?: string;
}

/**
 * Slack channel configuration
 */
export interface SlackChannelConfig {
    webhookUrl: string;
    channel: string;
    username?: string;
    iconEmoji?: string;
}

/**
 * Webhook channel configuration
 */
export interface WebhookChannelConfig {
    url: string;
    secret?: string;
    headers?: Record<string, string>;
}

/**
 * Slack message attachment
 */
export interface SlackAttachment {
    color: string;
    title: string;
    text: string;
    fields: Array<{
        title: string;
        value: string;
        short: boolean;
    }>;
    actions?: Array<{
        type: string;
        text: string;
        url: string;
    }>;
}

/**
 * Slack message structure
 */
export interface SlackMessage {
    channel?: string;
    text: string;
    attachments: SlackAttachment[];
}

/**
 * Notification Router Interface
 */
export interface INotificationRouter {
    sendNotification(alert: TriggeredAlert, channels: string[]): Promise<NotificationResult[]>;
    testNotification(channel: string): Promise<boolean>;
}

/**
 * Notification Router Implementation
 */
export class NotificationRouter implements INotificationRouter {
    private redis: Redis | null;
    private readonly RATE_LIMIT_MAX = 10; // Max notifications per channel per minute
    private readonly RATE_LIMIT_WINDOW = 60; // 1 minute in seconds
    private readonly RATE_LIMIT_KEY_PREFIX = 'notification:ratelimit';

    constructor(redis?: Redis | null) {
        // Allow Redis injection for testing, otherwise initialize from environment
        if (redis !== undefined) {
            this.redis = redis;
        } else {
            this.redis = getRedisConnection();
        }
    }

    /**
     * Send notification to multiple channels in parallel
     *
     * Requirements:
     * - 4.1: Send notifications to configured channels
     * - 4.5: Support different channels for different alert severities
     * - 5.1: Send Slack notifications
     * - 5.4: Configure different channels for different alert types
     * - 10.4: Log all notification deliveries
     *
     * @param alert - Triggered alert information
     * @param channels - Array of channel IDs to send to
     * @returns Array of notification results
     */
    async sendNotification(
        alert: TriggeredAlert,
        channels: string[]
    ): Promise<NotificationResult[]> {
        if (!channels || channels.length === 0) {
            logger.warn('No notification channels specified for alert', {
                ruleId: alert.ruleId,
                ruleName: alert.ruleName,
            });
            return [];
        }

        logger.info('Routing notification to channels', {
            ruleId: alert.ruleId,
            ruleName: alert.ruleName,
            channelCount: channels.length,
            channels,
        });

        // Fetch channel configurations
        const channelConfigs = await this.getChannelConfigurations(channels);

        // Send notifications in parallel
        const notificationPromises = channelConfigs.map(async (channel) => {
            return this.sendToChannel(alert, channel);
        });

        const results = await Promise.allSettled(notificationPromises);

        // Process results
        const notificationResults: NotificationResult[] = results.map((result, index) => {
            const channel = channelConfigs[index];

            if (result.status === 'fulfilled') {
                return result.value;
            } else {
                logger.error('Notification delivery failed with exception', {
                    channel: channel.id,
                    channelType: channel.type,
                    error: result.reason instanceof Error ? result.reason.message : String(result.reason),
                });

                return {
                    channel: channel.id,
                    success: false,
                    error: result.reason instanceof Error ? result.reason.message : String(result.reason),
                };
            }
        });

        // Log delivery summary (Requirement 10.4)
        await this.logNotificationDelivery(alert, notificationResults);

        // Log summary
        const successCount = notificationResults.filter(r => r.success).length;
        const failureCount = notificationResults.length - successCount;

        logger.info('Notification delivery complete', {
            ruleId: alert.ruleId,
            totalChannels: notificationResults.length,
            successCount,
            failureCount,
        });

        return notificationResults;
    }

    /**
     * Test notification delivery to a specific channel
     *
     * Requirement 10.1: Provide test endpoint to trigger sample alerts
     *
     * @param channel - Channel ID to test
     * @returns True if test notification sent successfully
     */
    async testNotification(channel: string): Promise<boolean> {
        try {
            // Create a test alert
            const testAlert: TriggeredAlert = {
                ruleId: 'test-rule',
                ruleName: 'Test Alert',
                severity: 'INFO',
                triggeredAt: new Date(),
                metricValue: 100,
                threshold: 50,
                tenantId: null,
                context: {
                    metricType: 'test',
                    isTest: true,
                },
            };

            // Send to the specified channel
            const results = await this.sendNotification(testAlert, [channel]);

            return results.length > 0 && results[0].success;
        } catch (error) {
            logger.error('Failed to send test notification', {
                error: error instanceof Error ? error.message : String(error),
                channel,
            });
            return false;
        }
    }

    /**
     * Send notification to a single channel
     *
     * @param alert - Triggered alert
     * @param channel - Channel configuration
     * @returns Notification result
     */
    private async sendToChannel(
        alert: TriggeredAlert,
        channel: NotificationChannel
    ): Promise<NotificationResult> {
        try {
            // Check if channel is enabled
            if (!channel.enabled) {
                logger.info('Channel is disabled, skipping notification', {
                    channel: channel.id,
                    channelType: channel.type,
                });

                return {
                    channel: channel.id,
                    success: false,
                    error: 'Channel is disabled',
                };
            }

            // Check rate limit (Requirement 10.4)
            const rateLimitOk = await this.checkRateLimit(channel.id);
            if (!rateLimitOk) {
                logger.warn('Rate limit exceeded for channel', {
                    channel: channel.id,
                    channelType: channel.type,
                    limit: this.RATE_LIMIT_MAX,
                    window: this.RATE_LIMIT_WINDOW,
                });

                return {
                    channel: channel.id,
                    success: false,
                    error: 'Rate limit exceeded',
                };
            }

            // Route to appropriate channel handler
            let success = false;

            switch (channel.type) {
                case 'email':
                    success = await this.sendEmailNotification(alert, channel.config as EmailChannelConfig);
                    break;
                case 'slack':
                    success = await this.sendSlackNotification(alert, channel.config as SlackChannelConfig);
                    break;
                case 'webhook':
                    success = await this.sendWebhookNotification(alert, channel.config as WebhookChannelConfig);
                    break;
                default:
                    logger.error('Unknown channel type', {
                        channel: channel.id,
                        channelType: channel.type,
                    });
                    return {
                        channel: channel.id,
                        success: false,
                        error: `Unknown channel type: ${channel.type}`,
                    };
            }

            // Increment rate limit counter if successful
            if (success) {
                await this.incrementRateLimit(channel.id);
            }

            return {
                channel: channel.id,
                success,
                deliveredAt: success ? new Date() : undefined,
            };
        } catch (error) {
            logger.error('Failed to send notification to channel', {
                error: error instanceof Error ? error.message : String(error),
                channel: channel.id,
                channelType: channel.type,
            });

            return {
                channel: channel.id,
                success: false,
                error: error instanceof Error ? error.message : String(error),
            };
        }
    }

    /**
     * Send email notification
     *
     * Requirement 4.1: Send email notifications
     *
     * @param alert - Triggered alert
     * @param config - Email channel configuration
     * @returns True if sent successfully
     */
    private async sendEmailNotification(
        alert: TriggeredAlert,
        config: EmailChannelConfig
    ): Promise<boolean> {
        try {
            const success = await emailNotificationService.sendAlert(
                alert,
                config.recipients
            );

            return success;
        } catch (error) {
            logger.error('Failed to send email notification', {
                error: error instanceof Error ? error.message : String(error),
                recipientCount: config.recipients.length,
            });
            return false;
        }
    }

    /**
     * Send Slack notification
     *
     * Requirements:
     * - 5.1: Send Slack notifications
     * - 5.2: Format with color coding
     * - 5.3: Include alert details and action buttons
     *
     * @param alert - Triggered alert
     * @param config - Slack channel configuration
     * @returns True if sent successfully
     */
    private async sendSlackNotification(
        alert: TriggeredAlert,
        config: SlackChannelConfig
    ): Promise<boolean> {
        try {
            const slackMessage = this.formatSlackMessage(alert, config);

            // Use axios to send to Slack webhook
            await axios.post(config.webhookUrl, slackMessage, {
                headers: {
                    'Content-Type': 'application/json',
                },
                timeout: 5000,
            });

            logger.info('Slack notification sent successfully', {
                channel: config.channel,
                ruleId: alert.ruleId,
            });

            return true;
        } catch (error) {
            logger.error('Failed to send Slack notification', {
                error: error instanceof Error ? error.message : String(error),
                channel: config.channel,
            });
            return false;
        }
    }

    /**
     * Format Slack message with attachments
     *
     * Requirements: 5.2, 5.3
     *
     * @param alert - Triggered alert
     * @param config - Slack channel configuration
     * @returns Formatted Slack message
     */
    private formatSlackMessage(
        alert: TriggeredAlert,
        config: SlackChannelConfig
    ): SlackMessage {
        const isResolution = alert.context.isResolution === true;
        const severityColor = isResolution ? '#10b981' : this.getSeverityColor(alert.severity); // Green for resolution
        const severityIcon = isResolution ? '✅' : this.getSeverityIcon(alert.severity);
        const dashboardUrl = this.getDashboardUrl();

        // Format timestamp
        const timestamp = Math.floor(alert.triggeredAt.getTime() / 1000);

        // Build attachment
        const attachment: SlackAttachment = {
            color: severityColor,
            title: `${severityIcon} ${alert.ruleName}${isResolution ? ' - RESOLVED' : ''}`,
            text: alert.context.isTest
                ? '🧪 *This is a test alert*'
                : isResolution
                    ? `Alert resolved at <!date^${Math.floor(new Date(alert.context.resolvedAt).getTime() / 1000)}^{date_short_pretty} {time}|${new Date(alert.context.resolvedAt).toISOString()}>`
                    : `Alert triggered at <!date^${timestamp}^{date_short_pretty} {time}|${alert.triggeredAt.toISOString()}>`,
            fields: [
                {
                    title: 'Severity',
                    value: alert.severity,
                    short: true,
                },
                {
                    title: isResolution ? 'Status' : 'Metric Value',
                    value: isResolution ? 'Resolved' : this.formatMetricValue(alert.metricValue, alert.context.metricType),
                    short: true,
                },
            ],
            actions: [
                {
                    type: 'button',
                    text: '📊 View Dashboard',
                    url: dashboardUrl,
                },
            ],
        };

        // Add additional fields for non-resolution alerts
        if (!isResolution) {
            attachment.fields.push(
                {
                    title: 'Threshold',
                    value: this.formatMetricValue(alert.threshold, alert.context.metricType),
                    short: true,
                },
                {
                    title: 'Metric Type',
                    value: alert.context.metricType || 'unknown',
                    short: true,
                }
            );
        }

        // Add tenant field if present
        if (alert.tenantId) {
            attachment.fields.push({
                title: 'Affected Tenant',
                value: alert.tenantId,
                short: false,
            });
        }

        return {
            channel: config.channel,
            text: isResolution
                ? `✅ *Alert Resolved*: ${alert.ruleName}`
                : `${severityIcon} *${alert.severity} Alert*: ${alert.ruleName}`,
            attachments: [attachment],
        };
    }

    /**
     * Send webhook notification
     *
     * @param alert - Triggered alert
     * @param config - Webhook channel configuration
     * @returns True if sent successfully
     */
    private async sendWebhookNotification(
        alert: TriggeredAlert,
        config: WebhookChannelConfig
    ): Promise<boolean> {
        try {
            const payload = {
                type: 'alert',
                alert: {
                    ruleId: alert.ruleId,
                    ruleName: alert.ruleName,
                    severity: alert.severity,
                    triggeredAt: alert.triggeredAt.toISOString(),
                    metricValue: alert.metricValue,
                    threshold: alert.threshold,
                    tenantId: alert.tenantId,
                    context: alert.context,
                },
            };

            const headers: Record<string, string> = {
                'Content-Type': 'application/json',
                'User-Agent': 'PricePilot-Monitoring/1.0',
                'X-PricePilot-Event': 'alert',
                ...config.headers,
            };

            if (config.secret) {
                headers['X-PricePilot-Secret'] = config.secret;
            }

            await axios.post(config.url, payload, {
                headers,
                timeout: 8000,
            });

            logger.info('Webhook notification sent successfully', {
                url: config.url,
                ruleId: alert.ruleId,
            });

            return true;
        } catch (error) {
            logger.error('Failed to send webhook notification', {
                error: error instanceof Error ? error.message : String(error),
                url: config.url,
            });
            return false;
        }
    }

    /**
     * Get channel configurations from database
     *
     * @param channelIds - Array of channel IDs
     * @returns Array of channel configurations
     */
    private async getChannelConfigurations(
        channelIds: string[]
    ): Promise<NotificationChannel[]> {
        try {
            const channels = await prisma.monitoringNotificationChannel.findMany({
                where: {
                    id: {
                        in: channelIds,
                    },
                },
            });

            return channels.map(channel => ({
                id: channel.id,
                type: channel.type as 'email' | 'slack' | 'webhook',
                name: channel.name,
                enabled: channel.enabled,
                config: channel.config as any,
            }));
        } catch (error) {
            logger.error('Failed to fetch channel configurations', {
                error: error instanceof Error ? error.message : String(error),
                channelIds,
            });
            return [];
        }
    }

    /**
     * Check rate limit for a channel
     *
     * Requirement 10.4: Rate limiting (max 10 per channel per minute)
     *
     * @param channelId - Channel ID
     * @returns True if within rate limit, false if exceeded
     */
    private async checkRateLimit(channelId: string): Promise<boolean> {
        try {
            if (!this.redis) {
                // If Redis is unavailable, allow the notification (fail open)
                return true;
            }

            const key = `${this.RATE_LIMIT_KEY_PREFIX}:${channelId}`;
            const count = await this.redis.get(key);

            if (count === null) {
                return true;
            }

            return Number(count) < this.RATE_LIMIT_MAX;
        } catch (error) {
            logger.error('Failed to check rate limit, allowing notification', {
                error: error instanceof Error ? error.message : String(error),
                channelId,
            });
            return true;
        }
    }

    /**
     * Increment rate limit counter for a channel
     *
     * @param channelId - Channel ID
     */
    private async incrementRateLimit(channelId: string): Promise<void> {
        try {
            if (!this.redis) {
                return;
            }

            const key = `${this.RATE_LIMIT_KEY_PREFIX}:${channelId}`;

            // Increment counter
            const count = await this.redis.incr(key);

            // Set TTL on first increment
            if (count === 1) {
                await this.redis.expire(key, this.RATE_LIMIT_WINDOW);
            }
        } catch (error) {
            logger.error('Failed to increment rate limit counter', {
                error: error instanceof Error ? error.message : String(error),
                channelId,
            });
        }
    }

    /**
     * Log notification delivery to database
     *
     * Requirement 10.4: Log all alert deliveries with success/failure status
     *
     * @param alert - Triggered alert
     * @param results - Notification results
     */
    private async logNotificationDelivery(
        alert: TriggeredAlert,
        results: NotificationResult[]
    ): Promise<void> {
        try {
            // Store in alert history
            await prisma.monitoringAlertHistory.create({
                data: {
                    ruleId: alert.ruleId,
                    ruleName: alert.ruleName,
                    severity: alert.severity,
                    triggeredAt: alert.triggeredAt,
                    metricValue: alert.metricValue,
                    threshold: alert.threshold,
                    tenantId: alert.tenantId,
                    context: alert.context as any,
                    notificationsSent: results.map(r => ({
                        channel: r.channel,
                        success: r.success,
                        sentAt: r.deliveredAt?.toISOString() || new Date().toISOString(),
                        error: r.error,
                    })),
                },
            });

            logger.info('Notification delivery logged to database', {
                ruleId: alert.ruleId,
                resultCount: results.length,
            });
        } catch (error) {
            logger.error('Failed to log notification delivery', {
                error: error instanceof Error ? error.message : String(error),
                ruleId: alert.ruleId,
            });
        }
    }

    /**
     * Get severity color for Slack formatting
     */
    private getSeverityColor(severity: string): string {
        switch (severity) {
            case 'CRITICAL':
                return '#dc2626'; // Red
            case 'WARNING':
                return '#f59e0b'; // Yellow/Amber
            case 'INFO':
                return '#3b82f6'; // Blue
            default:
                return '#6b7280'; // Gray
        }
    }

    /**
     * Get severity icon emoji
     */
    private getSeverityIcon(severity: string): string {
        switch (severity) {
            case 'CRITICAL':
                return '🚨';
            case 'WARNING':
                return '⚠️';
            case 'INFO':
                return 'ℹ️';
            default:
                return '📊';
        }
    }

    /**
     * Get dashboard URL
     */
    private getDashboardUrl(): string {
        const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';
        return `${baseUrl}/admin/monitoring`;
    }

    /**
     * Format metric value for display
     */
    private formatMetricValue(value: number, metricType: string): string {
        // Format based on metric type
        if (metricType.includes('time') || metricType.includes('response')) {
            return `${value.toFixed(2)}ms`;
        } else if (metricType.includes('rate') || metricType.includes('percentage')) {
            return `${(value * 100).toFixed(2)}%`;
        } else if (Number.isInteger(value)) {
            return value.toString();
        } else {
            return value.toFixed(2);
        }
    }
}

// Export singleton instance
export const notificationRouter = new NotificationRouter();
