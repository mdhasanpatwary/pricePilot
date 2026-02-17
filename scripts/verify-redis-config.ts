#!/usr/bin/env ts-node
/**
 * Redis Configuration Verification Script
 * 
 * This script verifies:
 * 1. Environment variables are set correctly
 * 2. Redis connectivity works
 * 3. Basic cache operations (get/set/delete)
 * 4. Memory configuration and limits
 * 5. Eviction policy
 * 6. Performance metrics
 * 
 * Requirements: 1.6, 10.1, 10.2
 */

import { config } from 'dotenv';
import { Redis } from "ioredis";
import { getRedisConnection } from '@/lib/queue/connection';
import { CacheService } from '@/lib/services/cache';
import { CacheLayer } from '@/lib/services/cache-layer';

// Load environment variables
config();

interface VerificationResult {
    step: string;
    status: 'PASS' | 'FAIL' | 'WARN';
    message: string;
    details?: any;
}

const results: VerificationResult[] = [];

function logResult(result: VerificationResult) {
    const icon = result.status === 'PASS' ? '✅' : result.status === 'FAIL' ? '❌' : '⚠️';
    console.log(`${icon} ${result.step}: ${result.message}`);
    if (result.details) {
        console.log('   Details:', JSON.stringify(result.details, null, 2));
    }
    results.push(result);
}

async function verifyEnvironmentVariables(): Promise<boolean> {
    console.log('\n📋 Step 1: Verifying Environment Variables\n');

    const requiredVars = [
        'REDIS_URL'
    ];

    let allPresent = true;

    for (const varName of requiredVars) {
        if (process.env[varName]) {
            logResult({
                step: `ENV: ${varName}`,
                status: 'PASS',
                message: 'Environment variable is set',
                details: { value: process.env[varName]?.substring(0, 20) + '...' }
            });
        } else {
            logResult({
                step: `ENV: ${varName}`,
                status: 'FAIL',
                message: 'Environment variable is missing'
            });
            allPresent = false;
        }
    }

    return allPresent;
}

async function testRedisUrlConnection(): Promise<boolean> {
    console.log('\n🔌 Step 2: Testing Redis URL Connection\n');

    try {
        const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";
        const redis = new Redis(redisUrl);

        // Test ping
        const pingStart = Date.now();
        const pingResult = await redis.ping();
        const pingTime = Date.now() - pingStart;

        if (pingResult === 'PONG') {
            logResult({
                step: 'Redis URL Ping',
                status: 'PASS',
                message: 'Successfully connected to Redis',
                details: { responseTime: `${pingTime}ms` }
            });
        } else {
            logResult({
                step: 'Redis URL Ping',
                status: 'FAIL',
                message: 'Unexpected ping response',
                details: { response: pingResult }
            });
            return false;
        }

        // Test basic operations
        const testKey = 'test:verification:' + Date.now();
        const testValue = { message: 'Hello Redis!', timestamp: new Date().toISOString() };

        // Set
        await redis.set(testKey, JSON.stringify(testValue), 'EX', 60);
        logResult({
            step: 'Redis URL Set',
            status: 'PASS',
            message: 'Successfully set test value'
        });

        // Get
        const retrievedRaw = await redis.get(testKey);
        const retrieved = retrievedRaw ? JSON.parse(retrievedRaw) : null;
        if (JSON.stringify(retrieved) === JSON.stringify(testValue)) {
            logResult({
                step: 'Redis URL Get',
                status: 'PASS',
                message: 'Successfully retrieved test value'
            });
        } else {
            logResult({
                step: 'Redis URL Get',
                status: 'FAIL',
                message: 'Retrieved value does not match',
                details: { expected: testValue, received: retrieved }
            });
            return false;
        }

        // Delete
        await redis.del(testKey);
        const afterDelete = await redis.get(testKey);
        if (afterDelete === null) {
            logResult({
                step: 'Redis URL Delete',
                status: 'PASS',
                message: 'Successfully deleted test value'
            });
        } else {
            logResult({
                step: 'Redis URL Delete',
                status: 'FAIL',
                message: 'Value still exists after delete'
            });
            return false;
        }

        await redis.quit();
        return true;
    } catch (error: any) {
        logResult({
            step: 'Redis URL Connection',
            status: 'FAIL',
            message: 'Failed to connect to Redis',
            details: { error: error.message }
        });
        return false;
    }
}

