#!/usr/bin/env tsx
/**
 * Simple Redis Configuration Verification Script
 * Requirements: 1.6, 10.1, 10.2
 */

import { config } from 'dotenv';
import { Redis } from '@upstash/redis';

// Load environment variables
config();

async function main() {
    console.log('╔════════════════════════════════════════════════════════════╗');
    console.log('║     Redis Configuration Verification                      ║');
    console.log('╚════════════════════════════════════════════════════════════╝\n');

    // Step 1: Check environment variables
    console.log('📋 Step 1: Checking Environment Variables\n');

    if (!process.env.UPSTASH_REDIS_REST_URL) {
        console.log('❌ UPSTASH_REDIS_REST_URL is not set');
        process.exit(1);
    }
    console.log('✅ UPSTASH_REDIS_REST_URL:', process.env.UPSTASH_REDIS_REST_URL);

    if (!process.env.UPSTASH_REDIS_REST_TOKEN) {
        console.log('❌ UPSTASH_REDIS_REST_TOKEN is not set');
        process.exit(1);
    }
    console.log('✅ UPSTASH_REDIS_REST_TOKEN: ****' + process.env.UPSTASH_REDIS_REST_TOKEN.slice(-10));

    // Step 2: Test connection
    console.log('\n🔌 Step 2: Testing Redis Connection\n');

    try {
        const redis = Redis.fromEnv();

        // Test ping
        const pingStart = Date.now();
        const pingResult = await redis.ping();
        const pingTime = Date.now() - pingStart;

        if (pingResult === 'PONG') {
            console.log(`✅ Redis PING successful (${pingTime}ms)`);
        } else {
            console.log('❌ Unexpected ping response:', pingResult);
            process.exit(1);
        }

        // Test SET
        const testKey = 'test:verify:' + Date.now();
        const testValue = { message: 'Hello Redis!', timestamp: new Date().toISOString() };

        await redis.set(testKey, testValue, { ex: 60 });
        console.log('✅ Redis SET successful');

        // Test GET
        const retrieved = await redis.get(testKey);
        if (JSON.stringify(retrieved) === JSON.stringify(testValue)) {
            console.log('✅ Redis GET successful');
        } else {
            console.log('❌ Retrieved value does not match');
            process.exit(1);
        }

        // Test DEL
        await redis.del(testKey);
        const afterDelete = await redis.get(testKey);
        if (afterDelete === null) {
            console.log('✅ Redis DEL successful');
        } else {
            console.log('❌ Value still exists after delete');
            process.exit(1);
        }

        // Step 3: Performance test
        console.log('\n⚡ Step 3: Performance Testing\n');

        const iterations = 50;

        // Write test
        const writeStart = Date.now();
        for (let i = 0; i < iterations; i++) {
            await redis.set(`perf:test:${i}`, { value: i }, { ex: 60 });
        }
        const writeTime = Date.now() - writeStart;
        const avgWriteTime = writeTime / iterations;

        console.log(`✅ Write Performance: ${avgWriteTime.toFixed(2)}ms avg (${iterations} operations)`);
        if (avgWriteTime > 100) {
            console.log('⚠️  Warning: Write performance is slower than expected (<50ms target)');
        }

        // Read test
        const readStart = Date.now();
        for (let i = 0; i < iterations; i++) {
            await redis.get(`perf:test:${i}`);
        }
        const readTime = Date.now() - readStart;
        const avgReadTime = readTime / iterations;

        console.log(`✅ Read Performance: ${avgReadTime.toFixed(2)}ms avg (${iterations} operations)`);
        if (avgReadTime > 100) {
            console.log('⚠️  Warning: Read performance is slower than expected (<50ms target)');
        }

        // Cleanup
        const keys = Array.from({ length: iterations }, (_, i) => `perf:test:${i}`);
        await redis.del(...keys);
        console.log('✅ Cleanup successful');

        // Summary
        console.log('\n╔════════════════════════════════════════════════════════════╗');
        console.log('║                    ✅ ALL CHECKS PASSED                    ║');
        console.log('╚════════════════════════════════════════════════════════════╝\n');

        console.log('Redis Configuration Summary:');
        console.log('  • Connection: Working');
        console.log('  • Basic Operations: Working');
        console.log(`  • Write Performance: ${avgWriteTime.toFixed(2)}ms avg`);
        console.log(`  • Read Performance: ${avgReadTime.toFixed(2)}ms avg`);
        console.log('\nNext Steps:');
        console.log('  1. Configure memory limit (500MB) in Upstash dashboard');
        console.log('  2. Set eviction policy to "allkeys-lru" in Upstash dashboard');
        console.log('  3. Proceed to Task 2: Create enhanced cache service\n');

        process.exit(0);

    } catch (error: any) {
        console.log('\n❌ Redis connection failed:', error.message);
        console.log('\nTroubleshooting:');
        console.log('  1. Verify UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN in .env');
        console.log('  2. Check Upstash dashboard for database status');
        console.log('  3. Ensure your IP is not blocked\n');
        process.exit(1);
    }
}

main();
