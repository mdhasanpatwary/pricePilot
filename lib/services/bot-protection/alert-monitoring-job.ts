/**
 * Alert Monitoring Job
 * 
 * Periodic job to check success rates against thresholds and trigger alerts.
 * Monitors scraping health and sends notifications when thresholds are breached.
 * 
 * Requirements: 9.4, 12.1, 12.7
 */

import { prisma } from '@/lib/prisma';
import { AlertService, AlertType } from './alert-service';
import { logger } from '@/lib/logger';

export interface AlertThresholds {
    /**
     * Success rate below this triggers a warning alert (%)
     */
    warningThreshold: number;

    /**
     * Success rate below this triggers a critical alert (%)
     */
    criticalThreshold: number;

    /**
     * Success rate above this triggers a recovery notification (%)
     */
    recoveryThreshold: number;

    /**
     * Minimum number of attempts required before checking thresholds
     */
    minAttempts: number;

    /**
     * Time window to check (in hours)
     */
    timeWindowHours: number;
}

const DEFAULT_THRESHOLDS: AlertThresholds = {
    warningThreshold: 50,
    criticalThreshold: 20,
    recoveryThreshold: 80,
    minAttempts: 10,
    timeWindowHours: 1,
};

export interface MonitoringResult {
    sitesChecked: number;
    warningAlertsTriggered: number;
    criticalAlertsTriggered: number;
    recoveryNotificationsSent: number;
    errors: string[];
    executedAt: Date;
    durationMs: number;
}

export class AlertMonitoringJob {
    private alertService: AlertService;
    private thresholds: AlertThresholds;

    constructor(thresholds?: Partial<AlertThresholds>) {
        this.alertService = new AlertService();
        this.thresholds = { ...DEFAULT_THRESHOLDS, ...thresholds };
    }

    /**
     * Execute monitoring job
     * 
     * Checks all active competitor sites for threshold breaches and triggers alerts.
     */
    async execute(): Promise<MonitoringResult> {
        const startTime = Date.now();
        const errors: string[] = [];

        let sitesChecked = 0;
        let warningAlertsTriggered = 0;
        let criticalAlertsTriggered = 0;
        let recoveryNotificationsSent = 0;

        try {
            logger.info('Starting alert monitoring job');

            // Get all active competitor websites
            const websites = await prisma.site.findMany({
                where: {
                    type: 'COMPETITOR',
                },
                select: {
                    id: true,
                    tenantId: true,
                    baseUrl: true,
                },
            });

            logger.info(`Checking ${websites.length} competitor websites`);

            // Check each website
            for (const website of websites) {
                try {
                    await this.checkWebsite(website);
                    sitesChecked++;
                } catch (error) {
                    const errorMsg = `Failed to check website ${website.id}: ${error instanceof Error ? error.message : String(error)
                        }`;
                    errors.push(errorMsg);
                    logger.error(errorMsg, { websiteId: website.id });
                }
            }

            // Get alert counts from this run
            const alertCounts = await this.getRecentAlertCounts();
            warningAlertsTriggered = alertCounts.warning;
            criticalAlertsTriggered = alertCounts.critical;
            recoveryNotificationsSent = alertCounts.recovery;

            logger.info('Alert monitoring job completed', {
                sitesChecked,
                warningAlertsTriggered,
                criticalAlertsTriggered,
                recoveryNotificationsSent,
                errors: errors.length,
            });
        } catch (error) {
            const errorMsg = `Alert monitoring job failed: ${error instanceof Error ? error.message : String(error)
                }`;
            errors.push(errorMsg);
            logger.error(errorMsg);
        }

        const durationMs = Date.now() - startTime;

        return {
            sitesChecked,
            warningAlertsTriggered,
            criticalAlertsTriggered,
            recoveryNotificationsSent,
            errors,
            executedAt: new Date(),
            durationMs,
        };
    }