async function testIORedisConnection(): Promise<boolean> {
    console.log('\n🔗 Step 3: Testing IORedis Connection (for BullMQ)\n');

    try {
        const redis = getRedisConnection();

        // Connect if not already connected
        if (redis.status !== 'ready') {
            await redis.connect();
        }

        // Test ping
        const pingStart = Date.now();
        const pingResult = await redis.ping();
        const pingTime = Date.now() - pingStart;

        if (pingResult === 'PONG') {
            logResult({
                step: 'IORedis Ping',
                status: 'PASS',
                message: 'Successfully connected to Redis',
                details: { responseTime: `${pingTime}ms` }
            });
        } else {
            logResult({
                step: 'IORedis Ping',
                status: 'FAIL',
                message: 'Unexpected ping response',
                details: { response: pingResult }
            });
            return false;
        }

        // Test basic operations
        const testKey = 'test:ioredis:' + Date.now();
        const testValue = JSON.stringify({ message: 'IORedis test', timestamp: new Date().toISOString() });

        await redis.set(testKey, testValue, 'EX', 60);
        logResult({
            step: 'IORedis Set',
            status: 'PASS',
            message: 'Successfully set test value'
        });

        const retrieved = await redis.get(testKey);
        if (retrieved === testValue) {
            logResult({
                step: 'IORedis Get',
                status: 'PASS',
                message: 'Successfully retrieved test value'
            });
        } else {
            logResult({
                step: 'IORedis Get',
                status: 'FAIL',
                message: 'Retrieved value does not match'
            });
            return false;
        }

        await redis.del(testKey);
        logResult({
            step: 'IORedis Delete',
            status: 'PASS',
            message: 'Successfully deleted test value'
        });

        return true;
    } catch (error: any) {
        logResult({
            step: 'IORedis Connection',
            status: 'FAIL',
            message: 'Failed to connect to Redis',
            details: { error: error.message }
        });
        return false;
    }
}

async function testCacheService(): Promise<boolean> {
    console.log('\n🎯 Step 4: Testing CacheService\n');

    try {
        const cache = CacheService.getInstance();

        const testKey = 'test:cache-service:' + Date.now();
        const testValue = { data: 'CacheService test', timestamp: Date.now() };

        // Set
        await cache.set(testKey, testValue, 60);
        logResult({
            step: 'CacheService Set',
            status: 'PASS',
            message: 'Successfully set value'
        });

        // Get
        const retrieved = await cache.get<typeof testValue>(testKey);
        if (retrieved && JSON.stringify(retrieved) === JSON.stringify(testValue)) {
            logResult({
                step: 'CacheService Get',
                status: 'PASS',
                message: 'Successfully retrieved value'
            });
        } else {
            logResult({
                step: 'CacheService Get',
                status: 'FAIL',
                message: 'Retrieved value does not match',
                details: { expected: testValue, received: retrieved }
            });
            return false;
        }

        // Delete
        await cache.del(testKey);
        const afterDelete = await cache.get(testKey);
        if (afterDelete === null) {
            logResult({
                step: 'CacheService Delete',
                status: 'PASS',
                message: 'Successfully deleted value'
            });
        } else {
            logResult({
                step: 'CacheService Delete',
                status: 'FAIL',
                message: 'Value still exists after delete'
            });
            return false;
        }

        return true;
    } catch (error: any) {
        logResult({
            step: 'CacheService',
            status: 'FAIL',
            message: 'CacheService test failed',
            details: { error: error.message }
        });
        return false;
    }
}

