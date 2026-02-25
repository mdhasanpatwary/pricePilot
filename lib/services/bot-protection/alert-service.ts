/**
 * AlertService - Monitors metrics and sends notifications when thresholds are breached
 *
 * This service checks scraping success rates against configured thresholds and sends
 * alerts through multiple channels (email, webhook, in-app) when issues are detected.
 * Implements alert throttling to prevent notification spam.
 *
 * Requirements: 12.1, 12.2, 12.3
 */

import { prisma } from '@/lib/prisma';
import { metricsCollector, TimeWindow } from './metrics-collector';
import { NotificationSender } from '../notification-sender';

/**
 * Alert severity levels
 */
export type AlertSeverity = 'info' | 'warning' | 'critical';

/**
 * Alert types for different scraping issues
 */
export enum AlertType {
    SUCCESS_RATE_DROP = 'success_rate_drop',
    CAPTCHA_DETECTED = 'captcha_detected',
    ALL_PROXIES_BLOCKED = 'all_proxies_blocked',
    SITE_BLOCKED = 'site_blocked',
    HIGH_FAILURE_RATE = 'high_failure_rate',
    SCRAPING_RECOVERED = 'scraping_recovered',
}

/**
 * Alert interface representing a notification
 */
export interface Alert {
    id: string;
    tenantId: string;
    severity: AlertSeverity;
    type: AlertType;
    title: string;
    message: string;
    competitorWebsiteId?: string;
    metadata: Record<string, any>;
    timestamp: Date;
    acknowledged: boolean;
}

/**
 * Configuration for alert thresholds
 */
export interface AlertThresholds {
    successRateWarning: number; // e.g., 50%
    successRateCritical: number; // e.g., 20%
    recoveryThreshold: number; // e.g., 80%
    throttlingWindowMinutes: number; // e.g., 60
}

/**
 * Default alert thresholds
 */
const DEFAULT_THRESHOLDS: AlertThresholds = {
    successRateWarning: 50,
    successRateCritical: 20,
    recoveryThreshold: 80,
    throttlingWindowMinutes: 60,
};

/**
 * AlertService class for monitoring and alerting
 */
export class AlertService {
    private thresholds: AlertThresholds;

    constructor(thresholds: AlertThresholds = DEFAULT_THRESHOLDS) {
        this.thresholds = thresholds;
    }

    /**
     * Check all thresholds and trigger alerts as needed
     *
     * This method should be called periodically (e.g., every 5 minutes) to monitor
     * scraping health and trigger alerts when thresholds are breached.
     *
     * Requirements: 12.1, 12.2, 12.3
     */
    async checkThresholds(): Promise<void> {
        try {
            // Get all tenants
            const tenants = await prisma.tenant.findMany({
                select: {
                    id: true,
                },
            });

            for (const tenant of tenants) {
                await this.checkTenantThresholds(tenant.id);
            }
        } catch (error) {
            console.error('Failed to check thresholds:', error);
            throw error;
        }
    }

    /**
     * Send an alert through configured channels
     *
     * This method creates the alert in the database and sends notifications
     * through all configured channels (email, webhook, in-app).
     *
     * Requirements: 12.4, 12.6
     *
     * @param alert - The alert to send
     * @returns The created alert with ID
     */
    async sendAlert(alert: Omit<Alert, 'id' | 'timestamp' | 'acknowledged'>): Promise<Alert> {
        try {
            // Check if alert should be throttled
            const shouldThrottle = await this.shouldThrottleAlert(
                alert.tenantId,
                alert.type,
                alert.competitorWebsiteId,
                alert.severity
            );

            if (shouldThrottle) {
                console.log(`Alert throttled: ${alert.type} for site ${alert.competitorWebsiteId}`);
                // Return a dummy alert object (not saved to database)
                return {
                    ...alert,
                    id: 'throttled',
                    timestamp: new Date(),
                    acknowledged: false,
                };
            }

            // Create alert in database
            const createdAlert = await prisma.scrapingAlert.create({
                data: {
                    tenantId: alert.tenantId,
                    competitorWebsiteId: alert.competitorWebsiteId,
                    severity: alert.severity,
                    type: alert.type,
                    title: alert.title,
                    message: alert.message,
                    metadata: alert.metadata,
                    acknowledged: false,
                },
            });

            // Send notifications through all channels
            await this.sendNotifications(createdAlert);

            return {
                id: createdAlert.id,
                tenantId: createdAlert.tenantId,
                severity: createdAlert.severity as AlertSeverity,
                type: createdAlert.type as AlertType,
                title: createdAlert.title,
                message: createdAlert.message,
                competitorWebsiteId: createdAlert.competitorWebsiteId || undefined,
                metadata: createdAlert.metadata as Record<string, any>,
                timestamp: createdAlert.createdAt,
                acknowledged: createdAlert.acknowledged,
            };
        } catch (error) {
            console.error('Failed to send alert:', error);
            throw error;
        }
    }

