import { Redis } from "ioredis";
import { getRedisConnection } from "@/lib/queue/connection";
import { logger } from "@/lib/logger";

/**
 * Distributed Cache Invalidation Service using Redis Pub/Sub
 * 
 * Implements cache invalidation propagation across multiple application instances
 * using Redis pub/sub messaging.
 * 
 * Features:
 * - Publish invalidation events to all instances
 * - Subscribe to invalidation events from other instances
 * - Handle invalidation events with callbacks
 * - Graceful error handling
 * - Automatic reconnection
 * 
 * Requirements: 7.2 - Distributed cache invalidation propagation
 */

export interface InvalidationEvent {
    pattern: string;
    tenantId?: string;
    timestamp: string;
    instanceId: string;
}

export type InvalidationCallback = (event: InvalidationEvent) => Promise<void>;

export class CacheInvalidationPubSub {
    private publisher: Redis;
    private subscriber: Redis;
    private static instance: CacheInvalidationPubSub;
    private readonly CHANNEL = "cache:invalidation";
    private readonly instanceId: string;
    private callbacks: InvalidationCallback[] = [];
    private isSubscribed: boolean = false;
    private isPublisherReady: boolean = false;
    private isSubscriberReady: boolean = false;

    private constructor() {
        // Generate unique instance ID (use random for edge compatibility)
        this.instanceId = `instance-${Math.random().toString(36).substring(7)}-${Date.now()}`;

        // Create separate connections for publisher and subscriber
        // Redis pub/sub requires dedicated connections
        this.publisher = getRedisConnection();
        this.subscriber = getRedisConnection().duplicate();

        this.setupPublisher();
        this.setupSubscriber();
    }

    static getInstance(): CacheInvalidationPubSub {
        if (!CacheInvalidationPubSub.instance) {
            CacheInvalidationPubSub.instance = new CacheInvalidationPubSub();
        }
        return CacheInvalidationPubSub.instance;
    }

    /**
     * Setup publisher connection
     */
    private setupPublisher(): void {
        this.publisher.on("ready", () => {
            this.isPublisherReady = true;
            logger.info("[CacheInvalidationPubSub] Publisher ready", {
                instanceId: this.instanceId
            });
        });

        this.publisher.on("error", (error) => {
            this.isPublisherReady = false;
            logger.error("[CacheInvalidationPubSub] Publisher error", {
                instanceId: this.instanceId,
                error
            });
        });

        this.publisher.on("reconnecting", () => {
            this.isPublisherReady = false;
            logger.info("[CacheInvalidationPubSub] Publisher reconnecting", {
                instanceId: this.instanceId
            });
        });
    }

    /**
     * Setup subscriber connection and message handler
     */
    private setupSubscriber(): void {
        this.subscriber.on("ready", () => {
            this.isSubscriberReady = true;
            logger.info("[CacheInvalidationPubSub] Subscriber ready", {
                instanceId: this.instanceId
            });
        });

        this.subscriber.on("error", (error) => {
            this.isSubscriberReady = false;
            logger.error("[CacheInvalidationPubSub] Subscriber error", {
                instanceId: this.instanceId,
                error
            });
        });

        this.subscriber.on("reconnecting", () => {
            this.isSubscriberReady = false;
            logger.info("[CacheInvalidationPubSub] Subscriber reconnecting", {
                instanceId: this.instanceId
            });
        });

        // Handle incoming messages
        this.subscriber.on("message", async (channel, message) => {
            if (channel === this.CHANNEL) {
                await this.handleInvalidationMessage(message);
            }
        });
    }

    /**
     * Initialize pub/sub by subscribing to the invalidation channel
     * Should be called on application startup
     */
    async initialize(): Promise<void> {
        if (this.isSubscribed) {
            logger.warn("[CacheInvalidationPubSub] Already subscribed", {
                instanceId: this.instanceId
            });
            return;
        }

        try {
            // Connect subscriber if not already connected
            if (this.subscriber.status !== "ready" && this.subscriber.status !== "connecting") {
                await this.subscriber.connect();
            } else if (this.subscriber.status === "connecting") {
                // Wait for connection to complete
                await new Promise((resolve, reject) => {
                    const timeout = setTimeout(() => reject(new Error("Connection timeout")), 5000);
                    this.subscriber.once("ready", () => {
                        clearTimeout(timeout);
                        resolve(undefined);
                    });
                    this.subscriber.once("error", (err) => {
                        clearTimeout(timeout);
                        reject(err);
                    });
                });
            }

            // Subscribe to invalidation channel
            await this.subscriber.subscribe(this.CHANNEL);
            this.isSubscribed = true;

            logger.info("[CacheInvalidationPubSub] Subscribed to invalidation channel", {
                instanceId: this.instanceId,
                channel: this.CHANNEL
            });
        } catch (error) {
            logger.error("[CacheInvalidationPubSub] Failed to subscribe", {
                instanceId: this.instanceId,
                error
            });
            throw error;
        }
    }

