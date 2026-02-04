/**
 * Configure Critical Alerts Script
 *
 * Sets up critical alert rules for monitoring system health:
 * - High block rate (>30%)
 * - Proxy failures
 * - High error rate (>1%)
 * - Slow response times (>500ms)
 *
 * Task: 17.1 Configure critical alerts
 * Requirements: 2.15.1
 *
 * Usage: npx tsx scripts/configure-critical-alerts.ts
 */

import { prisma } from '../lib/prisma';
import type { MonitoringAlertSeverity } from '@prisma/client';

interface CriticalAlertConfig {
    name: string;
    description: string;
    severity: MonitoringAlertSeverity;
    metricType: string;
    operator: 'GT' | 'GTE' | 'LT' | 'LTE' | 'EQ';
    aggregation: 'COUNT' | 'AVG' | 'SUM' | 'MAX' | 'MIN' | 'P95' | 'P99';
    timeWindowSeconds: number;
    threshold: number;
    enabled: boolean;
}

/**
 * Critical alert configurations
 * Requirement 2.15.1: Configure critical alerts
 */
const CRITICAL_ALERTS: CriticalAlertConfig[] = [
    {
        name: 'High Scraping Block Rate',
        description: 'Triggers when scraping block rate exceeds 30% over 15 minutes',
        severity: 'CRITICAL',
        metricType: 'scraping_block_rate',
        operator: 'GT',
        aggregation: 'AVG',
        timeWindowSeconds: 15 * 60, // 15 minutes
        threshold: 30, // 30% block rate
        enabled: true,
    },
    {
        name: 'Proxy Failure Alert',
        description: 'Triggers when proxy failure rate exceeds 20% over 10 minutes',
        severity: 'CRITICAL',
        metricType: 'proxy_failure_rate',
        operator: 'GT',
        aggregation: 'AVG',
        timeWindowSeconds: 10 * 60, // 10 minutes
        threshold: 20, // 20% failure rate
        enabled: true,
    },
    {
        name: 'High Error Rate',
        description: 'Triggers when error rate exceeds 1% over 5 minutes',
        severity: 'CRITICAL',
        metricType: 'error_rate',
        operator: 'GT',
        aggregation: 'AVG',
        timeWindowSeconds: 5 * 60, // 5 minutes
        threshold: 1, // 1% error rate
        enabled: true,
    },
    {
        name: 'Slow Response Time',
        description: 'Triggers when average response time exceeds 500ms over 5 minutes',
        severity: 'WARNING',
        metricType: 'response_time',
        operator: 'GT',
        aggregation: 'AVG',
        timeWindowSeconds: 5 * 60, // 5 minutes
        threshold: 500, // 500ms
        enabled: true,
    },
    {
        name: 'Critical Proxy Failure',
        description: 'Triggers when multiple proxies fail simultaneously',
        severity: 'CRITICAL',
        metricType: 'proxy_failure_count',
        operator: 'GT',
        aggregation: 'COUNT',
        timeWindowSeconds: 5 * 60, // 5 minutes
        threshold: 3, // More than 3 proxy failures
        enabled: true,
    },
    {
        name: 'Scraping Service Degradation',
        description: 'Triggers when scraping success rate drops below 70%',
        severity: 'WARNING',
        metricType: 'scraping_success_rate',
        operator: 'LT',
        aggregation: 'AVG',
        timeWindowSeconds: 10 * 60, // 10 minutes
        threshold: 70, // Below 70% success rate
        enabled: true,
    },
];

/**
 * Configure critical alert rules
 */
async function configureCriticalAlerts(): Promise<void> {
    console.log('🚨 Configuring Critical Alerts...\n');

    let created = 0;
    let updated = 0;
    let skipped = 0;

    for (const alertConfig of CRITICAL_ALERTS) {
        try {
            // Check if alert rule already exists
            const existing = await prisma.monitoringAlertRule.findFirst({
                where: {
                    name: alertConfig.name,
                    tenantId: null, // System-wide alerts
                },
            });

            if (existing) {
                // Update existing rule
                await prisma.monitoringAlertRule.update({
                    where: { id: existing.id },
                    data: {
                        description: alertConfig.description,
                        severity: alertConfig.severity,
                        metricType: alertConfig.metricType,
                        conditionOperator: alertConfig.operator,
                        conditionAggregation: alertConfig.aggregation,
                        timeWindowSeconds: alertConfig.timeWindowSeconds,
                        threshold: alertConfig.threshold,
                        enabled: alertConfig.enabled,
                        notificationChannels: [], // Will be configured separately
                    },
                });

                console.log(`✅ Updated: ${alertConfig.name}`);
                console.log(`   Severity: ${alertConfig.severity}`);
                console.log(`   Threshold: ${alertConfig.threshold} (${alertConfig.operator})`);
                console.log(`   Time Window: ${alertConfig.timeWindowSeconds / 60} minutes`);
                console.log('');
                updated++;
            } else {
                // Create new rule
                const newRule = await prisma.monitoringAlertRule.create({
                    data: {
                        name: alertConfig.name,
                        description: alertConfig.description,
                        severity: alertConfig.severity,
                        enabled: alertConfig.enabled,
                        metricType: alertConfig.metricType,
                        conditionOperator: alertConfig.operator,
                        conditionAggregation: alertConfig.aggregation,
                        timeWindowSeconds: alertConfig.timeWindowSeconds,
                        threshold: alertConfig.threshold,
                        notificationChannels: [], // Will be configured separately
                        tenantId: null, // System-wide
                    },
                });

                console.log(`✨ Created: ${alertConfig.name}`);
                console.log(`   ID: ${newRule.id}`);
                console.log(`   Severity: ${alertConfig.severity}`);
                console.log(`   Threshold: ${alertConfig.threshold} (${alertConfig.operator})`);
                console.log(`   Time Window: ${alertConfig.timeWindowSeconds / 60} minutes`);
                console.log('');
                created++;
            }
        } catch (error) {
            console.error(`❌ Failed to configure: ${alertConfig.name}`);
            console.error(`   Error: ${error instanceof Error ? error.message : String(error)}`);
            console.log('');
            skipped++;
        }
    }

    console.log('\n📊 Summary:');
    console.log(`   Created: ${created}`);
    console.log(`   Updated: ${updated}`);
    console.log(`   Skipped: ${skipped}`);
    console.log(`   Total: ${CRITICAL_ALERTS.length}`);
}