    /**
     * Check a single website for threshold breaches
     */
    private async checkWebsite(website: {
        id: string;
        tenantId: string;
        baseUrl: string;
    }): Promise<void> {
        // Calculate success rate for the time window
        const endTime = new Date();
        const startTime = new Date(
            endTime.getTime() - this.thresholds.timeWindowHours * 60 * 60 * 1000
        );

        // Get total attempts count
        const totalAttempts = await prisma.scrapeAttempt.count({
            where: {
                competitorWebsiteId: website.id,
                createdAt: {
                    gte: startTime,
                    lt: endTime,
                },
            },
        });

        // Skip if not enough attempts
        if (totalAttempts < this.thresholds.minAttempts) {
            logger.debug('Skipping website - not enough attempts', {
                websiteId: website.id,
                attempts: totalAttempts,
                minRequired: this.thresholds.minAttempts,
            });
            return;
        }

        // Calculate success rate
        const successfulAttempts = await prisma.scrapeAttempt.count({
            where: {
                competitorWebsiteId: website.id,
                createdAt: {
                    gte: startTime,
                    lt: endTime,
                },
                success: true,
            },
        });

        const successRate = (successfulAttempts / totalAttempts) * 100;
        const failedAttempts = totalAttempts - successfulAttempts;

        const stats = {
            successRate,
            totalAttempts,
            failedAttempts,
        };

        // Check if site was previously in alert state
        const previousAlert = await this.getPreviousAlert(website.tenantId, website.id);

        // Determine current state
        if (stats.successRate < this.thresholds.criticalThreshold) {
            // Critical threshold breached
            await this.handleCriticalThreshold(website, stats, previousAlert);
        } else if (stats.successRate < this.thresholds.warningThreshold) {
            // Warning threshold breached
            await this.handleWarningThreshold(website, stats, previousAlert);
        } else if (stats.successRate >= this.thresholds.recoveryThreshold && previousAlert) {
            // Recovery detected
            await this.handleRecovery(website, stats, previousAlert);
        }
    }

    /**
     * Handle critical threshold breach
     */
    private async handleCriticalThreshold(
        website: { id: string; tenantId: string; baseUrl: string },
        stats: { successRate: number; totalAttempts: number; failedAttempts: number },
        previousAlert: any
    ): Promise<void> {
        // Only send alert if no recent critical alert exists
        if (previousAlert?.severity === 'critical') {
            logger.debug('Skipping critical alert - already in critical state', {
                websiteId: website.id,
            });
            return;
        }

        logger.warn('Critical success rate threshold breached', {
            websiteId: website.id,
            successRate: stats.successRate,
            threshold: this.thresholds.criticalThreshold,
        });

        await this.alertService.sendAlert({
            tenantId: website.tenantId,
            severity: 'critical',
            type: AlertType.SUCCESS_RATE_DROP,
            title: `Critical: ${website.baseUrl} scraping severely degraded`,
            message: `Success rate has dropped to ${stats.successRate.toFixed(
                1
            )}% (below ${this.thresholds.criticalThreshold}% threshold). ${stats.failedAttempts
                } of ${stats.totalAttempts} attempts failed in the last ${this.thresholds.timeWindowHours
                } hour(s).`,
            competitorWebsiteId: website.id,
            metadata: {
                successRate: stats.successRate,
                totalAttempts: stats.totalAttempts,
                failedAttempts: stats.failedAttempts,
                threshold: this.thresholds.criticalThreshold,
                timeWindowHours: this.thresholds.timeWindowHours,
            },
        });
    }

    /**
     * Handle warning threshold breach
     */
    private async handleWarningThreshold(
        website: { id: string; tenantId: string; baseUrl: string },
        stats: { successRate: number; totalAttempts: number; failedAttempts: number },
        previousAlert: any
    ): Promise<void> {
        // Only send alert if no recent warning or critical alert exists
        if (previousAlert) {
            logger.debug('Skipping warning alert - already in alert state', {
                websiteId: website.id,
            });
            return;
        }

        logger.warn('Warning success rate threshold breached', {
            websiteId: website.id,
            successRate: stats.successRate,
            threshold: this.thresholds.warningThreshold,
        });

        await this.alertService.sendAlert({
            tenantId: website.tenantId,
            severity: 'warning',
            type: AlertType.HIGH_FAILURE_RATE,
            title: `Warning: ${website.baseUrl} scraping degraded`,
            message: `Success rate has dropped to ${stats.successRate.toFixed(
                1
            )}% (below ${this.thresholds.warningThreshold}% threshold). ${stats.failedAttempts
                } of ${stats.totalAttempts} attempts failed in the last ${this.thresholds.timeWindowHours
                } hour(s).`,
            competitorWebsiteId: website.id,
            metadata: {
                successRate: stats.successRate,
                totalAttempts: stats.totalAttempts,
                failedAttempts: stats.failedAttempts,
                threshold: this.thresholds.warningThreshold,
                timeWindowHours: this.thresholds.timeWindowHours,
            },
        });
    }

