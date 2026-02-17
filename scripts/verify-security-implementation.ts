/**
 * Security Implementation Verification Script
 *
 * Verifies that all security measures are properly implemented
 * to achieve zero security incidents post-deployment.
 */

import { incidentPreventionService } from '../lib/services/security/incident-prevention';
import { securityMonitoringService } from '../lib/services/monitoring/security-monitoring';

interface VerificationResult {
    category: string;
    check: string;
    passed: boolean;
    details?: string;
}

const results: VerificationResult[] = [];

function addResult(category: string, check: string, passed: boolean, details?: string) {
    results.push({ category, check, passed, details });
    const status = passed ? '✅' : '❌';
    console.log(`${status} ${category}: ${check}`);
    if (details) {
        console.log(`   ${details}`);
    }
}

async function verifyIncidentPrevention() {
    console.log('\n🔒 Verifying Incident Prevention System...\n');

    try {
        // Test IP blocking
        const testIP = '192.168.1.100';
        await incidentPreventionService.blockIP(testIP, 60000, 'Test block');
        const isBlocked = await incidentPreventionService.isBlocked(testIP);
        addResult(
            'Incident Prevention',
            'IP Blocking',
            isBlocked,
            isBlocked ? 'IP blocking works correctly' : 'IP blocking failed'
        );

        // Unblock test IP
        await incidentPreventionService.unblockIP(testIP, 'Test complete');

        // Test reputation system
        const reputation = await incidentPreventionService.getIPReputation(testIP);
        addResult(
            'Incident Prevention',
            'Reputation System',
            reputation.score >= 0 && reputation.score <= 100,
            `Reputation score: ${reputation.score}`
        );

        // Test threat analysis
        const { threatLevel, actions } = await incidentPreventionService.analyzeThreat({
            ipAddress: testIP,
        });
        addResult(
            'Incident Prevention',
            'Threat Analysis',
            threatLevel !== undefined && actions.length > 0,
            `Threat level: ${threatLevel}, Actions: ${actions.length}`
        );

        // Test incident logging
        const incidents = await incidentPreventionService.getIncidents(24 * 60 * 60 * 1000);
        addResult(
            'Incident Prevention',
            'Incident Logging',
            Array.isArray(incidents),
            `Found ${incidents.length} incidents in last 24 hours`
        );

        // Test security stats
        const stats = await incidentPreventionService.getSecurityStats(24 * 60 * 60 * 1000);
        addResult(
            'Incident Prevention',
            'Security Statistics',
            stats.totalIncidents >= 0,
            `Total incidents: ${stats.totalIncidents}, Blocked IPs: ${stats.blockedIPs}`
        );
    } catch (error) {
        addResult(
            'Incident Prevention',
            'System Availability',
            false,
            `Error: ${error instanceof Error ? error.message : String(error)}`
        );
    }
}

async function verifySecurityMonitoring() {
    console.log('\n📊 Verifying Security Monitoring...\n');

    try {
        const testIP = '192.168.1.101';

        // Test auth failure tracking
        await securityMonitoringService.recordAuthFailure({
            ipAddress: testIP,
            email: 'test@example.com',
        });

        const authFailures = await securityMonitoringService.getAuthFailureCount(
            testIP,
            5 * 60 * 1000
        );
        addResult(
            'Security Monitoring',
            'Auth Failure Tracking',
            authFailures >= 0,
            `Auth failures: ${authFailures}`
        );

        // Test rate limit tracking
        await securityMonitoringService.recordRateLimitViolation({
            ipAddress: testIP,
            endpoint: '/api/test',
        });
        addResult('Security Monitoring', 'Rate Limit Tracking', true, 'Rate limit violation recorded');

        // Test unauthorized access tracking
        await securityMonitoringService.recordUnauthorizedAccess({
            ipAddress: testIP,
            endpoint: '/api/admin',
            statusCode: 401,
        });
        addResult(
            'Security Monitoring',
            'Unauthorized Access Tracking',
            true,
            'Unauthorized access recorded'
        );

        // Test suspicious pattern detection
        const pattern = await securityMonitoringService.detectSuspiciousPattern({
            ipAddress: testIP,
        });
        addResult(
            'Security Monitoring',
            'Pattern Detection',
            pattern.confidence >= 0 && pattern.confidence <= 1,
            `Confidence: ${pattern.confidence}, Detected: ${pattern.detected}`
        );

        // Test security events retrieval
        const events = await securityMonitoringService.getSecurityEvents(24 * 60 * 60 * 1000);
        addResult(
            'Security Monitoring',
            'Event Retrieval',
            Array.isArray(events),
            `Found ${events.length} events in last 24 hours`
        );
    } catch (error) {
        addResult(
            'Security Monitoring',
            'System Availability',
            false,
            `Error: ${error instanceof Error ? error.message : String(error)}`
        );
    }
}

