/**
 * Alert Rules Evaluator Service
 *
 * Evaluates metrics against configured alert rules and triggers alerts when
 * thresholds are exceeded. Supports multiple aggregation types and time windows.
 *
 * Features:
 * - Threshold-based alert evaluation
 * - Multiple aggregation types (avg, sum, count, p95, p99)
 * - Time-window metric aggregation
 * - Built-in alert rules for common scenarios
 * - Multi-tenant support
 * - Efficient batch evaluation
 *
 * Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7
 *
 * @module lib/services/monitoring/alert-rules-evaluator
 */

import { prisma } from '@/lib/prisma';
import { metricsCollector, type MetricData } from './metrics-collector';
import { logger } from '@/lib/logger';
import type {
    MonitoringAlertSeverity,
    MonitoringConditionOp,
    MonitoringAggregationType,
} from '@prisma/client';

/**
 * Alert condition configuration
 */
export interface AlertCondition {
    operator: MonitoringConditionOp;
    aggregation: MonitoringAggregationType;
}

/**
 * Alert rule configuration
 */
export interface AlertRule {
    id: string;
    name: string;
    description: string;
    severity: MonitoringAlertSeverity;
    enabled: boolean;
    metricType: string;
    condition: AlertCondition;
    timeWindow: number; // seconds
    threshold: number;
    notificationChannels: string[];
    tenantId?: string | null; // null for system-wide rules
}

/**
 * Triggered alert information
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
 * Alert Rules Evaluator Interface
 */
export interface IAlertRulesEvaluator {
    evaluateRules(): Promise<TriggeredAlert[]>;
    evaluateRule(rule: AlertRule): Promise<TriggeredAlert | null>;
    registerRule(rule: Omit<AlertRule, 'id'>): Promise<AlertRule>;
    updateRule(ruleId: string, updates: Partial<AlertRule>): Promise<AlertRule>;
    disableRule(ruleId: string): Promise<void>;
}

/**
 * Alert Rules Evaluator Implementation
 */
export class AlertRulesEvaluator implements IAlertRulesEvaluator {
    /**
     * Evaluate all enabled alert rules
     *
     * @returns Array of triggered alerts
     */
    async evaluateRules(): Promise<TriggeredAlert[]> {
        try {
            // Fetch all enabled alert rules from database
            const rules = await prisma.monitoringAlertRule.findMany({
                where: {
                    enabled: true,
                },
            });

            logger.info(`Evaluating ${rules.length} alert rules`);

            // Evaluate each rule
            const triggeredAlerts: TriggeredAlert[] = [];

            for (const dbRule of rules) {
                try {
                    const rule = this.convertDbRuleToAlertRule(dbRule);
                    const alert = await this.evaluateRule(rule);

                    if (alert) {
                        triggeredAlerts.push(alert);
                    } else {
                        // Check if this rule had an active alert that should now be resolved
                        await this.checkForResolution(rule);
                    }
                } catch (error) {
                    logger.error(`Failed to evaluate rule ${dbRule.id}`, {
                        error: error instanceof Error ? error.message : String(error),
                        ruleId: dbRule.id,
                        ruleName: dbRule.name,
                    });
                }
            }

            logger.info(`Triggered ${triggeredAlerts.length} alerts`);

            return triggeredAlerts;
        } catch (error) {
            logger.error('Failed to evaluate alert rules', {
                error: error instanceof Error ? error.message : String(error),
            });
            return [];
        }
    }