    /**
     * Acknowledge an alert
     *
     * Marks an alert as acknowledged by a user, preventing further notifications
     * for the same issue.
     *
     * @param alertId - The alert ID to acknowledge
     * @param userId - The user acknowledging the alert
     */
    async acknowledgeAlert(alertId: string, userId?: string): Promise<void> {
        try {
            await prisma.scrapingAlert.update({
                where: {
                    id: alertId,
                },
                data: {
                    acknowledged: true,
                    acknowledgedAt: new Date(),
                    acknowledgedBy: userId,
                },
            });
        } catch (error) {
            console.error('Failed to acknowledge alert:', error);
            throw error;
        }
    }

    /**
     * Check thresholds for a specific tenant
     *
     * @param tenantId - The tenant ID to check
     */
    private async checkTenantThresholds(tenantId: string): Promise<void> {
        // Get all competitor sites for the tenant
        const sites = await prisma.site.findMany({
            where: {
                tenantId,
                type: 'COMPETITOR',
            },
            select: {
                id: true,
                baseUrl: true,
            },
        });

        for (const site of sites) {
            await this.checkSiteThresholds(tenantId, site.id, site.baseUrl);
        }
    }

    /**
     * Check thresholds for a specific competitor site
     *
     * Requirements: 9.4, 12.1, 12.2, 12.3, 12.7
     *
     * @param tenantId - The tenant ID
     * @param siteId - The competitor site ID
     * @param siteName - The competitor site name
     */
    private async checkSiteThresholds(
        tenantId: string,
        siteId: string,
        siteName: string
    ): Promise<void> {
        // Get success rate for the last hour
        const successRate = await metricsCollector.getSuccessRate(siteId, TimeWindow.LAST_HOUR);

        // Check if we have enough data (at least 5 attempts in the last hour)
        const recentAttempts = await prisma.scrapeAttempt.count({
            where: {
                competitorWebsiteId: siteId,
                createdAt: {
                    gte: new Date(Date.now() - 60 * 60 * 1000), // Last hour
                },
            },
        });

        if (recentAttempts < 5) {
            // Not enough data to make a decision
            return;
        }

        // Check for CAPTCHA challenges
        await this.checkCaptchaDetection(tenantId, siteId, siteName);

        // Check for all proxies blocked
        await this.checkAllProxiesBlocked(tenantId, siteId, siteName);

        // Check for recovery first
        const hasActiveAlert = await this.hasActiveAlert(tenantId, siteId, [
            AlertType.SUCCESS_RATE_DROP,
            AlertType.SITE_BLOCKED,
            AlertType.HIGH_FAILURE_RATE,
        ]);

        if (hasActiveAlert && successRate >= this.thresholds.recoveryThreshold) {
            // Site has recovered
            await this.sendAlert({
                tenantId,
                severity: 'info',
                type: AlertType.SCRAPING_RECOVERED,
                title: `Scraping Recovered: ${siteName}`,
                message: `Scraping for ${siteName} has recovered. Success rate is now ${successRate.toFixed(1)}%.`,
                competitorWebsiteId: siteId,
                metadata: {
                    successRate,
                    recentAttempts,
                },
            });
            return;
        }

        // Check for critical success rate drop
        if (successRate < this.thresholds.successRateCritical) {
            await this.sendAlert({
                tenantId,
                severity: 'critical',
                type: AlertType.SITE_BLOCKED,
                title: `Critical: ${siteName} Blocked`,
                message: `Scraping success rate for ${siteName} has dropped to ${successRate.toFixed(1)}%. The site may be blocking our requests.`,
                competitorWebsiteId: siteId,
                metadata: {
                    successRate,
                    threshold: this.thresholds.successRateCritical,
                    recentAttempts,
                },
            });
            return;
        }

        // Check for warning success rate drop
        if (successRate < this.thresholds.successRateWarning) {
            await this.sendAlert({
                tenantId,
                severity: 'warning',
                type: AlertType.SUCCESS_RATE_DROP,
                title: `Warning: ${siteName} Success Rate Low`,
                message: `Scraping success rate for ${siteName} has dropped to ${successRate.toFixed(1)}%. Monitoring for further degradation.`,
                competitorWebsiteId: siteId,
                metadata: {
                    successRate,
                    threshold: this.thresholds.successRateWarning,
                    recentAttempts,
                },
            });
        }
    }

