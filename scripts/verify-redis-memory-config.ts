#!/usr/bin/env tsx

/**
 * Redis Memory Configuration Verification Script
 * 
 * This script verifies that Redis memory limits and eviction policies
 * are properly configured according to PricePilot requirements.
 * 
 * Requirements: 6.6, 10.3, 10.4
 */

import { getRedisConnection } from '@/lib/queue/connection';
import { cacheMonitoringService } from '@/lib/services/cache-monitoring';

interface MemoryConfig {
    maxMemory: number;
    maxMemoryPolicy: string;
    usedMemory: number;
    usedMemoryPercent: number;
}

interface VerificationResult {
    success: boolean;
    config: MemoryConfig | null;
    checks: {
        name: string;
        passed: boolean;
        message: string;
        severity: 'info' | 'warning' | 'error';
    }[];
    recommendations: string[];
}

const REQUIRED_MEMORY_LIMIT = 250 * 1024 * 1024; // 250MB (free tier default)
const REQUIRED_EVICTION_POLICY = 'allkeys-lru';
const WARNING_THRESHOLD = 0.8; // 80%
const ERROR_THRESHOLD = 0.95; // 95%

async function getRedisMemoryConfig(): Promise<MemoryConfig | null> {
    const redis = getRedisConnection();

    try {
        // Check if already connected, if not connect
        if (redis.status !== 'ready') {
            if (redis.status === 'end' || redis.status === 'close') {
                await redis.connect();
            }
        }

        // Get memory info
        const info = await redis.info('memory');

        // Parse memory information
        const maxMemoryMatch = info.match(/maxmemory:(\d+)/);
        const usedMemoryMatch = info.match(/used_memory:(\d+)/);
        const maxMemoryPolicyMatch = info.match(/maxmemory_policy:(\w+)/);

        const maxMemory = maxMemoryMatch ? parseInt(maxMemoryMatch[1]) : 0;
        const usedMemory = usedMemoryMatch ? parseInt(usedMemoryMatch[1]) : 0;
        const maxMemoryPolicy = maxMemoryPolicyMatch ? maxMemoryPolicyMatch[1] : 'unknown';

        const usedMemoryPercent = maxMemory > 0 ? usedMemory / maxMemory : 0;

        return {
            maxMemory,
            maxMemoryPolicy,
            usedMemory,
            usedMemoryPercent,
        };
    } catch (error) {
        console.error('Error getting Redis memory config:', error);
        return null;
    }
}