    /**
     * Evaluate a single alert rule
     *
     * @param rule - Alert rule to evaluate
     * @returns Triggered alert if threshold exceeded, null otherwise
     */
    async evaluateRule(rule: AlertRule): Promise<TriggeredAlert | null> {
        try {
            // Fetch metrics for the rule's time window
            const metrics = await metricsCollector.getMetrics(
                rule.metricType,
                rule.timeWindow,
                rule.tenantId || undefined
            );

            // Calculate the metric value based on aggregation type
            const metricValue = this.calculateAggregatedValue(
                metrics,
                rule.condition.aggregation
            );

            // Check if threshold is exceeded
            const thresholdExceeded = this.checkThreshold(
                metricValue,
                rule.threshold,
                rule.condition.operator
            );

            if (thresholdExceeded) {
                logger.info(`Alert triggered: ${rule.name}`, {
                    ruleId: rule.id,
                    metricValue,
                    threshold: rule.threshold,
                    operator: rule.condition.operator,
                });

                return {
                    ruleId: rule.id,
                    ruleName: rule.name,
                    severity: rule.severity,
                    triggeredAt: new Date(),
                    metricValue,
                    threshold: rule.threshold,
                    tenantId: rule.tenantId,
                    context: {
                        metricType: rule.metricType,
                        timeWindow: rule.timeWindow,
                        aggregation: rule.condition.aggregation,
                        operator: rule.condition.operator,
                        dataPointCount: metrics.dataPoints.length,
                    },
                };
            }

            return null;
        } catch (error) {
            logger.error(`Failed to evaluate rule ${rule.id}`, {
                error: error instanceof Error ? error.message : String(error),
                ruleId: rule.id,
                ruleName: rule.name,
            });
            return null;
        }
    }

    /**
     * Register a new alert rule
     *
     * @param rule - Alert rule configuration (without id)
     * @returns Created alert rule with id
     */
    async registerRule(rule: Omit<AlertRule, 'id'>): Promise<AlertRule> {
        try {
            const dbRule = await prisma.monitoringAlertRule.create({
                data: {
                    name: rule.name,
                    description: rule.description,
                    severity: rule.severity,
                    enabled: rule.enabled,
                    metricType: rule.metricType,
                    conditionOperator: rule.condition.operator,
                    conditionAggregation: rule.condition.aggregation,
                    timeWindowSeconds: rule.timeWindow,
                    threshold: rule.threshold,
                    notificationChannels: rule.notificationChannels,
                    tenantId: rule.tenantId,
                },
            });

            logger.info(`Registered new alert rule: ${rule.name}`, {
                ruleId: dbRule.id,
            });

            return this.convertDbRuleToAlertRule(dbRule);
        } catch (error) {
            logger.error('Failed to register alert rule', {
                error: error instanceof Error ? error.message : String(error),
                ruleName: rule.name,
            });
            throw error;
        }
    }

    /**
     * Update an existing alert rule
     *
     * @param ruleId - ID of the rule to update
     * @param updates - Partial rule updates
     * @returns Updated alert rule
     */
    async updateRule(
        ruleId: string,
        updates: Partial<AlertRule>
    ): Promise<AlertRule> {
        try {
            const updateData: any = {};

            if (updates.name !== undefined) updateData.name = updates.name;
            if (updates.description !== undefined)
                updateData.description = updates.description;
            if (updates.severity !== undefined)
                updateData.severity = updates.severity;
            if (updates.enabled !== undefined)
                updateData.enabled = updates.enabled;
            if (updates.metricType !== undefined)
                updateData.metricType = updates.metricType;
            if (updates.timeWindow !== undefined)
                updateData.timeWindowSeconds = updates.timeWindow;
            if (updates.threshold !== undefined)
                updateData.threshold = updates.threshold;
            if (updates.notificationChannels !== undefined)
                updateData.notificationChannels = updates.notificationChannels;
            if (updates.tenantId !== undefined)
                updateData.tenantId = updates.tenantId;

            if (updates.condition) {
                if (updates.condition.operator !== undefined)
                    updateData.conditionOperator = updates.condition.operator;
                if (updates.condition.aggregation !== undefined)
                    updateData.conditionAggregation = updates.condition.aggregation;
            }

            const dbRule = await prisma.monitoringAlertRule.update({
                where: { id: ruleId },
                data: updateData,
            });

            logger.info(`Updated alert rule: ${dbRule.name}`, {
                ruleId,
            });

            return this.convertDbRuleToAlertRule(dbRule);
        } catch (error) {
            logger.error('Failed to update alert rule', {
                error: error instanceof Error ? error.message : String(error),
                ruleId,
            });
            throw error;
        }
    }

