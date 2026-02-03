/**
 * Email Notification Service for Monitoring Alerts
 * 
 * Sends alert notifications via email with severity-based formatting,
 * comprehensive alert details, and retry logic with exponential backoff.
 * 
 * Features:
 * - HTML and text email templates
 * - Severity-based color coding
 * - Dashboard links and remediation steps
 * - Retry logic with exponential backoff (3 attempts: 1s, 2s, 4s)
 * - Graceful error handling
 * 
 * Requirements: 4.1, 4.2, 4.3, 4.4, 4.6
 * 
 * @module lib/services/monitoring/email-notification
 */

import { NotificationSender } from '../notification-sender';
import { logger } from '@/lib/logger';
import type { TriggeredAlert } from './alert-rules-evaluator';

/**
 * Email content structure
 */
export interface EmailContent {
    subject: string;
    htmlBody: string;
    textBody: string;
}

/**
 * Email Notification Service Interface
 */
export interface IEmailNotificationService {
    sendAlert(alert: TriggeredAlert, recipients: string[]): Promise<boolean>;
    formatAlertEmail(alert: TriggeredAlert): EmailContent;
}

/**
 * Email Notification Service Implementation
 */
export class EmailNotificationService implements IEmailNotificationService {
    private readonly maxRetries = 3;
    private readonly retryDelays = [1000, 2000, 4000]; // 1s, 2s, 4s

    /**
     * Send alert notification via email with retry logic
     * 
     * Requirements: 4.1, 4.6
     * 
     * @param alert - Triggered alert information
     * @param recipients - Array of email addresses
     * @returns True if email sent successfully to at least one recipient
     */
    async sendAlert(alert: TriggeredAlert, recipients: string[]): Promise<boolean> {
        if (!recipients || recipients.length === 0) {
            logger.warn('No recipients provided for alert email', {
                ruleId: alert.ruleId,
                ruleName: alert.ruleName,
            });
            return false;
        }

        const emailContent = this.formatAlertEmail(alert);
        let successCount = 0;

        // Send to each recipient with retry logic
        for (const recipient of recipients) {
            const success = await this.sendWithRetry(
                recipient,
                emailContent.subject,
                emailContent.htmlBody,
                alert
            );

            if (success) {
                successCount++;
            }
        }

        const allSuccess = successCount === recipients.length;
        const partialSuccess = successCount > 0;

        if (allSuccess) {
            logger.info('Alert email sent successfully to all recipients', {
                ruleId: alert.ruleId,
                ruleName: alert.ruleName,
                recipientCount: recipients.length,
            });
        } else if (partialSuccess) {
            logger.warn('Alert email sent to some recipients', {
                ruleId: alert.ruleId,
                ruleName: alert.ruleName,
                successCount,
                totalCount: recipients.length,
            });
        } else {
            logger.error('Failed to send alert email to any recipient', {
                ruleId: alert.ruleId,
                ruleName: alert.ruleName,
                recipientCount: recipients.length,
            });
        }

        return partialSuccess;
    }