async function verifyMemoryConfiguration(): Promise<VerificationResult> {
    const result: VerificationResult = {
        success: false,
        config: null,
        checks: [],
        recommendations: [],
    };

    console.log('🔍 Verifying Redis Memory Configuration...\n');

    // Check 1: Redis Connection
    console.log('1. Checking Redis connection...');
    const health = await cacheMonitoringService.getHealthStatus();

    if (health.status === 'unhealthy') {
        result.checks.push({
            name: 'Redis Connection',
            passed: false,
            message: `Redis is unreachable: ${health.error}`,
            severity: 'error',
        });
        return result;
    }

    result.checks.push({
        name: 'Redis Connection',
        passed: true,
        message: 'Redis is connected and responsive',
        severity: 'info',
    });

    // Check 2: Get Memory Configuration
    console.log('2. Retrieving memory configuration...');
    const config = await getRedisMemoryConfig();

    if (!config) {
        result.checks.push({
            name: 'Memory Configuration',
            passed: false,
            message: 'Unable to retrieve memory configuration from Redis',
            severity: 'error',
        });
        return result;
    }

    result.config = config;

    // Check 3: Memory Limit
    console.log('3. Checking memory limit...');
    const memoryLimitMB = Math.round(config.maxMemory / 1024 / 1024);
    const requiredLimitMB = Math.round(REQUIRED_MEMORY_LIMIT / 1024 / 1024);

    if (config.maxMemory === 0) {
        result.checks.push({
            name: 'Memory Limit',
            passed: false,
            message: 'No memory limit configured (maxmemory = 0). This can lead to unbounded memory growth.',
            severity: 'error',
        });
        result.recommendations.push(
            `Set maxmemory to ${requiredLimitMB}MB in Upstash dashboard (free tier limit)`
        );
    } else if (config.maxMemory < REQUIRED_MEMORY_LIMIT * 0.5) {
        result.checks.push({
            name: 'Memory Limit',
            passed: false,
            message: `Memory limit (${memoryLimitMB}MB) is significantly below recommended (${requiredLimitMB}MB for free tier)`,
            severity: 'warning',
        });
        result.recommendations.push(
            `Consider setting memory limit to ${requiredLimitMB}MB (free tier) or upgrading to paid plan for 500MB+`
        );
    } else if (config.maxMemory >= 250 * 1024 * 1024 && config.maxMemory < 500 * 1024 * 1024) {
        result.checks.push({
            name: 'Memory Limit',
            passed: true,
            message: `Memory limit is properly configured: ${memoryLimitMB}MB (Free Tier)`,
            severity: 'info',
        });
    } else if (config.maxMemory >= 500 * 1024 * 1024) {
        result.checks.push({
            name: 'Memory Limit',
            passed: true,
            message: `Memory limit is properly configured: ${memoryLimitMB}MB (Paid Plan)`,
            severity: 'info',
        });
    } else {
        result.checks.push({
            name: 'Memory Limit',
            passed: true,
            message: `Memory limit is configured: ${memoryLimitMB}MB`,
            severity: 'info',
        });
    }

    // Check 4: Eviction Policy
    console.log('4. Checking eviction policy...');
    if (config.maxMemoryPolicy !== REQUIRED_EVICTION_POLICY) {
        result.checks.push({
            name: 'Eviction Policy',
            passed: false,
            message: `Eviction policy is "${config.maxMemoryPolicy}", should be "${REQUIRED_EVICTION_POLICY}"`,
            severity: 'warning',
        });
        result.recommendations.push(
            `Set eviction policy to "${REQUIRED_EVICTION_POLICY}" in Upstash dashboard`
        );
    } else {
        result.checks.push({
            name: 'Eviction Policy',
            passed: true,
            message: `Eviction policy is correctly set to "${REQUIRED_EVICTION_POLICY}"`,
            severity: 'info',
        });
    }

    // Check 5: Current Memory Usage
    console.log('5. Checking current memory usage...');
    const usedMemoryMB = Math.round(config.usedMemory / 1024 / 1024);
    const usedPercent = Math.round(config.usedMemoryPercent * 100);

    if (config.usedMemoryPercent > ERROR_THRESHOLD) {
        result.checks.push({
            name: 'Memory Usage',
            passed: false,
            message: `Memory usage is critical: ${usedMemoryMB}MB (${usedPercent}%)`,
            severity: 'error',
        });
        result.recommendations.push(
            'Immediate action required: Memory usage above 95%',
            'Consider increasing memory limit or reducing TTL values'
        );
    } else if (config.usedMemoryPercent > WARNING_THRESHOLD) {
        result.checks.push({
            name: 'Memory Usage',
            passed: true,
            message: `Memory usage is high: ${usedMemoryMB}MB (${usedPercent}%)`,
            severity: 'warning',
        });
        result.recommendations.push(
            'Monitor memory usage closely',
            'Consider optimizing cache TTL values or increasing memory limit'
        );
    } else {
        result.checks.push({
            name: 'Memory Usage',
            passed: true,
            message: `Memory usage is healthy: ${usedMemoryMB}MB (${usedPercent}%)`,
            severity: 'info',
        });
    }

    // Check 6: Eviction Stats
    console.log('6. Checking eviction statistics...');
    if (health.performance?.evictions && health.performance.evictions > 0) {
        result.checks.push({
            name: 'Evictions',
            passed: true,
            message: `${health.performance.evictions} keys have been evicted (LRU working as expected)`,
            severity: 'info',
        });

        if (health.performance.evictions > 10000) {
            result.recommendations.push(
                'High eviction rate detected - consider increasing memory limit'
            );
        }
    } else {
        result.checks.push({
            name: 'Evictions',
            passed: true,
            message: 'No evictions detected yet',
            severity: 'info',
        });
    }

    // Determine overall success
    const hasErrors = result.checks.some(check => check.severity === 'error' && !check.passed);
    result.success = !hasErrors;

    return result;
}

function printResults(result: VerificationResult): void {
    console.log('\n' + '='.repeat(70));
    console.log('Redis Memory Configuration Verification Results');
    console.log('='.repeat(70) + '\n');

    // Print configuration
    if (result.config) {
        console.log('Configuration:');
        console.log(`  • Memory Limit: ${Math.round(result.config.maxMemory / 1024 / 1024)}MB`);
        console.log(`  • Eviction Policy: ${result.config.maxMemoryPolicy}`);
        console.log(`  • Current Usage: ${Math.round(result.config.usedMemory / 1024 / 1024)}MB (${Math.round(result.config.usedMemoryPercent * 100)}%)`);
        console.log('');
    }

    // Print checks
    console.log('Checks:');
    for (const check of result.checks) {
        const icon = check.passed ? '✅' :
            check.severity === 'error' ? '❌' : '⚠️';
        console.log(`  ${icon} ${check.name}: ${check.message}`);
    }
    console.log('');

    // Print recommendations
    if (result.recommendations.length > 0) {
        console.log('Recommendations:');
        for (const rec of result.recommendations) {
            console.log(`  • ${rec}`);
        }
        console.log('');
    }

    // Print overall status
    if (result.success) {
        console.log('✅ ALL CHECKS PASSED\n');
        console.log('Redis memory configuration is properly set up.');
    } else {
        console.log('❌ CONFIGURATION ISSUES DETECTED\n');
        console.log('Please review the recommendations above and update your Redis configuration.');
        console.log('Configuration guide: docs/REDIS_MEMORY_CONFIGURATION.md');
    }

    console.log('='.repeat(70) + '\n');
}

async function main() {
    try {
        const result = await verifyMemoryConfiguration();
        printResults(result);

        // Exit with appropriate code
        process.exit(result.success ? 0 : 1);
    } catch (error) {
        console.error('❌ Verification failed with error:', error);
        process.exit(1);
    }
}

// Run if executed directly
if (require.main === module) {
    main();
}

export { verifyMemoryConfiguration, getRedisMemoryConfig };