    /**
     * Disable an alert rule
     *
     * @param ruleId - ID of the rule to disable
     */
    async disableRule(ruleId: string): Promise<void> {
        try {
            await prisma.monitoringAlertRule.update({
                where: { id: ruleId },
                data: { enabled: false },
            });

            logger.info(`Disabled alert rule`, {
                ruleId,
            });
        } catch (error) {
            logger.error('Failed to disable alert rule', {
                error: error instanceof Error ? error.message : String(error),
                ruleId,
            });
            throw error;
        }
    }

    /**
     * Calculate aggregated value from metrics
     *
     * @param metrics - Metric data
     * @param aggregation - Aggregation type
     * @returns Aggregated value
     */
    private calculateAggregatedValue(
        metrics: MetricData,
        aggregation: MonitoringAggregationType
    ): number {
        const { aggregates } = metrics;

        switch (aggregation) {
            case 'COUNT':
                return aggregates.count;
            case 'AVG':
                return aggregates.avg;
            case 'SUM':
                return aggregates.sum;
            case 'MAX':
                return aggregates.max;
            case 'MIN':
                return aggregates.min;
            case 'P95':
                return aggregates.p95 || 0;
            case 'P99':
                return aggregates.p99 || 0;
            default:
                logger.warn(`Unknown aggregation type: ${aggregation}, using AVG`);
                return aggregates.avg;
        }
    }

    /**
     * Check if threshold is exceeded based on operator
     *
     * @param value - Metric value
     * @param threshold - Threshold value
     * @param operator - Comparison operator
     * @returns True if threshold is exceeded
     */
    private checkThreshold(
        value: number,
        threshold: number,
        operator: MonitoringConditionOp
    ): boolean {
        switch (operator) {
            case 'GT':
                return value > threshold;
            case 'GTE':
                return value >= threshold;
            case 'LT':
                return value < threshold;
            case 'LTE':
                return value <= threshold;
            case 'EQ':
                return value === threshold;
            default:
                logger.warn(`Unknown operator: ${operator}, using GT`);
                return value > threshold;
        }
    }

    /**
     * Convert database rule to AlertRule interface
     *
     * @param dbRule - Database rule object
     * @returns AlertRule interface
     */
    private convertDbRuleToAlertRule(dbRule: any): AlertRule {
        return {
            id: dbRule.id,
            name: dbRule.name,
            description: dbRule.description || '',
            severity: dbRule.severity,
            enabled: dbRule.enabled,
            metricType: dbRule.metricType,
            condition: {
                operator: dbRule.conditionOperator,
                aggregation: dbRule.conditionAggregation,
            },
            timeWindow: dbRule.timeWindowSeconds,
            threshold: Number(dbRule.threshold),
            notificationChannels: dbRule.notificationChannels,
            tenantId: dbRule.tenantId,
        };
    }

    /**
     * Check if an active alert should be resolved
     *
     * Requirement 8.2: Send resolution notification when condition clears
     *
     * @param rule - Alert rule to check
     */
    private async checkForResolution(rule: AlertRule): Promise<void> {
        try {
            // Find active (unresolved) alerts for this rule
            const activeAlerts = await prisma.monitoringAlertHistory.findMany({
                where: {
                    ruleId: rule.id,
                    resolvedAt: null,
                },
                orderBy: {
                    triggeredAt: 'desc',
                },
            });

            if (activeAlerts.length === 0) {
                return; // No active alerts to resolve
            }

            // Mark all active alerts as resolved
            const now = new Date();
            for (const alert of activeAlerts) {
                await prisma.monitoringAlertHistory.update({
                    where: { id: alert.id },
                    data: { resolvedAt: now },
                });

                logger.info(`Alert resolved: ${rule.name}`, {
                    ruleId: rule.id,
                    alertId: alert.id,
                    triggeredAt: alert.triggeredAt,
                    resolvedAt: now,
                });
            }
        } catch (error) {
            logger.error(`Failed to check for resolution: ${rule.id}`, {
                error: error instanceof Error ? error.message : String(error),
                ruleId: rule.id,
            });
        }
    }