    /**
     * Publish cache invalidation event to all instances
     * Requirement 7.2: Invalidation propagation
     */
    async publishInvalidation(pattern: string, tenantId?: string): Promise<void> {
        try {
            // Connect publisher if not already connected
            if (this.publisher.status !== "ready" && this.publisher.status !== "connecting") {
                await this.publisher.connect();
            } else if (this.publisher.status === "connecting") {
                // Wait for connection to complete
                await new Promise((resolve, reject) => {
                    const timeout = setTimeout(() => reject(new Error("Connection timeout")), 5000);
                    this.publisher.once("ready", () => {
                        clearTimeout(timeout);
                        resolve(undefined);
                    });
                    this.publisher.once("error", (err) => {
                        clearTimeout(timeout);
                        reject(err);
                    });
                });
            }

            const event: InvalidationEvent = {
                pattern,
                tenantId,
                timestamp: new Date().toISOString(),
                instanceId: this.instanceId
            };

            const message = JSON.stringify(event);
            const subscriberCount = await this.publisher.publish(this.CHANNEL, message);

            logger.debug("[CacheInvalidationPubSub] Published invalidation", {
                pattern,
                tenantId,
                instanceId: this.instanceId,
                subscriberCount
            });
        } catch (error) {
            logger.error("[CacheInvalidationPubSub] Failed to publish invalidation", {
                pattern,
                tenantId,
                instanceId: this.instanceId,
                error
            });
            // Don't throw - invalidation failures should not break operations
        }
    }

    /**
     * Register callback to handle invalidation events
     * Callbacks are called when invalidation events are received from other instances
     */
    onInvalidation(callback: InvalidationCallback): void {
        this.callbacks.push(callback);
        logger.debug("[CacheInvalidationPubSub] Registered invalidation callback", {
            instanceId: this.instanceId,
            totalCallbacks: this.callbacks.length
        });
    }

    /**
     * Handle incoming invalidation message
     */
    private async handleInvalidationMessage(message: string): Promise<void> {
        try {
            const event: InvalidationEvent = JSON.parse(message);

            // Skip events from this instance (we already invalidated locally)
            if (event.instanceId === this.instanceId) {
                logger.debug("[CacheInvalidationPubSub] Skipping own invalidation event", {
                    pattern: event.pattern,
                    instanceId: this.instanceId
                });
                return;
            }

            logger.info("[CacheInvalidationPubSub] Received invalidation event", {
                pattern: event.pattern,
                tenantId: event.tenantId,
                fromInstance: event.instanceId,
                thisInstance: this.instanceId
            });

            // Execute all registered callbacks
            await Promise.all(
                this.callbacks.map(callback =>
                    callback(event).catch(error => {
                        logger.error("[CacheInvalidationPubSub] Callback error", {
                            pattern: event.pattern,
                            error
                        });
                    })
                )
            );
        } catch (error) {
            logger.error("[CacheInvalidationPubSub] Failed to handle invalidation message", {
                message,
                error
            });
        }
    }

    /**
     * Check if pub/sub is ready
     */
    isReady(): boolean {
        return this.isPublisherReady && this.isSubscriberReady && this.isSubscribed;
    }

    /**
     * Get instance ID
     */
    getInstanceId(): string {
        return this.instanceId;
    }

    /**
     * Cleanup resources - for graceful shutdown
     */
    async cleanup(): Promise<void> {
        try {
            if (this.isSubscribed) {
                await this.subscriber.unsubscribe(this.CHANNEL);
                this.isSubscribed = false;
            }

            await Promise.all([
                this.publisher.quit(),
                this.subscriber.quit()
            ]);

            logger.info("[CacheInvalidationPubSub] Cleanup completed", {
                instanceId: this.instanceId
            });
        } catch (error) {
            logger.error("[CacheInvalidationPubSub] Cleanup error", {
                instanceId: this.instanceId,
                error
            });
        }
    }

    /**
     * Reset singleton instance - for testing only
     */
    static resetInstance(): void {
        if (CacheInvalidationPubSub.instance) {
            CacheInvalidationPubSub.instance.cleanup();
            CacheInvalidationPubSub.instance = null as any;
        }
    }
}

// Export singleton instance
export const cacheInvalidationPubSub = CacheInvalidationPubSub.getInstance();