    /**
     * Check for CAPTCHA challenges
     *
     * Requirements: 12.2
     *
     * @param tenantId - The tenant ID
     * @param siteId - The competitor site ID
     * @param siteName - The competitor site name
     */
    private async checkCaptchaDetection(
        tenantId: string,
        siteId: string,
        siteName: string
    ): Promise<void> {
        // Check for recent CAPTCHA detections (last 15 minutes)
        const recentCaptchas = await prisma.scrapeAttempt.count({
            where: {
                competitorWebsiteId: siteId,
                protectionType: 'captcha',
                createdAt: {
                    gte: new Date(Date.now() - 15 * 60 * 1000), // Last 15 minutes
                },
            },
        });

        if (recentCaptchas > 0) {
            // Get the most recent CAPTCHA detection
            const latestCaptcha = await prisma.scrapeAttempt.findFirst({
                where: {
                    competitorWebsiteId: siteId,
                    protectionType: 'captcha',
                },
                orderBy: {
                    createdAt: 'desc',
                },
            });

            await this.sendAlert({
                tenantId,
                severity: 'critical',
                type: AlertType.CAPTCHA_DETECTED,
                title: `CAPTCHA Detected: ${siteName}`,
                message: `CAPTCHA challenge detected on ${siteName}. Manual intervention may be required. Automated scraping cannot proceed.`,
                competitorWebsiteId: siteId,
                metadata: {
                    recentCaptchas,
                    lastDetection: latestCaptcha?.createdAt,
                    url: latestCaptcha?.url,
                },
            });
        }
    }

    /**
     * Check if all proxies are blocked for a site
     *
     * Requirements: 12.3
     *
     * @param tenantId - The tenant ID
     * @param siteId - The competitor site ID
     * @param siteName - The competitor site name
     */
    private async checkAllProxiesBlocked(
        tenantId: string,
        siteId: string,
        siteName: string
    ): Promise<void> {
        // Get all active proxies
        const activeProxies = await prisma.proxy.findMany({
            where: {
                status: 'active',
            },
            select: {
                id: true,
            },
        });

        if (activeProxies.length === 0) {
            // No proxies configured
            return;
        }

        // Check how many proxies are in cooldown for this site
        const now = new Date();
        const proxiesInCooldown = await prisma.proxySiteHealth.count({
            where: {
                competitorWebsiteId: siteId,
                proxyId: {
                    in: activeProxies.map((p) => p.id),
                },
                cooldownUntil: {
                    gte: now,
                },
            },
        });

        // If all proxies are in cooldown, trigger alert
        if (proxiesInCooldown >= activeProxies.length) {
            // Get cooldown details
            const cooldownInfo = await prisma.proxySiteHealth.findMany({
                where: {
                    competitorWebsiteId: siteId,
                    proxyId: {
                        in: activeProxies.map((p) => p.id),
                    },
                    cooldownUntil: {
                        gte: now,
                    },
                },
                select: {
                    cooldownUntil: true,
                },
                orderBy: {
                    cooldownUntil: 'asc',
                },
            });

            const earliestAvailable = cooldownInfo[0]?.cooldownUntil;

            await this.sendAlert({
                tenantId,
                severity: 'critical',
                type: AlertType.ALL_PROXIES_BLOCKED,
                title: `All Proxies Blocked: ${siteName}`,
                message: `All ${activeProxies.length} proxies are currently blocked for ${siteName}. Scraping will resume when proxies become available.`,
                competitorWebsiteId: siteId,
                metadata: {
                    totalProxies: activeProxies.length,
                    blockedProxies: proxiesInCooldown,
                    earliestAvailable,
                },
            });
        }
    }

