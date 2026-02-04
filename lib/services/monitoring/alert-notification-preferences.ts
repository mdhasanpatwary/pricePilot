/**
 * Alert Notification Preferences Service
 * 
 * Manages user and tenant preferences for monitoring alert notifications.
 * Allows users to configure which types of alerts they want to receive
 * and through which channels (email, Slack).
 * 
 * Features:
 * - User-level alert preferences
 * - Tenant-level notification channel configuration
 * - Alert type filtering
 * - Severity-based filtering
 * - Channel-specific preferences
 * 
 * Requirements: 2.15.2
 * Task: 17.2 - Implement alert notifications
 * 
 * @module lib/services/monitoring/alert-notification-preferences
 */

import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';

/**
 * User alert notification preferences
 */
export interface UserAlertPreferences {
    userId: string;
    emailNotifications: boolean;
    alertTypes?: string[]; // Specific alert types to receive (empty = all)
    minSeverity?: 'INFO' | 'WARNING' | 'CRITICAL'; // Minimum severity level
}

/**
 * Tenant notification channel configuration
 */
export interface TenantNotificationConfig {
    tenantId: string;
    emailEnabled: boolean;
    slackEnabled: boolean;
    slackWebhookUrl?: string;
    defaultRecipients?: string[]; // Default email recipients for tenant-wide alerts
}

/**
 * Alert Notification Preferences Service
 */
export class AlertNotificationPreferencesService {
    /**
     * Get user alert notification preferences
     * 
     * @param userId - User ID
     * @returns User alert preferences
     */
    static async getUserPreferences(userId: string): Promise<UserAlertPreferences> {
        try {
            const user = await prisma.user.findUnique({
                where: { id: userId },
                select: {
                    id: true,
                    emailNotifications: true,
                },
            });

            if (!user) {
                throw new Error('User not found');
            }

            return {
                userId: user.id,
                emailNotifications: user.emailNotifications,
                // Future: Add support for alert type and severity filtering
                alertTypes: [],
                minSeverity: 'INFO',
            };
        } catch (error) {
            logger.error('Failed to get user alert preferences', {
                error: error instanceof Error ? error.message : String(error),
                userId,
            });
            throw error;
        }
    }

    /**
     * Update user alert notification preferences
     * 
     * @param userId - User ID
     * @param preferences - Preferences to update
     * @returns Updated preferences
     */
    static async updateUserPreferences(
        userId: string,
        preferences: Partial<UserAlertPreferences>
    ): Promise<UserAlertPreferences> {
        try {
            const updateData: any = {};

            if (preferences.emailNotifications !== undefined) {
                updateData.emailNotifications = preferences.emailNotifications;
            }

            await prisma.user.update({
                where: { id: userId },
                data: updateData,
            });

            logger.info('User alert preferences updated', {
                userId,
                preferences,
            });

            return this.getUserPreferences(userId);
        } catch (error) {
            logger.error('Failed to update user alert preferences', {
                error: error instanceof Error ? error.message : String(error),
                userId,
                preferences,
            });
            throw error;
        }
    }

    /**
     * Get tenant notification channel configuration
     * 
     * @param tenantId - Tenant ID
     * @returns Tenant notification configuration
     */
    static async getTenantConfig(tenantId: string): Promise<TenantNotificationConfig> {
        try {
            const tenant = await prisma.tenant.findUnique({
                where: { id: tenantId },
                select: {
                    id: true,
                    slackEnabled: true,
                    slackWebhookUrl: true,
                },
            });

            if (!tenant) {
                throw new Error('Tenant not found');
            }

            return {
                tenantId: tenant.id,
                emailEnabled: true, // Email is always enabled at tenant level
                slackEnabled: tenant.slackEnabled,
                slackWebhookUrl: tenant.slackWebhookUrl || undefined,
            };
        } catch (error) {
            logger.error('Failed to get tenant notification config', {
                error: error instanceof Error ? error.message : String(error),
                tenantId,
            });
            throw error;
        }
    }

    /**
     * Update tenant notification channel configuration
     * 
     * @param tenantId - Tenant ID
     * @param config - Configuration to update
     * @returns Updated configuration
     */
    static async updateTenantConfig(
        tenantId: string,
        config: Partial<TenantNotificationConfig>
    ): Promise<TenantNotificationConfig> {
        try {
            const updateData: any = {};

            if (config.slackEnabled !== undefined) {
                updateData.slackEnabled = config.slackEnabled;
            }

            if (config.slackWebhookUrl !== undefined) {
                updateData.slackWebhookUrl = config.slackWebhookUrl;
            }

            await prisma.tenant.update({
                where: { id: tenantId },
                data: updateData,
            });

            logger.info('Tenant notification config updated', {
                tenantId,
                config,
            });

            return this.getTenantConfig(tenantId);
        } catch (error) {
            logger.error('Failed to update tenant notification config', {
                error: error instanceof Error ? error.message : String(error),
                tenantId,
                config,
            });
            throw error;
        }
    }

    /**
     * Get email recipients for an alert
     * 
     * Determines which users should receive email notifications for a specific alert
     * based on their preferences and the alert properties.
     * 
     * @param tenantId - Tenant ID (null for system-wide alerts)
     * @param alertSeverity - Alert severity level
     * @param alertType - Alert type/metric type
     * @returns Array of email addresses
     */
    static async getEmailRecipients(
        tenantId: string | null,
        alertSeverity: string,
        alertType: string
    ): Promise<string[]> {
        try {
            // For system-wide alerts (tenantId = null), notify super admins
            if (!tenantId) {
                const superAdmins = await prisma.user.findMany({
                    where: {
                        isSuperAdmin: true,
                        emailNotifications: true,
                    },
                    select: {
                        email: true,
                    },
                });

                return superAdmins.map(admin => admin.email);
            }

            // For tenant-specific alerts, notify tenant admins with email notifications enabled
            const tenantUsers = await prisma.user.findMany({
                where: {
                    tenantId,
                    role: 'ADMIN',
                    emailNotifications: true,
                },
                select: {
                    email: true,
                },
            });

            return tenantUsers.map(user => user.email);
        } catch (error) {
            logger.error('Failed to get email recipients for alert', {
                error: error instanceof Error ? error.message : String(error),
                tenantId,
                alertSeverity,
                alertType,
            });
            return [];
        }
    }