    /**
     * Handle recovery from alert state
     */
    private async handleRecovery(
        website: { id: string; tenantId: string; baseUrl: string },
        stats: { successRate: number; totalAttempts: number; failedAttempts: number },
        previousAlert: any
    ): Promise<void> {
        logger.info('Scraping recovered', {
            websiteId: website.id,
            successRate: stats.successRate,
            threshold: this.thresholds.recoveryThreshold,
        });

        await this.alertService.sendAlert({
            tenantId: website.tenantId,
            severity: 'info',
            type: AlertType.SCRAPING_RECOVERED,
            title: `Recovered: ${website.baseUrl} scraping restored`,
            message: `Success rate has recovered to ${stats.successRate.toFixed(
                1
            )}% (above ${this.thresholds.recoveryThreshold}% threshold). Scraping is now operating normally.`,
            competitorWebsiteId: website.id,
            metadata: {
                successRate: stats.successRate,
                totalAttempts: stats.totalAttempts,
                previousSeverity: previousAlert.severity,
                threshold: this.thresholds.recoveryThreshold,
                timeWindowHours: this.thresholds.timeWindowHours,
            },
        });

        // Acknowledge the previous alert
        if (previousAlert?.id) {
            await this.alertService.acknowledgeAlert(previousAlert.id);
        }
    }

    /**
     * Get the most recent unacknowledged alert for a website
     */
    private async getPreviousAlert(
        tenantId: string,
        competitorWebsiteId: string
    ): Promise<any | null> {
        const alert = await prisma.scrapingAlert.findFirst({
            where: {
                tenantId,
                competitorWebsiteId,
                acknowledged: false,
                type: {
                    in: ['success_rate_drop', 'high_failure_rate'],
                },
            },
            orderBy: {
                createdAt: 'desc',
            },
        });

        return alert;
    }

    /**
     * Get counts of alerts triggered in the last run
     */
    private async getRecentAlertCounts(): Promise<{
        warning: number;
        critical: number;
        recovery: number;
    }> {
        const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);

        const [warning, critical, recovery] = await Promise.all([
            prisma.scrapingAlert.count({
                where: {
                    severity: 'warning',
                    createdAt: {
                        gte: fiveMinutesAgo,
                    },
                },
            }),
            prisma.scrapingAlert.count({
                where: {
                    severity: 'critical',
                    createdAt: {
                        gte: fiveMinutesAgo,
                    },
                },
            }),
            prisma.scrapingAlert.count({
                where: {
                    type: 'scraping_recovered',
                    createdAt: {
                        gte: fiveMinutesAgo,
                    },
                },
            }),
        ]);

        return { warning, critical, recovery };
    }

    /**
     * Get monitoring statistics
     * 
     * Returns counts of sites in different states without triggering alerts.
     */
    async getMonitoringStatistics(): Promise<{
        totalSites: number;
        healthySites: number;
        degradedSites: number;
        criticalSites: number;
        insufficientDataSites: number;
    }> {
        const websites = await prisma.site.findMany({
            where: {
                type: 'COMPETITOR',
            },
            select: {
                id: true,
            },
        });

        let healthySites = 0;
        let degradedSites = 0;
        let criticalSites = 0;
        let insufficientDataSites = 0;

        const endTime = new Date();
        const startTime = new Date(
            endTime.getTime() - this.thresholds.timeWindowHours * 60 * 60 * 1000
        );

        for (const website of websites) {
            const totalAttempts = await prisma.scrapeAttempt.count({
                where: {
                    competitorWebsiteId: website.id,
                    createdAt: {
                        gte: startTime,
                        lt: endTime,
                    },
                },
            });

            if (totalAttempts < this.thresholds.minAttempts) {
                insufficientDataSites++;
                continue;
            }

            const successfulAttempts = await prisma.scrapeAttempt.count({
                where: {
                    competitorWebsiteId: website.id,
                    createdAt: {
                        gte: startTime,
                        lt: endTime,
                    },
                    success: true,
                },
            });

            const successRate = (successfulAttempts / totalAttempts) * 100;

            if (successRate < this.thresholds.criticalThreshold) {
                criticalSites++;
            } else if (successRate < this.thresholds.warningThreshold) {
                degradedSites++;
            } else {
                healthySites++;
            }
        }

        return {
            totalSites: websites.length,
            healthySites,
            degradedSites,
            criticalSites,
            insufficientDataSites,
        };
    }
}

/**
 * Run alert monitoring job (for cron execution)
 * 
 * Example cron schedule: every 5 minutes
 */
export async function runAlertMonitoring(): Promise<MonitoringResult> {
    const job = new AlertMonitoringJob();
    const result = await job.execute();

    // Log result
    logger.info('Alert monitoring completed', {
        sitesChecked: result.sitesChecked,
        warningAlertsTriggered: result.warningAlertsTriggered,
        criticalAlertsTriggered: result.criticalAlertsTriggered,
        recoveryNotificationsSent: result.recoveryNotificationsSent,
        durationMs: result.durationMs,
        errors: result.errors.length,
    });

    if (result.errors.length > 0) {
        logger.error('Alert monitoring errors', { errors: result.errors });
    }

    return result;
}