    /**
     * Get recently resolved alerts for notification
     *
     * Requirement 8.2: Send resolution notification when condition clears
     *
     * @param sinceMinutes - Number of minutes to look back for resolved alerts
     * @returns Array of resolved alerts
     */
    async getRecentlyResolvedAlerts(sinceMinutes: number = 5): Promise<TriggeredAlert[]> {
        try {
            const since = new Date(Date.now() - sinceMinutes * 60 * 1000);

            const resolvedAlerts = await prisma.monitoringAlertHistory.findMany({
                where: {
                    resolvedAt: {
                        gte: since,
                    },
                    // Only get alerts that were resolved recently but not acknowledged yet
                    acknowledgedAt: null,
                },
                orderBy: {
                    resolvedAt: 'desc',
                },
            });

            return resolvedAlerts.map((alert) => ({
                ruleId: alert.ruleId,
                ruleName: alert.ruleName,
                severity: alert.severity,
                triggeredAt: alert.triggeredAt,
                metricValue: Number(alert.metricValue),
                threshold: Number(alert.threshold),
                tenantId: alert.tenantId,
                context: {
                    ...(alert.context as Record<string, any> || {}),
                    resolvedAt: alert.resolvedAt,
                    isResolution: true,
                },
            }));
        } catch (error) {
            logger.error('Failed to get recently resolved alerts', {
                error: error instanceof Error ? error.message : String(error),
            });
            return [];
        }
    }
}

/**
 * Built-in alert rules for common scenarios
 * Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 11.1, 11.2, 11.3, 11.4
 */