/**
 * Verify alert configuration
 */
async function verifyAlertConfiguration(): Promise<void> {
    console.log('\n🔍 Verifying Alert Configuration...\n');

    const allRules = await prisma.monitoringAlertRule.findMany({
        where: {
            tenantId: null, // System-wide alerts
        },
        orderBy: [
            { severity: 'desc' },
            { name: 'asc' },
        ],
    });

    console.log(`Found ${allRules.length} system-wide alert rules:\n`);

    for (const rule of allRules) {
        const statusIcon = rule.enabled ? '✅' : '⏸️';
        const severityIcon = rule.severity === 'CRITICAL' ? '🔴' : rule.severity === 'WARNING' ? '🟡' : '🔵';

        console.log(`${statusIcon} ${severityIcon} ${rule.name}`);
        console.log(`   Metric: ${rule.metricType}`);
        console.log(`   Condition: ${rule.conditionAggregation} ${rule.conditionOperator} ${rule.threshold}`);
        console.log(`   Time Window: ${rule.timeWindowSeconds / 60} minutes`);
        console.log(`   Enabled: ${rule.enabled}`);
        console.log('');
    }
}

/**
 * Display alert configuration guide
 */
function displayConfigurationGuide(): void {
    console.log('\n📖 Alert Configuration Guide:\n');
    console.log('The following critical alerts have been configured:');
    console.log('');
    console.log('1. High Scraping Block Rate (>30%)');
    console.log('   - Monitors scraping block rate over 15 minutes');
    console.log('   - Triggers when block rate exceeds 30%');
    console.log('   - Severity: CRITICAL');
    console.log('');
    console.log('2. Proxy Failure Alert (>20%)');
    console.log('   - Monitors proxy failure rate over 10 minutes');
    console.log('   - Triggers when failure rate exceeds 20%');
    console.log('   - Severity: CRITICAL');
    console.log('');
    console.log('3. High Error Rate (>1%)');
    console.log('   - Monitors application error rate over 5 minutes');
    console.log('   - Triggers when error rate exceeds 1%');
    console.log('   - Severity: CRITICAL');
    console.log('');
    console.log('4. Slow Response Time (>500ms)');
    console.log('   - Monitors average response time over 5 minutes');
    console.log('   - Triggers when response time exceeds 500ms');
    console.log('   - Severity: WARNING');
    console.log('');
    console.log('5. Critical Proxy Failure (>3 failures)');
    console.log('   - Monitors simultaneous proxy failures over 5 minutes');
    console.log('   - Triggers when more than 3 proxies fail');
    console.log('   - Severity: CRITICAL');
    console.log('');
    console.log('6. Scraping Service Degradation (<70%)');
    console.log('   - Monitors scraping success rate over 10 minutes');
    console.log('   - Triggers when success rate drops below 70%');
    console.log('   - Severity: WARNING');
    console.log('');
    console.log('Next Steps:');
    console.log('1. Configure notification channels (email, Slack)');
    console.log('2. Assign notification channels to alert rules');
    console.log('3. Test alert rules with the monitoring dashboard');
    console.log('4. Set up alert acknowledgment workflow');
    console.log('');
}

/**
 * Main execution
 */
async function main(): Promise<void> {
    try {
        await configureCriticalAlerts();
        await verifyAlertConfiguration();
        displayConfigurationGuide();

        console.log('✅ Critical alerts configured successfully!\n');
        process.exit(0);
    } catch (error) {
        console.error('❌ Failed to configure critical alerts:');
        console.error(error);
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
}

// Run the script
main();
