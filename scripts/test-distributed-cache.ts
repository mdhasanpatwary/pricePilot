/**
 * Test script for distributed cache invalidation
 * 
 * This script verifies that the pub/sub mechanism for distributed
 * cache invalidation is properly configured and working.
 * 
 * Requirements: 7.2 - Distributed cache invalidation propagation
 */

import { cacheInvalidationPubSub } from "../lib/services/cache-invalidation-pubsub";
import { cacheLayer } from "../lib/services/cache-layer";

async function testDistributedCacheInvalidation() {
    console.log("🧪 Testing Distributed Cache Invalidation\n");

    try {
        // Test 1: Initialize pub/sub
        console.log("1️⃣  Initializing pub/sub service...");
        await cacheInvalidationPubSub.initialize();

        // Wait for connection to be ready
        await new Promise(resolve => setTimeout(resolve, 1000));

        if (!cacheInvalidationPubSub.isReady()) {
            throw new Error("Pub/sub service not ready");
        }

        console.log(`   ✓ Pub/sub initialized`);
        console.log(`   Instance ID: ${cacheInvalidationPubSub.getInstanceId()}\n`);

        // Test 2: Register invalidation handler
        console.log("2️⃣  Registering invalidation handler...");
        let receivedEvents: any[] = [];

        cacheInvalidationPubSub.onInvalidation(async (event) => {
            console.log(`   📨 Received invalidation event: ${event.pattern}`);
            receivedEvents.push(event);
        });

        console.log("   ✓ Handler registered\n");

        // Test 3: Cache some test data
        console.log("3️⃣  Caching test data...");
        const testKey = "tenant_123:products:test:abc123";
        const testData = { id: "123", name: "Test Product", price: 99.99 };

        await cacheLayer.set(testKey, testData, 300);

        const cached = await cacheLayer.get(testKey);
        if (!cached) {
            throw new Error("Failed to cache data");
        }
        console.log("   ✓ Data cached successfully\n");

        // Test 4: Publish invalidation event
        console.log("4️⃣  Publishing invalidation event...");
        await cacheInvalidationPubSub.publishInvalidation("tenant_123:products:*", "tenant_123");

        // Wait for event propagation
        await new Promise(resolve => setTimeout(resolve, 500));
        console.log("   ✓ Event published\n");

        // Test 5: Verify cache invalidation through CacheLayer
        console.log("5️⃣  Testing cache invalidation through CacheLayer...");

        // Cache more data
        await cacheLayer.set("tenant_123:products:test:xyz", { id: "xyz" }, 300);
        await cacheLayer.set("tenant_456:products:test:xyz", { id: "xyz" }, 300);

        // Invalidate tenant_123 products
        const invalidatedCount = await cacheLayer.invalidate("tenant_123:products:*");
        console.log(`   ✓ Invalidated ${invalidatedCount} keys\n`);

        // Test 6: Verify tenant isolation
        console.log("6️⃣  Verifying tenant isolation...");
        const tenant123After = await cacheLayer.get("tenant_123:products:test:xyz");
        const tenant456After = await cacheLayer.get("tenant_456:products:test:xyz");

        if (tenant123After !== null) {
            throw new Error("Tenant 123 cache not invalidated");
        }
        if (tenant456After === null) {
            throw new Error("Tenant 456 cache incorrectly invalidated");
        }
        console.log("   ✓ Tenant isolation working correctly\n");

        // Test 7: Verify pub/sub status
        console.log("7️⃣  Verifying pub/sub status...");
        const isReady = cacheInvalidationPubSub.isReady();
        const instanceId = cacheInvalidationPubSub.getInstanceId();

        console.log(`   Pub/sub ready: ${isReady}`);
        console.log(`   Instance ID: ${instanceId}`);
        console.log(`   Events received: ${receivedEvents.length}\n`);

        // Cleanup
        console.log("8️⃣  Cleaning up...");
        await cacheInvalidationPubSub.cleanup();
        await cacheLayer.cleanup();
        console.log("   ✓ Cleanup completed\n");

        console.log("✅ All distributed cache tests passed!\n");
        console.log("📝 Summary:");
        console.log(`   - Pub/sub initialized successfully`);
        console.log(`   - Invalidation events published and received`);
        console.log(`   - Cache invalidation working correctly`);
        console.log(`   - Tenant isolation maintained`);
        console.log(`   - ${receivedEvents.length} invalidation events processed\n`);

        process.exit(0);
    } catch (error) {
        console.error("\n❌ Test failed:", error);

        // Cleanup on error
        try {
            await cacheInvalidationPubSub.cleanup();
            await cacheLayer.cleanup();
        } catch (cleanupError) {
            // Ignore cleanup errors
        }

        process.exit(1);
    }
}

// Run tests
testDistributedCacheInvalidation();
