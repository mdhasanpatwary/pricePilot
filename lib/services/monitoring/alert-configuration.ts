/**
 * Alert Configuration Service
 *
 * Manages alert rule configuration and maintenance windows.
 * Provides CRUD operations for alert rules with validation.
 *
 * Features:
 * - CRUD operations for alert rules
 * - Configuration validation (thresholds, time windows, channels)
 * - Maintenance window management
 * - PostgreSQL storage
 * - Multi-tenant support
 *
 * Requirements: 7.1, 7.2, 7.3, 7.4, 7.5
 *
 * @module lib/services/monitoring/alert-configuration
 */

import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import type {
    MonitoringAlertSeverity,
    MonitoringConditionOp,
    MonitoringAggregationType,
} from '@prisma/client';
import type { AlertRule, TriggeredAlert } from './alert-rules-evaluator';
import { alertRulesEvaluator } from './alert-rules-evaluator';

/**
 * Maintenance window configuration
 */
export interface MaintenanceWindow {
    id: string;
    name: string;
    description?: string;
    startTime: Date;
    endTime: Date;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
}

/**
 * Alert rule validation error
 */
export interface ValidationError {
    field: string;
    message: string;
}

/**
 * Alert Configuration Service Interface
 */
export interface IAlertConfigurationService {
    listRules(tenantId?: string): Promise<AlertRule[]>;
    getRule(ruleId: string): Promise<AlertRule>;
    createRule(rule: Omit<AlertRule, 'id'>): Promise<AlertRule>;
    updateRule(ruleId: string, updates: Partial<AlertRule>): Promise<AlertRule>;
    deleteRule(ruleId: string): Promise<void>;
    testRule(ruleId: string): Promise<TriggeredAlert | null>;
    setMaintenanceWindow(
        name: string,
        startTime: Date,
        endTime: Date,
        description?: string
    ): Promise<MaintenanceWindow>;
    listMaintenanceWindows(): Promise<MaintenanceWindow[]>;
    deleteMaintenanceWindow(windowId: string): Promise<void>;
}

/**
 * Alert Configuration Service Implementation
 */
export class AlertConfigurationService implements IAlertConfigurationService {
    /**
     * List all alert rules, optionally filtered by tenant
     *
     * Requirement 7.1: Allow administrators to view alert rules
     *
     * @param tenantId - Optional tenant ID to filter rules
     * @returns Array of alert rules
     */
    async listRules(tenantId?: string): Promise<AlertRule[]> {
        try {
            const where = tenantId ? { tenantId } : {};

            const dbRules = await prisma.monitoringAlertRule.findMany({
                where,
                orderBy: [
                    { severity: 'desc' }, // Critical first
                    { name: 'asc' },
                ],
            });

            return dbRules.map((dbRule) => this.convertDbRuleToAlertRule(dbRule));
        } catch (error) {
            logger.error('Failed to list alert rules', {
                error: error instanceof Error ? error.message : String(error),
                tenantId,
            });
            throw new Error('Failed to list alert rules');
        }
    }

    /**
     * Get a specific alert rule by ID
     *
     * @param ruleId - Alert rule ID
     * @returns Alert rule
     * @throws Error if rule not found
     */
    async getRule(ruleId: string): Promise<AlertRule> {
        try {
            const dbRule = await prisma.monitoringAlertRule.findUnique({
                where: { id: ruleId },
            });

            if (!dbRule) {
                throw new Error(`Alert rule not found: ${ruleId}`);
            }

            return this.convertDbRuleToAlertRule(dbRule);
        } catch (error) {
            logger.error('Failed to get alert rule', {
                error: error instanceof Error ? error.message : String(error),
                ruleId,
            });
            throw error;
        }
    }

    /**
     * Create a new alert rule with validation
     *
     * Requirements:
     * - 7.1: Allow administrators to configure alert rules
     * - 7.5: Validate configuration before applying changes
     *
     * @param rule - Alert rule configuration (without id)
     * @returns Created alert rule with id
     * @throws Error if validation fails
     */
    async createRule(rule: Omit<AlertRule, 'id'>): Promise<AlertRule> {
        try {
            // Validate the rule configuration (Requirement 7.5)
            const validationErrors = this.validateRuleConfiguration(rule);
            if (validationErrors.length > 0) {
                const errorMessages = validationErrors
                    .map((e) => `${e.field}: ${e.message}`)
                    .join(', ');
                throw new Error(`Validation failed: ${errorMessages}`);
            }

            // Create the rule using the evaluator
            const createdRule = await alertRulesEvaluator.registerRule(rule);

            logger.info('Created alert rule', {
                ruleId: createdRule.id,
                ruleName: createdRule.name,
            });

            return createdRule;
        } catch (error) {
            logger.error('Failed to create alert rule', {
                error: error instanceof Error ? error.message : String(error),
                ruleName: rule.name,
            });
            throw error;
        }
    }