async function testCacheLayer(): Promise<boolean> {
    console.log('\n🏗️  Step 5: Testing CacheLayer\n');

    try {
        const cache = CacheLayer.getInstance();

        const testKey = 'test:cache-layer:' + Date.now();
        const testValue = { data: 'CacheLayer test', timestamp: Date.now() };

        // Set
        await cache.set(testKey, testValue, 60);
        logResult({
            step: 'CacheLayer Set',
            status: 'PASS',
            message: 'Successfully set value'
        });

        // Get
        const retrieved = await cache.get<typeof testValue>(testKey);
        if (retrieved && JSON.stringify(retrieved) === JSON.stringify(testValue)) {
            logResult({
                step: 'CacheLayer Get',
                status: 'PASS',
                message: 'Successfully retrieved value'
            });
        } else {
            logResult({
                step: 'CacheLayer Get',
                status: 'FAIL',
                message: 'Retrieved value does not match',
                details: { expected: testValue, received: retrieved }
            });
            return false;
        }

        // Test statistics
        const stats = await cache.getCacheStats();
        logResult({
            step: 'CacheLayer Statistics',
            status: 'PASS',
            message: 'Successfully retrieved cache statistics',
            details: {
                hitRate: `${(stats.hitRate * 100).toFixed(2)}%`,
                totalKeys: stats.totalKeys,
                memoryUsed: `${(stats.memoryUsedBytes / 1024 / 1024).toFixed(2)} MB`
            }
        });

        // Test invalidation
        await cache.invalidate(`test:cache-layer:*`);
        const afterInvalidate = await cache.get(testKey);
        if (afterInvalidate === null) {
            logResult({
                step: 'CacheLayer Invalidation',
                status: 'PASS',
                message: 'Successfully invalidated cache entries'
            });
        } else {
            logResult({
                step: 'CacheLayer Invalidation',
                status: 'FAIL',
                message: 'Value still exists after invalidation'
            });
            return false;
        }

        return true;
    } catch (error: any) {
        logResult({
            step: 'CacheLayer',
            status: 'FAIL',
            message: 'CacheLayer test failed',
            details: { error: error.message }
        });
        return false;
    }
}

async function checkRedisConfiguration(): Promise<void> {
    console.log('\n⚙️  Step 6: Checking Redis Configuration\n');

    try {
        const redis = getRedisConnection();

        if (redis.status !== 'ready') {
            await redis.connect();
        }

        // Get Redis INFO
        const info = await redis.info();

        // Parse memory info
        const memorySection = info.split('# Memory')[1]?.split('#')[0] || '';
        const maxMemoryMatch = memorySection.match(/maxmemory:(\d+)/);
        const maxMemoryPolicyMatch = memorySection.match(/maxmemory_policy:(\w+)/);
        const usedMemoryMatch = memorySection.match(/used_memory:(\d+)/);

        const maxMemory = maxMemoryMatch ? parseInt(maxMemoryMatch[1]) : 0;
        const maxMemoryPolicy = maxMemoryPolicyMatch ? maxMemoryPolicyMatch[1] : 'unknown';
        const usedMemory = usedMemoryMatch ? parseInt(usedMemoryMatch[1]) : 0;

        // Check memory limit (500MB = 524288000 bytes)
        const targetMemory = 500 * 1024 * 1024;
        if (maxMemory === 0) {
            logResult({
                step: 'Memory Limit',
                status: 'WARN',
                message: 'No memory limit set (unlimited)',
                details: {
                    recommendation: 'Set maxmemory to ~500MB in your Redis configuration',
                    currentUsage: `${(usedMemory / 1024 / 1024).toFixed(2)} MB`
                }
            });
        } else if (Math.abs(maxMemory - targetMemory) < 50 * 1024 * 1024) { // Within 50MB
            logResult({
                step: 'Memory Limit',
                status: 'PASS',
                message: 'Memory limit configured correctly',
                details: {
                    maxMemory: `${(maxMemory / 1024 / 1024).toFixed(2)} MB`,
                    currentUsage: `${(usedMemory / 1024 / 1024).toFixed(2)} MB`,
                    utilization: `${((usedMemory / maxMemory) * 100).toFixed(2)}%`
                }
            });
        } else {
            logResult({
                step: 'Memory Limit',
                status: 'WARN',
                message: 'Memory limit differs from recommended 500MB',
                details: {
                    current: `${(maxMemory / 1024 / 1024).toFixed(2)} MB`,
                    recommended: '500 MB',
                    currentUsage: `${(usedMemory / 1024 / 1024).toFixed(2)} MB`
                }
            });
        }

        // Check eviction policy
        if (maxMemoryPolicy === 'allkeys-lru') {
            logResult({
                step: 'Eviction Policy',
                status: 'PASS',
                message: 'Eviction policy configured correctly (allkeys-lru)',
                details: { policy: maxMemoryPolicy }
            });
        } else {
            logResult({
                step: 'Eviction Policy',
                status: 'WARN',
                message: 'Eviction policy is not set to allkeys-lru',
                details: {
                    current: maxMemoryPolicy,
                    recommended: 'allkeys-lru',
                    note: 'Configure this in your Redis configuration (e.g., redis.conf)'
                }
            });
        }

        // Get server info
        const serverSection = info.split('# Server')[1]?.split('#')[0] || '';
        const versionMatch = serverSection.match(/redis_version:([^\r\n]+)/);
        const uptimeMatch = serverSection.match(/uptime_in_seconds:(\d+)/);

        if (versionMatch) {
            logResult({
                step: 'Redis Version',
                status: 'PASS',
                message: 'Redis server information',
                details: {
                    version: versionMatch[1],
                    uptime: uptimeMatch ? `${Math.floor(parseInt(uptimeMatch[1]) / 3600)} hours` : 'unknown'
                }
            });
        }

    } catch (error: any) {
        logResult({
            step: 'Redis Configuration',
            status: 'FAIL',
            message: 'Failed to retrieve Redis configuration',
            details: { error: error.message }
        });
    }
}

