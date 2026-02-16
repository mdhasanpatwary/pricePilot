import { cacheInvalidationPubSub } from "./cache-invalidation-pubsub";
import { getCacheLayer } from "./cache-layer";
import { logger } from "@/lib/logger";

/**
 * Initialize distributed caching infrastructure
 * 
 * This should be called once on application startup to:
 * - Initialize Redis pub/sub for distributed cache invalidation
 * - Set up cache monitoring
 * - Ensure cache layer is ready
 * 
 * Requirements: 7.2 - Distributed cache invalidation propagation
 */
export async function initializeDistributedCache(): Promise<void> {
    const globalState = globalThis as typeof globalThis & {
        __ppDistributedCacheInitPromise?: Promise<void>;
        __ppDistributedCacheInitialized?: boolean;
    };

    if (globalState.__ppDistributedCacheInitialized) {
        return;
    }

    if (globalState.__ppDistributedCacheInitPromise) {
        await globalState.__ppDistributedCacheInitPromise;
        return;
    }

    globalState.__ppDistributedCacheInitPromise = (async () => {
    try {
        logger.info("[CacheInitialization] Initializing distributed cache...");

        // Initialize pub/sub for distributed invalidation
        await cacheInvalidationPubSub.initialize();

        logger.info("[CacheInitialization] Distributed cache initialized successfully", {
            instanceId: cacheInvalidationPubSub.getInstanceId(),
            pubSubReady: cacheInvalidationPubSub.isReady()
        });
        globalState.__ppDistributedCacheInitialized = true;
    } catch (error) {
        logger.error("[CacheInitialization] Failed to initialize distributed cache", { error });
        // Don't throw - application should continue without distributed caching
        logger.warn("[CacheInitialization] Application will continue without distributed cache invalidation");
    } finally {
        globalState.__ppDistributedCacheInitPromise = undefined;
    }
    })();

    await globalState.__ppDistributedCacheInitPromise;
}

/**
 * Cleanup distributed caching infrastructure
 * 
 * This should be called on graceful shutdown to:
 * - Unsubscribe from pub/sub channels
 * - Close Redis connections
 * - Clean up resources
 */
export async function cleanupDistributedCache(): Promise<void> {
    try {
        logger.info("[CacheInitialization] Cleaning up distributed cache...");
        const cacheLayer = getCacheLayer();

        await Promise.all([
            cacheInvalidationPubSub.cleanup(),
            cacheLayer.cleanup()
        ]);

        const globalState = globalThis as typeof globalThis & {
            __ppDistributedCacheInitialized?: boolean;
        };
        globalState.__ppDistributedCacheInitialized = false;

        logger.info("[CacheInitialization] Distributed cache cleanup completed");
    } catch (error) {
        logger.error("[CacheInitialization] Error during cache cleanup", { error });
    }
}