    /**
     * Check if an alert should be throttled
     *
     * Requirements: 12.5
     *
     * @param tenantId - The tenant ID
     * @param alertType - The alert type
     * @param siteId - The competitor site ID (optional)
     * @param severity - The alert severity
     * @returns True if alert should be throttled
     */
    private async shouldThrottleAlert(
        tenantId: string,
        alertType: AlertType,
        siteId?: string,
        severity?: AlertSeverity
    ): Promise<boolean> {
        // Critical alerts bypass throttling
        if (severity === 'critical') {
            return false;
        }

        // Recovery alerts always sent
        if (alertType === AlertType.SCRAPING_RECOVERED) {
            return false;
        }

        // Check for recent alerts of the same type for the same site
        const throttlingWindow = new Date(
            Date.now() - this.thresholds.throttlingWindowMinutes * 60 * 1000
        );

        const recentAlerts = await prisma.scrapingAlert.count({
            where: {
                tenantId,
                type: alertType,
                competitorWebsiteId: siteId,
                createdAt: {
                    gte: throttlingWindow,
                },
            },
        });

        return recentAlerts > 0;
    }

    /**
     * Check if there's an active (unacknowledged) alert for a site
     *
     * @param tenantId - The tenant ID
     * @param siteId - The competitor site ID
     * @param alertTypes - The alert types to check
     * @returns True if there's an active alert
     */
    private async hasActiveAlert(
        tenantId: string,
        siteId: string,
        alertTypes: AlertType[]
    ): Promise<boolean> {
        const count = await prisma.scrapingAlert.count({
            where: {
                tenantId,
                competitorWebsiteId: siteId,
                type: {
                    in: alertTypes,
                },
                acknowledged: false,
            },
        });

        return count > 0;
    }

    /**
     * Send notifications through all configured channels
     *
     * Requirements: 12.4, 12.6
     *
     * @param alert - The alert to send notifications for
     */
    private async sendNotifications(alert: any): Promise<void> {
        // Get tenant configuration for notification channels
        const tenant = await prisma.tenant.findUnique({
            where: {
                id: alert.tenantId,
            },
            select: {
                id: true,
                companyName: true,
                User: {
                    where: {
                        emailNotifications: true,
                    },
                    select: {
                        email: true,
                        name: true,
                    },
                },
            },
        });

        if (!tenant) {
            console.error('Tenant not found for alert:', alert.tenantId);
            return;
        }

        // Get competitor site name if available
        let siteName = 'Unknown Site';
        if (alert.competitorWebsiteId) {
            const site = await prisma.site.findUnique({
                where: {
                    id: alert.competitorWebsiteId,
                },
                select: {
                    baseUrl: true,
                },
            });
            siteName = site?.baseUrl || siteName;
        }

        // In-app notifications are always created (already done via database insert)

        // Send email notification if users have notifications enabled
        await this.sendEmailNotification(alert, tenant, siteName);

        // Send webhook notification if configured
        await this.sendWebhookNotification(alert, tenant, siteName);
    }

    /**
     * Send email notification
     *
     * Requirements: 12.4, 12.6
     *
     * @param alert - The alert to send
     * @param tenant - The tenant configuration
     * @param siteName - The competitor site name
     */
    private async sendEmailNotification(alert: any, tenant: any, siteName: string): Promise<void> {
        try {
            // Skip if no users with email notifications enabled
            if (!tenant.User || tenant.User.length === 0) {
                return;
            }

            const dashboardUrl = `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/admin/monitoring`;

            // Build email content with context (Requirement 12.6)
            const metadata = alert.metadata as Record<string, any>;
            const contextDetails = this.buildContextDetails(metadata, siteName);

            const severityColor = this.getSeverityColor(alert.severity);
            const severityLabel = alert.severity.toUpperCase();

            const html = `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <div style="background-color: ${severityColor}; color: white; padding: 20px; border-radius: 5px 5px 0 0;">
                        <h2 style="margin: 0;">[${severityLabel}] ${alert.title}</h2>
                    </div>

                    <div style="background-color: #f9f9f9; padding: 20px; border: 1px solid #ddd; border-top: none;">
                        <p style="font-size: 16px; line-height: 1.6;">${alert.message}</p>

                        ${contextDetails}

                        <div style="margin: 30px 0;">
                            <a href="${dashboardUrl}" style="background-color: #0070f3; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">
                                View Monitoring Dashboard
                            </a>
                        </div>

                        <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;" />

                        <p style="font-size: 12px; color: #666;">
                            Alert ID: ${alert.id}<br />
                            Time: ${new Date(alert.createdAt).toLocaleString()}<br />
                            Tenant: ${tenant.companyName}
                        </p>
                    </div>
                </div>
            `;

            // Send email to all users with notifications enabled
            const emailPromises = tenant.User.map((user: any) =>
                NotificationSender.sendEmail(
                    user.email,
                    `[PricePilot Alert] ${alert.title}`,
                    html
                ).catch((error) => {
                    console.error(`Failed to send alert email to ${user.email}:`, error);
                })
            );

            await Promise.allSettled(emailPromises);
        } catch (error) {
            console.error('Failed to send email notification:', error);
            // Don't throw - notification failures should not break alerting
        }
    }