    /**
     * Update an existing alert rule with validation
     *
     * Requirements:
     * - 7.1: Allow administrators to modify alert rules
     * - 7.2: Allow administrators to enable/disable rules
     * - 7.5: Validate configuration before applying changes
     *
     * @param ruleId - ID of the rule to update
     * @param updates - Partial rule updates
     * @returns Updated alert rule
     * @throws Error if validation fails or rule not found
     */
    async updateRule(
        ruleId: string,
        updates: Partial<AlertRule>
    ): Promise<AlertRule> {
        try {
            // Get existing rule
            const existingRule = await this.getRule(ruleId);

            // Merge updates with existing rule for validation
            const mergedRule = { ...existingRule, ...updates };

            // Validate the merged configuration (Requirement 7.5)
            const validationErrors = this.validateRuleConfiguration(mergedRule);
            if (validationErrors.length > 0) {
                const errorMessages = validationErrors
                    .map((e) => `${e.field}: ${e.message}`)
                    .join(', ');
                throw new Error(`Validation failed: ${errorMessages}`);
            }

            // Update the rule using the evaluator
            const updatedRule = await alertRulesEvaluator.updateRule(ruleId, updates);

            logger.info('Updated alert rule', {
                ruleId,
                ruleName: updatedRule.name,
                updates: Object.keys(updates),
            });

            return updatedRule;
        } catch (error) {
            logger.error('Failed to update alert rule', {
                error: error instanceof Error ? error.message : String(error),
                ruleId,
            });
            throw error;
        }
    }

    /**
     * Delete an alert rule
     *
     * Requirement 7.1: Allow administrators to delete alert rules
     *
     * @param ruleId - ID of the rule to delete
     */
    async deleteRule(ruleId: string): Promise<void> {
        try {
            await prisma.monitoringAlertRule.delete({
                where: { id: ruleId },
            });

            logger.info('Deleted alert rule', {
                ruleId,
            });
        } catch (error) {
            logger.error('Failed to delete alert rule', {
                error: error instanceof Error ? error.message : String(error),
                ruleId,
            });
            throw new Error('Failed to delete alert rule');
        }
    }

    /**
     * Test an alert rule by evaluating it immediately
     *
     * Requirement 7.1: Allow administrators to test alert rules
     *
     * @param ruleId - ID of the rule to test
     * @returns Triggered alert if threshold exceeded, null otherwise
     */
    async testRule(ruleId: string): Promise<TriggeredAlert | null> {
        try {
            const rule = await this.getRule(ruleId);

            logger.info('Testing alert rule', {
                ruleId,
                ruleName: rule.name,
            });

            // Evaluate the rule immediately
            const alert = await alertRulesEvaluator.evaluateRule(rule);

            if (alert) {
                logger.info('Test alert triggered', {
                    ruleId,
                    ruleName: rule.name,
                    metricValue: alert.metricValue,
                    threshold: alert.threshold,
                });
            } else {
                logger.info('Test alert not triggered (threshold not exceeded)', {
                    ruleId,
                    ruleName: rule.name,
                });
            }

            return alert;
        } catch (error) {
            logger.error('Failed to test alert rule', {
                error: error instanceof Error ? error.message : String(error),
                ruleId,
            });
            throw error;
        }
    }

    /**
     * Create or update a maintenance window
     *
     * Requirement 7.4: Allow administrators to set maintenance windows
     *
     * @param name - Window name
     * @param startTime - Start time
     * @param endTime - End time
     * @param description - Optional description
     * @returns Created maintenance window
     */
    async setMaintenanceWindow(
        name: string,
        startTime: Date,
        endTime: Date,
        description?: string
    ): Promise<MaintenanceWindow> {
        try {
            // Validate time range
            if (startTime >= endTime) {
                throw new Error('Start time must be before end time');
            }

            if (endTime <= new Date()) {
                throw new Error('End time must be in the future');
            }

            const window = await prisma.monitoringMaintenanceWindow.create({
                data: {
                    name,
                    description,
                    startTime,
                    endTime,
                    isActive: true,
                },
            });

            logger.info('Created maintenance window', {
                windowId: window.id,
                name,
                startTime,
                endTime,
            });

            return {
                id: window.id,
                name: window.name,
                description: window.description ?? undefined,
                startTime: window.startTime,
                endTime: window.endTime,
                isActive: window.isActive,
                createdAt: window.createdAt,
                updatedAt: window.updatedAt,
            };
        } catch (error) {
            logger.error('Failed to create maintenance window', {
                error: error instanceof Error ? error.message : String(error),
                name,
            });
            throw error;
        }
    }