    /**
     * Format alert as email content
     * 
     * Requirements: 4.2, 4.3, 4.4
     * 
     * @param alert - Triggered alert information
     * @returns Email content with subject, HTML body, and text body
     */
    formatAlertEmail(alert: TriggeredAlert): EmailContent {
        const isResolution = alert.context.isResolution === true;
        const severityLabel = isResolution ? 'RESOLVED' : this.getSeverityLabel(alert.severity);
        const severityColor = isResolution ? '#10b981' : this.getSeverityColor(alert.severity); // Green for resolution
        const dashboardUrl = this.getDashboardUrl();
        const remediationSteps = isResolution ? [] : this.getRemediationSteps(alert);

        // Format timestamp
        const timestamp = alert.triggeredAt.toLocaleString('en-US', {
            dateStyle: 'full',
            timeStyle: 'long',
        });

        const resolvedTimestamp = isResolution && alert.context.resolvedAt
            ? new Date(alert.context.resolvedAt).toLocaleString('en-US', {
                dateStyle: 'full',
                timeStyle: 'long',
            })
            : null;

        // Build subject line
        const subject = isResolution
            ? `[RESOLVED] PricePilot Alert: ${alert.ruleName}`
            : `[${severityLabel}] PricePilot Alert: ${alert.ruleName}`;

        // Build HTML body
        const htmlBody = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${subject}</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
    
    <!-- Alert Header -->
    <div style="background-color: ${severityColor}; color: white; padding: 20px; border-radius: 8px 8px 0 0; margin-bottom: 0;">
        <h1 style="margin: 0; font-size: 24px; font-weight: 600;">
            ${isResolution ? '✅' : this.getSeverityIcon(alert.severity)} ${severityLabel} ${isResolution ? '' : 'Alert'}
        </h1>
    </div>
    
    <!-- Alert Body -->
    <div style="background-color: #f9f9f9; padding: 20px; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 8px 8px;">
        
        <!-- Alert Name -->
        <h2 style="margin-top: 0; margin-bottom: 16px; font-size: 20px; color: #1a1a1a;">
            ${alert.ruleName}
        </h2>
        
        ${isResolution ? `
        <!-- Resolution Message -->
        <div style="background-color: #d1fae5; border-left: 4px solid #10b981; padding: 16px; margin-bottom: 20px; border-radius: 4px;">
            <p style="margin: 0; color: #065f46; font-weight: 600;">
                ✅ This alert has been resolved. The monitored condition has returned to normal levels.
            </p>
        </div>
        ` : ''}
        
        <!-- Alert Details -->
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px; background-color: white; border-radius: 4px; overflow: hidden;">
            ${isResolution ? `
            <tr>
                <td style="padding: 12px; border-bottom: 1px solid #e0e0e0; background-color: #f5f5f5; font-weight: 600; width: 40%;">
                    Status
                </td>
                <td style="padding: 12px; border-bottom: 1px solid #e0e0e0;">
                    <span style="background-color: ${severityColor}; color: white; padding: 4px 12px; border-radius: 4px; font-size: 12px; font-weight: 600;">
                        RESOLVED
                    </span>
                </td>
            </tr>
            <tr>
                <td style="padding: 12px; border-bottom: 1px solid #e0e0e0; background-color: #f5f5f5; font-weight: 600;">
                    Resolved At
                </td>
                <td style="padding: 12px; border-bottom: 1px solid #e0e0e0;">
                    ${resolvedTimestamp}
                </td>
            </tr>
            ` : `
            <tr>
                <td style="padding: 12px; border-bottom: 1px solid #e0e0e0; background-color: #f5f5f5; font-weight: 600; width: 40%;">
                    Severity
                </td>
                <td style="padding: 12px; border-bottom: 1px solid #e0e0e0;">
                    <span style="background-color: ${severityColor}; color: white; padding: 4px 12px; border-radius: 4px; font-size: 12px; font-weight: 600;">
                        ${severityLabel}
                    </span>
                </td>
            </tr>
            `}
            <tr>
                <td style="padding: 12px; border-bottom: 1px solid #e0e0e0; background-color: #f5f5f5; font-weight: 600;">
                    ${isResolution ? 'Originally Triggered At' : 'Triggered At'}
                </td>
                <td style="padding: 12px; border-bottom: 1px solid #e0e0e0;">
                    ${timestamp}
                </td>
            </tr>
            ${!isResolution ? `
            <tr>
                <td style="padding: 12px; border-bottom: 1px solid #e0e0e0; background-color: #f5f5f5; font-weight: 600;">
                    Metric Value
                </td>
                <td style="padding: 12px; border-bottom: 1px solid #e0e0e0;">
                    <strong style="font-size: 18px; color: ${severityColor};">${this.formatMetricValue(alert.metricValue, alert.context.metricType)}</strong>
                </td>
            </tr>
            <tr>
                <td style="padding: 12px; border-bottom: 1px solid #e0e0e0; background-color: #f5f5f5; font-weight: 600;">
                    Threshold
                </td>
                <td style="padding: 12px; border-bottom: 1px solid #e0e0e0;">
                    ${this.formatMetricValue(alert.threshold, alert.context.metricType)}
                </td>
            </tr>
            ` : ''}
            ${alert.tenantId ? `
            <tr>
                <td style="padding: 12px; border-bottom: 1px solid #e0e0e0; background-color: #f5f5f5; font-weight: 600;">
                    Affected Tenant
                </td>
                <td style="padding: 12px; border-bottom: 1px solid #e0e0e0;">
                    ${alert.tenantId}
                </td>
            </tr>
            ` : ''}
            <tr>
                <td style="padding: 12px; background-color: #f5f5f5; font-weight: 600;">
                    Metric Type
                </td>
                <td style="padding: 12px;">
                    ${alert.context.metricType}
                </td>
            </tr>
        </table>
        
        <!-- Remediation Steps -->
        ${remediationSteps.length > 0 ? `
        <div style="background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 16px; margin-bottom: 20px; border-radius: 4px;">
            <h3 style="margin-top: 0; margin-bottom: 12px; font-size: 16px; color: #856404;">
                📋 Suggested Remediation Steps
            </h3>
            <ol style="margin: 0; padding-left: 20px; color: #856404;">
                ${remediationSteps.map(step => `<li style="margin-bottom: 8px;">${step}</li>`).join('')}
            </ol>
        </div>
        ` : ''}
        
        <!-- Action Button -->
        <div style="text-align: center; margin: 30px 0;">
            <a href="${dashboardUrl}" style="display: inline-block; background-color: #0070f3; color: white; padding: 14px 32px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px;">
                View Monitoring Dashboard
            </a>
        </div>
        
        <!-- Additional Context -->
        ${Object.keys(alert.context).length > 0 ? `
        <details style="margin-top: 20px; padding: 12px; background-color: white; border-radius: 4px; border: 1px solid #e0e0e0;">
            <summary style="cursor: pointer; font-weight: 600; color: #666;">
                Additional Context
            </summary>
            <pre style="margin-top: 12px; padding: 12px; background-color: #f5f5f5; border-radius: 4px; overflow-x: auto; font-size: 12px; color: #333;">${JSON.stringify(alert.context, null, 2)}</pre>
        </details>
        ` : ''}
        
    </div>
    
    <!-- Footer -->
    <div style="margin-top: 20px; padding: 16px; text-align: center; color: #666; font-size: 12px; border-top: 1px solid #e0e0e0;">
        <p style="margin: 0 0 8px 0;">
            This is an automated ${isResolution ? 'resolution notification' : 'alert'} from PricePilot Monitoring System
        </p>
        <p style="margin: 0;">
            To manage alert settings, visit the <a href="${dashboardUrl}" style="color: #0070f3; text-decoration: none;">Monitoring Dashboard</a>
        </p>
    </div>
    
</body>
</html>
        `.trim();

        // Build text body (fallback for email clients that don't support HTML)
        const textBody = isResolution ? `
RESOLVED: ${alert.ruleName}

Status: RESOLVED
Resolved At: ${resolvedTimestamp}
Originally Triggered At: ${timestamp}
${alert.tenantId ? `Affected Tenant: ${alert.tenantId}` : ''}
Metric Type: ${alert.context.metricType}

This alert has been resolved. The monitored condition has returned to normal levels.

View Monitoring Dashboard: ${dashboardUrl}

---
This is an automated resolution notification from PricePilot Monitoring System
        `.trim() : `
${severityLabel} ALERT: ${alert.ruleName}

Triggered At: ${timestamp}
Severity: ${severityLabel}
Metric Value: ${this.formatMetricValue(alert.metricValue, alert.context.metricType)}
Threshold: ${this.formatMetricValue(alert.threshold, alert.context.metricType)}
${alert.tenantId ? `Affected Tenant: ${alert.tenantId}` : ''}
Metric Type: ${alert.context.metricType}

${remediationSteps.length > 0 ? `
SUGGESTED REMEDIATION STEPS:
${remediationSteps.map((step, i) => `${i + 1}. ${step}`).join('\n')}
` : ''}

View Monitoring Dashboard: ${dashboardUrl}

---
This is an automated alert from PricePilot Monitoring System
        `.trim();

        return {
            subject,
            htmlBody,
            textBody,
        };
    }

    /**
     * Send email with retry logic and exponential backoff
     * 
     * Requirement: 4.6
     * 
     * @param recipient - Email address
     * @param subject - Email subject
     * @param htmlBody - Email HTML body
     * @param alert - Alert information for logging
     * @returns True if email sent successfully
     */
    private async sendWithRetry(
        recipient: string,
        subject: string,
        htmlBody: string,
        alert: TriggeredAlert
    ): Promise<boolean> {
        for (let attempt = 0; attempt < this.maxRetries; attempt++) {
            try {
                const success = await NotificationSender.sendEmail(
                    recipient,
                    subject,
                    htmlBody
                );

                if (success) {
                    if (attempt > 0) {
                        logger.info('Alert email sent successfully after retry', {
                            ruleId: alert.ruleId,
                            recipient,
                            attempt: attempt + 1,
                        });
                    }
                    return true;
                }

                // If sendEmail returns false (e.g., notifications disabled), don't retry
                logger.info('Email notifications disabled or user opted out', {
                    ruleId: alert.ruleId,
                    recipient,
                });
                return false;

            } catch (error) {
                const isLastAttempt = attempt === this.maxRetries - 1;

                logger.warn('Failed to send alert email', {
                    ruleId: alert.ruleId,
                    recipient,
                    attempt: attempt + 1,
                    maxRetries: this.maxRetries,
                    error: error instanceof Error ? error.message : String(error),
                    willRetry: !isLastAttempt,
                });

                if (!isLastAttempt) {
                    // Wait before retrying (exponential backoff)
                    await this.sleep(this.retryDelays[attempt]);
                } else {
                    // Final attempt failed
                    logger.error('Failed to send alert email after all retries', {
                        ruleId: alert.ruleId,
                        recipient,
                        totalAttempts: this.maxRetries,
                    });
                    return false;
                }
            }
        }

        return false;
    }

    /**
     * Get severity label for display
     */
    private getSeverityLabel(severity: string): string {
        switch (severity) {
            case 'CRITICAL':
                return 'CRITICAL';
            case 'WARNING':
                return 'WARNING';
            case 'INFO':
                return 'INFO';
            default:
                return severity.toUpperCase();
        }
    }

    /**
     * Get severity color for styling
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

    /**
     * Get remediation steps based on alert type
     * 
     * Requirement: 4.4
     */
    private getRemediationSteps(alert: TriggeredAlert): string[] {
        const metricType = alert.context.metricType;

        // Define remediation steps for common alert types
        const remediationMap: Record<string, string[]> = {
            error: [
                'Check application logs for error details',
                'Review recent deployments or configuration changes',
                'Verify external service availability',
                'Check database connection pool status',
            ],
            response_time: [
                'Check database query performance',
                'Review API endpoint response times',
                'Verify external API latency',
                'Check server resource utilization (CPU, memory)',
                'Consider scaling resources if sustained',
            ],
            scraping_blocked: [
                'Review competitor website changes',
                'Check proxy health and rotation',
                'Verify user-agent and request headers',
                'Consider adjusting scraping rate limits',
                'Review CAPTCHA handling',
            ],
            price_update: [
                'Check user website API connectivity',
                'Verify API token validity',
                'Review price update logs for errors',
                'Check for rate limiting on user website',
                'Verify product data integrity',
            ],
            auth_failure: [
                'Investigate source IP address',
                'Check for brute force attack patterns',
                'Review authentication logs',
                'Consider blocking suspicious IPs',
                'Verify rate limiting is active',
            ],
            db_connection_error: [
                'Check database server status',
                'Verify connection pool configuration',
                'Review database logs for errors',
                'Check network connectivity to database',
                'Consider restarting database connections',
            ],
            redis_connection_error: [
                'Check Redis server status',
                'Verify Redis connection configuration',
                'Review Redis logs for errors',
                'Check network connectivity to Redis',
                'Verify Redis memory usage',
            ],
        };

        // Find matching remediation steps
        for (const [key, steps] of Object.entries(remediationMap)) {
            if (metricType.includes(key)) {
                return steps;
            }
        }

        // Default remediation steps
        return [
            'Review monitoring dashboard for additional context',
            'Check application logs for related errors',
            'Verify system resource utilization',
            'Contact support if issue persists',
        ];
    }

    /**
     * Sleep utility for retry delays
     */
    private sleep(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// Export singleton instance
export const emailNotificationService = new EmailNotificationService();