    /**
     * Send webhook notification
     *
     * Requirements: 12.4, 12.6
     *
     * @param alert - The alert to send
     * @param tenant - The tenant configuration
     * @param siteName - The competitor site name
     */
    private async sendWebhookNotification(alert: any, tenant: any, siteName: string): Promise<void> {
        try {
            // TODO: Get webhook URL from tenant configuration
            // For now, check environment variable
            const webhookUrl = process.env.SCRAPING_ALERT_WEBHOOK_URL;

            if (!webhookUrl) {
                return; // No webhook configured
            }

            // Build webhook payload with context (Requirement 12.6)
            const payload = {
                alertId: alert.id,
                tenantId: alert.tenantId,
                tenantName: tenant.companyName,
                severity: alert.severity,
                type: alert.type,
                title: alert.title,
                message: alert.message,
                competitorSite: siteName,
                metadata: alert.metadata,
                timestamp: alert.createdAt,
            };

            // Send webhook request
            const response = await fetch(webhookUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'User-Agent': 'PricePilot-AlertService/1.0',
                },
                body: JSON.stringify(payload),
            });

            if (!response.ok) {
                console.error(`Webhook request failed: ${response.status} ${response.statusText}`);
            }
        } catch (error) {
            console.error('Failed to send webhook notification:', error);
            // Don't throw - notification failures should not break alerting
        }
    }

    /**
     * Build context details HTML for email
     *
     * Requirements: 12.6
     *
     * @param metadata - The alert metadata
     * @param siteName - The competitor site name
     * @returns HTML string with context details
     */
    private buildContextDetails(metadata: Record<string, any>, siteName: string): string {
        let details = '<h3>Details</h3><ul style="line-height: 1.8;">';

        details += `<li><strong>Competitor Site:</strong> ${siteName}</li>`;

        if (metadata.successRate !== undefined) {
            details += `<li><strong>Current Success Rate:</strong> ${metadata.successRate.toFixed(1)}%</li>`;
        }

        if (metadata.threshold !== undefined) {
            details += `<li><strong>Threshold:</strong> ${metadata.threshold}%</li>`;
        }

        if (metadata.recentAttempts !== undefined) {
            details += `<li><strong>Recent Attempts:</strong> ${metadata.recentAttempts}</li>`;
        }

        if (metadata.recentCaptchas !== undefined) {
            details += `<li><strong>CAPTCHA Detections:</strong> ${metadata.recentCaptchas}</li>`;
        }

        if (metadata.totalProxies !== undefined) {
            details += `<li><strong>Total Proxies:</strong> ${metadata.totalProxies}</li>`;
        }

        if (metadata.blockedProxies !== undefined) {
            details += `<li><strong>Blocked Proxies:</strong> ${metadata.blockedProxies}</li>`;
        }

        if (metadata.earliestAvailable) {
            const availableTime = new Date(metadata.earliestAvailable).toLocaleString();
            details += `<li><strong>Next Available:</strong> ${availableTime}</li>`;
        }

        details += '</ul>';

        return details;
    }

    /**
     * Get color for alert severity
     *
     * @param severity - The alert severity
     * @returns Hex color code
     */
    private getSeverityColor(severity: string): string {
        switch (severity) {
            case 'critical':
                return '#dc2626'; // Red
            case 'warning':
                return '#f59e0b'; // Amber
            case 'info':
                return '#3b82f6'; // Blue
            default:
                return '#6b7280'; // Gray
        }
    }
}

// Export singleton instance
// Lazy proxy avoids import-time side effects in build/dev workers.
let alertInstance: AlertService | null = null;
export const alertService = new Proxy({} as AlertService, {
    get(_target, property) {
        if (!alertInstance) {
            alertInstance = new AlertService();
        }
        const value = (alertInstance as any)[property];
        return typeof value === "function" ? value.bind(alertInstance) : value;
    },
});