    /**
     * List all maintenance windows
     *
     * @returns Array of maintenance windows
     */
    async listMaintenanceWindows(): Promise<MaintenanceWindow[]> {
        try {
            const windows = await prisma.monitoringMaintenanceWindow.findMany({
                orderBy: { startTime: 'desc' },
            });

            return windows.map((w) => ({
                id: w.id,
                name: w.name,
                description: w.description ?? undefined,
                startTime: w.startTime,
                endTime: w.endTime,
                isActive: w.isActive,
                createdAt: w.createdAt,
                updatedAt: w.updatedAt,
            }));
        } catch (error) {
            logger.error('Failed to list maintenance windows', {
                error: error instanceof Error ? error.message : String(error),
            });
            throw new Error('Failed to list maintenance windows');
        }
    }

    /**
     * Delete a maintenance window
     *
     * @param windowId - Maintenance window ID
     */
    async deleteMaintenanceWindow(windowId: string): Promise<void> {
        try {
            await prisma.monitoringMaintenanceWindow.delete({
                where: { id: windowId },
            });

            logger.info('Deleted maintenance window', {
                windowId,
            });
        } catch (error) {
            logger.error('Failed to delete maintenance window', {
                error: error instanceof Error ? error.message : String(error),
                windowId,
            });
            throw new Error('Failed to delete maintenance window');
        }
    }

    /**
     * Validate alert rule configuration
     *
     * Requirement 7.5: Validate configuration before applying changes
     *
     * @param rule - Alert rule to validate
     * @returns Array of validation errors (empty if valid)
     */
    private validateRuleConfiguration(
        rule: Omit<AlertRule, 'id'> | AlertRule
    ): ValidationError[] {
        const errors: ValidationError[] = [];

        // Validate name
        if (!rule.name || rule.name.trim().length === 0) {
            errors.push({
                field: 'name',
                message: 'Name is required',
            });
        }

        if (rule.name && rule.name.length > 255) {
            errors.push({
                field: 'name',
                message: 'Name must be 255 characters or less',
            });
        }

        // Validate severity
        const validSeverities: MonitoringAlertSeverity[] = [
            'CRITICAL',
            'WARNING',
            'INFO',
        ];
        if (!validSeverities.includes(rule.severity)) {
            errors.push({
                field: 'severity',
                message: `Severity must be one of: ${validSeverities.join(', ')}`,
            });
        }

        // Validate metric type
        if (!rule.metricType || rule.metricType.trim().length === 0) {
            errors.push({
                field: 'metricType',
                message: 'Metric type is required',
            });
        }

        // Validate time window
        if (rule.timeWindow <= 0) {
            errors.push({
                field: 'timeWindow',
                message: 'Time window must be greater than 0',
            });
        }

        if (rule.timeWindow > 86400) {
            // 24 hours
            errors.push({
                field: 'timeWindow',
                message: 'Time window must be 24 hours or less',
            });
        }

        // Validate threshold
        if (typeof rule.threshold !== 'number') {
            errors.push({
                field: 'threshold',
                message: 'Threshold must be a number',
            });
        }

        // Validate condition operator
        const validOperators: MonitoringConditionOp[] = [
            'GT',
            'GTE',
            'LT',
            'LTE',
            'EQ',
        ];
        if (!validOperators.includes(rule.condition.operator)) {
            errors.push({
                field: 'condition.operator',
                message: `Operator must be one of: ${validOperators.join(', ')}`,
            });
        }

        // Validate condition aggregation
        const validAggregations: MonitoringAggregationType[] = [
            'COUNT',
            'AVG',
            'SUM',
            'MAX',
            'MIN',
            'P95',
            'P99',
        ];
        if (!validAggregations.includes(rule.condition.aggregation)) {
            errors.push({
                field: 'condition.aggregation',
                message: `Aggregation must be one of: ${validAggregations.join(', ')}`,
            });
        }

        // Validate notification channels
        if (!Array.isArray(rule.notificationChannels)) {
            errors.push({
                field: 'notificationChannels',
                message: 'Notification channels must be an array',
            });
        }

        return errors;
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
}

/**
 * Export singleton instance
 */
export const alertConfigurationService = new AlertConfigurationService();
