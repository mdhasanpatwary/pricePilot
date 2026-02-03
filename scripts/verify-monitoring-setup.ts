import { prisma } from '../lib/prisma';

async function verifyMonitoringSetup() {
    console.log('🔍 Verifying monitoring infrastructure setup...\n');

    try {
        console.log('✓ Test 1: Checking MonitoringAlertRule model...');
        const alertRuleCount = await prisma.monitoringAlertRule.count();
        console.log(`  Found ${alertRuleCount} alert rules in database`);

        console.log('✓ Test 2: Checking MonitoringNotificationChannel model...');
        const channelCount = await prisma.monitoringNotificationChannel.count();
        console.log(`  Found ${channelCount} notification channels in database`);

        console.log('✓ Test 3: Checking MonitoringAlertHistory model...');
        const historyCount = await prisma.monitoringAlertHistory.count();
        console.log(`  Found ${historyCount} alert history entries in database`);

        console.log('✓ Test 4: Checking MonitoringMaintenanceWindow model...');
        const maintenanceCount = await prisma.monitoringMaintenanceWindow.count();
        console.log(`  Found ${maintenanceCount} maintenance windows in database`);

        console.log('✓ Test 5: Checking Sentry configuration...');
        const sentryDsn = process.env.SENTRY_DSN;
        const sentryEnabled = process.env.SENTRY_ENABLED !== 'false';

        if (sentryEnabled && sentryDsn) {
            console.log('  Sentry is enabled and configured');
            console.log(`  Environment: ${process.env.SENTRY_ENVIRONMENT || 'development'}`);
        } else if (!sentryEnabled) {
            console.log('  Sentry is disabled (SENTRY_ENABLED=false)');
        } else {
            console.log('  ⚠️  Warning: Sentry is enabled but SENTRY_DSN is not set');
        }

        console.log('✓ Test 6: Testing alert rule creation...');
        const testRule = await prisma.monitoringAlertRule.create({
            data: {
                name: 'Test Alert Rule',
                description: 'Verification test rule',
                severity: 'INFO',
                enabled: false,
                metricType: 'test_metric',
                conditionOperator: 'GT',
                conditionAggregation: 'AVG',
                timeWindowSeconds: 300,
                threshold: 100,
                notificationChannels: [],
            },
        });
        console.log(`  Created test rule with ID: ${testRule.id}`);

        await prisma.monitoringAlertRule.delete({
            where: { id: testRule.id },
        });
        console.log('  Cleaned up test rule');

        console.log('\n✅ All verification tests passed!');
        console.log('\nMonitoring infrastructure is ready for implementation.');

    } catch (error) {
        console.error('\n❌ Verification failed:', error);
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
}

verifyMonitoringSetup();