    /**
     * Check if Slack notifications are enabled for a tenant
     * 
     * @param tenantId - Tenant ID (null for system-wide)
     * @returns True if Slack is enabled and configured
     */
    static async isSlackEnabled(tenantId: string | null): Promise<boolean> {
        try {
            if (!tenantId) {
                // Check system-level Slack configuration
                const systemConfig = await prisma.systemConfig.findUnique({
                    where: { key: 'NOTIFICATIONS_SLACK_ENABLED' },
                });

                return systemConfig?.value === 'true';
            }

            // Check tenant-level Slack configuration
            const tenant = await prisma.tenant.findUnique({
                where: { id: tenantId },
                select: {
                    slackEnabled: true,
                    slackWebhookUrl: true,
                },
            });

            return !!(tenant?.slackEnabled && tenant?.slackWebhookUrl);
        } catch (error) {
            logger.error('Failed to check Slack enabled status', {
                error: error instanceof Error ? error.message : String(error),
                tenantId,
            });
            return false;
        }
    }

    /**
     * Get Slack webhook URL for a tenant
     * 
     * @param tenantId - Tenant ID (null for system-wide)
     * @returns Slack webhook URL or null if not configured
     */
    static async getSlackWebhookUrl(tenantId: string | null): Promise<string | null> {
        try {
            if (!tenantId) {
                // Get system-level Slack webhook URL
                const systemConfig = await prisma.systemConfig.findUnique({
                    where: { key: 'SLACK_WEBHOOK_URL' },
                });

                return systemConfig?.value || null;
            }

            // Get tenant-level Slack webhook URL
            const tenant = await prisma.tenant.findUnique({
                where: { id: tenantId },
                select: {
                    slackWebhookUrl: true,
                },
            });

            return tenant?.slackWebhookUrl || null;
        } catch (error) {
            logger.error('Failed to get Slack webhook URL', {
                error: error instanceof Error ? error.message : String(error),
                tenantId,
            });
            return null;
        }
    }

    /**
     * Test alert notification delivery
     * 
     * Sends a test alert to verify notification configuration.
     * 
     * @param userId - User ID requesting the test
     * @param channelType - Channel to test ('email' or 'slack')
     * @returns True if test notification sent successfully
     */
    static async sendTestNotification(
        userId: string,
        channelType: 'email' | 'slack'
    ): Promise<boolean> {
        try {
            const user = await prisma.user.findUnique({
                where: { id: userId },
                select: {
                    email: true,
                    tenantId: true,
                    emailNotifications: true,
                },
            });

            if (!user) {
                throw new Error('User not found');
            }

            if (channelType === 'email') {
                if (!user.emailNotifications) {
                    throw new Error('Email notifications are disabled for this user');
                }

                // Import email service dynamically to avoid circular dependencies
                const { emailNotificationService } = await import('./email-notification');

                // Create a test alert
                const testAlert = {
                    ruleId: 'test-rule',
                    ruleName: 'Test Alert Notification',
                    severity: 'INFO' as const,
                    triggeredAt: new Date(),
                    metricValue: 100,
                    threshold: 50,
                    tenantId: user.tenantId,
                    context: {
                        metricType: 'test',
                        isTest: true,
                    },
                };

                const success = await emailNotificationService.sendAlert(testAlert, [user.email]);

                logger.info('Test email notification sent', {
                    userId,
                    email: user.email,
                    success,
                });

                return success;
            } else if (channelType === 'slack') {
                const slackEnabled = await this.isSlackEnabled(user.tenantId);

                if (!slackEnabled) {
                    throw new Error('Slack notifications are not enabled for this tenant');
                }

                const webhookUrl = await this.getSlackWebhookUrl(user.tenantId);

                if (!webhookUrl) {
                    throw new Error('Slack webhook URL is not configured');
                }

                // Import notification router dynamically
                const { notificationRouter } = await import('./notification-router');

                // Create a test notification channel
                const testChannel = {
                    id: 'test-slack-channel',
                    type: 'slack' as const,
                    name: 'Test Slack Channel',
                    enabled: true,
                    config: {
                        webhookUrl,
                        channel: '#alerts',
                        username: 'PricePilot Monitoring',
                        iconEmoji: ':robot_face:',
                    },
                };

                // Create a test alert
                const testAlert = {
                    ruleId: 'test-rule',
                    ruleName: 'Test Alert Notification',
                    severity: 'INFO' as const,
                    triggeredAt: new Date(),
                    metricValue: 100,
                    threshold: 50,
                    tenantId: user.tenantId,
                    context: {
                        metricType: 'test',
                        isTest: true,
                    },
                };

                // Send test notification
                const results = await notificationRouter.sendNotification(testAlert, [testChannel.id]);

                const success = results.length > 0 && results[0].success;

                logger.info('Test Slack notification sent', {
                    userId,
                    tenantId: user.tenantId,
                    success,
                });

                return success;
            }

            return false;
        } catch (error) {
            logger.error('Failed to send test notification', {
                error: error instanceof Error ? error.message : String(error),
                userId,
                channelType,
            });
            throw error;
        }
    }
}