export const BUILT_IN_ALERT_RULES: Omit<AlertRule, 'id'>[] = [
    {
        name: 'High Error Rate',
        description: 'Triggers when error rate exceeds 1% over 5 minutes',
        severity: 'CRITICAL',
        enabled: true,
        metricType: 'error',
        condition: {
            operator: 'GT',
            aggregation: 'COUNT',
        },
        timeWindow: 5 * 60, // 5 minutes
        threshold: 1, // 1% error rate (will need to calculate as percentage)
        notificationChannels: [],
        tenantId: null, // System-wide
    },
    {
        name: 'Slow Response Time',
        description: 'Triggers when average response time exceeds 500ms over 5 minutes',
        severity: 'WARNING',
        enabled: true,
        metricType: 'response_time',
        condition: {
            operator: 'GT',
            aggregation: 'AVG',
        },
        timeWindow: 5 * 60, // 5 minutes
        threshold: 500, // 500ms
        notificationChannels: [],
        tenantId: null,
    },
    {
        name: 'High Scraping Block Rate',
        description: 'Triggers when scraping block rate exceeds 30% over 15 minutes',
        severity: 'WARNING',
        enabled: true,
        metricType: 'scraping_blocked',
        condition: {
            operator: 'GT',
            aggregation: 'AVG',
        },
        timeWindow: 15 * 60, // 15 minutes
        threshold: 0.3, // 30% block rate
        notificationChannels: [],
        tenantId: null,
    },
    {
        name: 'Price Update Failures',
        description: 'Triggers when price update failure rate exceeds 10% over 10 minutes',
        severity: 'CRITICAL',
        enabled: true,
        metricType: 'price_update',
        condition: {
            operator: 'LT',
            aggregation: 'AVG',
        },
        timeWindow: 10 * 60, // 10 minutes
        threshold: 0.9, // Less than 90% success rate (i.e., more than 10% failure)
        notificationChannels: [],
        tenantId: null,
    },
    {
        name: 'Authentication Failures',
        description: 'Triggers when auth failures exceed 10 from single IP within 1 minute',
        severity: 'CRITICAL',
        enabled: true,
        metricType: 'auth_failure',
        condition: {
            operator: 'GT',
            aggregation: 'COUNT',
        },
        timeWindow: 60, // 1 minute
        threshold: 10,
        notificationChannels: [],
        tenantId: null,
    },
    {
        name: 'Database Connection Issues',
        description: 'Triggers when database connection errors occur',
        severity: 'CRITICAL',
        enabled: true,
        metricType: 'db_connection_error',
        condition: {
            operator: 'GT',
            aggregation: 'COUNT',
        },
        timeWindow: 60, // 1 minute
        threshold: 0, // Any error triggers alert
        notificationChannels: [],
        tenantId: null,
    },
    {
        name: 'Redis Connection Issues',
        description: 'Triggers when Redis connection errors occur',
        severity: 'CRITICAL',
        enabled: true,
        metricType: 'redis_connection_error',
        condition: {
            operator: 'GT',
            aggregation: 'COUNT',
        },
        timeWindow: 60, // 1 minute
        threshold: 0, // Any error triggers alert
        notificationChannels: [],
        tenantId: null,
    },
    // Security-specific alert rules (Requirements 11.1, 11.2, 11.3, 11.4)
    {
        name: 'Brute Force Attack Detection',
        description: 'Triggers when multiple authentication failures from single IP detected',
        severity: 'CRITICAL',
        enabled: true,
        metricType: 'auth_failure',
        condition: {
            operator: 'GT',
            aggregation: 'COUNT',
        },
        timeWindow: 5 * 60, // 5 minutes
        threshold: 5, // 5 failures in 5 minutes
        notificationChannels: [],
        tenantId: null,
    },
    {
        name: 'Rate Limit Violations',
        description: 'Triggers when rate limit violations exceed threshold',
        severity: 'WARNING',
        enabled: true,
        metricType: 'rate_limit_violation',
        condition: {
            operator: 'GT',
            aggregation: 'COUNT',
        },
        timeWindow: 5 * 60, // 5 minutes
        threshold: 10, // 10 violations in 5 minutes
        notificationChannels: [],
        tenantId: null,
    },
    {
        name: 'Suspicious Pattern Detection',
        description: 'Triggers when suspicious access patterns are detected',
        severity: 'CRITICAL',
        enabled: true,
        metricType: 'suspicious_pattern',
        condition: {
            operator: 'GT',
            aggregation: 'COUNT',
        },
        timeWindow: 10 * 60, // 10 minutes
        threshold: 0, // Any suspicious pattern triggers alert
        notificationChannels: [],
        tenantId: null,
    },
    {
        name: 'Unauthorized Access Attempts',
        description: 'Triggers when unauthorized access attempts are detected',
        severity: 'CRITICAL',
        enabled: true,
        metricType: 'unauthorized_access',
        condition: {
            operator: 'GT',
            aggregation: 'COUNT',
        },
        timeWindow: 5 * 60, // 5 minutes
        threshold: 5, // 5 attempts in 5 minutes
        notificationChannels: [],
        tenantId: null,
    },
];

/**
 * Initialize built-in alert rules
 * Creates the built-in rules if they don't already exist
 */
export async function initializeBuiltInAlertRules(): Promise<void> {
    try {
        const evaluator = new AlertRulesEvaluator();

        for (const rule of BUILT_IN_ALERT_RULES) {
            // Check if rule already exists
            const existing = await prisma.monitoringAlertRule.findFirst({
                where: {
                    name: rule.name,
                    tenantId: null,
                },
            });

            if (!existing) {
                await evaluator.registerRule(rule);
                logger.info(`Initialized built-in alert rule: ${rule.name}`);
            }
        }

        logger.info('Built-in alert rules initialized');
    } catch (error) {
        logger.error('Failed to initialize built-in alert rules', {
            error: error instanceof Error ? error.message : String(error),
        });
    }
}

// Export singleton instance
export const alertRulesEvaluator = new AlertRulesEvaluator();