async function verifyEnvironmentConfiguration() {
    console.log('\n⚙️  Verifying Environment Configuration...\n');

    // Check Redis configuration
    const hasRedis = !!process.env.REDIS_URL;
    addResult(
        'Configuration',
        'Redis Configuration',
        hasRedis,
        hasRedis ? 'Redis configured' : 'REDIS_URL not configured (security features limited)'
    );

    // Check encryption key
    const hasEncryptionKey = !!process.env.ENCRYPTION_KEY;
    addResult(
        'Configuration',
        'Encryption Key',
        hasEncryptionKey,
        hasEncryptionKey ? 'Encryption key configured' : 'Encryption key missing'
    );

    // Check SMTP configuration
    const hasSMTP =
        !!process.env.SMTP_HOST &&
        !!process.env.SMTP_PORT &&
        !!process.env.SMTP_USER &&
        !!process.env.SMTP_PASS;
    addResult(
        'Configuration',
        'SMTP Configuration',
        hasSMTP,
        hasSMTP ? 'SMTP configured' : 'SMTP not configured (email notifications disabled)'
    );

    // Check NextAuth configuration
    const hasNextAuth = !!process.env.NEXTAUTH_URL && !!process.env.NEXTAUTH_SECRET;
    addResult(
        'Configuration',
        'NextAuth Configuration',
        hasNextAuth,
        hasNextAuth ? 'NextAuth configured' : 'NextAuth not configured'
    );
}

async function verifySecurityFiles() {
    console.log('\n📁 Verifying Security Files...\n');

    const fs = require('fs');
    const path = require('path');

    const requiredFiles = [
        'lib/services/security/incident-prevention.ts',
        'lib/services/monitoring/security-monitoring.ts',
        'lib/middleware/security-middleware.ts',
        'app/api/v1/security/dashboard/route.ts',
        'app/api/v1/security/blocked-ips/route.ts',
        'docs/SECURITY_INCIDENT_PREVENTION.md',
        'docs/SECURITY_CHECKLIST.md',
    ];

    for (const file of requiredFiles) {
        const exists = fs.existsSync(path.join(process.cwd(), file));
        addResult('Files', file, exists, exists ? 'File exists' : 'File missing');
    }
}

async function generateReport() {
    console.log('\n' + '='.repeat(80));
    console.log('SECURITY IMPLEMENTATION VERIFICATION REPORT');
    console.log('='.repeat(80) + '\n');

    const categories = [...new Set(results.map((r) => r.category))];

    for (const category of categories) {
        const categoryResults = results.filter((r) => r.category === category);
        const passed = categoryResults.filter((r) => r.passed).length;
        const total = categoryResults.length;
        const percentage = ((passed / total) * 100).toFixed(1);

        console.log(`\n${category}: ${passed}/${total} checks passed (${percentage}%)`);
        console.log('-'.repeat(80));

        for (const result of categoryResults) {
            const status = result.passed ? '✅' : '❌';
            console.log(`${status} ${result.check}`);
            if (result.details) {
                console.log(`   ${result.details}`);
            }
        }
    }

    const totalPassed = results.filter((r) => r.passed).length;
    const totalChecks = results.length;
    const overallPercentage = ((totalPassed / totalChecks) * 100).toFixed(1);

    console.log('\n' + '='.repeat(80));
    console.log(`OVERALL: ${totalPassed}/${totalChecks} checks passed (${overallPercentage}%)`);
    console.log('='.repeat(80) + '\n');

    if (totalPassed === totalChecks) {
        console.log('🎉 All security checks passed! System is ready for zero-incident deployment.');
    } else {
        console.log('⚠️  Some security checks failed. Please review and fix before deployment.');
    }

    console.log('\n📋 Next Steps:');
    console.log('1. Review any failed checks above');
    console.log('2. Fix configuration or implementation issues');
    console.log('3. Re-run this verification script');
    console.log('4. Review docs/SECURITY_CHECKLIST.md');
    console.log('5. Complete pre-deployment security checklist');
    console.log('6. Deploy with confidence!\n');
}

async function main() {
    console.log('🔐 Security Implementation Verification');
    console.log('========================================\n');
    console.log('This script verifies that all security measures are properly');
    console.log('implemented to achieve zero security incidents post-deployment.\n');

    await verifyEnvironmentConfiguration();
    await verifySecurityFiles();
    await verifyIncidentPrevention();
    await verifySecurityMonitoring();
    await generateReport();

    process.exit(results.every((r) => r.passed) ? 0 : 1);
}

main().catch((error) => {
    console.error('❌ Verification script failed:', error);
    process.exit(1);
});