async function performanceTest(): Promise<void> {
    console.log('\n⚡ Step 7: Performance Testing\n');

    try {
        const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";
        const redis = new Redis(redisUrl);
        const iterations = 100;

        // Test write performance
        const writeStart = Date.now();
        for (let i = 0; i < iterations; i++) {
            await redis.set(`perf:test:${i}`, JSON.stringify({ value: i }), "EX", 60);
        }
        const writeTime = Date.now() - writeStart;
        const avgWriteTime = writeTime / iterations;

        logResult({
            step: 'Write Performance',
            status: avgWriteTime < 50 ? 'PASS' : 'WARN',
            message: `Average write time: ${avgWriteTime.toFixed(2)}ms`,
            details: {
                iterations,
                totalTime: `${writeTime}ms`,
                avgTime: `${avgWriteTime.toFixed(2)}ms`,
                target: '<50ms'
            }
        });

        // Test read performance
        const readStart = Date.now();
        for (let i = 0; i < iterations; i++) {
            await redis.get(`perf:test:${i}`);
        }
        const readTime = Date.now() - readStart;
        const avgReadTime = readTime / iterations;

        logResult({
            step: 'Read Performance',
            status: avgReadTime < 50 ? 'PASS' : 'WARN',
            message: `Average read time: ${avgReadTime.toFixed(2)}ms`,
            details: {
                iterations,
                totalTime: `${readTime}ms`,
                avgTime: `${avgReadTime.toFixed(2)}ms`,
                target: '<50ms'
            }
        });

        // Cleanup
        const keys = Array.from({ length: iterations }, (_, i) => `perf:test:${i}`);
        await redis.del(...keys);

        await redis.quit();

    } catch (error: any) {
        logResult({
            step: 'Performance Test',
            status: 'FAIL',
            message: 'Performance test failed',
            details: { error: error.message }
        });
    }
}

async function main() {
    console.log('╔════════════════════════════════════════════════════════════╗');
    console.log('║     Redis Configuration Verification Script               ║');
    console.log('║     Performance Caching Feature - Task 1                  ║');
    console.log('╚════════════════════════════════════════════════════════════╝');

    const envOk = await verifyEnvironmentVariables();
    if (!envOk) {
        console.log('\n❌ Environment variables are not configured correctly.');
        console.log('Please set REDIS_URL in your .env file.');
        process.exit(1);
    }

    await testRedisUrlConnection();
    await testIORedisConnection();
    await testCacheService();
    await testCacheLayer();

    await checkRedisConfiguration();
    await performanceTest();

    // Summary
    console.log('\n╔════════════════════════════════════════════════════════════╗');
    console.log('║                    Verification Summary                   ║');
    console.log('╚════════════════════════════════════════════════════════════╝\n');

    const passed = results.filter(r => r.status === 'PASS').length;
    const failed = results.filter(r => r.status === 'FAIL').length;
    const warnings = results.filter(r => r.status === 'WARN').length;

    console.log(`✅ Passed:   ${passed}`);
    console.log(`❌ Failed:   ${failed}`);
    console.log(`⚠️  Warnings: ${warnings}`);
    console.log(`📊 Total:    ${results.length}\n`);

    if (failed > 0) {
        console.log('❌ Verification FAILED. Please fix the issues above.\n');
        process.exit(1);
    } else if (warnings > 0) {
        console.log('⚠️  Verification completed with warnings. Review recommendations above.\n');
        process.exit(0);
    } else {
        console.log('✅ All checks PASSED! Redis is configured correctly.\n');
        console.log('Next steps:');
        console.log('  1. Review memory limit and eviction policy in your Redis configuration');
        console.log('  2. Proceed to app/worker integration testing\n');
        process.exit(0);
    }
}

// Run the verification
main().catch((error) => {
    console.error('\n💥 Unexpected error during verification:', error);
    process.exit(1);
});
